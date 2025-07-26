// debugHelpers.js - Utilities for reliable state extraction

// Inject this into the app for testing
const DEBUG_HELPERS = `
window.__SYLLABAI_DEBUG__ = {
  getCourseData: () => {
    // Look for course data in common places
    const courseCards = document.querySelectorAll('[data-testid="course-card"]');
    return Array.from(courseCards).map(card => ({
      title: card.querySelector('[data-testid="course-title"]')?.textContent,
      code: card.querySelector('[data-testid="course-code"]')?.textContent,
      instructor: card.querySelector('[data-testid="instructor"]')?.textContent,
      enrolled: card.querySelector('[data-testid="enrolled-badge"]') !== null
    }));
  },
  
  getDialogData: () => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    
    return {
      title: dialog.querySelector('[data-testid="dialog-course-title"]')?.textContent,
      code: dialog.querySelector('[data-testid="dialog-course-code"]')?.textContent,
      instructor: dialog.querySelector('[data-testid="dialog-instructor"]')?.textContent,
      visible: dialog.offsetParent !== null
    };
  },
  
  getLastAPIError: () => {
    // Check for error states in the UI
    const errorElements = document.querySelectorAll('[data-testid="error-message"]');
    return Array.from(errorElements).map(el => el.textContent);
  }
};
`;

// Alternative: Extract data from DOM without test IDs
const extractDataFromDOM = `
(() => {
  const extractors = {
    courseTitle: () => {
      // Try multiple selectors
      const selectors = [
        'h2:contains("Course")',
        '[class*="title"]:contains("Course")',
        'input[name="courseTitle"]',
        'input[placeholder*="title"]'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.textContent || el.value;
      }
      return null;
    },
    
    apiStatus: () => {
      // Look for common status indicators
      const indicators = document.querySelectorAll('[class*="status"], [class*="alert"], [role="alert"]');
      return Array.from(indicators).map(el => ({
        type: el.className,
        message: el.textContent
      }));
    }
  };
  
  const results = {};
  for (const [key, extractor] of Object.entries(extractors)) {
    try {
      results[key] = extractor();
    } catch (e) {
      results[key] = { error: e.message };
    }
  }
  
  return results;
})();
`;

module.exports = {
  DEBUG_HELPERS,
  extractDataFromDOM
};