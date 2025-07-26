const { chromium } = require('playwright');
const fs = require('fs');

async function mockAuthTest() {
  console.log('🚀 Mock Auth Test - Bypassing Login...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('📍 Going to SyllabAI...');
  await page.goto('https://dajzdabz.github.io/syllaai-frontend-react/');
  
  // Inject mock authentication
  console.log('🔐 Injecting mock authentication...');
  await page.evaluate(() => {
    // Mock auth data that your app expects
    const mockAuthData = {
      token: 'mock-jwt-token-for-testing',
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Store in localStorage like your app does
    localStorage.setItem('authToken', mockAuthData.token);
    localStorage.setItem('user', JSON.stringify(mockAuthData.user));
    localStorage.setItem('tokenExpires', mockAuthData.expires);
    
    // Also set any other auth flags your app uses
    localStorage.setItem('isAuthenticated', 'true');
    
    console.log('✅ Mock auth injected');
  });
  
  // Reload to pick up the auth
  console.log('🔄 Reloading with mock auth...');
  await page.reload();
  
  // Click Student
  await page.click('button:has-text("Student")');
  
  await page.waitForTimeout(3000);
  
  // Now test upload
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log(`📄 File inputs found: ${fileInputs}`);
  
  if (fileInputs > 0) {
    console.log('✅ Mock auth worked! Testing upload...');
    // Continue with upload test...
  } else {
    console.log('❌ Mock auth didn\'t work');
  }
  
  await page.waitForTimeout(10000);
  await browser.close();
}

mockAuthTest();