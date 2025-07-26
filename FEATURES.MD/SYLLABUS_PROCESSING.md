# Syllabus Processing Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
An AI-powered syllabus processing system that automatically extracts course information, schedules, assignments, and grading policies from uploaded documents, transforming unstructured academic documents into structured, actionable data.

### 1.2 Core Capabilities
- Multi-format document support (PDF, DOC, DOCX, TXT)
- AI-powered information extraction using GPT-4
- Confidence scoring for extracted data
- Manual review and correction interface
- Real-time processing status updates

## 2. Technical Architecture

### 2.1 Processing Pipeline

#### Document Processing Flow
1. File upload and validation
2. Document conversion to text
3. AI extraction with GPT-4
4. Confidence scoring
5. Data structuring and validation
6. Review interface presentation
7. Course creation from approved data

#### Extraction Categories
- **Course Information**: Title, code, credits, instructor
- **Meeting Schedule**: Days, times, location, frequency
- **Important Dates**: Start/end dates, holidays, breaks
- **Assignments**: Due dates, types, weights, descriptions
- **Grading Policy**: Grade weights, scale, policies
- **Course Policies**: Attendance, late work, academic integrity

### 2.2 Data Models

#### Syllabus Upload Model
```python
class SyllabusUpload(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    filename = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    processing_status = Column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    extracted_data = Column(JSONB)
    processing_errors = Column(ARRAY(String))
    confidence_scores = Column(JSONB)
    
    # Integration with Course Management
    created_course_id = Column(UUID, ForeignKey('courses.id'))
    duplicate_course_ids = Column(ARRAY(UUID))  # Potential duplicates found
    approved_by_user = Column(Boolean, default=False)
    
    # Processing metadata
    processing_duration = Column(Float)  # seconds
    ai_model_version = Column(String(50))
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships for integration
    user = relationship("User", back_populates="syllabus_uploads")
    created_course = relationship("Course", back_populates="source_syllabus")

class ProcessingStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
```

#### Extracted Data Structure (Standardized for Feature Integration)
```json
{
  "course_info": {
    "title": "Introduction to Computer Science",
    "code": "CS 101",
    "description": "Fundamentals of programming and computer science concepts",
    "credits": 3,
    "semester": "Fall 2025",
    "start_date": "2025-08-25",
    "end_date": "2025-12-15",
    "instructor": {
      "name": "Dr. Jane Smith",
      "email": "jsmith@university.edu",
      "office_hours": "MWF 2-3 PM"
    },
    "confidence": 0.92
  },
  "meeting_times": [
    {
      "type": "lecture",
      "day": "monday",
      "start_time": "10:00",
      "end_time": "10:50",
      "location": "Science Hall 204",
      "frequency": "weekly",
      "effective_dates": {
        "start": "2025-08-25",
        "end": "2025-12-15"
      },
      "confidence": 0.88
    },
    {
      "type": "lab",
      "day": "wednesday", 
      "start_time": "14:00",
      "end_time": "15:50",
      "location": "CS Lab 101",
      "frequency": "weekly",
      "confidence": 0.85
    }
  ],
  "grading_weights": {
    "assignments": 30,
    "quizzes": 20,
    "midterm": 20,
    "final": 25,
    "participation": 5
  },
  "grading_scale": {
    "A": {"min": 93, "max": 100},
    "A-": {"min": 90, "max": 92.99},
    "B+": {"min": 87, "max": 89.99},
    "B": {"min": 83, "max": 86.99},
    "B-": {"min": 80, "max": 82.99},
    "C+": {"min": 77, "max": 79.99},
    "C": {"min": 73, "max": 76.99},
    "C-": {"min": 70, "max": 72.99},
    "D": {"min": 60, "max": 69.99},
    "F": {"min": 0, "max": 59.99}
  },
  "course_events": [
    {
      "title": "Programming Assignment 1",
      "event_type": "assignment",
      "start_datetime": "2025-09-15T23:59:00",
      "end_datetime": "2025-09-15T23:59:00",
      "description": "Basic Python programming concepts",
      "category": "assignments",
      "weight_percentage": 5,
      "points_possible": 100,
      "confidence": 0.87
    },
    {
      "title": "Midterm Exam",
      "event_type": "exam",
      "start_datetime": "2025-10-15T10:00:00",
      "end_datetime": "2025-10-15T11:50:00",
      "location": "Science Hall 204",
      "description": "Covers chapters 1-5",
      "category": "midterm",
      "weight_percentage": 20,
      "points_possible": 200,
      "confidence": 0.92
    }
  ],
  "course_policies": {
    "attendance_policy": "Attendance is mandatory for all lectures",
    "late_work_policy": "Late assignments penalized 10% per day",
    "makeup_policy": "Makeup exams only with doctor's note",
    "academic_integrity": "Collaboration permitted on assignments but not exams"
  },
  "confidence_summary": {
    "overall": 0.89,
    "course_info": 0.92,
    "meeting_times": 0.85,
    "grading_policy": 0.90,
    "events": 0.87
  }
}
```

### 2.3 API Endpoints

#### Upload Endpoints

**POST /api/syllabi/upload**
```
Content-Type: multipart/form-data

Form Data:
- file: Binary file data
- course_title: Optional title hint
- academic_term: "Fall 2025" (optional)

Response:
{
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "File uploaded successfully, processing started",
  "estimated_time": 30
}
```

**GET /api/syllabi/status/{upload_id}**
```json
{
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "message": "Processing complete",
  "extracted_data": { /* Extracted data structure */ },
  "processing_time": 25.3,
  "confidence_summary": {
    "overall": 0.89,
    "course_info": 0.92,
    "schedule": 0.85,
    "assignments": 0.87
  }
}
```

**POST /api/syllabi/approve/{upload_id}**
```json
// Request
{
  "corrections": {
    "course_info.title": "Intro to Computer Science",
    "meeting_schedule.regular_meetings[0].location": "Science Building 204"
  },
  "create_course": true,
  "bypass_duplicates": false
}

// Response
{
  "course_id": "650e8400-e29b-41d4-a716-446655440001",
  "message": "Course created successfully",
  "redirect_url": "/courses/650e8400-e29b-41d4-a716-446655440001"
}
```

### 2.4 AI Processing Engine

#### GPT-4 Integration
```python
class SyllabusProcessor:
    def __init__(self):
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
    async def extract_information(self, text: str) -> dict:
        prompt = self._build_extraction_prompt(text)
        
        response = await self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": SYLLABUS_EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        return self._parse_and_validate(response.choices[0].message.content)
```

#### Confidence Scoring Algorithm
```python
def calculate_confidence(extracted_field: dict) -> float:
    factors = {
        "explicit_mention": 0.4,    # Field explicitly stated
        "format_match": 0.3,        # Matches expected format
        "context_relevance": 0.2,   # Found in relevant section
        "value_validity": 0.1       # Passes validation rules
    }
    
    score = sum(
        weight * extracted_field.get(factor, 0) 
        for factor, weight in factors.items()
    )
    
    return min(score, 1.0)
```

## 3. User Interface Components

### 3.1 Upload Interface

#### Drag & Drop Zone
```jsx
<UploadZone>
  <CloudUploadIcon size="large" />
  <Typography variant="h6">
    Drag and drop your syllabus here
  </Typography>
  <Typography variant="body2" color="textSecondary">
    or click to browse files
  </Typography>
  <Typography variant="caption">
    Supports PDF, DOC, DOCX, TXT (max 10MB)
  </Typography>
  <input 
    type="file" 
    accept=".pdf,.doc,.docx,.txt"
    onChange={handleFileSelect}
    hidden
  />
</UploadZone>
```

### 3.2 Processing Status

#### Real-time Updates
```jsx
<ProcessingStatus>
  <LinearProgress variant="determinate" value={progress} />
  <StatusMessage>
    {status === 'uploading' && 'Uploading file...'}
    {status === 'extracting' && 'Extracting text from document...'}
    {status === 'analyzing' && 'Analyzing syllabus content...'}
    {status === 'structuring' && 'Organizing course information...'}
    {status === 'completed' && 'Processing complete!'}
  </StatusMessage>
</ProcessingStatus>
```

### 3.3 Review Interface

#### Extracted Data Review
```jsx
<ReviewInterface>
  <Section title="Course Information" confidence={0.92}>
    <EditableField 
      label="Course Title"
      value={data.course_info.title}
      onChange={(value) => updateField('course_info.title', value)}
      confidence={0.95}
    />
    <EditableField 
      label="Course Code"
      value={data.course_info.code}
      onChange={(value) => updateField('course_info.code', value)}
      confidence={0.89}
    />
  </Section>
  
  <Section title="Meeting Schedule" confidence={0.85}>
    <ScheduleEditor 
      meetings={data.meeting_schedule.regular_meetings}
      onChange={updateMeetings}
    />
  </Section>
  
  <Section title="Assignments" confidence={0.87}>
    <AssignmentList 
      assignments={data.assignments}
      onEdit={editAssignment}
      onAdd={addAssignment}
      onRemove={removeAssignment}
    />
  </Section>
</ReviewInterface>
```

#### Confidence Indicators
- **High Confidence (> 0.85)**: Green checkmark
- **Medium Confidence (0.70-0.85)**: Yellow warning
- **Low Confidence (< 0.70)**: Red alert with manual review required

## 4. Document Processing

### 4.1 File Type Handlers

#### PDF Processing
```python
class PDFProcessor:
    def extract_text(self, file_path: str) -> str:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
        return self._clean_text(text)
```

#### Word Document Processing
```python
class DocxProcessor:
    def extract_text(self, file_path: str) -> str:
        doc = docx.Document(file_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        # Also extract tables
        for table in doc.tables:
            text += self._extract_table_text(table)
        return text
```

### 4.2 Text Preprocessing

```python
def preprocess_syllabus_text(text: str) -> str:
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Fix common OCR errors
    text = fix_common_ocr_errors(text)
    
    # Normalize date formats
    text = normalize_dates(text)
    
    # Identify and mark sections
    text = identify_syllabus_sections(text)
    
    return text
```

## 5. Error Handling

### 5.1 Processing Errors

#### File Too Large
```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds 10MB limit",
    "details": {
      "max_size": "10MB",
      "file_size": "15.2MB"
    }
  }
}
```

#### Unsupported Format
```json
{
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "File format not supported",
    "details": {
      "supported_formats": ["pdf", "doc", "docx", "txt"],
      "provided_format": "rtf"
    }
  }
}
```

### 5.2 Extraction Failures

#### Low Confidence Results
```json
{
  "warning": {
    "code": "LOW_CONFIDENCE_EXTRACTION",
    "message": "Some information could not be reliably extracted",
    "details": {
      "low_confidence_fields": ["meeting_schedule", "office_hours"],
      "recommendation": "Please review and correct extracted information"
    }
  }
}
```

## 6. Implementation Phases

### Phase 1: Core Processing
1. File upload infrastructure
2. Basic text extraction (PDF, DOCX)
3. GPT-4 integration for extraction
4. Simple review interface
5. Course creation from extracted data

### Phase 2: Enhanced Extraction
1. Advanced parsing for complex schedules
2. Table extraction and processing
3. Image-based text extraction (OCR)
4. Multi-page section detection
5. Grading policy extraction

### Phase 3: Intelligence Layer
1. Machine learning for confidence scoring
2. Template detection and matching
3. Historical data for improved accuracy
4. Bulk syllabus processing
5. Department-specific parsing rules

## 7. Quality Assurance

### 7.1 Extraction Accuracy

#### Test Dataset
- 100+ real syllabi from various departments
- Different formats and structures
- Multiple universities and styles

#### Success Metrics
- Course info extraction: > 95% accuracy
- Schedule extraction: > 90% accuracy
- Assignment extraction: > 85% accuracy
- Overall satisfaction: > 4.5/5 stars

### 7.2 Performance Requirements

- Upload time: < 3 seconds for 10MB file
- Processing time: < 30 seconds average
- Extraction accuracy: > 85% overall
- UI responsiveness: < 100ms for interactions

## 8. Security Considerations

### 8.1 File Security
- Virus scanning on upload
- File type validation (not just extension)
- Sandboxed processing environment
- Automatic file deletion after processing

### 8.2 Data Privacy
- No permanent storage of syllabus files
- Extracted data tied to user account only
- No sharing of extracted data
- FERPA compliance for educational records

## 9. Integration Points

### 9.1 Course Management Integration

#### Direct Course Creation Flow
```python
async def create_course_from_syllabus(syllabus_upload: SyllabusUpload) -> Course:
    """Create course directly from approved syllabus data"""
    extracted_data = syllabus_upload.extracted_data
    course_info = extracted_data['course_info']
    
    # Check for duplicate courses first
    duplicates = await detect_duplicate_courses(
        title=course_info['title'],
        code=course_info['code'],
        semester=course_info['semester'],
        instructor_id=syllabus_upload.user_id
    )
    
    if duplicates and not syllabus_upload.approved_by_user:
        # Store potential duplicates for user review
        syllabus_upload.duplicate_course_ids = [d.id for d in duplicates]
        await db.commit()
        return None
    
    # Create course with extracted data
    course = Course(
        title=course_info['title'],
        code=course_info['code'],
        description=course_info.get('description'),
        credits=course_info.get('credits'),
        semester=course_info.get('semester'),
        start_date=parse_date(course_info.get('start_date')),
        end_date=parse_date(course_info.get('end_date')),
        instructor_id=syllabus_upload.user_id,
        meeting_times=extracted_data['meeting_times'],
        grading_weights=extracted_data['grading_weights'],
        grading_scale=extracted_data['grading_scale'],
        source_syllabus_id=syllabus_upload.id
    )
    
    await db.add(course)
    await db.flush()  # Get course ID
    
    # Create course events from extracted assignments/exams
    events = []
    for event_data in extracted_data.get('course_events', []):
        # Map extracted event types to standard EventType enum
        event_type_mapping = {
            'assignment': EventType.ASSIGNMENT,
            'homework': EventType.ASSIGNMENT,
            'exam': EventType.EXAM,
            'test': EventType.EXAM,
            'quiz': EventType.QUIZ,
            'project': EventType.PROJECT,
            'lecture': EventType.LECTURE,
            'lab': EventType.LAB,
            'class': EventType.CLASS,
            'office_hours': EventType.OFFICE_HOURS,
            'review': EventType.REVIEW_SESSION,
            'other': EventType.OTHER
        }
        
        mapped_event_type = event_type_mapping.get(
            event_data['event_type'].lower(), 
            EventType.OTHER
        )
        
        event = CourseEvent(
            course_id=course.id,
            title=event_data['title'],
            event_type=mapped_event_type,
            start_datetime=parse_datetime(event_data['start_datetime']),
            end_datetime=parse_datetime(event_data['end_datetime']),
            location=event_data.get('location'),
            description=event_data.get('description'),
            source=EventSource.SYLLABUS,
            grade_category=event_data.get('category'),
            weight_percentage=event_data.get('weight_percentage'),
            points_possible=event_data.get('points_possible'),
            metadata={
                'confidence': event_data.get('confidence'),
                'extraction_method': 'ai_gpt4',
                'raw_data': event_data
            }
        )
        events.append(event)
    
    await db.add_all(events)
    
    # Update syllabus upload with created course
    syllabus_upload.created_course_id = course.id
    syllabus_upload.processing_status = ProcessingStatus.COMPLETED
    
    await db.commit()
    
    # Publish integration events
    await event_bus.publish(CourseEvent.COURSE_CREATED, {
        'course_id': course.id,
        'created_from_syllabus': True,
        'event_count': len(events),
        'instructor_id': course.instructor_id
    })
    
    return course
```

### 9.2 Calendar Integration

#### Automatic Event Generation
```python
async def sync_syllabus_to_calendar(course: Course):
    """Automatically sync extracted events to calendar"""
    # Create recurring meeting events
    for meeting in course.meeting_times:
        recurring_event = {
            'title': f"{course.code} - {meeting['type'].title()}",
            'start_time': meeting['start_time'],
            'end_time': meeting['end_time'],
            'location': meeting.get('location'),
            'recurrence': {
                'pattern': 'weekly',
                'days': [meeting['day']],
                'start_date': meeting['effective_dates']['start'],
                'end_date': meeting['effective_dates']['end']
            }
        }
        await calendar_service.create_recurring_event(
            course.instructor_id, 
            recurring_event
        )
    
    # Trigger calendar sync for enrolled students
    enrollments = await get_course_enrollments(course.id)
    for enrollment in enrollments:
        if enrollment.student.calendar_sync_enabled:
            await calendar_service.sync_course_events(
                enrollment.student_id, 
                course.id
            )
```

### 9.3 Student Enrollment Integration

#### Grade Projection Setup
```python
async def setup_grade_projections(enrollment: StudentCourseLink):
    """Initialize grade projections when student enrolls"""
    course = await get_course(enrollment.course_id)
    
    if not course.grading_weights:
        return  # No grading policy extracted
    
    # Create initial grade entries for each category
    for category, weight in course.grading_weights.items():
        # Find assignments in this category
        category_events = await db.query(CourseEvent).filter(
            CourseEvent.course_id == course.id,
            CourseEvent.metadata['category'].astext == category
        ).all()
        
        for event in category_events:
            grade_entry = GradeEntry(
                student_id=enrollment.student_id,
                course_id=course.id,
                event_id=event.id,
                category=category,
                points_possible=event.metadata.get('points_possible', 100),
                is_projected=True,  # Start as projected
                entry_method=EntryMethod.AUTO_GENERATED
            )
            await db.add(grade_entry)
    
    await db.commit()
```

### 9.4 Notification System Integration

#### Processing Status Notifications
```python
async def send_processing_notifications(syllabus_upload: SyllabusUpload):
    """Send notifications based on processing status"""
    user = await get_user(syllabus_upload.user_id)
    
    if syllabus_upload.processing_status == ProcessingStatus.COMPLETED:
        if syllabus_upload.created_course_id:
            # Course created successfully
            await notification_service.create_notification(
                user_id=user.id,
                type=NotificationType.COURSE_CREATED,
                title="Course Created Successfully",
                message=f"Your syllabus for '{syllabus_upload.filename}' has been processed and your course is ready!",
                channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP],
                related_data={
                    'course_id': syllabus_upload.created_course_id,
                    'action_url': f"/courses/{syllabus_upload.created_course_id}"
                }
            )
        elif syllabus_upload.duplicate_course_ids:
            # Duplicates found, needs user review
            await notification_service.create_notification(
                user_id=user.id,
                type=NotificationType.DUPLICATE_COURSES_FOUND,
                title="Duplicate Courses Detected",
                message="We found similar courses. Please review and choose how to proceed.",
                channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP],
                priority=NotificationPriority.HIGH,
                related_data={
                    'syllabus_upload_id': syllabus_upload.id,
                    'duplicate_count': len(syllabus_upload.duplicate_course_ids),
                    'action_url': f"/syllabus/{syllabus_upload.id}/review"
                }
            )
    
    elif syllabus_upload.processing_status == ProcessingStatus.FAILED:
        # Processing failed
        await notification_service.create_notification(
            user_id=user.id,
            type=NotificationType.PROCESSING_FAILED,
            title="Syllabus Processing Failed",
            message=f"We couldn't process your syllabus '{syllabus_upload.filename}'. Please try uploading a clearer version.",
            channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP],
            priority=NotificationPriority.HIGH,
            related_data={
                'syllabus_upload_id': syllabus_upload.id,
                'errors': syllabus_upload.processing_errors,
                'action_url': f"/upload-syllabus"
            }
        )
```

### 9.5 Analytics Integration

#### Processing Metrics Collection
```python
async def track_processing_analytics(syllabus_upload: SyllabusUpload):
    """Track analytics events for processing"""
    
    # Track processing completion
    await analytics_service.track_event(
        user_id=syllabus_upload.user_id,
        event_type=AnalyticsEvent.SYLLABUS_PROCESSED,
        event_data={
            'processing_duration': syllabus_upload.processing_duration,
            'file_size': syllabus_upload.file_size,
            'mime_type': syllabus_upload.mime_type,
            'confidence_scores': syllabus_upload.confidence_scores,
            'success': syllabus_upload.processing_status == ProcessingStatus.COMPLETED,
            'errors': syllabus_upload.processing_errors,
            'events_extracted': len(syllabus_upload.extracted_data.get('course_events', [])),
            'ai_model': syllabus_upload.ai_model_version
        }
    )
    
    # Track user behavior
    if syllabus_upload.approved_by_user:
        await analytics_service.track_event(
            user_id=syllabus_upload.user_id,
            event_type=AnalyticsEvent.EXTRACTION_APPROVED,
            event_data={
                'corrections_made': bool(syllabus_upload.user_corrections),
                'confidence_override': True
            }
        )
```

### 9.6 Event System Integration

#### Published Events
```python
class SyllabusEvent(Enum):
    UPLOAD_STARTED = "syllabus.upload_started"
    PROCESSING_STARTED = "syllabus.processing_started"
    PROCESSING_COMPLETED = "syllabus.processing_completed"
    PROCESSING_FAILED = "syllabus.processing_failed"
    COURSE_CREATED = "syllabus.course_created"
    DUPLICATES_DETECTED = "syllabus.duplicates_detected"
    USER_APPROVED = "syllabus.user_approved"
    USER_REJECTED = "syllabus.user_rejected"
    LOW_CONFIDENCE_WARNING = "syllabus.low_confidence_warning"

# Event handlers for cross-feature coordination
@event_handler(SyllabusEvent.COURSE_CREATED)
async def on_course_created(event_data: dict):
    course_id = event_data['course_id']
    instructor_id = event_data['instructor_id']
    
    # Trigger calendar setup
    await calendar_service.setup_course_calendar(course_id)
    
    # Send welcome notification
    await notification_service.send_course_creation_confirmation(
        instructor_id, 
        course_id
    )
    
    # Initialize analytics tracking
    await analytics_service.setup_course_tracking(course_id)

@event_handler(SyllabusEvent.DUPLICATES_DETECTED)
async def on_duplicates_detected(event_data: dict):
    syllabus_upload_id = event_data['syllabus_upload_id']
    user_id = event_data['user_id']
    
    # Send high-priority notification for user review
    await notification_service.send_duplicate_review_notification(
        user_id, 
        syllabus_upload_id
    )
```

## 10. Future Enhancements

### 10.1 Advanced Features
- Comparative analysis across syllabi
- Department-wide syllabus templates
- Version control for syllabus updates
- Automatic updates when syllabus changes

### 10.2 AI Improvements
- Fine-tuned models for syllabus extraction
- Learning from user corrections
- Pattern recognition for institution-specific formats
- Multi-language syllabus support