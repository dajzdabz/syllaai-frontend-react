import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Paper,
  AppBar,
  Toolbar,
  Alert,
  Chip,
} from '@mui/material';
import { getCourses, createCourse } from '../services/courseService';
import SyllabusProcessor from '../components/SyllabusProcessor';
import type { Course } from '../types';

const ProfessorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [courseForm, setCourseForm] = useState({
    title: '',
    crn: '',
    school_id: 1,
    semester: '2025SP',
    timezone: 'America/New_York'
  });
  const [selectedCourseForSyllabus, setSelectedCourseForSyllabus] = useState<Course | null>(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['professorCourses'],
    queryFn: getCourses,
  });

  const createCourseMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professorCourses'] });
      setCourseForm({ title: '', crn: '', school_id: 1, semester: '2025SP', timezone: 'America/New_York' });
    },
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (courseForm.title && courseForm.crn) {
      createCourseMutation.mutate(courseForm);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Simple Navigation Bar */}
      <AppBar position="static" elevation={0} sx={{ mb: 4, bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            SyllabAI - Professor
          </Typography>
          <Button 
            onClick={() => navigate('/async-processing')} 
            variant="outlined" 
            size="small" 
            sx={{ mr: 2 }}
            endIcon={<Chip label="New!" size="small" color="primary" />}
          >
            Async Processing
          </Button>
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
            Upload Syllabus for Course
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedCourseForSyllabus 
              ? `Upload syllabus for ${selectedCourseForSyllabus.title} (${selectedCourseForSyllabus.crn})`
              : 'Select a course first, then upload its syllabus to extract events'
            }
          </Typography>
          {selectedCourseForSyllabus ? (
            <SyllabusProcessor
              mode="professor"
              courseId={selectedCourseForSyllabus.id}
              onComplete={(result) => {
                console.log('Syllabus processed:', result);
                // Refresh courses to show updated event count
                queryClient.invalidateQueries({ queryKey: ['professorCourses'] });
                setSelectedCourseForSyllabus(null);
              }}
              onError={(error) => {
                console.error('Syllabus processing error:', error);
              }}
              onClose={() => setSelectedCourseForSyllabus(null)}
            />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Create a course first, then click "Upload Syllabus" button next to it to process the syllabus
            </Alert>
          )}
        </Paper>

        <Grid container spacing={4}>
          {/* Create Course Section */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Create Course
              </Typography>
              <form onSubmit={handleCreateCourse}>
                <TextField
                  fullWidth
                  label="Course Title"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  sx={{ mb: 2 }}
                  required
                />
                <TextField
                  fullWidth
                  label="CRN"
                  value={courseForm.crn}
                  onChange={(e) => setCourseForm({ ...courseForm, crn: e.target.value })}
                  sx={{ mb: 2 }}
                  required
                />
                <TextField
                  fullWidth
                  label="Semester"
                  value={courseForm.semester}
                  onChange={(e) => setCourseForm({ ...courseForm, semester: e.target.value })}
                  sx={{ mb: 2 }}
                  placeholder="2025SP"
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={createCourseMutation.isPending}
                >
                  {createCourseMutation.isPending ? 'Creating...' : 'Create Course'}
                </Button>
              </form>
              {createCourseMutation.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Failed to create course
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* My Courses Section */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                My Courses
              </Typography>
              {isLoading ? (
                <Typography>Loading...</Typography>
              ) : courses.length === 0 ? (
                <Typography color="text.secondary">
                  No courses yet. Create one or upload a syllabus.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {courses.map((course: Course) => (
                    <Grid item xs={12} key={course.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6">
                            {course.title || course.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            CRN: {course.crn}
                          </Typography>
                          {course.semester && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Semester: {course.semester}
                            </Typography>
                          )}
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Events: {course.event_count || 0}
                          </Typography>
                          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => setSelectedCourseForSyllabus(course)}
                            >
                              Upload Syllabus
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              href={`/course/${course.id}`}
                            >
                              View Events
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
        </Grid>
      </Container>
    </Box>
  );
};

export default ProfessorDashboard;