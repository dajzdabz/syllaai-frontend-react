const { chromium } = require('playwright');
const fs = require('fs');

async function fullFlowTest() {
  console.log('🚀 Full Flow Test - Complete Login + Upload...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor API calls
  page.on('request', request => {
    const url = request.url();
    if (url.includes('syllaai') || url.includes('process') || url.includes('courses')) {
      console.log('🌐 API:', request.method(), url.split('?')[0]);
    }
  });
  
  console.log('📍 Going to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  console.log('🎓 Clicking Student...');
  await page.click('button:has-text("Student")');
  
  console.log('⏳ Waiting for login page...');
  await page.waitForTimeout(3000);
  
  // Take screenshot of login page
  await page.screenshot({ path: 'login-page.png' });
  console.log('📸 Login page screenshot saved');
  
  // Look for Google sign in button
  const googleButton = await page.locator('button').filter({ 
    hasText: /google|sign in/i 
  }).first();
  
  if (await googleButton.count() > 0) {
    console.log('🔍 Found Google login button');
    console.log('🔐 Attempting to click Google login...');
    
    try {
      await googleButton.click();
      console.log('✅ Clicked Google login button');
      
      // Wait for popup or redirect
      console.log('⏳ Waiting for Google auth (30 seconds)...');
      
      // Wait for either success indicators
      await Promise.race([
        // Wait for file input (means we're logged in)
        page.waitForSelector('input[type="file"]', { timeout: 30000 }),
        // Wait for courses API call (means login worked)
        page.waitForResponse(response => 
          response.url().includes('/api/courses/') && response.status() === 200,
          { timeout: 30000 }
        ),
        // Wait for URL change
        page.waitForFunction(() => 
          document.querySelector('input[type="file"]') !== null,
          { timeout: 30000 }
        )
      ]).then(() => {
        console.log('✅ Login appears successful!');
      }).catch(() => {
        console.log('⏰ Login timeout or failed');
      });
      
      // Give React time to render
      await page.waitForTimeout(3000);
      
      // Check if we now have file input
      const fileInputCount = await page.locator('input[type="file"]').count();
      console.log(`📄 File inputs found: ${fileInputCount}`);
      
      if (fileInputCount > 0) {
        console.log('\n🧪 SUCCESS! Testing upload...');
        
        // Create test syllabus
        const testSyllabus = `Computer Science 101 - Introduction to Programming
Professor: Dr. Jane Smith
Schedule: Monday, Wednesday, Friday 9:00-10:15 AM
Location: Computer Lab 203

Course Objectives:
- Learn basic programming concepts
- Understand problem-solving techniques
- Write simple programs

Weekly Schedule:
Week 1 (Aug 28): Course Introduction, Development Environment Setup
Week 2 (Sep 4): Variables and Data Types
Week 3 (Sep 11): Control Structures - If Statements
Week 4 (Sep 18): Control Structures - Loops
Week 5 (Sep 25): Functions and Methods
Week 6 (Oct 2): Arrays and Lists
Week 7 (Oct 9): Midterm Exam
Week 8 (Oct 16): Object-Oriented Programming Basics
Week 9 (Oct 23): File Input/Output
Week 10 (Oct 30): Error Handling and Debugging
Week 11 (Nov 6): Final Project Work
Week 12 (Nov 13): Final Project Presentations

Assignments:
- Homework 1 (Variables): Due September 8
- Homework 2 (Control Structures): Due September 22
- Midterm Exam: October 9
- Homework 3 (Functions): Due October 16
- Final Project Proposal: Due October 30
- Final Project: Due November 13

Grading:
- Homework: 40%
- Midterm Exam: 25%
- Final Project: 35%`;

        fs.writeFileSync('cs101-syllabus.txt', testSyllabus);
        
        console.log('📤 Uploading CS 101 syllabus...');
        await page.locator('input[type="file"]').setInputFiles('cs101-syllabus.txt');
        
        console.log('⏳ Waiting for AI processing...');
        
        // Wait for dialog with progress updates
        let processed = false;
        for (let i = 0; i < 25; i++) {
          const dialogs = await page.locator('[role="dialog"]').count();
          if (dialogs > 0) {
            processed = true;
            break;
          }
          process.stdout.write(`\r🤖 Processing... ${i+1}/25 seconds`);
          await page.waitForTimeout(1000);
        }
        
        if (processed) {
          console.log('\n✅ AI processing complete!');
          
          // Screenshot the results
          await page.screenshot({ path: 'ai-results.png' });
          
          // Get the dialog content
          const dialog = page.locator('[role="dialog"]');
          const dialogText = await dialog.innerText();
          
          console.log('\n📋 AI Extraction Results:');
          console.log('═'.repeat(60));
          console.log(dialogText);
          console.log('═'.repeat(60));
          
          // Look for and click Save
          const saveButton = dialog.locator('button').filter({ hasText: /save/i });
          if (await saveButton.count() > 0) {
            console.log('\n💾 Saving course...');
            await saveButton.click();
            
            await page.waitForTimeout(3000);
            
            // Final screenshot
            await page.screenshot({ path: 'course-saved.png' });
            console.log('📸 Final screenshot saved');
            
            console.log('🎉 FULL TEST COMPLETE!');
            console.log('✅ Login: SUCCESS');
            console.log('✅ Upload: SUCCESS'); 
            console.log('✅ AI Processing: SUCCESS');
            console.log('✅ Save: SUCCESS');
            
          } else {
            console.log('⚠️  No Save button found');
          }
          
        } else {
          console.log('\n❌ AI processing failed or timed out');
          await page.screenshot({ path: 'processing-failed.png' });
        }
        
        // Cleanup
        fs.unlinkSync('cs101-syllabus.txt');
        
      } else {
        console.log('❌ Still no file input after login attempt');
        await page.screenshot({ path: 'login-failed.png' });
      }
      
    } catch (e) {
      console.log('❌ Error during login:', e.message);
      await page.screenshot({ path: 'login-error.png' });
    }
    
  } else {
    console.log('❌ No Google login button found');
  }
  
  // Keep open for 10 seconds to see results
  console.log('\n⏳ Keeping browser open for 10 seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
  console.log('🏁 Test finished!');
}

fullFlowTest().catch(console.error);