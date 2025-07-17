import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getEnrolledCourses, searchCourses, enrollInCourse } from '../services/courseService';
import SyllabusProcessor from '../components/SyllabusProcessor';
import type { Course } from '../types';

const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchCrn, setSearchCrn] = useState('');
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Query for enrolled courses
  const {
    data: enrolledCourses = [],
    isLoading: isLoadingEnrolled,
    error: enrolledError,
  } = useQuery({
    queryKey: ['enrolledCourses'],
    queryFn: getEnrolledCourses,
  });

  // Mutation for course search
  const searchMutation = useMutation({
    mutationFn: searchCourses,
    onSuccess: (results) => {
      setSearchResults(results);
      setSearchError(results.length === 0 ? 'No courses found with that CRN' : null);
    },
    onError: () => {
      setSearchError('Failed to search courses. Please try again.');
      setSearchResults([]);
    },
  });

  // Mutation for course enrollment
  const enrollMutation = useMutation({
    mutationFn: enrollInCourse,
    onSuccess: () => {
      // Refresh enrolled courses list
      queryClient.invalidateQueries({ queryKey: ['enrolledCourses'] });
      // Clear search results
      setSearchResults([]);
      setSearchCrn('');
      setSearchError(null);
    },
    onError: () => {
      setSearchError('Failed to enroll in course. Please try again.');
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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
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
              // Show success message or handle the extracted events
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
              ) : enrolledCourses.length === 0 ? (
                <Typography color="text.secondary">
                  No courses enrolled yet. Join a course using CRN.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {enrolledCourses.map((course) => (
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
                          <Typography variant="h6">
                            {course.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            CRN: {course.crn} | Prof: {course.professor_name}
                          </Typography>
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
                          {course.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          CRN: {course.crn} | Prof: {course.professor_name}
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
    </Box>
  );
};

export default StudentDashboard;