const { chromium } = require('playwright');
const fs = require('fs');

async function instantTest() {
  console.log('🚀 Instant Test - Testing Current Page...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor API calls
  page.on('request', request => {
    const url = request.url();
    if (url.includes('syllaai') || url.includes('process') || url.includes('courses')) {
      console.log('🌐 API:', request.method(), url.split('?')[0]);
    }
  });
  
  console.log('📍 Going to SyllabAI dashboard...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Click Student
  try {
    await page.click('button:has-text("Student")', { timeout: 3000 });
    console.log('✅ Clicked Student');
  } catch {
    console.log('🤔 No Student button found');
  }
  
  // Wait just 3 seconds
  await page.waitForTimeout(3000);
  
  console.log('\n🧪 Testing upload immediately...');
  
  // Check for file input
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log(`Found ${fileInputs} file input(s)`);
  
  if (fileInputs > 0) {
    // Create test file
    const testContent = `Psychology 101 - Introduction to Psychology
Dr. Emily Rodriguez
MWF 10:00-11:15 AM

Week 1: Introduction
Week 2: Research Methods  
Week 3: Biological Psychology
Week 4: Sensation & Perception

Assignments:
- Quiz 1: September 15
- Midterm: October 10  
- Final Paper: November 20`;
    
    fs.writeFileSync('psych-syllabus.txt', testContent);
    
    console.log('📄 Uploading file NOW...');
    
    // Upload immediately
    await page.locator('input[type="file"]').setInputFiles('psych-syllabus.txt');
    
    console.log('⏳ Waiting for processing (15 seconds max)...');
    
    // Simple wait with timeout
    let dialogFound = false;
    
    for (let i = 0; i < 15; i++) {
      const dialogs = await page.locator('[role="dialog"]').count();
      if (dialogs > 0) {
        dialogFound = true;
        break;
      }
      await page.waitForTimeout(1000);
      process.stdout.write(`\r⏰ ${15-i} seconds...`);
    }
    
    if (dialogFound) {
      console.log('\n✅ Dialog found!');
      
      const dialogText = await page.locator('[role="dialog"]').innerText();
      console.log('\n📋 AI Results:');
      console.log(dialogText);
      
      // Try to save
      const saveButtons = await page.locator('[role="dialog"] button').filter({ hasText: /save/i }).count();
      if (saveButtons > 0) {
        console.log('\n💾 Clicking Save...');
        await page.locator('[role="dialog"] button').filter({ hasText: /save/i }).click();
        console.log('✅ Save clicked!');
      }
      
    } else {
      console.log('\n❌ No dialog appeared');
    }
    
    // Cleanup
    fs.unlinkSync('psych-syllabus.txt');
    
  } else {
    console.log('❌ No file input found on page');
    
    // Show what IS on the page
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      text: document.body.innerText.substring(0, 300),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText)
    }));
    
    console.log('\n📄 Page info:');
    console.log('Title:', pageInfo.title);
    console.log('Buttons:', pageInfo.buttons.join(', '));
    console.log('Text preview:', pageInfo.text);
  }
  
  await page.screenshot({ path: 'final-test.png' });
  console.log('\n📸 Screenshot saved: final-test.png');
  
  console.log('\n🎉 Test complete!');
  
  // Close after 5 seconds
  await page.waitForTimeout(5000);
  await browser.close();
}

instantTest();