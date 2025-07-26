# Student Enrollment Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
A streamlined enrollment system that enables students to discover, join, and manage their course enrollments through intuitive search, secure access codes, and real-time availability tracking, while providing professors with complete control over their course rosters.

### 1.2 Core Capabilities
- Course discovery with advanced search and filtering
- Secure enrollment via access codes
- Real-time enrollment status and capacity tracking
- Waitlist management
- Student roster management for professors
- Enrollment history and transcript view

## 2. Technical Architecture

### 2.1 Data Models

#### Student Course Link Model
```python
class StudentCourseLink(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    student_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    course_id = Column(UUID, ForeignKey('courses.id'), nullable=False)
    enrollment_status = Column(Enum(EnrollmentStatus), default=EnrollmentStatus.ACTIVE)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    unenrolled_at = Column(DateTime, nullable=True)
    enrollment_method = Column(Enum(EnrollmentMethod), default=EnrollmentMethod.ACCESS_CODE)
    grade = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Grade projection integration
    grade_projection_setup = Column(Boolean, default=False)
    final_grade_calculated = Column(Float, nullable=True)  # 0-100 scale
    projected_final_grade = Column(Float, nullable=True)   # Based on current/projected grades
    
    # Calendar integration tracking
    calendar_synced = Column(Boolean, default=False)
    calendar_sync_errors = Column(ARRAY(String))
    
    # Notification preferences for this enrollment
    notification_preferences = Column(JSONB, default=dict)  # Course-specific notification settings
    
    # Analytics tracking
    enrollment_source = Column(String(100))  # search, recommendation, direct_link, etc.
    time_to_enroll_seconds = Column(Integer)  # Time from first course view to enrollment
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships for cross-feature integration
    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    grade_entries = relationship("GradeEntry", back_populates="enrollment", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('student_id', 'course_id'),
        CheckConstraint('unenrolled_at IS NULL OR unenrolled_at > enrolled_at'),
    )

class EnrollmentStatus(Enum):
    PENDING = "pending"        # Awaiting approval
    ACTIVE = "active"         # Currently enrolled
    COMPLETED = "completed"   # Course finished
    DROPPED = "dropped"       # Student dropped course
    WAITLISTED = "waitlisted" # On waitlist

class EnrollmentMethod(Enum):
    ACCESS_CODE = "access_code"   # Used enrollment code
    DIRECT_ADD = "direct_add"     # Professor added directly
    PUBLIC_JOIN = "public_join"   # Joined public course
    WAITLIST = "waitlist"         # Promoted from waitlist
```

#### Waitlist Model
```python
class Waitlist(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    course_id = Column(UUID, ForeignKey('courses.id'), nullable=False)
    student_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    position = Column(Integer, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    notified_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Notification tracking integration
    notification_ids = Column(ARRAY(UUID))  # Track related notifications
    reminder_sent = Column(Boolean, default=False)
    
    # Analytics tracking
    enrollment_source = Column(String(100))  # How they found the course
    time_on_waitlist_hours = Column(Integer)  # Auto-calculated when promoted/removed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    course = relationship("Course", back_populates="waitlist_entries")
    student = relationship("User", back_populates="waitlist_entries")
    
    # Unique constraint on position within course
    __table_args__ = (
        UniqueConstraint('course_id', 'student_id'),
        UniqueConstraint('course_id', 'position'),
    )
```

### 2.2 API Endpoints

#### Enrollment Endpoints

**POST /api/enrollments**
```json
// Request
{
  "course_id": "550e8400-e29b-41d4-a716-446655440000",
  "enrollment_code": "CS101-F25-X7K9"
}

// Success Response
{
  "enrollment_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "active",
  "course": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Introduction to Computer Science",
    "code": "CS 101",
    "instructor": "Dr. Jane Smith"
  },
  "enrolled_at": "2025-01-15T10:30:00Z",
  "message": "Successfully enrolled in CS 101"
}

// Waitlist Response
{
  "waitlist_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "waitlisted",
  "position": 3,
  "course": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Introduction to Computer Science",
    "code": "CS 101"
  },
  "message": "Course is full. You've been added to the waitlist at position 3"
}
```

**DELETE /api/enrollments/{enrollment_id}**
```json
// Response
{
  "message": "Successfully unenrolled from CS 101",
  "waitlist_notification": {
    "notified_student_id": "880e8400-e29b-41d4-a716-446655440003",
    "message": "A spot has opened up in CS 101"
  }
}
```

**GET /api/enrollments/student**
```json
// Query Parameters
{
  "status": "active",
  "semester": "Fall 2025"
}

// Response
{
  "enrollments": [
    {
      "id": "enrollment_id",
      "course": {
        "id": "course_id",
        "title": "Introduction to Computer Science",
        "code": "CS 101",
        "credits": 3,
        "meeting_times": [...],
        "instructor": {
          "name": "Dr. Jane Smith",
          "email": "jsmith@university.edu"
        }
      },
      "enrollment_status": "active",
      "enrolled_at": "2025-01-15T10:30:00Z",
      "current_grade": "A-"
    }
  ],
  "total_credits": 15,
  "enrollment_summary": {
    "active": 5,
    "waitlisted": 1,
    "completed": 12
  }
}
```

#### Course Discovery Endpoints

**GET /api/courses/discover**
```json
// Query Parameters
{
  "search": "computer science",
  "department": "CS",
  "credits": [3, 4],
  "days": ["monday", "wednesday"],
  "time_range": {
    "start": "09:00",
    "end": "15:00"
  },
  "has_seats": true,
  "semester": "Fall 2025",
  "sort": "relevance",
  "page": 1,
  "limit": 20
}

// Response
{
  "courses": [
    {
      "id": "course_id",
      "title": "Introduction to Computer Science",
      "code": "CS 101",
      "description": "Fundamentals of programming...",
      "instructor": {
        "name": "Dr. Jane Smith",
        "rating": 4.5
      },
      "credits": 3,
      "meeting_times": [...],
      "enrollment_info": {
        "enrolled": 25,
        "capacity": 30,
        "waitlist": 2,
        "seats_available": 5
      },
      "match_score": 0.95,
      "tags": ["programming", "beginner-friendly"]
    }
  ],
  "facets": {
    "departments": {
      "CS": 45,
      "MATH": 23,
      "PHYS": 12
    },
    "credit_hours": {
      "1": 5,
      "3": 67,
      "4": 23
    }
  },
  "pagination": {...}
}
```

#### Roster Management Endpoints

**GET /api/courses/{course_id}/roster**
```json
// Professor only endpoint
{
  "students": [
    {
      "id": "student_id",
      "name": "John Doe",
      "email": "jdoe@university.edu",
      "student_id": "S12345678",
      "enrollment": {
        "id": "enrollment_id",
        "status": "active",
        "enrolled_at": "2025-01-15T10:30:00Z",
        "grade": "B+",
        "attendance_rate": 0.92
      }
    }
  ],
  "statistics": {
    "total_enrolled": 28,
    "capacity": 30,
    "average_grade": "B",
    "attendance_rate": 0.87
  },
  "waitlist": [
    {
      "student": {
        "name": "Jane Smith",
        "email": "jsmith@university.edu"
      },
      "position": 1,
      "joined_at": "2025-01-20T14:00:00Z"
    }
  ]
}
```

**POST /api/courses/{course_id}/roster/add**
```json
// Request - Professor directly adds student
{
  "student_email": "student@university.edu",
  "override_capacity": false,
  "send_notification": true
}

// Response
{
  "enrollment_id": "new_enrollment_id",
  "message": "Student successfully added to course",
  "notification_sent": true
}
```

### 2.3 Enrollment Rules Engine

```python
class EnrollmentRulesEngine:
    async def can_enroll(self, student_id: str, course_id: str) -> EnrollmentEligibility:
        student = await get_user(student_id)
        course = await get_course(course_id)
        
        # Check capacity
        if not self._has_available_seats(course):
            return EnrollmentEligibility(
                eligible=False,
                reason="Course is full",
                waitlist_available=True
            )
        
        # Check prerequisites
        if not await self._meets_prerequisites(student, course):
            return EnrollmentEligibility(
                eligible=False,
                reason="Prerequisites not met",
                missing_prerequisites=self._get_missing_prerequisites(student, course)
            )
        
        # Check schedule conflicts
        conflicts = await self._check_schedule_conflicts(student, course)
        if conflicts:
            return EnrollmentEligibility(
                eligible=False,
                reason="Schedule conflict",
                conflicts=conflicts
            )
        
        # Check enrollment limits
        if await self._exceeds_credit_limit(student, course):
            return EnrollmentEligibility(
                eligible=False,
                reason="Would exceed credit limit"
            )
        
        return EnrollmentEligibility(eligible=True)
```

## 3. User Interface Components

### 3.1 Course Discovery Interface

#### Search and Filter Panel
```jsx
<CourseDiscovery>
  <SearchHeader>
    <SearchBar
      placeholder="Search courses by title, code, or keyword..."
      value={searchQuery}
      onChange={setSearchQuery}
      onSearch={performSearch}
    />
    <FilterToggle onClick={toggleFilters}>
      <FilterIcon />
      Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
    </FilterToggle>
  </SearchHeader>
  
  <FilterPanel expanded={filtersExpanded}>
    <FilterSection title="Department">
      <DepartmentSelect
        multiple
        value={selectedDepartments}
        options={departments}
        onChange={setSelectedDepartments}
      />
    </FilterSection>
    
    <FilterSection title="Meeting Times">
      <DaySelector
        value={selectedDays}
        onChange={setSelectedDays}
      />
      <TimeRangeSlider
        value={timeRange}
        onChange={setTimeRange}
        min="08:00"
        max="22:00"
      />
    </FilterSection>
    
    <FilterSection title="Credits">
      <CreditSelector
        value={selectedCredits}
        onChange={setSelectedCredits}
        options={[1, 2, 3, 4, 5]}
      />
    </FilterSection>
    
    <FilterSection title="Availability">
      <Switch
        label="Only show courses with available seats"
        checked={showAvailableOnly}
        onChange={setShowAvailableOnly}
      />
    </FilterSection>
  </FilterPanel>
  
  <SearchResults />
</CourseDiscovery>
```

#### Course Search Results
```jsx
<SearchResults>
  <ResultsHeader>
    <ResultCount>{totalResults} courses found</ResultCount>
    <SortSelector
      value={sortBy}
      onChange={setSortBy}
      options={[
        { value: 'relevance', label: 'Best Match' },
        { value: 'course_code', label: 'Course Code' },
        { value: 'seats_available', label: 'Seats Available' }
      ]}
    />
  </ResultsHeader>
  
  <CourseList>
    {courses.map(course => (
      <CourseCard key={course.id}>
        <CourseHeader>
          <CourseTitle>
            {course.code} - {course.title}
          </CourseTitle>
          <CreditBadge>{course.credits} credits</CreditBadge>
        </CourseHeader>
        
        <InstructorInfo>
          <InstructorName>{course.instructor.name}</InstructorName>
          {course.instructor.rating && (
            <Rating value={course.instructor.rating} />
          )}
        </InstructorInfo>
        
        <ScheduleInfo>
          <ScheduleIcon />
          {formatMeetingTimes(course.meeting_times)}
        </ScheduleInfo>
        
        <EnrollmentStatus>
          <ProgressBar
            value={course.enrollment_info.enrolled}
            max={course.enrollment_info.capacity}
          />
          <StatusText>
            {course.enrollment_info.seats_available} seats available
            {course.enrollment_info.waitlist > 0 && 
              ` (${course.enrollment_info.waitlist} on waitlist)`
            }
          </StatusText>
        </EnrollmentStatus>
        
        <CourseActions>
          <Button
            onClick={() => viewCourseDetails(course.id)}
            variant="text"
          >
            View Details
          </Button>
          <Button
            onClick={() => enrollInCourse(course.id)}
            variant="contained"
            disabled={!course.enrollment_info.seats_available}
          >
            Enroll
          </Button>
        </CourseActions>
      </CourseCard>
    ))}
  </CourseList>
  
  <Pagination
    page={currentPage}
    totalPages={totalPages}
    onChange={setCurrentPage}
  />
</SearchResults>
```

### 3.2 Enrollment Process

#### Enrollment Modal
```jsx
<EnrollmentModal>
  <ModalHeader>
    <Title>Enroll in {course.title}</Title>
    <CloseButton onClick={onClose} />
  </ModalHeader>
  
  <ModalContent>
    {course.visibility === 'private' ? (
      <AccessCodeSection>
        <InfoText>
          This course requires an enrollment code from the instructor
        </InfoText>
        <TextField
          label="Enrollment Code"
          placeholder="e.g., CS101-F25-X7K9"
          value={enrollmentCode}
          onChange={setEnrollmentCode}
          error={codeError}
          helperText={codeError}
        />
      </AccessCodeSection>
    ) : (
      <CourseConfirmation>
        <SummaryCard>
          <CourseInfo>
            <Label>Course:</Label>
            <Value>{course.code} - {course.title}</Value>
          </CourseInfo>
          <CourseInfo>
            <Label>Instructor:</Label>
            <Value>{course.instructor.name}</Value>
          </CourseInfo>
          <CourseInfo>
            <Label>Schedule:</Label>
            <Value>{formatMeetingTimes(course.meeting_times)}</Value>
          </CourseInfo>
          <CourseInfo>
            <Label>Credits:</Label>
            <Value>{course.credits}</Value>
          </CourseInfo>
        </SummaryCard>
        
        {conflicts.length > 0 && (
          <ConflictWarning>
            <WarningIcon />
            <ConflictText>
              This course conflicts with: {conflicts.map(c => c.code).join(', ')}
            </ConflictText>
          </ConflictWarning>
        )}
      </CourseConfirmation>
    )}
  </ModalContent>
  
  <ModalActions>
    <Button onClick={onClose} variant="text">
      Cancel
    </Button>
    <Button
      onClick={handleEnroll}
      variant="contained"
      loading={enrolling}
      disabled={!canEnroll}
    >
      {course.enrollment_info.seats_available > 0 
        ? 'Confirm Enrollment'
        : 'Join Waitlist'
      }
    </Button>
  </ModalActions>
</EnrollmentModal>
```

### 3.3 Student Dashboard

#### My Courses Section
```jsx
<MyCoursesSection>
  <SectionHeader>
    <Title>My Courses - {semester}</Title>
    <CreditSummary>
      {totalCredits} credits enrolled
    </CreditSummary>
  </SectionHeader>
  
  <CourseStatusTabs>
    <Tab label={`Active (${activeCourses.length})`} value="active" />
    <Tab label={`Waitlisted (${waitlistedCourses.length})`} value="waitlisted" />
    <Tab label={`Completed (${completedCourses.length})`} value="completed" />
  </CourseStatusTabs>
  
  <EnrolledCoursesList>
    {filteredCourses.map(enrollment => (
      <EnrolledCourseCard key={enrollment.id}>
        <CourseHeader>
          <CourseTitle>
            {enrollment.course.code} - {enrollment.course.title}
          </CourseTitle>
          {enrollment.current_grade && (
            <GradeBadge grade={enrollment.current_grade} />
          )}
        </CourseHeader>
        
        <CourseDetails>
          <DetailRow>
            <Icon name="person" />
            {enrollment.course.instructor.name}
          </DetailRow>
          <DetailRow>
            <Icon name="schedule" />
            {formatMeetingTimes(enrollment.course.meeting_times)}
          </DetailRow>
          <DetailRow>
            <Icon name="location" />
            {enrollment.course.location}
          </DetailRow>
        </CourseDetails>
        
        <CourseActions>
          <Button onClick={() => viewCourse(enrollment.course.id)}>
            View Course
          </Button>
          {enrollment.status === 'active' && (
            <Button
              onClick={() => unenroll(enrollment.id)}
              variant="text"
              color="error"
            >
              Drop Course
            </Button>
          )}
          {enrollment.status === 'waitlisted' && (
            <WaitlistInfo>
              Position: {enrollment.waitlist_position}
            </WaitlistInfo>
          )}
        </CourseActions>
      </EnrolledCourseCard>
    ))}
  </EnrolledCoursesList>
</MyCoursesSection>
```

### 3.4 Professor Roster Management

#### Roster View
```jsx
<RosterManagement>
  <RosterHeader>
    <Title>Course Roster</Title>
    <EnrollmentStats>
      <Stat label="Enrolled" value={roster.enrolled} />
      <Stat label="Capacity" value={roster.capacity} />
      <Stat label="Waitlist" value={roster.waitlist_count} />
    </EnrollmentStats>
    <RosterActions>
      <Button onClick={exportRoster}>
        <DownloadIcon /> Export
      </Button>
      <Button onClick={addStudent}>
        <AddIcon /> Add Student
      </Button>
    </RosterActions>
  </RosterHeader>
  
  <StudentTable>
    <TableHeader>
      <Column sortable onClick={() => sort('name')}>Name</Column>
      <Column sortable onClick={() => sort('student_id')}>Student ID</Column>
      <Column>Email</Column>
      <Column sortable onClick={() => sort('enrolled_at')}>Enrolled</Column>
      <Column sortable onClick={() => sort('grade')}>Grade</Column>
      <Column>Actions</Column>
    </TableHeader>
    
    <TableBody>
      {roster.students.map(student => (
        <StudentRow key={student.id}>
          <Cell>{student.name}</Cell>
          <Cell>{student.student_id}</Cell>
          <Cell>
            <EmailLink href={`mailto:${student.email}`}>
              {student.email}
            </EmailLink>
          </Cell>
          <Cell>{formatDate(student.enrollment.enrolled_at)}</Cell>
          <Cell>
            <GradeInput
              value={student.enrollment.grade}
              onChange={(grade) => updateGrade(student.id, grade)}
            />
          </Cell>
          <Cell>
            <ActionMenu>
              <MenuItem onClick={() => viewStudent(student.id)}>
                View Profile
              </MenuItem>
              <MenuItem onClick={() => emailStudent(student.id)}>
                Send Email
              </MenuItem>
              <MenuItem
                onClick={() => removeStudent(student.id)}
                color="error"
              >
                Remove from Course
              </MenuItem>
            </ActionMenu>
          </Cell>
        </StudentRow>
      ))}
    </TableBody>
  </StudentTable>
  
  {roster.waitlist.length > 0 && (
    <WaitlistSection>
      <SectionTitle>Waitlist ({roster.waitlist.length})</SectionTitle>
      <WaitlistTable>
        {roster.waitlist.map((entry, index) => (
          <WaitlistRow key={entry.student.id}>
            <Position>{index + 1}</Position>
            <StudentInfo>
              {entry.student.name} ({entry.student.email})
            </StudentInfo>
            <JoinedAt>
              Joined {formatRelativeTime(entry.joined_at)}
            </JoinedAt>
            <Button
              onClick={() => promoteFromWaitlist(entry.student.id)}
              size="small"
            >
              Add to Course
            </Button>
          </WaitlistRow>
        ))}
      </WaitlistTable>
    </WaitlistSection>
  )}
</RosterManagement>
```

## 4. Waitlist Management

### 4.1 Waitlist Algorithm

```python
class WaitlistManager:
    async def add_to_waitlist(self, student_id: str, course_id: str) -> WaitlistEntry:
        # Get next position
        max_position = await db.query(
            func.max(Waitlist.position)
        ).filter(
            Waitlist.course_id == course_id
        ).scalar() or 0
        
        entry = Waitlist(
            course_id=course_id,
            student_id=student_id,
            position=max_position + 1,
            expires_at=datetime.utcnow() + timedelta(hours=48)
        )
        
        await db.add(entry)
        await db.commit()
        
        return entry
    
    async def process_enrollment_drop(self, enrollment_id: str):
        enrollment = await get_enrollment(enrollment_id)
        course = await get_course(enrollment.course_id)
        
        # Check if there's a waitlist
        next_student = await db.query(Waitlist).filter(
            Waitlist.course_id == course.id,
            Waitlist.position == 1
        ).first()
        
        if next_student:
            # Notify student
            await self.notify_waitlist_opening(next_student)
            
            # Set expiration for response
            next_student.notified_at = datetime.utcnow()
            next_student.expires_at = datetime.utcnow() + timedelta(hours=48)
            
            await db.commit()
```

### 4.2 Waitlist Notifications

```python
async def notify_waitlist_opening(waitlist_entry: Waitlist):
    student = await get_user(waitlist_entry.student_id)
    course = await get_course(waitlist_entry.course_id)
    
    await send_email(
        to=student.email,
        subject=f"Spot available in {course.code} - {course.title}",
        template="waitlist_opening",
        context={
            "student_name": student.name,
            "course": course,
            "expires_at": waitlist_entry.expires_at,
            "enrollment_link": generate_enrollment_link(course.id)
        }
    )
```

## 5. Implementation Phases

### Phase 1: Core Enrollment
1. Basic enrollment with access codes
2. Course discovery and search
3. Student dashboard with enrolled courses
4. Professor roster view
5. Simple capacity tracking

### Phase 2: Advanced Features
1. Waitlist functionality
2. Prerequisite checking
3. Schedule conflict detection
4. Bulk enrollment operations
5. Enrollment history tracking

### Phase 3: Optimization & Intelligence
1. Smart course recommendations
2. Enrollment pattern analytics
3. Automated waitlist management
4. Shopping cart functionality
5. Registration periods and priorities

## 6. Business Rules

### 6.1 Enrollment Rules
- Cannot enroll in same course twice
- Must use valid enrollment code for private courses
- Cannot exceed course capacity unless overridden
- Enrollment window enforcement (if configured)

### 6.2 Waitlist Rules
- First-come, first-served ordering
- 48-hour response window when notified
- Automatic position adjustment when students leave
- Maximum waitlist size (configurable per course)

### 6.3 Drop/Withdrawal Rules
- Can drop course before drop deadline
- Withdrawal after deadline shows on transcript
- Refund policies based on drop date
- Automatic waitlist promotion on drop

## 7. Performance Optimization

### 7.1 Caching Strategy
```python
class EnrollmentCache:
    def __init__(self):
        self.redis = redis.Redis()
    
    async def get_enrollment_count(self, course_id: str) -> int:
        cached = self.redis.get(f"enrollment_count:{course_id}")
        if cached:
            return int(cached)
        
        count = await db.query(StudentCourseLink).filter(
            StudentCourseLink.course_id == course_id,
            StudentCourseLink.enrollment_status == EnrollmentStatus.ACTIVE
        ).count()
        
        self.redis.setex(
            f"enrollment_count:{course_id}",
            300,  # 5 minute TTL
            count
        )
        
        return count
```

### 7.2 Search Optimization
```sql
-- Full-text search index
CREATE INDEX idx_course_search ON courses 
USING gin(to_tsvector('english', 
    title || ' ' || code || ' ' || coalesce(description, '')
));

-- Composite index for common queries
CREATE INDEX idx_courses_discover ON courses(
    semester, status, deleted_at
) WHERE deleted_at IS NULL;
```

## 8. Security & Privacy

### 8.1 Access Control
- Students can only view their own enrollments
- Professors can only manage their own course rosters
- Enrollment codes expire after semester ends
- Rate limiting on enrollment attempts

### 8.2 Data Privacy
- Student emails hidden from other students
- Grade information restricted to student and professor
- FERPA compliance for educational records
- Audit trail for all enrollment changes

## 9. Integration Points

### 9.1 Event System Integration

#### Enrollment Events Published
```python
class EnrollmentEvent(Enum):
    STUDENT_ENROLLED = "enrollment.student_enrolled"
    STUDENT_UNENROLLED = "enrollment.student_unenrolled"
    STUDENT_WAITLISTED = "enrollment.student_waitlisted"
    STUDENT_PROMOTED_FROM_WAITLIST = "enrollment.student_promoted_from_waitlist"
    ENROLLMENT_CAPACITY_REACHED = "enrollment.capacity_reached"
    ENROLLMENT_REOPENED = "enrollment.reopened"
    DUPLICATE_ENROLLMENT_PREVENTED = "enrollment.duplicate_prevented"

@dataclass
class StudentEnrolledEvent:
    student_id: str
    course_id: str
    enrollment_id: str
    enrollment_method: str
    timestamp: datetime
    # Triggers: Calendar sync, notification, grade setup, analytics

@dataclass
class StudentUnenrolledEvent:
    student_id: str
    course_id: str
    enrollment_id: str
    reason: str
    timestamp: datetime
    # Triggers: Calendar cleanup, waitlist promotion, grade cleanup

@dataclass
class StudentWaitlistedEvent:
    student_id: str
    course_id: str
    waitlist_position: int
    timestamp: datetime
    # Triggers: Notification to student, analytics tracking
```

### 9.2 Calendar Integration
- Automatically add course schedule to calendar on enrollment
- Remove events when dropping course
- Update calendar when schedule changes

### 9.3 Notification System
- Enrollment confirmation emails
- Waitlist notifications
- Course change alerts
- Drop deadline reminders

### 9.4 Grade Projection
- Link enrollments to grade entries
- Track course progress
- Calculate GPA impact

## 10. Success Metrics

### 10.1 Usage Metrics
- Course discovery conversion rate
- Average time to enroll
- Waitlist conversion rate
- Drop rate by week

### 10.2 System Metrics
- Search response time < 200ms
- Enrollment transaction time < 1s
- Concurrent enrollment handling
- Zero enrollment conflicts

### 10.3 Business Metrics
- Student satisfaction scores
- Course fill rates
- Waitlist effectiveness
- Schedule optimization rate