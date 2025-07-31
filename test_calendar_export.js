// Test script for Google Calendar export functionality
// Run this in browser console on https://dajzdabz.github.io/syllabus-frontend-react/

async function testCalendarExport() {
    console.log("🗓️ Testing Google Calendar Export...");
    
    try {
        // Step 1: Get user's enrolled courses to find a course with events
        console.log("1. Fetching enrolled courses...");
        const coursesResponse = await fetch('https://syllaai-ai.onrender.com/events/student/my-events?limit=10', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!coursesResponse.ok) {
            throw new Error(`Failed to fetch courses: ${coursesResponse.status}`);
        }
        
        const coursesData = await coursesResponse.json();
        console.log("✅ Courses data:", coursesData);
        
        if (coursesData.events.length === 0) {
            console.log("❌ No events found. Need to enroll in a course with events first.");
            return;
        }
        
        // Get the first course with events
        const firstEvent = coursesData.events[0];
        const courseId = firstEvent.course_id;
        console.log(`📚 Using course: ${firstEvent.course_title} (${firstEvent.course_code})`);
        console.log(`🎯 Course ID: ${courseId}`);
        console.log(`📅 Found ${coursesData.total_events} total events`);
        
        // Step 2: Test the calendar export
        console.log("2. Testing calendar export...");
        const exportResponse = await fetch('https://syllaai-ai.onrender.com/events/student/export-course-to-calendar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                course_id: courseId,
                include_past_events: true  // Include all events for testing
            })
        });
        
        console.log(`📡 Export response status: ${exportResponse.status}`);
        
        if (!exportResponse.ok) {
            const errorText = await exportResponse.text();
            console.error("❌ Export failed:", errorText);
            return;
        }
        
        const exportData = await exportResponse.json();
        console.log("✅ Export response:", exportData);
        
        // Check if auth is required
        if (exportData.auth_required) {
            console.log("🔐 Google Calendar authentication required!");
            console.log("🔗 OAuth URL:", exportData.oauth_url);
            console.log("👆 Click the URL above to authenticate with Google Calendar");
            
            // Auto-open the OAuth URL
            if (exportData.oauth_url) {
                window.open(exportData.oauth_url, '_blank');
            }
        } else {
            // Export succeeded
            console.log("🎉 Calendar export completed!");
            console.log(`📊 Results:`);
            console.log(`   - Total events: ${exportData.total_events}`);
            console.log(`   - Exported events: ${exportData.exported_events}`);
            console.log(`   - Failed events: ${exportData.failed_events}`);
            console.log(`   - Courses processed: ${exportData.courses_processed}`);
            
            if (exportData.export_details && exportData.export_details.length > 0) {
                console.log("📋 Export details:");
                exportData.export_details.forEach((detail, index) => {
                    console.log(`   ${index + 1}. ${detail.event_title}: ${detail.status}`);
                    if (detail.error) {
                        console.log(`      Error: ${detail.error}`);
                    }
                });
            }
            
            console.log("✅ Check your Google Calendar for the exported events!");
        }
        
    } catch (error) {
        console.error("❌ Test failed:", error);
        console.error("Stack trace:", error.stack);
    }
}

// Run the test
testCalendarExport();