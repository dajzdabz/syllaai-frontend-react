# SyllabAI Frontend Feature Audit & React Migration Plan

## 📋 **Complete Feature Inventory**

Based on comprehensive analysis of `/mnt/c/Users/jdabl/SyllabAI/frontend/index.html` (2,921 lines)

### **1. Authentication System**
**Location**: Lines 1013-1200
**Features**:
- Google OAuth 2.0 Sign-In button integration
- Role selection (Professor/Student) after authentication  
- JWT token management in localStorage
- Auto-redirect based on user role
- Sign-out functionality with cleanup

**Backend Integration**:
- `POST /api/auth/oauth-signin` - Google credential verification
- `GET /api/auth/me` - User profile retrieval
- Stores: `access_token`, `user` object in localStorage

**Current State**: ✅ **MIGRATED** to React

---

### **2. Role-Based Navigation**
**Location**: Lines 240-300 (showPage function)
**Features**:
- Single-page app routing with `showPage(pageId)`
- Role-based page access control
- Dynamic navigation based on authentication state
- Page transition animations

**Backend Integration**: None (client-side routing)

**Current State**: ✅ **MIGRATED** to React Router

---

### **3. Professor Dashboard - Course Management**
**Location**: Lines 1400-1600
**Features**:
- Course creation form (name, CRN, school selection)
- Course list/grid display with course cards
- Course editing capabilities
- Delete course functionality
- Course statistics display

**Backend Integration**:
- `POST /api/courses/` - Create new course
- `GET /api/courses/` - List professor's courses  
- `PUT /api/courses/{id}` - Update course details
- `DELETE /api/courses/{id}` - Delete course

**Current State**: 🔴 **NOT MIGRATED** - Placeholder only

---

### **4. Professor Dashboard - Syllabus Upload & Processing**
**Location**: Lines 1600-1800
**Features**:
- Drag-and-drop file upload interface
- File type validation (PDF, DOCX)
- Upload progress indicator
- 3-stage processing feedback:
  1. "Processing..." spinner
  2. "Extracting events..." progress
  3. "Events extracted!" success state
- Error handling for upload failures

**Backend Integration**:
- `POST /api/courses/{id}/syllabus` - Upload syllabus file
- Real-time processing status updates
- Returns extracted events JSON

**Current State**: 🔴 **NOT MIGRATED**

---

### **5. Event Extraction Results Display**
**Location**: Lines 1800-2000
**Features**:
- Event cards showing extracted data
- Event details: title, date, time, location, category
- Color-coded category system (Exam=red, Assignment=blue, etc.)
- Event count summary
- "No events found" empty state

**Event Categories**:
```javascript
const categoryColors = {
    'Exam': 'var(--error-500)',      // Red
    'Quiz': 'var(--warning-500)',    // Orange  
    'Assignment': 'var(--primary-500)', // Blue
    'Project': 'var(--secondary-500)',  // Cyan
    'HW': 'var(--primary-500)',      // Blue
    'Presentation': 'var(--success-500)', // Green
    'Class': 'var(--gray-500)',      // Gray
    'Other': 'var(--gray-500)'       // Gray
}
```

**Backend Integration**:
- Receives events from syllabus processing endpoint
- No additional API calls (uses response data)

**Current State**: 🔴 **NOT MIGRATED**

---

### **6. Event Editing Interface**
**Location**: Lines 2000-2200
**Features**:
- Inline editing of event details
- Form fields: title, date, time, location, category, description
- Date picker integration
- Time picker with format validation
- Category dropdown selection
- Save/cancel buttons per event
- Real-time validation feedback

**Backend Integration**:
- `PUT /api/courses/{id}/events/{event_id}` - Update individual event
- Auto-save on field blur (optional)

**Current State**: 🔴 **NOT MIGRATED**

---

### **7. Event Publishing & Calendar Sync**
**Location**: Lines 2200-2400
**Features**:
- "Publish Events" button for professors
- Bulk event publication to enrolled students
- Google Calendar integration setup
- Calendar sync status indicators
- Sync progress tracking
- Success/failure notifications

**Backend Integration**:
- `POST /api/courses/{id}/events/publish` - Publish all events
- `POST /api/calendar/sync` - Sync with Google Calendar
- WebSocket/polling for sync status updates

**Current State**: 🔴 **NOT MIGRATED**

---

### **8. Student Dashboard - Course Enrollment**
**Location**: Lines 2400-2600
**Features**:
- CRN (Course Reference Number) search input
- "Join Course" functionality
- Course search results display
- Enrollment confirmation dialog
- Already enrolled course detection

**Backend Integration**:
- `POST /api/courses/search` - Search courses by CRN
- `POST /api/courses/{id}/enroll` - Enroll student in course

**Current State**: 🔴 **NOT MIGRATED**

---

### **9. Student Dashboard - Enrolled Courses**
**Location**: Lines 2600-2750
**Features**:
- Grid display of enrolled courses
- Course information cards
- Professor name display
- Course event counts
- "View Events" navigation
- Leave course functionality

**Backend Integration**:
- `GET /api/courses/` - List student's enrolled courses
- `DELETE /api/courses/{id}/leave` - Leave course

**Current State**: 🔴 **NOT MIGRATED**

---

### **10. Student Course Events View**
**Location**: Lines 2750-2865
**Features**:
- List of all events for a specific course
- Event filtering by category
- Event sorting by date
- Calendar view toggle option
- Event details display
- Google Calendar sync button

**Backend Integration**:
- `GET /api/courses/{id}/events` - Get course events
- `POST /api/courses/{id}/sync` - Sync to student's calendar

**Current State**: 🔴 **NOT MIGRATED**

---

### **11. Notification System**
**Location**: Lines 300-400 (showNotification function)
**Features**:
- Toast notifications (success, error, warning, info)
- Auto-dismiss after 5 seconds
- Manual dismiss capability
- Queue system for multiple notifications
- Slide-in animations

**Backend Integration**: None (client-side only)

**Current State**: 🔴 **NOT MIGRATED**

---

### **12. Loading States & Spinners**
**Location**: Lines 400-500
**Features**:
- Loading spinners for API calls
- Skeleton screens for content loading
- Progress bars for file uploads
- Disabled states during processing
- Loading overlays for modals

**Backend Integration**: Triggered by all API calls

**Current State**: 🔴 **NOT MIGRATED**

---

### **13. Error Handling & Recovery**
**Location**: Lines 500-600
**Features**:
- Global error boundary
- API error message display
- Retry mechanisms for failed requests
- Fallback UI for broken states
- User-friendly error messages

**Backend Integration**: Handles responses from all API endpoints

**Current State**: ⚠️ **PARTIALLY MIGRATED** (Error boundaries exist)

---

### **14. File Upload Management**
**Location**: Lines 1600-1700
**Features**:
- Drag-and-drop upload zone
- File type validation
- File size limits (10MB)
- Upload progress tracking
- Multiple file support
- File preview capabilities

**Supported Formats**:
- PDF files
- DOCX files
- TXT files (limited support)

**Backend Integration**:
- `POST /api/courses/{id}/syllabus` - File upload endpoint
- Multipart form data handling
- Progress tracking via upload events

**Current State**: 🔴 **NOT MIGRATED**

---

### **15. Google Calendar Integration**
**Location**: Lines 800-1000
**Features**:
- Google Calendar API initialization
- Calendar permissions request
- "SyllabAI" calendar creation
- Event creation in Google Calendar
- Sync status tracking
- Calendar access management

**Google APIs Used**:
- Google Calendar API v3
- Google OAuth 2.0
- Calendar permissions scopes

**Backend Integration**:
- Backend manages Google refresh tokens
- `POST /api/calendar/events` - Create calendar events
- `GET /api/calendar/status` - Check sync status

**Current State**: 🔴 **NOT MIGRATED**

---

### **16. State Management**
**Location**: Throughout file
**Global Variables**:
```javascript
let currentUser = null;
let userRole = null;
let currentExtractedEvents = [];
let currentCourse = null;
let uploadProgress = 0;
let syncStatus = 'idle';
```

**localStorage Data**:
- `access_token` - JWT authentication token
- `user` - User profile object
- `refresh_token` - Google OAuth refresh token

**Current State**: ⚠️ **PARTIALLY MIGRATED** (Auth state only)

---

### **17. Responsive Design System**
**Location**: Lines 50-300 (CSS)
**Features**:
- Mobile-first responsive breakpoints
- Flexible grid system
- Touch-friendly button sizes
- Responsive typography scaling
- Mobile navigation patterns

**Breakpoints**:
- Mobile: `< 768px`
- Tablet: `768px - 1024px`
- Desktop: `> 1024px`

**Current State**: ✅ **MIGRATED** (Material-UI responsive system)

---

### **18. Accessibility Features**
**Location**: Throughout file
**Features**:
- Keyboard navigation support
- Screen reader compatibility
- High contrast color support
- Focus management
- ARIA labels and descriptions

**Current State**: ⚠️ **PARTIALLY MIGRATED** (Material-UI provides basics)

---

## 🔗 **Backend API Mapping**

### **Authentication Endpoints**
- `POST /api/auth/oauth-signin` - Google OAuth verification
- `GET /api/auth/me` - Current user profile

### **Course Management Endpoints**
- `GET /api/courses/` - List courses (role-dependent)
- `POST /api/courses/` - Create course (professors only)
- `PUT /api/courses/{id}` - Update course
- `DELETE /api/courses/{id}` - Delete course
- `POST /api/courses/search` - Search by CRN (students)
- `POST /api/courses/{id}/enroll` - Student enrollment

### **Syllabus & Events Endpoints**
- `POST /api/courses/{id}/syllabus` - Upload & process syllabus
- `GET /api/courses/{id}/events` - Get course events
- `PUT /api/courses/{id}/events/{event_id}` - Update event
- `POST /api/courses/{id}/events/publish` - Publish to students

### **Calendar Integration Endpoints**
- `POST /api/calendar/sync` - Sync with Google Calendar
- `GET /api/calendar/status` - Check sync status
- `POST /api/calendar/events` - Create calendar events

---

## 🚀 **React Migration Roadmap**

### **Phase 1: Core Infrastructure** (Week 1)
**Priority**: Critical
**Status**: ✅ **COMPLETE**
- [x] Project setup (Vite + React + TypeScript)
- [x] Material-UI integration with custom theme
- [x] React Router configuration
- [x] Authentication system migration
- [x] Error boundaries and error handling
- [x] API service layer with Axios

### **Phase 2: Professor Dashboard** (Week 2)
**Priority**: High
**Status**: 🔴 **PENDING**

**2.1 Course Management**
- [ ] Course creation form component
- [ ] Course list/grid display
- [ ] Course edit modal
- [ ] Course deletion with confirmation
- [ ] API integration for CRUD operations

**2.2 Syllabus Upload**
- [ ] Drag-and-drop upload component
- [ ] File validation and preview
- [ ] Upload progress tracking
- [ ] Processing status feedback
- [ ] Error handling for uploads

**2.3 Event Extraction Display**
- [ ] Event card component with category colors
- [ ] Event list/grid layout
- [ ] Empty state handling
- [ ] Real-time extraction feedback

### **Phase 3: Event Management** (Week 3)
**Priority**: High
**Status**: 🔴 **PENDING**

**3.1 Event Editing**
- [ ] Inline editing components
- [ ] Form validation and submission
- [ ] Date/time picker integration
- [ ] Category selection dropdown
- [ ] Auto-save functionality

**3.2 Event Publishing**
- [ ] Bulk publish functionality
- [ ] Student notification system
- [ ] Sync status tracking
- [ ] Progress indicators

### **Phase 4: Student Dashboard** (Week 4)
**Priority**: High
**Status**: 🔴 **PENDING**

**4.1 Course Enrollment**
- [ ] CRN search component
- [ ] Course search results
- [ ] Join course workflow
- [ ] Enrollment confirmations

**4.2 Course Management**
- [ ] Enrolled courses display
- [ ] Course events view
- [ ] Leave course functionality
- [ ] Event filtering and sorting

### **Phase 5: Google Calendar Integration** (Week 5)
**Priority**: Medium
**Status**: 🔴 **PENDING**

**5.1 Calendar Sync**
- [ ] Google Calendar API integration
- [ ] Permission management
- [ ] Sync status indicators
- [ ] Error handling for calendar operations

**5.2 Calendar Management**
- [ ] "SyllabAI" calendar creation
- [ ] Event synchronization
- [ ] Sync conflict resolution
- [ ] Calendar access management

### **Phase 6: Advanced Features** (Week 6)
**Priority**: Low
**Status**: 🔴 **PENDING**

**6.1 Notifications**
- [ ] Toast notification system
- [ ] Email notifications
- [ ] Push notifications (future)
- [ ] Notification preferences

**6.2 Enhanced UX**
- [ ] Advanced loading states
- [ ] Skeleton screens
- [ ] Improved error recovery
- [ ] Accessibility enhancements

---

## 💡 **Improvement Opportunities**

### **1. State Management Upgrade**
**Current**: Global variables + localStorage
**Proposed**: React Query + Context API
**Benefits**: Better caching, optimistic updates, background refetching

### **2. Real-time Updates**
**Current**: Manual refresh/polling
**Proposed**: WebSocket integration
**Benefits**: Live collaboration, instant updates

### **3. Enhanced File Processing**
**Current**: Single file upload
**Proposed**: Batch processing, cloud storage
**Benefits**: Better performance, reliability

### **4. Advanced Calendar Features**
**Current**: Basic sync
**Proposed**: Two-way sync, conflict resolution
**Benefits**: Better user experience, data integrity

### **5. Testing Infrastructure**
**Current**: No tests
**Proposed**: Unit + Integration + E2E tests
**Benefits**: Quality assurance, regression prevention

---

## 📊 **Migration Progress Tracking**

**Overall Progress**: 15% Complete

**Completed** ✅:
- Project architecture
- Authentication system
- Basic routing
- Design system

**In Progress** ⚠️:
- Error handling improvements

**Not Started** 🔴:
- Professor dashboard features
- Student dashboard features
- Event management
- Calendar integration
- File upload system
- Notification system

**Estimated Completion**: 6-8 weeks for full feature parity