import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { theme } from './theme';
import './App.css';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProfessorDashboard from './pages/ProfessorDashboard';
import StudentDashboard from './pages/StudentDashboard';
import CourseEventsPage from './pages/CourseEventsPage';
import AsyncProcessingTestPage from './pages/AsyncProcessingTestPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={!user ? <HomePage /> : <Navigate to="/dashboard" />} />
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />
      <Route
        path="/dashboard"
        element={
          user ? (
            user.is_professor ? <ProfessorDashboard /> : <StudentDashboard />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/course/:courseId"
        element={
          user && !user.is_professor ? <CourseEventsPage /> : <Navigate to="/dashboard" />
        }
      />
      <Route
        path="/async-processing"
        element={
          user ? <AsyncProcessingTestPage /> : <Navigate to="/login" />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <AuthProvider>
            <Router basename={import.meta.env.VITE_APP_BASENAME || '/'}>
              <AppRoutes />
            </Router>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;