const { chromium } = require('playwright');

// BEST SOLUTION: Connect to your existing Chrome
async function useYourChrome() {
  console.log('🚀 Connecting to your existing Chrome...\n');
  
  console.log('📋 Quick Setup:');
  console.log('1. Close all Chrome windows');
  console.log('2. Open Chrome with remote debugging:');
  console.log('\n   For WSL (like you), run this:');
  console.log('   /mnt/c/Program\\ Files/Google/Chrome/Application/chrome.exe --remote-debugging-port=9222');
  console.log('\n   Or if you have Chrome in PATH:');
  console.log('   chrome.exe --remote-debugging-port=9222');
  console.log('\n3. Login to SyllabAI in that Chrome window');
  console.log('4. Press ENTER here when ready...\n');
  
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  try {
    // Connect to existing Chrome
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Connected to your Chrome!');
    
    // Get the existing page
    const contexts = browser.contexts();
    const pages = contexts[0].pages();
    const page = pages.find(p => p.url().includes('syllaai')) || pages[0];
    
    console.log('📍 Current page:', page.url());
    
    // Now run tests on YOUR logged-in session
    const hasFileInput = await page.locator('input[type="file"]').isVisible();
    console.log('Has file input:', hasFileInput);
    
    if (hasFileInput) {
      console.log('\n✅ Great! You\'re logged in. Running tests...');
      
      // Your existing test code works here!
      // This is YOUR Chrome with YOUR login
    }
    
  } catch (e) {
    console.log('\n❌ Could not connect. Make sure you:');
    console.log('1. Started Chrome with --remote-debugging-port=9222');
    console.log('2. Have Chrome open with SyllabAI loaded');
  }
}

useYourChrome().catch(console.error);