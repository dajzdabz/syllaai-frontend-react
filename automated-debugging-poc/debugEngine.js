// debugEngine.js - Core debugging engine for SyllabAI
const chalk = require('chalk');

class SyllabAIDebugger {
  constructor(page) {
    this.page = page;
    this.issues = [];
    this.testResults = {
      consoleLogs: [],
      apiCalls: [],
      errors: [],
      stateSnapshots: {}
    };
    this.startTime = Date.now();
  }

  async setupMonitoring() {
    console.log(chalk.blue('🔍 Setting up monitoring...'));
    
    // Intercept console logs
    this.page.on('console', async msg => {
      const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => arg.toString())));
      this.testResults.consoleLogs.push({
        type: msg.type(),
        text: args.join(' '),
        timestamp: new Date().toISOString()
      });
      
      // Check for errors in console
      if (msg.type() === 'error') {
        this.addIssue({
          type: 'console-error',
          message: args.join(' '),
          priority: 'medium'
        });
      }
    });

    // Monitor page errors
    this.page.on('pageerror', error => {
      this.testResults.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      this.addIssue({
        type: 'page-error',
        message: error.message,
        priority: 'high'
      });
    });

    // Monitor API calls properly
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('localhost:8001') || url.includes('syllaai-ai.onrender.com')) {
        const apiCall = {
          id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: url,
          method: request.method(),
          timestamp: new Date().toISOString()
        };
        this.testResults.apiCalls.push(apiCall);
      }
    });
    
    this.page.on('response', async response => {
      const url = response.url();
      if (url.includes('localhost:8001') || url.includes('syllaai-ai.onrender.com')) {
        const apiCall = this.testResults.apiCalls.find(call => 
          call.url === url && !call.response
        );
        if (apiCall) {
          apiCall.response = {
            status: response.status(),
            statusText: response.statusText()
          };
          // Only capture body for non-binary responses
          if (response.headers()['content-type']?.includes('json')) {
            try {
              apiCall.response.body = await response.text();
            } catch (e) {
              apiCall.response.body = '[Failed to read body]';
            }
          }
        }
      }
    });
  }

  async runDebugScript(script, description = '') {
    console.log(chalk.gray(`  Running: ${description || 'Debug script'}`));
    try {
      const result = await this.page.evaluate(script);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async detectComponents() {
    console.log(chalk.blue('🔍 Detecting components...'));
    
    const result = await this.runDebugScript(`
      (() => {
        const results = {
          fileInput: !!document.querySelector('input[type="file"]'),
          uploadButton: !!document.querySelector('button:has-text("Upload"), button:has-text("upload")'),
          dialogs: document.querySelectorAll('[role="dialog"], .MuiDialog-root').length,
          buttons: Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.innerText.trim(),
            enabled: !b.disabled,
            visible: b.offsetParent !== null,
            className: b.className
          })).filter(b => b.text && b.visible),
          forms: document.querySelectorAll('form').length,
          tables: document.querySelectorAll('table').length,
          cards: document.querySelectorAll('.MuiCard-root, [class*="card"]').length
        };
        
        // Detect specific SyllabAI components
        results.courseCards = document.querySelectorAll('[class*="course-card"], [class*="CourseCard"]').length;
        results.syllabusProcessor = !!document.querySelector('[class*="SyllabusProcessor"]');
        
        return results;
      })()
    `, 'Component detection');
    
    return result;
  }

  async extractReactState(componentSelector) {
    const result = await this.runDebugScript(`
      (() => {
        const element = document.querySelector('${componentSelector}');
        if (!element) return { found: false, selector: '${componentSelector}' };
        
        // Try to find React fiber
        const reactKey = Object.keys(element).find(key => 
          key.startsWith('__reactInternalInstance') || 
          key.startsWith('__reactFiber')
        );
        
        if (!reactKey) return { found: false, hasReact: false };
        
        const fiberNode = element[reactKey];
        let state = {};
        let props = {};
        let hooks = [];
        
        // Traverse fiber tree to find state
        let currentFiber = fiberNode;
        while (currentFiber) {
          if (currentFiber.memoizedState) {
            // Check if it's hooks
            if (currentFiber.memoizedState.memoizedState !== undefined) {
              let hook = currentFiber.memoizedState;
              while (hook) {
                hooks.push(hook.memoizedState);
                hook = hook.next;
              }
            } else {
              state = { ...state, ...currentFiber.memoizedState };
            }
          }
          
          if (currentFiber.memoizedProps) {
            props = { ...props, ...currentFiber.memoizedProps };
          }
          
          currentFiber = currentFiber.return;
        }
        
        return { 
          found: true, 
          state, 
          props,
          hooks: hooks.length > 0 ? hooks : undefined
        };
      })()
    `, `Extract React state from ${componentSelector}`);
    
    return result;
  }

  async waitForAPICall(urlPattern, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const matchingCall = this.testResults.apiCalls.find(call => 
        call.url.includes(urlPattern)
      );
      
      if (matchingCall) {
        return matchingCall;
      }
      
      await this.page.waitForTimeout(100);
    }
    
    return null;
  }

  async checkDataIntegrity(selector, expectedFields) {
    const elementData = await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      
      return {
        text: element.innerText,
        value: element.value,
        dataset: { ...element.dataset }
      };
    }, selector);
    
    const missingFields = expectedFields.filter(field => 
      !elementData || (!elementData.text?.includes(field) && !elementData.value?.includes(field))
    );
    
    if (missingFields.length > 0) {
      this.addIssue({
        type: 'data-integrity',
        selector: selector,
        missingFields: missingFields,
        priority: 'high'
      });
    }
    
    return elementData;
  }

  addIssue(issue) {
    const enhancedIssue = {
      ...issue,
      timestamp: new Date().toISOString(),
      id: `issue-${this.issues.length + 1}`,
      pageUrl: this.page.url()
    };
    
    this.issues.push(enhancedIssue);
    
    // Log issue in real-time
    const priorityColor = {
      critical: chalk.red,
      high: chalk.yellow,
      medium: chalk.blue,
      low: chalk.gray
    }[issue.priority] || chalk.white;
    
    console.log(priorityColor(`  ❌ Issue found: ${issue.type} - ${issue.message || issue.error || 'Check details'}`));
  }

  async takeDebugSnapshot(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug-${name}-${timestamp}.png`;
    
    await this.page.screenshot({ 
      path: `./debug-screenshots/${filename}`,
      fullPage: true 
    });
    
    // Also capture page state
    const pageState = await this.page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
      cookies: document.cookie
    }));
    
    this.testResults.stateSnapshots[name] = {
      screenshot: filename,
      pageState,
      timestamp
    };
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(2)}s`,
      issues: this.issues,
      testResults: this.testResults,
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: this.issues.filter(i => i.priority === 'critical').length,
        highIssues: this.issues.filter(i => i.priority === 'high').length,
        mediumIssues: this.issues.filter(i => i.priority === 'medium').length,
        lowIssues: this.issues.filter(i => i.priority === 'low').length,
        totalAPIcalls: this.testResults.apiCalls.length,
        failedAPICalls: this.testResults.apiCalls.filter(c => c.response?.status >= 400).length,
        consoleErrors: this.testResults.consoleLogs.filter(l => l.type === 'error').length
      }
    };
    
    // Print summary
    console.log(chalk.bold('\n📊 Debug Summary:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Total Issues: ${report.summary.totalIssues}`);
    console.log(chalk.red(`  Critical: ${report.summary.criticalIssues}`));
    console.log(chalk.yellow(`  High: ${report.summary.highIssues}`));
    console.log(chalk.blue(`  Medium: ${report.summary.mediumIssues}`));
    console.log(chalk.gray(`  Low: ${report.summary.lowIssues}`));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`API Calls: ${report.summary.totalAPIcalls} (${report.summary.failedAPICalls} failed)`);
    console.log(`Console Errors: ${report.summary.consoleErrors}`);
    console.log(`Duration: ${report.duration}`);
    
    return report;
  }
}

module.exports = { SyllabAIDebugger };