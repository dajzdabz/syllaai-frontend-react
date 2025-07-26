# SyllabAI Automated Debugging System

This proof-of-concept demonstrates how to automate the manual debugging process outlined in `DEBUGGING_METHODOLOGY.md`.

## Quick Start

```bash
# Install dependencies
npm install

# Run all test scenarios
npm test

# Run with visible browser
npm run test:headed

# Run specific scenario
npm run test:scenario -- --scenario="Save to My Courses"
```

## Features

### ✅ **Automated Components**
- Component detection and validation
- API call monitoring and validation
- Console error tracking
- State extraction from React components
- Screenshot capture on errors
- Comprehensive reporting

### 🤖 **Smart Debugging**
- Follows your 10-step methodology automatically
- Captures all issues before attempting fixes
- Generates structured reports
- Tracks API retry patterns
- Validates data integrity

### 📊 **Reporting**
- JSON reports with all findings
- Real-time console output
- Screenshot evidence
- API call logs
- Issue prioritization

## Architecture

```
automated-debugging-poc/
├── debugEngine.js        # Core debugging engine
├── runAutomatedDebug.js  # Main test runner
├── test-scenarios.yaml   # Test scenarios
├── package.json         # Dependencies
└── debug-screenshots/   # Screenshot storage
```

## Extending the System

### Adding New Scenarios
Edit `test-scenarios.yaml`:
```yaml
- name: "Your Test Name"
  description: "What this tests"
  steps:
    - action: "navigate"
      url: "/your-page"
    # Add more steps...
```

### Adding New Actions
Add to the switch statement in `runAutomatedDebug.js`:
```javascript
case 'yourNewAction':
  // Implementation
  break;
```

## Semi-Automated Alternative

If you prefer a hybrid approach, you can use the debug engine interactively:

```javascript
// In browser console
const debugger = new SyllabAIDebugger(page);
await debugger.detectComponents();
await debugger.extractReactState('.course-card');
```

## Limitations

- Cannot access Render backend logs automatically
- Visual UI issues require manual verification
- Complex user flows may need custom actions
- Google OAuth flow requires manual intervention

## Next Steps

1. **CI/CD Integration**: Add GitHub Actions workflow
2. **Visual Testing**: Add screenshot comparison
3. **Performance Monitoring**: Track load times
4. **Alert System**: Notify on critical issues
5. **Dashboard**: Web UI for viewing results