import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  Breadcrumbs,
} from '@mui/material';
import {
  ArrowBack,
  Event,
  LocationOn,
  Schedule,
  Assignment,
  Quiz,
  School,
  Slideshow,
  Work,
  Category,
} from '@mui/icons-material';
import { courseService } from '../services/courseService';
import { useAuth } from '../contexts/AuthContext';
import type { EventCategory } from '../types';

// Category configuration with colors and icons
const categoryConfig: Record<EventCategory, {
  chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  buttonColor: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  icon: React.ElementType;
  bgColor: string;
}> = {
  Exam: { 
    chipColor: 'error' as const,
    buttonColor: 'error' as const,
    icon: Assignment, 
    bgColor: '#ffebee' 
  },
  Quiz: { 
    chipColor: 'warning' as const,
    buttonColor: 'warning' as const,
    icon: Quiz, 
    bgColor: '#fff3e0' 
  },
  Assignment: { 
    chipColor: 'primary' as const,
    buttonColor: 'primary' as const,
    icon: Work, 
    bgColor: '#e3f2fd' 
  },
  Project: { 
    chipColor: 'secondary' as const,
    buttonColor: 'secondary' as const,
    icon: Work, 
    bgColor: '#e0f2f1' 
  },
  HW: { 
    chipColor: 'primary' as const,
    buttonColor: 'primary' as const,
    icon: Work, 
    bgColor: '#e3f2fd' 
  },
  Presentation: { 
    chipColor: 'success' as const,
    buttonColor: 'success' as const,
    icon: Slideshow, 
    bgColor: '#e8f5e8' 
  },
  Class: { 
    chipColor: 'default' as const,
    buttonColor: 'inherit' as const,
    icon: School, 
    bgColor: '#f5f5f5' 
  },
  Other: { 
    chipColor: 'default' as const,
    buttonColor: 'inherit' as const,
    icon: Category, 
    bgColor: '#f5f5f5' 
  },
  ASSESSMENT: { 
    chipColor: 'error' as const,
    buttonColor: 'error' as const,
    icon: Assignment, 
    bgColor: '#ffebee' 
  },
  EXAM: { 
    chipColor: 'error' as const,
    buttonColor: 'error' as const,
    icon: Assignment, 
    bgColor: '#ffebee' 
  }
};

const CourseEventsPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'All'>('All');

  // Query for course details
  const {
    data: course,
    isLoading: isLoadingCourse,
    error: courseError,
  } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const courses = await courseService.getCourses();
      return courses.find(c => c.id === courseId) || null;
    },
    enabled: !!courseId,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Query for course events
  const {
    data: events = [],
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery({
    queryKey: ['courseEvents', courseId],
    queryFn: async () => {
      try {
        return await courseService.getCourseEvents(courseId!);
      } catch (error: any) {
        console.error('Failed to load course events:', error);
        // For ANY error, return empty array to prevent infinite retries
        // This is especially important for 500 errors from personal courses
        console.log('Error detected, returning empty events array to prevent retries');
        return [];
      }
    },
    enabled: !!courseId,
    retry: false, // Disable retries completely to prevent infinite loop
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 60000, // Cache for 1 minute after component unmount
  });

  // Delete course mutation (for personal courses)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error('No course ID');
      return await courseService.deleteCourse(courseId);
    },
    onSuccess: () => {
      navigate('/dashboard');
    },
    onError: (error: any) => {
      console.error('Failed to delete course:', error);
      alert('Failed to delete course. Please try again.');
    },
  });

  // Unenroll from course mutation (for enrolled courses)
  const unenrollMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error('No course ID');
      return await courseService.unenrollFromCourse(courseId);
    },
    onSuccess: () => {
      navigate('/dashboard');
    },
    onError: (error: any) => {
      console.error('Failed to unenroll from course:', error);
      alert('Failed to remove course. Please try again.');
    },
  });

  const handleRemoveCourse = () => {
    if (!course) return;
    
    // Check if this is a personal course (student created it)
    const isPersonalCourse = course.created_by === user?.id;
    
    if (isPersonalCourse) {
      // Delete the course entirely
      deleteMutation.mutate();
    } else {
      // Unenroll from the course
      unenrollMutation.mutate();
    }
  };

  // Filter events by category
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    if (selectedCategory === 'All') {
      return events;
    }
    return events.filter((event: any) => event.category === selectedCategory);
  }, [events, selectedCategory]);

  // Get unique categories from events
  const availableCategories = useMemo(() => {
    if (!Array.isArray(events)) return [];
    const categories = [...new Set(events.map((event: any) => event.category))];
    return categories.sort();
  }, [events]);

  // Format date and time for display
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const isLoading = isLoadingCourse || isLoadingEvents;
  const hasError = courseError || eventsError;

  if (!courseId) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Invalid course ID. Please check the URL and try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Navigation Bar */}
      <AppBar position="static" elevation={0} sx={{ mb: 4 }}>
        <Toolbar>
          <IconButton
            component={Link}
            to="/dashboard"
            edge="start"
            color="inherit"
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Course Events
          </Typography>
          {course && (
            <Button
              color="error"
              variant="outlined"
              disabled={deleteMutation.isPending || unenrollMutation.isPending}
              onClick={() => {
                if (!course) return;
                const isPersonalCourse = course.created_by === user?.id;
                const actionText = isPersonalCourse 
                  ? 'delete this course and all its events' 
                  : 'remove this course from your list';
                if (window.confirm(`Are you sure you want to ${actionText}?`)) {
                  handleRemoveCourse();
                }
              }}
            >
              {(deleteMutation.isPending || unenrollMutation.isPending) 
                ? 'Removing...' 
                : (course?.created_by === user?.id ? 'Delete Course' : 'Remove Course')
              }
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link to="/dashboard" style={{ textDecoration: 'none' }}>
            <Typography color="primary">Dashboard</Typography>
          </Link>
          <Typography color="text.primary">
            {course?.name || 'Course Events'}
          </Typography>
        </Breadcrumbs>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={60} />
          </Box>
        ) : hasError ? (
          <Alert severity="error" sx={{ mb: 4 }}>
            Failed to load course events. Please try refreshing the page.
          </Alert>
        ) : !course ? (
          <Alert severity="warning" sx={{ mb: 4 }}>
            Course not found. You may not be enrolled in this course.
          </Alert>
        ) : (
          <>
            {/* Course Header */}
            <Paper sx={{ p: 4, mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <School sx={{ fontSize: 40, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h3" component="h1" gutterBottom>
                    {course.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip label={course.crn} color="primary" />
                    <Typography variant="h6" color="text.secondary">
                      {course.professor_name}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Category Filters */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Filter by Category
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant={selectedCategory === 'All' ? 'contained' : 'outlined'}
                  onClick={() => setSelectedCategory('All')}
                  size="small"
                >
                  All ({Array.isArray(events) ? events.length : 0})
                </Button>
                {availableCategories.map((category) => {
                  const count = Array.isArray(events) ? events.filter((e: any) => e.category === category).length : 0;
                  const config = categoryConfig[category as EventCategory];
                  if (!config) {
                    console.warn(`Unknown category: ${category}, skipping`);
                    return null;
                  }
                  const IconComponent = config.icon;
                  
                  return (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'contained' : 'outlined'}
                      color={config.buttonColor}
                      onClick={() => setSelectedCategory(category as EventCategory)}
                      startIcon={<IconComponent />}
                      size="small"
                    >
                      {category} ({count})
                    </Button>
                  );
                })}
              </Box>
            </Paper>

            {/* Events Display */}
            <Typography variant="h4" gutterBottom>
              {selectedCategory === 'All' ? 'All Events' : `${selectedCategory} Events`}
              <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 2 }}>
                ({filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'})
              </Typography>
            </Typography>

            {filteredEvents.length === 0 ? (
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <Event sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No {selectedCategory === 'All' ? '' : selectedCategory.toLowerCase()} events found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCategory === 'All' 
                    ? course?.crn === 'PERSONAL' 
                      ? 'Personal courses may not have events properly loaded yet. This is a known issue we\'re working on.' 
                      : 'This course has no events yet.'
                    : 'Try selecting a different category to see more events.'}
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {filteredEvents.map((event: any) => {
                  const config = categoryConfig[event.category as EventCategory] || categoryConfig.Other;
                  const IconComponent = config.icon;
                  const dateTime = formatDateTime(event.start_ts);

                  return (
                    <Grid item xs={12} md={6} lg={4} key={event.id}>
                      <Card
                        sx={{
                          height: '100%',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 3,
                          },
                        }}
                      >
                        <CardContent>
                          {/* Category Badge */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Chip
                              icon={<IconComponent />}
                              label={event.category}
                              color={config.chipColor}
                              size="small"
                            />
                          </Box>

                          {/* Event Title */}
                          <Typography variant="h6" component="h3" gutterBottom>
                            {event.title}
                          </Typography>

                          {/* Date and Time */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {dateTime.date} at {dateTime.time}
                            </Typography>
                          </Box>

                          {/* Location */}
                          {event.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                              <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {event.location}
                              </Typography>
                            </Box>
                          )}

                          {/* Description */}
                          {event.description && (
                            <Typography variant="body2" color="text.secondary">
                              {event.description}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default CourseEventsPage;