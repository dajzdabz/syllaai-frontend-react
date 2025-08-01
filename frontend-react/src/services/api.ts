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
export const ASYNC_API_BASE_URL = import.meta.env.VITE_ASYNC_API_URL || 'https://syllaai-web.onrender.com';

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🌐 Environment:', import.meta.env.MODE);
console.log('🌐 VITE_API_URL:', import.meta.env.VITE_API_URL);

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
      timeout: 150000, // 2.5 minute timeout to allow for AI processing
      withCredentials: true, // SECURITY FIX: Send secure cookies with all requests
      // Don't set default Content-Type - let each request specify as needed
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // SECURITY FIX: No longer send Authorization headers
        // Authentication is now handled via secure HttpOnly cookies
        console.log('🔍 API Request debug - URL:', config.url, 'Method:', config.method);
        console.log('🍪 Using secure cookie authentication');
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        // Set Content-Type for JSON requests (not FormData)
        if (config.data && !(config.data instanceof FormData)) {
          config.headers['Content-Type'] = 'application/json';
        }
        
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
    // Don't retry course events requests - they often return 500 for personal courses without events
    if (error.config?.url?.includes('/events') && error.response?.status === 500) {
      return false;
    }
    
    // Retry on network errors or 5xx server errors (except course events)
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
    // SECURITY FIX: Clear session data but cookies are handled by browser/backend
    localStorage.removeItem('user');
    localStorage.removeItem('session_expires_at');
    localStorage.removeItem('user_permissions');
    window.dispatchEvent(new CustomEvent('auth-change', {
      detail: { user: null, authenticated: false }
    }));
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
          apiError.message = 'Authentication failed. Please sign in again.';
          console.log('🔄 401 Error - Token may be expired, triggering re-auth');
          break;
        case 403:
          apiError.type = ApiErrorTypes.AUTHORIZATION_ERROR;
          apiError.message = 'You do not have permission to perform this action';
          break;
        case 404:
          apiError.type = ApiErrorTypes.VALIDATION_ERROR;
          apiError.message = data?.detail || 'Resource not found';
          console.log('🔍 404 Error details:', {
            url: error.config?.url,
            method: error.config?.method,
            fullURL: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
            data: data
          });
          break;
        case 413:
          apiError.type = ApiErrorTypes.FILE_PROCESSING_ERROR;
          apiError.message = 'File is too large. Please choose a smaller file.';
          break;
        case 422:
          apiError.type = ApiErrorTypes.VALIDATION_ERROR;
          apiError.message = data?.detail || 'Validation error';
          console.log('🚨 422 VALIDATION ERROR DEBUG:', {
            fullResponse: data,
            detail: data?.detail,
            detailArray: Array.isArray(data?.detail) ? data.detail : null,
            message: data?.message,
            errors: data?.errors,
            url: error.config?.url,
            method: error.config?.method
          });
          // If detail is an array, log each element
          if (Array.isArray(data?.detail)) {
            console.log('🔍 Detail array contents:');
            data.detail.forEach((item: any, index: number) => {
              console.log(`  [${index}]:`, item);
            });
          }
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
    credential?: string;
    authorization_code?: string;
    redirect_uri?: string;
    role?: 'professor' | 'student' | 'admin';
  }): Promise<AuthResponse> {
    console.log('🔐 Authenticating with payload:', {
      hasCredential: !!payload.credential,
      credentialLength: payload.credential?.length,
      hasAuthCode: !!payload.authorization_code,
      authCodeLength: payload.authorization_code?.length,
      role: payload.role,
      redirectUri: payload.redirect_uri
    });
    
    try {
      const response = await this.client.post<AuthResponse>('/api/auth/authenticate', payload);
      console.log('🔐 Authentication response received:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });
      return response.data;
    } catch (error: any) {
      console.error('🔐 Authentication request failed:', {
        url: '/api/auth/authenticate',
        method: 'POST',
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/api/auth/me');
    return response.data;
  }

  async logout(): Promise<void> {
    // Call backend logout to clear secure cookie
    await this.client.post('/api/auth/logout');
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
    console.log('\n=== API SERVICE DELETE COURSE DEBUG ===');
    console.log('Course ID received:', courseId);
    console.log('Course ID type:', typeof courseId);
    console.log('Course ID length:', courseId.length);
    console.log('Is valid UUID format?:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId));
    
    const url = `/api/courses/${courseId}`;
    const fullURL = `${this.client.defaults.baseURL}${url}`;
    console.log('Constructed URL:', url);
    console.log('Full URL:', fullURL);
    console.log('Base URL:', this.client.defaults.baseURL);
    console.log('Environment:', import.meta.env.MODE);
    
    try {
      console.log('\ud83d\ude80 Making DELETE request to:', fullURL);
      const response = await this.client.delete(url);
      console.log('\u2705 Delete course response status:', response.status);
      console.log('\u2705 Delete course response data:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('\u274c API delete course request failed:', error);
      console.error('\ud83d\udd0d Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        fullURL: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
        headers: error.config?.headers
      });
      console.error('\ud83d\udea8 Response details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      if (error.response?.status === 404) {
        console.error('\ud83d\udd34 404 ERROR: The delete course endpoint may not exist on the backend');
        console.error('Expected endpoint: DELETE /api/courses/{course_id}');
        console.error('Attempted URL:', fullURL);
      }
      
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
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<SyllabusUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<SyllabusUploadResponse>(
      `/api/courses/${courseId}/syllabus`,
      formData,
      {
        timeout: 180000, // 3 minute timeout for AI processing
        signal, // Pass abort signal for cancellation
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
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<SyllabusUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<SyllabusUploadResponse>(
      '/api/courses/student-syllabus',
      formData,
      {
        timeout: 180000, // 3 minute timeout for AI processing
        signal, // Pass abort signal for cancellation
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

  // Async Processing Endpoints (New Celery-based system)
  private asyncClient = axios.create({
    baseURL: ASYNC_API_BASE_URL,
    timeout: 10000, // Short timeout for job submission
  });

  async uploadSyllabusAsync(
    file: File,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<{ job_id: string; status: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    // Set auth token for async client
    const token = localStorage.getItem('access_token');
    if (token) {
      this.asyncClient.defaults.headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.asyncClient.post(
      '/api/syllabus-processing/upload',
      formData,
      {
        signal,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );
    
    console.log('🚀 Async upload started:', response.data);
    return response.data;
  }

  async getProcessingStatus(jobId: string): Promise<{
    job_id: string;
    status: string;
    progress_percentage: number;
    current_stage: string;
    error_message?: string;
    result_data?: any;
  }> {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.asyncClient.defaults.headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.asyncClient.get(`/api/syllabus-processing/status/${jobId}`);
    return response.data;
  }

  async listProcessingJobs(
    limit = 20,
    offset = 0,
    statusFilter?: string
  ): Promise<{
    jobs: any[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  }> {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.asyncClient.defaults.headers.Authorization = `Bearer ${token}`;
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (statusFilter) {
      params.append('status_filter', statusFilter);
    }

    const response = await this.asyncClient.get(`/api/syllabus-processing/jobs?${params}`);
    return response.data;
  }

  async cancelProcessingJob(jobId: string): Promise<{
    message: string;
    job_id: string;
    status: string;
  }> {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.asyncClient.defaults.headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.asyncClient.delete(`/api/syllabus-processing/jobs/${jobId}`);
    return response.data;
  }

  // Calendar endpoints
  async exportToCalendar(events: CourseEventCreate[]): Promise<void> {
    await this.client.post('/api/student-events/export-to-calendar', events);
  }

  async getGoogleCalendarAuthUrl(): Promise<{ oauth_url: string }> {
    const response = await this.client.get<{ oauth_url: string }>('/api/student-events/google-calendar-auth');
    return response.data;
  }

  async handleGoogleCalendarCallback(code: string): Promise<void> {
    await this.client.post('/api/student-events/google-calendar-callback', { code });
  }

  async saveToMyCourses(data: {
    course_title: string;
    semester?: string;
    events: CourseEventCreate[];
  }): Promise<Course> {
    // Log the data being sent for debugging
    console.log('🔍 saveToMyCourses data before sending:', {
      course_title: data.course_title,
      semester: data.semester,
      events_count: data.events.length,
      sample_event: data.events[0],
      event_categories: data.events.map(e => e.category),
      sample_event_full: JSON.stringify(data.events[0], null, 2),
      all_event_fields: data.events[0] ? Object.keys(data.events[0]) : []
    });
    
    const response = await this.client.post<Course>('/api/save-courses-fix/save-to-my-courses-fixed', data);
    return response.data;
  }

  // Course update endpoints

  async updateCourse(courseId: string, updates: {
    title?: string;
    crn?: string;
    semester?: string;
  }): Promise<Course> {
    console.log('🔄 Updating course:', courseId, updates);
    
    const response = await this.client.put<Course>(`/api/courses/${courseId}`, updates);
    return response.data;
  }

  async mergeCourseUpdates(courseId: string, data: {
    new_events: CourseEventCreate[];
    course_updates?: {
      title?: string;
      crn?: string;
      semester?: string;
    };
  }): Promise<{
    message: string;
    course_id: string;
    course_title: string;
    events_updated: number;
    updated_at: string;
  }> {
    console.log('🔄 Merging course updates:', courseId, {
      events_count: data.new_events.length,
      has_course_updates: !!data.course_updates
    });
    
    const response = await this.client.post(`/api/courses/${courseId}/merge-updates`, data);
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