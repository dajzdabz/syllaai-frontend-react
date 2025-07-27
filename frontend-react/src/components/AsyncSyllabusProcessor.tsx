import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error,
  Cancel,
  Refresh,
  Schedule,
  Security,
  Psychology,
  FindInPage,
  Create,
} from '@mui/icons-material';
import { useAsyncSyllabusProcessing } from '../hooks/useAsyncSyllabusProcessing';

interface AsyncSyllabusProcessorProps {
  onProcessingComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

const AsyncSyllabusProcessor: React.FC<AsyncSyllabusProcessorProps> = ({
  onProcessingComplete,
  onError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showResults, setShowResults] = useState(false);

  const {
    currentJob,
    status,
    error,
    uploadProgress,
    isProcessing,
    isCompleted,
    isFailed,
    uploadSyllabusAsync,
    cancelJob,
    reset,
    getStatusMessage,
  } = useAsyncSyllabusProcessing();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset(); // Reset any previous processing state
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await uploadSyllabusAsync(selectedFile);
    if (!result.success && result.error) {
      onError?.(result.error);
    }
  };

  const handleCancel = () => {
    cancelJob();
    reset();
    setSelectedFile(null);
  };

  const handleViewResults = () => {
    if (currentJob?.result_data) {
      setShowResults(true);
      onProcessingComplete?.(currentJob.result_data);
    }
  };

  const getStepIndex = () => {
    switch (status) {
      case 'uploading':
      case 'queued':
        return 0;
      case 'validating':
        return 1;
      case 'extracting':
        return 2;
      case 'ai_parsing':
        return 3;
      case 'checking_duplicates':
        return 4;
      case 'creating_course':
        return 5;
      case 'completed':
        return 6;
      default:
        return 0;
    }
  };

  const steps = [
    { label: 'Upload File', icon: <CloudUpload /> },
    { label: 'Security Validation', icon: <Security /> },
    { label: 'Text Extraction', icon: <FindInPage /> },
    { label: 'AI Processing', icon: <Psychology /> },
    { label: 'Duplicate Check', icon: <Refresh /> },
    { label: 'Create Course', icon: <Create /> },
    { label: 'Complete', icon: <CheckCircle /> },
  ];

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', mt: 2 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule />
          Async Syllabus Processing
          <Chip label="New!" color="primary" size="small" />
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload your syllabus file for background processing. You can navigate away and return to check progress.
        </Typography>

        {/* File Upload Section */}
        {!isProcessing && !isCompleted && (
          <Box sx={{ mb: 3 }}>
            <input
              accept=".pdf,.doc,.docx,.txt,.rtf"
              style={{ display: 'none' }}
              id="async-file-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="async-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUpload />}
                sx={{ mr: 2 }}
              >
                Choose File
              </Button>
            </label>

            {selectedFile && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  sx={{ mt: 1 }}
                  disabled={!selectedFile}
                >
                  Start Processing
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Processing Steps */}
        {(isProcessing || isCompleted || isFailed) && (
          <Box sx={{ mb: 3 }}>
            <Stepper activeStep={getStepIndex()} alternativeLabel>
              {steps.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel 
                    icon={step.icon}
                    error={isFailed && index === getStepIndex()}
                  >
                    {step.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* Upload Progress */}
        {status === 'uploading' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Uploading file... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        {/* Processing Progress */}
        {isProcessing && status !== 'uploading' && currentJob && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {getStatusMessage()}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={currentJob.progress_percentage || 0} 
            />
            <Typography variant="caption" color="text.secondary">
              Job ID: {currentJob.job_id}
            </Typography>
          </Box>
        )}

        {/* Error Display */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <IconButton size="small" onClick={reset}>
                <Refresh />
              </IconButton>
            }
          >
            {error}
          </Alert>
        )}

        {/* Success Display */}
        {isCompleted && currentJob?.result_data && (
          <Alert 
            severity="success" 
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={handleViewResults}>
                View Results
              </Button>
            }
          >
            Processing completed! Course "{currentJob.result_data.course_title}" created with{' '}
            {currentJob.result_data.events_created} events.
          </Alert>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          {isProcessing && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}

          {(isCompleted || isFailed) && (
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => {
                reset();
                setSelectedFile(null);
              }}
            >
              Start New
            </Button>
          )}
        </Box>

        {/* Job Details (for debugging) */}
        {currentJob && import.meta.env.DEV && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" component="pre">
              {JSON.stringify(currentJob, null, 2)}
            </Typography>
          </Box>
        )}

        {/* Results Dialog */}
        <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="md" fullWidth>
          <DialogTitle>Processing Results</DialogTitle>
          <DialogContent>
            {currentJob?.result_data && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Course: {currentJob.result_data.course_title}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {currentJob.result_data.events_created} events created
                </Typography>
                
                {currentJob.result_data.processing_summary && (
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Description /></ListItemIcon>
                      <ListItemText 
                        primary="File Processing"
                        secondary={`${currentJob.result_data.processing_summary.original_filename} (${currentJob.result_data.processing_summary.file_size} bytes)`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><FindInPage /></ListItemIcon>
                      <ListItemText 
                        primary="Text Extracted"
                        secondary={`${currentJob.result_data.processing_summary.text_length} characters`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Psychology /></ListItemIcon>
                      <ListItemText 
                        primary="AI Events Found"
                        secondary={`${currentJob.result_data.processing_summary.ai_events_found} events detected`}
                      />
                    </ListItem>
                  </List>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowResults(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AsyncSyllabusProcessor;