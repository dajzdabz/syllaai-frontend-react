# Calendar Integration Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
A seamless calendar integration system that automatically synchronizes academic schedules with Google Calendar, providing students and professors with a unified view of their academic commitments while supporting multiple calendar views and intelligent conflict detection.

### 1.2 Core Capabilities
- Google Calendar bidirectional synchronization
- Multiple calendar views (Month, Week, Agenda)
- Automatic event generation from course schedules
- Conflict detection and resolution
- Event categorization and color coding
- Recurring event management

## 2. Technical Architecture

### 2.1 Data Models

#### Calendar Integration Model
```python
class GoogleCalendarIntegration(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    google_calendar_id = Column(String(255), nullable=False)
    calendar_name = Column(String(255))
    sync_enabled = Column(Boolean, default=True)
    sync_direction = Column(Enum(SyncDirection), default=SyncDirection.TO_GOOGLE)
    last_sync_at = Column(DateTime)
    sync_token = Column(String(255))  # For incremental sync
    sync_errors = Column(ARRAY(String))
    settings = Column(JSONB, default=dict)
    
    # Integration fields for feature coordination
    course_id = Column(UUID, ForeignKey('courses.id'), nullable=True)  # For course-specific calendars
    auto_sync_enabled = Column(Boolean, default=True)  # Auto-sync on course changes
    notification_sync_enabled = Column(Boolean, default=True)  # Sync reminder notifications
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships for cross-feature integration
    user = relationship("User", back_populates="calendar_integrations")
    course = relationship("Course", back_populates="calendar_integrations")
    event_mappings = relationship("CalendarEventMapping", back_populates="integration", cascade="all, delete-orphan")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('user_id', 'google_calendar_id'),
    )

class SyncDirection(Enum):
    TO_GOOGLE = "to_google"          # One-way: SyllabAI → Google
    FROM_GOOGLE = "from_google"      # One-way: Google → SyllabAI
    BIDIRECTIONAL = "bidirectional"  # Two-way sync
```

#### Calendar Event Mapping
```python
class CalendarEventMapping(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    course_event_id = Column(UUID, ForeignKey('course_events.id'), nullable=False)
    integration_id = Column(UUID, ForeignKey('google_calendar_integrations.id'), nullable=False)
    google_event_id = Column(String(255), unique=True)
    google_calendar_id = Column(String(255))
    last_synced_at = Column(DateTime)
    sync_status = Column(Enum(SyncStatus), default=SyncStatus.PENDING)
    sync_errors = Column(ARRAY(String))
    
    # Grade projection integration
    reminder_notifications_sent = Column(Boolean, default=False)
    notification_ids = Column(ARRAY(UUID))  # Track related notifications
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    course_event = relationship("CourseEvent", back_populates="calendar_mappings")
    integration = relationship("GoogleCalendarIntegration", back_populates="event_mappings")
    
class SyncStatus(Enum):
    SYNCED = "synced"
    PENDING = "pending"
    CONFLICT = "conflict"
    ERROR = "error"
```

### 2.2 Google Calendar API Integration

#### Authentication Flow
```python
class GoogleCalendarService:
    def __init__(self):
        self.credentials_file = settings.GOOGLE_CREDENTIALS_FILE
        self.scopes = ['https://www.googleapis.com/auth/calendar']
    
    async def authorize_user(self, auth_code: str) -> dict:
        flow = Flow.from_client_secrets_file(
            self.credentials_file,
            scopes=self.scopes
        )
        flow.fetch_token(code=auth_code)
        
        # Store credentials
        credentials = flow.credentials
        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'expiry': credentials.expiry
        }
```

#### Event Synchronization
```python
class EventSynchronizer:
    async def sync_to_google(self, course_event: CourseEvent, calendar_id: str):
        google_event = {
            'summary': course_event.title,
            'description': self._build_description(course_event),
            'location': course_event.location,
            'start': {
                'dateTime': course_event.start_datetime.isoformat(),
                'timeZone': course_event.timezone
            },
            'end': {
                'dateTime': course_event.end_datetime.isoformat(),
                'timeZone': course_event.timezone
            },
            'colorId': self._get_color_id(course_event.event_type),
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 15},
                    {'method': 'email', 'minutes': 60}
                ]
            }
        }
        
        # Handle recurring events
        if course_event.recurring_pattern:
            google_event['recurrence'] = self._build_recurrence_rule(
                course_event.recurring_pattern
            )
        
        return await self.calendar_service.events().insert(
            calendarId=calendar_id,
            body=google_event
        ).execute()
```

### 2.3 API Endpoints

#### Calendar Integration Endpoints

**POST /api/integrations/google/authorize**
```json
// Request
{
  "auth_code": "4/0AdQt8qh...",
  "redirect_uri": "https://syllaai.com/calendar/callback"
}

// Response
{
  "integration_id": "550e8400-e29b-41d4-a716-446655440000",
  "calendars": [
    {
      "id": "primary",
      "summary": "Personal Calendar",
      "primary": true,
      "accessRole": "owner"
    },
    {
      "id": "school_calendar@group.calendar.google.com",
      "summary": "School Calendar",
      "primary": false,
      "accessRole": "writer"
    }
  ]
}
```

**GET /api/integrations/google/calendars**
```json
{
  "calendars": [
    {
      "id": "primary",
      "summary": "Personal Calendar",
      "description": "My primary Google Calendar",
      "primary": true,
      "accessRole": "owner",
      "backgroundColor": "#4285f4",
      "foregroundColor": "#ffffff",
      "selected": true,
      "syncEnabled": true
    }
  ]
}
```

**POST /api/integrations/google/sync**
```json
// Request
{
  "calendar_id": "primary",
  "course_ids": ["course_uuid_1", "course_uuid_2"],
  "event_types": ["class", "assignment", "exam"],
  "sync_direction": "bidirectional",
  "options": {
    "include_past_events": false,
    "create_separate_calendar": false,
    "color_by_course": true
  }
}

// Response
{
  "sync_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "in_progress",
  "events_queued": 45,
  "estimated_time": 30
}
```

#### Calendar View Endpoints

**GET /api/calendar/events**
```json
// Query Parameters
{
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "view": "month",
  "course_ids": ["id1", "id2"],
  "event_types": ["class", "exam"]
}

// Response
{
  "events": [
    {
      "id": "event_uuid",
      "title": "CS 101 - Lecture",
      "start": "2025-01-15T10:00:00Z",
      "end": "2025-01-15T10:50:00Z",
      "allDay": false,
      "course": {
        "id": "course_uuid",
        "title": "Introduction to Computer Science",
        "code": "CS 101",
        "color": "#4285f4"
      },
      "type": "class",
      "location": "Science Hall 204",
      "description": "Chapter 3: Data Structures",
      "recurring": true,
      "google_event_id": "google_event_123"
    }
  ],
  "conflicts": [
    {
      "event1_id": "event_uuid_1",
      "event2_id": "event_uuid_2",
      "overlap_minutes": 30
    }
  ]
}
```

## 3. User Interface Components

### 3.1 Calendar Views

#### Month View
```jsx
<MonthView>
  <CalendarHeader>
    <NavigationButtons>
      <IconButton onClick={previousMonth}>
        <ChevronLeftIcon />
      </IconButton>
      <MonthYearPicker 
        value={currentMonth}
        onChange={setCurrentMonth}
      />
      <IconButton onClick={nextMonth}>
        <ChevronRightIcon />
      </IconButton>
    </NavigationButtons>
    <ViewToggle 
      views={['month', 'week', 'agenda']}
      currentView="month"
      onChange={setView}
    />
  </CalendarHeader>
  
  <CalendarGrid>
    <WeekDayHeaders />
    <MonthDays>
      {days.map(day => (
        <DayCell 
          date={day}
          events={getEventsForDay(day)}
          isToday={isToday(day)}
          isCurrentMonth={isCurrentMonth(day)}
          onClick={() => selectDay(day)}
        />
      ))}
    </MonthDays>
  </CalendarGrid>
</MonthView>
```

#### Week View
```jsx
<WeekView>
  <TimeGrid>
    <TimeColumn>
      {hours.map(hour => (
        <TimeSlot key={hour}>{formatHour(hour)}</TimeSlot>
      ))}
    </TimeColumn>
    
    <DayColumns>
      {weekDays.map(day => (
        <DayColumn key={day.date}>
          <DayHeader>{formatDayHeader(day)}</DayHeader>
          <EventContainer>
            {getEventsForDay(day.date).map(event => (
              <EventBlock
                event={event}
                style={calculateEventPosition(event)}
                onClick={() => selectEvent(event)}
              />
            ))}
          </EventContainer>
        </DayColumn>
      ))}
    </DayColumns>
    
    <CurrentTimeIndicator time={currentTime} />
  </TimeGrid>
</WeekView>
```

#### Agenda View
```jsx
<AgendaView>
  <DateGroupedList>
    {groupedEvents.map(group => (
      <DateSection key={group.date}>
        <DateHeader>
          <DateLabel>{formatDate(group.date)}</DateLabel>
          <EventCount>{group.events.length} events</EventCount>
        </DateHeader>
        
        <EventList>
          {group.events.map(event => (
            <AgendaEvent>
              <TimeRange>
                {formatTime(event.start)} - {formatTime(event.end)}
              </TimeRange>
              <EventDetails>
                <EventTitle>{event.title}</EventTitle>
                <EventMeta>
                  <CourseChip color={event.course.color}>
                    {event.course.code}
                  </CourseChip>
                  <LocationText>{event.location}</LocationText>
                </EventMeta>
              </EventDetails>
              <EventActions>
                <IconButton onClick={() => editEvent(event)}>
                  <EditIcon />
                </IconButton>
              </EventActions>
            </AgendaEvent>
          ))}
        </EventList>
      </DateSection>
    ))}
  </DateGroupedList>
</AgendaView>
```

### 3.2 Google Calendar Setup

#### Integration Wizard
```jsx
<CalendarIntegrationWizard>
  <Step title="Connect Google Calendar">
    <GoogleAuthButton onClick={initiateGoogleAuth}>
      <GoogleIcon />
      Connect Google Calendar
    </GoogleAuthButton>
    <InfoText>
      We'll need permission to create and manage calendar events
    </InfoText>
  </Step>
  
  <Step title="Select Calendar">
    <CalendarList>
      {calendars.map(calendar => (
        <CalendarOption>
          <RadioButton 
            checked={selectedCalendar === calendar.id}
            onChange={() => setSelectedCalendar(calendar.id)}
          />
          <CalendarInfo>
            <CalendarName>{calendar.summary}</CalendarName>
            {calendar.primary && <PrimaryBadge>Primary</PrimaryBadge>}
          </CalendarInfo>
        </CalendarOption>
      ))}
    </CalendarList>
    <CreateNewOption>
      <Checkbox 
        checked={createNewCalendar}
        onChange={setCreateNewCalendar}
      />
      Create a new "SyllabAI" calendar
    </CreateNewOption>
  </Step>
  
  <Step title="Sync Settings">
    <SyncOptions>
      <Select 
        label="Sync Direction"
        value={syncDirection}
        options={[
          { value: 'to_google', label: 'SyllabAI → Google only' },
          { value: 'bidirectional', label: 'Two-way sync' }
        ]}
      />
      <MultiSelect
        label="Event Types to Sync"
        value={eventTypes}
        options={['Classes', 'Assignments', 'Exams', 'Other']}
      />
      <Switch 
        label="Color events by course"
        checked={colorByCourse}
      />
    </SyncOptions>
  </Step>
</CalendarIntegrationWizard>
```

### 3.3 Event Management

#### Event Creation Modal
```jsx
<EventModal>
  <Form>
    <TextField 
      label="Event Title"
      value={event.title}
      required
    />
    
    <CourseSelect
      label="Course"
      value={event.course_id}
      courses={userCourses}
    />
    
    <EventTypeSelect
      value={event.type}
      onChange={setEventType}
    />
    
    <DateTimeSection>
      <DateTimePicker 
        label="Start"
        value={event.start}
      />
      <DateTimePicker 
        label="End"
        value={event.end}
      />
      <Switch 
        label="All day"
        checked={event.allDay}
      />
    </DateTimeSection>
    
    <TextField 
      label="Location"
      value={event.location}
    />
    
    <RecurringSection>
      <Switch 
        label="Repeat"
        checked={isRecurring}
      />
      {isRecurring && (
        <RecurrenceEditor
          pattern={event.recurrence}
          onChange={setRecurrence}
        />
      )}
    </RecurringSection>
    
    <ReminderSection>
      <ReminderList 
        reminders={event.reminders}
        onAdd={addReminder}
        onRemove={removeReminder}
      />
    </ReminderSection>
  </Form>
</EventModal>
```

### 3.4 Conflict Detection

#### Conflict Resolution UI
```jsx
<ConflictModal>
  <ConflictHeader>
    <WarningIcon color="warning" />
    <Title>Schedule Conflict Detected</Title>
  </ConflictHeader>
  
  <ConflictDetails>
    <ConflictDescription>
      The event you're trying to create conflicts with:
    </ConflictDescription>
    
    <ConflictingEvents>
      {conflicts.map(conflict => (
        <EventCard>
          <EventInfo>
            <EventTitle>{conflict.title}</EventTitle>
            <EventTime>
              {formatDateTime(conflict.start)} - {formatTime(conflict.end)}
            </EventTime>
          </EventInfo>
          <OverlapBadge>
            {conflict.overlapMinutes} min overlap
          </OverlapBadge>
        </EventCard>
      ))}
    </ConflictingEvents>
  </ConflictDetails>
  
  <ConflictActions>
    <Button onClick={createAnyway} variant="outlined">
      Create Anyway
    </Button>
    <Button onClick={adjustTime} variant="contained">
      Adjust Time
    </Button>
    <Button onClick={cancel} variant="text">
      Cancel
    </Button>
  </ConflictActions>
</ConflictModal>
```

## 4. Synchronization Logic

### 4.1 Sync Algorithm

```python
class CalendarSyncEngine:
    async def perform_sync(self, integration: GoogleCalendarIntegration):
        try:
            # 1. Fetch changes from Google Calendar
            google_changes = await self._fetch_google_changes(
                integration.google_calendar_id,
                integration.sync_token
            )
            
            # 2. Fetch local changes since last sync
            local_changes = await self._fetch_local_changes(
                integration.user_id,
                integration.last_sync_at
            )
            
            # 3. Detect and resolve conflicts
            conflicts = self._detect_conflicts(google_changes, local_changes)
            resolved_changes = await self._resolve_conflicts(conflicts)
            
            # 4. Apply changes based on sync direction
            if integration.sync_direction in [SyncDirection.TO_GOOGLE, SyncDirection.BIDIRECTIONAL]:
                await self._sync_to_google(resolved_changes.local_to_google)
            
            if integration.sync_direction in [SyncDirection.FROM_GOOGLE, SyncDirection.BIDIRECTIONAL]:
                await self._sync_from_google(resolved_changes.google_to_local)
            
            # 5. Update sync metadata
            integration.last_sync_at = datetime.utcnow()
            integration.sync_token = google_changes.next_sync_token
            await db.commit()
            
        except Exception as e:
            await self._handle_sync_error(integration, e)
```

### 4.2 Conflict Resolution

```python
class ConflictResolver:
    def resolve_conflicts(self, conflicts: List[ConflictPair]) -> ResolvedChanges:
        resolved = ResolvedChanges()
        
        for conflict in conflicts:
            # Time-based resolution (most recent wins)
            if conflict.google_event.updated > conflict.local_event.updated_at:
                resolved.google_to_local.append(conflict.google_event)
            else:
                resolved.local_to_google.append(conflict.local_event)
        
        return resolved
```

## 5. Event Color Coding

### 5.1 Color Assignment

```python
class ColorManager:
    # Google Calendar color IDs
    COLORS = {
        'blue': '1',
        'green': '2',
        'purple': '3',
        'red': '4',
        'yellow': '5',
        'orange': '6',
        'turquoise': '7',
        'gray': '8',
        'bold_blue': '9',
        'bold_green': '10',
        'bold_red': '11'
    }
    
    def assign_course_color(self, course_index: int) -> str:
        color_list = list(self.COLORS.values())
        return color_list[course_index % len(color_list)]
```

## 6. Implementation Phases

### Phase 1: Basic Calendar Integration
1. Google Calendar OAuth setup
2. One-way sync (SyllabAI → Google)
3. Basic calendar views (Month, Week)
4. Event creation and editing
5. Course-based color coding

### Phase 2: Advanced Sync Features
1. Bidirectional synchronization
2. Conflict detection and resolution
3. Recurring event support
4. Multiple calendar support
5. Sync status dashboard

### Phase 3: Enhanced Calendar Features
1. Agenda view and day view
2. Calendar sharing between users
3. iCal feed generation
4. Outlook calendar support
5. Mobile calendar widgets

## 7. Performance Optimization

### 7.1 Caching Strategy

```python
class CalendarCache:
    def __init__(self):
        self.redis_client = redis.Redis()
        self.ttl = 300  # 5 minutes
    
    async def get_events(self, user_id: str, date_range: tuple) -> List[Event]:
        cache_key = f"calendar:{user_id}:{date_range[0]}:{date_range[1]}"
        cached = self.redis_client.get(cache_key)
        
        if cached:
            return json.loads(cached)
        
        events = await self._fetch_events(user_id, date_range)
        self.redis_client.setex(
            cache_key, 
            self.ttl, 
            json.dumps(events)
        )
        
        return events
```

### 7.2 Batch Operations

```python
async def batch_create_events(events: List[CourseEvent], calendar_id: str):
    batch = service.new_batch_http_request()
    
    for event in events:
        google_event = convert_to_google_event(event)
        batch.add(
            service.events().insert(
                calendarId=calendar_id,
                body=google_event
            )
        )
    
    return await batch.execute()
```

## 8. Error Handling

### 8.1 Sync Errors

```json
{
  "error": {
    "code": "SYNC_FAILED",
    "message": "Calendar synchronization failed",
    "details": {
      "calendar_id": "primary",
      "error_type": "QUOTA_EXCEEDED",
      "retry_after": 3600
    }
  }
}
```

### 8.2 Recovery Strategies

```python
class SyncErrorHandler:
    async def handle_sync_error(self, error: Exception, integration: GoogleCalendarIntegration):
        if isinstance(error, QuotaExceededError):
            # Implement exponential backoff
            await self.schedule_retry(integration, delay=3600)
        
        elif isinstance(error, AuthenticationError):
            # Mark integration for re-authentication
            integration.sync_enabled = False
            await self.notify_user_reauth_required(integration.user_id)
        
        else:
            # Log error and notify admin
            await self.log_sync_error(error, integration)
```

## 9. Security & Privacy

### 9.1 Data Protection
- OAuth tokens encrypted at rest
- Minimal calendar permissions requested
- No storage of Google Calendar data
- User control over sync direction

### 9.2 Permission Scopes
```python
GOOGLE_CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',  # Read/write events
    'https://www.googleapis.com/auth/calendar.readonly' # List calendars
]
```

## 10. Integration Points

### 10.1 User Authentication Integration

#### Google OAuth Token Management
```python
async def setup_calendar_integration(user: User, auth_code: str) -> GoogleCalendarIntegration:
    """Setup calendar integration using existing Google OAuth tokens"""
    
    # Verify user has Google OAuth permissions
    if not user.google_refresh_token:
        raise HTTPException(400, "Google authentication required")
    
    # Use existing tokens from User Authentication feature
    calendar_service = GoogleCalendarService(
        access_token=decrypt(user.google_access_token),
        refresh_token=decrypt(user.google_refresh_token)
    )
    
    # Create calendar integration
    integration = GoogleCalendarIntegration(
        user_id=user.id,
        google_calendar_id="primary",  # Default to primary calendar
        sync_enabled=user.calendar_sync_enabled
    )
    
    await db.add(integration)
    await db.commit()
    
    # Publish integration event
    await event_bus.publish(CalendarEvent.INTEGRATION_CREATED, {
        'user_id': user.id,
        'integration_id': integration.id,
        'calendar_id': integration.google_calendar_id
    })
    
    return integration

async def refresh_calendar_tokens(integration: GoogleCalendarIntegration):
    """Refresh calendar tokens using User Authentication system"""
    user = await get_user(integration.user_id)
    
    # Update user's Google tokens (managed by User Authentication)
    new_tokens = await refresh_google_tokens(user)
    
    # Update user record
    user.google_access_token = encrypt(new_tokens['access_token'])
    user.google_token_expires_at = new_tokens['expires_at']
    await db.commit()
```

### 10.2 Course Management Integration

#### Automatic Course Calendar Setup
```python
@event_handler("course.created")
async def on_course_created(event_data: dict):
    """Automatically set up calendar integration when course is created"""
    course_id = event_data['course_id']
    instructor_id = event_data['instructor_id']
    
    instructor = await get_user(instructor_id)
    if not instructor.calendar_sync_enabled:
        return
    
    # Create dedicated calendar for the course
    course = await get_course(course_id)
    calendar_service = GoogleCalendarService(instructor)
    
    course_calendar = await calendar_service.create_calendar({
        'summary': f"{course.code} - {course.title}",
        'description': f"Calendar for {course.title} course events",
        'timeZone': instructor.timezone or 'UTC'
    })
    
    # Create calendar integration for the course
    integration = GoogleCalendarIntegration(
        user_id=instructor_id,
        course_id=course_id,
        google_calendar_id=course_calendar['id'],
        calendar_name=course_calendar['summary'],
        auto_sync_enabled=True
    )
    
    await db.add(integration)
    
    # Sync existing course events
    for event in course.events:
        await sync_course_event_to_calendar(event, integration)
    
    await db.commit()

@event_handler("course.schedule_changed")
async def on_schedule_changed(event_data: dict):
    """Update calendar when course schedule changes"""
    course_id = event_data['course_id']
    
    # Find all calendar integrations for this course
    integrations = await db.query(GoogleCalendarIntegration).filter(
        GoogleCalendarIntegration.course_id == course_id,
        GoogleCalendarIntegration.auto_sync_enabled == True
    ).all()
    
    for integration in integrations:
        await sync_course_schedule_changes(integration, event_data)

async def sync_course_event_to_calendar(course_event: CourseEvent, integration: GoogleCalendarIntegration):
    """Sync individual course event to Google Calendar"""
    calendar_service = GoogleCalendarService(integration.user)
    
    google_event = {
        'summary': f"{course_event.course.code} - {course_event.title}",
        'description': build_event_description(course_event),
        'location': course_event.location,
        'start': {
            'dateTime': course_event.start_datetime.isoformat(),
            'timeZone': integration.user.timezone or 'UTC'
        },
        'end': {
            'dateTime': course_event.end_datetime.isoformat(),
            'timeZone': integration.user.timezone or 'UTC'
        },
        'colorId': get_event_color(course_event.event_type),
        'extendedProperties': {
            'private': {
                'syllaai_event_id': str(course_event.id),
                'syllaai_course_id': str(course_event.course_id),
                'event_type': course_event.event_type.value
            }
        }
    }
    
    # Handle recurring events
    if course_event.recurring_pattern:
        google_event['recurrence'] = build_recurrence_rule(course_event.recurring_pattern)
    
    created_event = await calendar_service.create_event(
        integration.google_calendar_id,
        google_event
    )
    
    # Create mapping
    mapping = CalendarEventMapping(
        course_event_id=course_event.id,
        integration_id=integration.id,
        google_event_id=created_event['id'],
        google_calendar_id=integration.google_calendar_id,
        sync_status=SyncStatus.SYNCED,
        last_synced_at=datetime.utcnow()
    )
    
    await db.add(mapping)
    await db.commit()
```

### 10.3 Student Enrollment Integration

#### Student Calendar Sync on Enrollment
```python
@event_handler("enrollment.student_enrolled")
async def on_student_enrolled(event_data: dict):
    """Sync course events to student's calendar when they enroll"""
    student_id = event_data['student_id']
    course_id = event_data['course_id']
    
    student = await get_user(student_id)
    if not student.calendar_sync_enabled:
        return
    
    course = await get_course(course_id)
    
    # Find or create calendar integration for student
    integration = await get_or_create_student_integration(student)
    
    # Sync all course events to student's calendar
    for event in course.events:
        await sync_event_for_student(event, integration, student)

@event_handler("enrollment.student_unenrolled")
async def on_student_unenrolled(event_data: dict):
    """Remove course events from student's calendar when they unenroll"""
    student_id = event_data['student_id']
    course_id = event_data['course_id']
    
    # Find all calendar mappings for this student and course
    mappings = await db.query(CalendarEventMapping).join(
        GoogleCalendarIntegration
    ).filter(
        GoogleCalendarIntegration.user_id == student_id,
        CalendarEventMapping.course_event.has(CourseEvent.course_id == course_id)
    ).all()
    
    calendar_service = GoogleCalendarService(await get_user(student_id))
    
    for mapping in mappings:
        # Delete from Google Calendar
        try:
            await calendar_service.delete_event(
                mapping.google_calendar_id,
                mapping.google_event_id
            )
        except Exception as e:
            # Log error but continue cleanup
            logger.warning(f"Failed to delete calendar event {mapping.google_event_id}: {e}")
        
        # Delete mapping
        await db.delete(mapping)
    
    await db.commit()

async def sync_event_for_student(course_event: CourseEvent, integration: GoogleCalendarIntegration, student: User):
    """Sync a course event to student's personal calendar"""
    calendar_service = GoogleCalendarService(student)
    
    google_event = {
        'summary': f"{course_event.course.code} - {course_event.title}",
        'description': f"{course_event.description}\n\nCourse: {course_event.course.title}\nInstructor: {course_event.course.instructor.name}",
        'location': course_event.location,
        'start': {
            'dateTime': course_event.start_datetime.isoformat(),
            'timeZone': student.timezone or 'UTC'
        },
        'end': {
            'dateTime': course_event.end_datetime.isoformat(),
            'timeZone': student.timezone or 'UTC'
        },
        'colorId': get_course_color(course_event.course),
        'reminders': {
            'useDefault': False,
            'overrides': get_student_reminder_preferences(student, course_event)
        }
    }
    
    created_event = await calendar_service.create_event(
        integration.google_calendar_id,
        google_event
    )
    
    # Create mapping
    mapping = CalendarEventMapping(
        course_event_id=course_event.id,
        integration_id=integration.id,
        google_event_id=created_event['id'],
        google_calendar_id=integration.google_calendar_id,
        sync_status=SyncStatus.SYNCED,
        last_synced_at=datetime.utcnow()
    )
    
    await db.add(mapping)
```

### 10.4 Notifications Integration

#### Calendar Reminder Sync
```python
@event_handler(NotificationEvent.ASSIGNMENT_REMINDER_SCHEDULED)
async def on_assignment_reminder_scheduled(event_data: dict):
    """Sync assignment reminders with calendar reminders"""
    notification_id = event_data['notification_id']
    course_event_id = event_data['course_event_id']
    user_id = event_data['user_id']
    
    # Find calendar mapping for this event
    mapping = await db.query(CalendarEventMapping).filter(
        CalendarEventMapping.course_event_id == course_event_id,
        CalendarEventMapping.integration.has(GoogleCalendarIntegration.user_id == user_id)
    ).first()
    
    if not mapping:
        return  # No calendar integration
    
    # Update Google Calendar event with reminder
    calendar_service = GoogleCalendarService(await get_user(user_id))
    
    notification = await get_notification(notification_id)
    reminder_minutes = calculate_reminder_minutes(notification.scheduled_for, mapping.course_event.start_datetime)
    
    await calendar_service.update_event_reminders(
        mapping.google_calendar_id,
        mapping.google_event_id,
        [{'method': 'popup', 'minutes': reminder_minutes}]
    )
    
    # Track notification in mapping
    if not mapping.notification_ids:
        mapping.notification_ids = []
    mapping.notification_ids.append(notification_id)
    mapping.reminder_notifications_sent = True
    
    await db.commit()

async def sync_notification_preferences_to_calendar(user: User):
    """Sync user's notification preferences to their calendar reminders"""
    preferences = await get_user_notification_preferences(user.id)
    integrations = await get_user_calendar_integrations(user.id)
    
    for integration in integrations:
        mappings = await get_integration_event_mappings(integration.id)
        
        for mapping in mappings:
            course_event = mapping.course_event
            
            # Get user's preference for this event type
            pref = preferences.get(f"{course_event.event_type}_reminder", {})
            if not pref.get('enabled', True):
                continue
            
            # Calculate reminder time based on preferences
            reminder_minutes = pref.get('timing_offset', 60)  # Default 1 hour
            
            # Update calendar event reminder
            await update_calendar_event_reminder(
                integration,
                mapping,
                reminder_minutes
            )
```

### 10.5 Grade Projection Integration

#### Grade-Related Event Highlighting
```python
async def sync_grade_events_to_calendar(course: Course, student: User):
    """Sync graded events with special highlighting for grade projection"""
    integration = await get_student_calendar_integration(student.id)
    if not integration:
        return
    
    calendar_service = GoogleCalendarService(student)
    
    for event in course.events:
        if not event.grade_category:
            continue  # Skip non-graded events
        
        # Get student's grade for this event
        grade_entry = await get_student_grade_entry(student.id, event.id)
        
        # Determine calendar event properties based on grade status
        if grade_entry and not grade_entry.is_projected:
            # Grade has been entered
            color_id = '10'  # Bold green for completed
            summary_prefix = "✓ "
        elif grade_entry and grade_entry.is_projected:
            # Projected grade exists
            color_id = '5'   # Yellow for projected
            summary_prefix = "📊 "
        else:
            # No grade yet
            color_id = '4'   # Red for pending
            summary_prefix = "❓ "
        
        google_event = {
            'summary': f"{summary_prefix}{course.code} - {event.title}",
            'description': build_grade_event_description(event, grade_entry),
            'colorId': color_id,
            'extendedProperties': {
                'private': {
                    'grade_category': event.grade_category,
                    'weight_percentage': str(event.weight_percentage or 0),
                    'points_possible': str(event.points_possible or 0),
                    'has_grade': str(bool(grade_entry and not grade_entry.is_projected))
                }
            }
        }
        
        # Update existing calendar event or create new one
        mapping = await get_event_mapping(event.id, integration.id)
        if mapping:
            await calendar_service.update_event(
                mapping.google_calendar_id,
                mapping.google_event_id,
                google_event
            )
        else:
            # Create new calendar event
            await sync_course_event_to_calendar(event, integration)

@event_handler(GradeEvent.GRADE_ENTERED)
async def on_grade_entered(event_data: dict):
    """Update calendar event when grade is entered"""
    grade_entry_id = event_data['grade_entry_id']
    grade_entry = await get_grade_entry(grade_entry_id)
    
    await sync_grade_events_to_calendar(
        grade_entry.course,
        grade_entry.student
    )

def build_grade_event_description(event: CourseEvent, grade_entry: GradeEntry = None) -> str:
    """Build calendar event description with grade information"""
    description = event.description or ""
    
    description += f"\n\nCourse: {event.course.title}"
    description += f"\nInstructor: {event.course.instructor.name}"
    
    if event.grade_category:
        description += f"\nGrade Category: {event.grade_category.title()}"
        description += f"\nWeight: {event.weight_percentage or 0}%"
        description += f"\nPoints Possible: {event.points_possible or 'TBD'}"
    
    if grade_entry:
        if not grade_entry.is_projected:
            description += f"\n\n✓ Grade: {grade_entry.points_earned}/{grade_entry.points_possible}"
            description += f" ({(grade_entry.points_earned/grade_entry.points_possible*100):.1f}%)"
        else:
            description += f"\n\n📊 Projected Grade: {grade_entry.points_earned or 'TBD'}/{grade_entry.points_possible}"
    else:
        description += f"\n\n❓ Grade: Not yet entered"
    
    return description
```

### 10.6 Analytics Integration

#### Calendar Usage Analytics
```python
async def track_calendar_analytics(user: User, action: str, metadata: dict = None):
    """Track calendar integration analytics"""
    
    await analytics_service.track_event(
        user_id=user.id,
        event_type=f"calendar.{action}",
        event_data={
            'calendar_sync_enabled': user.calendar_sync_enabled,
            'timezone': user.timezone,
            'integration_count': await get_user_integration_count(user.id),
            'synced_events_count': await get_user_synced_events_count(user.id),
            **(metadata or {})
        }
    )

@event_handler(CalendarEvent.INTEGRATION_CREATED)
async def track_integration_created(event_data: dict):
    user = await get_user(event_data['user_id'])
    await track_calendar_analytics(user, 'integration_created', {
        'calendar_id': event_data['calendar_id'],
        'integration_method': 'google_oauth'
    })

@event_handler(CalendarEvent.EVENT_SYNCED)
async def track_event_synced(event_data: dict):
    user = await get_user(event_data['user_id'])
    await track_calendar_analytics(user, 'event_synced', {
        'event_type': event_data['event_type'],
        'sync_direction': event_data['sync_direction'],
        'sync_duration_ms': event_data.get('sync_duration_ms')
    })

class CalendarEvent(Enum):
    INTEGRATION_CREATED = "calendar.integration_created"
    INTEGRATION_DISABLED = "calendar.integration_disabled"
    INTEGRATION_REAUTHORIZED = "calendar.integration_reauthorized"
    EVENT_SYNCED = "calendar.event_synced"
    EVENT_SYNC_FAILED = "calendar.event_sync_failed"
    SYNC_COMPLETED = "calendar.sync_completed"
    SYNC_FAILED = "calendar.sync_failed"
    CONFLICT_DETECTED = "calendar.conflict_detected"
    CONFLICT_RESOLVED = "calendar.conflict_resolved"
```

### 10.7 Event System Integration

#### Calendar Events Published
```python
# Calendar events that other features can listen to
@dataclass
class CalendarIntegrationCreatedEvent:
    user_id: str
    integration_id: str
    calendar_id: str
    timestamp: datetime
    # Triggers: Welcome notification, initial sync, analytics tracking

@dataclass
class CalendarEventSyncedEvent:
    user_id: str
    course_event_id: str
    google_event_id: str
    sync_direction: str
    timestamp: datetime
    # Triggers: Analytics tracking, notification sync

@dataclass
class CalendarSyncFailedEvent:
    user_id: str
    integration_id: str
    error_type: str
    error_message: str
    timestamp: datetime
    # Triggers: Error notification, retry scheduling, admin alert
```

## 11. Success Metrics

### 11.1 Integration Metrics
- Calendar connection rate > 80%
- Sync success rate > 95%
- Average sync time < 30 seconds
- Conflict resolution rate > 90%

### 11.2 Usage Metrics
- Active calendar users > 70% of total users
- Events synced per user > 50 per semester
- Calendar view daily active users
- Mobile vs desktop calendar usage

### 11.3 Performance Metrics
- Calendar load time < 500ms
- Event creation < 1 second
- Sync completion < 30 seconds
- API quota usage < 80%

### 11.4 User Satisfaction Metrics
- Calendar integration satisfaction > 4.5/5
- Sync reliability satisfaction > 4.0/5
- Feature usage retention > 85%
- Support ticket rate < 2% of users