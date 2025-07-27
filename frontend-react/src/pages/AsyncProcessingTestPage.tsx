import React from 'react';
import { Container, Typography, Box, Alert, Link } from '@mui/material';
import AsyncSyllabusProcessor from '../components/AsyncSyllabusProcessor';

const ExperimentalBanner: React.FC = () => (
  <Alert severity="info" sx={{ mb: 3 }}>
    <Typography variant="body2">
      <strong>🚀 New Feature:</strong> This is the new async processing system with Celery workers. 
      Processing happens in the background, and you can navigate away while your file is being processed.
      <br />
      <Link href="#" onClick={() => window.location.href = '/'}>
        ← Back to main dashboard
      </Link>
    </Typography>
  </Alert>
);

const AsyncProcessingTestPage: React.FC = () => {
  const handleProcessingComplete = (result: any) => {
    console.log('🎉 Processing completed:', result);
    // You could navigate to course page or show success notification
  };

  const handleError = (error: string) => {
    console.error('❌ Processing error:', error);
    // You could show toast notification or error dialog
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Async Syllabus Processing
        </Typography>
        
        <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Test the new background processing system
        </Typography>

        <ExperimentalBanner />

        <AsyncSyllabusProcessor 
          onProcessingComplete={handleProcessingComplete}
          onError={handleError}
        />

        {/* Instructions */}
        <Box sx={{ mt: 4, p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            How it works:
          </Typography>
          <Typography variant="body2" component="div">
            <ol>
              <li>Select a syllabus file (PDF, DOC, DOCX, TXT, RTF)</li>
              <li>Click "Start Processing" - file uploads instantly</li>
              <li>Watch real-time progress through processing stages</li>
              <li>Get notified when course and events are created</li>
              <li>You can navigate away and return to check progress</li>
            </ol>
          </Typography>
          
          <Typography variant="body2" sx={{ mt: 2 }}>
            <strong>Processing stages:</strong>
          </Typography>
          <Typography variant="body2" component="ul" sx={{ mt: 1 }}>
            <li><strong>Security Validation:</strong> File safety checks and malware scanning</li>
            <li><strong>Text Extraction:</strong> OCR and text parsing from your file</li>
            <li><strong>AI Processing:</strong> Smart extraction of dates, assignments, and exams</li>
            <li><strong>Duplicate Check:</strong> Ensures no duplicate courses are created</li>
            <li><strong>Course Creation:</strong> Creates your course with all detected events</li>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default AsyncProcessingTestPage;