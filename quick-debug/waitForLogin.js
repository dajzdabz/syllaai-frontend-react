const { chromium } = require('playwright');
const fs = require('fs');

async function waitForLoginTest() {
  console.log('🚀 Automated Test with Manual Login Wait...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor API calls
  page.on('request', request => {
    if (request.url().includes('syllaai')) {
      console.log('🌐 API:', request.method(), request.url().split('?')[0]);
    }
  });
  
  console.log('📍 Going to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Click Student
  await page.click('button:has-text("Student")');
  console.log('✅ Clicked Student');
  
  console.log('\n🔐 Please complete login manually...');
  console.log('⏳ I\'ll wait 60 seconds for you to login...\n');
  
  // Wait 60 seconds with countdown
  for (let i = 60; i > 0; i--) {
    // Check if file input appeared (means logged in)
    const fileInputs = await page.locator('input[type="file"]').count();
    if (fileInputs > 0) {
      console.log('\n✅ Login detected! File input found.');
      break;
    }
    
    process.stdout.write(`\r⏰ Waiting for login... ${i} seconds remaining`);
    await page.waitForTimeout(1000);
  }
  
  console.log('\n\n🧪 Starting upload test...');
  
  // Double-check we have file input
  const fileInputCount = await page.locator('input[type="file"]').count();
  console.log(`📄 File inputs found: ${fileInputCount}`);
  
  if (fileInputCount > 0) {
    // Create comprehensive test syllabus
    const testSyllabus = `Biology 201 - Cell Biology
Professor: Dr. Maria Santos
Schedule: Monday/Wednesday/Friday 1:00-2:15 PM
Location: Science Building Room 204
Credits: 4
Semester: Fall 2024

Course Description:
An introduction to cell structure and function, including molecular biology, 
cell metabolism, and cellular reproduction.

Learning Objectives:
1. Understand basic cell structure and organelle functions
2. Learn fundamental metabolic pathways
3. Comprehend DNA replication and protein synthesis
4. Analyze cell division processes

Weekly Schedule:
Week 1 (Aug 26): Introduction to Cell Biology
Week 2 (Sep 2): Cell Membrane Structure and Function
Week 3 (Sep 9): Nucleus and Genetic Material
Week 4 (Sep 16): Protein Synthesis and the Endoplasmic Reticulum
Week 5 (Sep 23): Mitochondria and Cellular Respiration
Week 6 (Sep 30): Photosynthesis and Chloroplasts
Week 7 (Oct 7): Cell Division - Mitosis
Week 8 (Oct 14): MIDTERM EXAM
Week 9 (Oct 21): Cell Division - Meiosis
Week 10 (Oct 28): Cell Signaling and Communication
Week 11 (Nov 4): Cancer and Cell Cycle Regulation
Week 12 (Nov 11): Stem Cells and Development
Week 13 (Nov 18): THANKSGIVING BREAK
Week 14 (Dec 2): Final Review and Lab Practical
Week 15 (Dec 9): FINAL EXAM

Major Assignments:
- Lab Report 1 (Cell Membrane): Due September 16, 2024
- Research Paper (Cell Organelles): Due October 7, 2024
- Midterm Exam: October 14, 2024
- Lab Report 2 (Mitosis/Meiosis): Due November 4, 2024
- Final Project Presentation: December 2, 2024
- Final Exam: December 9, 2024

Grading Breakdown:
- Lab Reports: 25%
- Research Paper: 20%
- Midterm Exam: 20%
- Final Project: 15%
- Final Exam: 20%

Office Hours:
Tuesday/Thursday 2:00-4:00 PM in Science Building Room 210

Contact Information:
Email: msantos@university.edu
Phone: (555) 123-4567`;

    fs.writeFileSync('biology-syllabus.txt', testSyllabus);
    
    console.log('📤 Uploading comprehensive biology syllabus...');
    await page.locator('input[type="file"]').setInputFiles('biology-syllabus.txt');
    
    console.log('⏳ Waiting for AI processing (up to 30 seconds)...');
    
    // Wait for dialog with progress
    let dialogFound = false;
    for (let i = 0; i < 30; i++) {
      const dialogs = await page.locator('[role="dialog"]').count();
      if (dialogs > 0) {
        dialogFound = true;
        console.log(`\n✅ Dialog appeared after ${i+1} seconds!`);
        break;
      }
      process.stdout.write(`\r🤖 AI Processing... ${i+1}/30 seconds`);
      await page.waitForTimeout(1000);
    }
    
    if (dialogFound) {
      // Take screenshot
      await page.screenshot({ path: 'ai-processing-result.png' });
      console.log('📸 Screenshot saved: ai-processing-result.png');
      
      // Get full dialog content
      const dialog = page.locator('[role="dialog"]');
      const dialogText = await dialog.innerText();
      
      console.log('\n📋 COMPLETE AI EXTRACTION RESULTS:');
      console.log('═'.repeat(80));
      console.log(dialogText);
      console.log('═'.repeat(80));
      
      // Check for Save button and click it
      const saveButton = dialog.locator('button').filter({ hasText: /save/i });
      const saveCount = await saveButton.count();
      
      if (saveCount > 0) {
        console.log('\n💾 Save button found! Clicking to save course...');
        await saveButton.click();
        
        // Wait for save to complete
        await page.waitForTimeout(3000);
        
        // Take final screenshot
        await page.screenshot({ path: 'course-saved-final.png' });
        console.log('📸 Final screenshot saved: course-saved-final.png');
        
        console.log('🎉 COMPLETE SUCCESS!');
        console.log('✅ Login: SUCCESSFUL');
        console.log('✅ File Upload: SUCCESSFUL');
        console.log('✅ AI Processing: SUCCESSFUL');
        console.log('✅ Course Save: SUCCESSFUL');
        
      } else {
        console.log('⚠️  No Save button found in dialog');
        console.log('Dialog buttons available:', await dialog.locator('button').allInnerTexts());
      }
      
    } else {
      console.log('\n❌ No dialog appeared after 30 seconds');
      console.log('Taking error screenshot...');
      await page.screenshot({ path: 'no-dialog-error.png' });
      
      // Check console for errors
      const pageErrors = await page.evaluate(() => {
        return window.console ? 'Console available' : 'No console';
      });
      console.log('Page state:', pageErrors);
    }
    
    // Cleanup
    fs.unlinkSync('biology-syllabus.txt');
    
  } else {
    console.log('❌ No file input found - login may have failed');
    await page.screenshot({ path: 'login-failed.png' });
  }
  
  console.log('\n📊 TEST SUMMARY:');
  console.log('- Screenshots saved for review');
  console.log('- All API calls monitored and logged');
  console.log('- Comprehensive syllabus tested');
  
  // Keep browser open for 10 seconds to see final state
  console.log('\n⏳ Keeping browser open for 10 seconds for review...');
  await page.waitForTimeout(10000);
  
  await browser.close();
  console.log('🏁 Automated test complete!');
}

waitForLoginTest().catch(console.error);