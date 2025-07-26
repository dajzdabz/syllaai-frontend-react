const { chromium } = require('playwright');
const fs = require('fs');

async function runSimpleTest() {
  console.log('🚀 Starting Simple SyllabAI Test...\n');
  
  // Check if we have saved auth
  const hasAuth = fs.existsSync('auth.json');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  let context;
  
  if (hasAuth) {
    console.log('✅ Found saved login! Loading...');
    context = await browser.newContext({
      storageState: 'auth.json'
    });
  } else {
    console.log('📝 First time setup - you\'ll need to login manually');
    context = await browser.newContext();
  }
  
  const page = await context.newPage();
  
  // Monitor API calls
  page.on('request', request => {
    if (request.url().includes('syllaai') || request.url().includes('8001')) {
      console.log('🌐 API:', request.method(), request.url().split('?')[0]);
    }
  });
  
  console.log('📍 Going to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Click Student
  try {
    await page.click('button:has-text("Student")', { timeout: 5000 });
    console.log('✅ Clicked Student button');
  } catch {
    console.log('🤔 No Student button - might already be logged in');
  }
  
  // Wait for page to update after clicking Student
  console.log('⏳ Waiting for page to load...');
  await page.waitForTimeout(3000);
  
  // Take screenshot to see current state
  await page.screenshot({ path: 'current-state.png' });
  console.log('📸 Screenshot saved: current-state.png');
  
  // Check what's on the page
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('\n📄 Page contains:', pageText.substring(0, 100) + '...');
  
  // Check if we need to login
  const hasGoogleButton = pageText.toLowerCase().includes('google') || 
                         await page.locator('button[class*="google"]').count() > 0;
  const hasFileInput = await page.locator('input[type="file"]').count() > 0;
  
  console.log('Has Google login:', hasGoogleButton);
  console.log('Has file input:', hasFileInput);
  
  if (hasGoogleButton && !hasFileInput && !hasAuth) {
    console.log('\n🔐 Please login manually:');
    console.log('1. Click the Google sign in button');
    console.log('2. Complete the login');
    console.log('3. Wait for the dashboard to load\n');
    
    // Wait for file input (means logged in)
    try {
      await page.waitForSelector('input[type="file"]', { timeout: 120000 });
      console.log('✅ Login successful!');
      
      // Save the auth state
      await context.storageState({ path: 'auth.json' });
      console.log('💾 Login saved for next time!');
    } catch {
      console.log('❌ Login timeout');
      await browser.close();
      return;
    }
  }
  
  // Now test the upload
  const fileInputExists = await page.locator('input[type="file"]').count() > 0;
  
  if (fileInputExists) {
    console.log('\n🧪 Testing file upload...');
    
    // Create test file
    fs.writeFileSync('test.txt', `Course: CS 101
Instructor: Dr. Smith
Time: MWF 10:00 AM

Week 1: Introduction
Week 2: Variables`);
    
    await page.locator('input[type="file"]').setInputFiles('test.txt');
    console.log('✅ File uploaded');
    
    // Wait for processing
    console.log('⏳ Waiting for AI processing...');
    
    const dialog = await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => null);
    
    if (dialog) {
      console.log('✅ Dialog appeared!');
      await page.screenshot({ path: 'upload-success.png' });
      
      // Try to save
      const saveBtn = await page.locator('button').filter({ hasText: /save/i });
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        console.log('✅ Clicked Save');
      }
    }
    
    fs.unlinkSync('test.txt');
  }
  
  console.log('\n✅ Test complete!');
  console.log('Check upload-success.png for results');
  
  // Keep browser open for 10 seconds to see results
  await page.waitForTimeout(10000);
  await browser.close();
}

runSimpleTest().catch(console.error);