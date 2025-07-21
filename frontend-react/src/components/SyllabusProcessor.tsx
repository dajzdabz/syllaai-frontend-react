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
  TextField,
  Grid,
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [editableCourseTitle, setEditableCourseTitle] = useState('');
  const [editableSemester, setEditableSemester] = useState('');

  // File selection handler
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔥 handleFileSelect CALLED at', new Date().toISOString());
    console.log('🔥 Event target:', event.target);
    console.log('🔥 Event target files:', event.target.files);
    const file = event.target.files?.[0];
    console.log('📁 File selected:', file?.name, file?.size);
    if (file) {
      console.log('✅ Setting file in state');
      setSelectedFile(file);
      setError(null);
      setResult(null);
      setCurrentStage('idle');
      setProgress(0);
      console.log('✅ File state updated, new file:', file.name);
    } else {
      console.log('❌ No file found in event.target.files');
    }
  }, []); // Remove selectedFile dependency to avoid closure issues

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    console.log('🎯 handleDrop CALLED at', new Date().toISOString());
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    console.log('🎯 Dropped file:', file?.name, file?.size);
    if (file) {
      console.log('🎯 Setting dropped file in state');
      setSelectedFile(file);
      setError(null);
      setResult(null);
      setCurrentStage('idle');
      setProgress(0);
      console.log('🎯 Dropped file state updated:', file.name);
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
    console.log('🚀 handleUpload CALLED at', new Date().toISOString());
    console.log('🚀 Selected file:', selectedFile?.name, selectedFile?.size);
    console.log('🚀 Mode:', mode);
    console.log('🚀 Course ID:', courseId);
    
    if (!selectedFile) {
      console.log('❌ No file selected, returning');
      return;
    }

    // Validate for professor mode
    if (mode === 'professor' && !courseId) {
      console.log('❌ Professor mode but no course ID');
      setError('Course ID is required for professor uploads');
      return;
    }

    console.log('✅ Starting upload process...');
    setIsProcessing(true);
    setError(null);
    setCurrentStage('uploading');

    try {
      console.log('📤 Calling fileService upload for mode:', mode);
      const uploadResult = mode === 'professor' 
        ? await fileService.uploadProfessorSyllabus(courseId!, selectedFile, {
            onProgress: handleProgress,
            onStageChange: setCurrentStage
          })
        : await fileService.uploadStudentSyllabus(selectedFile, {
            onProgress: handleProgress,
            onStageChange: setCurrentStage
          });

      console.log('✅ Upload complete, result:', uploadResult);
      console.log('🎯 Setting result state...');
      setResult(uploadResult);
      console.log('🎯 Setting showResults to true...');
      setShowResults(true);
      console.log('🎯 States updated, dialog should show');
      onComplete?.(uploadResult);

    } catch (err: unknown) {
      console.error('❌ Upload error:', err);
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
      console.log('🗓️ Starting calendar export with', result.extracted_events.length, 'events');
      await courseService.exportToCalendar(result.extracted_events);
      
      // Show success message
      setError(null);
      setSuccessMessage('Successfully exported events to Google Calendar!');
      
      // Close dialog after a brief delay to show success
      setTimeout(() => {
        onClose?.();
        setSuccessMessage(null);
      }, 2000);
      
    } catch (err: any) {
      console.error('❌ Calendar export failed:', err);
      
      // Check if it's an authentication error
      if (err.response?.status === 401 || err.response?.status === 403 || 
          err.response?.data?.detail?.includes('auth') ||
          err.response?.data?.detail?.includes('Google Calendar access required')) {
        
        try {
          console.log('🔐 Calendar auth required, getting OAuth URL...');
          const authResponse = await courseService.getGoogleCalendarAuthUrl();
          
          // Show user-friendly message with OAuth link
          setError(
            `To export events to Google Calendar, you need to connect your Google account first. ` +
            `Click here to connect: ${authResponse.oauth_url}`
          );
          
          // Open OAuth URL in new tab
          window.open(authResponse.oauth_url, '_blank');
          
        } catch (authErr) {
          console.error('❌ Failed to get OAuth URL:', authErr);
          setError('Failed to get Google Calendar authorization. Please try again.');
        }
      } else {
        // Generic error message
        let errorMessage = 'Failed to export to calendar';
        if (err.response?.data?.detail) {
          errorMessage += ': ' + err.response.data.detail;
        } else if (err.message) {
          errorMessage += ': ' + err.message;
        }
        setError(errorMessage);
      }
    }
  }, [result, onClose]);

  // Show confirmation dialog with course details
  const handleSaveAsCourse = useCallback(() => {
    console.log('🔥 handleSaveAsCourse called - showing confirmation');
    
    if (!result?.extracted_events) {
      console.log('❌ No extracted events, returning');
      return;
    }
    
    // Pre-populate editable fields with extracted data or smart defaults
    const extractedTitle = result.course_metadata?.course_title || '';
    const extractedSemester = result.course_metadata?.semester || '';
    
    setEditableCourseTitle(extractedTitle || `My Course - ${new Date().toLocaleDateString()}`);
    setEditableSemester(extractedSemester || '2025SP');
    setShowConfirmation(true);
  }, [result]);

  // Actually save the course after confirmation
  const handleConfirmSave = useCallback(async () => {
    console.log('🔥 handleConfirmSave called');
    
    if (!result?.extracted_events) {
      console.log('❌ No extracted events, returning');
      return;
    }

    try {
      // Use the user-edited values from the confirmation dialog
      console.log('🔄 About to call courseService.saveToMyCourses with:', {
        course_title: editableCourseTitle,
        semester: editableSemester,
        events: result.extracted_events.length + ' events'
      });
      
      const savedCourse = await courseService.saveToMyCourses({
        course_title: editableCourseTitle,
        semester: editableSemester,
        events: result.extracted_events
      });
      
      console.log('✅ Course saved successfully:', savedCourse);
      
      // Show success message
      setError(null);
      setSuccessMessage(`Successfully saved "${editableCourseTitle}" to My Courses!`);
      setCurrentStage('complete');
      setShowConfirmation(false);
      
      // Close dialog and reset after a brief delay to show success
      setTimeout(() => {
        resetFileInput();
        setShowResults(false);
        setSuccessMessage(null);
        onClose?.();
      }, 2000);
      
    } catch (err: unknown) {
      console.error('❌ Failed to save course:', err);
      console.error('❌ Error type:', typeof err);
      console.error('❌ Error details:', err);
      let errorMessage = 'Failed to save course';
      if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as any).message);
      }
      console.error('❌ Setting error message:', errorMessage);
      setError(errorMessage);
      setShowConfirmation(false);
    }
  }, [result, onClose, resetFileInput, editableCourseTitle, editableSemester]);

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
                console.log('🖱️ Upload area clicked at', new Date().toISOString());
                console.log('🖱️ Current selectedFile:', selectedFile?.name || 'null');
                if (!selectedFile) {
                  console.log('🖱️ Triggering file input click');
                  const fileInput = document.getElementById('file-input');
                  console.log('🖱️ File input element:', fileInput);
                  fileInput?.click();
                } else {
                  console.log('🖱️ File already selected, not triggering input');
                }
              }}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              {(() => {
                console.log('🔍 Render check - selectedFile:', selectedFile?.name || 'null');
                return selectedFile ? (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                    <Button 
                      variant="contained" 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent parent onClick from firing
                        console.log('📋 Process button clicked');
                        handleUpload();
                      }} 
                      sx={{ mt: 2 }}
                    >
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
                );
              })()}
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
      {(() => {
        console.log('🔍 Dialog render - showResults:', showResults, 'result:', result?.extracted_events?.length || 0);
        return null;
      })()}
      <Dialog 
        open={showResults} 
        onClose={() => {
          console.log('🔍 Dialog onClose called');
          setShowResults(false);
        }}
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
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}
          {result?.extracted_events && renderEventList(result.extracted_events)}
        </DialogContent>
        <DialogActions>
          {mode === 'student' && (
            <>
              <Button 
                onClick={handleSaveAsCourse} 
                color="primary"
                disabled={!!successMessage}
              >
                {successMessage ? 'Saved!' : 'Save as My Course'}
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

      {/* Course Confirmation Dialog */}
      <Dialog
        open={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Course Information
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Please confirm the course information extracted from your syllabus:
          </Typography>
          
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Course Details (you can edit these):
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Course Title"
                  value={editableCourseTitle}
                  onChange={(e) => setEditableCourseTitle(e.target.value)}
                  placeholder="Enter course title"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Semester"
                  value={editableSemester}
                  onChange={(e) => setEditableSemester(e.target.value)}
                  placeholder="e.g., 2025SP, Fall 2024"
                  size="small"
                />
              </Grid>
            </Grid>
            
            {result?.course_metadata?.course_code && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Course Code:</strong> {result.course_metadata.course_code}
              </Typography>
            )}
            
            {result?.course_metadata?.instructor_name && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Instructor:</strong> {result.course_metadata.instructor_name}
              </Typography>
            )}
            
            {result?.course_metadata?.university && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>University:</strong> {result.course_metadata.university}
              </Typography>
            )}
            
            <Typography variant="body2">
              <strong>Events:</strong> {result?.extracted_events?.length || 0} events will be added
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will create a new course in "My Courses" with all the extracted events.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmation(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSave} variant="contained" color="primary">
            Save to My Courses
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SyllabusProcessor;