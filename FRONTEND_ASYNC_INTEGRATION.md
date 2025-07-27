# Frontend Integration Guide for Async Processing

## 🎯 What We've Built

### **New Frontend Components:**
1. **`AsyncSyllabusProcessor`** - Modern component for async file processing
2. **`useAsyncSyllabusProcessing`** - React hook for job management and polling
3. **`AsyncProcessingTestPage`** - Test page for the new functionality
4. **Navigation Integration** - Easy access from Professor Dashboard

### **Key Features:**
- ✅ **Real-time progress tracking** with visual stepper
- ✅ **Background processing** - users can navigate away
- ✅ **Job cancellation** and retry functionality
- ✅ **Graceful error handling** with specific error messages
- ✅ **Dual API support** - both sync (fallback) and async endpoints

## 🚀 How to Access the New Features

### **For Users:**
1. **Log in** as a Professor
2. **Click "Async Processing"** button in the top navigation (has "New!" badge)
3. **Upload a syllabus file** and see real-time progress
4. **Navigate away** and return - processing continues in background

### **For Developers:**
1. **New API endpoints** available in `apiService`:
   ```typescript
   await apiService.uploadSyllabusAsync(file, onProgress);
   await apiService.getProcessingStatus(jobId);
   await apiService.listProcessingJobs();
   await apiService.cancelProcessingJob(jobId);
   ```

2. **React Hook** for easy integration:
   ```typescript
   const {
     uploadSyllabusAsync,
     currentJob,
     status,
     isProcessing,
     getStatusMessage
   } = useAsyncSyllabusProcessing();
   ```

## 🔧 Configuration

### **Environment Variables:**
- `VITE_API_URL` - Original sync API (default: syllaai-ai.onrender.com)
- `VITE_ASYNC_API_URL` - New async API (default: syllaai-web.onrender.com)

### **API Endpoints:**
- **Async Upload**: `POST /api/syllabus-processing/upload`
- **Job Status**: `GET /api/syllabus-processing/status/{job_id}`
- **List Jobs**: `GET /api/syllabus-processing/jobs`
- **Cancel Job**: `DELETE /api/syllabus-processing/jobs/{job_id}`

## 📊 Processing Stages

The new system provides detailed progress through these stages:

1. **Upload File** - Instant file upload (< 2 seconds)
2. **Security Validation** - Multi-layer file security checks
3. **Text Extraction** - OCR and text parsing with resource limits
4. **AI Processing** - Smart extraction with prompt injection prevention
5. **Duplicate Check** - Prevents duplicate course creation
6. **Create Course** - Final course and event creation
7. **Complete** - Success with results summary

## 🔄 Deployment Strategy

### **Current Setup:**
- **Sync Processing** - Still available as fallback
- **Async Processing** - New feature, opt-in via navigation
- **Graceful Degradation** - Falls back to sync if async fails

### **Migration Path:**
1. **Phase 1**: Users can test async processing via special page
2. **Phase 2**: Replace main upload component with async version
3. **Phase 3**: Deprecate old sync processing (optional)

## 🛠️ Development Notes

### **Architecture Benefits:**
- **Separation of Concerns** - Async component is focused (300 lines vs 970)
- **Real-time Updates** - WebSocket-like experience via polling
- **Error Recovery** - Comprehensive error handling and retry logic
- **User Experience** - Clear progress indication and status messages

### **Security Features:**
- **Authentication Required** - All endpoints require valid JWT tokens
- **File Validation** - Multi-layer security before processing
- **Rate Limiting** - Prevents abuse of processing resources
- **Prompt Injection Prevention** - Secure AI processing

## 🎉 Success Metrics

When working correctly, users will see:
- ✅ **Instant upload** response (< 2 seconds)
- ✅ **Real-time progress** updates every 2 seconds
- ✅ **Detailed status** messages for each processing stage
- ✅ **Success notification** with course creation details
- ✅ **Error messages** that are specific and actionable

## 🚨 Troubleshooting

### **Common Issues:**
1. **"Not authenticated"** - Check if user is logged in
2. **"Service unavailable"** - Celery workers may be down
3. **"Processing failed"** - Check backend logs for specific errors

### **Fallback Options:**
- Original sync processing still available in main dashboard
- Can manually check job status via `/async-processing` page
- Support cancellation and retry for failed jobs

## 📝 Next Steps

1. **Test the integration** with real syllabus files
2. **Monitor performance** and error rates
3. **Gather user feedback** on the new experience
4. **Consider replacing** main upload component if successful