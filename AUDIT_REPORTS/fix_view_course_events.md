# Fix Plan: View Course Events Functionality

## Executive Summary

This fix plan addresses 33 critical issues in the course events system by eliminating raw SQL workarounds, implementing proper authorization patterns, and restoring healthy error handling. Building on the ORM fixes and service patterns from previous fixes, this plan transforms a working-but-fragile system into a maintainable, secure, and performant events display.

## Phase 1: Critical Architecture Fixes (Week 1)

### 1.1 Eliminate Raw SQL Bypasses
**Priority**: CRITICAL - Security/Maintainability
**Issue**: Raw SQL used to avoid ORM enum problems, creating security and maintenance risks

**Solution**: Complete the ORM enum fixes started in previous plans
```python
# /backend/app/models/course_event.py - COMPLETED FROM PREVIOUS FIXES
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from enum import Enum

class EventCategory(str, Enum):
    EXAM = "exam"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    PROJECT = "project"
    CLASS = "class"
    PRESENTATION = "presentation"
    OTHER = "other"

class EventSource(str, Enum):
    PARSER = "parser"
    MANUAL = "manual"
    IMPORTED = "imported"

class CourseEvent(Base):
    __tablename__ = "course_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(SQLEnum(EventCategory), nullable=False, default=EventCategory.OTHER)
    source = Column(SQLEnum(EventSource), nullable=False, default=EventSource.MANUAL)
    due_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_visible = Column(Boolean, default=True, nullable=False)
    
    # Proper relationship
    course = relationship("Course", back_populates="events")

# /backend/app/services/course_events_service.py - NEW FILE
from typing import List, Dict, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from ..models.course_event import CourseEvent, EventCategory
from ..models.course import Course
from ..models.student_course_link import StudentCourseLink
from ..models.user import User, UserRole
from ..services.auth_service import AuthorizationService
from ..utils.logger import get_logger

logger = get_logger(__name__)

class CourseEventsService:
    def __init__(self, db: Session, auth_service: AuthorizationService):
        self.db = db
        self.auth_service = auth_service

    async def get_course_events(
        self, 
        course_id: str, 
        user: User,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Dict:
        """Get course events with proper authorization and ORM usage"""
        
        try:
            # Verify user has access to course
            access_result = await self.auth_service.verify_course_access(user, course_id)
            if not access_result.has_access:
                return {
                    "success": False,
                    "error": access_result.error_message,
                    "error_code": access_result.error_code
                }
            
            # Build query using proper ORM
            query = self.db.query(CourseEvent).options(
                joinedload(CourseEvent.course)
            ).filter(
                CourseEvent.course_id == course_id,
                CourseEvent.is_visible == True
            )
            
            # Apply user-specific filtering
            if user.role == UserRole.STUDENT:
                # Students only see non-sensitive events
                query = query.filter(
                    or_(
                        CourseEvent.category.in_([
                            EventCategory.EXAM, EventCategory.QUIZ,
                            EventCategory.ASSIGNMENT, EventCategory.PROJECT,
                            EventCategory.CLASS
                        ]),
                        and_(
                            CourseEvent.category == EventCategory.OTHER,
                            CourseEvent.description.notlike('%private%'),
                            CourseEvent.description.notlike('%confidential%')
                        )
                    )
                )
            
            # Apply pagination if provided
            if offset:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            
            # Order by due date for better UX
            query = query.order_by(CourseEvent.due_date.asc().nullslast())
            
            events = query.all()
            
            # Convert to response format using proper serialization
            event_data = [self._serialize_event(event, user) for event in events]
            
            # Get total count for pagination
            total_count = self.db.query(CourseEvent).filter(
                CourseEvent.course_id == course_id,
                CourseEvent.is_visible == True
            ).count()
            
            return {
                "success": True,
                "events": event_data,
                "total_count": total_count,
                "has_more": (offset or 0) + len(events) < total_count if limit else False
            }
            
        except Exception as e:
            logger.error(f"Failed to get course events for {course_id}: {e}")
            return {
                "success": False,
                "error": "Failed to load course events",
                "error_code": "EVENTS_LOAD_FAILED"
            }
    
    def _serialize_event(self, event: CourseEvent, user: User) -> Dict:
        """Serialize event with user-appropriate information"""
        
        base_data = {
            "id": str(event.id),
            "title": event.title,
            "category": event.category.value,
            "due_date": event.due_date.isoformat() if event.due_date else None,
            "created_at": event.created_at.isoformat(),
        }
        
        # Add description based on user role and content sensitivity
        if user.role in [UserRole.PROFESSOR, UserRole.ADMIN]:
            base_data["description"] = event.description
            base_data["source"] = event.source.value
        else:
            # Students get filtered description
            base_data["description"] = self._filter_description_for_student(event.description)
        
        return base_data
    
    def _filter_description_for_student(self, description: str) -> Optional[str]:
        """Filter event description for student viewing"""
        if not description:
            return None
        
        # Basic content filtering
        sensitive_keywords = ['private', 'confidential', 'admin', 'internal']
        description_lower = description.lower()
        
        if any(keyword in description_lower for keyword in sensitive_keywords):
            return "Details available from instructor"
        
        return description

# /backend/app/services/auth_service.py - ENHANCED
from dataclasses import dataclass
from typing import Optional

@dataclass
class CourseAccessResult:
    has_access: bool
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    access_level: Optional[str] = None  # 'read', 'write', 'admin'

class AuthorizationService:
    def __init__(self, db: Session):
        self.db = db
    
    async def verify_course_access(self, user: User, course_id: str) -> CourseAccessResult:
        """Centralized course access verification"""
        
        # Admin access
        if user.role == UserRole.ADMIN:
            return CourseAccessResult(
                has_access=True,
                access_level="admin"
            )
        
        # Get course
        course = self.db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return CourseAccessResult(
                has_access=False,
                error_message="Course not found",
                error_code="COURSE_NOT_FOUND"
            )
        
        # Professor access (course owner)
        if user.role == UserRole.PROFESSOR and course.created_by == user.id:
            return CourseAccessResult(
                has_access=True,
                access_level="write"
            )
        
        # Student access (enrolled)
        if user.role == UserRole.STUDENT:
            enrollment = self.db.query(StudentCourseLink).filter(
                StudentCourseLink.student_id == user.id,
                StudentCourseLink.course_id == course_id,
                StudentCourseLink.is_deleted == False
            ).first()
            
            if enrollment:
                return CourseAccessResult(
                    has_access=True,
                    access_level="read"
                )
            else:
                return CourseAccessResult(
                    has_access=False,
                    error_message="You are not enrolled in this course",
                    error_code="NOT_ENROLLED"
                )
        
        # No access
        return CourseAccessResult(
            has_access=False,
            error_message="Access denied",
            error_code="ACCESS_DENIED"
        )

# /backend/app/routers/course_events.py - NEW FILE
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..services.course_events_service import CourseEventsService
from ..services.auth_service import AuthorizationService
from ..models.user import User

router = APIRouter(prefix="/api/courses", tags=["course-events"])

@router.get("/{course_id}/events")
async def get_course_events(
    course_id: str,
    limit: Optional[int] = Query(default=50, le=100),
    offset: Optional[int] = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """Get course events with proper authorization and pagination"""
    
    auth_service = AuthorizationService(db)
    events_service = CourseEventsService(db, auth_service)
    
    result = await events_service.get_course_events(
        course_id, current_user, limit, offset
    )
    
    if not result["success"]:
        status_code = 404 if result["error_code"] == "COURSE_NOT_FOUND" else 403
        raise HTTPException(status_code, result["error"])
    
    return {
        "events": result["events"],
        "pagination": {
            "total_count": result["total_count"],
            "limit": limit,
            "offset": offset,
            "has_more": result["has_more"]
        }
    }
```

**Database migration to fix existing enum data**:
```python
# /backend/alembic/versions/fix_events_enums.py
def upgrade():
    # Fix existing enum values to match new enum definition
    op.execute("""
        UPDATE course_events 
        SET category = LOWER(category),
            source = LOWER(source)
        WHERE category IS NOT NULL OR source IS NOT NULL
    """)
    
    # Add visibility column
    op.add_column('course_events', sa.Column('is_visible', sa.Boolean, default=True))
    op.execute("UPDATE course_events SET is_visible = true WHERE is_visible IS NULL")
    op.alter_column('course_events', 'is_visible', nullable=False)
```

**Impact**: Eliminates SQL injection risk, restores type safety, improves maintainability
**Effort**: 10 hours

### 1.2 Restore Healthy Error Handling
**Priority**: CRITICAL - User Experience/Debugging
**Issue**: Retry prevention masks server errors, preventing proper error visibility

**Solution**: Remove blanket retry prevention and fix root causes
```typescript
// /frontend-react/src/services/api.ts - UPDATED
// Remove the blanket retry prevention that was masking errors
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
});

// Smart retry logic instead of blanket prevention
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Don't retry if we've already retried or on client errors
    if (config._retry || error.response?.status < 500) {
      return Promise.reject(error);
    }
    
    // Only retry on specific server errors, not all 500s
    const retryableErrors = [502, 503, 504]; // Gateway errors, service unavailable
    if (retryableErrors.includes(error.response?.status)) {
      config._retry = true;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, config._retryCount || 0), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      config._retryCount = (config._retryCount || 0) + 1;
      
      // Max 2 retries
      if (config._retryCount <= 2) {
        return api.request(config);
      }
    }
    
    return Promise.reject(error);
  }
);

// /frontend-react/src/hooks/useCourseEvents.ts - NEW FILE
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface CourseEventsResponse {
  events: CourseEvent[];
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

interface UseCourseEventsOptions {
  limit?: number;
  offset?: number;
}

export const useCourseEvents = (
  courseId: string, 
  options: UseCourseEventsOptions = {}
) => {
  const { limit = 50, offset = 0 } = options;
  
  return useQuery({
    queryKey: ['course-events', courseId, limit, offset],
    queryFn: async (): Promise<CourseEventsResponse> => {
      const response = await api.get(`/courses/${courseId}/events`, {
        params: { limit, offset }
      });
      return response.data;
    },
    retry: (failureCount, error) => {
      // Smart retry logic
      if (error.response?.status === 403 || error.response?.status === 404) {
        return false; // Don't retry auth or not found errors
      }
      return failureCount < 2; // Retry server errors up to 2 times
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// /frontend-react/src/components/course-events/CourseEventsDisplay.tsx - NEW FILE
import { useState } from 'react';
import { 
  Box, Typography, Alert, CircularProgress, 
  List, ListItem, Chip, Pagination
} from '@mui/material';
import { Error as ErrorIcon, Event as EventIcon } from '@mui/icons-material';

interface CourseEventsDisplayProps {
  courseId: string;
  courseName?: string;
}

export const CourseEventsDisplay: React.FC<CourseEventsDisplayProps> = ({
  courseId,
  courseName
}) => {
  const [page, setPage] = useState(1);
  const eventsPerPage = 20;
  const offset = (page - 1) * eventsPerPage;
  
  const { 
    data, 
    isLoading, 
    error, 
    isError,
    isFetching
  } = useCourseEvents(courseId, { 
    limit: eventsPerPage, 
    offset 
  });

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justItems: 'center', py: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading course events...</Typography>
      </Box>
    );
  }

  // Error state with specific messaging
  if (isError) {
    const errorMessage = error?.response?.status === 403 
      ? "You don't have permission to view events for this course"
      : error?.response?.status === 404
      ? "Course not found"
      : "Failed to load course events. Please try again.";
    
    return (
      <Alert 
        severity="error" 
        icon={<ErrorIcon />}
        action={
          <Button onClick={() => queryClient.invalidateQueries(['course-events', courseId])}>
            Retry
          </Button>
        }
      >
        {errorMessage}
      </Alert>
    );
  }

  // Empty state
  if (!data?.events?.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No events yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {courseName ? `${courseName} doesn't have any events scheduled.` : 
           'This course doesn\'t have any events scheduled.'}
        </Typography>
      </Box>
    );
  }

  const totalPages = Math.ceil(data.pagination.total_count / eventsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Course Events {isFetching && <CircularProgress size={20} sx={{ ml: 1 }} />}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.pagination.total_count} total events
        </Typography>
      </Box>

      <List>
        {data.events.map(event => (
          <CourseEventItem key={event.id} event={event} />
        ))}
      </List>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};
```

**Impact**: Restores proper error visibility, improves debugging, better user experience
**Effort**: 6 hours

### 1.3 Implement Content Security for Events
**Priority**: HIGH - Security
**Issue**: Event injection and inappropriate content exposure

**Solution**: Content validation and access controls
```python
# /backend/app/services/content_security_service.py - NEW FILE
from typing import Dict, List, Optional
import re
from ..utils.logger import get_logger

logger = get_logger(__name__)

class ContentSecurityService:
    # Potentially harmful patterns in event content
    UNSAFE_PATTERNS = [
        r'<script[^>]*>.*?</script>',  # JavaScript
        r'javascript:',  # JavaScript URLs
        r'on\w+\s*=',  # Event handlers
        r'<iframe[^>]*>',  # iframes
        r'<embed[^>]*>',  # Embedded objects
        r'<object[^>]*>',  # Objects
        r'data:text/html',  # Data URLs with HTML
    ]
    
    # Sensitive information patterns
    SENSITIVE_PATTERNS = [
        r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
        r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',  # Credit card
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email (in certain contexts)
    ]

    def validate_event_content(self, title: str, description: str) -> Dict[str, any]:
        """Validate event content for security and appropriateness"""
        
        issues = []
        
        # Check for unsafe HTML/JS
        content_to_check = f"{title} {description or ''}"
        for pattern in self.UNSAFE_PATTERNS:
            if re.search(pattern, content_to_check, re.IGNORECASE):
                issues.append("Potentially unsafe HTML/JavaScript detected")
                break
        
        # Check for sensitive information
        for pattern in self.SENSITIVE_PATTERNS:
            if re.search(pattern, content_to_check):
                issues.append("Potential sensitive information detected")
                break
        
        # Check length limits
        if len(title) > 255:
            issues.append("Title too long (max 255 characters)")
        
        if description and len(description) > 5000:
            issues.append("Description too long (max 5000 characters)")
        
        # Content quality checks
        if title.isupper() and len(title) > 20:
            issues.append("Excessive use of capital letters")
        
        return {
            "is_safe": len(issues) == 0,
            "issues": issues,
            "sanitized_title": self._sanitize_content(title),
            "sanitized_description": self._sanitize_content(description)
        }
    
    def _sanitize_content(self, content: str) -> str:
        """Basic content sanitization"""
        if not content:
            return content
        
        # Remove potentially dangerous HTML
        for pattern in self.UNSAFE_PATTERNS:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)
        
        # Basic HTML encoding for safety
        content = content.replace('<', '&lt;').replace('>', '&gt;')
        
        return content.strip()

# /backend/app/models/event_moderation.py - NEW FILE
class EventModerationLog(Base):
    __tablename__ = "event_moderation_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("course_events.id"), nullable=False)
    moderator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # 'approved', 'flagged', 'removed'
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    event = relationship("CourseEvent")
    moderator = relationship("User")

# Enhanced CourseEventsService with content security
class CourseEventsService:
    def __init__(self, db: Session, auth_service: AuthorizationService):
        self.db = db
        self.auth_service = auth_service
        self.content_security = ContentSecurityService()

    async def create_event(
        self, 
        course_id: str,
        title: str,
        description: str,
        category: EventCategory,
        due_date: Optional[datetime],
        user: User
    ) -> Dict:
        """Create course event with content validation"""
        
        # Verify user can create events for this course
        access_result = await self.auth_service.verify_course_access(user, course_id)
        if not access_result.has_access or access_result.access_level not in ['write', 'admin']:
            return {
                "success": False,
                "error": "You don't have permission to create events for this course"
            }
        
        # Validate content security
        validation_result = self.content_security.validate_event_content(title, description)
        if not validation_result["is_safe"]:
            return {
                "success": False,
                "error": "Event content failed security validation",
                "issues": validation_result["issues"]
            }
        
        try:
            # Create event with sanitized content
            event = CourseEvent(
                course_id=course_id,
                title=validation_result["sanitized_title"],
                description=validation_result["sanitized_description"],
                category=category,
                due_date=due_date,
                source=EventSource.MANUAL
            )
            
            self.db.add(event)
            self.db.commit()
            
            logger.info(f"Event created for course {course_id} by user {user.id}")
            
            return {
                "success": True,
                "event_id": str(event.id),
                "message": "Event created successfully"
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create event: {e}")
            return {
                "success": False,
                "error": "Failed to create event"
            }
```

**Impact**: Prevents malicious content injection, protects student privacy
**Effort**: 8 hours

## Phase 2: Performance & Caching (Week 2)

### 2.1 Implement Event Caching System
**Priority**: HIGH - Performance
**Issue**: Course events queried fresh on every request

**Solution**: Multi-layer caching with invalidation
```python
# /backend/app/services/cache_service.py - NEW FILE (if not exists from previous fixes)
import redis
import json
from typing import Optional, Dict, List
from datetime import timedelta
from ..utils.logger import get_logger

logger = get_logger(__name__)

class CacheService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            db=0,
            decode_responses=True
        )
        self.default_ttl = 300  # 5 minutes

    async def get_course_events(self, course_id: str, user_role: str) -> Optional[List[Dict]]:
        """Get cached course events for specific user role"""
        cache_key = f"course_events:{course_id}:{user_role}"
        
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Cache read failed for {cache_key}: {e}")
        
        return None
    
    async def set_course_events(
        self, 
        course_id: str, 
        user_role: str, 
        events: List[Dict],
        ttl: Optional[int] = None
    ):
        """Cache course events for specific user role"""
        cache_key = f"course_events:{course_id}:{user_role}"
        
        try:
            self.redis_client.setex(
                cache_key,
                ttl or self.default_ttl,
                json.dumps(events)
            )
        except Exception as e:
            logger.warning(f"Cache write failed for {cache_key}: {e}")
    
    async def invalidate_course_events(self, course_id: str):
        """Invalidate all cached events for a course"""
        patterns = [
            f"course_events:{course_id}:*",
            f"course_summary:{course_id}",
        ]
        
        try:
            for pattern in patterns:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            logger.info(f"Invalidated cache for course {course_id}")
        except Exception as e:
            logger.warning(f"Cache invalidation failed for course {course_id}: {e}")

# Enhanced CourseEventsService with caching
class CourseEventsService:
    def __init__(self, db: Session, auth_service: AuthorizationService, cache_service: CacheService):
        self.db = db
        self.auth_service = auth_service
        self.cache_service = cache_service
        self.content_security = ContentSecurityService()

    async def get_course_events(
        self, 
        course_id: str, 
        user: User,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        use_cache: bool = True
    ) -> Dict:
        """Get course events with caching support"""
        
        # Verify access first
        access_result = await self.auth_service.verify_course_access(user, course_id)
        if not access_result.has_access:
            return {
                "success": False,
                "error": access_result.error_message,
                "error_code": access_result.error_code
            }
        
        # Check cache for non-paginated requests
        if use_cache and not offset and (not limit or limit >= 50):
            cached_events = await self.cache_service.get_course_events(
                course_id, user.role.value
            )
            if cached_events:
                # Apply pagination to cached results if needed
                if limit:
                    cached_events = cached_events[:limit]
                
                return {
                    "success": True,
                    "events": cached_events,
                    "total_count": len(cached_events),
                    "from_cache": True
                }
        
        # Fetch from database
        try:
            events_data = await self._fetch_events_from_db(course_id, user, limit, offset)
            
            # Cache the results (only for full, non-paginated requests)
            if use_cache and not offset and (not limit or limit >= 50):
                await self.cache_service.set_course_events(
                    course_id, 
                    user.role.value, 
                    events_data["events"],
                    ttl=600  # 10 minutes for events
                )
            
            return events_data
            
        except Exception as e:
            logger.error(f"Failed to get course events for {course_id}: {e}")
            return {
                "success": False,
                "error": "Failed to load course events",
                "error_code": "EVENTS_LOAD_FAILED"
            }
    
    async def _fetch_events_from_db(
        self, 
        course_id: str, 
        user: User, 
        limit: Optional[int], 
        offset: Optional[int]
    ) -> Dict:
        """Fetch events from database with optimized query"""
        
        # Single optimized query using joins
        query = self.db.query(CourseEvent).options(
            joinedload(CourseEvent.course)
        ).join(Course).filter(
            CourseEvent.course_id == course_id,
            CourseEvent.is_visible == True,
            Course.status == CourseStatus.ACTIVE
        )
        
        # Apply role-based filtering
        if user.role == UserRole.STUDENT:
            query = query.filter(
                or_(
                    CourseEvent.category.in_([
                        EventCategory.EXAM, EventCategory.QUIZ,
                        EventCategory.ASSIGNMENT, EventCategory.PROJECT,
                        EventCategory.CLASS
                    ]),
                    and_(
                        CourseEvent.category == EventCategory.OTHER,
                        ~CourseEvent.description.ilike('%private%'),
                        ~CourseEvent.description.ilike('%confidential%')
                    )
                )
            )
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply pagination and ordering
        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)
        
        query = query.order_by(
            CourseEvent.due_date.asc().nullslast(),
            CourseEvent.created_at.desc()
        )
        
        events = query.all()
        
        # Serialize events
        event_data = [self._serialize_event(event, user) for event in events]
        
        return {
            "success": True,
            "events": event_data,
            "total_count": total_count,
            "has_more": (offset or 0) + len(events) < total_count if limit else False,
            "from_cache": False
        }

    async def create_event(self, *args, **kwargs) -> Dict:
        """Create event and invalidate cache"""
        result = await super().create_event(*args, **kwargs)
        
        if result["success"]:
            # Invalidate cache for the course
            course_id = kwargs.get('course_id')
            if course_id:
                await self.cache_service.invalidate_course_events(course_id)
        
        return result
```

**Frontend caching with React Query**:
```typescript
// /frontend-react/src/hooks/useCourseEvents.ts - ENHANCED
export const useCourseEvents = (
  courseId: string, 
  options: UseCourseEventsOptions = {}
) => {
  const { limit = 50, offset = 0 } = options;
  
  return useQuery({
    queryKey: ['course-events', courseId, limit, offset],
    queryFn: async (): Promise<CourseEventsResponse> => {
      const response = await api.get(`/courses/${courseId}/events`, {
        params: { limit, offset }
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend cache
    cacheTime: 15 * 60 * 1000, // 15 minutes
    retry: (failureCount, error) => {
      if (error.response?.status === 403 || error.response?.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    
    // Prefetch next page for better UX
    onSuccess: (data) => {
      if (data.pagination.has_more) {
        queryClient.prefetchQuery({
          queryKey: ['course-events', courseId, limit, offset + limit],
          queryFn: () => api.get(`/courses/${courseId}/events`, {
            params: { limit, offset: offset + limit }
          }).then(r => r.data),
          staleTime: 5 * 60 * 1000,
        });
      }
    }
  });
};

// Cache invalidation helper
export const useInvalidateCourseEvents = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateEvents: (courseId: string) => {
      queryClient.invalidateQueries(['course-events', courseId]);
    },
    
    updateEventCache: (courseId: string, updatedEvent: CourseEvent) => {
      queryClient.setQueriesData(
        ['course-events', courseId],
        (oldData: CourseEventsResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            events: oldData.events.map(event =>
              event.id === updatedEvent.id ? updatedEvent : event
            )
          };
        }
      );
    }
  };
};
```

**Impact**: Dramatically improves performance, reduces database load
**Effort**: 8 hours

### 2.2 Implement Real-time Event Updates
**Priority**: MEDIUM - User Experience
**Issue**: Events updates not reflected in real-time

**Solution**: WebSocket-based real-time updates
```python
# /backend/app/websockets/events_websocket.py - NEW FILE
from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
import json
from ..services.auth_service import get_current_user_websocket
from ..models.user import User

class EventsWebSocketManager:
    def __init__(self):
        # Track connections by course_id
        self.course_connections: Dict[str, List[WebSocket]] = {}
        # Track user permissions
        self.connection_permissions: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket, course_id: str, user: User):
        """Connect user to course events updates"""
        await websocket.accept()
        
        # Verify user has access to course
        # (Use existing auth service)
        # access_result = await self.auth_service.verify_course_access(user, course_id)
        # if not access_result.has_access:
        #     await websocket.close(code=4003, reason="Access denied")
        #     return
        
        # Add to course connections
        if course_id not in self.course_connections:
            self.course_connections[course_id] = []
        
        self.course_connections[course_id].append(websocket)
        self.connection_permissions[websocket] = {
            "course_id": course_id,
            "user_id": str(user.id),
            "role": user.role.value
        }
        
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "course_id": course_id,
            "message": "Connected to course events updates"
        }))
    
    async def disconnect(self, websocket: WebSocket):
        """Disconnect websocket"""
        # Remove from all course connections
        for course_id, connections in self.course_connections.items():
            if websocket in connections:
                connections.remove(websocket)
        
        # Remove permissions
        self.connection_permissions.pop(websocket, None)
    
    async def broadcast_event_update(self, course_id: str, event_data: Dict, update_type: str):
        """Broadcast event update to all connected users for a course"""
        if course_id not in self.course_connections:
            return
        
        message = {
            "type": "event_update",
            "update_type": update_type,  # 'created', 'updated', 'deleted'
            "course_id": course_id,
            "event": event_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all connected users for this course
        disconnected = []
        for websocket in self.course_connections[course_id]:
            try:
                await websocket.send_text(json.dumps(message))
            except WebSocketDisconnect:
                disconnected.append(websocket)
        
        # Clean up disconnected websockets
        for ws in disconnected:
            self.course_connections[course_id].remove(ws)
            self.connection_permissions.pop(ws, None)

events_ws_manager = EventsWebSocketManager()

# WebSocket endpoint
@router.websocket("/ws/courses/{course_id}/events")
async def course_events_websocket(
    websocket: WebSocket,
    course_id: str,
    user: User = Depends(get_current_user_websocket)
):
    await events_ws_manager.connect(websocket, course_id, user)
    
    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    
    except WebSocketDisconnect:
        await events_ws_manager.disconnect(websocket)

# Enhanced CourseEventsService with WebSocket notifications
class CourseEventsService:
    def __init__(self, db: Session, auth_service: AuthorizationService, 
                 cache_service: CacheService, ws_manager: EventsWebSocketManager):
        self.db = db
        self.auth_service = auth_service
        self.cache_service = cache_service
        self.ws_manager = ws_manager
        self.content_security = ContentSecurityService()

    async def create_event(self, *args, **kwargs) -> Dict:
        """Create event with real-time notification"""
        result = await super().create_event(*args, **kwargs)
        
        if result["success"]:
            course_id = kwargs.get('course_id')
            
            # Invalidate cache
            await self.cache_service.invalidate_course_events(course_id)
            
            # Get the created event for broadcasting
            event = self.db.query(CourseEvent).filter(
                CourseEvent.id == result["event_id"]
            ).first()
            
            if event:
                event_data = self._serialize_event(event, kwargs.get('user'))
                
                # Broadcast to WebSocket connections
                await self.ws_manager.broadcast_event_update(
                    course_id, event_data, "created"
                )
        
        return result
```

**Frontend WebSocket integration**:
```typescript
// /frontend-react/src/hooks/useCourseEventsWebSocket.ts - NEW FILE
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface EventUpdate {
  type: 'event_update';
  update_type: 'created' | 'updated' | 'deleted';
  course_id: string;
  event: CourseEvent;
  timestamp: string;
}

export const useCourseEventsWebSocket = (courseId: string) => {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    const token = localStorage.getItem('access_token');
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/courses/${courseId}/events?token=${token}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Connected to course events WebSocket');
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'event_update') {
          handleEventUpdate(data as EventUpdate);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed, attempting to reconnect...');
      
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const handleEventUpdate = (update: EventUpdate) => {
    // Update React Query cache with new event data
    queryClient.setQueriesData(
      ['course-events', courseId],
      (oldData: CourseEventsResponse | undefined) => {
        if (!oldData) return oldData;
        
        let updatedEvents = [...oldData.events];
        
        switch (update.update_type) {
          case 'created':
            // Add new event, maintaining sort order
            updatedEvents.unshift(update.event);
            break;
            
          case 'updated':
            updatedEvents = updatedEvents.map(event =>
              event.id === update.event.id ? update.event : event
            );
            break;
            
          case 'deleted':
            updatedEvents = updatedEvents.filter(event =>
              event.id !== update.event.id
            );
            break;
        }
        
        return {
          ...oldData,
          events: updatedEvents,
          pagination: {
            ...oldData.pagination,
            total_count: update.update_type === 'created' 
              ? oldData.pagination.total_count + 1
              : update.update_type === 'deleted'
              ? oldData.pagination.total_count - 1
              : oldData.pagination.total_count
          }
        };
      }
    );
    
    // Show toast notification for new events
    if (update.update_type === 'created') {
      // toast.info(`New event: ${update.event.title}`);
    }
  };

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [courseId]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
};

// Enhanced CourseEventsDisplay component
export const CourseEventsDisplay: React.FC<CourseEventsDisplayProps> = ({
  courseId,
  courseName
}) => {
  const [page, setPage] = useState(1);
  const eventsPerPage = 20;
  const offset = (page - 1) * eventsPerPage;
  
  // WebSocket connection for real-time updates
  const { isConnected } = useCourseEventsWebSocket(courseId);
  
  const { data, isLoading, error, isError, isFetching } = useCourseEvents(courseId, { 
    limit: eventsPerPage, 
    offset 
  });

  // Rest of component implementation...
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Course Events 
          {isFetching && <CircularProgress size={20} sx={{ ml: 1 }} />}
          {isConnected && (
            <Chip 
              label="Live" 
              color="success" 
              size="small" 
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data?.pagination.total_count} total events
        </Typography>
      </Box>
      
      {/* Rest of component... */}
    </Box>
  );
};
```

**Impact**: Real-time collaboration, improved user experience
**Effort**: 12 hours

## Phase 3: Advanced Features & Polish (Week 3)

### 3.1 Implement Event Filtering and Search
**Priority**: MEDIUM - User Experience
**Issue**: Large course event lists are difficult to navigate

**Solution**: Advanced filtering and search capabilities
```python
# /backend/app/services/event_search_service.py - NEW FILE
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from ..models.course_event import CourseEvent, EventCategory

class EventSearchService:
    def __init__(self, db: Session):
        self.db = db

    async def search_events(
        self,
        course_id: str,
        user: User,
        search_query: Optional[str] = None,
        categories: Optional[List[EventCategory]] = None,
        date_range: Optional[Dict[str, datetime]] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """Advanced event search with filters"""
        
        # Base query
        query = self.db.query(CourseEvent).filter(
            CourseEvent.course_id == course_id,
            CourseEvent.is_visible == True
        )
        
        # Apply role-based filtering (from existing service)
        if user.role == UserRole.STUDENT:
            query = query.filter(
                or_(
                    CourseEvent.category.in_([
                        EventCategory.EXAM, EventCategory.QUIZ,
                        EventCategory.ASSIGNMENT, EventCategory.PROJECT,
                        EventCategory.CLASS
                    ]),
                    and_(
                        CourseEvent.category == EventCategory.OTHER,
                        ~CourseEvent.description.ilike('%private%'),
                        ~CourseEvent.description.ilike('%confidential%')
                    )
                )
            )
        
        # Text search
        if search_query:
            search_terms = search_query.strip().split()
            for term in search_terms:
                query = query.filter(
                    or_(
                        CourseEvent.title.ilike(f'%{term}%'),
                        CourseEvent.description.ilike(f'%{term}%')
                    )
                )
        
        # Category filter
        if categories:
            query = query.filter(CourseEvent.category.in_(categories))
        
        # Date range filter
        if date_range:
            if date_range.get('start'):
                query = query.filter(CourseEvent.due_date >= date_range['start'])
            if date_range.get('end'):
                query = query.filter(CourseEvent.due_date <= date_range['end'])
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination and ordering
        events = query.order_by(
            CourseEvent.due_date.asc().nullslast(),
            CourseEvent.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            "events": events,
            "total_count": total_count,
            "has_more": offset + len(events) < total_count
        }

    async def get_event_analytics(self, course_id: str, user: User) -> Dict:
        """Get analytics about course events"""
        
        # Only professors and admins can see analytics
        if user.role not in [UserRole.PROFESSOR, UserRole.ADMIN]:
            return {"error": "Access denied"}
        
        # Category distribution
        category_stats = self.db.query(
            CourseEvent.category,
            func.count(CourseEvent.id).label('count')
        ).filter(
            CourseEvent.course_id == course_id,
            CourseEvent.is_visible == True
        ).group_by(CourseEvent.category).all()
        
        # Upcoming events (next 30 days)
        upcoming_count = self.db.query(CourseEvent).filter(
            CourseEvent.course_id == course_id,
            CourseEvent.is_visible == True,
            CourseEvent.due_date.between(
                datetime.utcnow(),
                datetime.utcnow() + timedelta(days=30)
            )
        ).count()
        
        # Events by month
        monthly_stats = self.db.query(
            func.date_trunc('month', CourseEvent.due_date).label('month'),
            func.count(CourseEvent.id).label('count')
        ).filter(
            CourseEvent.course_id == course_id,
            CourseEvent.is_visible == True,
            CourseEvent.due_date.isnot(None)
        ).group_by('month').order_by('month').all()
        
        return {
            "category_distribution": [
                {"category": cat.value, "count": count} 
                for cat, count in category_stats
            ],
            "upcoming_events": upcoming_count,
            "monthly_distribution": [
                {"month": month.isoformat(), "count": count}
                for month, count in monthly_stats
            ]
        }

# Enhanced endpoint with search
@router.get("/{course_id}/events/search")
async def search_course_events(
    course_id: str,
    q: Optional[str] = Query(None, description="Search query"),
    categories: Optional[str] = Query(None, description="Comma-separated categories"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """Search course events with advanced filters"""
    
    auth_service = AuthorizationService(db)
    search_service = EventSearchService(db)
    
    # Verify access
    access_result = await auth_service.verify_course_access(current_user, course_id)
    if not access_result.has_access:
        raise HTTPException(403, access_result.error_message)
    
    # Parse categories
    category_list = None
    if categories:
        try:
            category_list = [EventCategory(cat.strip()) for cat in categories.split(',')]
        except ValueError:
            raise HTTPException(400, "Invalid category filter")
    
    # Build date range
    date_range = None
    if start_date or end_date:
        date_range = {}
        if start_date:
            date_range['start'] = start_date
        if end_date:
            date_range['end'] = end_date
    
    result = await search_service.search_events(
        course_id, current_user, q, category_list, date_range, limit, offset
    )
    
    # Serialize events
    events_service = CourseEventsService(db, auth_service, cache_service, ws_manager)
    event_data = [
        events_service._serialize_event(event, current_user) 
        for event in result["events"]
    ]
    
    return {
        "events": event_data,
        "pagination": {
            "total_count": result["total_count"],
            "limit": limit,
            "offset": offset,
            "has_more": result["has_more"]
        },
        "filters_applied": {
            "search_query": q,
            "categories": categories,
            "date_range": date_range
        }
    }
```

**Frontend search interface**:
```typescript
// /frontend-react/src/components/course-events/EventFilters.tsx - NEW FILE
import { useState } from 'react';
import { 
  Box, TextField, FormControl, InputLabel, Select, MenuItem,
  Chip, Button, Accordion, AccordionSummary, AccordionDetails,
  Typography
} from '@mui/material';
import { FilterList, ExpandMore, Clear } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

interface EventFiltersProps {
  onFiltersChange: (filters: EventFilters) => void;
  currentFilters: EventFilters;
}

interface EventFilters {
  searchQuery: string;
  categories: string[];
  startDate: Date | null;
  endDate: Date | null;
}

export const EventFilters: React.FC<EventFiltersProps> = ({
  onFiltersChange,
  currentFilters
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const categories = [
    { value: 'exam', label: 'Exams' },
    { value: 'quiz', label: 'Quizzes' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'project', label: 'Projects' },
    { value: 'class', label: 'Classes' },
    { value: 'presentation', label: 'Presentations' },
    { value: 'other', label: 'Other' }
  ];

  const updateFilters = (updates: Partial<EventFilters>) => {
    onFiltersChange({ ...currentFilters, ...updates });
  };

  const clearFilters = () => {
    onFiltersChange({
      searchQuery: '',
      categories: [],
      startDate: null,
      endDate: null
    });
  };

  const hasActiveFilters = 
    currentFilters.searchQuery || 
    currentFilters.categories.length > 0 ||
    currentFilters.startDate ||
    currentFilters.endDate;

  return (
    <Box sx={{ mb: 3 }}>
      {/* Quick search */}
      <TextField
        fullWidth
        label="Search events"
        value={currentFilters.searchQuery}
        onChange={(e) => updateFilters({ searchQuery: e.target.value })}
        placeholder="Search by title or description..."
        sx={{ mb: 2 }}
      />

      {/* Advanced filters */}
      <Accordion expanded={isExpanded} onChange={(_, expanded) => setIsExpanded(expanded)}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList />
            <Typography>Advanced Filters</Typography>
            {hasActiveFilters && (
              <Chip label="Filters Active" color="primary" size="small" />
            )}
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Category filter */}
            <FormControl fullWidth>
              <InputLabel>Event Categories</InputLabel>
              <Select
                multiple
                value={currentFilters.categories}
                onChange={(e) => updateFilters({ categories: e.target.value as string[] })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={categories.find(c => c.value === value)?.label || value}
                        size="small" 
                      />
                    ))}
                  </Box>
                )}
              >
                {categories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date range */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={currentFilters.startDate}
                onChange={(date) => updateFilters({ startDate: date })}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label="End Date"
                value={currentFilters.endDate}
                onChange={(date) => updateFilters({ endDate: date })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Box>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                startIcon={<Clear />}
                onClick={clearFilters}
                variant="outlined"
                sx={{ alignSelf: 'flex-start' }}
              >
                Clear All Filters
              </Button>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

// Enhanced events display with search
export const CourseEventsDisplay: React.FC<CourseEventsDisplayProps> = ({
  courseId,
  courseName
}) => {
  const [filters, setFilters] = useState<EventFilters>({
    searchQuery: '',
    categories: [],
    startDate: null,
    endDate: null
  });
  
  const [page, setPage] = useState(1);
  const eventsPerPage = 20;
  const offset = (page - 1) * eventsPerPage;
  
  // Use search query when filters are active
  const hasFilters = filters.searchQuery || filters.categories.length > 0 || 
                    filters.startDate || filters.endDate;
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['course-events-search', courseId, filters, page],
    queryFn: async () => {
      if (hasFilters) {
        const params = new URLSearchParams();
        if (filters.searchQuery) params.append('q', filters.searchQuery);
        if (filters.categories.length) params.append('categories', filters.categories.join(','));
        if (filters.startDate) params.append('start_date', filters.startDate.toISOString());
        if (filters.endDate) params.append('end_date', filters.endDate.toISOString());
        params.append('limit', eventsPerPage.toString());
        params.append('offset', offset.toString());
        
        const response = await api.get(`/courses/${courseId}/events/search?${params}`);
        return response.data;
      } else {
        // Use regular events endpoint when no filters
        const response = await api.get(`/courses/${courseId}/events`, {
          params: { limit: eventsPerPage, offset }
        });
        return response.data;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <Box>
      <EventFilters
        currentFilters={filters}
        onFiltersChange={setFilters}
      />
      
      {/* Rest of component with search results... */}
    </Box>
  );
};
```

**Impact**: Better navigation of large event lists, improved user experience
**Effort**: 10 hours

## Phase 4: Final Polish & Testing (Week 4)

### 4.1 Comprehensive Error Handling & Monitoring
**Priority**: MEDIUM - Reliability
**Issue**: Inconsistent error handling and no monitoring

**Solution**: Structured error handling with monitoring
```python
# /backend/app/exceptions/event_exceptions.py - NEW FILE
from fastapi import HTTPException
from typing import Optional, Dict
from datetime import datetime

class EventException(HTTPException):
    """Base exception for event operations"""
    
    def __init__(self, status_code: int, message: str, error_code: str, details: Optional[Dict] = None):
        super().__init__(
            status_code=status_code,
            detail={
                "message": message,
                "error_code": error_code,
                "timestamp": datetime.utcnow().isoformat(),
                "details": details or {}
            }
        )

class EventAccessDeniedError(EventException):
    def __init__(self, course_id: str, user_role: str):
        super().__init__(
            status_code=403,
            message="You don't have permission to view events for this course",
            error_code="EVENT_ACCESS_DENIED",
            details={"course_id": course_id, "user_role": user_role}
        )

class EventNotFoundError(EventException):
    def __init__(self, event_id: str):
        super().__init__(
            status_code=404,
            message=f"Event {event_id} not found",
            error_code="EVENT_NOT_FOUND",
            details={"event_id": event_id}
        )

class EventValidationError(EventException):
    def __init__(self, validation_errors: List[str]):
        super().__init__(
            status_code=400,
            message="Event validation failed",
            error_code="EVENT_VALIDATION_FAILED",
            details={"validation_errors": validation_errors}
        )

# Enhanced error handling in service
class CourseEventsService:
    async def get_course_events(self, course_id: str, user: User, **kwargs) -> Dict:
        """Get course events with comprehensive error handling"""
        
        try:
            # Verify access
            access_result = await self.auth_service.verify_course_access(user, course_id)
            if not access_result.has_access:
                if access_result.error_code == "COURSE_NOT_FOUND":
                    raise HTTPException(404, "Course not found")
                elif access_result.error_code == "NOT_ENROLLED":
                    raise EventAccessDeniedError(course_id, user.role.value)
                else:
                    raise HTTPException(403, access_result.error_message)
            
            # Rest of implementation with specific error handling...
            return await self._fetch_events_safely(course_id, user, **kwargs)
            
        except EventException:
            # Re-raise our custom exceptions
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error fetching events for course {course_id}: {e}")
            raise HTTPException(500, {
                "message": "Database error occurred while fetching events",
                "error_code": "DATABASE_ERROR",
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Unexpected error fetching events for course {course_id}: {e}")
            raise HTTPException(500, {
                "message": "An unexpected error occurred",
                "error_code": "INTERNAL_ERROR",
                "timestamp": datetime.utcnow().isoformat()
            })

# /backend/app/middleware/event_monitoring.py - NEW FILE
from fastapi import Request, Response
import time
from ..utils.logger import get_logger
from ..services.metrics_service import MetricsService

logger = get_logger(__name__)

class EventMonitoringMiddleware:
    def __init__(self, metrics_service: MetricsService):
        self.metrics = metrics_service

    async def __call__(self, request: Request, call_next):
        # Track event-related endpoints
        if '/events' in str(request.url):
            start_time = time.time()
            
            try:
                response = await call_next(request)
                
                # Record successful request
                duration = time.time() - start_time
                self.metrics.record_event_request(
                    endpoint=str(request.url.path),
                    method=request.method,
                    status_code=response.status_code,
                    duration=duration
                )
                
                return response
                
            except Exception as e:
                # Record failed request
                duration = time.time() - start_time
                self.metrics.record_event_error(
                    endpoint=str(request.url.path),
                    method=request.method,
                    error_type=type(e).__name__,
                    duration=duration
                )
                
                logger.error(f"Event endpoint error: {e}")
                raise
        else:
            return await call_next(request)
```

**Frontend comprehensive error handling**:
```typescript
// /frontend-react/src/components/course-events/ErrorBoundary.tsx - NEW FILE
import React from 'react';
import { Alert, Button, Box, Typography } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class EventsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Events error boundary caught an error:', error, errorInfo);
    
    // Send to error reporting service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error!} 
            resetError={() => this.setState({ hasError: false, error: undefined })}
          />
        );
      }

      return (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Try Again
            </Button>
          }
        >
          <Typography variant="h6">Something went wrong with course events</Typography>
          <Typography variant="body2">
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Error handling hook
export const useEventErrorHandler = () => {
  const queryClient = useQueryClient();
  
  const handleError = (error: unknown, courseId?: string): string => {
    if (error instanceof AxiosError) {
      const errorData = error.response?.data;
      
      // Handle specific error codes
      switch (errorData?.error_code) {
        case 'EVENT_ACCESS_DENIED':
          return 'You don\'t have permission to view events for this course.';
        case 'COURSE_NOT_FOUND':
          return 'This course could not be found.';
        case 'EVENT_VALIDATION_FAILED':
          return `Validation failed: ${errorData.details?.validation_errors?.join(', ')}`;
        case 'DATABASE_ERROR':
          return 'A database error occurred. Please try again in a moment.';
        default:
          return errorData?.message || 'An unexpected error occurred while loading events.';
      }
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  const retryEvents = (courseId: string) => {
    queryClient.invalidateQueries(['course-events', courseId]);
    queryClient.invalidateQueries(['course-events-search', courseId]);
  };

  return { handleError, retryEvents };
};
```

**Impact**: Better error visibility, easier debugging, improved reliability
**Effort**: 6 hours

### 4.2 Performance Optimization & Testing
**Priority**: LOW - Performance
**Issue**: Ensure optimal performance under load

**Solution**: Performance optimization and comprehensive testing
```python
# /backend/app/services/performance_monitoring.py - NEW FILE
import functools
import time
from typing import Callable, Any
from ..utils.logger import get_logger

logger = get_logger(__name__)

def performance_monitor(operation_name: str):
    """Decorator to monitor performance of operations"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            start_time = time.time()
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Log slow operations
                if duration > 1.0:  # Slower than 1 second
                    logger.warning(f"Slow operation {operation_name}: {duration:.2f}s")
                elif duration > 0.5:  # Slower than 500ms
                    logger.info(f"Operation {operation_name}: {duration:.2f}s")
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Failed operation {operation_name} after {duration:.2f}s: {e}")
                raise
        
        return wrapper
    return decorator

# Apply to critical methods
class CourseEventsService:
    @performance_monitor('get_course_events')
    async def get_course_events(self, *args, **kwargs):
        # Existing implementation
        pass
    
    @performance_monitor('search_events')
    async def search_events(self, *args, **kwargs):
        # Existing implementation
        pass

# Database query optimization
class OptimizedEventQueries:
    @staticmethod
    def get_events_with_course_info(db: Session, course_id: str, user_role: str) -> List[CourseEvent]:
        """Optimized query with proper joins and indexing"""
        
        # Use joinedload to avoid N+1 queries
        query = db.query(CourseEvent).options(
            joinedload(CourseEvent.course)
        ).join(Course).filter(
            CourseEvent.course_id == course_id,
            CourseEvent.is_visible == True,
            Course.status == CourseStatus.ACTIVE
        )
        
        # Add indexes hint for better performance
        if user_role == 'student':
            # Use covering index for student queries
            query = query.with_hint(
                CourseEvent, 
                'USE INDEX (idx_course_events_student_visible)',
                'postgresql'
            )
        
        return query.all()

# /backend/tests/test_course_events_performance.py - NEW FILE
import pytest
import asyncio
from concurrent.futures import ThreadPoolExecutor
from ..services.course_events_service import CourseEventsService

@pytest.mark.asyncio
async def test_concurrent_event_access():
    """Test performance under concurrent access"""
    
    # Simulate 10 concurrent users accessing events
    async def access_events():
        service = CourseEventsService(db, auth_service, cache_service, ws_manager)
        return await service.get_course_events(test_course_id, test_user)
    
    start_time = time.time()
    
    tasks = [access_events() for _ in range(10)]
    results = await asyncio.gather(*tasks)
    
    duration = time.time() - start_time
    
    # Should complete within 2 seconds
    assert duration < 2.0
    
    # All requests should succeed
    assert all(result["success"] for result in results)

@pytest.mark.asyncio
async def test_large_event_list_performance():
    """Test performance with large number of events"""
    
    # Create 1000 test events
    for i in range(1000):
        create_test_event(course_id=test_course_id, title=f"Event {i}")
    
    start_time = time.time()
    
    service = CourseEventsService(db, auth_service, cache_service, ws_manager)
    result = await service.get_course_events(test_course_id, test_user, limit=50)
    
    duration = time.time() - start_time
    
    # Should complete within 500ms even with 1000 events
    assert duration < 0.5
    assert result["success"]
    assert len(result["events"]) == 50

@pytest.mark.asyncio  
async def test_cache_performance():
    """Test cache performance improvement"""
    
    service = CourseEventsService(db, auth_service, cache_service, ws_manager)
    
    # First request (cold cache)
    start_time = time.time()
    result1 = await service.get_course_events(test_course_id, test_user)
    cold_duration = time.time() - start_time
    
    # Second request (warm cache)
    start_time = time.time()
    result2 = await service.get_course_events(test_course_id, test_user)
    warm_duration = time.time() - start_time
    
    # Cache should be significantly faster
    assert warm_duration < cold_duration * 0.5
    assert result1["events"] == result2["events"]
```

**Frontend performance optimization**:
```typescript
// /frontend-react/src/hooks/useCourseEventsOptimized.ts - NEW FILE
import { useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

// Optimized infinite query for large event lists
export const useCourseEventsInfinite = (courseId: string) => {
  return useInfiniteQuery({
    queryKey: ['course-events-infinite', courseId],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await api.get(`/courses/${courseId}/events`, {
        params: { limit: 20, offset: pageParam }
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => 
      lastPage.pagination.has_more 
        ? lastPage.pagination.offset + lastPage.pagination.limit 
        : undefined,
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
  });
};

// Memoized event processing
export const useProcessedEvents = (events: CourseEvent[]) => {
  return useMemo(() => {
    // Group events by category
    const eventsByCategory = events.reduce((acc, event) => {
      const category = event.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(event);
      return acc;
    }, {} as Record<string, CourseEvent[]>);

    // Sort events by due date
    const sortedEvents = [...events].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    // Get upcoming events (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingEvents = events.filter(event => 
      event.due_date && 
      new Date(event.due_date) <= nextWeek &&
      new Date(event.due_date) >= new Date()
    );

    return {
      eventsByCategory,
      sortedEvents,
      upcomingEvents,
      totalCount: events.length
    };
  }, [events]);
};

// Virtual scrolling for large lists
export const VirtualizedEventsList: React.FC<{ events: CourseEvent[] }> = ({ events }) => {
  const { processedEvents } = useProcessedEvents(events);
  
  // Use react-window for virtualization if list is large
  if (events.length > 100) {
    return (
      <FixedSizeList
        height={600}
        itemCount={events.length}
        itemSize={120}
        itemData={events}
      >
        {EventListItem}
      </FixedSizeList>
    );
  }
  
  // Regular rendering for smaller lists
  return (
    <List>
      {events.map(event => (
        <EventListItem key={event.id} event={event} />
      ))}
    </List>
  );
};
```

**Impact**: Ensures optimal performance, provides performance monitoring
**Effort**: 8 hours

## Implementation Timeline

### Week 1: Critical Architecture (24 hours)
- Eliminate raw SQL bypasses with proper ORM fixes
- Restore healthy error handling and remove retry prevention
- Implement content security for events

### Week 2: Performance & Caching (20 hours)
- Implement multi-layer caching system
- Add real-time WebSocket updates
- Optimize database queries

### Week 3: Advanced Features (10 hours)
- Implement event filtering and search
- Add event analytics for professors
- Enhanced user interface

### Week 4: Polish & Testing (8 hours)
- Comprehensive error handling and monitoring
- Performance optimization and testing
- Final integration testing

**Total Effort**: ~62 hours (8 working days)

## Dependencies & Considerations

**Database Performance**: Proper indexing required for search functionality
**WebSocket Infrastructure**: May require additional server configuration
**Caching Layer**: Redis instance needed for optimal performance
**Real-time Features**: Consider scaling implications for WebSocket connections

## Success Metrics

1. **Security**: Zero SQL injection vulnerabilities, proper authorization
2. **Performance**: Events load within 200ms (cached) or 800ms (uncached)
3. **Reliability**: 99.9% uptime for events functionality
4. **User Experience**: Real-time updates, comprehensive search, clear error messages
5. **Maintainability**: No raw SQL, proper service layer architecture

This fix plan transforms the technically-debt-heavy events system into a secure, performant, and maintainable foundation for course event management while addressing all critical security and architectural issues identified in the audit.