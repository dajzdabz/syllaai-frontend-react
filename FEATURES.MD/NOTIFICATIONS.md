# Notifications System Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
A comprehensive notification system that keeps students and professors informed about important academic events through intelligent, personalized, and timely communications across multiple channels including email, in-app notifications, and future push notifications.

### 1.2 Core Capabilities
- Smart assignment and exam reminders
- Course change notifications
- Enrollment and waitlist updates
- Calendar sync notifications
- Customizable notification preferences
- Multi-channel delivery (email, in-app, push)

## 2. Technical Architecture

### 2.1 Data Models

#### Notification Model
```python
class Notification(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL)
    
    # Context data
    course_id = Column(UUID, ForeignKey('courses.id'), nullable=True)
    event_id = Column(UUID, ForeignKey('course_events.id'), nullable=True)
    related_data = Column(JSONB, default=dict)
    
    # Delivery tracking
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    scheduled_for = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)
    
    # Metadata
    template_id = Column(String(100))
    external_id = Column(String(255))  # Email service provider ID
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

class NotificationType(Enum):
    ASSIGNMENT_REMINDER = "assignment_reminder"
    EXAM_REMINDER = "exam_reminder"
    COURSE_UPDATE = "course_update"
    ENROLLMENT_CONFIRMATION = "enrollment_confirmation"
    WAITLIST_UPDATE = "waitlist_update"
    CALENDAR_SYNC = "calendar_sync"
    GRADE_POSTED = "grade_posted"
    SCHEDULE_CHANGE = "schedule_change"

class NotificationChannel(Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    PUSH = "push"
    SMS = "sms"  # Future

class NotificationPriority(Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class NotificationStatus(Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    CANCELLED = "cancelled"
```

#### User Notification Preferences
```python
class NotificationPreference(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    enabled = Column(Boolean, default=True)
    timing_offset = Column(Integer, nullable=True)  # Minutes before event
    
    # Advanced preferences
    quiet_hours_start = Column(Time)
    quiet_hours_end = Column(Time)
    frequency_limit = Column(Integer)  # Max per day
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'notification_type', 'channel'),
    )
```

### 2.2 Notification Engine

#### Smart Notification Scheduler
```python
class NotificationScheduler:
    def __init__(self):
        self.celery = Celery('notifications')
        self.redis = redis.Redis()
    
    async def schedule_assignment_reminders(self, assignment_event: CourseEvent):
        enrolled_students = await self.get_enrolled_students(assignment_event.course_id)
        
        for student in enrolled_students:
            preferences = await self.get_user_preferences(
                student.id, 
                NotificationType.ASSIGNMENT_REMINDER
            )
            
            for pref in preferences:
                if not pref.enabled:
                    continue
                
                # Calculate reminder time
                reminder_time = assignment_event.start_datetime - timedelta(
                    minutes=pref.timing_offset or self.get_default_offset(pref.channel)
                )
                
                # Check if within quiet hours
                if self.is_quiet_hours(reminder_time, pref):
                    reminder_time = self.adjust_for_quiet_hours(reminder_time, pref)
                
                # Schedule notification
                await self.schedule_notification(
                    user_id=student.id,
                    notification_type=NotificationType.ASSIGNMENT_REMINDER,
                    channel=pref.channel,
                    scheduled_for=reminder_time,
                    context={
                        'assignment': assignment_event,
                        'course': assignment_event.course
                    }
                )
```

#### Notification Templates
```python
class NotificationTemplateEngine:
    def __init__(self):
        self.templates = {
            'assignment_reminder_email': """
                <h2>Assignment Reminder: {{assignment.title}}</h2>
                <p>Hi {{student.name}},</p>
                <p>This is a reminder that your assignment "{{assignment.title}}" 
                for {{course.code}} - {{course.title}} is due in {{time_until_due}}.</p>
                
                <div class="assignment-details">
                    <strong>Due Date:</strong> {{assignment.due_date|format_datetime}}<br>
                    <strong>Course:</strong> {{course.code}} - {{course.title}}<br>
                    <strong>Instructor:</strong> {{course.instructor.name}}
                </div>
                
                <a href="{{calendar_link}}" class="button">View in Calendar</a>
                <a href="{{course_link}}" class="button">Go to Course</a>
            """,
            
            'enrollment_confirmation_email': """
                <h2>Enrollment Confirmed: {{course.title}}</h2>
                <p>Hi {{student.name}},</p>
                <p>You have successfully enrolled in {{course.code}} - {{course.title}}.</p>
                
                <div class="course-details">
                    <strong>Instructor:</strong> {{course.instructor.name}}<br>
                    <strong>Schedule:</strong> {{course.meeting_times|format_schedule}}<br>
                    <strong>Location:</strong> {{course.location}}<br>
                    <strong>Credits:</strong> {{course.credits}}
                </div>
            """
        }
    
    def render(self, template_id: str, context: dict) -> str:
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        return Template(template).render(**context)
```

### 2.3 API Endpoints

#### Notification Management

**GET /api/notifications**
```json
// Query Parameters
{
  "status": "unread",
  "type": "assignment_reminder",
  "limit": 20,
  "offset": 0
}

// Response
{
  "notifications": [
    {
      "id": "notification_id",
      "title": "Assignment due tomorrow",
      "message": "Your CS 101 assignment is due tomorrow at 11:59 PM",
      "type": "assignment_reminder",
      "priority": "high",
      "course": {
        "id": "course_id",
        "code": "CS 101",
        "title": "Introduction to Computer Science"
      },
      "created_at": "2025-01-20T10:00:00Z",
      "read_at": null,
      "action_url": "/courses/course_id/assignments/assignment_id"
    }
  ],
  "unread_count": 5,
  "has_more": true
}
```

**PUT /api/notifications/{notification_id}/read**
```json
// Response
{
  "id": "notification_id",
  "read_at": "2025-01-20T14:30:00Z"
}
```

**POST /api/notifications/mark-all-read**
```json
// Request
{
  "type": "assignment_reminder",  // Optional filter
  "before": "2025-01-20T00:00:00Z"  // Optional date filter
}

// Response
{
  "marked_count": 12,
  "message": "All notifications marked as read"
}
```

#### Notification Preferences

**GET /api/notifications/preferences**
```json
{
  "preferences": [
    {
      "notification_type": "assignment_reminder",
      "channel": "email",
      "enabled": true,
      "timing_offset": 1440  // 24 hours
    },
    {
      "notification_type": "assignment_reminder",
      "channel": "in_app",
      "enabled": true,
      "timing_offset": 60  // 1 hour
    }
  ],
  "quiet_hours": {
    "start": "22:00",
    "end": "08:00"
  }
}
```

**PUT /api/notifications/preferences**
```json
// Request
{
  "preferences": [
    {
      "notification_type": "assignment_reminder",
      "channel": "email",
      "enabled": true,
      "timing_offset": 2880  // 48 hours
    }
  ],
  "quiet_hours": {
    "start": "23:00",
    "end": "07:00"
  }
}

// Response
{
  "message": "Preferences updated successfully",
  "updated_count": 1
}
```

#### Admin Notification Endpoints

**POST /api/admin/notifications/broadcast**
```json
// Request - Professor or Admin only
{
  "recipient_type": "course_students",
  "course_id": "course_id",
  "title": "Important Course Update",
  "message": "Class will be held in a different room tomorrow",
  "channels": ["email", "in_app"],
  "priority": "high",
  "send_immediately": true
}

// Response
{
  "broadcast_id": "broadcast_id",
  "recipients_count": 28,
  "estimated_delivery": "2025-01-20T15:00:00Z"
}
```

## 3. User Interface Components

### 3.1 In-App Notification Center

#### Notification Bell Component
```jsx
<NotificationBell>
  <IconButton onClick={toggleNotifications}>
    <NotificationIcon />
    {unreadCount > 0 && (
      <Badge count={unreadCount} max={99} />
    )}
  </IconButton>
  
  <NotificationDropdown open={isOpen}>
    <DropdownHeader>
      <Title>Notifications</Title>
      {unreadCount > 0 && (
        <MarkAllReadButton onClick={markAllRead}>
          Mark all read
        </MarkAllReadButton>
      )}
    </DropdownHeader>
    
    <NotificationList>
      {notifications.length === 0 ? (
        <EmptyState>
          <EmptyIcon />
          <EmptyText>No notifications</EmptyText>
        </EmptyState>
      ) : (
        notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification)}
          />
        ))
      )}
    </NotificationList>
    
    <DropdownFooter>
      <ViewAllButton onClick={openNotificationCenter}>
        View all notifications
      </ViewAllButton>
    </DropdownFooter>
  </NotificationDropdown>
</NotificationBell>
```

#### Notification Item Component
```jsx
<NotificationItem unread={!notification.read_at}>
  <NotificationIcon type={notification.type} />
  
  <NotificationContent>
    <NotificationHeader>
      <Title>{notification.title}</Title>
      <Timestamp>{formatRelativeTime(notification.created_at)}</Timestamp>
    </NotificationHeader>
    
    <Message>{notification.message}</Message>
    
    {notification.course && (
      <CourseContext>
        <CourseChip color={notification.course.color}>
          {notification.course.code}
        </CourseChip>
      </CourseContext>
    )}
  </NotificationContent>
  
  <NotificationActions>
    {notification.action_url && (
      <ActionButton
        href={notification.action_url}
        size="small"
      >
        View
      </ActionButton>
    )}
    <IconButton
      onClick={(e) => {
        e.stopPropagation();
        dismissNotification(notification.id);
      }}
      size="small"
    >
      <CloseIcon />
    </IconButton>
  </NotificationActions>
</NotificationItem>
```

### 3.2 Notification Preferences

#### Preferences Settings Page
```jsx
<NotificationPreferences>
  <PageHeader>
    <Title>Notification Preferences</Title>
    <Subtitle>
      Choose how and when you want to be notified
    </Subtitle>
  </PageHeader>
  
  <PreferencesForm>
    <Section title="Assignment Reminders">
      <ChannelPreferences type="assignment_reminder">
        <ChannelOption channel="email">
          <Switch
            checked={getPreference('assignment_reminder', 'email').enabled}
            onChange={(enabled) => updatePreference('assignment_reminder', 'email', {enabled})}
          />
          <Label>Email</Label>
          <TimingSelect
            value={getPreference('assignment_reminder', 'email').timing_offset}
            options={[
              { value: 60, label: '1 hour before' },
              { value: 1440, label: '1 day before' },
              { value: 2880, label: '2 days before' },
              { value: 4320, label: '3 days before' }
            ]}
            onChange={(offset) => updatePreference('assignment_reminder', 'email', {timing_offset: offset})}
          />
        </ChannelOption>
        
        <ChannelOption channel="in_app">
          <Switch
            checked={getPreference('assignment_reminder', 'in_app').enabled}
            onChange={(enabled) => updatePreference('assignment_reminder', 'in_app', {enabled})}
          />
          <Label>In-app notification</Label>
          <TimingSelect
            value={getPreference('assignment_reminder', 'in_app').timing_offset}
            options={timingOptions}
            onChange={(offset) => updatePreference('assignment_reminder', 'in_app', {timing_offset: offset})}
          />
        </ChannelOption>
      </ChannelPreferences>
    </Section>
    
    <Section title="Course Updates">
      <ChannelPreferences type="course_update">
        {/* Similar structure for course updates */}
      </ChannelPreferences>
    </Section>
    
    <Section title="Quiet Hours">
      <QuietHoursSettings>
        <InfoText>
          Notifications won't be sent during these hours (except urgent ones)
        </InfoText>
        <TimeRangeSelector
          startTime={quietHours.start}
          endTime={quietHours.end}
          onChange={updateQuietHours}
        />
      </QuietHoursSettings>
    </Section>
  </PreferencesForm>
</NotificationPreferences>
```

### 3.3 Email Templates

#### Responsive Email Layout
```jsx
<EmailTemplate>
  <EmailHeader>
    <Logo src="{{base_url}}/logo.png" alt="SyllabAI" />
  </EmailHeader>
  
  <EmailBody>
    <Greeting>Hi {{student.name}},</Greeting>
    
    <MainContent>
      {{content}}
    </MainContent>
    
    <ActionButtons>
      {{#if primary_action}}
        <PrimaryButton href="{{primary_action.url}}">
          {{primary_action.text}}
        </PrimaryButton>
      {{/if}}
      
      {{#if secondary_action}}
        <SecondaryButton href="{{secondary_action.url}}">
          {{secondary_action.text}}
        </SecondaryButton>
      {{/if}}
    </ActionButtons>
  </EmailBody>
  
  <EmailFooter>
    <FooterLinks>
      <Link href="{{unsubscribe_url}}">Unsubscribe</Link>
      <Link href="{{preferences_url}}">Manage Preferences</Link>
      <Link href="{{support_url}}">Support</Link>
    </FooterLinks>
    
    <CompanyInfo>
      SyllabAI - AI-Powered Academic Schedule Management
    </CompanyInfo>
  </EmailFooter>
</EmailTemplate>
```

## 4. Notification Types & Logic

### 4.1 Assignment Reminders

```python
class AssignmentReminderGenerator:
    async def generate_reminders(self, assignment: CourseEvent):
        enrolled_students = await self.get_enrolled_students(assignment.course_id)
        
        for student in enrolled_students:
            # Check if assignment is already completed
            if await self.is_assignment_completed(student.id, assignment.id):
                continue
            
            preferences = await self.get_user_preferences(
                student.id, 
                NotificationType.ASSIGNMENT_REMINDER
            )
            
            for pref in preferences:
                if not pref.enabled:
                    continue
                
                reminder_times = self.calculate_reminder_times(
                    assignment.start_datetime, 
                    pref.timing_offset
                )
                
                for reminder_time in reminder_times:
                    await self.create_scheduled_notification(
                        user_id=student.id,
                        type=NotificationType.ASSIGNMENT_REMINDER,
                        channel=pref.channel,
                        scheduled_for=reminder_time,
                        template_data={
                            'student': student,
                            'assignment': assignment,
                            'course': assignment.course,
                            'time_until_due': self.format_time_until(
                                assignment.start_datetime
                            )
                        }
                    )
```

### 4.2 Course Change Notifications

```python
class CourseChangeNotifier:
    async def notify_course_update(self, course: Course, changes: dict):
        enrolled_students = await self.get_enrolled_students(course.id)
        
        # Determine notification priority based on change type
        priority = self.get_change_priority(changes)
        
        for student in enrolled_students:
            await self.create_notification(
                user_id=student.id,
                type=NotificationType.COURSE_UPDATE,
                priority=priority,
                title=f"Update to {course.code} - {course.title}",
                message=self.format_change_message(changes),
                course_id=course.id,
                related_data={'changes': changes}
            )
    
    def get_change_priority(self, changes: dict) -> NotificationPriority:
        if any(field in changes for field in ['meeting_times', 'location']):
            return NotificationPriority.HIGH
        elif any(field in changes for field in ['title', 'description']):
            return NotificationPriority.NORMAL
        else:
            return NotificationPriority.LOW
```

### 4.3 Grade Posted Notifications

```python
class GradeNotifier:
    async def notify_grade_posted(self, grade_entry: GradeEntry):
        if grade_entry.is_projected:
            return  # Don't notify for projected grades
        
        student = await get_user(grade_entry.student_id)
        course = await get_course(grade_entry.course_id)
        
        # Check if student wants grade notifications
        preferences = await self.get_user_preferences(
            student.id,
            NotificationType.GRADE_POSTED
        )
        
        for pref in preferences:
            if not pref.enabled:
                continue
            
            await self.create_notification(
                user_id=student.id,
                type=NotificationType.GRADE_POSTED,
                channel=pref.channel,
                title=f"Grade posted for {course.code}",
                message=f"Your grade for {grade_entry.assignment_name} has been posted",
                course_id=course.id,
                related_data={
                    'grade_entry_id': grade_entry.id,
                    'assignment_name': grade_entry.assignment_name
                }
            )
```

## 5. Delivery Channels

### 5.1 Email Service Integration

```python
class EmailNotificationService:
    def __init__(self):
        self.sendgrid = SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        self.template_engine = NotificationTemplateEngine()
    
    async def send_email_notification(self, notification: Notification):
        try:
            # Render email content
            html_content = self.template_engine.render(
                f"{notification.notification_type}_email",
                notification.related_data
            )
            
            # Create email message
            message = Mail(
                from_email=settings.FROM_EMAIL,
                to_emails=notification.user.email,
                subject=notification.title,
                html_content=html_content
            )
            
            # Add tracking parameters
            message.tracking_settings = TrackingSettings(
                click_tracking=ClickTracking(enable=True),
                open_tracking=OpenTracking(enable=True),
                subscription_tracking=SubscriptionTracking(
                    enable=True,
                    substitution_tag='[unsubscribe]'
                )
            )
            
            # Send email
            response = self.sendgrid.send(message)
            
            # Update notification status
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.utcnow()
            notification.external_id = response.headers.get('X-Message-Id')
            
            await db.commit()
            
        except Exception as e:
            notification.status = NotificationStatus.FAILED
            notification.error_message = str(e)
            notification.retry_count += 1
            
            await db.commit()
            
            # Schedule retry if within limits
            if notification.retry_count < 3:
                await self.schedule_retry(notification)
```

### 5.2 Push Notification Service (Future)

```python
class PushNotificationService:
    def __init__(self):
        self.fcm = FCMNotification(api_key=settings.FCM_API_KEY)
    
    async def send_push_notification(self, notification: Notification):
        user_devices = await self.get_user_devices(notification.user_id)
        
        for device in user_devices:
            await self.fcm.notify_single_device(
                registration_id=device.fcm_token,
                message_title=notification.title,
                message_body=notification.message,
                data_message={
                    'notification_id': str(notification.id),
                    'type': notification.notification_type,
                    'action_url': notification.related_data.get('action_url')
                }
            )
```

## 6. Implementation Phases

### Phase 1: Core Notification System
1. Basic email notifications
2. In-app notification center
3. Assignment and exam reminders
4. Enrollment confirmations
5. Simple preference management

### Phase 2: Advanced Features
1. Smart scheduling with quiet hours
2. Notification templates and customization
3. Course change notifications
4. Digest notifications (daily/weekly summaries)
5. Admin broadcast notifications

### Phase 3: Intelligent Notifications
1. Push notification support
2. SMS notifications
3. AI-powered notification optimization
4. Behavioral analysis and timing optimization
5. Integration with external calendars

## 7. Performance & Scalability

### 7.1 Queue Management

```python
class NotificationQueue:
    def __init__(self):
        self.celery = Celery('notifications')
        self.redis = redis.Redis()
    
    @celery.task(bind=True, max_retries=3)
    def process_notification(self, notification_id: str):
        try:
            notification = await get_notification(notification_id)
            
            if notification.channel == NotificationChannel.EMAIL:
                await EmailNotificationService().send_email_notification(notification)
            elif notification.channel == NotificationChannel.PUSH:
                await PushNotificationService().send_push_notification(notification)
            
        except Exception as e:
            self.retry(countdown=60 * (2 ** self.request.retries))
```

### 7.2 Rate Limiting

```python
class NotificationRateLimiter:
    def __init__(self):
        self.redis = redis.Redis()
    
    async def can_send_notification(self, user_id: str, notification_type: str) -> bool:
        key = f"notification_limit:{user_id}:{notification_type}"
        current_count = await self.redis.get(key) or 0
        
        daily_limit = await self.get_daily_limit(user_id, notification_type)
        
        if int(current_count) >= daily_limit:
            return False
        
        # Increment counter with expiry
        await self.redis.incr(key)
        await self.redis.expire(key, 86400)  # 24 hours
        
        return True
```

## 8. Analytics & Monitoring

### 8.1 Notification Metrics

```python
class NotificationAnalytics:
    async def track_notification_sent(self, notification: Notification):
        await self.increment_metric(
            f"notifications.sent.{notification.channel}.{notification.notification_type}"
        )
    
    async def track_notification_opened(self, notification: Notification):
        notification.read_at = datetime.utcnow()
        await db.commit()
        
        await self.increment_metric(
            f"notifications.opened.{notification.channel}.{notification.notification_type}"
        )
    
    async def track_notification_clicked(self, notification: Notification):
        notification.clicked_at = datetime.utcnow()
        await db.commit()
        
        await self.increment_metric(
            f"notifications.clicked.{notification.channel}.{notification.notification_type}"
        )
```

### 8.2 Success Metrics

- **Delivery Rate**: > 98% for email, > 95% for push
- **Open Rate**: > 40% for critical notifications
- **Response Time**: < 5 minutes for urgent notifications
- **User Satisfaction**: < 2% unsubscribe rate

## 9. Privacy & Compliance

### 9.1 Data Protection
- User consent for all notification types
- Easy unsubscribe mechanisms
- Data retention policies
- GDPR compliance for EU users

### 9.2 Email Compliance
- CAN-SPAM Act compliance
- Proper sender authentication (SPF, DKIM)
- Bounce and complaint handling
- Reputation monitoring

## 10. Success Metrics

### 10.1 Engagement Metrics
- Notification open rates by type
- Click-through rates
- Time to read notifications
- User preference adoption

### 10.2 Business Impact
- Reduced missed assignments
- Improved course engagement
- Faster response to course changes
- Higher student satisfaction scores

### 10.3 Technical Metrics
- Notification delivery time < 1 minute
- System uptime > 99.9%
- Email deliverability > 98%
- Queue processing latency < 30 seconds