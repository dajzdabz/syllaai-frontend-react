import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Psychology,
  EventAvailable,
  CheckCircle,
  Error,
  Schedule,
  LocationOn,
} from '@mui/icons-material';
import { fileService } from '../services/fileService';
import { courseService } from '../services/courseService';
import type { 
  SyllabusUploadResponse, 
  ProcessingStage, 
  CourseEventCreate,
  FileUploadProgress 
} from '../types';

/**
 * Production-Ready Syllabus Processor Component
 * 
 * Handles the complete syllabus upload and processing workflow:
 * - File validation and upload
 * - Real-time progress tracking
 * - AI processing stages visualization
 * - Event extraction display
 * - Calendar integration options
 */

interface SyllabusProcessorProps {
  mode: 'professor' | 'student';
  courseId?: string; // Required for professor mode
  onComplete?: (result: SyllabusUploadResponse) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  className?: string;
}

interface ProcessingStageInfo {
  id: ProcessingStage;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const PROCESSING_STAGES: ProcessingStageInfo[] = [
  {
    id: 'uploading',
    label: 'Uploading File',
    description: 'Uploading your syllabus to our servers...',
    icon: <CloudUpload />
  },
  {
    id: 'extracting', 
    label: 'Extracting Text',
    description: 'Reading and extracting text from your document...',
    icon: <Description />
  },
  {
    id: 'ai-analyzing',
    label: 'AI Analysis',
    description: 'Our AI is analyzing your syllabus content...',
    icon: <Psychology />
  },
  {
    id: 'creating-events',
    label: 'Creating Events',
    description: 'Organizing extracted information into calendar events...',
    icon: <EventAvailable />
  },
  {
    id: 'complete',
    label: 'Complete',
    description: 'Syllabus processed successfully!',
    icon: <CheckCircle />
  }
];

export const SyllabusProcessor: React.FC<SyllabusProcessorProps> = ({
  mode,
  courseId,
  onComplete,
  onError,
  onClose,
  className
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyllabusUploadResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  // File selection handler
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
      setCurrentStage('idle');
      setProgress(0);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
      setCurrentStage('idle');
      setProgress(0);
    }
  }, []);

  // Progress update handler
  const handleProgress = useCallback((progress: FileUploadProgress) => {
    setCurrentStage(progress.stage);
    setProgress(progress.progress);
  }, []);

  // Reset file input
  const resetFileInput = useCallback(() => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    setSelectedFile(null);
    setError(null);
    setResult(null);
    setCurrentStage('idle');
    setProgress(0);
  }, []);

  // Upload and process syllabus
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    // Validate for professor mode
    if (mode === 'professor' && !courseId) {
      setError('Course ID is required for professor uploads');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStage('uploading');

    try {
      const uploadResult = mode === 'professor' 
        ? await fileService.uploadProfessorSyllabus(courseId!, selectedFile, {
            onProgress: handleProgress,
            onStageChange: setCurrentStage
          })
        : await fileService.uploadStudentSyllabus(selectedFile, {
            onProgress: handleProgress,
            onStageChange: setCurrentStage
          });

      setResult(uploadResult);
      setShowResults(true);
      onComplete?.(uploadResult);

    } catch (err: unknown) {
      let errorMessage = 'Upload failed';
      if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as any).message);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
      setCurrentStage('error');
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, mode, courseId, handleProgress, onComplete, onError]);

  // Export to calendar (student mode)
  const handleExportToCalendar = useCallback(async () => {
    if (!result?.extracted_events) return;

    try {
      await courseService.exportToCalendar(result.extracted_events);
      // Show success message or close dialog
      onClose?.();
    } catch (err: unknown) {
      setError('Failed to export to calendar');
    }
  }, [result, onClose]);

  // Save as personal course (student mode)
  const handleSaveAsCourse = useCallback(async () => {
    if (!result?.extracted_events) return;

    try {
      const courseTitle = result.course_metadata?.course_title || `Syllabus Upload ${new Date().toLocaleDateString()}`;
      const semester = result.course_metadata?.semester || '2025SP';
      
      const savedCourse = await courseService.saveToMyCourses({
        course_title: courseTitle,
        semester,
        events: result.extracted_events
      });
      
      console.log('Course saved successfully:', savedCourse);
      
      // Show success message
      setError(null);
      setResult(null);
      setCurrentStage('complete');
      
      // Close dialog and reset after a brief delay to show success
      setTimeout(() => {
        resetFileInput();
        setShowResults(false);
        onClose?.();
      }, 1000);
      
    } catch (err: unknown) {
      console.error('Failed to save course:', err);
      let errorMessage = 'Failed to save course';
      if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as any).message);
      }
      setError(errorMessage);
    }
  }, [result, onClose, resetFileInput]);

  // Render processing stage indicator
  const renderStageIndicator = (stage: ProcessingStageInfo, index: number) => {
    const currentStageIndex = PROCESSING_STAGES.findIndex(s => s.id === currentStage);
    const isActive = index === currentStageIndex;
    const isCompleted = index < currentStageIndex || currentStage === 'complete';
    const isError = currentStage === 'error';

    return (
      <ListItem key={stage.id}>
        <ListItemIcon>
          {isError && isActive ? (
            <Error color="error" />
          ) : isCompleted ? (
            <CheckCircle color="success" />
          ) : isActive ? (
            stage.icon
          ) : (
            stage.icon
          )}
        </ListItemIcon>
        <ListItemText
          primary={stage.label}
          secondary={isActive ? stage.description : undefined}
          primaryTypographyProps={{
            color: isError && isActive ? 'error' : isCompleted ? 'success' : isActive ? 'primary' : 'textSecondary'
          }}
        />
      </ListItem>
    );
  };

  // Render event list
  const renderEventList = (events: CourseEventCreate[]) => (
    <List dense>
      {events.slice(0, 10).map((event, index) => (
        <ListItem key={index}>
          <ListItemText
            primary={event.title}
            secondary={
              <Box>
                <Typography variant="caption" component="div">
                  <Schedule sx={{ fontSize: 12, mr: 0.5 }} />
                  {new Date(event.start_ts).toLocaleDateString()} at{' '}
                  {new Date(event.start_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                {event.location && (
                  <Typography variant="caption" component="div">
                    <LocationOn sx={{ fontSize: 12, mr: 0.5 }} />
                    {event.location}
                  </Typography>
                )}
                <Chip 
                  label={courseService.getEventCategoryDisplayName(event.category)} 
                  size="small" 
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              </Box>
            }
          />
        </ListItem>
      ))}
      {events.length > 10 && (
        <ListItem>
          <ListItemText
            primary={`... and ${events.length - 10} more events`}
            primaryTypographyProps={{ style: { fontStyle: 'italic' } }}
          />
        </ListItem>
      )}
    </List>
  );

  return (
    <Box className={className}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {mode === 'professor' ? 'Upload Course Syllabus' : 'Upload Your Syllabus'}
          </Typography>
          
          {/* File Upload Area */}
          {!isProcessing && !result && (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: selectedFile ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: selectedFile ? 'primary.50' : 'grey.50',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50'
                }
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => {
                if (!selectedFile) {
                  document.getElementById('file-input')?.click();
                }
              }}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              {selectedFile ? (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                  <Button variant="contained" onClick={handleUpload} sx={{ mt: 2 }}>
                    Process Syllabus
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Drop your syllabus here or click to browse
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supports PDF, DOCX, and TXT files (max 10MB)
                  </Typography>
                </Box>
              )}
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </Box>
          )}

          {/* Processing Stages */}
          {isProcessing && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Processing Your Syllabus
              </Typography>
              
              {/* Overall Progress */}
              <Box sx={{ mb: 3 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {progress}% complete
                </Typography>
              </Box>

              {/* Stage List */}
              <List>
                {PROCESSING_STAGES.map((stage, index) => renderStageIndicator(stage, index))}
              </List>

            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Results Preview */}
          {result && !showResults && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Successfully processed syllabus! Found {result.extracted_events.length} events.
              </Alert>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  variant="contained" 
                  onClick={() => setShowResults(true)}
                  fullWidth
                >
                  View Extracted Events
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={resetFileInput}
                  sx={{ minWidth: 120 }}
                >
                  Process Another
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog 
        open={showResults} 
        onClose={() => setShowResults(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Extracted Events
          {result?.course_metadata && (
            <Typography variant="subtitle2" color="text.secondary">
              {result.course_metadata.course_title}
              {result.course_metadata.instructor_name && 
                ` • ${result.course_metadata.instructor_name}`
              }
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {result?.extracted_events && renderEventList(result.extracted_events)}
        </DialogContent>
        <DialogActions>
          {mode === 'student' && (
            <>
              <Button onClick={handleSaveAsCourse} color="primary">
                Save as My Course
              </Button>
              <Button onClick={handleExportToCalendar} color="primary">
                Export to Calendar
              </Button>
            </>
          )}
          <Button onClick={() => setShowResults(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SyllabusProcessor;