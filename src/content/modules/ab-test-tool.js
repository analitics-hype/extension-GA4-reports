/**
 * A/B Test Cookie Management Tool
 * Works on all websites to manage cookies starting with _gtm_exp
 */

/**
 * Get all cookies that start with _gtm_exp
 * @returns {Object} Object with cookie names as keys and values as values
 */
export function getABTestCookies() {
  const abTestCookies = {};
  const cookies = document.cookie.split(';');
  
  cookies.forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && name.startsWith('_gtm_exp')) {
      abTestCookies[name] = decodeURIComponent(value || '');
    }
  });
  
  return abTestCookies;
}

/**
 * Set a cookie value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 */
export function setCookie(name, value) {
  // Set cookie with 30 days expiration
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/`;
}

/**
 * Extract test ID from cookie name
 * @param {string} cookieName - Cookie name (e.g., "_gtm_exp_AS287")
 * @returns {string} Test ID (e.g., "AS287")
 */
export function extractTestId(cookieName) {
  return cookieName.replace('_gtm_exp_', '');
}

/**
 * Generate cookie value for a test and variation
 * @param {string} testId - Test ID (e.g., "AS287")
 * @param {string} variation - Variation (e.g., "control", "var1", "var2", "var3")
 * @returns {string} Cookie value (e.g., "gtm_ab_AS287_control")
 */
export function generateCookieValue(testId, variation) {
  return `gtm_ab_${testId}_${variation}`;
}

/**
 * Extract variation from cookie value
 * @param {string} cookieValue - Cookie value (e.g., "gtm_ab_AS287_var1")
 * @returns {string} Variation (e.g., "var1")
 */
export function extractVariation(cookieValue) {
  const parts = cookieValue.split('_');
  return parts[parts.length - 1] || 'control';
}

/**
 * Initialize the A/B test tool if AB test cookies are found
 * Now handled in popup instead of floating UI
 */
export function initABTestTool() {
  // A/B test management moved to extension popup
  // Floating UI removed for better UX
  const abTestCookies = getABTestCookies();
  
  if (Object.keys(abTestCookies).length > 0) {
    console.log('A/B test cookies found:', abTestCookies);
    // UI is now in popup, no floating widget needed
  }
}

// Floating UI functions removed - A/B test management moved to extension popup

// Event handlers removed - A/B test management moved to extension popup

/**
 * Setup message listener for popup communication
 */
export function setupABTestMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getABTestCookies') {
      const cookies = getABTestCookies();
      sendResponse({
        success: true,
        cookies: cookies
      });
      return true;
    }
    
    if (request.action === 'setABTestCookie') {
      try {
        setCookie(request.cookieName, request.cookieValue);
        sendResponse({
          success: true,
          message: 'Cookie set successfully'
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
      return true;
    }
  });
}
