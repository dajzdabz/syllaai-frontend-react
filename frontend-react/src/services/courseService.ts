import { apiService } from './api';
import type { 
  Course, CourseEvent, School, 
  CourseCreateMVP, CourseSearchMVP,
  CourseEventCreate 
} from '../types';

/**
 * Production-Ready Course Service Layer
 * 
 * Handles all course-related operations with real API integration:
 * - Course creation and management
 * - School management
 * - Course search and enrollment
 * - Event management
 * - Student-professor workflows
 */

class CourseService {
  
  // Course Management

  /**
   * Get courses based on user role
   * - Professors: Courses they created
   * - Students: Courses they're enrolled in
   */
  async getCourses(): Promise<Course[]> {
    return apiService.getCourses();
  }

  /**
   * Create a new course (MVP version with full fields)
   */
  async createCourseMVP(data: CourseCreateMVP): Promise<Course> {
    return apiService.createCourseMVP(data);
  }

  /**
   * Delete a course (course owner only)
   */
  async deleteCourse(courseId: string): Promise<void> {
    return apiService.deleteCourse(courseId);
  }

  /**
   * Unenroll from a course (students only)
   */
  async unenrollFromCourse(courseId: string): Promise<void> {
    return apiService.unenrollFromCourse(courseId);
  }

  // School Management

  /**
   * Get all available schools
   */
  async getSchools(): Promise<School[]> {
    return apiService.getSchools();
  }

  /**
   * Create a new school (professors only)
   */
  async createSchool(name: string): Promise<School> {
    return apiService.createSchool(name);
  }

  // Course Search and Enrollment (Students)

  /**
   * Search for a course by school, CRN, and semester
   */
  async searchCourse(search: CourseSearchMVP): Promise<Course[]> {
    return apiService.searchCourse(search);
  }

  /**
   * Join a course using MVP search parameters
   */
  async joinCourseMVP(search: CourseSearchMVP): Promise<void> {
    return apiService.joinCourseMVP(search);
  }

  // Event Management

  /**
   * Get all events for a specific course
   */
  async getCourseEvents(courseId: string): Promise<CourseEvent[]> {
    return apiService.getCourseEvents(courseId);
  }

  /**
   * Publish events for a course (professors only)
   * This will sync events to enrolled students' calendars
   */
  async publishEvents(courseId: string, events: CourseEventCreate[]): Promise<void> {
    return apiService.publishEvents(courseId, events);
  }

  // Student Calendar Functions

  /**
   * Export events directly to student's Google Calendar
   */
  async exportToCalendar(events: CourseEventCreate[]): Promise<void> {
    return apiService.exportToCalendar(events);
  }

  /**
   * Get Google Calendar OAuth URL for authentication
   */
  async getGoogleCalendarAuthUrl(): Promise<{ oauth_url: string }> {
    return apiService.getGoogleCalendarAuthUrl();
  }

  /**
   * Handle Google Calendar OAuth callback
   */
  async handleGoogleCalendarCallback(code: string): Promise<void> {
    return apiService.handleGoogleCalendarCallback(code);
  }

  /**
   * Save extracted events as a personal course
   */
  async saveToMyCourses(data: {
    course_title: string;
    semester?: string;
    events: CourseEventCreate[];
  }): Promise<Course> {
    return apiService.saveToMyCourses(data);
  }

  // Utility Functions

  /**
   * Format course display name
   */
  getCourseDisplayName(course: Course): string {
    if (course.title) {
      return `${course.crn}: ${course.title}`;
    }
    if (course.name) {
      return `${course.crn}: ${course.name}`;
    }
    return course.crn;
  }

  /**
   * Get semester display name
   */
  getSemesterDisplayName(semester: string): string {
    if (!semester) return '';
    
    const year = semester.substring(0, 4);
    const term = semester.substring(4);
    
    const termNames: Record<string, string> = {
      'SP': 'Spring',
      'SU': 'Summer', 
      'FA': 'Fall',
      'WI': 'Winter'
    };
    
    return `${termNames[term] || term} ${year}`;
  }

  /**
   * Validate course search parameters
   */
  validateCourseSearch(search: CourseSearchMVP): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!search.school_id || search.school_id <= 0) {
      errors.push('Please select a school');
    }
    
    if (!search.crn || search.crn.trim().length === 0) {
      errors.push('Please enter a course CRN');
    } else if (search.crn.length < 3 || search.crn.length > 10) {
      errors.push('CRN must be between 3 and 10 characters');
    }
    
    if (!search.semester || search.semester.trim().length === 0) {
      errors.push('Please enter a semester');
    } else if (!/^20\d{2}(SP|SU|FA|WI)$/.test(search.semester)) {
      errors.push('Semester must be in format: 2025SP, 2025FA, etc.');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate course creation data
   */
  validateCourseCreation(data: CourseCreateMVP): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.school_id || data.school_id <= 0) {
      errors.push('Please select a school');
    }
    
    if (!data.crn || data.crn.trim().length === 0) {
      errors.push('Please enter a course CRN');
    } else if (data.crn.length < 3 || data.crn.length > 10) {
      errors.push('CRN must be between 3 and 10 characters');
    }
    
    if (!data.title || data.title.trim().length === 0) {
      errors.push('Please enter a course title');
    } else if (data.title.length > 200) {
      errors.push('Course title must be less than 200 characters');
    }
    
    if (!data.semester || data.semester.trim().length === 0) {
      errors.push('Please enter a semester');
    } else if (!/^20\d{2}(SP|SU|FA|WI)$/.test(data.semester)) {
      errors.push('Semester must be in format: 2025SP, 2025FA, etc.');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate course code suggestions based on title
   */
  generateCourseCodeSuggestions(title: string): string[] {
    if (!title) return [];
    
    const words = title.split(' ').filter(word => word.length > 2);
    const suggestions: string[] = [];
    
    // Take first letters of words
    if (words.length >= 2) {
      suggestions.push(
        words.slice(0, 3).map(word => word[0].toUpperCase()).join('') + '101'
      );
    }
    
    // Extract numbers from title
    const numbers = title.match(/\d+/g);
    if (numbers && words.length > 0) {
      suggestions.push(
        words[0].substring(0, 3).toUpperCase() + numbers[0]
      );
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Check if user can edit course
   */
  canEditCourse(course: Course, currentUserId: string): boolean {
    return course.created_by === currentUserId || course.professor_id?.toString() === currentUserId;
  }

  /**
   * Get event category display name
   */
  getEventCategoryDisplayName(category: string): string {
    const categoryNames: Record<string, string> = {
      'EXAM': 'Exam',
      'QUIZ': 'Quiz',
      'HW': 'Homework',
      'HOMEWORK': 'Homework',
      'PROJECT': 'Project',
      'PRESENTATION': 'Presentation',
      'CLASS': 'Class',
      'ASSIGNMENT': 'Assignment',
      'ASSESSMENT': 'Assessment',
      'PAPER': 'Paper',
      'LAB': 'Lab',
      'OTHER': 'Other'
    };
    
    return categoryNames[category.toUpperCase()] || category;
  }

  /**
   * Sort events by date
   */
  sortEventsByDate(events: CourseEvent[]): CourseEvent[] {
    return [...events].sort((a, b) => 
      new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
    );
  }

  /**
   * Filter upcoming events
   */
  getUpcomingEvents(events: CourseEvent[], limit = 5): CourseEvent[] {
    const now = new Date();
    return this.sortEventsByDate(events)
      .filter(event => new Date(event.start_ts) > now)
      .slice(0, limit);
  }

  /**
   * Group events by category
   */
  groupEventsByCategory(events: CourseEvent[]): Record<string, CourseEvent[]> {
    return events.reduce((groups, event) => {
      const category = event.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(event);
      return groups;
    }, {} as Record<string, CourseEvent[]>);
  }
}

// Export singleton instance
export const courseService = new CourseService();

// Legacy exports for backward compatibility
export const getCourses = () => courseService.getCourses();
export const createCourse = (data: CourseCreateMVP) => courseService.createCourseMVP(data);
export const getEnrolledCourses = () => courseService.getCourses(); // Students get enrolled courses
export const getCourseEvents = (courseId: string) => courseService.getCourseEvents(courseId);
export const getCourseById = async (courseId: string) => {
  const courses = await courseService.getCourses();
  return courses.find(c => c.id === courseId) || null;
};
export const searchCourses = (_crn: string) => {
  // Legacy function - needs school_id and semester for new API
  console.warn('searchCourses with CRN only is deprecated. Use searchCourse with full parameters.');
  return Promise.resolve([]);
};
export const enrollInCourse = (_courseId: string) => {
  console.warn('enrollInCourse with courseId is deprecated. Use joinCourseMVP.');
  return Promise.resolve();
};

export default courseService;