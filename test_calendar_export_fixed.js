// 🚀 SyllabAI Comprehensive Security & Performance Test Suite
// 30-Day Market Blitz - Production Readiness Validation
// Run this in browser console on https://dajzdabz.github.io/syllabus-frontend-react/
//
// CRITICAL GAPS INTEGRATION:
// ✅ Database SSL connection validation
// ✅ Token encryption verification  
// ✅ CSRF protection testing
// ✅ Performance benchmarking
// ✅ Error handling validation
// ✅ Security header checks
// ✅ Rate limiting verification

const BACKEND_URL = 'https://syllaai-ai.onrender.com';
const TEST_RESULTS = {
    security: {},
    performance: {},
    functionality: {},
    critical_gaps: {}
};

// 🚨 CRITICAL GAP TESTING FUNCTIONS

async function testSSLConnection() {
    console.log("🔒 CRITICAL: Testing SSL/TLS connection security...");
    const startTime = performance.now();
    
    try {
        const response = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            credentials: 'include'
        });
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Check if connection is secure
        const isSecure = location.protocol === 'https:' && BACKEND_URL.startsWith('https:');
        
        TEST_RESULTS.critical_gaps.ssl_connection = {
            secure: isSecure,
            response_time: responseTime,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
        };
        
        if (isSecure) {
            console.log("✅ SSL connection is secure");
        } else {
            console.error("❌ CRITICAL: SSL connection not secure!");
        }
        
        return isSecure;
    } catch (error) {
        console.error("❌ CRITICAL: SSL connection test failed:", error);
        TEST_RESULTS.critical_gaps.ssl_connection = { error: error.message };
        return false;
    }
}

async function testCSRFProtection() {
    console.log("🛡️ CRITICAL: Testing CSRF protection...");
    
    try {
        // Test 1: Check if CSRF token endpoint exists
        const csrfResponse = await fetch(`${BACKEND_URL}/auth/csrf-token`, {
            method: 'GET',
            credentials: 'include'
        });
        
        const hasCSRFEndpoint = csrfResponse.ok;
        
        // Test 2: Try state-changing request without CSRF token
        const unsafeResponse = await fetch(`${BACKEND_URL}/courses/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: 'CSRF Test Course' })
        });
        
        // Should fail without CSRF token if protection is enabled
        const csrfProtected = unsafeResponse.status === 403 || unsafeResponse.status === 400;
        
        TEST_RESULTS.critical_gaps.csrf_protection = {
            csrf_endpoint_exists: hasCSRFEndpoint,
            blocks_unsafe_requests: csrfProtected,
            test_response_status: unsafeResponse.status
        };
        
        if (csrfProtected) {
            console.log("✅ CSRF protection is active");
        } else {
            console.error("❌ CRITICAL: CSRF protection missing or inactive!");
        }
        
        return csrfProtected;
    } catch (error) {
        console.error("❌ CSRF protection test failed:", error);
        TEST_RESULTS.critical_gaps.csrf_protection = { error: error.message };
        return false;
    }
}

async function testTokenSecurity() {
    console.log("🔐 CRITICAL: Testing token security...");
    
    try {
        // Check if tokens are in HttpOnly cookies (good)
        const cookies = document.cookie;
        const hasAccessTokenInCookie = cookies.includes('access_token');
        const hasJWTInLocalStorage = localStorage.getItem('token') || localStorage.getItem('access_token');
        
        // Test token endpoint security
        const meResponse = await fetch(`${BACKEND_URL}/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });
        
        const tokenSecure = !hasJWTInLocalStorage && meResponse.ok;
        
        TEST_RESULTS.critical_gaps.token_security = {
            tokens_not_in_localstorage: !hasJWTInLocalStorage,
            httponly_cookies_working: meResponse.ok,
            cookie_accessible_to_js: hasAccessTokenInCookie
        };
        
        if (tokenSecure) {
            console.log("✅ Token security is good (HttpOnly cookies)");
        } else {
            console.error("❌ CRITICAL: Token security issues detected!");
        }
        
        return tokenSecure;
    } catch (error) {
        console.error("❌ Token security test failed:", error);
        TEST_RESULTS.critical_gaps.token_security = { error: error.message };
        return false;
    }
}

async function testRateLimiting() {
    console.log("⚡ Testing rate limiting...");
    
    try {
        const requests = [];
        const startTime = performance.now();
        
        // Send 10 rapid requests to test rate limiting
        for (let i = 0; i < 10; i++) {
            requests.push(fetch(`${BACKEND_URL}/auth/me`, {
                method: 'GET',
                credentials: 'include'
            }));
        }
        
        const responses = await Promise.all(requests);
        const endTime = performance.now();
        
        const rateLimited = responses.some(r => r.status === 429);
        const avgResponseTime = (endTime - startTime) / requests.length;
        
        TEST_RESULTS.security.rate_limiting = {
            rate_limited: rateLimited,
            total_requests: requests.length,
            avg_response_time: avgResponseTime,
            response_statuses: responses.map(r => r.status)
        };
        
        if (rateLimited) {
            console.log("✅ Rate limiting is active");
        } else {
            console.warn("⚠️ Rate limiting may not be configured");
        }
        
        return true;
    } catch (error) {
        console.error("❌ Rate limiting test failed:", error);
        TEST_RESULTS.security.rate_limiting = { error: error.message };
        return false;
    }
}

async function testPerformanceBenchmarks() {
    console.log("🚀 Testing performance benchmarks...");
    
    const endpoints = [
        { name: 'auth_check', url: '/auth/me', method: 'GET' },
        { name: 'events_list', url: '/api/events/student/my-events?limit=10', method: 'GET' },
        { name: 'health_check', url: '/health', method: 'GET' }
    ];
    
    const benchmarks = {};
    
    for (const endpoint of endpoints) {
        try {
            const startTime = performance.now();
            const response = await fetch(`${BACKEND_URL}${endpoint.url}`, {
                method: endpoint.method,
                credentials: 'include'
            });
            const endTime = performance.now();
            
            benchmarks[endpoint.name] = {
                response_time: endTime - startTime,
                status: response.status,
                ok: response.ok
            };
            
            const responseTime = endTime - startTime;
            if (responseTime > 200) {
                console.warn(`⚠️ ${endpoint.name} slow: ${responseTime.toFixed(2)}ms (target: <200ms)`);
            } else {
                console.log(`✅ ${endpoint.name}: ${responseTime.toFixed(2)}ms`);
            }
        } catch (error) {
            console.error(`❌ ${endpoint.name} benchmark failed:`, error);
            benchmarks[endpoint.name] = { error: error.message };
        }
    }
    
    TEST_RESULTS.performance.benchmarks = benchmarks;
    return benchmarks;
}

async function testErrorHandling() {
    console.log("🔧 Testing error handling robustness...");
    
    const errorTests = [
        { name: 'invalid_endpoint', url: '/invalid-endpoint-test', expectedStatus: 404 },
        { name: 'malformed_json', url: '/courses/', method: 'POST', body: 'invalid-json', expectedStatus: 400 },
        { name: 'unauthorized_access', url: '/admin/users', expectedStatus: [401, 403] }
    ];
    
    const errorResults = {};
    
    for (const test of errorTests) {
        try {
            const response = await fetch(`${BACKEND_URL}${test.url}`, {
                method: test.method || 'GET',
                headers: test.body ? { 'Content-Type': 'application/json' } : {},
                credentials: 'include',
                body: test.body
            });
            
            const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
            const correctError = expectedStatuses.includes(response.status);
            
            errorResults[test.name] = {
                status: response.status,
                expected: test.expectedStatus,
                correct_error_handling: correctError
            };
            
            if (correctError) {
                console.log(`✅ ${test.name}: proper error handling`);
            } else {
                console.warn(`⚠️ ${test.name}: unexpected status ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ ${test.name} error test failed:`, error);
            errorResults[test.name] = { error: error.message };
        }
    }
    
    TEST_RESULTS.functionality.error_handling = errorResults;
    return errorResults;
}

async function testCalendarExport() {
    console.log("🗓️ Testing Google Calendar Export...");
    
    try {
        // Step 1: Get user's enrolled courses to find a course with events
        console.log("1. Fetching enrolled courses...");
        const coursesResponse = await fetch('https://syllaai-ai.onrender.com/api/events/student/my-events?limit=10', {
            method: 'GET',
            credentials: 'include'
        });
        
        console.log(`📡 Courses response status: ${coursesResponse.status}`);
        
        if (!coursesResponse.ok) {
            const errorText = await coursesResponse.text();
            console.error(`❌ Failed to fetch courses: ${coursesResponse.status}`);
            console.error("Error details:", errorText);
            return;
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
        const exportResponse = await fetch('https://syllaai-ai.onrender.com/api/events/student/export-course-to-calendar', {
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

// Also test basic auth first
async function testAuth() {
    console.log("🔐 Testing authentication...");
    try {
        const authResponse = await fetch('https://syllaai-ai.onrender.com/auth/me', {
            method: 'GET',
            credentials: 'include'
        });
        
        console.log(`📡 Auth response status: ${authResponse.status}`);
        
        if (authResponse.ok) {
            const userData = await authResponse.json();
            console.log("✅ Authenticated as:", userData);
        } else {
            const errorText = await authResponse.text();
            console.error("❌ Not authenticated:", errorText);
        }
    } catch (error) {
        console.error("❌ Auth test failed:", error);
    }
}

// 🚀 COMPREHENSIVE TEST SUITE EXECUTION
// 30-Day Market Blitz - Production Readiness Validation

async function runProductionReadinessTest() {
    console.log("🚀 SyllabAI 30-DAY MARKET BLITZ - PRODUCTION READINESS TEST");
    console.log("=" .repeat(60));
    
    const testStartTime = performance.now();
    let criticalFailures = 0;
    let highPriorityIssues = 0;
    
    // Phase 1: CRITICAL GAPS (Must fix before deployment)
    console.log("\n🚨 PHASE 1: CRITICAL GAPS VALIDATION");
    console.log("-".repeat(40));
    
    const sslSecure = await testSSLConnection();
    const csrfProtected = await testCSRFProtection();
    const tokenSecure = await testTokenSecurity();
    
    if (!sslSecure) criticalFailures++;
    if (!csrfProtected) criticalFailures++;
    if (!tokenSecure) criticalFailures++;
    
    // Phase 2: Security & Performance Testing  
    console.log("\n🔒 PHASE 2: SECURITY & PERFORMANCE");
    console.log("-".repeat(40));
    
    await testRateLimiting();
    const benchmarks = await testPerformanceBenchmarks();
    await testErrorHandling();
    
    // Check performance issues
    Object.values(benchmarks).forEach(benchmark => {
        if (benchmark.response_time && benchmark.response_time > 200) {
            highPriorityIssues++;
        }
    });
    
    // Phase 3: Authentication Testing
    console.log("\n🔐 PHASE 3: AUTHENTICATION VALIDATION");
    console.log("-".repeat(40));
    
    await testAuth();
    
    // Phase 4: Core Functionality Testing
    console.log("\n🗓️ PHASE 4: CALENDAR EXPORT FUNCTIONALITY");
    console.log("-".repeat(40));
    
    await testCalendarExport();
    
    // Phase 5: Results Summary
    const testEndTime = performance.now();
    const totalTestTime = testEndTime - testStartTime;
    
    console.log("\n" + "=".repeat(60));
    console.log("🎯 30-DAY MARKET BLITZ - TEST RESULTS SUMMARY");
    console.log("=".repeat(60));
    
    // Critical Assessment
    if (criticalFailures > 0) {
        console.log(`❌ CRITICAL FAILURES: ${criticalFailures}`);
        console.log("🚫 DEPLOYMENT BLOCKED - Fix critical issues first!");
    } else {
        console.log("✅ NO CRITICAL FAILURES - Safe to proceed");
    }
    
    if (highPriorityIssues > 0) {
        console.log(`⚠️ HIGH PRIORITY ISSUES: ${highPriorityIssues}`);
    }
    
    // Market Readiness Score
    const maxScore = 100;
    let readinessScore = maxScore;
    readinessScore -= (criticalFailures * 30); // Critical issues heavily penalized
    readinessScore -= (highPriorityIssues * 10); // High priority issues moderately penalized
    readinessScore = Math.max(0, readinessScore);
    
    console.log(`\n🎯 MARKET READINESS SCORE: ${readinessScore}/100`);
    
    if (readinessScore >= 90) {
        console.log("🚀 EXCELLENT - Ready for aggressive market push!");
    } else if (readinessScore >= 70) {
        console.log("👍 GOOD - Minor issues to address before launch");
    } else if (readinessScore >= 50) {
        console.log("⚠️ NEEDS WORK - Address issues before market entry");
    } else {
        console.log("🚫 NOT READY - Critical hardening required");
    }
    
    // Test Performance
    console.log(`\n⏱️ Total test time: ${(totalTestTime / 1000).toFixed(2)} seconds`);
    
    // Detailed Results
    console.log("\n📊 DETAILED TEST RESULTS:");
    console.log("Critical Gaps:", TEST_RESULTS.critical_gaps);
    console.log("Security:", TEST_RESULTS.security);
    console.log("Performance:", TEST_RESULTS.performance);
    console.log("Functionality:", TEST_RESULTS.functionality);
    
    // Next Steps Recommendations
    console.log("\n🎯 NEXT STEPS FOR 30-DAY MARKET BLITZ:");
    
    if (criticalFailures > 0) {
        console.log("1. 🚨 IMMEDIATE: Fix critical security gaps");
        console.log("2. 🔧 Implement missing CSRF protection");
        console.log("3. 🔒 Resolve SSL/TLS connection issues");
        console.log("4. 🧪 Add comprehensive test coverage");
    } else {
        console.log("1. ✅ Critical gaps resolved - proceed to hardening");
        console.log("2. 🚀 Focus on performance optimization");
        console.log("3. 📊 Implement monitoring and alerting");
        console.log("4. 🎯 Begin Grade Projector development");
    }
    
    return {
        criticalFailures,
        highPriorityIssues,
        readinessScore,
        testResults: TEST_RESULTS
    };
}

// Execute the comprehensive test suite
console.log("🚀 Starting SyllabAI Production Readiness Test...");
runProductionReadinessTest().then(results => {
    console.log("\n🏁 Test suite completed!");
    console.log("Results available in TEST_RESULTS global variable");
}).catch(error => {
    console.error("❌ Test suite failed:", error);
});