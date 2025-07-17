import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Alert, AlertTitle, Button, Container, Typography } from '@mui/material';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Alert severity="error">
        <AlertTitle>Something went wrong</AlertTitle>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {error.message}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={resetErrorBoundary}
          size="small"
        >
          Try again
        </Button>
      </Alert>
    </Container>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Error caught by boundary:', error, errorInfo);
        // TODO: Send to error reporting service
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};