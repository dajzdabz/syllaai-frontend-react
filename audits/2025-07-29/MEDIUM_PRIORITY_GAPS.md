# SyllabAI Medium Priority Gaps - Week 3 Production Hardening
**Date**: July 29, 2025  
**Priority**: MEDIUM - Address during Week 3 production hardening

## 📋 Compliance & Legal Gaps

### No Privacy Policy (MEDIUM)
**Risk**: Legal issues, user trust problems  
**Missing**: Clear privacy policy for Google OAuth data handling

**Fix Required**:
- Create comprehensive privacy policy
- Explain data collection, usage, retention
- Make easily accessible to users

### No Data Access/Deletion (MEDIUM)
**Risk**: GDPR/CCPA non-compliance  
**Missing**: User data download and deletion endpoints

**Fix Required**:
```python
@router.get("/user/data-export")
async def export_user_data(user: User = Depends(get_current_user)):
    # Return all user data in portable format
    pass

@router.delete("/user/account") 
async def delete_user_account(user: User = Depends(get_current_user)):
    # Scrub all personal data from database
    pass
```

### No Data Retention Policy (MEDIUM)
**Missing**: Clear policy on data lifecycle  
**Risk**: Storing unnecessary data indefinitely

## 🎨 User Experience Gaps

### Poor Error Handling UX (MEDIUM)
**Issue**: Generic error messages frustrate users  
**Impact**: High user churn from poor experience

**Fix Required**:
```typescript
// Replace generic errors with user-friendly messages
const handleError = (error: ApiError) => {
  if (error.code === 'SYLLABUS_PARSE_FAILED') {
    return "We couldn't parse your syllabus. Please try a different format or contact support."
  }
  return "Something went wrong. Please try again."
}
```

### No Manual Correction Interface (MEDIUM)
**Issue**: Syllabus parsing not 100% accurate  
**Missing**: Interface for users to review/correct parsed data

**Fix Required**:
- Add review step after syllabus parsing
- Allow manual editing of parsed events
- Save corrections for improved parsing

### Slow Feedback for Long Operations (MEDIUM)
**Issue**: Syllabus parsing feels unresponsive  
**Missing**: Progress indicators, real-time feedback

**Fix Required**:
```typescript
// Add progress tracking for syllabus processing
const [uploadProgress, setUploadProgress] = useState(0)
const [processingStep, setProcessingStep] = useState("Uploading...")

// Update progress based on processing steps
```

## 📚 Documentation Gaps

### Incomplete API Documentation (MEDIUM)
**Issue**: FastAPI auto-docs need better descriptions  
**Missing**: Comprehensive endpoint documentation

**Fix Required**:
```python
@router.post("/courses/", response_model=Course)
async def create_course(
    course: CourseCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new course for the authenticated user.
    
    - **course**: Course details including name, credits, description
    - **Returns**: Created course with unique ID and metadata
    """
```

### No User Guide (MEDIUM)
**Missing**: Help documentation for end users  
**Impact**: Users struggle to understand features

**Fix Required**:
- Create simple user guide on GitHub Pages
- FAQ section for common issues
- Video tutorials for key workflows

### Insufficient README (MEDIUM)
**Issue**: Developer onboarding is difficult  
**Missing**: Clear setup instructions, architecture overview

## 🏗️ Architecture Improvements

### Asynchronous Task Handling (MEDIUM)
**Issue**: Long-running operations block API requests  
**Missing**: Background task queue for syllabus parsing

**Fix Required**:
```python
# Consider Celery or ARQ for background tasks
from celery import Celery

celery_app = Celery("syllaai")

@celery_app.task
def process_syllabus_async(file_content: bytes, user_id: int):
    # Process syllabus in background
    pass
```

### Code Quality Issues (MEDIUM)
**Issue**: Mixed logging approaches, inconsistent error handling  
**File**: `backend/app/utils/crypto.py` uses `print()` instead of logging

**Fix Required**:
- Standardize on structured logging throughout
- Consistent error handling patterns
- Code style enforcement with pre-commit hooks

## 🔧 Business Logic Gaps

### Insufficient Time Zone Handling (MEDIUM)
**Risk**: Incorrect due dates in different time zones  
**Issue**: Calendar export may show wrong times

**Fix Required**:
```python
from datetime import datetime, timezone

# Store all times in UTC
utc_time = datetime.now(timezone.utc)

# Convert to user's timezone on frontend
```

### Limited Syllabus Format Support (MEDIUM)
**Issue**: Parser may fail on diverse syllabus formats  
**Risk**: High failure rate for real-world syllabi

**Fix Required**:
- Collect diverse syllabus samples for testing
- Improve parsing robustness
- Implement fallback parsing strategies

### No Edge Case Handling (MEDIUM)
**Missing**: Handling for recurring events, holidays, unusual schedules  
**Risk**: Application crashes or incorrect data

**Fix Required**:
```python
# Handle edge cases in course scheduling
def handle_recurring_events(event_data):
    # Check for recurring patterns
    # Handle university holidays
    # Manage semester boundaries
    pass
```

## 📊 Performance Optimizations

### Frontend Bundle Size (MEDIUM)
**Issue**: Large JavaScript bundle impacts loading time  
**Missing**: Code splitting, lazy loading

**Fix Required**:
```typescript
// Implement lazy loading for routes
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const CourseEventsPage = lazy(() => import('./pages/CourseEventsPage'))
```

### Caching Strategy (MEDIUM)
**Missing**: Caching for frequently accessed data  
**Impact**: Unnecessary database queries

**Fix Required**:
- Implement Redis caching for course data
- Cache syllabus parsing results
- Frontend caching with React Query

**Estimated Time**: 4-5 days during Week 3 production hardening