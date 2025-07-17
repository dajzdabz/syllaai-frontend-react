import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth';
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (user) {
      navigate(user.is_professor ? '/professor' : '/student');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Initialize Google Auth when component mounts
    authService.initializeGoogleAuth().catch((err) => {
      console.error('Failed to initialize Google Auth:', err);
      setError('Failed to initialize Google Sign-In');
    });

    // Listen for auth changes
    const handleAuthChange = () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        navigate('/dashboard');
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, [navigate]);

  const handleSignIn = async (role: 'professor' | 'student') => {
    setLoading(true);
    setError(null);

    try {
      await authService.signInWithGoogle(role);
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error?.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f5f5',
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', bgcolor: 'white', p: 4, borderRadius: 2 }}>
          <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
            SyllabAI
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
            Sign in as:
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              onClick={() => handleSignIn('professor')}
              disabled={loading}
              variant="contained"
              size="large"
              sx={{ py: 2 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Professor'}
            </Button>
            
            <Button
              onClick={() => handleSignIn('student')}
              disabled={loading}
              variant="contained"
              size="large"
              sx={{ py: 2 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Student'}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Sign in with Google to continue
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;