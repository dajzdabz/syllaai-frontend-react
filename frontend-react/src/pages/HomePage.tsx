import React from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  AppBar,
  Toolbar,
} from '@mui/material';

const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect to appropriate dashboard
  React.useEffect(() => {
    if (user) {
      navigate(user.is_professor ? '/professor' : '/student');
    }
  }, [user, navigate]);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Simple Navigation Bar */}
      <AppBar position="static" elevation={0} sx={{ mb: 4, bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            SyllabAI
          </Typography>
          {user && (
            <>
              <Typography variant="body2" sx={{ mr: 2 }}>
                {user.name}
              </Typography>
              <Button onClick={logout} variant="outlined" size="small">
                Sign Out
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Hero Section */}
        <Box textAlign="center" sx={{ mb: 6 }}>
          <Typography variant="h2" component="h1" sx={{ mb: 2 }}>
            SyllabAI
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
            Upload syllabus → Extract dates → Sync to calendar
          </Typography>
          <Button
            component={Link}
            to="/login"
            variant="contained"
            size="large"
          >
            Get Started
          </Button>
        </Box>


        {/* Simple Role Selection */}
        <Box textAlign="center">
          <Typography variant="h4" sx={{ mb: 4 }}>
            Choose Your Role
          </Typography>
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} sm={6} md={4}>
              <Card
                component={Link}
                to="/login"
                sx={{
                  p: 4,
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="h5" gutterBottom>
                  Professor
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Upload syllabi and manage courses
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card
                component={Link}
                to="/login"
                sx={{
                  p: 4,
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="h5" gutterBottom>
                  Student
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Join courses and sync calendar
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;