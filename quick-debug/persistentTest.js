const { chromium } = require('playwright');
const fs = require('fs');

async function persistentTest() {
  console.log('🚀 Persistent Session Test...\n');
  
  // Check if we have saved login
  const sessionFile = 'syllabai-session.json';
  const hasSession = fs.existsSync(sessionFile);
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  let context;
  
  if (hasSession) {
    console.log('✅ Loading saved login session...');
    // Load the saved session (cookies, localStorage, etc.)
    context = await browser.newContext({
      storageState: sessionFile
    });
  } else {
    console.log('📝 First time - need to login once...');
    context = await browser.newContext();
  }
  
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
  await page.waitForTimeout(3000);
  
  // Check if we need to login
  const fileInputs = await page.locator('input[type="file"]').count();
  
  if (fileInputs === 0 && !hasSession) {
    console.log('\n🔐 FIRST TIME SETUP:');
    console.log('1. Please login with Google in the browser');
    console.log('2. Wait until you see the file upload dashboard');
    console.log('3. Press ENTER here when you\'re logged in...\n');
    
    // Wait for user to press enter
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    console.log('💾 Saving your login session...');
    // Save the entire browser state (cookies, localStorage, etc.)
    await context.storageState({ path: sessionFile });
    console.log('✅ Session saved! Future tests will use this login automatically.\n');
  }
  
  // Now test upload (works whether we just logged in or loaded session)
  const currentFileInputs = await page.locator('input[type="file"]').count();
  
  if (currentFileInputs > 0) {
    console.log('🧪 Running upload test...');
    
    const testSyllabus = `Math 150 - Calculus I
Dr. Johnson
TR 11:00-12:30 PM

Week 1: Limits
Week 2: Derivatives  
Week 3: Applications

Quiz 1: Sep 15
Midterm: Oct 10
Final: Dec 5`;
    
    fs.writeFileSync('calc-syllabus.txt', testSyllabus);
    
    await page.locator('input[type="file"]').setInputFiles('calc-syllabus.txt');
    console.log('📤 File uploaded');
    
    // Wait for processing
    const dialog = await page.waitForSelector('[role="dialog"]', { timeout: 20000 }).catch(() => null);
    
    if (dialog) {
      console.log('✅ Processing complete!');
      const content = await dialog.innerText();
      console.log('📋 AI Results:', content.substring(0, 200) + '...');
      
      const saveBtn = await page.locator('[role="dialog"] button').filter({ hasText: /save/i });
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        console.log('💾 Course saved!');
      }
    }
    
    fs.unlinkSync('calc-syllabus.txt');
    console.log('\n🎉 Test complete!');
    
  } else {
    console.log('❌ Still no file input found');
  }
  
  console.log('\n📋 Session Status:');
  console.log(`- Session file exists: ${fs.existsSync(sessionFile)}`);
  console.log('- Next run will use saved login automatically');
  
  await page.waitForTimeout(5000);
  await browser.close();
}

persistentTest().catch(console.error);