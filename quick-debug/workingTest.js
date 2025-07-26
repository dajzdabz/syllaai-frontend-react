const { chromium } = require('playwright');
const fs = require('fs');

async function runTest() {
  console.log('🚀 Starting SyllabAI Test...\n');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor console for login success
  let loggedIn = false;
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Authentication successful') || 
        text.includes('Auth data stored') ||
        text.includes('Token found and set')) {
      loggedIn = true;
      console.log('✅ Login detected via console!');
    }
  });
  
  // Monitor API calls
  page.on('request', request => {
    const url = request.url();
    if (url.includes('syllaai')) {
      console.log('🌐 API:', request.method(), url.split('?')[0]);
    }
  });
  
  console.log('📍 Going to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Click Student
  await page.click('button:has-text("Student")');
  console.log('✅ Clicked Student');
  
  // Wait a bit for React to render
  await page.waitForTimeout(3000);
  
  // Check current state
  const hasFileInput = await page.locator('input[type="file"]').count() > 0;
  
  if (!hasFileInput) {
    console.log('\n🔐 Please login with Google...');
    
    // Wait for either file input OR console message indicating login
    await Promise.race([
      page.waitForSelector('input[type="file"]', { timeout: 120000 }),
      page.waitForFunction(() => window.location.href.includes('student'), { timeout: 120000 }),
      new Promise(resolve => {
        const checkLogin = setInterval(() => {
          if (loggedIn) {
            clearInterval(checkLogin);
            resolve();
          }
        }, 1000);
      })
    ]);
    
    console.log('✅ Login successful!');
    
    // Give React time to render after login
    await page.waitForTimeout(3000);
  }
  
  // NOW test the upload - refresh check for file input
  const canUpload = await page.locator('input[type="file"]').count() > 0;
  
  if (canUpload) {
    console.log('\n🧪 Testing file upload...');
    
    // Create test file
    fs.writeFileSync('test-syllabus.txt', `Course: Introduction to Psychology
Instructor: Dr. Sarah Johnson
Time: MWF 2:00-3:15 PM
Room: Science Building 201

Course Description:
This course provides an overview of psychological principles.

Schedule:
Week 1: Introduction to Psychology
Week 2: Research Methods
Week 3: Biological Bases of Behavior
Week 4: Sensation and Perception

Assignments:
- Quiz 1: September 15
- Midterm Exam: October 20
- Final Project: December 5`);
    
    console.log('📄 Uploading test syllabus...');
    await page.locator('input[type="file"]').setInputFiles('test-syllabus.txt');
    
    // Wait for processing
    console.log('⏳ Waiting for AI to process...');
    
    // Wait for dialog with better timeout
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
      console.log('✅ Processing complete! Dialog appeared');
      
      // Take screenshot
      await page.screenshot({ path: 'syllabus-processed.png' });
      console.log('📸 Screenshot saved: syllabus-processed.png');
      
      // Extract what the AI found
      const dialogText = await page.locator('[role="dialog"]').innerText();
      console.log('\n📋 AI extracted:');
      console.log(dialogText.substring(0, 300) + '...\n');
      
      // Try to save
      const saveButton = page.locator('button').filter({ hasText: /save/i });
      if (await saveButton.count() > 0) {
        console.log('💾 Clicking Save...');
        await saveButton.click();
        
        await page.waitForTimeout(3000);
        console.log('✅ Course saved!');
        
        // Take final screenshot
        await page.screenshot({ path: 'course-saved.png' });
      }
      
    } catch (e) {
      console.log('❌ No dialog appeared. Taking error screenshot...');
      await page.screenshot({ path: 'upload-error.png' });
    }
    
    // Cleanup
    fs.unlinkSync('test-syllabus.txt');
    
  } else {
    console.log('❌ File input not found even after login');
    await page.screenshot({ path: 'no-file-input.png' });
  }
  
  console.log('\n✅ Test complete!');
  console.log('Check the screenshots to see results');
  
  // Keep open for 5 seconds
  await page.waitForTimeout(5000);
  await browser.close();
}

runTest().catch(console.error);