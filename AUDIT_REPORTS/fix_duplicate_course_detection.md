# Fix Plan: Duplicate Course Detection Functionality

## Executive Summary

This fix plan addresses 11 critical issues in the duplicate detection system by implementing privacy-aware algorithms, simplifying user experience, and optimizing performance. Building on the service layer and background processing patterns from previous fixes, this plan creates a secure, efficient, and user-friendly duplicate detection system.

## Phase 1: Critical Privacy & Security Fixes (Week 1)

### 1.1 Implement Privacy-Aware Duplicate Detection
**Priority**: CRITICAL - Privacy/Security
**Issue**: Duplicate detection compares against ALL user courses, enabling cross-user information disclosure

**Solution**: Scoped duplicate detection with privacy controls
```python
# /backend/app/services/duplicate_detection_service.py - NEW FILE
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from ..models.course import Course
from ..models.user import User, UserRole
from ..services.performance_monitoring import performance_monitor

class PrivacyAwareDuplicateDetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.similarity_threshold = 0.75  # Will be configurable
    
    @performance_monitor.track_performance('duplicate_detection')
    async def check_for_duplicates(
        self, 
        course_data: Dict, 
        user: User,
        privacy_scope: str = "user_only"
    ) -> List[Dict]:
        """
        Privacy-aware duplicate detection with configurable scope
        
        privacy_scope options:
        - "user_only": Only check user's own courses (default)
        - "institution": Check within same institution (professors only)
        - "public": Check public courses only
        """
        
        # Build query based on privacy scope
        base_query = self.db.query(Course)
        
        if privacy_scope == "user_only":
            # Only check user's own courses
            base_query = base_query.filter(Course.created_by == user.id)
            
        elif privacy_scope == "institution" and user.role == UserRole.PROFESSOR:
            # For professors, check within their institution
            user_school = user.school_id if hasattr(user, 'school_id') else None
            if user_school:
                base_query = base_query.filter(
                    Course.school_id == user_school,
                    Course.is_public == True  # Only public courses in institution
                )
            else:
                # Fall back to user-only if no institution
                base_query = base_query.filter(Course.created_by == user.id)
                
        elif privacy_scope == "public":
            # Only check explicitly public courses
            base_query = base_query.filter(Course.is_public == True)
            
        else:
            # Default to most restrictive (user-only)
            base_query = base_query.filter(Course.created_by == user.id)
        
        existing_courses = base_query.all()
        
        # Find duplicates using privacy-safe comparison
        duplicates = []
        for existing_course in existing_courses:
            similarity_score = await self._calculate_similarity(
                course_data, existing_course, user
            )
            
            if similarity_score >= self.similarity_threshold:
                # Only return minimal information to prevent data leakage
                duplicate_info = self._create_safe_duplicate_info(
                    existing_course, similarity_score, user
                )
                duplicates.append(duplicate_info)
        
        return duplicates
    
    def _create_safe_duplicate_info(
        self, 
        course: Course, 
        similarity_score: float, 
        requesting_user: User
    ) -> Dict:
        """Create duplicate information with privacy controls"""
        
        # Determine what information can be safely shared
        if course.created_by == requesting_user.id:
            # User owns the course - can see full details
            return {
                "id": str(course.id),
                "title": course.title,
                "crn": course.crn,
                "semester": course.semester,
                "similarity_score": similarity_score,
                "is_own_course": True,
                "can_merge": True,
                "can_view_details": True
            }
        elif course.is_public:
            # Public course - limited information
            return {
                "id": str(course.id),
                "title": course.title,  # Only if course is public
                "crn": "***",  # Redacted for privacy
                "semester": course.semester,
                "similarity_score": similarity_score,
                "is_own_course": False,
                "can_merge": False,
                "can_view_details": False,
                "institution": course.school.name if course.school else "Unknown"
            }
        else:
            # Should not happen with proper scoping, but safety measure
            return {
                "id": "redacted",
                "title": "[Similar Course Found]",
                "crn": "***",
                "semester": "***",
                "similarity_score": similarity_score,
                "is_own_course": False,
                "can_merge": False,
                "can_view_details": False,
                "note": "A similar course exists but details are private"
            }
    
    async def _calculate_similarity(
        self, 
        new_course_data: Dict, 
        existing_course: Course,
        user: User
    ) -> float:
        """Calculate similarity score with privacy protections"""
        
        # Only calculate similarity if we have permission to access the course
        if not self._can_access_course_for_comparison(existing_course, user):
            return 0.0
        
        # Use improved similarity algorithm
        similarity_calculator = CoursesSimilarityCalculator()
        return similarity_calculator.calculate_comprehensive_similarity(
            new_course_data, existing_course
        )
    
    def _can_access_course_for_comparison(self, course: Course, user: User) -> bool:
        """Check if user can access course for comparison purposes"""
        return (
            course.created_by == user.id or  # User owns the course
            course.is_public or              # Course is public
            (user.role == UserRole.ADMIN)    # Admin can see all
        )
```

**Impact**: Eliminates privacy violations, prevents cross-user data leakage
**Effort**: 8 hours

### 1.2 Implement Transaction-Safe Duplicate Detection
**Priority**: CRITICAL - Data Integrity
**Issue**: Race conditions between duplicate check and course creation

**Solution**: Database locking and atomic operations
```python
# /backend/app/services/duplicate_detection_service.py - ENHANCED
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

class PrivacyAwareDuplicateDetectionService:
    async def check_and_create_course_atomically(
        self,
        course_data: Dict,
        user: User,
        bypass_duplicates: bool = False
    ) -> Dict:
        """
        Atomically check for duplicates and create course if no conflicts
        """
        try:
            # Use database transaction with locking
            with self.db.begin():
                # Lock user's courses during duplicate check
                user_courses = self.db.execute(
                    select(Course)
                    .where(Course.created_by == user.id)
                    .with_for_update()  # Prevent concurrent course creation
                ).scalars().all()
                
                # Check for duplicates within the transaction
                if not bypass_duplicates:
                    duplicates = await self._check_duplicates_in_transaction(
                        course_data, user_courses, user
                    )
                    
                    if duplicates:
                        return {
                            "status": "duplicates_found",
                            "duplicates": duplicates,
                            "course_data": course_data
                        }
                
                # No duplicates or bypassed - create course
                new_course = await self._create_course_in_transaction(
                    course_data, user
                )
                
                return {
                    "status": "course_created",
                    "course": new_course,
                    "message": "Course created successfully"
                }
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Atomic course creation failed: {e}")
            raise HTTPException(500, "Course creation failed due to system error")
    
    async def _check_duplicates_in_transaction(
        self,
        course_data: Dict,
        existing_courses: List[Course],
        user: User
    ) -> List[Dict]:
        """Check for duplicates within database transaction"""
        duplicates = []
        
        for existing_course in existing_courses:
            # Use faster in-memory similarity check since we have the data
            similarity_score = self._fast_similarity_check(course_data, existing_course)
            
            if similarity_score >= self.similarity_threshold:
                duplicate_info = self._create_safe_duplicate_info(
                    existing_course, similarity_score, user
                )
                duplicates.append(duplicate_info)
        
        return duplicates
```

**Impact**: Prevents race conditions, ensures data consistency
**Effort**: 4 hours

### 1.3 Remove Production Debug Logging
**Priority**: HIGH - Security/Performance
**Issue**: Extensive console.log statements throughout duplicate detection logic

**Solution**: Use established logging system from previous fixes
```typescript
// /frontend-react/src/services/duplicateDetectionService.ts - NEW FILE
import { logger } from '../utils/logger';

export class DuplicateDetectionService {
  async checkForDuplicates(courseData: CourseData): Promise<DuplicateResult[]> {
    logger.debug('Starting duplicate detection', { 
      courseTitle: courseData.title,
      userContext: 'duplicate_check'
    });
    
    try {
      const response = await api.post('/api/courses/check-duplicates', courseData);
      
      logger.debug('Duplicate detection completed', {
        duplicatesFound: response.data.duplicates?.length || 0,
        status: response.data.status
      });
      
      return response.data.duplicates || [];
      
    } catch (error) {
      logger.error('Duplicate detection failed', error);
      throw new Error('Failed to check for duplicate courses');
    }
  }
}
```

**Backend logging cleanup**:
```python
# /backend/app/services/duplicate_detection_service.py - UPDATED
from ..utils.logger import get_logger

logger = get_logger(__name__)

class PrivacyAwareDuplicateDetectionService:
    async def check_for_duplicates(self, course_data: Dict, user: User) -> List[Dict]:
        logger.debug(f"Checking duplicates for user {user.id}", extra={
            "user_id": user.id,
            "course_title": course_data.get('title', 'Unknown'),
            "operation": "duplicate_detection"
        })
        
        # ... existing logic without print statements
        
        logger.info(f"Found {len(duplicates)} potential duplicates", extra={
            "user_id": user.id,
            "duplicates_count": len(duplicates),
            "operation": "duplicate_detection"
        })
        
        return duplicates
```

**Impact**: Removes security risk, improves performance, maintains debugging capability
**Effort**: 2 hours

## Phase 2: Algorithm & Performance Improvements (Week 2)

### 2.1 Implement Advanced Similarity Algorithm
**Priority**: HIGH - Accuracy
**Issue**: Generic text similarity not optimized for educational content

**Solution**: Domain-specific similarity algorithm with configurable weights
```python
# /backend/app/services/course_similarity_calculator.py - NEW FILE
import re
from typing import Dict, List, Tuple
from datetime import datetime
from difflib import SequenceMatcher
from ..config.settings import settings

class CoursesSimilarityCalculator:
    def __init__(self):
        # Configurable weights for different comparison factors
        self.weights = {
            'title': settings.duplicate_detection_title_weight or 0.4,
            'instructor': settings.duplicate_detection_instructor_weight or 0.2,
            'schedule': settings.duplicate_detection_schedule_weight or 0.2,
            'content': settings.duplicate_detection_content_weight or 0.2
        }
        
        # Academic-specific normalization rules
        self.title_normalizations = {
            r'\b(intro|introduction)\b': 'introduction',
            r'\b(calc|calculus)\b': 'calculus',
            r'\b(comp|computer)\s+sci\b': 'computer science',
            r'\b(bio|biology)\b': 'biology',
            r'\b(chem|chemistry)\b': 'chemistry',
            r'\b(phys|physics)\b': 'physics',
            r'\b(math|mathematics)\b': 'mathematics',
            r'\b(eng|english)\b': 'english',
            r'\b(hist|history)\b': 'history',
            r'\blab\b': 'laboratory',
            r'\blec\b': 'lecture'
        }
    
    def calculate_comprehensive_similarity(
        self, 
        course_data: Dict, 
        existing_course: any
    ) -> float:
        """Calculate comprehensive similarity using multiple factors"""
        
        similarities = {}
        
        # 1. Title similarity (academic-aware)
        similarities['title'] = self._calculate_title_similarity(
            course_data.get('title', ''),
            existing_course.title or ''
        )
        
        # 2. Instructor similarity (if available)
        similarities['instructor'] = self._calculate_instructor_similarity(
            course_data.get('instructor', ''),
            getattr(existing_course, 'instructor', '') or ''
        )
        
        # 3. Schedule similarity (meeting times, patterns)
        similarities['schedule'] = self._calculate_schedule_similarity(
            course_data.get('events', []),
            existing_course.events or []
        )
        
        # 4. Content similarity (description, objectives)
        similarities['content'] = self._calculate_content_similarity(
            course_data.get('description', ''),
            existing_course.description or ''
        )
        
        # Calculate weighted similarity
        total_similarity = sum(
            similarities[factor] * self.weights[factor]
            for factor in similarities
        )
        
        # Bonus for exact CRN match (if not personal courses)
        if (course_data.get('crn') and 
            existing_course.crn and 
            course_data.get('crn') == existing_course.crn and
            course_data.get('crn') != 'PERSONAL'):
            total_similarity = min(1.0, total_similarity + 0.3)
        
        return min(total_similarity, 1.0)
    
    def _calculate_title_similarity(self, title1: str, title2: str) -> float:
        """Calculate academic-aware title similarity"""
        if not title1 or not title2:
            return 0.0
        
        # Normalize both titles for academic terms
        normalized_title1 = self._normalize_academic_title(title1.lower())
        normalized_title2 = self._normalize_academic_title(title2.lower())
        
        # Calculate base similarity
        base_similarity = SequenceMatcher(None, normalized_title1, normalized_title2).ratio()
        
        # Extract course codes (e.g., "CS 101", "MATH 201")
        code1 = self._extract_course_code(title1)
        code2 = self._extract_course_code(title2)
        
        if code1 and code2:
            if code1 == code2:
                # Exact course code match
                return min(1.0, base_similarity + 0.4)
            elif code1[0] == code2[0]:  # Same department
                return min(1.0, base_similarity + 0.2)
        
        return base_similarity
    
    def _normalize_academic_title(self, title: str) -> str:
        """Normalize academic course titles"""
        # Apply normalization rules
        for pattern, replacement in self.title_normalizations.items():
            title = re.sub(pattern, replacement, title, flags=re.IGNORECASE)
        
        # Remove common course modifiers that don't affect content
        title = re.sub(r'\b(honors?|accelerated|intensive)\b', '', title, flags=re.IGNORECASE)
        title = re.sub(r'\b(fall|spring|summer|winter)\s+\d{4}\b', '', title, flags=re.IGNORECASE)
        title = re.sub(r'\b(section|sec)\s+\w+\b', '', title, flags=re.IGNORECASE)
        
        # Clean up whitespace
        title = ' '.join(title.split())
        
        return title.strip()
    
    def _extract_course_code(self, title: str) -> str:
        """Extract course code (e.g., 'CS 101' from 'CS 101: Introduction to Programming')"""
        # Common patterns for course codes
        patterns = [
            r'\b([A-Z]{2,4})\s*(\d{3,4}[A-Z]?)\b',  # CS 101, MATH 2010A
            r'\b([A-Z]+)\s*-\s*(\d{3,4})\b',        # CS-101
            r'\b(\d{3,4})\s*-\s*([A-Z]{2,4})\b'     # 101-CS
        ]
        
        for pattern in patterns:
            match = re.search(pattern, title.upper())
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    return f"{groups[0]} {groups[1]}"
        
        return None
    
    def _calculate_instructor_similarity(self, instructor1: str, instructor2: str) -> float:
        """Calculate instructor name similarity"""
        if not instructor1 or not instructor2:
            return 0.0
        
        # Normalize instructor names
        name1 = self._normalize_instructor_name(instructor1)
        name2 = self._normalize_instructor_name(instructor2)
        
        if name1 == name2:
            return 1.0
        
        # Check for partial matches (same last name)
        parts1 = name1.split()
        parts2 = name2.split()
        
        if len(parts1) > 1 and len(parts2) > 1:
            if parts1[-1] == parts2[-1]:  # Same last name
                return 0.7
        
        return SequenceMatcher(None, name1, name2).ratio()
    
    def _normalize_instructor_name(self, name: str) -> str:
        """Normalize instructor names for comparison"""
        # Remove titles and suffixes
        name = re.sub(r'\b(prof|professor|dr|mr|ms|mrs)\b\.?', '', name, flags=re.IGNORECASE)
        name = re.sub(r'\b(jr|sr|iii|phd|md)\b\.?', '', name, flags=re.IGNORECASE)
        
        # Clean up whitespace
        name = ' '.join(name.split()).strip()
        
        return name.lower()
    
    def _calculate_schedule_similarity(self, events1: List, events2: List) -> float:
        """Calculate similarity based on meeting patterns"""
        if not events1 or not events2:
            return 0.0
        
        # Extract meeting patterns (days of week, times)
        pattern1 = self._extract_meeting_pattern(events1)
        pattern2 = self._extract_meeting_pattern(events2)
        
        if not pattern1 or not pattern2:
            return 0.0
        
        # Compare patterns
        days_similarity = len(pattern1['days'] & pattern2['days']) / max(len(pattern1['days'] | pattern2['days']), 1)
        
        # Compare time slots (simplified)
        time_similarity = 0.0
        if pattern1['time_blocks'] and pattern2['time_blocks']:
            overlapping_blocks = len(pattern1['time_blocks'] & pattern2['time_blocks'])
            total_blocks = len(pattern1['time_blocks'] | pattern2['time_blocks'])
            time_similarity = overlapping_blocks / max(total_blocks, 1)
        
        return (days_similarity + time_similarity) / 2
    
    def _extract_meeting_pattern(self, events: List) -> Dict:
        """Extract meeting pattern from course events"""
        days = set()
        time_blocks = set()
        
        for event in events:
            if event.get('category') == 'class':
                # Extract day of week
                if event.get('start_ts'):
                    try:
                        date = datetime.fromisoformat(str(event['start_ts']))
                        days.add(date.weekday())
                        
                        # Extract time block (hour of day)
                        hour = date.hour
                        time_blocks.add(hour)
                    except:
                        pass
        
        return {
            'days': days,
            'time_blocks': time_blocks
        }
    
    def _calculate_content_similarity(self, content1: str, content2: str) -> float:
        """Calculate content similarity for descriptions"""
        if not content1 or not content2:
            return 0.0
        
        # Simple content similarity for now
        # Could be enhanced with NLP techniques
        return SequenceMatcher(None, content1.lower(), content2.lower()).ratio()
```

**Configuration settings**:
```python
# /backend/app/config/settings.py - UPDATED
class Settings(BaseSettings):
    # ... existing settings ...
    
    # Duplicate detection configuration
    duplicate_detection_enabled: bool = True
    duplicate_detection_threshold: float = 0.75
    duplicate_detection_title_weight: float = 0.4
    duplicate_detection_instructor_weight: float = 0.2
    duplicate_detection_schedule_weight: float = 0.2
    duplicate_detection_content_weight: float = 0.2
    duplicate_detection_cache_ttl: int = 3600  # 1 hour
```

**Impact**: Improves accuracy for academic content, reduces false positives/negatives
**Effort**: 12 hours

### 2.2 Implement Caching and Background Processing
**Priority**: HIGH - Performance
**Issue**: Expensive real-time computation

**Solution**: Redis caching with background processing for complex comparisons
```python
# /backend/app/services/duplicate_cache_service.py - NEW FILE
import redis
import json
import hashlib
from typing import Optional, List, Dict
from ..config.settings import settings

class DuplicateCacheService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            decode_responses=True
        )
        self.cache_ttl = settings.duplicate_detection_cache_ttl
    
    def _generate_cache_key(self, course_data: Dict, user_id: str) -> str:
        """Generate cache key for course data"""
        # Create stable hash from relevant course data
        cache_data = {
            'title': course_data.get('title', '').lower().strip(),
            'crn': course_data.get('crn', ''),
            'semester': course_data.get('semester', ''),
            'user_id': user_id
        }
        
        data_string = json.dumps(cache_data, sort_keys=True)
        return f"duplicate_check:{hashlib.md5(data_string.encode()).hexdigest()}"
    
    async def get_cached_duplicates(
        self, 
        course_data: Dict, 
        user_id: str
    ) -> Optional[List[Dict]]:
        """Get cached duplicate detection results"""
        cache_key = self._generate_cache_key(course_data, user_id)
        
        try:
            cached_result = self.redis_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
        
        return None
    
    async def cache_duplicates(
        self, 
        course_data: Dict, 
        user_id: str, 
        duplicates: List[Dict]
    ):
        """Cache duplicate detection results"""
        cache_key = self._generate_cache_key(course_data, user_id)
        
        try:
            self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(duplicates)
            )
        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")
    
    async def invalidate_user_cache(self, user_id: str):
        """Invalidate all cache entries for a user"""
        try:
            pattern = f"duplicate_check:*user_id*{user_id}*"
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")

# Background job for expensive duplicate detection
from celery import Celery

@celery_app.task(bind=True)
def detect_duplicates_background(self, course_data: Dict, user_id: str) -> Dict:
    """Background job for complex duplicate detection"""
    try:
        from ..database import get_db
        from ..services.duplicate_detection_service import PrivacyAwareDuplicateDetectionService
        from ..models.user import User
        
        db = next(get_db())
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return {"error": "User not found"}
        
        detection_service = PrivacyAwareDuplicateDetectionService(db)
        duplicates = await detection_service.check_for_duplicates(course_data, user)
        
        # Cache the results
        cache_service = DuplicateCacheService()
        await cache_service.cache_duplicates(course_data, user_id, duplicates)
        
        return {
            "status": "completed",
            "duplicates": duplicates,
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Background duplicate detection failed: {e}")
        return {"error": str(e)}

# Enhanced duplicate detection service with caching
class PrivacyAwareDuplicateDetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.cache_service = DuplicateCacheService()
        self.similarity_calculator = CoursesSimilarityCalculator()
    
    async def check_for_duplicates_with_caching(
        self, 
        course_data: Dict, 
        user: User,
        background: bool = False
    ) -> Dict:
        """Check for duplicates with caching support"""
        
        # Try cache first
        cached_duplicates = await self.cache_service.get_cached_duplicates(
            course_data, str(user.id)
        )
        
        if cached_duplicates is not None:
            return {
                "status": "completed",
                "duplicates": cached_duplicates,
                "from_cache": True
            }
        
        # For large course collections, use background processing
        user_course_count = self.db.query(Course).filter(
            Course.created_by == user.id
        ).count()
        
        if background or user_course_count > 50:
            # Queue background job
            job = detect_duplicates_background.delay(course_data, str(user.id))
            
            return {
                "status": "processing",
                "job_id": job.id,
                "message": "Duplicate detection is processing in the background"
            }
        
        # Process immediately for small collections
        duplicates = await self.check_for_duplicates(course_data, user)
        
        # Cache the results
        await self.cache_service.cache_duplicates(
            course_data, str(user.id), duplicates
        )
        
        return {
            "status": "completed",
            "duplicates": duplicates,
            "from_cache": False
        }
```

**Impact**: Improves performance dramatically, enables scalability, reduces server load
**Effort**: 10 hours

## Phase 3: User Experience Simplification (Week 3)

### 3.1 Simplify User Interface
**Priority**: MEDIUM - User Experience
**Issue**: Complex user decision flow exposes technical details

**Solution**: Simplified, guided user experience
```typescript
// /frontend-react/src/components/duplicates/SimplifiedDuplicateDialog.tsx - NEW FILE
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Card,
  CardContent,
  Box,
  Chip,
  Alert
} from '@mui/material';

interface SimplifiedDuplicateDialogProps {
  open: boolean;
  duplicates: DuplicateResult[];
  newCourseTitle: string;
  onMerge: (duplicateId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export const SimplifiedDuplicateDialog: React.FC<SimplifiedDuplicateDialogProps> = ({
  open,
  duplicates,
  newCourseTitle,
  onMerge,
  onCreateNew,
  onCancel
}) => {
  const [selectedAction, setSelectedAction] = useState<'merge' | 'create' | null>(null);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);

  const ownCourses = duplicates.filter(d => d.is_own_course);
  const similarCourses = duplicates.filter(d => !d.is_own_course);

  const getRecommendation = (): string => {
    if (ownCourses.length > 0) {
      const highestMatch = ownCourses.reduce((prev, current) => 
        prev.similarity_score > current.similarity_score ? prev : current
      );
      
      if (highestMatch.similarity_score > 0.9) {
        return 'high_confidence_merge';
      } else if (highestMatch.similarity_score > 0.8) {
        return 'suggested_merge';
      }
    }
    
    return 'create_new';
  };

  const recommendation = getRecommendation();

  const handleConfirm = () => {
    if (selectedAction === 'merge' && selectedDuplicateId) {
      onMerge(selectedDuplicateId);
    } else if (selectedAction === 'create') {
      onCreateNew();
    }
  };

  return (
    <Dialog open={open} maxWidth="md" fullWidth>
      <DialogTitle>
        Course Already Exists?
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          We found courses that might be similar to "{newCourseTitle}". 
          What would you like to do?
        </Alert>

        {/* Recommendation Section */}
        {recommendation === 'high_confidence_merge' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Recommended: Update Existing Course</Typography>
            <Typography variant="body2">
              This appears to be the same course you already have. 
              We recommend updating it with the new information.
            </Typography>
          </Alert>
        )}

        {recommendation === 'suggested_merge' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Suggestion: Check if it's the same course</Typography>
            <Typography variant="body2">
              This looks similar to an existing course. 
              Review the details below to decide.
            </Typography>
          </Alert>
        )}

        {/* Your Existing Courses */}
        {ownCourses.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Existing Courses
            </Typography>
            
            {ownCourses.map((duplicate) => (
              <Card 
                key={duplicate.id}
                sx={{ 
                  mb: 2, 
                  border: selectedDuplicateId === duplicate.id ? 2 : 1,
                  borderColor: selectedDuplicateId === duplicate.id ? 'primary.main' : 'divider',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setSelectedDuplicateId(duplicate.id);
                  setSelectedAction('merge');
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="subtitle1">
                        {duplicate.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {duplicate.semester}
                        {duplicate.crn !== 'PERSONAL' && ` • CRN: ${duplicate.crn}`}
                      </Typography>
                    </Box>
                    <Chip 
                      label={`${Math.round(duplicate.similarity_score * 100)}% match`}
                      color={duplicate.similarity_score > 0.9 ? 'error' : 
                             duplicate.similarity_score > 0.8 ? 'warning' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  {selectedDuplicateId === duplicate.id && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Update this course:</strong> Your existing course will be updated 
                        with new events and information from the uploaded syllabus.
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Similar Courses from Others */}
        {similarCourses.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Similar Courses Found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              These courses are similar but owned by others. You can still create your own version.
            </Typography>
            
            {similarCourses.map((duplicate) => (
              <Card key={duplicate.id} sx={{ mb: 2, opacity: 0.7 }}>
                <CardContent>
                  <Typography variant="subtitle1">
                    {duplicate.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {duplicate.institution && `${duplicate.institution} • `}
                    {duplicate.semester}
                  </Typography>
                  <Chip 
                    label={`${Math.round(duplicate.similarity_score * 100)}% similar`}
                    size="small"
                    variant="outlined"
                  />
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Create New Option */}
        <Card 
          sx={{ 
            border: selectedAction === 'create' ? 2 : 1,
            borderColor: selectedAction === 'create' ? 'primary.main' : 'divider',
            cursor: 'pointer'
          }}
          onClick={() => setSelectedAction('create')}
        >
          <CardContent>
            <Typography variant="subtitle1">
              Create as New Course
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create "{newCourseTitle}" as a separate course
            </Typography>
            
            {selectedAction === 'create' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Create new:</strong> A new course will be created with 
                  all the events from your uploaded syllabus.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedAction}
        >
          {selectedAction === 'merge' ? 'Update Existing Course' : 
           selectedAction === 'create' ? 'Create New Course' : 
           'Select an Option'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

**Updated container component**:
```typescript
// /frontend-react/src/components/duplicates/DuplicateDetectionContainer.tsx - NEW FILE
import React, { useState } from 'react';
import { SimplifiedDuplicateDialog } from './SimplifiedDuplicateDialog';
import { useDuplicateDetection } from '../../hooks/useDuplicateDetection';

interface DuplicateDetectionContainerProps {
  courseData: CourseData;
  onCourseCreated: (course: Course) => void;
  onCancel: () => void;
}

export const DuplicateDetectionContainer: React.FC<DuplicateDetectionContainerProps> = ({
  courseData,
  onCourseCreated,
  onCancel
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const { checkDuplicates, mergeCourse, createNewCourse, isLoading } = useDuplicateDetection();

  const handleDuplicateCheck = async () => {
    const result = await checkDuplicates(courseData);
    
    if (result.duplicates.length > 0) {
      setShowDialog(true);
    } else {
      // No duplicates, create directly
      const newCourse = await createNewCourse(courseData);
      onCourseCreated(newCourse);
    }
  };

  const handleMerge = async (duplicateId: string) => {
    try {
      const updatedCourse = await mergeCourse(duplicateId, courseData);
      setShowDialog(false);
      onCourseCreated(updatedCourse);
    } catch (error) {
      // Handle error
    }
  };

  const handleCreateNew = async () => {
    try {
      const newCourse = await createNewCourse(courseData, { bypassDuplicates: true });
      setShowDialog(false);
      onCourseCreated(newCourse);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <>
      {/* Trigger duplicate check automatically or via button */}
      <Button onClick={handleDuplicateCheck} disabled={isLoading}>
        {isLoading ? 'Checking for duplicates...' : 'Process Course'}
      </Button>

      <SimplifiedDuplicateDialog
        open={showDialog}
        duplicates={duplicates}
        newCourseTitle={courseData.title}
        onMerge={handleMerge}
        onCreateNew={handleCreateNew}
        onCancel={() => setShowDialog(false)}
      />
    </>
  );
};
```

**Impact**: Improves user experience, reduces confusion, increases successful course creation
**Effort**: 8 hours

### 3.2 Add Progressive Enhancement
**Priority**: LOW - User Experience
**Issue**: Feature fails completely if algorithms are slow or unavailable

**Solution**: Progressive enhancement with graceful degradation
```typescript
// /frontend-react/src/hooks/useDuplicateDetection.ts - NEW FILE
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useDuplicateDetection = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const queryClient = useQueryClient();

  const checkDuplicates = useCallback(async (courseData: CourseData) => {
    setIsLoading(true);
    
    try {
      // Try advanced duplicate detection first
      const response = await duplicateService.checkForDuplicates(courseData);
      
      if (response.status === 'processing') {
        // Background processing - show simplified flow
        return {
          status: 'processing',
          duplicates: [],
          message: 'Processing in background, you can create the course now'
        };
      }
      
      setDuplicates(response.duplicates || []);
      return response;
      
    } catch (error) {
      // Graceful degradation - allow course creation without duplicate check
      logger.warning('Duplicate detection failed, allowing course creation', error);
      
      return {
        status: 'degraded',
        duplicates: [],
        message: 'Duplicate detection unavailable, proceeding with course creation'
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkDuplicatesBasic = useCallback(async (courseData: CourseData) => {
    // Simplified duplicate check using only basic title matching
    try {
      const userCourses = await courseService.getUserCourses();
      const basicDuplicates = userCourses.filter(course => 
        course.title.toLowerCase().includes(courseData.title.toLowerCase()) ||
        courseData.title.toLowerCase().includes(course.title.toLowerCase())
      );
      
      return basicDuplicates.map(course => ({
        id: course.id,
        title: course.title,
        similarity_score: 0.8, // Approximate
        is_own_course: true,
        can_merge: true
      }));
      
    } catch (error) {
      return [];
    }
  }, []);

  return {
    checkDuplicates,
    checkDuplicatesBasic,
    duplicates,
    isLoading
  };
};
```

**Impact**: Ensures functionality even when advanced features fail
**Effort**: 3 hours

## Phase 4: Configuration & Monitoring (Week 4)

### 4.1 Make Algorithm Parameters Configurable
**Priority**: LOW - Maintainability
**Issue**: Hardcoded algorithm parameters

**Solution**: Admin interface for tuning duplicate detection
```python
# /backend/app/routers/admin_duplicate_config.py - NEW FILE
from fastapi import APIRouter, Depends
from ..middleware.security import require_admin
from ..services.duplicate_detection_service import DuplicateDetectionConfig

router = APIRouter(prefix="/api/admin/duplicate-detection", tags=["admin"])

@router.get("/config")
async def get_duplicate_detection_config(current_user = Depends(require_admin)):
    """Get current duplicate detection configuration"""
    return DuplicateDetectionConfig.get_current_config()

@router.put("/config")
async def update_duplicate_detection_config(
    config: DuplicateDetectionConfigUpdate,
    current_user = Depends(require_admin)
):
    """Update duplicate detection configuration"""
    return DuplicateDetectionConfig.update_config(config)

@router.post("/test")
async def test_duplicate_detection_config(
    test_data: DuplicateDetectionTestData,
    current_user = Depends(require_admin)
):
    """Test duplicate detection with given configuration"""
    return DuplicateDetectionConfig.test_configuration(test_data)
```

**Configuration management**:
```python
# /backend/app/services/duplicate_detection_config.py - NEW FILE
from pydantic import BaseModel
from typing import Dict, Any

class DuplicateDetectionConfigUpdate(BaseModel):
    similarity_threshold: float = 0.75
    title_weight: float = 0.4
    instructor_weight: float = 0.2
    schedule_weight: float = 0.2
    content_weight: float = 0.2
    cache_ttl_seconds: int = 3600
    background_threshold_courses: int = 50

class DuplicateDetectionConfig:
    @classmethod
    def get_current_config(cls) -> Dict[str, Any]:
        """Get current configuration from settings"""
        return {
            "similarity_threshold": settings.duplicate_detection_threshold,
            "weights": {
                "title": settings.duplicate_detection_title_weight,
                "instructor": settings.duplicate_detection_instructor_weight,
                "schedule": settings.duplicate_detection_schedule_weight,
                "content": settings.duplicate_detection_content_weight
            },
            "cache_ttl_seconds": settings.duplicate_detection_cache_ttl,
            "background_threshold_courses": 50
        }
    
    @classmethod
    def update_config(cls, config: DuplicateDetectionConfigUpdate) -> Dict[str, Any]:
        """Update configuration (would persist to database in production)"""
        # In production, this would update settings in database
        # For now, update in-memory settings
        settings.duplicate_detection_threshold = config.similarity_threshold
        settings.duplicate_detection_title_weight = config.title_weight
        # ... other settings
        
        return {"status": "updated", "config": cls.get_current_config()}
```

**Impact**: Enables tuning based on user feedback, improves accuracy over time
**Effort**: 4 hours

## Implementation Timeline Summary

### Week 1: Critical Privacy & Security (14 hours)
- Privacy-aware duplicate detection
- Transaction-safe operations
- Remove production debug logging

### Week 2: Algorithm & Performance (22 hours)
- Advanced similarity algorithm
- Caching and background processing

### Week 3: User Experience (11 hours)
- Simplified user interface
- Progressive enhancement

### Week 4: Configuration (4 hours)
- Configurable parameters
- Admin interface

**Total Effort**: ~51 hours (6-7 working days)

## Integration Dependencies

**Builds on previous fixes:**
- Logger utility (from enrollment fixes)
- Background job system (from syllabus processing fixes)
- Service layer patterns (from enrollment fixes)
- Configuration management (from syllabus processing fixes)

**Integrates with:**
- Course creation (Save to My Courses fixes)
- Syllabus processing (duplicate check during upload)

## Success Metrics

1. **Privacy**: Zero cross-user data leakage in duplicate detection
2. **Performance**: Duplicate detection under 2 seconds for <50 courses, background for larger
3. **Accuracy**: <5% false positive rate, <10% false negative rate
4. **User Experience**: >80% of users successfully resolve duplicate conflicts
5. **System Load**: <1% performance impact on course creation operations

This fix plan transforms duplicate detection from a privacy-violating, performance-heavy monolith into a secure, efficient, and user-friendly system that enhances rather than hinders the course creation experience.