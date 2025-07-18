import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  AppBar,
  Toolbar,
  Chip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import SyllabusProcessor from '../components/SyllabusProcessor';
import type { Course } from '../types';
import { API_BASE_URL } from '../services/api';

const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [searchCrn, setSearchCrn] = useState('');
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState<{ message: string; severity: 'error' | 'warning' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; course: Course | null; action: string; description: string }>({ open: false, course: null, action: '', description: '' });
  
  // Environment detection
  const isDevelopment = API_BASE_URL.includes('localhost') || import.meta.env.DEV;
  const environmentLabel = isDevelopment ? 'Development' : 'Production';
  const apiEndpoint = API_BASE_URL;

  // Query for enrolled courses
  const {
    data: enrolledCourses = [],
    isLoading: isLoadingEnrolled,
    error: enrolledError,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ['enrolledCourses'],
    queryFn: () => courseService.getCourses(),
    refetchOnWindowFocus: false,
  });

  // Debug logging effect (replacement for deprecated onSuccess)
  React.useEffect(() => {
    if (enrolledCourses && enrolledCourses.length >= 0) {
      console.log('=== ENROLLED COURSES DATA DEBUG ===');
      console.log('Total courses:', enrolledCourses.length);
      console.log('Current user:', user);
      console.log('User ID for comparison:', user?.id);
      enrolledCourses.forEach((course: Course, index: number) => {
        console.log(`Course ${index + 1}:`, {
          id: course.id,
          title: course.title,
          created_by: course.created_by,
          isPersonal: course.created_by === user?.id
        });
      });
    }
  }, [enrolledCourses, user?.id]);

  // These are placeholder mutations - the old API methods are deprecated
  const searchMutation = useMutation({
    mutationFn: async (_crn: string) => {
      console.warn('Course search by CRN only is deprecated. Use the new MVP search with school/semester.');
      return [];
    },
    onSuccess: (results) => {
      setSearchResults(results);
      setSearchError('Course search requires school and semester. This feature will be updated soon.');
    },
    onError: () => {
      setSearchError('Course search is currently unavailable.');
      setSearchResults([]);
    },
  });

  // Enrollment mutation placeholder
  const enrollMutation = useMutation({
    mutationFn: async (_courseId: string) => {
      console.warn('Direct course enrollment by ID is deprecated.');
      throw new Error('Feature unavailable');
    },
    onSuccess: () => {
      refetchCourses();
      setSearchResults([]);
      setSearchCrn('');
      setSearchError(null);
    },
    onError: () => {
      setSearchError('Course enrollment is currently unavailable.');
    },
  });

  // Delete course mutation (for personal courses)
  const deleteMutation = useMutation({
    mutationFn: async (courseId: string) => {
      try {
        return await courseService.deleteCourse(courseId);
      } catch (error: any) {
        console.error('Delete course API error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Course deleted successfully');
      refetchCourses();
    },
    onError: (error: any) => {
      console.error('Failed to delete course:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete course. Please try again.';
      setErrorAlert({ message: errorMessage, severity: 'error' });
    },
  });

  // Unenroll from course mutation (for enrolled courses)
  const unenrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      console.log('=== UNENROLL DEBUG ===');
      console.log('Course ID:', courseId);
      console.log('Course ID Type:', typeof courseId);
      console.log('API URL will be:', `/api/courses/${courseId}/unenroll`);
      
      try {
        const result = await courseService.unenrollFromCourse(courseId);
        console.log('Unenroll API response:', result);
        return result;
      } catch (error: any) {
        console.error('Unenroll course API error:', error);
        console.error('Error response:', error.response);
        console.error('Error status:', error.response?.status);
        console.error('Error data:', error.response?.data);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Unenrolled from course successfully');
      refetchCourses();
    },
    onError: (error: any) => {
      console.error('Failed to unenroll from course:', error);
      console.error('Mutation error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to remove course. Please try again.';
      setErrorAlert({ message: errorMessage, severity: 'error' });
    },
  });

  const handleSearch = () => {
    if (searchCrn.trim()) {
      setSearchError(null);
      searchMutation.mutate(searchCrn.trim());
    }
  };

  const handleEnroll = (courseId: string) => {
    enrollMutation.mutate(courseId);
  };

  const handleRemoveCourse = (course: Course) => {
    console.log('=== HANDLE REMOVE COURSE DEBUG ===');
    console.log('Course object:', course);
    console.log('Course ID:', course.id);
    console.log('Course created_by:', course.created_by);
    console.log('Current user ID:', user?.id);
    
    // Check if this is a personal course (student created it)
    const isPersonalCourse = course.created_by === user?.id;
    console.log('Is personal course?', isPersonalCourse);
    
    if (isPersonalCourse) {
      // Delete the course entirely
      console.log('Calling deleteMutation with course ID:', course.id);
      deleteMutation.mutate(course.id);
    } else {
      // Unenroll from the course
      console.log('Calling unenrollMutation with course ID:', course.id);
      unenrollMutation.mutate(course.id);
    }
  };
  
  const handleRemoveClick = (course: Course) => {
    const isPersonalCourse = course.created_by === user?.id;
    const action = isPersonalCourse ? 'delete' : 'unenroll';
    const description = isPersonalCourse 
      ? `permanently delete the personal course "${course.title || course.name || 'Untitled Course'}"?"`
      : `unenroll from "${course.title || course.name || 'Untitled Course'}"?`;
    
    setConfirmDialog({
      open: true,
      course,
      action,
      description
    });
  };
  
  const handleConfirmAction = () => {
    if (confirmDialog.course) {
      handleRemoveCourse(confirmDialog.course);
    }
    setConfirmDialog({ open: false, course: null, action: '', description: '' });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Environment Banner */}
      {isDevelopment && (
        <Alert severity="info" sx={{ mb: 0, borderRadius: 0 }}>
          <Typography variant="body2">
            <strong>🚧 DEVELOPMENT MODE</strong> - API: {apiEndpoint} | Environment: {environmentLabel}
          </Typography>
        </Alert>
      )}
      
      {/* Simple Navigation Bar */}
      <AppBar position="static" elevation={0} sx={{ mb: 4, bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            SyllabAI - Student
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <Button onClick={logout} variant="outlined" size="small">
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        {/* Upload Syllabus Section - TOP PRIORITY */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Upload Your Syllabus
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload any syllabus (even from other courses) to extract events and sync them to your calendar
          </Typography>
          <SyllabusProcessor
            mode="student"
            onComplete={(result) => {
              console.log('Syllabus processed:', result);
              // Refresh the courses list to show the newly saved course
              refetchCourses();
            }}
            onError={(error) => {
              console.error('Syllabus processing error:', error);
            }}
          />
        </Paper>

        <Grid container spacing={4}>
          {/* My Courses Section */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                My Courses
              </Typography>

              {isLoadingEnrolled ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : enrolledError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load enrolled courses. Please refresh the page.
                </Alert>
              ) : (enrolledCourses as Course[]).length === 0 ? (
                <Typography color="text.secondary">
                  No courses enrolled yet. Join a course using CRN.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {(enrolledCourses as Course[]).map((course: Course) => (
                    <Grid item xs={12} sm={6} key={course.id}>
                      <Card
                        component={Link}
                        to={`/course/${course.id}`}
                        sx={{
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6">
                                {course.title || course.name || 'Untitled Course'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {course.crn !== 'PERSONAL' ? `CRN: ${course.crn}` : 'Personal Course'}
                                {course.semester && ` | ${courseService.getSemesterDisplayName(course.semester)}`}
                              </Typography>
                              {course.school?.name && (
                                <Typography variant="body2" color="text.secondary">
                                  {course.school.name}
                                </Typography>
                              )}
                            </Box>
                            <Button
                              size="small"
                              color="error"
                              disabled={deleteMutation.isPending || unenrollMutation.isPending}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('=== BUTTON CLICK DEBUG ===');
                                console.log('Course created_by:', course.created_by, typeof course.created_by);
                                console.log('User ID:', user?.id, typeof user?.id);
                                handleRemoveClick(course);
                              }}
                              sx={{ minWidth: 'auto', p: 0.5 }}
                            >
                              {(deleteMutation.isPending || unenrollMutation.isPending) ? '...' : '×'}
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Grid>

          {/* Join Course Section */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Join Course
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Course CRN"
                  placeholder="Enter course CRN (e.g., 12345)"
                  value={searchCrn}
                  onChange={(e) => setSearchCrn(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={searchMutation.isPending}
                  sx={{ mb: 2 }}
                />
                
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSearch}
                  disabled={searchMutation.isPending || !searchCrn.trim()}
                >
                  {searchMutation.isPending ? 'Searching...' : 'Search'}
                </Button>
              </Box>

              {/* Search Results */}
              {searchError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {searchError}
                </Alert>
              )}

              {searchResults.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Search Results
                  </Typography>
                  {searchResults.map((course) => (
                    <Card key={course.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle1">
                          {course.title || course.name || 'Untitled Course'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          CRN: {course.crn}
                          {course.semester && ` | ${courseService.getSemesterDisplayName(course.semester)}`}
                        </Typography>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => handleEnroll(course.id)}
                          disabled={enrollMutation.isPending}
                        >
                          {enrollMutation.isPending ? 'Enrolling...' : 'Enroll'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}

            </Paper>
          </Grid>
        </Grid>
      </Container>
      
      {/* Error Alert Snackbar */}
      <Snackbar
        open={!!errorAlert}
        autoHideDuration={6000}
        onClose={() => setErrorAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setErrorAlert(null)}
          severity={errorAlert?.severity || 'error'}
          sx={{ width: '100%' }}
        >
          {errorAlert?.message}
        </Alert>
      </Snackbar>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, course: null, action: '', description: '' })}
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        <DialogTitle id="confirmation-dialog-title">
          Confirm {confirmDialog.action === 'delete' ? 'Delete' : 'Unenroll'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirmation-dialog-description">
            Are you sure you want to {confirmDialog.description}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, course: null, action: '', description: '' })}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending || unenrollMutation.isPending}
          >
            {confirmDialog.action === 'delete' ? 'Delete Course' : 'Unenroll'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentDashboard;