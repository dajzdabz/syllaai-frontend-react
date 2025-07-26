# Course Management Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
A comprehensive course management system that enables professors to create, organize, and manage their courses while providing students with an intuitive interface to discover, enroll, and track their academic schedules.

### 1.2 Core Functionalities
- Course creation (manual and AI-assisted)
- Course information management
- Event and assignment scheduling
- Student roster management
- Course sharing and visibility controls
- Duplicate detection and handling

## 2. Technical Architecture

### 2.1 Data Models

#### Course Model
```python
class Course(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text)
    instructor_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    school_id = Column(UUID, ForeignKey('schools.id'))
    credits = Column(Integer)
    semester = Column(String(100))
    start_date = Column(Date)
    end_date = Column(Date)
    meeting_times = Column(JSONB, default=list)
    location = Column(String(255))
    max_enrollment = Column(Integer)
    enrollment_code = Column(String(50), unique=True)
    visibility = Column(Enum(CourseVisibility), default=CourseVisibility.PUBLIC)
    status = Column(Enum(CourseStatus), default=CourseStatus.ACTIVE)
    
    # Syllabus integration
    syllabus_file_url = Column(Text)
    source_syllabus_id = Column(UUID, ForeignKey('syllabus_uploads.id'))
    
    # Grade projection integration
    grading_weights = Column(JSONB)  # {'assignments': 30, 'exams': 40, ...}
    grading_scale = Column(JSONB)    # {'A': {'min': 90, 'max': 100}, ...}
    
    # Calendar integration
    calendar_sync_enabled = Column(Boolean, default=True)
    google_calendar_id = Column(String(255))  # Dedicated course calendar
    
    # Analytics and tracking
    enrollment_count = Column(Integer, default=0)  # Cached for performance
    total_events = Column(Integer, default=0)      # Cached count
    last_activity = Column(DateTime)               # For analytics
    
    # Timestamps with soft delete support
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships for cross-feature integration
    instructor = relationship("User", back_populates="taught_courses")
    events = relationship("CourseEvent", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("StudentCourseLink", back_populates="course", cascade="all, delete-orphan")
    source_syllabus = relationship("SyllabusUpload", back_populates="created_course")
    grade_entries = relationship("GradeEntry", back_populates="course")
    calendar_integrations = relationship("GoogleCalendarIntegration", back_populates="course")
    
    # Computed properties for API responses
    @hybrid_property
    def is_full(self):
        return self.enrollment_count >= (self.max_enrollment or float('inf'))
    
    @hybrid_property
    def seats_available(self):
        if not self.max_enrollment:
            return float('inf')
        return max(0, self.max_enrollment - self.enrollment_count)
```

#### CourseEvent Model (Critical for Calendar Integration)
```python
class CourseEvent(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    course_id = Column(UUID, ForeignKey('courses.id'), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(Enum(EventType), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    location = Column(String(255))
    all_day = Column(Boolean, default=False)
    
    # Recurring event support
    recurring_pattern = Column(JSONB)  # {pattern: 'weekly', days: ['monday'], end_date: '...'}
    parent_event_id = Column(UUID, ForeignKey('course_events.id'))  # For recurring instances
    
    # Integration metadata
    google_event_id = Column(String(255))  # For calendar sync
    source = Column(Enum(EventSource), default=EventSource.MANUAL)
    metadata = Column(JSONB, default=dict)  # Category, weight, points, etc.
    
    # Grade projection integration
    grade_category = Column(String(100))    # assignments, exams, quizzes
    weight_percentage = Column(Float)       # 10.5 for 10.5% of final grade
    points_possible = Column(Integer)       # Total points for assignment
    
    # Notification tracking
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships
    course = relationship("Course", back_populates="events")
    grade_entries = relationship("GradeEntry", back_populates="event")
    parent_event = relationship("CourseEvent", remote_side=[id])
    recurring_instances = relationship("CourseEvent", back_populates="parent_event")

class EventType(Enum):
    CLASS = "class"           # Regular class meetings
    LECTURE = "lecture"       # Lecture sessions
    LAB = "lab"              # Lab sessions
    ASSIGNMENT = "assignment" # Homework, projects due
    EXAM = "exam"            # Tests, quizzes, final exams
    QUIZ = "quiz"            # Short quizzes
    PROJECT = "project"      # Major projects
    OFFICE_HOURS = "office_hours"  # Professor availability
    REVIEW_SESSION = "review_session"  # Exam review sessions
    HOLIDAY = "holiday"      # Academic holidays
    BREAK = "break"          # Academic breaks
    OTHER = "other"          # Miscellaneous events

class EventSource(Enum):
    MANUAL = "manual"         # Created by professor
    SYLLABUS = "syllabus"     # Extracted from syllabus
    IMPORTED = "imported"     # From external calendar
    RECURRING = "recurring"   # Generated from pattern
    SYSTEM = "system"         # System-generated events
    LMS_SYNC = "lms_sync"     # Synced from LMS
```

#### Course Enums
```python
class CourseVisibility(Enum):
    PUBLIC = "public"          # Anyone can view and enroll
    PRIVATE = "private"        # Only with enrollment code
    INSTITUTION = "institution" # Only same institution users

class CourseStatus(Enum):
    DRAFT = "draft"           # Not visible to students
    ACTIVE = "active"         # Open for enrollment
    ARCHIVED = "archived"     # Past courses, read-only
```

#### Meeting Time Structure
```json
{
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
      }
    },
    {
      "type": "lab",
      "day": "wednesday",
      "start_time": "14:00",
      "end_time": "15:50",
      "location": "CS Lab 101"
    }
  ]
}
```

### 2.2 API Endpoints

#### Course CRUD Operations

**GET /api/courses**
```json
// Query Parameters
{
  "role": "student|professor",
  "status": "active|archived|draft",
  "semester": "Fall 2025",
  "search": "computer science",
  "page": 1,
  "limit": 20
}

// Response
{
  "courses": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Introduction to Computer Science",
      "code": "CS 101",
      "instructor": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Dr. Jane Smith",
        "email": "jsmith@university.edu"
      },
      "credits": 3,
      "semester": "Fall 2025",
      "enrollment_count": 25,
      "max_enrollment": 30,
      "next_class": "2025-01-22T10:00:00Z",
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**POST /api/courses**
```json
// Request
{
  "title": "Advanced Web Development",
  "code": "CS 450",
  "description": "Modern web development with React and Node.js",
  "credits": 3,
  "semester": "Fall 2025",
  "meeting_times": [
    {
      "day": "tuesday",
      "start_time": "14:00",
      "end_time": "15:20",
      "location": "Tech Building 301"
    }
  ],
  "start_date": "2025-08-25",
  "end_date": "2025-12-15",
  "max_enrollment": 25,
  "visibility": "public",
  "bypass_duplicates": false
}

// Response
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "title": "Advanced Web Development",
  "enrollment_code": "CS450-F25-X7K9",
  "message": "Course created successfully"
}
```

**PUT /api/courses/{course_id}**
```json
// Partial update supported
{
  "description": "Updated course description",
  "max_enrollment": 30,
  "meeting_times": [/* Updated schedule */]
}
```

**DELETE /api/courses/{course_id}**
```json
// Soft delete - sets deleted_at timestamp
// Response: 204 No Content
```

#### Course Duplication Detection

**POST /api/courses/check-duplicate**
```json
// Request
{
  "title": "Introduction to Programming",
  "code": "CS 101",
  "semester": "Fall 2025"
}

// Response
{
  "is_duplicate": true,
  "similar_courses": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "title": "Introduction to Computer Science",
      "code": "CS 101",
      "similarity_score": 0.92,
      "instructor": "Dr. Jane Smith"
    }
  ],
  "suggestion": "Course with similar title and code already exists"
}
```

### 2.3 Course Discovery

#### Search Algorithm
```python
def search_courses(query: str, filters: dict) -> List[Course]:
    # Full-text search on title, code, description
    search_vector = func.to_tsvector('english', 
        Course.title + ' ' + Course.code + ' ' + Course.description
    )
    
    results = db.query(Course).filter(
        search_vector.match(query)
    )
    
    # Apply filters
    if filters.get('semester'):
        results = results.filter(Course.semester == filters['semester'])
    
    if filters.get('credits'):
        results = results.filter(Course.credits == filters['credits'])
    
    # Rank by relevance
    return results.order_by(
        func.ts_rank(search_vector, func.plainto_tsquery(query)).desc()
    )
```

## 3. User Interface Components

### 3.1 Professor Dashboard

#### Course Grid View
```jsx
<CourseGrid>
  <CourseCard>
    <CardHeader>
      <CourseTitle>CS 101 - Intro to Computer Science</CourseTitle>
      <StatusBadge status="active" />
    </CardHeader>
    <CardContent>
      <InfoRow icon="people" text="25/30 students" />
      <InfoRow icon="calendar" text="MWF 10:00-10:50" />
      <InfoRow icon="location" text="Science Hall 204" />
    </CardContent>
    <CardActions>
      <Button onClick={manageCourse}>Manage</Button>
      <Button onClick={viewRoster}>Roster</Button>
      <IconButton onClick={showMore}>
        <MoreVertIcon />
      </IconButton>
    </CardActions>
  </CourseCard>
</CourseGrid>
```

#### Quick Actions
```jsx
<QuickActions>
  <ActionButton 
    icon="add" 
    text="Create Course"
    onClick={openCourseCreation}
  />
  <ActionButton 
    icon="upload" 
    text="Upload Syllabus"
    onClick={openSyllabusUpload}
  />
  <ActionButton 
    icon="copy" 
    text="Duplicate Course"
    onClick={openCourseDuplication}
  />
</QuickActions>
```

### 3.2 Course Creation Interface

#### Multi-Step Form
```jsx
<CourseCreationWizard>
  <Step title="Basic Information">
    <TextField label="Course Title" required />
    <TextField label="Course Code" required />
    <TextArea label="Description" rows={4} />
    <Select label="Credits" options={[1,2,3,4]} />
  </Step>
  
  <Step title="Schedule">
    <MeetingTimeEditor />
    <DatePicker label="Start Date" />
    <DatePicker label="End Date" />
  </Step>
  
  <Step title="Settings">
    <TextField label="Max Enrollment" type="number" />
    <Select label="Visibility" options={visibilityOptions} />
    <Switch label="Generate enrollment code" />
  </Step>
  
  <Step title="Review">
    <CoursePreview data={formData} />
    <DuplicateWarning similarCourses={duplicates} />
  </Step>
</CourseCreationWizard>
```

### 3.3 Course Detail View

#### Information Panels
```jsx
<CourseDetailPage>
  <CourseHeader>
    <Title>{course.code} - {course.title}</Title>
    <EnrollmentBadge>{enrollmentCount}/{maxEnrollment}</EnrollmentBadge>
    <EditButton onClick={enterEditMode} />
  </CourseHeader>
  
  <TabPanel>
    <Tab label="Overview">
      <CourseInfo course={course} />
      <MeetingSchedule meetings={course.meeting_times} />
    </Tab>
    
    <Tab label="Events">
      <EventTimeline events={course.events} />
      <AddEventButton />
    </Tab>
    
    <Tab label="Students">
      <StudentRoster enrollments={course.enrollments} />
      <ExportButton format="csv" />
    </Tab>
    
    <Tab label="Settings">
      <CourseSettings course={course} />
      <DangerZone>
        <ArchiveButton />
        <DeleteButton />
      </DangerZone>
    </Tab>
  </TabPanel>
</CourseDetailPage>
```

### 3.4 Student Course View

#### Course Catalog
```jsx
<CourseCatalog>
  <SearchBar 
    placeholder="Search courses..."
    onSearch={handleSearch}
  />
  
  <FilterPanel>
    <Filter type="semester" options={semesters} />
    <Filter type="credits" options={[1,2,3,4]} />
    <Filter type="department" options={departments} />
    <Filter type="meeting_time" options={timeSlots} />
  </FilterPanel>
  
  <CourseResults>
    {courses.map(course => (
      <CourseListItem>
        <CourseDetails>
          <Title>{course.title}</Title>
          <Subtitle>{course.code} • {course.instructor.name}</Subtitle>
          <Schedule>{formatMeetingTimes(course.meeting_times)}</Schedule>
        </CourseDetails>
        <EnrollButton 
          courseId={course.id}
          disabled={course.enrollment_count >= course.max_enrollment}
        />
      </CourseListItem>
    ))}
  </CourseResults>
</CourseCatalog>
```

## 4. Course Event Management

### 4.1 Event Types

```python
class EventType(Enum):
    CLASS = "class"           # Regular class meetings
    ASSIGNMENT = "assignment" # Homework, projects
    EXAM = "exam"            # Tests, quizzes, exams
    PROJECT = "project"      # Major projects
    OTHER = "other"          # Office hours, reviews, etc.
```

### 4.2 Event Creation

```jsx
<EventCreationModal>
  <Form>
    <TextField label="Event Title" required />
    <Select label="Type" options={eventTypes} />
    <DateTimePicker label="Start Date/Time" />
    <DateTimePicker label="End Date/Time" />
    <TextField label="Location" />
    <TextArea label="Description" />
    
    <RecurringOptions>
      <Switch label="Recurring Event" />
      <Select label="Pattern" options={['weekly', 'biweekly', 'monthly']} />
      <DatePicker label="Repeat Until" />
    </RecurringOptions>
  </Form>
</EventCreationModal>
```

## 5. Enrollment Management

### 5.1 Enrollment Code System

```python
def generate_enrollment_code(course: Course) -> str:
    # Format: DEPT+NUMBER-SEMESTER-RANDOM
    # Example: CS101-F25-X7K9
    dept_code = extract_department(course.code)
    semester_code = get_semester_code(course.semester)
    random_code = generate_random_string(4)
    
    return f"{course.code}-{semester_code}-{random_code}"
```

### 5.2 Student Roster Interface

```jsx
<StudentRoster>
  <RosterHeader>
    <Title>Enrolled Students ({enrollments.length})</Title>
    <Actions>
      <Button onClick={exportRoster}>Export</Button>
      <Button onClick={emailAll}>Email All</Button>
    </Actions>
  </RosterHeader>
  
  <StudentTable>
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Enrolled Date</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {enrollments.map(enrollment => (
        <StudentRow 
          student={enrollment.student}
          enrolledAt={enrollment.enrolled_at}
          onRemove={() => removeStudent(enrollment.id)}
        />
      ))}
    </tbody>
  </StudentTable>
</StudentRoster>
```

## 6. Implementation Phases

### Phase 1: Core Course Management
1. Basic CRUD operations
2. Course creation forms
3. Professor dashboard
4. Student course discovery
5. Simple enrollment system

### Phase 2: Advanced Features
1. Duplicate detection algorithm
2. Bulk course operations
3. Course templates
4. Advanced search and filtering
5. Course archival system

### Phase 3: Integration & Enhancement
1. LMS integration for course import
2. Department-level management
3. Course recommendation engine
4. Waitlist management
5. Course evaluation integration

## 7. Business Rules

### 7.1 Course Creation Rules
- Professors can only create courses for their institution
- Course codes must be unique within semester
- Start date must be before end date
- Maximum enrollment must be positive integer

### 7.2 Enrollment Rules
- Students cannot enroll in overlapping courses
- Cannot exceed maximum enrollment
- Cannot enroll after course end date
- Must have valid enrollment code for private courses

### 7.3 Modification Rules
- Only instructor can modify course details
- Cannot modify archived courses
- Cannot delete course with active enrollments
- Changes trigger notifications to enrolled students

## 8. Performance Optimization

### 8.1 Database Indexes
```sql
CREATE INDEX idx_courses_instructor_status ON courses(instructor_id, status);
CREATE INDEX idx_courses_semester ON courses(semester);
CREATE INDEX idx_courses_search ON courses USING gin(
    to_tsvector('english', title || ' ' || code || ' ' || description)
);
```

### 8.2 Caching Strategy
- Cache course list for 5 minutes
- Cache enrollment counts in Redis
- Invalidate cache on course updates
- Pre-warm cache for popular courses

## 9. Integration Points

### 9.1 Event System Integration

#### Course Events Published
```python
class CourseEvent(Enum):
    COURSE_CREATED = "course.created"
    COURSE_UPDATED = "course.updated"
    COURSE_DELETED = "course.deleted"
    COURSE_ARCHIVED = "course.archived"
    COURSE_PUBLISHED = "course.published"
    EVENT_CREATED = "course.event_created"
    EVENT_UPDATED = "course.event_updated"
    EVENT_DELETED = "course.event_deleted"
    SCHEDULE_CHANGED = "course.schedule_changed"
    ENROLLMENT_OPENED = "course.enrollment_opened"
    ENROLLMENT_CLOSED = "course.enrollment_closed"
    CAPACITY_CHANGED = "course.capacity_changed"
    DUPLICATE_DETECTED = "course.duplicate_detected"

@dataclass
class CourseCreatedEvent:
    course_id: str
    instructor_id: str
    created_from_syllabus: bool
    event_count: int
    timestamp: datetime
    # Triggers: Calendar setup, notification to instructor, analytics tracking

@dataclass
class CourseUpdatedEvent:
    course_id: str
    instructor_id: str
    changes: dict  # Field names and old/new values
    enrolled_student_count: int
    timestamp: datetime
    # Triggers: Student notifications, calendar sync, grade recalculation

@dataclass
class ScheduleChangedEvent:
    course_id: str
    instructor_id: str
    old_meeting_times: list
    new_meeting_times: list
    enrolled_students: list
    timestamp: datetime
    # Triggers: High-priority notifications, calendar updates, conflict detection
```

### 9.2 Syllabus Processing Integration

#### Course Creation from Syllabus
```python
async def create_course_from_extracted_data(extracted_data: dict, user_id: str) -> Course:
    """Create course from syllabus processing results"""
    
    # Check permissions
    user = await get_user(user_id)
    if not user_has_permission(user, Permission.CREATE_COURSE):
        raise HTTPException(403, "Permission denied")
    
    # Detect duplicates using extracted data
    duplicates = await detect_duplicate_courses(
        title=extracted_data['course_info']['title'],
        code=extracted_data['course_info']['code'],
        semester=extracted_data['course_info']['semester'],
        instructor_id=user_id
    )
    
    if duplicates:
        return {'duplicates': duplicates, 'needs_approval': True}
    
    # Create course with all extracted data
    course = Course(
        title=extracted_data['course_info']['title'],
        code=extracted_data['course_info']['code'],
        description=extracted_data['course_info'].get('description'),
        credits=extracted_data['course_info'].get('credits'),
        semester=extracted_data['course_info'].get('semester'),
        start_date=parse_date(extracted_data['course_info'].get('start_date')),
        end_date=parse_date(extracted_data['course_info'].get('end_date')),
        instructor_id=user_id,
        meeting_times=extracted_data['meeting_times'],
        grading_weights=extracted_data.get('grading_weights'),
        grading_scale=extracted_data.get('grading_scale'),
        enrollment_code=generate_enrollment_code()
    )
    
    await db.add(course)
    await db.flush()
    
    # Create events from extracted assignments/exams
    events = []
    for event_data in extracted_data.get('course_events', []):
        event = CourseEvent(
            course_id=course.id,
            title=event_data['title'],
            event_type=EventType(event_data['event_type']),
            start_datetime=parse_datetime(event_data['start_datetime']),
            end_datetime=parse_datetime(event_data['end_datetime']),
            location=event_data.get('location'),
            description=event_data.get('description'),
            source=EventSource.SYLLABUS,
            grade_category=event_data.get('category'),
            weight_percentage=event_data.get('weight_percentage'),
            points_possible=event_data.get('points_possible')
        )
        events.append(event)
    
    await db.add_all(events)
    course.total_events = len(events)
    await db.commit()
    
    # Publish integration event
    await event_bus.publish(CourseEvent.COURSE_CREATED, {
        'course_id': course.id,
        'instructor_id': user_id,
        'created_from_syllabus': True,
        'event_count': len(events)
    })
    
    return course
```

### 9.3 Student Enrollment Integration

#### Enrollment Management
```python
async def handle_course_enrollment(course_id: str, student_id: str) -> dict:
    """Handle student enrollment with cross-feature coordination"""
    
    course = await get_course(course_id)
    student = await get_user(student_id)
    
    # Check capacity
    if course.is_full:
        # Add to waitlist (handled by Student Enrollment feature)
        await add_to_waitlist(student_id, course_id)
        return {'status': 'waitlisted', 'position': await get_waitlist_position(student_id, course_id)}
    
    # Create enrollment
    enrollment = StudentCourseLink(
        student_id=student_id,
        course_id=course_id,
        enrollment_status=EnrollmentStatus.ACTIVE
    )
    await db.add(enrollment)
    
    # Update cached enrollment count
    course.enrollment_count += 1
    await db.commit()
    
    # Initialize grade projections if grading weights exist
    if course.grading_weights:
        await setup_grade_projections(enrollment)
    
    # Trigger calendar sync for student
    if student.calendar_sync_enabled:
        await calendar_service.sync_course_events(student_id, course_id)
    
    # Send enrollment confirmation
    await notification_service.send_enrollment_confirmation(student_id, course_id)
    
    # Track analytics
    await analytics_service.track_enrollment(student_id, course_id)
    
    return {'status': 'enrolled', 'enrollment_id': enrollment.id}

async def handle_course_unenrollment(enrollment_id: str) -> dict:
    """Handle student unenrollment with cleanup"""
    
    enrollment = await get_enrollment(enrollment_id)
    course = enrollment.course
    student = enrollment.student
    
    # Update enrollment status
    enrollment.enrollment_status = EnrollmentStatus.DROPPED
    enrollment.unenrolled_at = datetime.utcnow()
    
    # Update cached count
    course.enrollment_count -= 1
    
    # Clean up grade projections
    await db.query(GradeEntry).filter(
        GradeEntry.student_id == enrollment.student_id,
        GradeEntry.course_id == enrollment.course_id,
        GradeEntry.is_projected == True
    ).delete()
    
    # Remove from calendar
    if student.calendar_sync_enabled:
        await calendar_service.remove_course_events(student.id, course.id)
    
    # Process waitlist
    next_student = await get_next_waitlisted_student(course.id)
    if next_student:
        await notification_service.notify_waitlist_opening(next_student.id, course.id)
    
    await db.commit()
    
    return {'status': 'unenrolled'}
```

### 9.4 Calendar Integration

#### Automatic Calendar Sync
```python
async def sync_course_to_calendar(course: Course, user_id: str):
    """Sync course schedule and events to user's calendar"""
    
    user = await get_user(user_id)
    if not user.calendar_sync_enabled:
        return
    
    calendar_service = GoogleCalendarService(user)
    
    # Create or update course calendar
    if not course.google_calendar_id:
        calendar_info = await calendar_service.create_course_calendar(
            name=f"{course.code} - {course.title}",
            description=f"Events for {course.title}"
        )
        course.google_calendar_id = calendar_info['id']
    
    # Sync recurring meeting times
    for meeting in course.meeting_times:
        recurring_event = {
            'title': f"{course.code} - {meeting['type'].title()}",
            'start_time': meeting['start_time'],
            'end_time': meeting['end_time'],
            'location': meeting.get('location'),
            'recurrence': {
                'pattern': 'weekly',
                'days': [meeting['day']],
                'start_date': course.start_date,
                'end_date': course.end_date
            }
        }
        await calendar_service.create_recurring_event(recurring_event)
    
    # Sync course events (assignments, exams)
    for event in course.events:
        if not event.google_event_id:
            calendar_event = await calendar_service.create_event({
                'title': event.title,
                'description': event.description,
                'start': event.start_datetime,
                'end': event.end_datetime,
                'location': event.location
            })
            event.google_event_id = calendar_event['id']
    
    await db.commit()

async def handle_schedule_change(course: Course, changes: dict):
    """Handle course schedule changes with calendar updates"""
    
    # Publish event for notifications
    await event_bus.publish(CourseEvent.SCHEDULE_CHANGED, {
        'course_id': course.id,
        'instructor_id': course.instructor_id,
        'old_meeting_times': changes.get('old_meeting_times', []),
        'new_meeting_times': course.meeting_times,
        'enrolled_students': [e.student_id for e in course.enrollments if e.enrollment_status == EnrollmentStatus.ACTIVE]
    })
    
    # Update all enrolled students' calendars
    for enrollment in course.enrollments:
        if enrollment.enrollment_status == EnrollmentStatus.ACTIVE and enrollment.student.calendar_sync_enabled:
            await sync_course_to_calendar(course, enrollment.student_id)
```

### 9.5 Notification Integration

#### Course Change Notifications
```python
@event_handler(CourseEvent.SCHEDULE_CHANGED)
async def on_schedule_changed(event_data: dict):
    """Send notifications when course schedule changes"""
    
    course_id = event_data['course_id']
    enrolled_students = event_data['enrolled_students']
    course = await get_course(course_id)
    
    for student_id in enrolled_students:
        await notification_service.create_notification(
            user_id=student_id,
            type=NotificationType.SCHEDULE_CHANGE,
            title=f"Schedule Change: {course.code}",
            message=f"The schedule for {course.title} has been updated. Please check your calendar.",
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP],
            related_data={
                'course_id': course_id,
                'action_url': f"/courses/{course_id}",
                'old_schedule': event_data['old_meeting_times'],
                'new_schedule': event_data['new_meeting_times']
            }
        )

@event_handler(CourseEvent.COURSE_CREATED)
async def on_course_created(event_data: dict):
    """Send welcome notification when course is created"""
    
    course_id = event_data['course_id']
    instructor_id = event_data['instructor_id']
    
    await notification_service.create_notification(
        user_id=instructor_id,
        type=NotificationType.COURSE_CREATED,
        title="Course Created Successfully",
        message=f"Your course has been created and is ready for students!",
        channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        related_data={
            'course_id': course_id,
            'action_url': f"/courses/{course_id}",
            'created_from_syllabus': event_data.get('created_from_syllabus', False),
            'event_count': event_data.get('event_count', 0)
        }
    )
```

### 9.6 Analytics Integration

#### Course Analytics Tracking
```python
async def track_course_analytics(course: Course, action: str, user_id: str, metadata: dict = None):
    """Track analytics events for course management"""
    
    await analytics_service.track_event(
        user_id=user_id,
        event_type=f"course.{action}",
        event_data={
            'course_id': course.id,
            'course_code': course.code,
            'instructor_id': course.instructor_id,
            'enrollment_count': course.enrollment_count,
            'event_count': course.total_events,
            'has_grading_weights': bool(course.grading_weights),
            'created_from_syllabus': bool(course.source_syllabus_id),
            'calendar_sync_enabled': course.calendar_sync_enabled,
            **(metadata or {})
        }
    )

# Track key course metrics
@event_handler(CourseEvent.COURSE_CREATED)
async def track_course_creation(event_data: dict):
    course = await get_course(event_data['course_id'])
    await track_course_analytics(course, 'created', event_data['instructor_id'], {
        'creation_method': 'syllabus' if event_data.get('created_from_syllabus') else 'manual',
        'initial_event_count': event_data.get('event_count', 0)
    })
```

### 9.7 Grade Projection Integration

#### Grade Setup Integration
```python
async def initialize_course_grading(course: Course):
    """Initialize grading structure for grade projections"""
    
    if not course.grading_weights:
        return  # No grading policy defined
    
    # Create grade categories based on events
    categories = {}
    for event in course.events:
        if event.grade_category and event.weight_percentage:
            if event.grade_category not in categories:
                categories[event.grade_category] = {
                    'events': [],
                    'total_weight': 0,
                    'total_points': 0
                }
            
            categories[event.grade_category]['events'].append(event)
            categories[event.grade_category]['total_weight'] += event.weight_percentage
            categories[event.grade_category]['total_points'] += event.points_possible or 0
    
    # Validate grading weights match events
    for category, weight in course.grading_weights.items():
        if category in categories:
            expected_weight = categories[category]['total_weight']
            if abs(expected_weight - weight) > 1:  # 1% tolerance
                # Log warning about weight mismatch
                await analytics_service.track_event(
                    user_id=course.instructor_id,
                    event_type='grading.weight_mismatch',
                    event_data={
                        'course_id': course.id,
                        'category': category,
                        'syllabus_weight': weight,
                        'events_weight': expected_weight
                    }
                )
```

## 10. Success Metrics

### 10.1 Usage Metrics
- Courses created per professor
- Student enrollment rate
- Course discovery conversion
- Feature adoption rates

### 10.2 Performance Metrics
- Page load time < 1 second
- Search response < 500ms
- Bulk operations < 5 seconds

### 10.3 Quality Metrics
- Course information completeness
- Duplicate detection accuracy
- User satisfaction scores