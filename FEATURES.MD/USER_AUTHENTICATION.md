# User Authentication & Authorization Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
A secure, seamless authentication system using Google OAuth 2.0 that provides role-based access control while maintaining user privacy and data security across the SyllabAI platform.

### 1.2 Core Objectives
- Single Sign-On (SSO) via Google OAuth 2.0
- JWT-based session management with refresh tokens
- Role-based access control (Student, Professor, Admin)
- Automatic user role detection based on email domain
- Secure token storage and management

## 2. Technical Architecture

### 2.1 Authentication Flow

#### Google OAuth 2.0 Flow
1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent screen
3. Google returns authorization code
4. Exchange auth code for access/refresh tokens
5. Retrieve user profile information
6. Create/update user in database
7. Generate JWT tokens
8. Return tokens to client

#### JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_uuid",
    "email": "user@university.edu",
    "name": "John Doe",
    "role": "student",
    "picture": "profile_url",
    "exp": 1234567890,
    "iat": 1234567890
  }
}
```

### 2.2 Data Models

#### User Model
```python
class User(Base):
    id = Column(UUID, primary_key=True, default=uuid4)
    google_id = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    picture = Column(Text)
    role = Column(Enum(UserRole), default=UserRole.STUDENT)
    timezone = Column(String(50), default='UTC')
    email_notifications = Column(Boolean, default=True)
    
    # Google OAuth tokens for calendar integration
    google_refresh_token = Column(Text, encrypted=True)
    google_access_token = Column(Text, encrypted=True)
    google_token_expires_at = Column(DateTime)
    
    # User preferences and tracking
    calendar_sync_enabled = Column(Boolean, default=False)
    notification_preferences = Column(JSONB, default=dict)
    last_login = Column(DateTime)
    login_count = Column(Integer, default=0)
    
    # Timestamps with soft delete support
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships for feature integration
    taught_courses = relationship("Course", back_populates="instructor", foreign_keys="Course.instructor_id")
    enrollments = relationship("StudentCourseLink", back_populates="student")
    notifications = relationship("Notification", back_populates="user")
    grade_entries = relationship("GradeEntry", back_populates="student")
    analytics_events = relationship("AnalyticsEvent", back_populates="user")
```

#### User Role Enum
```python
class UserRole(Enum):
    STUDENT = "student"
    PROFESSOR = "professor"
    ADMIN = "admin"
```

### 2.3 API Endpoints

#### Authentication Endpoints

**POST /api/auth/google**
```json
// Request
{
  "auth_code": "4/0AdQt8qh...",
  "redirect_uri": "https://syllaai.com/auth/callback"
}

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "student@university.edu",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "role": "student",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**POST /api/auth/refresh**
```json
// Request Headers
Authorization: Bearer <refresh_token>

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400
}
```

**POST /api/auth/logout**
```json
// Request Headers
Authorization: Bearer <access_token>

// Response
204 No Content
```

**GET /api/auth/me**
```json
// Request Headers
Authorization: Bearer <access_token>

// Response
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "student@university.edu",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "role": "student",
  "timezone": "America/New_York",
  "email_notifications": true,
  "created_at": "2025-01-15T10:30:00Z",
  "last_login": "2025-01-20T14:22:00Z"
}
```

### 2.4 Security Measures

#### Token Management
- **Access Token**: 24-hour expiry, used for API requests
- **Refresh Token**: 30-day expiry, used to obtain new access tokens
- **Token Storage**: HttpOnly cookies for web, secure storage for mobile
- **Token Rotation**: New refresh token issued on each refresh

#### Security Headers
```javascript
// Required security headers
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'"
}
```

## 3. User Interface Components

### 3.1 Login Page

#### Layout
- Centered card with SyllabAI branding
- Clean, minimalist design
- Responsive for all screen sizes

#### Components
```jsx
<LoginPage>
  <Logo />
  <Tagline>AI-Powered Academic Schedule Management</Tagline>
  <GoogleSignInButton 
    text="Sign in with Google"
    onClick={handleGoogleAuth}
  />
  <Footer>
    <Link to="/privacy">Privacy Policy</Link>
    <Link to="/terms">Terms of Service</Link>
  </Footer>
</LoginPage>
```

### 3.2 User Menu Component

#### Dropdown Menu Items
- Profile (name, email, picture)
- Settings
- Help & Support
- Sign Out

#### Component Structure
```jsx
<UserMenu>
  <Avatar src={user.picture} />
  <DropdownMenu>
    <MenuItem icon="person">Profile</MenuItem>
    <MenuItem icon="settings">Settings</MenuItem>
    <MenuItem icon="help">Help & Support</MenuItem>
    <Divider />
    <MenuItem icon="logout" onClick={handleLogout}>
      Sign Out
    </MenuItem>
  </DropdownMenu>
</UserMenu>
```

## 4. Role-Based Access Control

### 4.1 Role Definitions

#### Student Role
- View and enroll in courses
- Access personal calendar
- View grades (future feature)
- Update profile settings

#### Professor Role
- All student permissions
- Create and manage courses
- Upload syllabi
- View enrolled students
- Manage course events

#### Admin Role
- All professor permissions
- Manage user accounts
- View platform analytics
- Configure system settings
- Access audit logs

### 4.2 Permission Matrix

#### Granular Permissions System
```python
class Permission(Enum):
    # Course management
    CREATE_COURSE = "create_course"
    EDIT_OWN_COURSES = "edit_own_courses"
    EDIT_ANY_COURSE = "edit_any_course"
    DELETE_OWN_COURSES = "delete_own_courses"
    VIEW_COURSE_ANALYTICS = "view_course_analytics"
    UPLOAD_SYLLABUS = "upload_syllabus"
    
    # Student management
    VIEW_STUDENT_LIST = "view_student_list"
    VIEW_STUDENT_GRADES = "view_student_grades"
    EDIT_STUDENT_GRADES = "edit_student_grades"
    VIEW_AT_RISK_STUDENTS = "view_at_risk_students"
    
    # Enrollment management
    ENROLL_IN_COURSES = "enroll_in_courses"
    UNENROLL_FROM_COURSES = "unenroll_from_courses"
    MANAGE_COURSE_ROSTER = "manage_course_roster"
    BULK_ENROLL_STUDENTS = "bulk_enroll_students"
    
    # Calendar and scheduling
    SYNC_CALENDAR = "sync_calendar"
    MANAGE_CALENDAR_INTEGRATION = "manage_calendar_integration"
    VIEW_COURSE_EVENTS = "view_course_events"
    EDIT_COURSE_EVENTS = "edit_course_events"
    
    # Notifications
    MANAGE_NOTIFICATION_PREFERENCES = "manage_notification_preferences"
    SEND_BROADCAST_NOTIFICATIONS = "send_broadcast_notifications"
    VIEW_NOTIFICATION_ANALYTICS = "view_notification_analytics"
    
    # Grade projection and analytics
    VIEW_GRADE_PROJECTIONS = "view_grade_projections"
    EDIT_GRADE_PROJECTIONS = "edit_grade_projections"
    VIEW_STUDENT_ANALYTICS = "view_student_analytics"
    SETUP_EARLY_INTERVENTION = "setup_early_intervention"
    
    # System administration
    VIEW_PLATFORM_ANALYTICS = "view_platform_analytics"
    MANAGE_USER_ACCOUNTS = "manage_user_accounts"
    CONFIGURE_SYSTEM_SETTINGS = "configure_system_settings"
    ACCESS_AUDIT_LOGS = "access_audit_logs"
    
    # Data access
    EXPORT_COURSE_DATA = "export_course_data"
    VIEW_INSTITUTIONAL_DATA = "view_institutional_data"

ROLE_PERMISSIONS = {
    UserRole.STUDENT: [
        Permission.ENROLL_IN_COURSES,
        Permission.UNENROLL_FROM_COURSES,
        Permission.SYNC_CALENDAR,
        Permission.VIEW_COURSE_EVENTS,
        Permission.MANAGE_NOTIFICATION_PREFERENCES,
        Permission.VIEW_GRADE_PROJECTIONS,
        Permission.EDIT_GRADE_PROJECTIONS,
    ],
    UserRole.PROFESSOR: [
        # All student permissions
        Permission.ENROLL_IN_COURSES,
        Permission.UNENROLL_FROM_COURSES,
        Permission.SYNC_CALENDAR,
        Permission.VIEW_COURSE_EVENTS,
        Permission.MANAGE_NOTIFICATION_PREFERENCES,
        Permission.VIEW_GRADE_PROJECTIONS,
        Permission.EDIT_GRADE_PROJECTIONS,
        
        # Professor-specific permissions
        Permission.CREATE_COURSE,
        Permission.UPLOAD_SYLLABUS,
        Permission.EDIT_OWN_COURSES,
        Permission.DELETE_OWN_COURSES,
        Permission.VIEW_COURSE_ANALYTICS,
        Permission.VIEW_STUDENT_LIST,
        Permission.VIEW_STUDENT_GRADES,
        Permission.EDIT_STUDENT_GRADES,
        Permission.VIEW_AT_RISK_STUDENTS,
        Permission.MANAGE_COURSE_ROSTER,
        Permission.BULK_ENROLL_STUDENTS,
        Permission.MANAGE_CALENDAR_INTEGRATION,
        Permission.EDIT_COURSE_EVENTS,
        Permission.SEND_BROADCAST_NOTIFICATIONS,
        Permission.VIEW_STUDENT_ANALYTICS,
        Permission.SETUP_EARLY_INTERVENTION,
        Permission.EXPORT_COURSE_DATA,
    ],
    UserRole.ADMIN: [
        # All permissions
        *[p for p in Permission]
    ]
}

def user_has_permission(user: User, permission: Permission) -> bool:
    """Check if user has specific permission"""
    return permission in ROLE_PERMISSIONS.get(user.role, [])

def require_permission(permission: Permission):
    """Decorator for API endpoints requiring specific permission"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            current_user = get_current_user()
            if not user_has_permission(current_user, permission):
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission required: {permission.value}"
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator
```

### 4.3 Role Detection Logic

```python
def determine_user_role(email: str, domain: str) -> UserRole:
    # Check admin whitelist
    if email in ADMIN_EMAILS:
        return UserRole.ADMIN
    
    # Check professor patterns
    if any(pattern in email for pattern in PROFESSOR_PATTERNS):
        return UserRole.PROFESSOR
    
    # Check domain-specific rules
    if domain in UNIVERSITY_DOMAINS:
        if "@faculty." in email or "@staff." in email:
            return UserRole.PROFESSOR
    
    # Default to student
    return UserRole.STUDENT
```

## 5. Error Handling

### 5.1 Authentication Errors

#### Invalid Authorization Code
```json
{
  "error": {
    "code": "INVALID_AUTH_CODE",
    "message": "The authorization code is invalid or expired",
    "details": "Please try signing in again"
  }
}
```

#### Token Expired
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired",
    "details": "Please refresh your token or sign in again"
  }
}
```

### 5.2 Client-Side Error Recovery

```javascript
// Axios interceptor for token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return axios.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

## 6. Implementation Phases

### Phase 1: Core Authentication
1. Google OAuth integration
2. JWT token generation and validation
3. User creation and profile management
4. Basic role assignment
5. Login/logout functionality

### Phase 2: Enhanced Security
1. Multi-factor authentication (optional)
2. Session management dashboard
3. Device tracking and management
4. Suspicious activity detection
5. Password-less authentication

### Phase 3: Advanced Features
1. SSO integration with university systems
2. Custom role creation
3. Granular permissions system
4. API key management for developers
5. OAuth provider for third-party apps

## 7. Privacy & Compliance

### 7.1 Data Protection
- Minimal data collection (only essential profile info)
- Encrypted token storage
- No password storage (OAuth only)
- Right to deletion (GDPR compliance)

### 7.2 Audit Trail
```python
class AuthAuditLog(Base):
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey('users.id'))
    action = Column(String)  # login, logout, token_refresh
    ip_address = Column(INET)
    user_agent = Column(Text)
    success = Column(Boolean)
    error_message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
```

## 8. Integration Points

### 8.1 Event System Integration

#### Authentication Events Published
```python
class AuthEvent(Enum):
    USER_REGISTERED = "auth.user_registered"
    USER_LOGIN = "auth.user_login"
    USER_LOGOUT = "auth.user_logout"
    TOKEN_REFRESHED = "auth.token_refreshed"
    ROLE_CHANGED = "auth.role_changed"
    PERMISSION_GRANTED = "auth.permission_granted"
    PERMISSION_DENIED = "auth.permission_denied"

# Event payloads for feature integration
@dataclass
class UserRegisteredEvent:
    user_id: str
    email: str
    role: str
    timestamp: datetime
    # Triggers: Welcome notification, setup calendar integration

@dataclass
class UserLoginEvent:
    user_id: str
    ip_address: str
    user_agent: str
    timestamp: datetime
    # Triggers: Analytics tracking, security monitoring
```

#### Cross-Feature Dependencies
```python
# Required by Calendar Integration
async def get_user_google_tokens(user_id: str) -> dict:
    """Return Google OAuth tokens for calendar sync"""
    user = await get_user(user_id)
    return {
        'access_token': decrypt(user.google_access_token),
        'refresh_token': decrypt(user.google_refresh_token),
        'expires_at': user.google_token_expires_at
    }

# Required by Notifications
async def get_user_notification_preferences(user_id: str) -> dict:
    """Return user notification preferences"""
    user = await get_user(user_id)
    return user.notification_preferences or DEFAULT_NOTIFICATION_PREFS

# Required by Analytics
async def get_user_session_info(user_id: str) -> dict:
    """Return user session data for analytics"""
    user = await get_user(user_id)
    return {
        'last_login': user.last_login,
        'login_count': user.login_count,
        'timezone': user.timezone,
        'role': user.role.value
    }
```

### 8.2 Middleware Integration

#### JWT Authentication Middleware
```python
class JWTAuthMiddleware:
    """Middleware for validating JWT tokens across all features"""
    
    async def __call__(self, request: Request, call_next):
        # Skip auth for public endpoints
        if request.url.path in PUBLIC_ENDPOINTS:
            return await call_next(request)
        
        # Extract and validate token
        token = self.extract_token(request)
        if not token:
            raise HTTPException(401, "Authentication required")
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user = await get_user(payload['sub'])
            
            # Add user to request context for all features
            request.state.current_user = user
            request.state.user_permissions = ROLE_PERMISSIONS[user.role]
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(401, "Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(401, "Invalid token")
        
        return await call_next(request)

# Dependency for all feature endpoints
async def get_current_user(request: Request) -> User:
    """Get authenticated user for endpoint protection"""
    if not hasattr(request.state, 'current_user'):
        raise HTTPException(401, "Authentication required")
    return request.state.current_user

async def get_current_user_permissions(request: Request) -> List[Permission]:
    """Get user permissions for authorization"""
    if not hasattr(request.state, 'user_permissions'):
        raise HTTPException(401, "Authentication required")
    return request.state.user_permissions
```

### 8.3 Frontend Integration

#### Auth Context Provider
```tsx
interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  login: (authCode: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  
  // Auto-refresh tokens before expiry
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (user && needsRefresh(user.token_expires_at)) {
        await refreshToken();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, [user]);
  
  const hasPermission = (permission: Permission) => {
    return permissions.includes(permission);
  };
  
  // ... implementation
};

// Protected Route Component
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredPermission?: Permission;
  fallback?: React.ReactNode;
}> = ({ children, requiredPermission, fallback }) => {
  const { isAuthenticated, hasPermission } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || <div>Access Denied</div>;
  }
  
  return <>{children}</>;
};
```

### 8.4 Database Integration

#### User-Related Indexes for Performance
```sql
-- Essential indexes for feature queries
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email_domain ON users(substring(email from '@(.*)$'));
CREATE INDEX idx_users_last_login ON users(last_login) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_calendar_sync ON users(calendar_sync_enabled) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_users_active_role ON users(role, created_at) WHERE deleted_at IS NULL;
```

### 8.5 Feature Integration Utilities

#### User Context Helper Functions
```python
# For Course Management
async def user_can_edit_course(user: User, course_id: str) -> bool:
    """Check if user can edit specific course"""
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.PROFESSOR:
        course = await get_course(course_id)
        return course.instructor_id == user.id
    return False

# For Student Enrollment
async def user_can_view_roster(user: User, course_id: str) -> bool:
    """Check if user can view course roster"""
    if user.role in [UserRole.ADMIN, UserRole.PROFESSOR]:
        return await user_can_edit_course(user, course_id)
    return False

# For Grade Projection
async def user_can_view_grades(user: User, student_id: str) -> bool:
    """Check if user can view student grades"""
    if user.role == UserRole.ADMIN:
        return True
    if user.id == student_id:  # Own grades
        return True
    if user.role == UserRole.PROFESSOR:
        # Can view grades for students in their courses
        return await is_student_in_professor_course(student_id, user.id)
    return False
```

## 9. Success Metrics

### 9.1 Performance Metrics
- Authentication time < 2 seconds
- Token refresh time < 500ms
- 99.9% authentication service uptime

### 9.2 User Experience Metrics
- Sign-in success rate > 95%
- Session duration (target: full day without re-auth)
- User role accuracy > 98%

## 10. Testing Strategy

### 10.1 Unit Tests
- Token generation and validation
- Role detection logic
- Error handling scenarios

### 10.2 Integration Tests
- Full OAuth flow
- Token refresh cycle
- Role-based access control

### 10.3 Security Tests
- Token expiration handling
- Invalid token rejection
- XSS/CSRF prevention