export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'professor' | 'student' | 'admin';
  is_professor: boolean; // Backward compatibility
  school_id?: number;
  has_calendar_access?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string; // Auto-generated course code
  title: string;
  name?: string; // Backward compatibility
  crn: string;
  school_id: number;
  created_by: string; // User ID who created the course
  professor_id?: number; // Backward compatibility
  professor_name?: string;
  description?: string;
  semester?: string;
  timezone?: string;
  school?: School;
  student_count?: number;
  event_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CourseEvent {
  id?: string;
  course_id: string;
  title: string;
  start_ts: string;
  end_ts: string;
  category: EventCategory;
  location?: string;
  description?: string;
  source?: 'parser' | 'manual';
  professor_gcal_event_id?: string;
  content_hash?: string;
  created_at?: string;
  updated_at?: string;
}

export type EventCategory = 
  | 'EXAM'
  | 'QUIZ'
  | 'ASSIGNMENT'
  | 'PROJECT'
  | 'HW'
  | 'PRESENTATION'
  | 'CLASS'
  | 'OTHER'
  | 'ASSESSMENT';

export interface School {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

// Authentication types - Updated for secure cookie authentication
export interface AuthResponse {
  user: User;
  permissions: string[];
  authenticated: boolean;
  session_expires_in: number; // Session duration in seconds
}

// Course creation types
export interface CourseCreateMVP {
  school_id: number;
  crn: string;
  title: string;
  semester: string;
  timezone?: string;
}

export interface CourseSearchMVP {
  school_id: number;
  crn: string;
  semester: string;
}

// Event creation type for API
export interface CourseEventCreate {
  title: string;
  start_ts: string;
  end_ts: string;
  category: EventCategory;
  location?: string;
  description?: string;
  source?: 'parser' | 'manual';
}

// Syllabus upload response
export interface SyllabusUploadResponse {
  extracted_events: CourseEventCreate[];
  course_metadata?: {
    course_title?: string;
    instructor_name?: string;
    semester?: string;
    university?: string;
    course_code?: string;
    meeting_time?: string;
  };
  course_id: string;
  message: string;
}

// File upload progress tracking
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: 'uploading' | 'processing' | 'complete' | 'error';
}

export interface FileUploadProgress {
  stage: ProcessingStage;
  progress: number;
  message: string;
  uploadProgress?: number;
}

// Processing states for syllabus upload
export type ProcessingStage = 
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'ai-analyzing'
  | 'creating-events'
  | 'complete'
  | 'error';

export interface ProcessingState {
  stage: ProcessingStage;
  progress: number;
  message?: string;
  error?: string;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}