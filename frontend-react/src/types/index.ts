export interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  is_professor: boolean;
  school_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: number;
  name: string;
  crn: string;
  school_id: number;
  professor_id: number;
  professor_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseEvent {
  id?: number;
  course_id: number;
  title: string;
  start_ts: string;
  end_ts: string;
  category: EventCategory;
  location?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export type EventCategory = 
  | 'Exam'
  | 'Quiz'
  | 'Assignment'
  | 'Project'
  | 'HW'
  | 'Presentation'
  | 'Class'
  | 'Other';

export interface School {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}