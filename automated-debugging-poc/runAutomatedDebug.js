// runAutomatedDebug.js - Main test runner
const { chromium } = require('playwright');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { SyllabAIDebugger } = require('./debugEngine');

// Configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || 'https://dajzdabz.github.io/syllaai-frontend-react',
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO || '0'),
  timeout: parseInt(process.env.TIMEOUT || '30000'),
  screenshotDir: './debug-screenshots'
};

// Ensure screenshot directory exists
if (!fs.existsSync(CONFIG.screenshotDir)) {
  fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

async function executeStep(debugger, step, context) {
  console.log(chalk.cyan(`  → ${step.action}`));
  
  switch (step.action) {
    case 'navigate':
      await debugger.page.goto(step.url.startsWith('http') ? step.url : CONFIG.baseURL + step.url);
      if (step.waitFor === 'networkidle') {
        await debugger.page.waitForLoadState('networkidle');
      }
      break;
      
    case 'setupMonitoring':
      if (step.clearPrevious) {
        debugger.testResults = {
          consoleLogs: [],
          apiCalls: [],
          errors: [],
          stateSnapshots: {}
        };
      }
      // Monitoring is already set up in constructor
      break;
      
    case 'detectComponents':
      const components = await debugger.detectComponents();
      if (components.success && step.validate) {
        for (const [key, expected] of Object.entries(step.validate)) {
          const actual = components.data[key];
          
          if (typeof expected === 'boolean' && actual !== expected) {
            debugger.addIssue({
              type: 'component-missing',
              component: key,
              expected: expected,
              actual: actual,
              priority: 'high'
            });
          } else if (typeof expected === 'object' && expected.minCount) {
            const count = Array.isArray(actual) ? actual.length : 0;
            if (count < expected.minCount) {
              debugger.addIssue({
                type: 'component-count',
                component: key,
                expected: `>= ${expected.minCount}`,
                actual: count,
                priority: 'medium'
              });
            }
          }
        }
      }
      context.lastComponents = components.data;
      break;
      
    case 'uploadFile':
      try {
        const fileInput = await debugger.page.waitForSelector('input[type="file"]', { timeout: 5000 });
        const filePath = path.resolve(__dirname, step.file);
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`Test file not found: ${filePath}`);
        }
        
        await fileInput.setInputFiles(filePath);
        
        if (step.waitForDialog) {
          await debugger.page.waitForSelector('[role="dialog"]', { 
            timeout: step.timeout || 10000 
          });
        }
      } catch (error) {
        debugger.addIssue({
          type: 'upload-failed',
          error: error.message,
          file: step.file,
          priority: 'critical'
        });
      }
      break;
      
    case 'waitForAPICall':
      const apiCall = await debugger.waitForAPICall(step.urlPattern, step.timeout || 5000);
      if (!apiCall) {
        debugger.addIssue({
          type: 'api-call-missing',
          urlPattern: step.urlPattern,
          priority: 'high'
        });
      } else if (step.validateResponse) {
        if (step.validateResponse.status && apiCall.response?.status !== step.validateResponse.status) {
          debugger.addIssue({
            type: 'api-response-error',
            url: apiCall.url,
            expectedStatus: step.validateResponse.status,
            actualStatus: apiCall.response?.status,
            priority: 'high'
          });
        }
      }
      context.lastAPICall = apiCall;
      break;
      
    case 'extractDialogData':
      const dialogExists = await debugger.page.locator(step.selector).count() > 0;
      if (!dialogExists) {
        debugger.addIssue({
          type: 'dialog-not-found',
          selector: step.selector,
          priority: 'high'
        });
        break;
      }
      
      const dialogData = await debugger.page.evaluate((sel) => {
        const dialog = document.querySelector(sel);
        if (!dialog) return null;
        
        // Extract all text content
        const allText = dialog.innerText;
        
        // Try to find specific fields
        const findField = (fieldNames) => {
          for (const name of fieldNames) {
            const regex = new RegExp(`${name}[:\\s]+([^\\n]+)`, 'i');
            const match = allText.match(regex);
            if (match) return match[1].trim();
          }
          return null;
        };
        
        return {
          courseTitle: findField(['course title', 'title', 'course name', 'name']),
          instructor: findField(['instructor', 'professor', 'taught by']),
          courseCode: findField(['course code', 'code', 'course number']),
          rawText: allText
        };
      }, step.selector);
      
      if (step.expectedFields) {
        for (const field of step.expectedFields) {
          if (!dialogData || !dialogData[field]) {
            debugger.addIssue({
              type: 'missing-dialog-field',
              field: field,
              dialogContent: dialogData?.rawText?.substring(0, 200),
              priority: 'high'
            });
          }
        }
      }
      
      context.dialogData = dialogData;
      break;
      
    case 'clickButton':
      try {
        let button;
        if (step.parentSelector) {
          const parent = await debugger.page.locator(step.parentSelector);
          button = parent.getByRole('button', { name: new RegExp(step.text, 'i') });
        } else {
          button = await debugger.page.getByRole('button', { name: new RegExp(step.text, 'i') });
        }
        
        await button.click();
        
        if (step.waitForAPICall) {
          await debugger.waitForAPICall(step.waitForAPICall, 5000);
        }
      } catch (error) {
        debugger.addIssue({
          type: 'button-click-failed',
          buttonText: step.text,
          error: error.message,
          priority: 'high'
        });
      }
      break;
      
    case 'screenshot':
      await debugger.takeDebugSnapshot(step.name);
      break;
      
    case 'checkAPICallCount':
      const calls = debugger.testResults.apiCalls.filter(call => 
        call.url.includes(step.endpoint)
      );
      if (calls.length > step.maxCalls) {
        debugger.addIssue({
          type: 'excessive-api-calls',
          endpoint: step.endpoint,
          expectedMax: step.maxCalls,
          actual: calls.length,
          priority: 'high',
          message: 'Possible infinite retry loop detected'
        });
      }
      break;
      
    case 'checkConsoleErrors':
      const errors = debugger.testResults.consoleLogs.filter(log => log.type === 'error');
      if (errors.length > step.maxErrors) {
        debugger.addIssue({
          type: 'console-errors',
          count: errors.length,
          maxExpected: step.maxErrors,
          errors: errors.slice(0, 3).map(e => e.text), // First 3 errors
          priority: 'medium'
        });
      }
      break;
      
    case 'wait':
      await debugger.page.waitForTimeout(step.duration);
      break;
      
    case 'verifyCourseSaved':
      // Check if course appears without refresh
      const courseCards = await debugger.page.locator('[class*="course-card"]').count();
      if (courseCards === 0) {
        debugger.addIssue({
          type: 'course-not-visible',
          message: 'Course not visible after save',
          priority: 'high'
        });
      }
      
      // Verify the saved data matches what was shown
      if (context.dialogData) {
        const savedCourseText = await debugger.page.locator('[class*="course-card"]:last-child').innerText();
        if (!savedCourseText.includes(context.dialogData.courseTitle || '')) {
          debugger.addIssue({
            type: 'data-mismatch',
            expected: context.dialogData.courseTitle,
            actual: savedCourseText,
            priority: 'high'
          });
        }
      }
      break;
      
    default:
      throw new Error(`Unimplemented action: ${step.action}`);
  }
}

async function runScenario(scenario, browser) {
  console.log(chalk.bold.green(`\n🧪 Running scenario: ${scenario.name}`));
  console.log(chalk.gray(`   ${scenario.description}`));
  console.log(chalk.gray('─'.repeat(50)));
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    baseURL: CONFIG.baseURL,
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  const debugger = new SyllabAIDebugger(page);
  
  await debugger.setupMonitoring();
  
  const scenarioContext = {}; // Shared context between steps
  
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    try {
      await executeStep(debugger, step, scenarioContext);
    } catch (error) {
      console.log(chalk.red(`    ❌ Step failed: ${error.message}`));
      debugger.addIssue({
        scenario: scenario.name,
        step: step.action,
        stepIndex: i,
        error: error.message,
        priority: 'critical'
      });
      
      // Take error screenshot
      await debugger.takeDebugSnapshot(`error-${scenario.name}-step${i}`);
    }
  }
  
  await context.close();
  return debugger.generateReport();
}

async function runAutomatedDebugging() {
  console.log(chalk.bold.blue('🚀 SyllabAI Automated Debugging System'));
  console.log(chalk.gray(`   Base URL: ${CONFIG.baseURL}`));
  console.log(chalk.gray(`   Mode: ${CONFIG.headless ? 'Headless' : 'Headed'}`));
  
  // Load scenarios
  const scenariosFile = path.join(__dirname, 'test-scenarios.yaml');
  const scenarios = yaml.load(fs.readFileSync(scenariosFile, 'utf8'));
  
  // Filter scenarios if specified
  const scenarioFilter = process.argv.find(arg => arg.startsWith('--scenario='));
  const filteredScenarios = scenarioFilter 
    ? scenarios.scenarios.filter(s => s.name.includes(scenarioFilter.split('=')[1]))
    : scenarios.scenarios;
  
  // Launch browser
  const browser = await chromium.launch({
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo
  });
  
  const allReports = [];
  
  // Run each scenario
  for (const scenario of filteredScenarios) {
    try {
      const report = await runScenario(scenario, browser);
      allReports.push({
        scenario: scenario.name,
        report
      });
    } catch (error) {
      console.log(chalk.red(`\n❌ Scenario failed: ${error.message}`));
      allReports.push({
        scenario: scenario.name,
        error: error.message
      });
    }
  }
  
  await browser.close();
  
  // Generate final report
  const finalReport = {
    timestamp: new Date().toISOString(),
    baseURL: CONFIG.baseURL,
    scenarios: allReports,
    summary: {
      totalScenarios: allReports.length,
      failedScenarios: allReports.filter(r => r.error).length,
      totalIssues: allReports.reduce((sum, r) => sum + (r.report?.issues?.length || 0), 0),
      criticalIssues: allReports.reduce((sum, r) => 
        sum + (r.report?.issues?.filter(i => i.priority === 'critical').length || 0), 0
      )
    }
  };
  
  // Save report
  const reportPath = path.join(__dirname, `debug-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  
  // Print final summary
  console.log(chalk.bold.green('\n\n✅ Automated Debugging Complete!'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log(`🧪 Scenarios run: ${finalReport.summary.totalScenarios}`);
  console.log(`❌ Total issues found: ${finalReport.summary.totalIssues}`);
  console.log(`🔴 Critical issues: ${finalReport.summary.criticalIssues}`);
  
  // Exit with error code if critical issues found
  if (finalReport.summary.criticalIssues > 0) {
    console.log(chalk.red('\n⚠️  Critical issues detected! Check the report for details.'));
    process.exit(1);
  }
}

// Run the debugger
runAutomatedDebugging().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});