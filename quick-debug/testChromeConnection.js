const { chromium } = require('playwright');
const http = require('http');

async function findChromeDebugger() {
  console.log('🔍 Looking for Chrome debugger...\n');
  
  // Try different connection methods
  const attempts = [
    { host: 'localhost', port: 9222, name: 'localhost:9222' },
    { host: '127.0.0.1', port: 9222, name: '127.0.0.1:9222' },
    { host: '172.17.0.1', port: 9222, name: 'WSL bridge IP' },
  ];
  
  // Get Windows host IP (for WSL2)
  try {
    const { execSync } = require('child_process');
    const windowsHost = execSync('cat /etc/resolv.conf | grep nameserver | awk \'{print $2}\'').toString().trim();
    if (windowsHost) {
      attempts.push({ host: windowsHost, port: 9222, name: `Windows host (${windowsHost})` });
    }
  } catch (e) {}
  
  for (const attempt of attempts) {
    console.log(`Trying ${attempt.name}...`);
    
    const success = await new Promise(resolve => {
      const req = http.get(`http://${attempt.host}:${attempt.port}/json/version`, (res) => {
        if (res.statusCode === 200) {
          console.log(`✅ Found Chrome at ${attempt.name}!`);
          resolve(true);
        } else {
          resolve(false);
        }
      });
      
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
    
    if (success) {
      console.log('\n🎉 Chrome debugger is running!\n');
      
      try {
        console.log('Connecting to Chrome...');
        const browser = await chromium.connectOverCDP(`http://${attempt.host}:${attempt.port}`);
        console.log('✅ Connected successfully!');
        
        const contexts = browser.contexts();
        console.log(`\nFound ${contexts.length} browser context(s)`);
        
        for (const context of contexts) {
          const pages = context.pages();
          console.log(`\nContext has ${pages.length} page(s):`);
          pages.forEach((page, i) => {
            console.log(`  ${i + 1}. ${page.url()}`);
          });
        }
        
        // Find SyllabAI page
        let syllabaiPage = null;
        for (const context of contexts) {
          for (const page of context.pages()) {
            if (page.url().includes('syllaai')) {
              syllabaiPage = page;
              break;
            }
          }
        }
        
        if (syllabaiPage) {
          console.log('\n✅ Found SyllabAI page!');
          console.log('URL:', syllabaiPage.url());
          
          // Check if logged in
          const hasFileInput = await syllabaiPage.locator('input[type="file"]').count() > 0;
          console.log('Logged in:', hasFileInput);
          
          if (hasFileInput) {
            console.log('\n🎊 Ready to run tests on your logged-in session!');
            // Add your test code here
          }
        } else {
          console.log('\n⚠️  Chrome is running but no SyllabAI tab found.');
          console.log('Please navigate to https://dajzdabz.github.io/syllaai-frontend-react/ in Chrome');
        }
        
        await browser.close();
        return;
        
      } catch (e) {
        console.log('❌ Connection error:', e.message);
      }
    }
  }
  
  console.log('\n❌ Could not find Chrome debugger on any port.');
  console.log('\n📋 Troubleshooting:');
  console.log('1. Make sure Chrome is running with: --remote-debugging-port=9222');
  console.log('2. Check if Windows Firewall is blocking port 9222');
  console.log('3. Try running Chrome as Administrator');
  console.log('\nAlternatively, run this in PowerShell to check:');
  console.log('netstat -an | findstr 9222');
}

findChromeDebugger().catch(console.error);