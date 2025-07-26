const { chromium } = require('playwright');

// Super simple test that WILL work
async function runQuickTest() {
  console.log('🚀 Starting SyllabAI Debug Test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,  // You can watch it run
    slowMo: 500      // Slow enough to see what's happening
  });
  
  const page = await browser.newPage();
  
  // Track what we find
  const results = {
    componentsFound: [],
    apiCalls: [],
    errors: [],
    screenshots: []
  };
  
  // Monitor console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.errors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
  });
  
  // Monitor API calls
  page.on('request', request => {
    if (request.url().includes('syllaai') || request.url().includes('8001')) {
      results.apiCalls.push({
        url: request.url(),
        method: request.method()
      });
      console.log('🌐 API Call:', request.method(), request.url());
    }
  });
  
  try {
    // Go to your site
    console.log('📍 Navigating to SyllabAI...');
    await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
    
    // Wait for it to load
    await page.waitForLoadState('networkidle');
    
    // Check what's on the page
    const checks = await page.evaluate(() => {
      return {
        hasFileInput: !!document.querySelector('input[type="file"]'),
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText),
        isStudentDashboard: window.location.href.includes('/student'),
        hasLoginButton: Array.from(document.querySelectorAll('button')).some(b => 
          b.innerText.toLowerCase().includes('login') || 
          b.innerText.toLowerCase().includes('sign in')
        )
      };
    });
    
    console.log('\n📊 Initial Page Analysis:');
    console.log('- Has file input:', checks.hasFileInput);
    console.log('- Is student dashboard:', checks.isStudentDashboard);
    console.log('- Has login:', checks.hasLoginButton);
    console.log('- Buttons found:', checks.buttons.join(', '));
    
    // Take screenshot
    await page.screenshot({ path: 'quick-debug-1-initial.png' });
    console.log('\n📸 Screenshot saved: quick-debug-1-initial.png');
    
    // Check if we need to click Student button first
    if (checks.buttons.includes('Student')) {
      console.log('\n🎓 Found Student button. Clicking it...');
      
      // Use locator for better clicking
      const studentButton = page.locator('button').filter({ hasText: 'Student' });
      await studentButton.click();
      
      // Wait for any of these: Google login, file input, or new buttons
      console.log('⏳ Waiting for page change...');
      
      await Promise.race([
        page.waitForSelector('button[class*="google"]', { timeout: 5000 }).catch(() => null),
        page.waitForSelector('input[type="file"]', { timeout: 5000 }).catch(() => null),
        page.waitForSelector('button:has-text("Sign in")', { timeout: 5000 }).catch(() => null),
        page.waitForTimeout(5000)
      ]);
      
      // Take screenshot to see what happened
      await page.screenshot({ path: 'quick-debug-2-after-student.png' });
      console.log('📸 Screenshot saved: quick-debug-2-after-student.png');
      
      // Check what we see now
      const afterStudentClick = await page.evaluate(() => {
        const allText = document.body.innerText;
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText);
        return {
          hasGoogleLogin: !!document.querySelector('button[class*="google"]') || 
                         allText.toLowerCase().includes('google'),
          hasFileInput: !!document.querySelector('input[type="file"]'),
          currentButtons: buttons,
          pageText: allText.substring(0, 200) // First 200 chars
        };
      });
      
      console.log('\n📊 After clicking Student:');
      console.log('- Has Google login:', afterStudentClick.hasGoogleLogin);
      console.log('- Has file input:', afterStudentClick.hasFileInput);
      console.log('- Buttons now:', afterStudentClick.currentButtons.join(', '));
      
      if (afterStudentClick.hasGoogleLogin || afterStudentClick.currentButtons.some(b => 
          b.toLowerCase().includes('sign') || b.toLowerCase().includes('google'))) {
        console.log('\n🔐 Login screen detected!');
        console.log('👉 Please manually click the Google/Sign in button and complete login');
        console.log('⏳ I\'ll wait for you to finish...\n');
        
        // Wait for file input to appear (indicates logged in)
        try {
          await page.waitForSelector('input[type="file"]', { timeout: 60000 });
          console.log('✅ Login successful! File input detected.');
        } catch {
          console.log('⏰ Timeout waiting for login. Let me check what\'s on screen...');
          const currentState = await page.evaluate(() => document.body.innerText.substring(0, 100));
          console.log('Current page shows:', currentState);
        }
      }
    }
    
    // Check if we're now on student dashboard
    const afterLogin = await page.evaluate(() => ({
      url: window.location.href,
      hasFileInput: !!document.querySelector('input[type="file"]')
    }));
    
    console.log('\n📍 Current location:', afterLogin.url);
    console.log('Has file input now:', afterLogin.hasFileInput);
    
    // If we have file input, try a quick upload test
    if (afterLogin.hasFileInput) {
      console.log('\n🧪 Testing file upload...');
      
      // Create a test file
      const fs = require('fs');
      const testFile = 'test-syllabus.txt';
      fs.writeFileSync(testFile, `Course: Test Course 101
Instructor: Dr. Test
Schedule: MWF 10:00 AM

This is a test syllabus for debugging.`);
      
      // Upload it
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFile);
      
      console.log('✅ File selected');
      
      // Wait a bit to see what happens
      await page.waitForTimeout(3000);
      
      // Check for dialog
      const hasDialog = await page.locator('[role="dialog"]').count() > 0;
      console.log('Dialog appeared:', hasDialog);
      
      if (hasDialog) {
        await page.screenshot({ path: 'quick-debug-2-dialog.png' });
        console.log('📸 Screenshot saved: quick-debug-2-dialog.png');
      }
      
      // Clean up
      fs.unlinkSync(testFile);
    }
    
    console.log('\n✅ Test complete!');
    console.log('\n📊 Summary:');
    console.log(`- API calls made: ${results.apiCalls.length}`);
    console.log(`- Console errors: ${results.errors.length}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'quick-debug-error.png' });
  }
  
  await browser.close();
}

// Run it
runQuickTest().catch(console.error);