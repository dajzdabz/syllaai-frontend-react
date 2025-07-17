import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Google } from '@mui/icons-material';
import { authService } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await authService.signInWithGoogle();
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
        bgcolor: 'grey.50',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
            SyllabAI
          </Typography>
          <Typography
            variant="h5"
            component="h2"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Sign in to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="outlined"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <Google />}
            sx={{
              px: 4,
              py: 1.5,
              mb: 3,
              borderColor: '#dadce0',
              color: '#3c4043',
              '&:hover': {
                backgroundColor: '#f8f9fa',
                borderColor: '#dadce0',
              },
            }}
            fullWidth
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          {/* Fallback button container for Google's rendered button */}
          <Box id="google-signin-button" sx={{ display: 'none' }} />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
            By signing in, you agree to our terms of service and privacy policy.
          </Typography>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;