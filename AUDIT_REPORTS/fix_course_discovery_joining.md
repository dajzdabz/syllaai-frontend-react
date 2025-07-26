# Fix Plan: Course Discovery and Joining Functionality

## Executive Summary

This fix plan addresses 31 critical issues in the course discovery system by removing broken functionality, implementing working MVP search integration, and creating secure alternative enrollment workflows. The current state—with functional-looking UI that doesn't work—is worse than having no feature at all and represents a critical user experience failure.

## Phase 1: Emergency Stabilization (Week 1)

### 1.1 Remove Broken UI Components
**Priority**: CRITICAL - User Experience
**Issue**: Misleading interface promises functionality that doesn't exist

**Solution**: Temporarily disable broken features and add clear messaging
```typescript
// /frontend-react/src/components/course-discovery/DisabledFeatureNotice.tsx - NEW FILE
import { Alert, Button, Typography, Box } from '@mui/material';
import { Construction } from '@mui/icons-material';

interface DisabledFeatureNoticeProps {
  title: string;
  description: string;
  alternativeAction?: {
    label: string;
    onClick: () => void;
  };
}

export const DisabledFeatureNotice: React.FC<DisabledFeatureNoticeProps> = ({
  title,
  description,
  alternativeAction
}) => {
  return (
    <Alert 
      severity="info" 
      icon={<Construction />}
      sx={{ mb: 3 }}
    >
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {description}
      </Typography>
      {alternativeAction && (
        <Button 
          variant="outlined" 
          size="small"
          onClick={alternativeAction.onClick}
        >
          {alternativeAction.label}
        </Button>
      )}
    </Alert>
  );
};

// /frontend-react/src/pages/StudentDashboard.tsx - UPDATED
// Replace broken course search UI
const CourseSearchSection = () => {
  const navigate = useNavigate();
  
  return (
    <DisabledFeatureNotice
      title="Course Search Temporarily Unavailable"
      description="We're improving course discovery! In the meantime, ask your professor for a course invitation link or enrollment code."
      alternativeAction={{
        label: "Contact Support for Help",
        onClick: () => navigate('/support')
      }}
    />
  );
};

// Remove all broken search-related state and functions
// Delete lines 76-106 (search mutation and enrollment)
// Delete lines 391-458 (search UI components)
```

**Impact**: Eliminates user frustration, provides clear guidance
**Effort**: 3 hours

### 1.2 Implement Emergency Enrollment Workflow
**Priority**: CRITICAL - Functionality
**Issue**: No working method for students to join courses

**Solution**: Course invitation codes as immediate workaround
```python
# /backend/app/models/course_invitation.py - NEW FILE
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timedelta

class CourseInvitation(Base):
    __tablename__ = "course_invitations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    invitation_code = Column(String(8), unique=True, nullable=False)  # e.g., "ABC123XY"
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    max_uses = Column(Integer, nullable=True)  # None = unlimited
    current_uses = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    course = relationship("Course")
    creator = relationship("User")

# /backend/app/services/invitation_service.py - NEW FILE
import secrets
import string
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.course_invitation import CourseInvitation
from ..models.student_course_link import StudentCourseLink
from ..utils.logger import get_logger

logger = get_logger(__name__)

class InvitationService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_invitation_code(self, 
                               course_id: str, 
                               creator_id: str,
                               expires_hours: int = 168,  # 7 days default
                               max_uses: Optional[int] = None) -> str:
        """Generate a secure invitation code for course enrollment"""
        
        # Generate cryptographically secure 8-character code
        alphabet = string.ascii_uppercase + string.digits
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        
        # Ensure uniqueness
        while self.db.query(CourseInvitation).filter_by(invitation_code=code).first():
            code = ''.join(secrets.choice(alphabet) for _ in range(8))
        
        invitation = CourseInvitation(
            course_id=course_id,
            invitation_code=code,
            created_by=creator_id,
            expires_at=datetime.utcnow() + timedelta(hours=expires_hours),
            max_uses=max_uses
        )
        
        self.db.add(invitation)
        self.db.commit()
        
        logger.info(f"Created invitation code {code} for course {course_id}")
        return code
    
    def enroll_with_code(self, invitation_code: str, student_id: str) -> dict:
        """Enroll student using invitation code"""
        
        # Find valid invitation
        invitation = self.db.query(CourseInvitation).filter(
            CourseInvitation.invitation_code == invitation_code.upper(),
            CourseInvitation.is_active == True,
            CourseInvitation.expires_at > datetime.utcnow()
        ).first()
        
        if not invitation:
            return {"success": False, "error": "Invalid or expired invitation code"}
        
        # Check usage limits
        if invitation.max_uses and invitation.current_uses >= invitation.max_uses:
            return {"success": False, "error": "Invitation code usage limit reached"}
        
        # Check if already enrolled
        existing = self.db.query(StudentCourseLink).filter(
            StudentCourseLink.student_id == student_id,
            StudentCourseLink.course_id == invitation.course_id
        ).first()
        
        if existing:
            return {"success": False, "error": "Already enrolled in this course"}
        
        try:
            # Create enrollment
            enrollment = StudentCourseLink(
                student_id=student_id,
                course_id=invitation.course_id,
                enrolled_at=datetime.utcnow()
            )
            self.db.add(enrollment)
            
            # Update invitation usage
            invitation.current_uses += 1
            
            self.db.commit()
            
            return {
                "success": True, 
                "course_id": str(invitation.course_id),
                "message": "Successfully enrolled in course"
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Enrollment failed for code {invitation_code}: {e}")
            return {"success": False, "error": "Enrollment failed. Please try again."}

# /backend/app/routers/invitations.py - NEW FILE
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..services.invitation_service import InvitationService
from ..services.auth_service import get_current_user
from ..models.user import User, UserRole

router = APIRouter(prefix="/api/invitations", tags=["invitations"])

@router.post("/generate")
async def generate_invitation(
    course_id: str,
    expires_hours: int = 168,
    max_uses: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """Generate invitation code for course - professors only"""
    if current_user.role not in [UserRole.PROFESSOR, UserRole.ADMIN]:
        raise HTTPException(403, "Only professors can generate invitation codes")
    
    invitation_service = InvitationService(db)
    code = invitation_service.generate_invitation_code(
        course_id, current_user.id, expires_hours, max_uses
    )
    
    return {"invitation_code": code, "expires_hours": expires_hours}

@router.post("/enroll")
async def enroll_with_invitation(
    invitation_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """Enroll in course using invitation code"""
    invitation_service = InvitationService(db)
    result = invitation_service.enroll_with_code(invitation_code, current_user.id)
    
    if not result["success"]:
        raise HTTPException(400, result["error"])
    
    return result
```

**Frontend invitation UI**:
```typescript
// /frontend-react/src/components/course-discovery/InvitationEnrollment.tsx - NEW FILE
import { useState } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface InvitationEnrollmentProps {
  onEnrollmentSuccess: () => void;
}

export const InvitationEnrollment: React.FC<InvitationEnrollmentProps> = ({
  onEnrollmentSuccess
}) => {
  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const enrollMutation = useMutation({
    mutationFn: (code: string) => 
      api.post('/invitations/enroll', { invitation_code: code }),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-courses']);
      onEnrollmentSuccess();
      setInvitationCode('');
      setError('');
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Enrollment failed');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invitationCode.trim()) {
      enrollMutation.mutate(invitationCode.trim().toUpperCase());
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Join Course with Invitation Code
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the 8-character code provided by your professor
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Invitation Code"
          value={invitationCode}
          onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
          placeholder="ABC123XY"
          inputProps={{ maxLength: 8 }}
          error={!!error}
          helperText={error}
        />
        <Button 
          type="submit"
          variant="contained"
          disabled={enrollMutation.isLoading || invitationCode.length !== 8}
        >
          {enrollMutation.isLoading ? 'Joining...' : 'Join Course'}
        </Button>
      </Box>
    </Box>
  );
};
```

**Impact**: Provides immediate working enrollment method
**Effort**: 8 hours

### 1.3 Remove Deprecated API Endpoints
**Priority**: HIGH - Security
**Issue**: Deprecated endpoints create security vulnerabilities

**Solution**: Clean removal with proper error handling
```python
# /backend/app/routers/courses.py - UPDATED
# Remove deprecated search endpoints entirely
# Delete searchCourse function and route (lines that return deprecation warnings)

# Add clear API documentation for remaining endpoints
@router.get("/search/mvp")
async def search_courses_mvp(
    school: str,
    semester: str, 
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """
    Search courses with full context (school + semester required)
    This is the current supported course search method.
    """
    # Existing MVP search implementation
    pass

# /backend/app/routers/__init__.py - UPDATED  
# Remove deprecated router registrations
# Only include active, supported endpoints
```

**Migration for deprecated endpoint cleanup**:
```python
# /backend/alembic/versions/remove_deprecated_search.py
def upgrade():
    # Log any remaining usage of deprecated endpoints
    op.execute("""
        CREATE TABLE IF NOT EXISTS deprecated_endpoint_usage (
            id SERIAL PRIMARY KEY,
            endpoint VARCHAR(255),
            user_id UUID,
            attempted_at TIMESTAMP DEFAULT NOW()
        )
    """)
```

**Impact**: Eliminates security vulnerabilities, reduces attack surface
**Effort**: 4 hours

## Phase 2: MVP Search Integration (Week 2)

### 2.1 Implement Working Course Search
**Priority**: HIGH - Core Functionality
**Issue**: MVP search exists but not integrated into frontend

**Solution**: Complete frontend-backend integration
```typescript
// /frontend-react/src/services/courseSearchService.ts - NEW FILE
interface SearchFilters {
  school: string;
  semester: string;
  subject?: string;
  instructor?: string;
  creditHours?: number;
  timeFilter?: 'morning' | 'afternoon' | 'evening';
}

interface CourseSearchResult {
  id: string;
  title: string;
  crn: string;
  subject: string;
  courseNumber: string;
  instructor: string;
  credits: number;
  schedule: string;
  seats_available: number;
  total_seats: number;
  description?: string;
  can_enroll: boolean;
}

class CourseSearchService {
  async searchCourses(filters: SearchFilters): Promise<CourseSearchResult[]> {
    const params = new URLSearchParams();
    params.append('school', filters.school);
    params.append('semester', filters.semester);
    
    if (filters.subject) params.append('subject', filters.subject);
    if (filters.instructor) params.append('instructor', filters.instructor);
    if (filters.creditHours) params.append('credit_hours', filters.creditHours.toString());
    if (filters.timeFilter) params.append('time_filter', filters.timeFilter);

    const response = await api.get<CourseSearchResult[]>(`/courses/search/mvp?${params}`);
    return response.data;
  }

  async getSchools(): Promise<string[]> {
    const response = await api.get<string[]>('/courses/schools');
    return response.data;
  }

  async getSemesters(school: string): Promise<string[]> {
    const response = await api.get<string[]>(`/courses/semesters?school=${school}`);
    return response.data;
  }

  async getSubjects(school: string, semester: string): Promise<string[]> {
    const response = await api.get<string[]>(`/courses/subjects?school=${school}&semester=${semester}`);
    return response.data;
  }
}

export const courseSearchService = new CourseSearchService();

// /frontend-react/src/components/course-discovery/CourseSearch.tsx - NEW FILE
import { useState, useEffect } from 'react';
import { 
  Box, Grid, TextField, MenuItem, Button, Typography, 
  Card, CardContent, Chip, CircularProgress 
} from '@mui/material';
import { Search, School, CalendarToday } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

export const CourseSearch: React.FC = () => {
  const [filters, setFilters] = useState<SearchFilters>({
    school: '',
    semester: ''
  });
  const [searchResults, setSearchResults] = useState<CourseSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load schools for dropdown
  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: () => courseSearchService.getSchools()
  });

  // Load semesters when school changes
  const { data: semesters = [] } = useQuery({
    queryKey: ['semesters', filters.school],
    queryFn: () => courseSearchService.getSemesters(filters.school),
    enabled: !!filters.school
  });

  // Load subjects when school and semester are selected
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', filters.school, filters.semester],
    queryFn: () => courseSearchService.getSubjects(filters.school, filters.semester),
    enabled: !!(filters.school && filters.semester)
  });

  const handleSearch = async () => {
    if (!filters.school || !filters.semester) return;
    
    setIsSearching(true);
    try {
      const results = await courseSearchService.searchCourses(filters);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const isSearchEnabled = filters.school && filters.semester;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        <Search sx={{ mr: 1, verticalAlign: 'middle' }} />
        Course Discovery
      </Typography>

      {/* Search Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="School"
                value={filters.school}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  school: e.target.value, 
                  semester: '', 
                  subject: '' 
                }))}
                required
              >
                {schools.map(school => (
                  <MenuItem key={school} value={school}>{school}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Semester"
                value={filters.semester}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  semester: e.target.value, 
                  subject: '' 
                }))}
                disabled={!filters.school}
                required
              >
                {semesters.map(semester => (
                  <MenuItem key={semester} value={semester}>{semester}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Subject (Optional)"
                value={filters.subject || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
                disabled={!filters.semester}
              >
                <MenuItem value="">All Subjects</MenuItem>
                {subjects.map(subject => (
                  <MenuItem key={subject} value={subject}>{subject}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={!isSearchEnabled || isSearching}
                startIcon={isSearching ? <CircularProgress size={20} /> : <Search />}
                size="large"
              >
                {isSearching ? 'Searching...' : 'Search Courses'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Found {searchResults.length} courses
          </Typography>
          {searchResults.map(course => (
            <CourseSearchResult 
              key={course.id} 
              course={course}
              onEnroll={(courseId) => {
                // Handle direct enrollment if available
                console.log('Enroll in:', courseId);
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
```

**Backend MVP search enhancement**:
```python
# /backend/app/routers/courses.py - ENHANCED
@router.get("/search/mvp", response_model=List[CourseSearchResult])
async def search_courses_mvp(
    school: str,
    semester: str,
    subject: Optional[str] = None,
    instructor: Optional[str] = None,
    credit_hours: Optional[int] = None,
    time_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """Enhanced course search with filtering and enrollment status"""
    
    # Base query with required filters
    query = db.query(Course).filter(
        Course.school.ilike(f"%{school}%"),
        Course.semester == semester,
        Course.status == CourseStatus.ACTIVE
    )
    
    # Optional filters
    if subject:
        query = query.filter(Course.subject.ilike(f"%{subject}%"))
    if instructor:
        query = query.filter(Course.instructor.ilike(f"%{instructor}%"))
    if credit_hours:
        query = query.filter(Course.credit_hours == credit_hours)
    
    courses = query.all()
    
    # Enhance results with enrollment information
    results = []
    for course in courses:
        # Check if user is already enrolled
        existing_enrollment = db.query(StudentCourseLink).filter(
            StudentCourseLink.student_id == current_user.id,
            StudentCourseLink.course_id == course.id
        ).first()
        
        # Calculate available seats
        current_enrollments = db.query(func.count(StudentCourseLink.student_id)).filter(
            StudentCourseLink.course_id == course.id,
            StudentCourseLink.is_deleted == False
        ).scalar()
        
        result = CourseSearchResult(
            id=str(course.id),
            title=course.title,
            crn=course.crn,
            subject=course.subject,
            courseNumber=course.course_number,
            instructor=course.instructor,
            credits=course.credit_hours,
            schedule=course.schedule or "TBA",
            seats_available=(course.max_enrollment or 999) - current_enrollments,
            total_seats=course.max_enrollment or 999,
            description=course.description,
            can_enroll=not existing_enrollment and current_enrollments < (course.max_enrollment or 999)
        )
        results.append(result)
    
    return results

@router.get("/schools", response_model=List[str])
async def get_schools(db: Session = Depends(get_database)):
    """Get list of available schools"""
    schools = db.query(Course.school).distinct().all()
    return [school[0] for school in schools if school[0]]

@router.get("/semesters", response_model=List[str])
async def get_semesters(school: str, db: Session = Depends(get_database)):
    """Get available semesters for a school"""
    semesters = db.query(Course.semester).filter(
        Course.school.ilike(f"%{school}%")
    ).distinct().all()
    return [semester[0] for semester in semesters if semester[0]]
```

**Impact**: Provides working course discovery functionality
**Effort**: 12 hours

### 2.2 Add Progressive Course Discovery
**Priority**: MEDIUM - User Experience  
**Issue**: Users need multiple ways to find courses

**Solution**: Multi-modal course discovery
```typescript
// /frontend-react/src/components/course-discovery/CourseDiscoveryHub.tsx - NEW FILE
import { useState } from 'react';
import { 
  Box, Tabs, Tab, Typography, Alert, Chip 
} from '@mui/material';
import { Search, QrCode, Link, People } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

export const CourseDiscoveryHub: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Course Discovery
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Multiple ways to join courses: Search our catalog, use invitation codes from professors, 
          or scan QR codes shared in class.
        </Typography>
      </Alert>

      <Tabs 
        value={tabValue} 
        onChange={(_, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab icon={<QrCode />} label="Invitation Code" />
        <Tab icon={<Search />} label="Search Catalog" />
        <Tab icon={<Link />} label="Direct Link" />
        <Tab icon={<People />} label="Browse Popular" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <InvitationEnrollment 
          onEnrollmentSuccess={() => {
            // Show success message and refresh
          }}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <CourseSearch />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <DirectLinkEnrollment />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <PopularCourses />
      </TabPanel>
    </Box>
  );
};

// /frontend-react/src/components/course-discovery/DirectLinkEnrollment.tsx - NEW FILE
export const DirectLinkEnrollment: React.FC = () => {
  const [enrollmentUrl, setEnrollmentUrl] = useState('');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Join with Direct Link
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste the enrollment link shared by your professor
      </Typography>
      
      <TextField
        fullWidth
        label="Course Enrollment URL"
        value={enrollmentUrl}
        onChange={(e) => setEnrollmentUrl(e.target.value)}
        placeholder="https://syllaai.com/enroll/ABC123XY"
        sx={{ mb: 2 }}
      />
      
      <Button 
        variant="contained"
        disabled={!enrollmentUrl}
        onClick={() => {
          // Extract code from URL and process enrollment
        }}
      >
        Join Course
      </Button>
    </Box>
  );
};
```

**Impact**: Provides multiple enrollment pathways, improves user experience
**Effort**: 8 hours

## Phase 3: Advanced Discovery Features (Week 3)

### 3.1 Implement QR Code Generation for Professors
**Priority**: MEDIUM - Professor Tools
**Issue**: Professors need easy ways to share course enrollment

**Solution**: QR code generation and management
```python
# /backend/app/services/qr_service.py - NEW FILE
import qrcode
import io
import base64
from typing import Dict
from ..services.invitation_service import InvitationService

class QRCodeService:
    def __init__(self, invitation_service: InvitationService):
        self.invitation_service = invitation_service

    def generate_course_qr(self, course_id: str, creator_id: str) -> Dict:
        """Generate QR code for course enrollment"""
        
        # Generate invitation code
        invitation_code = self.invitation_service.generate_invitation_code(
            course_id, creator_id, expires_hours=336  # 14 days for QR codes
        )
        
        # Create enrollment URL
        enrollment_url = f"https://syllaai.com/enroll/{invitation_code}"
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(enrollment_url)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64 for frontend
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_str = base64.b64encode(img_buffer.getvalue()).decode()
        
        return {
            "invitation_code": invitation_code,
            "enrollment_url": enrollment_url,
            "qr_code_base64": f"data:image/png;base64,{img_str}",
            "expires_in_hours": 336
        }

# /backend/app/routers/professor_tools.py - NEW FILE
@router.post("/course/{course_id}/qr-code")
async def generate_course_qr_code(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    """Generate QR code for course enrollment - professors only"""
    if current_user.role not in [UserRole.PROFESSOR, UserRole.ADMIN]:
        raise HTTPException(403, "Only professors can generate QR codes")
    
    # Verify professor owns the course
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.created_by == current_user.id
    ).first()
    
    if not course:
        raise HTTPException(404, "Course not found or access denied")
    
    invitation_service = InvitationService(db)
    qr_service = QRCodeService(invitation_service)
    
    result = qr_service.generate_course_qr(course_id, current_user.id)
    return result
```

**Frontend QR code display**:
```typescript
// /frontend-react/src/components/professor/QRCodeGenerator.tsx - NEW FILE
import { useState } from 'react';
import { 
  Box, Button, Dialog, DialogTitle, DialogContent, 
  Typography, Alert, Grid, Paper 
} from '@mui/material';
import { QrCode, Download, Print, Share } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';

interface QRCodeResult {
  invitation_code: string;
  enrollment_url: string;
  qr_code_base64: string;
  expires_in_hours: number;
}

export const QRCodeGenerator: React.FC<{ courseId: string; courseName: string }> = ({
  courseId,
  courseName
}) => {
  const [open, setOpen] = useState(false);
  const [qrResult, setQrResult] = useState<QRCodeResult | null>(null);

  const generateQRMutation = useMutation({
    mutationFn: () => api.post(`/professor-tools/course/${courseId}/qr-code`),
    onSuccess: (response) => {
      setQrResult(response.data);
    }
  });

  const handleGenerate = () => {
    setOpen(true);
    generateQRMutation.mutate();
  };

  const downloadQR = () => {
    if (!qrResult) return;
    
    const link = document.createElement('a');
    link.href = qrResult.qr_code_base64;
    link.download = `${courseName}-enrollment-qr.png`;
    link.click();
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<QrCode />}
        onClick={handleGenerate}
      >
        Generate QR Code
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Course Enrollment QR Code</DialogTitle>
        <DialogContent>
          {generateQRMutation.isLoading && (
            <Typography>Generating QR code...</Typography>
          )}
          
          {qrResult && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Students can scan this QR code to instantly join your course. 
                Code expires in {Math.floor(qrResult.expires_in_hours / 24)} days.
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <img 
                      src={qrResult.qr_code_base64} 
                      alt="Course QR Code"
                      style={{ maxWidth: '100%' }}
                    />
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    {courseName}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Invitation Code: <strong>{qrResult.invitation_code}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Direct Link: {qrResult.enrollment_url}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      startIcon={<Download />}
                      onClick={downloadQR}
                      size="small"
                    >
                      Download
                    </Button>
                    <Button
                      startIcon={<Share />}
                      onClick={() => navigator.share?.({ url: qrResult.enrollment_url })}
                      size="small"
                    >
                      Share Link
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
```

**Impact**: Provides modern, mobile-friendly enrollment method
**Effort**: 10 hours

### 3.2 Add Course Recommendation Engine
**Priority**: LOW - Enhancement
**Issue**: Students need help discovering relevant courses

**Solution**: Basic recommendation system
```python
# /backend/app/services/recommendation_service.py - NEW FILE
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from ..models.course import Course
from ..models.student_course_link import StudentCourseLink

class CourseRecommendationService:
    def __init__(self, db: Session):
        self.db = db

    async def get_recommendations(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get course recommendations based on user's enrollment history"""
        
        # Get user's current courses
        user_courses = self.db.query(Course).join(StudentCourseLink).filter(
            StudentCourseLink.student_id == user_id,
            StudentCourseLink.is_deleted == False
        ).all()
        
        if not user_courses:
            # New user - recommend popular courses
            return await self._get_popular_courses(limit)
        
        # Get subjects and schools from user's courses
        user_subjects = {course.subject for course in user_courses}
        user_schools = {course.school for course in user_courses}
        
        # Find similar courses
        recommendations = []
        
        # 1. Same subjects, different courses
        subject_recs = self.db.query(Course).filter(
            Course.subject.in_(user_subjects),
            Course.id.notin_([c.id for c in user_courses]),
            Course.status == CourseStatus.ACTIVE
        ).limit(limit // 2).all()
        
        recommendations.extend(subject_recs)
        
        # 2. Same schools, different subjects
        if len(recommendations) < limit:
            school_recs = self.db.query(Course).filter(
                Course.school.in_(user_schools),
                Course.subject.notin_(user_subjects),
                Course.id.notin_([c.id for c in user_courses]),
                Course.status == CourseStatus.ACTIVE
            ).limit(limit - len(recommendations)).all()
            
            recommendations.extend(school_recs)
        
        return [self._format_recommendation(course, "similar_courses") for course in recommendations]

    async def _get_popular_courses(self, limit: int) -> List[Dict]:
        """Get most popular courses by enrollment count"""
        popular = self.db.query(
            Course,
            func.count(StudentCourseLink.student_id).label('enrollment_count')
        ).join(StudentCourseLink).filter(
            Course.status == CourseStatus.ACTIVE,
            StudentCourseLink.is_deleted == False
        ).group_by(Course.id).order_by(
            text('enrollment_count DESC')
        ).limit(limit).all()
        
        return [
            self._format_recommendation(course, "popular", {"enrollment_count": count})
            for course, count in popular
        ]
    
    def _format_recommendation(self, course: Course, reason: str, metadata: Dict = None) -> Dict:
        return {
            "course_id": str(course.id),
            "title": course.title,
            "subject": course.subject,
            "instructor": course.instructor,
            "school": course.school,
            "reason": reason,
            "metadata": metadata or {}
        }

# Frontend recommendation display
# /frontend-react/src/components/course-discovery/CourseRecommendations.tsx - NEW FILE
export const CourseRecommendations: React.FC = () => {
  const { data: recommendations = [] } = useQuery({
    queryKey: ['course-recommendations'],
    queryFn: () => api.get('/courses/recommendations').then(r => r.data)
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Recommended for You
      </Typography>
      
      {recommendations.map(rec => (
        <Card key={rec.course_id} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6">{rec.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {rec.subject} • {rec.instructor} • {rec.school}
            </Typography>
            <Chip 
              label={rec.reason === 'popular' ? 'Popular' : 'Similar to your courses'}
              size="small"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
```

**Impact**: Helps students discover relevant courses
**Effort**: 8 hours

## Phase 4: Security & Performance (Week 4)

### 4.1 Implement Rate Limiting and Security
**Priority**: HIGH - Security
**Issue**: Course enumeration and abuse prevention

**Solution**: Comprehensive rate limiting and security measures
```python
# /backend/app/middleware/rate_limiting.py - NEW FILE
from fastapi import HTTPException, Request
from typing import Dict
import time
from collections import defaultdict, deque

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(deque)
        self.limits = {
            'course_search': (20, 300),  # 20 requests per 5 minutes
            'invitation_enroll': (10, 60),  # 10 enrollments per minute
            'qr_generation': (5, 300),  # 5 QR codes per 5 minutes
        }
    
    def check_rate_limit(self, client_ip: str, endpoint_type: str) -> bool:
        """Check if request is within rate limits"""
        if endpoint_type not in self.limits:
            return True
        
        max_requests, window_seconds = self.limits[endpoint_type]
        now = time.time()
        
        # Clean old requests
        client_requests = self.requests[f"{client_ip}:{endpoint_type}"]
        while client_requests and client_requests[0] < now - window_seconds:
            client_requests.popleft()
        
        # Check limit
        if len(client_requests) >= max_requests:
            return False
        
        # Add current request
        client_requests.append(now)
        return True

rate_limiter = RateLimiter()

def require_rate_limit(endpoint_type: str):
    """Decorator for rate limiting endpoints"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if request:
                client_ip = request.client.host
                if not rate_limiter.check_rate_limit(client_ip, endpoint_type):
                    raise HTTPException(429, "Rate limit exceeded. Please try again later.")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Apply to search endpoints
@router.get("/search/mvp")
@require_rate_limit('course_search')
async def search_courses_mvp(...):
    # Existing implementation
    pass

@router.post("/invitations/enroll")
@require_rate_limit('invitation_enroll') 
async def enroll_with_invitation(...):
    # Existing implementation
    pass
```

**Input validation and sanitization**:
```python
# /backend/app/validators/course_validators.py - NEW FILE
from typing import Optional
import re
from fastapi import HTTPException

class CourseSearchValidator:
    @staticmethod
    def validate_search_params(
        school: str,
        semester: str, 
        subject: Optional[str] = None,
        instructor: Optional[str] = None
    ) -> Dict[str, str]:
        """Validate and sanitize course search parameters"""
        
        # School validation
        if not school or len(school.strip()) < 2:
            raise HTTPException(400, "School name must be at least 2 characters")
        if len(school) > 100:
            raise HTTPException(400, "School name too long")
        school = school.strip()
        
        # Semester validation  
        semester_pattern = r'^(Spring|Summer|Fall|Winter) \d{4}$'
        if not re.match(semester_pattern, semester.strip()):
            raise HTTPException(400, "Invalid semester format. Use 'Season YYYY'")
        semester = semester.strip()
        
        # Subject validation (optional)
        if subject:
            if len(subject.strip()) > 50:
                raise HTTPException(400, "Subject filter too long")
            subject = subject.strip()
        
        # Instructor validation (optional)
        if instructor:
            if len(instructor.strip()) > 100:
                raise HTTPException(400, "Instructor filter too long")
            # Basic name validation
            if not re.match(r'^[a-zA-Z\s\-\.]+$', instructor.strip()):
                raise HTTPException(400, "Invalid instructor name format")
            instructor = instructor.strip()
        
        return {
            'school': school,
            'semester': semester,
            'subject': subject,
            'instructor': instructor
        }

class InvitationValidator:
    @staticmethod
    def validate_invitation_code(code: str) -> str:
        """Validate and normalize invitation code"""
        if not code:
            raise HTTPException(400, "Invitation code is required")
        
        # Normalize to uppercase
        code = code.upper().strip()
        
        # Validate format (8 alphanumeric characters)
        if not re.match(r'^[A-Z0-9]{8}$', code):
            raise HTTPException(400, "Invalid invitation code format")
        
        return code
```

**Impact**: Prevents abuse, secures course discovery system
**Effort**: 6 hours

### 4.2 Add Comprehensive Error Handling
**Priority**: MEDIUM - User Experience
**Issue**: Poor error messages and handling

**Solution**: Structured error responses and logging
```python
# /backend/app/exceptions/course_exceptions.py - NEW FILE
from fastapi import HTTPException

class CourseDiscoveryException(HTTPException):
    """Base exception for course discovery errors"""
    pass

class CourseNotFoundError(CourseDiscoveryException):
    def __init__(self, course_id: str = None):
        message = f"Course {course_id} not found" if course_id else "Course not found"
        super().__init__(status_code=404, detail=message)

class EnrollmentError(CourseDiscoveryException):
    def __init__(self, message: str, error_code: str):
        super().__init__(status_code=400, detail={
            "message": message,
            "error_code": error_code,
            "timestamp": datetime.utcnow().isoformat()
        })

class SearchUnavailableError(CourseDiscoveryException):
    def __init__(self, reason: str = "temporarily unavailable"):
        super().__init__(status_code=503, detail={
            "message": f"Course search is {reason}",
            "error_code": "SEARCH_UNAVAILABLE",
            "suggested_actions": [
                "Try using an invitation code instead",
                "Contact your professor for enrollment assistance", 
                "Check back in a few minutes"
            ]
        })

# Enhanced error handling in endpoints
@router.post("/invitations/enroll")
async def enroll_with_invitation(invitation_code: str, ...):
    try:
        # Validate code
        code = InvitationValidator.validate_invitation_code(invitation_code)
        
        # Attempt enrollment
        result = invitation_service.enroll_with_code(code, current_user.id)
        
        if not result["success"]:
            error_mappings = {
                "Invalid or expired invitation code": "INVALID_CODE",
                "Invitation code usage limit reached": "CODE_EXHAUSTED", 
                "Already enrolled in this course": "ALREADY_ENROLLED"
            }
            
            error_code = error_mappings.get(result["error"], "ENROLLMENT_FAILED")
            raise EnrollmentError(result["error"], error_code)
        
        return result
        
    except EnrollmentError:
        raise
    except Exception as e:
        logger.error(f"Unexpected enrollment error: {e}")
        raise EnrollmentError(
            "An unexpected error occurred during enrollment", 
            "SYSTEM_ERROR"
        )
```

**Frontend error handling**:
```typescript
// /frontend-react/src/hooks/useEnrollmentErrors.ts - NEW FILE
interface EnrollmentError {
  message: string;
  error_code: string;
  suggested_actions?: string[];
}

export const useEnrollmentErrors = () => {
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof AxiosError) {
      const errorData = error.response?.data as EnrollmentError;
      
      switch (errorData?.error_code) {
        case 'INVALID_CODE':
          return 'This invitation code is invalid or has expired. Please check with your professor for a new code.';
        case 'CODE_EXHAUSTED':
          return 'This invitation code has reached its usage limit. Please contact your professor.';
        case 'ALREADY_ENROLLED':
          return 'You are already enrolled in this course.';
        case 'SEARCH_UNAVAILABLE':
          return errorData.message + (errorData.suggested_actions ? 
            ' Try: ' + errorData.suggested_actions.join(', ') : '');
        default:
          return errorData?.message || 'An unexpected error occurred.';
      }
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  return { getErrorMessage };
};
```

**Impact**: Better user experience, easier debugging
**Effort**: 4 hours

## Implementation Timeline

### Week 1: Emergency Stabilization (15 hours)
- Remove broken UI components  
- Implement invitation code enrollment
- Remove deprecated API endpoints

### Week 2: MVP Integration (20 hours)
- Complete course search integration
- Add progressive discovery features
- Enhanced search filtering

### Week 3: Advanced Features (18 hours)  
- QR code generation system
- Course recommendations
- Multi-modal discovery hub

### Week 4: Security & Polish (10 hours)
- Rate limiting implementation
- Comprehensive error handling
- Performance optimization

**Total Effort**: ~63 hours (8 working days)

## Dependencies & Considerations

**Database Changes**: New invitation system requires migration
**Frontend Architecture**: May require routing changes for new discovery flows  
**Mobile Experience**: QR code scanning requires mobile optimization
**Professor Training**: New QR code and invitation features need documentation

## Success Metrics

1. **Functionality**: Students can successfully join courses within 30 seconds
2. **Security**: Zero enumeration attacks, proper rate limiting
3. **User Experience**: Clear error messages, multiple enrollment pathways
4. **Adoption**: 80% of enrollments use invitation codes vs. manual search
5. **Performance**: Course search completes within 2 seconds

This fix plan transforms the broken course discovery system into a secure, user-friendly enrollment experience with multiple pathways for students to join courses while eliminating the security vulnerabilities and user frustration of the current implementation.