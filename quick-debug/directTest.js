const { chromium } = require('playwright');
const fs = require('fs');

async function directTest() {
  console.log('🚀 Direct Upload Test (Skip Login Detection)...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000  // Slow it down so you can see what's happening
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor API calls
  page.on('request', request => {
    const url = request.url();
    if (url.includes('syllaai') || url.includes('8001')) {
      console.log('🌐 API:', request.method(), url.split('?')[0]);
    }
  });
  
  // Monitor responses
  page.on('response', response => {
    const url = response.url();
    if (url.includes('process') || url.includes('courses')) {
      console.log('📥 Response:', response.status(), url.split('?')[0]);
    }
  });
  
  console.log('📍 Going to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Click Student
  await page.click('button:has-text("Student")');
  console.log('✅ Clicked Student');
  
  // Give you time to login manually
  console.log('\n🔐 Please login manually if needed...');
  console.log('⏳ Waiting 30 seconds for you to get to dashboard...\n');
  
  // Wait 30 seconds
  for (let i = 30; i > 0; i--) {
    process.stdout.write(`\r⏰ ${i} seconds remaining...`);
    await page.waitForTimeout(1000);
  }
  
  console.log('\n\n🧪 Starting upload test...');
  
  // Take screenshot of current state
  await page.screenshot({ path: 'before-upload.png' });
  console.log('📸 Screenshot: before-upload.png');
  
  // Check what's on page
  const pageContent = await page.evaluate(() => ({
    hasFileInput: !!document.querySelector('input[type="file"]'),
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText),
    text: document.body.innerText.substring(0, 200)
  }));
  
  console.log('\n📊 Current page state:');
  console.log('Has file input:', pageContent.hasFileInput);
  console.log('Buttons:', pageContent.buttons.join(', '));
  
  if (pageContent.hasFileInput) {
    console.log('\n✅ File input found! Testing upload...');
    
    // Create test file
    const testContent = `CSE 476 - Capstone Project
Instructor: Dr. John Smith
Semester: Fall 2024
Credits: 3

Course Description:
This capstone course allows students to apply their knowledge in a real-world project.

Schedule:
Week 1 (Aug 26): Project Selection
Week 2 (Sep 2): Team Formation 
Week 3 (Sep 9): Requirements Gathering
Week 4 (Sep 16): Design Phase
Week 5 (Sep 23): Implementation Begins
Week 6 (Sep 30): Progress Review
Week 7 (Oct 7): Mid-project Presentation
Week 8 (Oct 14): Testing Phase
Week 9 (Oct 21): Documentation
Week 10 (Oct 28): Final Presentation
Week 11 (Nov 4): Project Submission

Assignments:
- Project Proposal: September 9, 2024
- Mid-project Report: October 7, 2024
- Final Presentation: October 28, 2024
- Final Project Submission: November 4, 2024

Grading:
- Project Proposal: 15%
- Mid-project Report: 20%
- Final Presentation: 25%
- Final Project: 40%`;
    
    fs.writeFileSync('capstone-syllabus.txt', testContent);
    
    console.log('📄 Uploading capstone syllabus...');
    
    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('capstone-syllabus.txt');
    
    console.log('⏳ Waiting for AI processing...');
    
    // Wait for dialog OR error
    try {
      const dialog = await page.waitForSelector('[role="dialog"]', { timeout: 30000 });
      console.log('✅ Dialog appeared!');
      
      // Screenshot the dialog
      await page.screenshot({ path: 'ai-processed.png' });
      console.log('📸 Screenshot: ai-processed.png');
      
      // Get the dialog content
      const dialogContent = await dialog.innerText();
      console.log('\n📋 AI Processing Results:');
      console.log('─'.repeat(50));
      console.log(dialogContent);
      console.log('─'.repeat(50));
      
      // Look for Save button
      const saveButton = page.locator('[role="dialog"] button').filter({ hasText: /save/i });
      const saveCount = await saveButton.count();
      
      if (saveCount > 0) {
        console.log('\n💾 Save button found! Clicking...');
        await saveButton.click();
        
        // Wait for save to complete
        await page.waitForTimeout(5000);
        
        // Take final screenshot
        await page.screenshot({ path: 'after-save.png' });
        console.log('📸 Screenshot: after-save.png');
        
        console.log('✅ Upload and save complete!');
      } else {
        console.log('⚠️  No Save button found in dialog');
      }
      
    } catch (e) {
      console.log('❌ No dialog appeared after 30 seconds');
      await page.screenshot({ path: 'no-dialog.png' });
      
      // Check for any error messages
      const errorCheck = await page.evaluate(() => {
        const errors = document.querySelectorAll('[class*="error"], [role="alert"]');
        return Array.from(errors).map(e => e.innerText);
      });
      
      if (errorCheck.length > 0) {
        console.log('🚨 Errors found:', errorCheck);
      }
    }
    
    // Cleanup
    fs.unlinkSync('capstone-syllabus.txt');
    
  } else {
    console.log('❌ No file input found. You might need to login first.');
  }
  
  console.log('\n🎉 Test finished!');
  console.log('Check the screenshots to see what happened');
  
  // Keep open for 10 seconds
  await page.waitForTimeout(10000);
  await browser.close();
}

directTest().catch(console.error);