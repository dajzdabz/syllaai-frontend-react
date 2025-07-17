import type { Course, CourseEvent } from '../types';

/**
 * Course Service Layer
 * 
 * Handles all course-related API operations with mock data for development.
 * In production, these would be actual API calls to the backend.
 */

// Mock data for enrolled courses
const mockEnrolledCourses: Course[] = [
  {
    id: 1,
    name: "Introduction to Computer Science",
    crn: "CS101",
    school_id: 1,
    professor_id: 1,
    professor_name: "Dr. Sarah Johnson",
    description: "Basic programming concepts",
    created_at: "2024-01-15T09:00:00Z",
    updated_at: "2024-01-15T09:00:00Z"
  },
  {
    id: 2,
    name: "Data Structures and Algorithms",
    crn: "CS201",
    school_id: 1,
    professor_id: 2,
    professor_name: "Prof. Michael Chen",
    description: "Advanced programming concepts",
    created_at: "2024-01-16T10:30:00Z",
    updated_at: "2024-01-16T10:30:00Z"
  }
];

// Mock data for professor courses
const mockProfessorCourses: Course[] = [];

// Mock data for searchable course
const mockSearchableCourse: Course = {
  id: 3,
  name: "Advanced React Development",
  crn: "12345",
  school_id: 1,
  professor_id: 3,
  professor_name: "Dr. Emily Rodriguez",
  created_at: "2024-01-17T14:15:00Z",
  updated_at: "2024-01-17T14:15:00Z"
};

// Mock data for course events
const mockCourseEvents: Record<number, CourseEvent[]> = {
  1: [ // CS101 - Introduction to Computer Science
    {
      id: 1,
      course_id: 1,
      title: "Midterm Exam",
      start_ts: "2024-03-15T09:00:00Z",
      end_ts: "2024-03-15T11:00:00Z",
      category: "Exam",
      location: "Room 101",
      description: "Comprehensive midterm covering chapters 1-6"
    },
    {
      id: 2,
      course_id: 1,
      title: "Programming Assignment 1",
      start_ts: "2024-02-20T23:59:00Z",
      end_ts: "2024-02-20T23:59:00Z",
      category: "Assignment",
      location: "Online Submission",
      description: "Implement basic sorting algorithms"
    },
    {
      id: 3,
      course_id: 1,
      title: "Quiz 1: Variables and Data Types",
      start_ts: "2024-02-10T14:00:00Z",
      end_ts: "2024-02-10T14:30:00Z",
      category: "Quiz",
      location: "Room 101",
      description: "Short quiz on basic programming concepts"
    },
    {
      id: 4,
      course_id: 1,
      title: "Final Project Presentation",
      start_ts: "2024-04-25T10:00:00Z",
      end_ts: "2024-04-25T12:00:00Z",
      category: "Presentation",
      location: "Main Auditorium",
      description: "Present your semester-long programming project"
    },
    {
      id: 5,
      course_id: 1,
      title: "Final Exam",
      start_ts: "2024-05-10T09:00:00Z",
      end_ts: "2024-05-10T12:00:00Z",
      category: "Exam",
      location: "Room 101",
      description: "Comprehensive final exam covering all course material"
    }
  ],
  2: [ // CS201 - Data Structures and Algorithms
    {
      id: 6,
      course_id: 2,
      title: "Data Structures Midterm",
      start_ts: "2024-03-20T10:00:00Z",
      end_ts: "2024-03-20T12:00:00Z",
      category: "Exam",
      location: "Room 205",
      description: "Exam covering arrays, linked lists, stacks, and queues"
    },
    {
      id: 7,
      course_id: 2,
      title: "Algorithm Analysis Assignment",
      start_ts: "2024-03-01T23:59:00Z",
      end_ts: "2024-03-01T23:59:00Z",
      category: "Assignment",
      location: "Online Submission",
      description: "Analyze time complexity of given algorithms"
    },
    {
      id: 8,
      course_id: 2,
      title: "Sorting Algorithms Quiz",
      start_ts: "2024-02-25T15:00:00Z",
      end_ts: "2024-02-25T15:45:00Z",
      category: "Quiz",
      location: "Room 205",
      description: "Quiz on various sorting algorithms and their complexities"
    },
    {
      id: 9,
      course_id: 2,
      title: "Tree Implementation Project",
      start_ts: "2024-04-15T23:59:00Z",
      end_ts: "2024-04-15T23:59:00Z",
      category: "Project",
      location: "Online Submission",
      description: "Implement binary search tree with full functionality"
    },
    {
      id: 10,
      course_id: 2,
      title: "Graph Algorithms Homework",
      start_ts: "2024-04-05T23:59:00Z",
      end_ts: "2024-04-05T23:59:00Z",
      category: "HW",
      location: "Online Submission",
      description: "Implement BFS and DFS algorithms"
    },
    {
      id: 11,
      course_id: 2,
      title: "Final Algorithms Exam",
      start_ts: "2024-05-15T13:00:00Z",
      end_ts: "2024-05-15T16:00:00Z",
      category: "Exam",
      location: "Room 205",
      description: "Comprehensive final exam on all data structures and algorithms"
    }
  ],
  3: [ // Advanced React Development
    {
      id: 12,
      course_id: 3,
      title: "React Hooks Assignment",
      start_ts: "2024-02-28T23:59:00Z",
      end_ts: "2024-02-28T23:59:00Z",
      category: "Assignment",
      location: "Online Submission",
      description: "Build a todo app using React hooks"
    },
    {
      id: 13,
      course_id: 3,
      title: "Component Architecture Quiz",
      start_ts: "2024-03-10T11:00:00Z",
      end_ts: "2024-03-10T11:30:00Z",
      category: "Quiz",
      location: "Room 301",
      description: "Quiz on React component patterns and best practices"
    },
    {
      id: 14,
      course_id: 3,
      title: "State Management Project",
      start_ts: "2024-04-10T23:59:00Z",
      end_ts: "2024-04-10T23:59:00Z",
      category: "Project",
      location: "Online Submission",
      description: "Build a complex app using Redux or Context API"
    },
    {
      id: 15,
      course_id: 3,
      title: "Performance Optimization Assignment",
      start_ts: "2024-04-20T23:59:00Z",
      end_ts: "2024-04-20T23:59:00Z",
      category: "Assignment",
      location: "Online Submission",
      description: "Optimize a React app for performance using various techniques"
    },
    {
      id: 16,
      course_id: 3,
      title: "React Testing Exam",
      start_ts: "2024-05-05T14:00:00Z",
      end_ts: "2024-05-05T16:00:00Z",
      category: "Exam",
      location: "Room 301",
      description: "Exam on React testing strategies and implementation"
    }
  ]
};

/**
 * Simulates API delay for realistic user experience
 */
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get all courses the current student is enrolled in
 * @returns Promise<Course[]> - List of enrolled courses
 */
export const getEnrolledCourses = async (): Promise<Course[]> => {
  await delay(500);
  return [...mockEnrolledCourses];
};

/**
 * Search for courses by CRN (Course Reference Number)
 * @param crn - Course Reference Number to search for
 * @returns Promise<Course[]> - Array of matching courses (empty if not found)
 */
export const searchCourses = async (crn: string): Promise<Course[]> => {
  await delay(500);
  
  if (crn.trim() === "12345") {
    return [mockSearchableCourse];
  }
  
  return [];
};

/**
 * Enroll the current student in a course
 * @param courseId - ID of the course to enroll in
 * @returns Promise<void> - Resolves on successful enrollment
 */
export const enrollInCourse = async (courseId: number): Promise<void> => {
  await delay(500);
  
  // Simulate successful enrollment
  // In a real app, this would make an API call and handle errors
  console.log(`Successfully enrolled in course ${courseId}`);
  
  // Add the course to mock enrolled courses for immediate UI feedback
  if (courseId === mockSearchableCourse.id) {
    const isAlreadyEnrolled = mockEnrolledCourses.some(course => course.id === courseId);
    if (!isAlreadyEnrolled) {
      mockEnrolledCourses.push({...mockSearchableCourse});
    }
  }
};

/**
 * Get all events for a specific course
 * @param courseId - ID of the course to get events for
 * @returns Promise<CourseEvent[]> - Array of course events
 */
export const getCourseEvents = async (courseId: number): Promise<CourseEvent[]> => {
  await delay(500);
  
  const events = mockCourseEvents[courseId] || [];
  
  // Sort events by start date
  return [...events].sort((a, b) => 
    new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
  );
};

/**
 * Get course details by ID (for displaying course name)
 * @param courseId - ID of the course
 * @returns Promise<Course | null> - Course object or null if not found
 */
export const getCourseById = async (courseId: number): Promise<Course | null> => {
  await delay(500);
  
  // Check enrolled courses
  const allCourses = [...mockEnrolledCourses, mockSearchableCourse];
  return allCourses.find(course => course.id === courseId) || null;
};

/**
 * Get all courses created by the professor
 * @returns Promise<Course[]> - List of professor's courses
 */
export const getCourses = async (): Promise<Course[]> => {
  await delay(500);
  return [...mockProfessorCourses];
};

/**
 * Create a new course
 * @param courseData - Course data to create
 * @returns Promise<Course> - Created course
 */
export const createCourse = async (courseData: {
  name: string;
  crn: string;
  description?: string;
}): Promise<Course> => {
  await delay(500);
  
  const newCourse: Course = {
    id: mockProfessorCourses.length + 100,
    name: courseData.name,
    crn: courseData.crn,
    description: courseData.description,
    school_id: 1,
    professor_id: 1,
    professor_name: "Current User",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockProfessorCourses.push(newCourse);
  return newCourse;
};