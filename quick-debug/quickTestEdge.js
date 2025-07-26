const { chromium } = require('playwright');
const fs = require('fs');

async function runWithEdge() {
  console.log('🚀 Starting SyllabAI Test with Edge...\n');
  
  // Launch Edge instead of Chrome
  const browser = await chromium.launch({
    channel: 'msedge',  // This tells Playwright to use Edge
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
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
  
  console.log('📍 Navigating to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  await page.waitForLoadState('networkidle');
  
  // Click Student button
  console.log('🎓 Clicking Student...');
  const studentButton = page.locator('button').filter({ hasText: 'Student' });
  await studentButton.click();
  
  // Wait for login or dashboard
  await page.waitForTimeout(2000);
  
  // Check what we see
  const pageContent = await page.evaluate(() => ({
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText),
    hasFileInput: !!document.querySelector('input[type="file"]'),
    pageText: document.body.innerText.substring(0, 200)
  }));
  
  console.log('\n📊 Current state:');
  console.log('Buttons:', pageContent.buttons.join(', '));
  console.log('Has file input:', pageContent.hasFileInput);
  
  if (!pageContent.hasFileInput) {
    console.log('\n🔐 Login required!');
    console.log('Please login manually with Google...');
    
    // Save login state after you login
    await page.context().storageState({ path: 'auth.json' });
    console.log('✅ Login state saved!');
  } else {
    console.log('\n✅ Already logged in! Running tests...');
    
    // Test file upload
    const testFile = 'test-syllabus.txt';
    fs.writeFileSync(testFile, 'Course: Test 101\nInstructor: Dr. Test');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    console.log('📄 File uploaded, waiting for processing...');
    await page.waitForTimeout(5000);
    
    // Clean up
    fs.unlinkSync(testFile);
  }
  
  console.log('\n✅ Test complete!');
  await browser.close();
}

// For Firefox
async function runWithFirefox() {
  const { firefox } = require('playwright');
  
  console.log('🦊 Starting with Firefox...\n');
  
  const browser = await firefox.launch({
    headless: false,
    slowMo: 500
  });
  
  // Rest is the same as above...
  const page = await browser.newPage();
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  console.log('Firefox loaded! Continue with manual testing...');
  
  // Keep open for manual testing
  await new Promise(() => {});
}

// Run with Edge by default
runWithEdge().catch(console.error);