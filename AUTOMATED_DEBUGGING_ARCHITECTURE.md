# SyllabAI Automated Debugging Architecture

## Overview

This document outlines an automated approach to the current manual debugging methodology, transforming the interactive JavaScript console process into an automated testing and debugging system.

## Architecture Components

### 1. **Automated Test Runner (Playwright)**
```javascript
// playwright.config.js
module.exports = {
  use: {
    baseURL: 'https://dajzdabz.github.io/syllaai-frontend-react/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'debug-mode',
      use: {
        ...devices['Desktop Chrome'],
        // Inject debugging utilities
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write'],
        },
      },
    },
  ],
};
```

### 2. **Debugging Engine**
```javascript
// debugEngine.js
class SyllabAIDebugger {
  constructor(page) {
    this.page = page;
    this.issues = [];
    this.testResults = {};
  }

  async setupMonitoring() {
    // Intercept console logs
    this.page.on('console', msg => {
      this.testResults.consoleLogs = this.testResults.consoleLogs || [];
      this.testResults.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Monitor API calls
    await this.page.route('**/*', (route, request) => {
      this.testResults.apiCalls = this.testResults.apiCalls || [];
      this.testResults.apiCalls.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
      route.continue();
    });
  }

  async runDebugScript(script) {
    return await this.page.evaluate(script);
  }

  async detectComponents() {
    return await this.runDebugScript(`
      (() => {
        const results = {
          fileInput: !!document.querySelector('input[type="file"]'),
          dialogs: document.querySelectorAll('.MuiDialog-root').length,
          buttons: Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.innerText,
            enabled: !b.disabled,
            visible: b.offsetParent !== null
          }))
        };
        return results;
      })()
    `);
  }

  async extractReactState(componentSelector) {
    return await this.runDebugScript(`
      (() => {
        const element = document.querySelector('${componentSelector}');
        if (!element) return null;
        
        const reactKey = Object.keys(element).find(key => key.startsWith('__reactInternalInstance'));
        if (!reactKey) return null;
        
        const fiberNode = element[reactKey];
        let state = {};
        let currentFiber = fiberNode;
        
        while (currentFiber) {
          if (currentFiber.memoizedState) {
            state = { ...state, ...currentFiber.memoizedState };
          }
          currentFiber = currentFiber.return;
        }
        
        return state;
      })()
    `);
  }

  addIssue(issue) {
    this.issues.push({
      ...issue,
      timestamp: new Date().toISOString(),
      id: `issue-${this.issues.length + 1}`
    });
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      issues: this.issues,
      testResults: this.testResults,
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: this.issues.filter(i => i.priority === 'critical').length,
        passedTests: Object.values(this.testResults).filter(r => r.status === 'passed').length
      }
    };
  }
}
```

### 3. **Test Scenarios Configuration**
```yaml
# test-scenarios.yaml
scenarios:
  - name: "Save to My Courses Flow"
    steps:
      - action: "navigate"
        url: "/student-dashboard"
      
      - action: "setupMonitoring"
        monitors:
          - "console"
          - "network"
          - "errors"
      
      - action: "detectComponents"
        validate:
          - fileInput: true
          - uploadButton: true
      
      - action: "uploadFile"
        file: "test_syllabus_1.pdf"
      
      - action: "waitForProcessing"
        timeout: 10000
      
      - action: "extractData"
        targets:
          - selector: ".course-dialog"
            stateKeys: ["courseTitle", "instructor", "courseCode"]
      
      - action: "validateData"
        expectations:
          - field: "courseTitle"
            notEmpty: true
          - field: "apiResponse.status"
            equals: 200
      
      - action: "clickSave"
        selector: "button:contains('Save')"
      
      - action: "verifyResult"
        checks:
          - courseVisible: true
          - noConsoleErrors: true
          - apiCallCount: 1

  - name: "Unenroll Button Test"
    steps:
      - action: "navigate"
        url: "/student-dashboard"
      
      - action: "findCourse"
        filter: "enrolled: true"
      
      - action: "clickUnenroll"
        captureState: true
      
      - action: "verifyUnenrollment"
        checks:
          - apiEndpoint: "/unenroll"
          - courseRemoved: true
```

### 4. **Automated Test Runner**
```javascript
// runAutomatedDebug.js
const { chromium } = require('playwright');
const yaml = require('js-yaml');
const fs = require('fs');
const { SyllabAIDebugger } = require('./debugEngine');

async function runAutomatedDebugging() {
  const scenarios = yaml.load(fs.readFileSync('test-scenarios.yaml', 'utf8'));
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const debugger = new SyllabAIDebugger(page);
  await debugger.setupMonitoring();
  
  for (const scenario of scenarios.scenarios) {
    console.log(`Running scenario: ${scenario.name}`);
    
    for (const step of scenario.steps) {
      try {
        await executeStep(debugger, step);
      } catch (error) {
        debugger.addIssue({
          scenario: scenario.name,
          step: step.action,
          error: error.message,
          priority: 'high'
        });
      }
    }
  }
  
  const report = debugger.generateReport();
  fs.writeFileSync('debug-report.json', JSON.stringify(report, null, 2));
  
  await browser.close();
  return report;
}

async function executeStep(debugger, step) {
  switch (step.action) {
    case 'navigate':
      await debugger.page.goto(step.url);
      break;
      
    case 'detectComponents':
      const components = await debugger.detectComponents();
      for (const [key, expected] of Object.entries(step.validate)) {
        if (components[key] !== expected) {
          debugger.addIssue({
            type: 'component-missing',
            component: key,
            expected: expected,
            actual: components[key]
          });
        }
      }
      break;
      
    case 'uploadFile':
      const fileInput = await debugger.page.locator('input[type="file"]');
      await fileInput.setInputFiles(step.file);
      break;
      
    case 'extractData':
      for (const target of step.targets) {
        const state = await debugger.extractReactState(target.selector);
        debugger.testResults[`state_${target.selector}`] = state;
      }
      break;
      
    // ... more step implementations
  }
}
```

### 5. **Integration with CI/CD**
```yaml
# .github/workflows/debug-tests.yml
name: Automated Debug Tests

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 */6 * * *'  # Run every 6 hours

jobs:
  debug-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install playwright @playwright/test js-yaml
          npx playwright install chromium
      
      - name: Run automated debugging
        run: node runAutomatedDebug.js
      
      - name: Upload debug report
        uses: actions/upload-artifact@v3
        with:
          name: debug-report
          path: debug-report.json
      
      - name: Check for critical issues
        run: |
          CRITICAL_COUNT=$(jq '.summary.criticalIssues' debug-report.json)
          if [ $CRITICAL_COUNT -gt 0 ]; then
            echo "Critical issues found!"
            exit 1
          fi
```

## Partial Automation Options

If full automation isn't feasible, here are semi-automated approaches:

### Option 1: **Interactive Debug Assistant**
```javascript
// debugAssistant.js
class DebugAssistant {
  constructor() {
    this.scriptQueue = [];
    this.results = [];
  }
  
  async runNextScript() {
    if (this.scriptQueue.length === 0) {
      console.log('No more scripts to run');
      this.generateSummary();
      return;
    }
    
    const script = this.scriptQueue.shift();
    console.log('Please run this script in the console:');
    console.log(script.code);
    console.log('\nThen call: assistant.recordResult(output)');
  }
  
  recordResult(output) {
    this.results.push({
      script: this.scriptQueue[0]?.name,
      output: output,
      timestamp: new Date().toISOString()
    });
    
    // Analyze output and determine next script
    this.analyzeAndQueueNext(output);
    this.runNextScript();
  }
  
  analyzeAndQueueNext(output) {
    // Smart logic to determine what to test next based on output
    if (output.includes('error')) {
      this.scriptQueue.push({
        name: 'Deep dive error inspection',
        code: 'console.log(window.__lastError)'
      });
    }
  }
}
```

### Option 2: **Browser Extension Debugger**
Create a Chrome extension that:
- Automatically injects monitoring scripts
- Provides a debug panel with one-click script execution
- Records all interactions and results
- Generates reports without manual copy/paste

## Limitations & Considerations

### What CAN be Automated:
✅ Component detection and validation
✅ API monitoring and request/response capture
✅ Console log collection
✅ State extraction and verification
✅ Regression testing after fixes
✅ Report generation

### What CANNOT be Fully Automated:
❌ Complex user interactions requiring human judgment
❌ Visual verification of UI issues
❌ Debugging novel/unexpected issues
❌ Backend log correlation (requires Render access)
❌ Dynamic script generation based on unique scenarios

### Hybrid Approach (Recommended):
1. **Automated baseline testing** - Run standard scenarios automatically
2. **Guided manual debugging** - For complex issues, use assistant tools
3. **Automated regression suite** - Prevent fixed issues from recurring
4. **Continuous monitoring** - Detect issues before users report them

## Implementation Roadmap

1. **Phase 1: Basic Automation** (1-2 weeks)
   - Set up Playwright
   - Create basic test scenarios
   - Implement component detection

2. **Phase 2: Advanced Debugging** (2-3 weeks)
   - Add state extraction
   - Implement smart issue detection
   - Create comprehensive reports

3. **Phase 3: CI/CD Integration** (1 week)
   - GitHub Actions setup
   - Scheduled test runs
   - Alert system for critical issues

4. **Phase 4: Enhancement** (Ongoing)
   - Add more scenarios
   - Improve issue detection algorithms
   - Build dashboard for results

## Conclusion

While your current manual debugging process can't be 100% automated due to its interactive nature and need for human judgment, significant portions can be automated:

- **70% Automatable**: Standard flows, regression testing, basic validations
- **20% Semi-Automatable**: Complex scenarios with guided assistance
- **10% Manual Only**: Novel issues, visual problems, judgment calls

The recommended approach is a hybrid system that automates routine debugging while providing powerful tools for manual investigation when needed.