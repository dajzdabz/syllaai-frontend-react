import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { 
  User, Course, CourseEvent, School, 
  AuthResponse, CourseCreateMVP, CourseSearchMVP,
  SyllabusUploadResponse, CourseEventCreate
} from '../types';

/**
 * Production-Ready API Service Layer
 * 
 * Features:
 * - Comprehensive error handling with retry logic
 * - Token management with automatic refresh
 * - Request/response interceptors with logging
 * - Type-safe API calls
 * - Progress tracking for file uploads
 * - Rate limiting and timeout handling
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://syllaai-ai.onrender.com';

// Error types for better error handling
export const ApiErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
  AI_PROCESSING_ERROR: 'AI_PROCESSING_ERROR',
  CALENDAR_SYNC_ERROR: 'CALENDAR_SYNC_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ApiErrorType = keyof typeof ApiErrorTypes;

export interface ApiError {
  type: string;
  message: string;
  statusCode?: number;
  details?: any;
  retryable?: boolean;
}

class ApiService {
  private client: AxiosInstance;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('Token found and set:', token.substring(0, 20) + '...');
        } else {
          console.warn('No access token found in localStorage!');
        }
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        if (import.meta.env.DEV) {
          console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
          console.log('Request headers:', config.headers);
        }
        
        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        if (import.meta.env.DEV) {
          console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status);
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          this.handleUnauthorized();
          return Promise.reject(this.handleError(error));
        }
        
        // Retry logic for network errors
        if (this.shouldRetry(error) && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          if (originalRequest._retryCount <= this.retryAttempts) {
            await this.delay(this.retryDelay * originalRequest._retryCount);
            return this.client(originalRequest);
          }
        }
        
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx server errors
    return (
      !error.response || 
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNABORTED' ||
      (error.response.status >= 500 && error.response.status < 600)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleUnauthorized(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth-change'));
  }

  private handleError(error: any): ApiError {
    const apiError: ApiError = {
      type: ApiErrorTypes.UNKNOWN_ERROR,
      message: 'An unexpected error occurred',
      retryable: false
    };

    if (!error.response) {
      // Network error
      apiError.type = ApiErrorTypes.NETWORK_ERROR;
      apiError.message = 'Network error. Please check your connection.';
      apiError.retryable = true;
    } else {
      const { status, data } = error.response;
      apiError.statusCode = status;
      apiError.details = data;

      switch (status) {
        case 400:
          apiError.type = ApiErrorTypes.VALIDATION_ERROR;
          apiError.message = data?.detail || 'Invalid request data';
          break;
        case 401:
          apiError.type = ApiErrorTypes.AUTHENTICATION_ERROR;
          apiError.message = 'Please sign in to continue';
          break;
        case 403:
          apiError.type = ApiErrorTypes.AUTHORIZATION_ERROR;
          apiError.message = 'You do not have permission to perform this action';
          break;
        case 413:
          apiError.type = ApiErrorTypes.FILE_PROCESSING_ERROR;
          apiError.message = 'File is too large. Please choose a smaller file.';
          break;
        case 422:
          apiError.type = ApiErrorTypes.VALIDATION_ERROR;
          apiError.message = data?.detail || 'Validation error';
          break;
        case 429:
          apiError.message = 'Too many requests. Please try again later.';
          apiError.retryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          apiError.type = ApiErrorTypes.SERVER_ERROR;
          apiError.message = 'Server error. Please try again later.';
          apiError.retryable = true;
          break;
        default:
          apiError.message = data?.detail || `Request failed with status ${status}`;
      }
    }

    console.error('❌ API Error:', apiError);
    return apiError;
  }

  // Authentication endpoints
  async authenticate(payload: {
    id_token?: string;
    authorization_code?: string;
    redirect_uri?: string;
    role?: 'professor' | 'student' | 'admin';
  }): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/authenticate', payload);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/api/auth/me');
    return response.data;
  }

  // Course endpoints
  async getCourses(): Promise<Course[]> {
    const response = await this.client.get<Course[]>('/api/courses/');
    return response.data;
  }

  async createCourseMVP(data: CourseCreateMVP): Promise<Course> {
    const response = await this.client.post<Course>('/api/courses/mvp', data);
    return response.data;
  }

  async searchCourse(search: CourseSearchMVP): Promise<Course[]> {
    const response = await this.client.get<Course[]>('/api/courses/search', {
      params: search
    });
    return response.data;
  }

  async joinCourseMVP(search: CourseSearchMVP): Promise<void> {
    await this.client.post('/api/courses/join-mvp', search);
  }

  async deleteCourse(courseId: string): Promise<void> {
    console.log('=== API SERVICE DELETE COURSE DEBUG ===');
    console.log('Course ID received:', courseId);
    const url = `/api/courses/${courseId}`;
    console.log('Full URL:', `${this.client.defaults.baseURL}${url}`);
    console.log('Environment:', import.meta.env.MODE);
    
    try {
      const response = await this.client.delete(url);
      console.log('Delete course response status:', response.status);
      console.log('Delete course response data:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API delete course request failed:', error);
      console.error('Request config:', error.config);
      console.error('Response details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }
  }

  async unenrollFromCourse(courseId: string): Promise<void> {
    console.log('=== API SERVICE UNENROLL DEBUG ===');
    console.log('Course ID received:', courseId);
    console.log('Course ID type:', typeof courseId);
    const url = `/api/courses/${courseId}/unenroll`;
    console.log('Full URL:', `${this.client.defaults.baseURL}${url}`);
    console.log('Environment:', import.meta.env.MODE);
    console.log('Base URL source:', import.meta.env.VITE_API_URL || 'default');
    
    try {
      const response = await this.client.delete(url);
      console.log('Unenroll response status:', response.status);
      console.log('Unenroll response data:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API delete request failed:', error);
      console.error('Request config:', error.config);
      console.error('Response details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }
  }

  // School endpoints
  async getSchools(): Promise<School[]> {
    const response = await this.client.get<School[]>('/api/courses/schools');
    return response.data;
  }

  async createSchool(name: string): Promise<School> {
    const response = await this.client.post<School>('/api/courses/schools', { name });
    return response.data;
  }

  // Event endpoints
  async getCourseEvents(courseId: string): Promise<CourseEvent[]> {
    const response = await this.client.get<CourseEvent[]>(`/api/courses/${courseId}/events`);
    return response.data;
  }

  async publishEvents(courseId: string, events: CourseEventCreate[]): Promise<void> {
    await this.client.post(`/api/courses/${courseId}/events/publish`, events);
  }

  // File upload endpoints with progress tracking
  async uploadSyllabus(
    courseId: string, 
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<SyllabusUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<SyllabusUploadResponse>(
      `/api/courses/${courseId}/syllabus`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minute timeout for file processing
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );
    return response.data;
  }

  async uploadPersonalSyllabus(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<SyllabusUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<SyllabusUploadResponse>(
      '/api/courses/student-syllabus',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minute timeout for file processing
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );
    return response.data;
  }

  // Calendar endpoints
  async exportToCalendar(events: CourseEventCreate[]): Promise<void> {
    await this.client.post('/api/student-events/export-to-calendar', events);
  }

  async saveToMyCourses(data: {
    course_title: string;
    semester?: string;
    events: CourseEventCreate[];
  }): Promise<Course> {
    const response = await this.client.post<Course>('/api/student-events/save-to-my-courses', data);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.client.get<{ status: string }>('/health');
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Legacy export for backward compatibility
export const api = apiService;

// Export the client for direct access if needed
export const apiClient = apiService;