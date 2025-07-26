const { chromium } = require('playwright');
const fs = require('fs');

// SOLUTION 1: Use existing browser session
async function runWithExistingAuth() {
  console.log('🚀 Starting SyllabAI Debug Test (Auth Mode)...\n');
  
  console.log('📋 INSTRUCTIONS:');
  console.log('1. First, login to SyllabAI in your regular Chrome browser');
  console.log('2. Go to: https://dajzdabz.github.io/syllaai-frontend-react/');
  console.log('3. Click Student → Login with Google → Complete login');
  console.log('4. Once you see the dashboard with file upload, come back here');
  console.log('5. Press ENTER to continue...\n');
  
  // Wait for user to press enter
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  console.log('✅ Great! Now I\'ll test the logged-in dashboard...\n');
  
  // Launch browser with specific args to avoid detection
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  // Load saved cookies if they exist
  const cookiesFile = 'syllabai-cookies.json';
  if (fs.existsSync(cookiesFile)) {
    console.log('🍪 Loading saved cookies...');
    const cookies = JSON.parse(fs.readFileSync(cookiesFile, 'utf8'));
    await context.addCookies(cookies);
  }
  
  // Monitor console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });
  
  // Monitor API calls
  page.on('request', request => {
    if (request.url().includes('syllaai') || request.url().includes('8001')) {
      console.log('🌐 API Call:', request.method(), request.url());
    }
  });
  
  console.log('📍 Navigating to student dashboard...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Click Student button
  const studentButton = page.locator('button').filter({ hasText: 'Student' });
  if (await studentButton.isVisible()) {
    await studentButton.click();
    await page.waitForTimeout(2000);
  }
  
  // Check if we have file input (means we're logged in)
  const hasFileInput = await page.locator('input[type="file"]').isVisible();
  
  if (!hasFileInput) {
    console.log('\n❌ Not logged in! Please follow these steps:');
    console.log('1. Login to SyllabAI in your regular browser first');
    console.log('2. OR try the alternative solution below\n');
    
    // Save current page for debugging
    await page.screenshot({ path: 'quick-debug-no-auth.png' });
  } else {
    console.log('✅ Logged in! Testing file upload...\n');
    
    // Create test file
    const testFile = 'test-syllabus.txt';
    fs.writeFileSync(testFile, `Course: Test Course 101
Instructor: Dr. Test
Schedule: MWF 10:00 AM
Assignments:
- Homework 1: Due Sept 15
- Midterm: Oct 20
- Final Project: Dec 1`);
    
    // Upload file
    console.log('📄 Uploading test syllabus...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Wait for processing
    console.log('⏳ Waiting for AI processing...');
    
    // Wait for dialog or result
    const dialog = page.locator('[role="dialog"]');
    try {
      await dialog.waitFor({ timeout: 15000 });
      console.log('✅ Processing complete! Dialog appeared.');
      
      // Take screenshot
      await page.screenshot({ path: 'quick-debug-dialog.png' });
      
      // Extract dialog content
      const dialogContent = await dialog.evaluate(el => el.innerText);
      console.log('\n📋 Dialog content preview:');
      console.log(dialogContent.substring(0, 200) + '...');
      
      // Look for Save button
      const saveButton = dialog.locator('button').filter({ hasText: /save/i });
      if (await saveButton.isVisible()) {
        console.log('\n🔘 Found Save button. Clicking...');
        await saveButton.click();
        
        // Wait for save
        await page.waitForTimeout(3000);
        
        // Check if course was saved
        const courseCards = await page.locator('[class*="course"]').count();
        console.log(`\n✅ Courses found: ${courseCards}`);
      }
      
    } catch (e) {
      console.log('⚠️  No dialog appeared. Checking for errors...');
      await page.screenshot({ path: 'quick-debug-error.png' });
    }
    
    // Save cookies for next time
    const cookies = await context.cookies();
    fs.writeFileSync(cookiesFile, JSON.stringify(cookies, null, 2));
    console.log('\n🍪 Cookies saved for next run');
    
    // Cleanup
    fs.unlinkSync(testFile);
  }
  
  console.log('\n📊 Test complete! Check screenshots for results.');
  await browser.close();
}

// SOLUTION 2: Direct API Testing
async function testAPIsDirectly() {
  console.log('\n🔧 Alternative: Direct API Testing');
  console.log('This bypasses browser login issues\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Inject test utilities
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  await page.evaluate(() => {
    console.log('🧪 SyllabAI Debug Mode Activated');
    
    // Monitor all fetch calls
    const originalFetch = window.fetch;
    window.__debugAPICalls = [];
    
    window.fetch = async (...args) => {
      console.log('📡 API Call:', args[0]);
      const response = await originalFetch(...args);
      
      window.__debugAPICalls.push({
        url: args[0],
        method: args[1]?.method || 'GET',
        status: response.status,
        timestamp: new Date().toISOString()
      });
      
      return response;
    };
    
    // Test function you can call from console
    window.testSyllabusUpload = async (fileContent) => {
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const file = new File([blob], 'test.txt', { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('https://syllaai-ai.onrender.com/process', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        console.log('✅ Response:', data);
        return data;
      } catch (e) {
        console.error('❌ Error:', e);
        return null;
      }
    };
    
    console.log('💡 Use window.testSyllabusUpload("syllabus content") to test');
  });
  
  console.log('\n✅ Debug utilities injected!');
  console.log('The browser console now has testing functions available.');
  console.log('Keep this browser open for testing.\n');
  
  // Keep browser open
  await new Promise(() => {});
}

// Let user choose
console.log('🤔 Which approach would you like to try?\n');
console.log('1. Test with existing browser session (recommended)');
console.log('2. Direct API testing (bypasses login)\n');
console.log('Enter 1 or 2: ');

process.stdin.once('data', (data) => {
  const choice = data.toString().trim();
  
  if (choice === '2') {
    testAPIsDirectly().catch(console.error);
  } else {
    runWithExistingAuth().catch(console.error);
  }
});