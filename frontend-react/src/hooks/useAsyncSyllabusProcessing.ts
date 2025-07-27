import { useState, useCallback } from 'react';
import { apiService } from '../services/api';

export interface ProcessingJob {
  job_id: string;
  status: string;
  progress_percentage: number;
  current_stage: string;
  error_message?: string;
  result_data?: any;
  created_at: string;
  updated_at: string;
}

export type ProcessingStatus = 
  | 'idle' 
  | 'uploading' 
  | 'queued' 
  | 'validating' 
  | 'extracting' 
  | 'ai_parsing' 
  | 'checking_duplicates' 
  | 'creating_course' 
  | 'completed' 
  | 'failed';

export const useAsyncSyllabusProcessing = () => {
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Polling for job status updates
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const jobStatus = await apiService.getProcessingStatus(jobId);
      setCurrentJob({
        ...jobStatus,
        created_at: currentJob?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setStatus(jobStatus.status as ProcessingStatus);
      
      // Stop polling if job is complete or failed
      if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
        return false; // Stop polling
      }
      
      return true; // Continue polling
    } catch (error) {
      console.error('Error polling job status:', error);
      setError('Failed to get processing status');
      return false;
    }
  }, [currentJob]);

  // Start polling with interval
  const startPolling = useCallback((jobId: string) => {
    const pollInterval = setInterval(async () => {
      const shouldContinue = await pollJobStatus(jobId);
      if (!shouldContinue) {
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Initial poll
    pollJobStatus(jobId);

    // Cleanup function
    return () => clearInterval(pollInterval);
  }, [pollJobStatus]);

  // Upload syllabus with async processing
  const uploadSyllabusAsync = useCallback(async (file: File) => {
    try {
      setStatus('uploading');
      setError(null);
      setUploadProgress(0);

      console.log('🚀 Starting async syllabus upload:', file.name);

      const result = await apiService.uploadSyllabusAsync(
        file,
        (progress) => setUploadProgress(progress)
      );

      console.log('✅ Upload successful, job created:', result);

      setStatus('queued');
      setCurrentJob({
        job_id: result.job_id,
        status: result.status,
        progress_percentage: 0,
        current_stage: 'File uploaded, queued for processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Start polling for updates
      const cleanup = startPolling(result.job_id);
      
      return { success: true, jobId: result.job_id, cleanup };

    } catch (error: any) {
      console.error('❌ Async upload failed:', error);
      setStatus('failed');
      setError(error.response?.data?.detail || error.message || 'Upload failed');
      return { success: false, error: error.message };
    }
  }, [startPolling]);

  // Cancel current job
  const cancelJob = useCallback(async () => {
    if (!currentJob) return;

    try {
      await apiService.cancelProcessingJob(currentJob.job_id);
      setStatus('failed');
      setCurrentJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (error: any) {
      console.error('Failed to cancel job:', error);
      setError('Failed to cancel processing');
    }
  }, [currentJob]);

  // Reset state
  const reset = useCallback(() => {
    setCurrentJob(null);
    setStatus('idle');
    setError(null);
    setUploadProgress(0);
  }, []);

  // Get user-friendly status message
  const getStatusMessage = useCallback(() => {
    if (!currentJob) return '';

    switch (currentJob.status) {
      case 'queued':
        return 'File uploaded, waiting in queue...';
      case 'validating':
        return 'Validating file security...';
      case 'extracting':
        return 'Extracting text from file...';
      case 'ai_parsing':
        return 'Processing syllabus with AI...';
      case 'checking_duplicates':
        return 'Checking for duplicate courses...';
      case 'creating_course':
        return 'Creating course and events...';
      case 'completed':
        return 'Processing completed successfully!';
      case 'failed':
        return currentJob.error_message || 'Processing failed';
      default:
        return currentJob.current_stage || 'Processing...';
    }
  }, [currentJob]);

  return {
    // State
    currentJob,
    status,
    error,
    uploadProgress,
    isProcessing: status !== 'idle' && status !== 'completed' && status !== 'failed',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',

    // Actions
    uploadSyllabusAsync,
    cancelJob,
    reset,
    pollJobStatus,

    // Utilities
    getStatusMessage,
  };
};

export default useAsyncSyllabusProcessing;