# Fix Plan: Additional Student Dashboard Features

## Executive Summary

This fix plan addresses 39 critical issues in the supporting infrastructure of the student dashboard including production debug logging, insecure session management, architectural violations, and security vulnerabilities. Building on the service patterns and security measures from previous fixes, this plan transforms the dashboard from a monolithic, debug-heavy component into a secure, maintainable, and production-ready system.

## Phase 1: Critical Security & Production Readiness (Week 1)

### 1.1 Remove Production Debug Logging
**Priority**: CRITICAL - Security/Performance
**Issue**: Extensive debug logging exposing sensitive data and internal system details

**Solution**: Environment-aware logging system with production safety
```typescript
// /frontend-react/src/utils/logger.ts - ENHANCED (if exists) or NEW FILE
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private isDevelopment: boolean;
  private isEnabled: boolean;
  private sessionId: string;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    // Only enable logging in development OR when explicitly enabled
    this.isEnabled = this.isDevelopment || import.meta.env.VITE_ENABLE_LOGGING === 'true';
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      data: this.sanitizeData(data),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    // Remove sensitive information
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'email'];
    
    if (typeof data === 'object') {
      const sanitized = { ...data };
      
      for (const key in sanitized) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizeData(sanitized[key]);
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  debug(message: string, data?: any) {
    if (this.isEnabled && this.isDevelopment) {
      const entry = this.createLogEntry('debug', message, data);
      console.log(`[DEBUG] ${entry.message}`, entry.data);
    }
  }

  info(message: string, data?: any) {
    if (this.isEnabled) {
      const entry = this.createLogEntry('info', message, data);
      console.info(`[INFO] ${entry.message}`, entry.data);
    }
  }

  warn(message: string, data?: any) {
    const entry = this.createLogEntry('warn', message, data);
    console.warn(`[WARN] ${entry.message}`, entry.data);
    
    // Send to monitoring service in production
    if (!this.isDevelopment) {
      this.sendToMonitoring(entry);
    }
  }

  error(message: string, error?: any) {
    const entry = this.createLogEntry('error', message, error);
    console.error(`[ERROR] ${entry.message}`, entry.data);
    
    // Always send errors to monitoring
    this.sendToMonitoring(entry);
  }

  private sendToMonitoring(entry: LogEntry) {
    // Send to error monitoring service (Sentry, etc.)
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: entry.message,
        fatal: entry.level === 'error',
      });
    }
  }

  // Method to completely disable logging (for sensitive operations)
  disableLogging() {
    this.isEnabled = false;
  }

  enableLogging() {
    this.isEnabled = this.isDevelopment || import.meta.env.VITE_ENABLE_LOGGING === 'true';
  }
}

export const logger = new Logger();

// Build-time logging removal for production
export const conditionalLog = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    logger.debug(message, data);
  }
  // In production builds, this entire function can be removed by bundler
};

// Webpack/Vite plugin configuration to remove console.log in production
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    // Remove console.log in production builds
    {
      name: 'remove-console',
      transform(code, id) {
        if (id.includes('node_modules')) return;
        
        if (process.env.NODE_ENV === 'production') {
          return {
            code: code.replace(/console\.(log|debug|info)\([^)]*\);?/g, ''),
            map: null
          };
        }
      }
    }
  ],
  define: {
    // Remove debug code in production
    __DEBUG__: process.env.NODE_ENV === 'development'
  }
});

// Replace all existing console.log calls in StudentDashboard.tsx
// /frontend-react/src/pages/StudentDashboard.tsx - UPDATED
import { logger } from '../utils/logger';

// Replace lines 57-73, 111-162, 168-183 with proper logging
const StudentDashboard: React.FC = () => {
  // Remove all console.log statements
  // Replace with:
  
  useEffect(() => {
    logger.debug('Student dashboard rendered', {
      courseCount: enrolledCourses?.length || 0,
      hasUser: !!user
    });
  }, [enrolledCourses, user]);

  // Replace error logging with:
  const handleError = (operation: string, error: any) => {
    logger.error(`Dashboard operation failed: ${operation}`, {
      error: error.message,
      stack: error.stack
    });
  };
  
  // Remove all production console output
};
```

**Build configuration for production**:
```json
// package.json - Add build scripts
{
  "scripts": {
    "build": "vite build --mode production",
    "build:staging": "vite build --mode staging",
    "preview": "vite preview",
    "analyze": "vite-bundle-analyzer"
  },
  "devDependencies": {
    "vite-bundle-analyzer": "^0.7.0"
  }
}

// .env.production - Production environment
VITE_API_URL=https://syllaai-ai.onrender.com
VITE_ENABLE_LOGGING=false
VITE_ENVIRONMENT=production

// .env.staging - Staging environment  
VITE_API_URL=https://staging-syllaai-ai.onrender.com
VITE_ENABLE_LOGGING=true
VITE_ENVIRONMENT=staging
```

**Impact**: Eliminates information disclosure, improves performance, professional appearance
**Effort**: 6 hours

### 1.2 Implement Secure Session Management
**Priority**: CRITICAL - Security
**Issue**: Insecure logout process, JWT token exposure, session vulnerabilities

**Solution**: Comprehensive secure authentication system
```typescript
// /frontend-react/src/services/authService.ts - ENHANCED
interface SecureTokenStorage {
  setTokens(accessToken: string, refreshToken?: string): void;
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  clearTokens(): void;
  isTokenExpired(token: string): boolean;
}

class SecureTokenStorageService implements SecureTokenStorage {
  private readonly ACCESS_TOKEN_KEY = 'sat'; // Shortened, obscured key
  private readonly REFRESH_TOKEN_KEY = 'srt';

  setTokens(accessToken: string, refreshToken?: string): void {
    try {
      // Use sessionStorage for better security (cleared on tab close)
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, this.encodeToken(accessToken));
      
      if (refreshToken) {
        // Only store refresh token in localStorage if needed for persistence
        localStorage.setItem(this.REFRESH_TOKEN_KEY, this.encodeToken(refreshToken));
      }
    } catch (error) {
      logger.error('Failed to store authentication tokens', error);
    }
  }

  getAccessToken(): string | null {
    try {
      const token = sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
      return token ? this.decodeToken(token) : null;
    } catch (error) {
      logger.warn('Failed to retrieve access token', error);
      return null;
    }
  }

  getRefreshToken(): string | null {
    try {
      const token = localStorage.getItem(this.REFRESH_TOKEN_KEY);
      return token ? this.decodeToken(token) : null;
    } catch (error) {
      logger.warn('Failed to retrieve refresh token', error);
      return null;
    }
  }

  clearTokens(): void {
    try {
      sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      
      // Clear any other auth-related data
      sessionStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
    } catch (error) {
      logger.error('Failed to clear tokens', error);
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expiry;
    } catch (error) {
      logger.warn('Failed to check token expiry', error);
      return true; // Assume expired if we can't parse
    }
  }

  private encodeToken(token: string): string {
    // Basic obfuscation (not encryption, just to avoid plain text)
    return btoa(token);
  }

  private decodeToken(encodedToken: string): string {
    return atob(encodedToken);
  }
}

class AuthenticationService {
  private tokenStorage: SecureTokenStorage;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.tokenStorage = new SecureTokenStorageService();
    this.setupSessionMonitoring();
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token, user } = response.data;

      // Store tokens securely
      this.tokenStorage.setTokens(access_token, refresh_token);
      
      // Start session monitoring
      this.startSessionTimeout();
      
      logger.info('User logged in successfully', { userId: user.id });
      
      return {
        success: true,
        user,
        message: 'Login successful'
      };
    } catch (error) {
      logger.error('Login failed', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      };
    }
  }

  async logout(invalidateServer: boolean = true): Promise<void> {
    try {
      const accessToken = this.tokenStorage.getAccessToken();
      
      if (invalidateServer && accessToken) {
        // Invalidate token on server
        try {
          await api.post('/auth/logout', {}, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        } catch (error) {
          logger.warn('Server-side logout failed', error);
        }
      }
      
      // Clear local session
      this.clearSession();
      
      logger.info('User logged out');
      
    } catch (error) {
      logger.error('Logout process failed', error);
      // Always clear local session even if server logout fails
      this.clearSession();
    }
  }

  private clearSession(): void {
    // Clear tokens
    this.tokenStorage.clearTokens();
    
    // Clear session timeout
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    
    // Clear any cached data
    sessionStorage.clear();
    
    // Redirect to login
    window.location.href = '/login';
  }

  private setupSessionMonitoring(): void {
    // Monitor user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
      this.resetSessionTimeout();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });
  }

  private startSessionTimeout(): void {
    this.resetSessionTimeout();
  }

  private resetSessionTimeout(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = setTimeout(() => {
      logger.warn('Session expired due to inactivity');
      this.logout(false); // Don't try server logout for timeout
    }, this.SESSION_TIMEOUT_MS);
  }

  getValidToken(): string | null {
    const token = this.tokenStorage.getAccessToken();
    
    if (!token) return null;
    
    if (this.tokenStorage.isTokenExpired(token)) {
      logger.info('Access token expired, attempting refresh');
      // Trigger token refresh
      this.refreshToken();
      return null;
    }
    
    return token;
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    
    if (!refreshToken) {
      this.logout(false);
      return;
    }

    try {
      const response = await api.post('/auth/refresh', {
        refresh_token: refreshToken
      });
      
      const { access_token, refresh_token: newRefreshToken } = response.data;
      this.tokenStorage.setTokens(access_token, newRefreshToken);
      
    } catch (error) {
      logger.error('Token refresh failed', error);
      this.logout(false);
    }
  }
}

export const authService = new AuthenticationService();

// Enhanced authentication context
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing valid session on app load
    const initializeAuth = async () => {
      const token = authService.getValidToken();
      
      if (token) {
        try {
          // Verify token with server
          const response = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (error) {
          logger.warn('Token validation failed', error);
          authService.logout(false);
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    
    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }
    
    return result;
  };

  const logout = async () => {
    await authService.logout(true);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Backend session invalidation support**:
```python
# /backend/app/routers/auth.py - ENHANCED
from typing import Set
import redis

# Token blacklist for logout
token_blacklist: Set[str] = set()
redis_client = redis.Redis(host=os.getenv('REDIS_HOST', 'localhost'), port=6379, db=1)

@router.post("/logout")
async def logout_user(
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_raw_token)
):
    """Secure logout with token invalidation"""
    try:
        # Add token to blacklist
        jti = get_jti_from_token(token)  # Get unique token identifier
        
        # Store in Redis with expiration matching token expiry
        token_expiry = get_token_expiry(token)
        ttl = int((token_expiry - datetime.utcnow()).total_seconds())
        
        if ttl > 0:
            redis_client.setex(f"blacklist:{jti}", ttl, "1")
        
        logger.info(f"User {current_user.id} logged out successfully")
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout failed for user {current_user.id}: {e}")
        raise HTTPException(500, "Logout failed")

def is_token_blacklisted(token: str) -> bool:
    """Check if token is blacklisted"""
    try:
        jti = get_jti_from_token(token)
        return redis_client.exists(f"blacklist:{jti}")
    except:
        return False

# Enhanced token verification
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Enhanced user verification with blacklist check"""
    
    # Check blacklist first
    if is_token_blacklisted(token):
        raise HTTPException(401, "Token has been invalidated")
    
    # Existing token verification logic...
    return user
```

**Impact**: Secure session management, prevents token hijacking, proper logout
**Effort**: 8 hours

### 1.3 Remove Environment Banner & Information Disclosure
**Priority**: HIGH - Security/Professional Appearance
**Issue**: Environment banner exposes internal API structure and looks unprofessional

**Solution**: Conditional development-only indicators
```typescript
// /frontend-react/src/components/layout/EnvironmentIndicator.tsx - NEW FILE
interface EnvironmentIndicatorProps {
  environment?: string;
}

export const EnvironmentIndicator: React.FC<EnvironmentIndicatorProps> = ({ 
  environment = import.meta.env.VITE_ENVIRONMENT 
}) => {
  // Only show in development or staging, never in production
  if (environment === 'production') {
    return null;
  }

  // Minimal, non-intrusive indicator for development
  if (environment === 'development') {
    return (
      <Chip
        label="DEV"
        size="small"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          zIndex: 1000,
          opacity: 0.7,
          fontSize: '0.75rem'
        }}
      />
    );
  }

  // Staging indicator
  if (environment === 'staging') {
    return (
      <Alert
        severity="info"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          borderRadius: 0,
          '& .MuiAlert-message': {
            textAlign: 'center',
            width: '100%'
          }
        }}
      >
        <Typography variant="body2">
          Staging Environment - For Testing Only
        </Typography>
      </Alert>
    );
  }

  return null;
};

// Remove environment banner from StudentDashboard.tsx
// Replace lines 271-277 with:
const StudentDashboard: React.FC = () => {
  // Remove environment banner completely
  // Only show minimal dev indicator at bottom-right
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* All existing dashboard content */}
      
      {/* Development indicator only */}
      <EnvironmentIndicator />
    </Container>
  );
};

// /frontend-react/src/config/environment.ts - NEW FILE
interface EnvironmentConfig {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  enableAnalytics: boolean;
  enableLogging: boolean;
  features: {
    debugMode: boolean;
    showEnvironmentIndicator: boolean;
    enablePerformanceMonitoring: boolean;
  };
}

const createEnvironmentConfig = (): EnvironmentConfig => {
  const environment = (import.meta.env.VITE_ENVIRONMENT || 'development') as EnvironmentConfig['environment'];
  
  return {
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8001',
    environment,
    enableAnalytics: environment === 'production',
    enableLogging: environment !== 'production',
    features: {
      debugMode: environment === 'development',
      showEnvironmentIndicator: environment !== 'production',
      enablePerformanceMonitoring: environment === 'production'
    }
  };
};

export const envConfig = createEnvironmentConfig();

// Type-safe environment checking
export const isDevelopment = envConfig.environment === 'development';
export const isProduction = envConfig.environment === 'production';
export const isStaging = envConfig.environment === 'staging';
```

**Impact**: Professional appearance, eliminates information disclosure, better security
**Effort**: 3 hours

### 1.4 Fix CORS and Client-Side Route Protection
**Priority**: HIGH - Security
**Issue**: Over-permissive CORS, client-side only route protection

**Solution**: Server-side route validation and proper CORS configuration
```python
# /backend/app/middleware/cors.py - ENHANCED
from fastapi.middleware.cors import CORSMiddleware
import os

def setup_cors(app):
    """Configure CORS based on environment"""
    
    environment = os.getenv("ENVIRONMENT", "development")
    
    if environment == "production":
        # Restrictive CORS for production
        allowed_origins = [
            "https://dajzdabz.github.io",
            "https://syllaai-frontend.onrender.com",
            # Add only verified production domains
        ]
        
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
            expose_headers=["X-Total-Count"],
        )
        
    elif environment == "staging":
        # Slightly more permissive for staging
        allowed_origins = [
            "https://staging-syllaai-frontend.onrender.com",
            "http://localhost:5173",  # For staging testing
        ]
        
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
            allow_headers=["*"],
        )
        
    else:
        # Development - more permissive but still controlled
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
            ],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

# /backend/app/middleware/route_protection.py - NEW FILE
from fastapi import Request, HTTPException
from typing import List, Optional
import re

class RouteProtectionMiddleware:
    """Server-side route protection"""
    
    # Routes that require authentication
    PROTECTED_ROUTES = [
        r'^/api/courses/.*',
        r'^/api/user/.*',
        r'^/api/enrollment/.*',
        r'^/api/professor-tools/.*',
    ]
    
    # Routes that require specific roles
    ROLE_PROTECTED_ROUTES = {
        'professor': [
            r'^/api/professor-tools/.*',
            r'^/api/courses/.*/events/create',
        ],
        'admin': [
            r'^/api/admin/.*',
        ]
    }

    def __init__(self):
        self.protected_patterns = [re.compile(pattern) for pattern in self.PROTECTED_ROUTES]
        self.role_patterns = {
            role: [re.compile(pattern) for pattern in patterns]
            for role, patterns in self.ROLE_PROTECTED_ROUTES.items()
        }

    async def __call__(self, request: Request, call_next):
        path = request.url.path
        
        # Check if route requires authentication
        if self.is_protected_route(path):
            user = getattr(request.state, 'user', None)
            
            if not user:
                raise HTTPException(401, "Authentication required")
            
            # Check role-specific protection
            if not self.check_role_access(path, user.role):
                raise HTTPException(403, "Insufficient permissions")
        
        response = await call_next(request)
        return response

    def is_protected_route(self, path: str) -> bool:
        return any(pattern.match(path) for pattern in self.protected_patterns)

    def check_role_access(self, path: str, user_role: str) -> bool:
        for role, patterns in self.role_patterns.items():
            if any(pattern.match(path) for pattern in patterns):
                return user_role == role or user_role == 'admin'
        return True
```

**Frontend route protection enhancement**:
```typescript
// /frontend-react/src/components/auth/ProtectedRoute.tsx - ENHANCED
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CircularProgress, Box } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'professor' | 'admin';
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  fallbackPath = '/login'
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location.pathname }} replace />;
  }

  // Role-based access control
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// Enhanced routing configuration
// /frontend-react/src/App.tsx - UPDATED
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/professor/*" element={
            <ProtectedRoute requiredRole="professor">
              <ProfessorRoutes />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/*" element={
            <ProtectedRoute requiredRole="admin">
              <AdminRoutes />
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};
```

**Impact**: Proper security enforcement, prevents unauthorized access, secure CORS
**Effort**: 5 hours

## Phase 2: Component Architecture Refactoring (Week 2)

### 2.1 Decompose Monolithic Dashboard Component
**Priority**: HIGH - Maintainability
**Issue**: 513-line component violating single responsibility principle

**Solution**: Component decomposition using Container/Presenter pattern
```typescript
// /frontend-react/src/components/dashboard/DashboardContainer.tsx - NEW FILE
interface DashboardContainerProps {
  user: User;
}

export const DashboardContainer: React.FC<DashboardContainerProps> = ({ user }) => {
  // Business logic and state management
  const [globalError, setGlobalError] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: enrolledCourses, error: coursesError, refetch } = useQuery({
    queryKey: ['enrolled-courses', user.id],
    queryFn: () => courseService.getEnrolledCourses(),
    staleTime: 5 * 60 * 1000
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      logger.info('Dashboard data refreshed');
    } catch (error) {
      logger.error('Failed to refresh dashboard', error);
      setGlobalError('Failed to refresh data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleErrorDismiss = () => {
    setGlobalError('');
  };

  // Error handling
  if (coursesError) {
    return (
      <DashboardErrorState
        error={coursesError}
        onRetry={handleRefresh}
        onErrorDismiss={handleErrorDismiss}
      />
    );
  }

  return (
    <DashboardPresenter
      user={user}
      courses={enrolledCourses || []}
      isLoading={isRefreshing}
      globalError={globalError}
      onRefresh={handleRefresh}
      onErrorDismiss={handleErrorDismiss}
    />
  );
};

// /frontend-react/src/components/dashboard/DashboardPresenter.tsx - NEW FILE
interface DashboardPresenterProps {
  user: User;
  courses: Course[];
  isLoading: boolean;
  globalError: string;
  onRefresh: () => void;
  onErrorDismiss: () => void;
}

export const DashboardPresenter: React.FC<DashboardPresenterProps> = ({
  user,
  courses,
  isLoading,
  globalError,
  onRefresh,
  onErrorDismiss
}) => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Global error display */}
      {globalError && (
        <GlobalErrorAlert
          message={globalError}
          onDismiss={onErrorDismiss}
        />
      )}

      {/* Dashboard header */}
      <DashboardHeader
        user={user}
        courseCount={courses.length}
        onRefresh={onRefresh}
        isRefreshing={isLoading}
      />

      {/* Course discovery section */}
      <CourseDiscoverySection />

      {/* Enrolled courses section */}
      <EnrolledCoursesSection
        courses={courses}
        isLoading={isLoading}
      />

      {/* Environment indicator */}
      <EnvironmentIndicator />
    </Container>
  );
};

// /frontend-react/src/components/dashboard/DashboardHeader.tsx - NEW FILE
interface DashboardHeaderProps {
  user: User;
  courseCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  courseCount,
  onRefresh,
  isRefreshing
}) => {
  const { logout } = useAuth();

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Welcome, {user.name || user.email}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={onRefresh}
            disabled={isRefreshing}
            size="large"
            aria-label="Refresh dashboard"
          >
            <Refresh className={isRefreshing ? 'rotating' : ''} />
          </IconButton>
          
          <Button
            variant="outlined"
            onClick={logout}
            startIcon={<ExitToApp />}
          >
            Logout
          </Button>
        </Box>
      </Box>

      <Typography variant="h6" color="text.secondary">
        You are enrolled in {courseCount} course{courseCount !== 1 ? 's' : ''}
      </Typography>
    </Box>
  );
};

// /frontend-react/src/components/dashboard/EnrolledCoursesSection.tsx - NEW FILE
interface EnrolledCoursesSectionProps {
  courses: Course[];
  isLoading: boolean;
}

export const EnrolledCoursesSection: React.FC<EnrolledCoursesSectionProps> = ({
  courses,
  isLoading
}) => {
  if (isLoading) {
    return <CoursesSkeleton />;
  }

  if (courses.length === 0) {
    return <EmptyCoursesState />;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        My Courses
      </Typography>
      
      <Grid container spacing={3}>
        {courses.map(course => (
          <Grid item xs={12} sm={6} md={4} key={course.id}>
            <CourseCard course={course} />
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

// /frontend-react/src/components/dashboard/CourseCard.tsx - NEW FILE
interface CourseCardProps {
  course: Course;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const navigate = useNavigate();
  const { invalidateEvents } = useInvalidateCourseEvents();
  
  const unenrollMutation = useMutation({
    mutationFn: () => courseService.unenrollFromCourse(course.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['enrolled-courses']);
      invalidateEvents(course.id);
    },
    onError: (error) => {
      logger.error('Unenrollment failed', error);
    }
  });

  const handleUnenroll = () => {
    const courseName = getCourseDisplayName(course);
    
    if (confirm(`Are you sure you want to unenroll from ${courseName}?`)) {
      unenrollMutation.mutate();
    }
  };

  const handleViewCourse = () => {
    navigate(`/course/${course.id}`);
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {getCourseDisplayName(course)}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {course.crn !== 'PERSONAL' ? `CRN: ${course.crn}` : 'Personal Course'}
        </Typography>
        
        {course.instructor && (
          <Typography variant="body2" color="text.secondary">
            Instructor: {course.instructor}
          </Typography>
        )}
      </CardContent>
      
      <CardActions>
        <Button
          size="small"
          onClick={handleViewCourse}
          startIcon={<Visibility />}
        >
          View
        </Button>
        
        <Button
          size="small"
          color="error"
          onClick={handleUnenroll}
          disabled={unenrollMutation.isLoading}
          startIcon={<ExitToApp />}
        >
          {unenrollMutation.isLoading ? 'Unenrolling...' : 'Unenroll'}
        </Button>
      </CardActions>
    </Card>
  );
};

// /frontend-react/src/utils/courseUtils.ts - NEW FILE
export const getCourseDisplayName = (course: Course): string => {
  return course.title || course.name || 'Untitled Course';
};

export const formatCourseCode = (course: Course): string => {
  if (course.crn && course.crn !== 'PERSONAL') {
    return `CRN: ${course.crn}`;
  }
  
  if (course.subject && course.course_number) {
    return `${course.subject} ${course.course_number}`;
  }
  
  return 'Personal Course';
};

// Updated main dashboard component
// /frontend-react/src/pages/StudentDashboard.tsx - SIMPLIFIED
export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardContainer user={user} />;
};
```

**Impact**: Easier testing, better maintainability, clearer separation of concerns
**Effort**: 12 hours

### 2.2 Centralized Error Handling System
**Priority**: MEDIUM - User Experience
**Issue**: Inconsistent error handling patterns across operations

**Solution**: Unified error management system
```typescript
// /frontend-react/src/services/errorService.ts - NEW FILE
interface ErrorContext {
  operation: string;
  userId?: string;
  courseId?: string;
  timestamp: string;
}

interface ErrorDisplayOptions {
  type: 'snackbar' | 'alert' | 'dialog';
  persist?: boolean;
  actions?: Array<{ label: string; action: () => void }>;
}

class ErrorService {
  private errorQueue: Array<{ message: string; options: ErrorDisplayOptions }> = [];
  private listeners: Array<(errors: typeof this.errorQueue) => void> = [];

  reportError(
    error: unknown,
    context: ErrorContext,
    displayOptions: ErrorDisplayOptions = { type: 'snackbar' }
  ): void {
    // Log error for debugging
    logger.error(`Operation failed: ${context.operation}`, {
      error: error instanceof Error ? error.message : error,
      context
    });

    // Send to monitoring service
    this.sendToMonitoring(error, context);

    // Determine user-friendly message
    const userMessage = this.getUserFriendlyMessage(error, context);

    // Add to display queue
    this.errorQueue.push({
      message: userMessage,
      options: displayOptions
    });

    // Notify listeners
    this.notifyListeners();
  }

  private getUserFriendlyMessage(error: unknown, context: ErrorContext): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const data = error.response?.data;

      switch (status) {
        case 401:
          return 'Your session has expired. Please log in again.';
        case 403:
          return 'You don\'t have permission to perform this action.';
        case 404:
          return `The requested ${context.operation} could not be found.`;
        case 409:
          return data?.detail || 'This action conflicts with existing data.';
        case 422:
          return 'Please check your input and try again.';
        case 500:
          return 'A server error occurred. Please try again later.';
        default:
          return data?.detail || `Failed to ${context.operation}. Please try again.`;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return `An unexpected error occurred during ${context.operation}.`;
  }

  private sendToMonitoring(error: unknown, context: ErrorContext): void {
    // Send to error monitoring service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: `${context.operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fatal: false,
        custom_map: {
          operation: context.operation,
          user_id: context.userId
        }
      });
    }
  }

  subscribe(listener: (errors: typeof this.errorQueue) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  dismissError(index: number): void {
    this.errorQueue.splice(index, 1);
    this.notifyListeners();
  }

  clearAllErrors(): void {
    this.errorQueue = [];
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.errorQueue]));
  }
}

export const errorService = new ErrorService();

// /frontend-react/src/hooks/useErrorHandler.ts - NEW FILE
export const useErrorHandler = () => {
  const { user } = useAuth();

  const handleError = (
    error: unknown,
    operation: string,
    options?: Partial<ErrorDisplayOptions>
  ) => {
    errorService.reportError(
      error,
      {
        operation,
        userId: user?.id,
        timestamp: new Date().toISOString()
      },
      { type: 'snackbar', ...options }
    );
  };

  const handleCourseError = (
    error: unknown,
    operation: string,
    courseId: string,
    options?: Partial<ErrorDisplayOptions>
  ) => {
    errorService.reportError(
      error,
      {
        operation,
        userId: user?.id,
        courseId,
        timestamp: new Date().toISOString()
      },
      { type: 'snackbar', ...options }
    );
  };

  return { handleError, handleCourseError };
};

// /frontend-react/src/components/error/GlobalErrorDisplay.tsx - NEW FILE
export const GlobalErrorDisplay: React.FC = () => {
  const [errors, setErrors] = useState<Array<{ message: string; options: ErrorDisplayOptions }>>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = errorService.subscribe(setErrors);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Show snackbar for new errors
    const snackbarErrors = errors.filter(e => e.options.type === 'snackbar');
    if (snackbarErrors.length > 0) {
      setSnackbarOpen(true);
    }
  }, [errors]);

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
    // Remove snackbar errors after closing
    setTimeout(() => {
      errors.forEach((error, index) => {
        if (error.options.type === 'snackbar') {
          errorService.dismissError(index);
        }
      });
    }, 200);
  };

  const snackbarErrors = errors.filter(e => e.options.type === 'snackbar');
  const alertErrors = errors.filter(e => e.options.type === 'alert');

  return (
    <>
      {/* Alert errors */}
      {alertErrors.map((error, index) => (
        <Alert
          key={index}
          severity="error"
          onClose={() => errorService.dismissError(index)}
          sx={{ mb: 2 }}
        >
          {error.message}
        </Alert>
      ))}

      {/* Snackbar errors */}
      <Snackbar
        open={snackbarOpen && snackbarErrors.length > 0}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="error"
          sx={{ width: '100%' }}
        >
          {snackbarErrors[0]?.message}
          {snackbarErrors.length > 1 && (
            <Typography variant="caption" display="block">
              +{snackbarErrors.length - 1} more error{snackbarErrors.length > 2 ? 's' : ''}
            </Typography>
          )}
        </Alert>
      </Snackbar>
    </>
  );
};

// Usage in components
const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { handleCourseError } = useErrorHandler();
  
  const unenrollMutation = useMutation({
    mutationFn: () => courseService.unenrollFromCourse(course.id),
    onError: (error) => {
      handleCourseError(error, 'unenroll from course', course.id, {
        type: 'alert',
        persist: true
      });
    }
  });

  // Rest of component...
};
```

**Impact**: Consistent error handling, better user experience, easier debugging
**Effort**: 8 hours

## Phase 3: Security Hardening & Performance (Week 3)

### 3.1 Implement Security Headers & CSP
**Priority**: MEDIUM - Security
**Issue**: Missing security headers and content security policy

**Solution**: Comprehensive security headers implementation
```python
# /backend/app/middleware/security_headers.py - NEW FILE
from fastapi import Request, Response
from typing import Dict

class SecurityHeadersMiddleware:
    """Add security headers to all responses"""
    
    def __init__(self):
        self.security_headers = self._get_security_headers()
    
    def _get_security_headers(self) -> Dict[str, str]:
        """Define security headers based on environment"""
        
        # Base security headers
        headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        }
        
        # Environment-specific CSP
        environment = os.getenv("ENVIRONMENT", "development")
        
        if environment == "production":
            headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://syllaai-ai.onrender.com; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
            
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            
        elif environment == "staging":
            headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "connect-src 'self' https://staging-syllaai-ai.onrender.com http://localhost:8001; "
                "img-src 'self' data: https:; "
                "frame-ancestors 'none'"
            )
            
        else:  # development
            headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "connect-src 'self' http://localhost:8001 ws://localhost:*; "
                "img-src 'self' data: https: http:; "
                "frame-ancestors 'none'"
            )
        
        return headers
    
    async def __call__(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        for header, value in self.security_headers.items():
            response.headers[header] = value
        
        return response

# Apply middleware
app.add_middleware(SecurityHeadersMiddleware)
```

**Frontend security enhancements**:
```typescript
// /frontend-react/src/security/sanitizer.ts - NEW FILE
import DOMPurify from 'dompurify';

class SecuritySanitizer {
  private allowedTags = ['b', 'i', 'em', 'strong', 'u', 'br', 'p'];
  
  sanitizeHTML(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: this.allowedTags,
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false
    });
  }
  
  sanitizeText(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .trim();
  }
  
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }
  
  validateCourseCode(code: string): boolean {
    // Only allow alphanumeric characters and basic punctuation
    const codeRegex = /^[A-Z0-9\-\s]{1,20}$/i;
    return codeRegex.test(code);
  }
}

export const sanitizer = new SecuritySanitizer();

// /frontend-react/src/hooks/useSecureInput.ts - NEW FILE
export const useSecureInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);
  const [sanitizedValue, setSanitizedValue] = useState(initialValue);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const sanitized = sanitizer.sanitizeText(rawValue);
    
    setValue(rawValue);
    setSanitizedValue(sanitized);
  };

  return {
    value,
    sanitizedValue,
    onChange: handleChange,
    isSafe: value === sanitizedValue
  };
};
```

**Impact**: Better security posture, XSS protection, secure headers
**Effort**: 6 hours

### 3.2 Performance Optimization & Monitoring
**Priority**: LOW - Performance
**Issue**: Potential performance issues with large components and unnecessary re-renders

**Solution**: Performance optimization and monitoring
```typescript
// /frontend-react/src/hooks/usePerformanceMonitoring.ts - NEW FILE
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  
  startTiming(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(name, duration);
      
      // Log slow operations
      if (duration > 1000) {
        logger.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  }
  
  recordMetric(name: string, value: number): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now()
    });
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }
  
  getAverageTime(name: string): number {
    const relevantMetrics = this.metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  }
  
  reportToAnalytics(): void {
    if (window.gtag && envConfig.enableAnalytics) {
      const avgDashboardLoad = this.getAverageTime('dashboard-load');
      
      if (avgDashboardLoad > 0) {
        window.gtag('event', 'timing_complete', {
          name: 'dashboard_load',
          value: Math.round(avgDashboardLoad)
        });
      }
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Performance monitoring hook
export const usePerformanceMonitoring = (operationName: string) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const startOperation = useCallback(() => {
    setIsLoading(true);
    const endTiming = performanceMonitor.startTiming(operationName);
    
    return () => {
      endTiming();
      setIsLoading(false);
    };
  }, [operationName]);
  
  return { isLoading, startOperation };
};

// Optimized components with React.memo and useMemo
// /frontend-react/src/components/dashboard/CourseCard.tsx - OPTIMIZED
export const CourseCard: React.FC<CourseCardProps> = React.memo(({ course }) => {
  const navigate = useNavigate();
  const { invalidateEvents } = useInvalidateCourseEvents();
  const { handleCourseError } = useErrorHandler();
  
  // Memoize expensive calculations
  const courseDisplayName = useMemo(() => getCourseDisplayName(course), [course]);
  const courseCode = useMemo(() => formatCourseCode(course), [course]);
  
  const unenrollMutation = useMutation({
    mutationFn: () => courseService.unenrollFromCourse(course.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['enrolled-courses']);
      invalidateEvents(course.id);
    },
    onError: (error) => {
      handleCourseError(error, 'unenroll from course', course.id);
    }
  });

  const handleUnenroll = useCallback(() => {
    if (confirm(`Are you sure you want to unenroll from ${courseDisplayName}?`)) {
      unenrollMutation.mutate();
    }
  }, [courseDisplayName, unenrollMutation]);

  const handleViewCourse = useCallback(() => {
    navigate(`/course/${course.id}`);
  }, [navigate, course.id]);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {courseDisplayName}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {courseCode}
        </Typography>
        
        {course.instructor && (
          <Typography variant="body2" color="text.secondary">
            Instructor: {course.instructor}
          </Typography>
        )}
      </CardContent>
      
      <CardActions>
        <Button
          size="small"
          onClick={handleViewCourse}
          startIcon={<Visibility />}
        >
          View
        </Button>
        
        <Button
          size="small"
          color="error"
          onClick={handleUnenroll}
          disabled={unenrollMutation.isLoading}
          startIcon={<ExitToApp />}
        >
          {unenrollMutation.isLoading ? 'Unenrolling...' : 'Unenroll'}
        </Button>
      </CardActions>
    </Card>
  );
});

// Add display name for debugging
CourseCard.displayName = 'CourseCard';

// Performance monitoring in dashboard
export const DashboardContainer: React.FC<DashboardContainerProps> = ({ user }) => {
  const { startOperation } = usePerformanceMonitoring('dashboard-load');
  
  useEffect(() => {
    const endTiming = startOperation();
    
    return () => {
      endTiming();
      // Report metrics after component unmounts
      setTimeout(() => performanceMonitor.reportToAnalytics(), 1000);
    };
  }, [startOperation]);

  // Rest of component...
};
```

**Impact**: Better performance, performance insights, optimized re-renders
**Effort**: 6 hours

## Phase 4: Testing & Documentation (Week 4)

### 4.1 Comprehensive Testing Suite
**Priority**: MEDIUM - Quality Assurance
**Issue**: Component complexity makes testing difficult

**Solution**: Comprehensive testing with clear separation of concerns
```typescript
// /frontend-react/src/components/dashboard/__tests__/DashboardContainer.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { DashboardContainer } from '../DashboardContainer';
import { AuthProvider } from '../../auth/AuthProvider';
import * as courseService from '../../../services/courseService';

// Mock dependencies
jest.mock('../../../services/courseService');
jest.mock('../../../utils/logger');

const mockCourseService = courseService as jest.Mocked<typeof courseService>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const mockUser = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'student' as const
};

const mockCourses = [
  {
    id: '1',
    title: 'Test Course 1',
    crn: 'TEST001',
    instructor: 'Dr. Test'
  },
  {
    id: '2',
    title: 'Test Course 2',
    crn: 'PERSONAL',
    instructor: null
  }
];

describe('DashboardContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with user courses', async () => {
    mockCourseService.getEnrolledCourses.mockResolvedValue(mockCourses);

    render(<DashboardContainer user={mockUser} />, { wrapper: createWrapper() });

    expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      expect(screen.getByText('Test Course 2')).toBeInTheDocument();
    });
  });

  it('handles course service errors gracefully', async () => {
    const error = new Error('Service unavailable');
    mockCourseService.getEnrolledCourses.mockRejectedValue(error);

    render(<DashboardContainer user={mockUser} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('allows course unenrollment', async () => {
    mockCourseService.getEnrolledCourses.mockResolvedValue(mockCourses);
    mockCourseService.unenrollFromCourse.mockResolvedValue({ success: true });

    render(<DashboardContainer user={mockUser} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Course 1')).toBeInTheDocument();
    });

    const unenrollButton = screen.getAllByText('Unenroll')[0];
    await userEvent.click(unenrollButton);

    // Confirm dialog
    await userEvent.click(screen.getByRole('button', { name: /ok|confirm/i }));

    await waitFor(() => {
      expect(mockCourseService.unenrollFromCourse).toHaveBeenCalledWith('1');
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    mockCourseService.getEnrolledCourses.mockResolvedValue(mockCourses);

    render(<DashboardContainer user={mockUser} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Course 1')).toBeInTheDocument();
    });

    const refreshButton = screen.getByLabelText('Refresh dashboard');
    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockCourseService.getEnrolledCourses).toHaveBeenCalledTimes(2);
    });
  });
});

// /frontend-react/src/components/dashboard/__tests__/CourseCard.test.tsx
describe('CourseCard', () => {
  const mockCourse = {
    id: '1',
    title: 'Test Course',
    crn: 'TEST001',
    instructor: 'Dr. Test'
  };

  it('displays course information correctly', () => {
    render(<CourseCard course={mockCourse} />, { wrapper: createWrapper() });

    expect(screen.getByText('Test Course')).toBeInTheDocument();
    expect(screen.getByText('CRN: TEST001')).toBeInTheDocument();
    expect(screen.getByText('Instructor: Dr. Test')).toBeInTheDocument();
  });

  it('handles personal courses correctly', () => {
    const personalCourse = { ...mockCourse, crn: 'PERSONAL', instructor: null };

    render(<CourseCard course={personalCourse} />, { wrapper: createWrapper() });

    expect(screen.getByText('Personal Course')).toBeInTheDocument();
    expect(screen.queryByText('Instructor:')).not.toBeInTheDocument();
  });

  it('navigates to course view when view button is clicked', async () => {
    const mockNavigate = jest.fn();
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate
    }));

    render(<CourseCard course={mockCourse} />, { wrapper: createWrapper() });

    const viewButton = screen.getByText('View');
    await userEvent.click(viewButton);

    expect(mockNavigate).toHaveBeenCalledWith('/course/1');
  });
});

// Integration tests
// /frontend-react/src/__tests__/StudentDashboard.integration.test.tsx
describe('Student Dashboard Integration', () => {
  it('completes full user workflow', async () => {
    // Mock successful authentication
    const mockAuth = {
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn()
    };

    jest.mock('../hooks/useAuth', () => ({
      useAuth: () => mockAuth
    }));

    mockCourseService.getEnrolledCourses.mockResolvedValue(mockCourses);

    render(<StudentDashboard />, { wrapper: createWrapper() });

    // Should show welcome message
    await waitFor(() => {
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
    });

    // Should load and display courses
    await waitFor(() => {
      expect(screen.getByText('You are enrolled in 2 courses')).toBeInTheDocument();
    });

    // Should allow navigation to individual course
    const viewButtons = screen.getAllByText('View');
    await userEvent.click(viewButtons[0]);

    // Navigation should be called
    // (verify through router mock or URL changes)
  });
});
```

**Testing utilities and setup**:
```typescript
// /frontend-react/src/test-utils/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Mock window.gtag
Object.defineProperty(window, 'gtag', {
  value: jest.fn(),
  writable: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn()
  }
});

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// /frontend-react/src/test-utils/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/courses/enrolled', (req, res, ctx) => {
    return res(ctx.json(mockCourses));
  }),

  rest.delete('/api/courses/:courseId/unenroll', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  }),

  rest.post('/auth/logout', (req, res, ctx) => {
    return res(ctx.json({ message: 'Logged out successfully' }));
  })
];
```

**Impact**: Better code quality, regression prevention, easier refactoring
**Effort**: 10 hours

### 4.2 Documentation & Developer Experience
**Priority**: LOW - Developer Experience
**Issue**: Component complexity requires good documentation

**Solution**: Comprehensive documentation and developer tools
```typescript
// /frontend-react/src/components/dashboard/README.md
# Student Dashboard Components

## Overview

The student dashboard is decomposed into focused, testable components following the Container/Presenter pattern.

## Architecture

```
StudentDashboard (Page)
├── DashboardContainer (Business Logic)
└── DashboardPresenter (UI Rendering)
    ├── DashboardHeader
    ├── CourseDiscoverySection
    ├── EnrolledCoursesSection
    │   └── CourseCard (multiple)
    └── EnvironmentIndicator
```

## Components

### DashboardContainer
**Purpose**: Manages business logic and data fetching
**Props**: `{ user: User }`
**Responsibilities**:
- Fetch enrolled courses
- Handle global error state
- Coordinate refresh operations

### DashboardPresenter  
**Purpose**: Pure UI component for rendering dashboard
**Props**: `{ user, courses, isLoading, globalError, onRefresh, onErrorDismiss }`
**Responsibilities**:
- Layout and UI rendering only
- No business logic

### CourseCard
**Purpose**: Display individual course with actions
**Props**: `{ course: Course }`
**Responsibilities**:
- Display course information
- Handle unenroll actions
- Navigate to course details

## Error Handling

All components use the centralized error service:

```typescript
const { handleError, handleCourseError } = useErrorHandler();

// For general errors
handleError(error, 'operation name');

// For course-specific errors
handleCourseError(error, 'operation name', courseId);
```

## Performance Considerations

- `CourseCard` is memoized with `React.memo`
- Expensive calculations use `useMemo`
- Event handlers use `useCallback`
- Performance monitoring tracks load times

## Security Features

- All user input is sanitized
- Environment-based feature flags
- Secure token storage
- CSRF protection

## Testing

```bash
# Run all dashboard tests
npm test -- --testNamePattern="Dashboard"

# Run specific component tests
npm test CourseCard.test.tsx

# Run integration tests
npm test -- --testNamePattern="integration"
```

## Development

```bash
# Start development server
npm run dev

# Enable debug logging
VITE_ENABLE_LOGGING=true npm run dev

# Build for production
npm run build

# Analyze bundle size
npm run analyze
```

// /frontend-react/src/types/dashboard.ts - TYPE DEFINITIONS
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'student' | 'professor' | 'admin';
}

export interface Course {
  id: string;
  title?: string;
  name?: string;
  crn: string;
  instructor?: string;
  subject?: string;
  course_number?: string;
  description?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  message?: string;
}

// Development tools
// /frontend-react/src/dev-tools/DashboardDebugger.tsx
export const DashboardDebugger: React.FC = () => {
  const { user } = useAuth();
  const [showDebug, setShowDebug] = useState(false);

  // Only show in development
  if (!envConfig.features.debugMode) {
    return null;
  }

  return (
    <>
      <Fab
        color="secondary"
        size="small"
        onClick={() => setShowDebug(!showDebug)}
        sx={{ position: 'fixed', bottom: 80, right: 16 }}
      >
        <BugReport />
      </Fab>

      <Drawer
        anchor="right"
        open={showDebug}
        onClose={() => setShowDebug(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Dashboard Debug Info
          </Typography>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              User Information
            </AccordionSummary>
            <AccordionDetails>
              <pre>{JSON.stringify(user, null, 2)}</pre>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              Performance Metrics
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Average Load Time: {performanceMonitor.getAverageTime('dashboard-load').toFixed(2)}ms
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => errorService.clearAllErrors()}
            >
              Clear All Errors
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};
```

**Impact**: Better developer experience, easier maintenance, clear architecture
**Effort**: 4 hours

## Implementation Timeline

### Week 1: Critical Security (22 hours)
- Remove production debug logging with build-time stripping
- Implement secure session management and token storage
- Remove environment banner and information disclosure
- Fix CORS and implement server-side route protection

### Week 2: Architecture Refactoring (20 hours)
- Decompose monolithic component into focused components
- Implement centralized error handling system
- Create reusable hooks and utilities

### Week 3: Security & Performance (12 hours)
- Implement security headers and CSP
- Add performance monitoring and optimization
- Input sanitization and validation

### Week 4: Testing & Documentation (14 hours)
- Comprehensive testing suite with mocks
- Documentation and developer tools
- Integration testing

**Total Effort**: ~68 hours (8.5 working days)

## Dependencies & Considerations

**Security Review**: CSP headers may need adjustment based on third-party services
**Performance Testing**: Load testing needed to validate optimization benefits
**Browser Compatibility**: Security features need testing across browsers
**Deployment Pipeline**: Build-time optimizations need CI/CD integration

## Success Metrics

1. **Security**: Zero information disclosure, secure session management, proper CORS
2. **Performance**: Dashboard loads within 1 second, no unnecessary re-renders
3. **Maintainability**: Components under 100 lines, clear separation of concerns
4. **User Experience**: Consistent error handling, professional appearance
5. **Developer Experience**: 90%+ test coverage, clear documentation

This fix plan transforms the supporting dashboard infrastructure from a security-vulnerable, monolithic component into a secure, maintainable, and production-ready system while maintaining all existing functionality and improving the overall user experience.