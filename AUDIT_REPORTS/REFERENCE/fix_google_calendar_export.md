# Fix Plan: Google Calendar Export Functionality

## Executive Summary

This fix plan addresses 11 critical security and architectural issues in the Google Calendar integration by consolidating duplicate services, implementing secure token management, and simplifying the overly complex OAuth and timezone handling. Building on the encryption and service patterns from previous fixes, this plan creates a secure, maintainable calendar integration system.

## Phase 1: Critical Security Fixes (Week 1)

### 1.1 Implement Secure Token Storage
**Priority**: CRITICAL - Security
**Issue**: Google OAuth tokens stored in database without encryption

**Solution**: Encrypted token storage using established encryption patterns
```python
# /backend/app/services/secure_token_service.py - NEW FILE
from cryptography.fernet import Fernet
from typing import Optional, Dict
import os
from datetime import datetime, timedelta
from ..utils.logger import get_logger

logger = get_logger(__name__)

class SecureTokenService:
    def __init__(self):
        key = os.getenv('API_ENCRYPTION_KEY')
        if not key:
            raise ValueError("API_ENCRYPTION_KEY environment variable not set")
        self.cipher = Fernet(key.encode())
    
    def encrypt_oauth_tokens(self, token_data: Dict[str, str]) -> Dict[str, str]:
        """Encrypt OAuth token data for secure storage"""
        encrypted_tokens = {}
        
        for key, value in token_data.items():
            if value and key in ['access_token', 'refresh_token']:
                try:
                    encrypted_tokens[f"{key}_encrypted"] = self.cipher.encrypt(value.encode()).decode()
                except Exception as e:
                    logger.error(f"Failed to encrypt {key}: {e}")
                    raise ValueError(f"Token encryption failed for {key}")
            else:
                encrypted_tokens[key] = value
        
        return encrypted_tokens
    
    def decrypt_oauth_tokens(self, encrypted_data: Dict[str, str]) -> Dict[str, str]:
        """Decrypt OAuth tokens for use"""
        decrypted_tokens = {}
        
        for key, value in encrypted_data.items():
            if key.endswith('_encrypted') and value:
                try:
                    original_key = key.replace('_encrypted', '')
                    decrypted_tokens[original_key] = self.cipher.decrypt(value.encode()).decode()
                except Exception as e:
                    logger.error(f"Failed to decrypt {key}: {e}")
                    raise ValueError(f"Token decryption failed for {key}")
            elif not key.endswith('_encrypted'):
                decrypted_tokens[key] = value
        
        return decrypted_tokens
    
    def is_token_expired(self, expires_at: datetime) -> bool:
        """Check if token is expired with 5 minute buffer"""
        buffer = timedelta(minutes=5)
        return datetime.utcnow() + buffer >= expires_at

# Update User model to support encrypted tokens
# /backend/app/models/user.py - UPDATED
class User(Base):
    __tablename__ = "users"
    
    # ... existing fields ...
    
    # Replace plaintext token fields with encrypted versions
    google_access_token_encrypted = Column(Text, nullable=True)
    google_refresh_token_encrypted = Column(Text, nullable=True)
    google_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    google_token_scope = Column(String(500), nullable=True)  # Store granted scopes
    
    # Keep old fields for migration period, will be removed
    google_access_token = Column(Text, nullable=True)  # DEPRECATED
    google_refresh_token = Column(Text, nullable=True)  # DEPRECATED

# Migration to encrypt existing tokens
# /backend/alembic/versions/encrypt_oauth_tokens.py
def upgrade():
    # Add new encrypted columns
    op.add_column('users', sa.Column('google_access_token_encrypted', sa.Text, nullable=True))
    op.add_column('users', sa.Column('google_refresh_token_encrypted', sa.Text, nullable=True))
    op.add_column('users', sa.Column('google_token_scope', sa.String(500), nullable=True))
    
    # Encrypt existing tokens (if encryption key is available)
    # This would be done in a separate data migration script for safety
```

**Impact**: Eliminates critical security vulnerability, protects user tokens
**Effort**: 6 hours

### 1.2 Fix OAuth Flow Security
**Priority**: CRITICAL - Security  
**Issue**: OAuth flow lacks state parameter for CSRF protection, manual URL construction

**Solution**: Secure OAuth implementation with proper CSRF protection
```python
# /backend/app/services/secure_oauth_service.py - NEW FILE
import secrets
import urllib.parse
from typing import Dict, Optional
from fastapi import HTTPException
from ..config import settings

class SecureOAuthService:
    def __init__(self):
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret
        self.redirect_uri = settings.google_redirect_uri
        self.token_service = SecureTokenService()
        
        # OAuth state storage (in production, use Redis)
        self._oauth_states = {}  # user_id -> state
    
    def generate_oauth_url(self, user_id: str) -> str:
        """Generate secure OAuth URL with CSRF protection"""
        
        # Generate cryptographically secure state parameter
        state = secrets.token_urlsafe(32)
        self._oauth_states[user_id] = {
            'state': state,
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(minutes=10)
        }
        
        # Use proper URL building instead of string concatenation
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'https://www.googleapis.com/auth/calendar',
            'response_type': 'code',
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state,
            'include_granted_scopes': 'true'
        }
        
        # Properly encode parameters
        query_string = urllib.parse.urlencode(params)
        oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"
        
        logger.info(f"Generated OAuth URL for user {user_id}")
        return oauth_url
    
    async def handle_oauth_callback(
        self, 
        code: str, 
        state: str, 
        user_id: str
    ) -> Dict[str, str]:
        """Handle OAuth callback with state validation"""
        
        # Validate state parameter (CSRF protection)
        stored_state = self._oauth_states.get(user_id)
        if not stored_state:
            raise HTTPException(400, "OAuth state not found. Please restart the authorization process.")
        
        if stored_state['state'] != state:
            raise HTTPException(400, "Invalid OAuth state. Possible CSRF attack detected.")
        
        if datetime.utcnow() > stored_state['expires_at']:
            raise HTTPException(400, "OAuth state expired. Please restart the authorization process.")
        
        # Clean up used state
        del self._oauth_states[user_id]
        
        # Exchange code for tokens
        try:
            token_data = await self._exchange_code_for_tokens(code)
            
            # Encrypt tokens before returning
            encrypted_tokens = self.token_service.encrypt_oauth_tokens(token_data)
            
            return encrypted_tokens
            
        except Exception as e:
            logger.error(f"OAuth token exchange failed for user {user_id}: {e}")
            raise HTTPException(500, "Failed to complete Google authorization")
    
    async def _exchange_code_for_tokens(self, code: str) -> Dict[str, str]:
        """Exchange authorization code for tokens"""
        import httpx
        
        token_url = "https://oauth2.googleapis.com/token"
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data, timeout=30)
            response.raise_for_status()
            
            token_data = response.json()
            
            # Calculate expiration time
            expires_in = token_data.get('expires_in', 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return {
                'access_token': token_data['access_token'],
                'refresh_token': token_data.get('refresh_token'),
                'token_type': token_data.get('token_type', 'Bearer'),
                'scope': token_data.get('scope', ''),
                'expires_at': expires_at.isoformat()
            }

# Secure OAuth endpoints
# /backend/app/routers/google_oauth.py - NEW FILE
from fastapi import APIRouter, Depends, HTTPException, Query
from ..services.secure_oauth_service import SecureOAuthService

router = APIRouter(prefix="/api/auth/google", tags=["google_oauth"])

@router.get("/authorize")
async def start_google_authorization(
    current_user: User = Depends(get_current_user)
):
    """Start Google Calendar authorization flow"""
    
    oauth_service = SecureOAuthService()
    auth_url = oauth_service.generate_oauth_url(str(current_user.id))
    
    return {
        "auth_url": auth_url,
        "message": "Visit the auth_url to authorize Google Calendar access"
    }

@router.get("/callback")
async def handle_google_callback(
    code: str = Query(...),
    state: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback"""
    
    oauth_service = SecureOAuthService()
    
    try:
        encrypted_tokens = await oauth_service.handle_oauth_callback(
            code, state, str(current_user.id)
        )
        
        # Store encrypted tokens
        current_user.google_access_token_encrypted = encrypted_tokens.get('access_token_encrypted')
        current_user.google_refresh_token_encrypted = encrypted_tokens.get('refresh_token_encrypted')
        current_user.google_token_expires_at = datetime.fromisoformat(encrypted_tokens['expires_at'])
        current_user.google_token_scope = encrypted_tokens.get('scope')
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Google Calendar authorization completed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        raise HTTPException(500, "Authorization failed")
```

**Impact**: Prevents CSRF attacks, secures OAuth flow, improves reliability
**Effort**: 8 hours

### 1.3 Consolidate Duplicate Calendar Services
**Priority**: HIGH - Maintainability
**Issue**: Two separate calendar services with overlapping functionality

**Solution**: Single, unified calendar service
```python
# /backend/app/services/unified_calendar_service.py - NEW FILE
import httpx
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from ..models.user import User
from ..models.course_event import CourseEvent
from ..services.secure_token_service import SecureTokenService
from ..utils.logger import get_logger

logger = get_logger(__name__)

class UnifiedCalendarService:
    """Consolidated Google Calendar service replacing both old services"""
    
    def __init__(self):
        self.token_service = SecureTokenService()
        self.base_url = "https://www.googleapis.com/calendar/v3"
        
    async def get_valid_access_token(self, user: User) -> Optional[str]:
        """Get valid access token, refreshing if necessary"""
        
        if not user.google_access_token_encrypted:
            return None
        
        # Check if token is expired
        if (user.google_token_expires_at and 
            self.token_service.is_token_expired(user.google_token_expires_at)):
            
            # Try to refresh token
            if user.google_refresh_token_encrypted:
                try:
                    new_tokens = await self._refresh_access_token(user)
                    return new_tokens['access_token']
                except Exception as e:
                    logger.error(f"Token refresh failed for user {user.id}: {e}")
                    return None
            else:
                logger.warning(f"No refresh token available for user {user.id}")
                return None
        
        # Decrypt and return current token
        try:
            tokens = self.token_service.decrypt_oauth_tokens({
                'access_token_encrypted': user.google_access_token_encrypted
            })
            return tokens.get('access_token')
        except Exception as e:
            logger.error(f"Token decryption failed for user {user.id}: {e}")
            return None
    
    async def _refresh_access_token(self, user: User) -> Dict[str, str]:
        """Refresh expired access token"""
        
        # Decrypt refresh token
        tokens = self.token_service.decrypt_oauth_tokens({
            'refresh_token_encrypted': user.google_refresh_token_encrypted
        })
        refresh_token = tokens.get('refresh_token')
        
        if not refresh_token:
            raise ValueError("No refresh token available")
        
        # Call Google token refresh endpoint
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            'client_id': settings.google_client_id,
            'client_secret': settings.google_client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data, timeout=30)
            response.raise_for_status()
            
            token_data = response.json()
            
            # Update user tokens
            expires_in = token_data.get('expires_in', 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            new_token_data = {
                'access_token': token_data['access_token'],
                'expires_at': expires_at.isoformat()
            }
            
            # Encrypt new access token
            encrypted_tokens = self.token_service.encrypt_oauth_tokens(new_token_data)
            
            # Update user record
            user.google_access_token_encrypted = encrypted_tokens['access_token_encrypted']
            user.google_token_expires_at = expires_at
            
            # Update refresh token if provided
            if 'refresh_token' in token_data:
                refresh_encrypted = self.token_service.encrypt_oauth_tokens({
                    'refresh_token': token_data['refresh_token']
                })
                user.google_refresh_token_encrypted = refresh_encrypted['refresh_token_encrypted']
            
            return new_token_data
    
    async def create_calendar_events(
        self, 
        user: User, 
        events: List[CourseEvent], 
        course_name: str,
        calendar_preference: str = "primary"
    ) -> Dict[str, any]:
        """Create calendar events with user consent and preference"""
        
        access_token = await self.get_valid_access_token(user)
        if not access_token:
            raise ValueError("No valid Google Calendar access token")
        
        # Get or create calendar based on preference
        calendar_id = await self._get_calendar_for_events(
            access_token, calendar_preference, course_name
        )
        
        # Create events in batch for better performance
        results = await self._create_events_batch(
            access_token, calendar_id, events, course_name
        )
        
        return {
            "calendar_id": calendar_id,
            "events_created": len(results['successful']),
            "events_failed": len(results['failed']),
            "results": results
        }
    
    async def _get_calendar_for_events(
        self, 
        access_token: str, 
        preference: str, 
        course_name: str
    ) -> str:
        """Get calendar ID based on user preference"""
        
        if preference == "primary":
            return "primary"
        
        elif preference == "syllaai":
            # Check if SyllabAI calendar exists
            calendar_id = await self._find_syllaai_calendar(access_token)
            
            if not calendar_id:
                # Create SyllabAI calendar with user consent (handled in UI)
                calendar_id = await self._create_syllaai_calendar(access_token)
            
            return calendar_id
        
        elif preference == "course_specific":
            # Create course-specific calendar
            return await self._create_course_calendar(access_token, course_name)
        
        else:
            return "primary"  # Fallback
    
    async def _create_events_batch(
        self, 
        access_token: str, 
        calendar_id: str, 
        events: List[CourseEvent], 
        course_name: str
    ) -> Dict[str, List]:
        """Create events in efficient batches"""
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        successful = []
        failed = []
        
        # Process events in smaller batches to avoid timeout
        batch_size = 10
        
        async with httpx.AsyncClient() as client:
            for i in range(0, len(events), batch_size):
                batch = events[i:i + batch_size]
                
                for event in batch:
                    try:
                        calendar_event = self._format_event_for_calendar(event, course_name)
                        
                        response = await client.post(
                            f"{self.base_url}/calendars/{calendar_id}/events",
                            headers=headers,
                            json=calendar_event,
                            timeout=30
                        )
                        response.raise_for_status()
                        
                        successful.append({
                            'event_id': str(event.id),
                            'google_event_id': response.json()['id'],
                            'title': event.title
                        })
                        
                    except Exception as e:
                        logger.warning(f"Failed to create calendar event {event.title}: {e}")
                        failed.append({
                            'event_id': str(event.id),
                            'title': event.title,
                            'error': str(e)
                        })
                
                # Small delay between batches to be respectful to API
                if i + batch_size < len(events):
                    await asyncio.sleep(0.1)
        
        return {'successful': successful, 'failed': failed}
    
    def _format_event_for_calendar(
        self, 
        event: CourseEvent, 
        course_name: str
    ) -> Dict[str, any]:
        """Format course event for Google Calendar with simplified timezone handling"""
        
        # Use simple timezone handling - let Google handle complexity
        start_time = event.start_ts
        end_time = event.end_ts
        
        # Ensure timezone awareness
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        return {
            'summary': event.title,
            'description': f"Course: {course_name}\n\n{event.description or ''}\n\nCreated by SyllabAI",
            'location': event.location or '',
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': str(start_time.tzinfo)
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': str(end_time.tzinfo)
            },
            'colorId': self._get_color_for_category(event.category),
            'reminders': {
                'useDefault': False,
                'overrides': self._get_reminders_for_category(event.category)
            }
        }
    
    def _get_color_for_category(self, category: str) -> str:
        """Simple color mapping for event categories"""
        color_map = {
            'exam': '11',      # Red
            'quiz': '11',      # Red
            'assignment': '5', # Yellow
            'project': '9',    # Blue
            'class': '1',      # Lavender
            'other': '7'       # Cyan
        }
        return color_map.get(category.lower(), '7')
    
    def _get_reminders_for_category(self, category: str) -> List[Dict]:
        """Simple reminder settings"""
        if category.lower() in ['exam', 'quiz']:
            return [{'method': 'popup', 'minutes': 60}]  # 1 hour before
        elif category.lower() == 'assignment':
            return [{'method': 'popup', 'minutes': 1440}]  # 1 day before
        else:
            return [{'method': 'popup', 'minutes': 15}]  # 15 minutes before

# Remove old calendar services
# DELETE: /backend/app/services/calendar_service.py
# DELETE: /backend/app/services/google_calendar.py
```

**Impact**: Reduces complexity, eliminates duplication, improves maintainability
**Effort**: 10 hours

## Phase 2: User Experience & Architecture Improvements (Week 2)

### 2.1 Implement User-Centric Calendar Options
**Priority**: MEDIUM - User Experience
**Issue**: Forced calendar creation without user consent

**Solution**: User choice and consent-based calendar management
```typescript
// /frontend-react/src/components/calendar/CalendarExportDialog.tsx - NEW FILE
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Alert,
  Box
} from '@mui/material';

interface CalendarExportDialogProps {
  open: boolean;
  courseTitle: string;
  eventCount: number;
  onExport: (preference: CalendarPreference) => void;
  onCancel: () => void;
}

type CalendarPreference = 'primary' | 'syllaai' | 'course_specific';

export const CalendarExportDialog: React.FC<CalendarExportDialogProps> = ({
  open,
  courseTitle,
  eventCount,
  onExport,
  onCancel
}) => {
  const [preference, setPreference] = useState<CalendarPreference>('primary');

  const handleExport = () => {
    onExport(preference);
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>
        Export to Google Calendar
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Export {eventCount} events from "{courseTitle}" to your Google Calendar.
        </Typography>

        <FormControl component="fieldset">
          <FormLabel component="legend">Where would you like to add these events?</FormLabel>
          <RadioGroup
            value={preference}
            onChange={(e) => setPreference(e.target.value as CalendarPreference)}
          >
            <FormControlLabel
              value="primary"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2"><strong>Primary Calendar</strong></Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add events directly to your main Google Calendar
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              value="syllaai"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2"><strong>SyllabAI Calendar</strong></Typography>
                  <Typography variant="caption" color="text.secondary">
                    Create a separate calendar for all SyllabAI events
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              value="course_specific"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2"><strong>Course-Specific Calendar</strong></Typography>
                  <Typography variant="caption" color="text.secondary">
                    Create a calendar just for this course: "{courseTitle}"
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            You can change or remove these events from your Google Calendar at any time.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleExport} variant="contained">
          Export Events
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

**Backend integration**:
```python
# /backend/app/routers/calendar_export.py - NEW FILE
from fastapi import APIRouter, Depends, HTTPException
from ..services.unified_calendar_service import UnifiedCalendarService

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

@router.post("/export")
async def export_course_events(
    request: CalendarExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export course events to Google Calendar with user preferences"""
    
    # Get course and verify access
    course = db.query(Course).filter(Course.id == request.course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")
    
    # Check user has access to course
    if not _user_has_course_access(current_user, course, db):
        raise HTTPException(403, "Access denied to course")
    
    # Get course events
    events = db.query(CourseEvent).filter(
        CourseEvent.course_id == request.course_id
    ).all()
    
    if not events:
        return {"message": "No events to export", "events_exported": 0}
    
    # Export to calendar
    calendar_service = UnifiedCalendarService()
    
    try:
        result = await calendar_service.create_calendar_events(
            current_user,
            events,
            course.title,
            request.calendar_preference
        )
        
        return {
            "message": f"Successfully exported {result['events_created']} events",
            "events_created": result['events_created'],
            "events_failed": result['events_failed'],
            "calendar_id": result['calendar_id']
        }
        
    except ValueError as e:
        if "access token" in str(e).lower():
            raise HTTPException(401, "Google Calendar authorization required")
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Calendar export failed: {e}")
        raise HTTPException(500, "Calendar export failed")
```

**Impact**: Respects user choice, improves consent flow, better user experience
**Effort**: 6 hours

### 2.2 Simplify Error Handling and Remove Complexity
**Priority**: MEDIUM - Maintainability
**Issue**: Overengineered timezone handling, complex batch processing

**Solution**: Simplified, reliable patterns
```python
# /backend/app/services/unified_calendar_service.py - ENHANCED
class UnifiedCalendarService:
    async def create_calendar_events_simple(
        self, 
        user: User, 
        events: List[CourseEvent], 
        course_name: str,
        calendar_preference: str = "primary"
    ) -> Dict[str, any]:
        """Simplified calendar event creation"""
        
        try:
            access_token = await self.get_valid_access_token(user)
            if not access_token:
                raise CalendarAuthError("Google Calendar authorization required")
            
            calendar_id = await self._get_calendar_for_events(
                access_token, calendar_preference, course_name
            )
            
            # Simple sequential processing instead of complex batching
            successful = []
            failed = []
            
            async with httpx.AsyncClient() as client:
                for event in events:
                    try:
                        result = await self._create_single_event(
                            client, access_token, calendar_id, event, course_name
                        )
                        successful.append(result)
                        
                    except Exception as e:
                        logger.warning(f"Failed to create event {event.title}: {e}")
                        failed.append({
                            'event_title': event.title,
                            'error': str(e)
                        })
                        
                        # Continue with other events instead of failing completely
                        continue
            
            return {
                "status": "completed",
                "events_created": len(successful),
                "events_failed": len(failed),
                "calendar_id": calendar_id,
                "details": {
                    "successful": successful,
                    "failed": failed
                }
            }
            
        except CalendarAuthError:
            raise
        except Exception as e:
            logger.error(f"Calendar export failed: {e}")
            raise CalendarExportError(f"Calendar export failed: {str(e)}")
    
    async def _create_single_event(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        calendar_id: str,
        event: CourseEvent,
        course_name: str
    ) -> Dict[str, str]:
        """Create single calendar event with retry logic"""
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        calendar_event = self._format_event_simple(event, course_name)
        
        # Simple retry logic
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                response = await client.post(
                    f"{self.base_url}/calendars/{calendar_id}/events",
                    headers=headers,
                    json=calendar_event,
                    timeout=30
                )
                response.raise_for_status()
                
                google_event = response.json()
                
                return {
                    'event_id': str(event.id),
                    'google_event_id': google_event['id'],
                    'title': event.title,
                    'status': 'created'
                }
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < max_retries:
                    # Rate limit - wait and retry
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise
            except Exception as e:
                if attempt < max_retries:
                    await asyncio.sleep(1)
                    continue
                raise
    
    def _format_event_simple(self, event: CourseEvent, course_name: str) -> Dict:
        """Simplified event formatting without complex timezone logic"""
        
        # Simple timezone handling - use event timezone or UTC
        start_dt = event.start_ts
        end_dt = event.end_ts
        
        # Ensure timezone awareness with UTC fallback
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        
        return {
            'summary': event.title,
            'description': f"Course: {course_name}\n\n{event.description or ''}\n\n📚 Created by SyllabAI",
            'start': {
                'dateTime': start_dt.isoformat(),
                'timeZone': 'UTC'  # Simplified - let Google handle user timezone
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': 'UTC'
            },
            'colorId': self._get_color_for_category(event.category),
            'reminders': {
                'useDefault': True  # Use user's default reminder settings
            }
        }

# Custom exceptions for better error handling
class CalendarError(Exception):
    """Base calendar error"""
    pass

class CalendarAuthError(CalendarError):
    """Calendar authentication error"""
    pass

class CalendarExportError(CalendarError):
    """Calendar export error"""
    pass
```

**Impact**: Reduces complexity, improves reliability, easier to debug
**Effort**: 4 hours

## Phase 3: Final Integration & Cleanup (Week 3)

### 3.1 Remove Old Services and Update Dependencies
**Priority**: LOW - Cleanup
**Issue**: Old duplicate services still exist

**Solution**: Clean removal and dependency updates
```python
# Remove old files:
# - /backend/app/services/calendar_service.py
# - /backend/app/services/google_calendar.py

# Update imports throughout codebase
# /backend/app/routers/courses.py - UPDATED
# Replace old imports
# from ..services.calendar_service import sync_events_to_calendar  # REMOVE
# from ..services.unified_calendar_service import UnifiedCalendarService  # ADD

# Update course creation to use new calendar service
@router.post("/{course_id}/export-calendar")
async def export_course_to_calendar(
    course_id: str,
    request: CalendarExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export course events to Google Calendar"""
    
    calendar_service = UnifiedCalendarService()
    
    # Get course events
    events = db.query(CourseEvent).filter(
        CourseEvent.course_id == course_id
    ).all()
    
    course = db.query(Course).filter(Course.id == course_id).first()
    
    result = await calendar_service.create_calendar_events_simple(
        current_user,
        events,
        course.title,
        request.calendar_preference
    )
    
    return result
```

**Frontend integration**:
```typescript
// /frontend-react/src/services/calendarService.ts - NEW FILE
export class CalendarService {
  async exportCourseToCalendar(
    courseId: string,
    calendarPreference: CalendarPreference
  ): Promise<CalendarExportResult> {
    
    const response = await api.post(`/api/courses/${courseId}/export-calendar`, {
      calendar_preference: calendarPreference
    });
    
    return response.data;
  }
  
  async getGoogleAuthUrl(): Promise<string> {
    const response = await api.get('/api/auth/google/authorize');
    return response.data.auth_url;
  }
  
  async checkAuthStatus(): Promise<boolean> {
    try {
      const response = await api.get('/api/auth/google/status');
      return response.data.authorized;
    } catch {
      return false;
    }
  }
}
```

**Impact**: Removes technical debt, simplifies maintenance, cleaner architecture
**Effort**: 3 hours

### 3.2 Add Integration Tests
**Priority**: LOW - Quality Assurance
**Issue**: Complex OAuth and calendar integration not tested

**Solution**: Integration test suite
```python
# /backend/tests/integration/test_calendar_integration.py - NEW FILE
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

class TestCalendarIntegration:
    @patch('httpx.AsyncClient.post')
    async def test_oauth_flow(self, mock_post, client: TestClient, test_user: User):
        """Test complete OAuth flow"""
        
        # Mock token exchange response
        mock_post.return_value.json.return_value = {
            'access_token': 'test_access_token',
            'refresh_token': 'test_refresh_token',
            'expires_in': 3600
        }
        
        # Start OAuth flow
        response = client.get(
            "/api/auth/google/authorize",
            headers={"Authorization": f"Bearer {test_user.token}"}
        )
        
        assert response.status_code == 200
        assert "auth_url" in response.json()
        
        # Handle callback
        callback_response = client.get(
            "/api/auth/google/callback",
            params={"code": "test_code", "state": "test_state"}
        )
        
        # Should complete successfully
        assert callback_response.status_code == 200
    
    async def test_calendar_export(self, client: TestClient, test_user: User, test_course: Course):
        """Test calendar export functionality"""
        
        # Setup: User has valid tokens
        test_user.google_access_token_encrypted = "encrypted_token"
        test_user.google_token_expires_at = datetime.utcnow() + timedelta(hours=1)
        
        export_request = {
            "course_id": str(test_course.id),
            "calendar_preference": "primary"
        }
        
        with patch('httpx.AsyncClient.post') as mock_post:
            # Mock successful event creation
            mock_post.return_value.json.return_value = {
                'id': 'google_event_id_123'
            }
            
            response = client.post(
                f"/api/courses/{test_course.id}/export-calendar",
                json=export_request
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert data["events_created"] >= 0
```

**Impact**: Ensures reliability, catches integration issues, improves confidence
**Effort**: 2 hours

## Implementation Timeline Summary

### Week 1: Critical Security (24 hours)
- Implement secure token storage with encryption
- Fix OAuth flow security with CSRF protection
- Consolidate duplicate calendar services

### Week 2: UX & Architecture (10 hours)
- Implement user-centric calendar options
- Simplify error handling and remove complexity

### Week 3: Integration & Cleanup (5 hours)
- Remove old services and update dependencies
- Add integration tests

**Total Effort**: ~39 hours (5 working days)

## Integration Dependencies

**Builds on previous fixes:**
- Token encryption patterns (from syllabus processing)
- Service layer architecture (from all previous fixes)
- Error handling patterns (from course creation)
- Logger utility (from enrollment fixes)

**Provides for future fixes:**
- Secure OAuth patterns for other integrations
- Token management service for other external APIs
- User consent patterns for data sharing

## Success Metrics

1. **Security**: Zero plaintext tokens in database, CSRF protection active
2. **User Experience**: User choice in calendar placement, clear consent flow
3. **Reliability**: 95% successful event creation rate, graceful error handling
4. **Performance**: Calendar export under 10 seconds for 50 events
5. **Architecture**: Single calendar service, no code duplication

This fix plan transforms the Google Calendar integration from a security-vulnerable, overly complex system into a secure, user-friendly service that respects user choice and follows established security patterns.