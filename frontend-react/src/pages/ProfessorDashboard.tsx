import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@mui/material';
import { getCourses, createCourse } from '../services/courseService';
import type { Course } from '../types';

const ProfessorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [courseForm, setCourseForm] = useState({
    name: '',
    crn: '',
    description: '',
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['professorCourses'],
    queryFn: getCourses,
  });

  const createCourseMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professorCourses'] });
      setCourseForm({ name: '', crn: '', description: '' });
    },
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (courseForm.name && courseForm.crn) {
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
            Upload Syllabus
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drop your syllabus here to create a new course
          </Typography>
          <Box
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: '#f5f5f5',
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', bgcolor: '#f0f0f0' }
            }}
            onClick={() => document.getElementById('professorSyllabusInput')?.click()}
          >
            <Typography variant="h6" gutterBottom>
              Drop syllabus here or click to browse
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports PDF and DOCX files
            </Typography>
            <input
              id="professorSyllabusInput"
              type="file"
              accept=".pdf,.docx"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  console.log('File selected:', e.target.files[0].name);
                  // TODO: Process syllabus and create course
                }
              }}
            />
          </Box>
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
                  label="Course Name"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
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
                  label="Description"
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  sx={{ mb: 2 }}
                  multiline
                  rows={3}
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
                            {course.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            CRN: {course.crn}
                          </Typography>
                          {course.description && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {course.description}
                            </Typography>
                          )}
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