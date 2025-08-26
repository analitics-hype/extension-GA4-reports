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
 */
export function initABTestTool() {
  const abTestCookies = getABTestCookies();
  
  // Only show tool if there are AB test cookies
  if (Object.keys(abTestCookies).length > 0) {
    console.log('A/B test cookies found:', abTestCookies);
    createABTestTool(abTestCookies);
  }
}

/**
 * Create the floating A/B test management tool
 * @param {Object} abTestCookies - Object containing AB test cookies
 */
function createABTestTool(abTestCookies) {
  // Remove existing tool if present
  const existingTool = document.querySelector('#ab-test-tool-style');
  if (existingTool) {
    existingTool.remove();
  }
  
  const existingToolContainer = document.querySelector('.ab-test-tool');
  if (existingToolContainer) {
    existingToolContainer.remove();
  }

  // Inject styles
  const style = document.createElement('style');
  style.id = 'ab-test-tool-style';
  style.textContent = `
    .ab-test-tool {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: Arial, sans-serif;
    }
    
    .ab-tool-toggle {
      width: 50px;
      height: 50px;
      background: #007bff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    }
    
    .ab-tool-toggle:hover {
      background: #0056b3;
      transform: scale(1.1);
    }
    
    .ab-tool-toggle::before {
      content: "⚙";
      font-size: 20px;
    }
    
    .ab-tool-panel {
      position: absolute;
      bottom: 60px;
      right: 0;
      width: 320px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      padding: 20px;
      display: none;
      border: 1px solid #e0e0e0;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .ab-tool-panel.active {
      display: block;
    }
    
    .ab-tool-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .ab-tool-title {
      font-weight: bold;
      color: #333;
      font-size: 16px;
    }
    
    .ab-tool-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .ab-tool-close:hover {
      color: #333;
    }
    
    .ab-current-variation {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      padding: 5px 8px;
      background: #f8f9fa;
      border-radius: 3px;
      border: 1px solid #e9ecef;
    }
    
    .ab-form-group {
      margin-bottom: 10px;
    }
    
    .ab-form-label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #555;
      font-size: 12px;
    }
    
    .ab-form-select {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      background: white;
      cursor: pointer;
    }
    
    .ab-form-select:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }
    
    .ab-tool-actions {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
    }
    
    .ab-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
    }
    
    .ab-btn-primary {
      background: #007bff;
      color: white;
    }
    
    .ab-btn-primary:hover {
      background: #0056b3;
    }
    
    .ab-btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .ab-btn-secondary:hover {
      background: #545b62;
    }
  `;
  document.head.appendChild(style);

  // Get first test as default
  const testKeys = Object.keys(abTestCookies);
  const firstTestKey = testKeys[0];
  const firstTestId = extractTestId(firstTestKey);
  const firstCurrentValue = abTestCookies[firstTestKey];
  const firstCurrentVariation = extractVariation(firstCurrentValue);

  // Create test options for dropdown
  const testOptions = testKeys.map(cookieName => {
    const testId = extractTestId(cookieName);
    return `<option value="${cookieName}">${testId}</option>`;
  }).join('');

  const toolHtml = `
    <div class="ab-test-tool">
      <div class="ab-tool-toggle" id="abToolToggle"></div>
      <div class="ab-tool-panel" id="abToolPanel">
        <div class="ab-tool-header">
          <div class="ab-tool-title">A/B Test Varyasyon Yöneticisi</div>
          <button class="ab-tool-close" id="abToolClose">×</button>
        </div>
        
        <div class="ab-form-group">
          <label class="ab-form-label">Test Seçin:</label>
          <select class="ab-form-select" id="testSelect">
            ${testOptions}
          </select>
        </div>
        
        <div class="ab-form-group">
          <label class="ab-form-label">Varyasyon Seçin:</label>
          <select class="ab-form-select" id="variationSelect">
            <option value="control" ${firstCurrentVariation === 'control' ? 'selected' : ''}>Control</option>
            <option value="var1" ${firstCurrentVariation === 'var1' ? 'selected' : ''}>Variant 1</option>
            <option value="var2" ${firstCurrentVariation === 'var2' ? 'selected' : ''}>Variant 2</option>
            <option value="var3" ${firstCurrentVariation === 'var3' ? 'selected' : ''}>Variant 3</option>
          </select>
          <div class="ab-current-variation" id="currentVariation">Current: ${firstCurrentValue}</div>
        </div>
        
        <div class="ab-tool-actions">
          <button class="ab-btn ab-btn-primary" id="applyABChanges">Uygula</button>
          <button class="ab-btn ab-btn-secondary" id="refreshABTool">Yenile</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', toolHtml);

  // Add event listeners
  setupABTestToolEvents(abTestCookies);
}

/**
 * Setup event listeners for the A/B test tool
 * @param {Object} abTestCookies - Object containing AB test cookies
 */
function setupABTestToolEvents(abTestCookies) {
  const toggle = document.getElementById('abToolToggle');
  const panel = document.getElementById('abToolPanel');
  const closeBtn = document.getElementById('abToolClose');
  const applyBtn = document.getElementById('applyABChanges');
  const refreshBtn = document.getElementById('refreshABTool');
  const testSelect = document.getElementById('testSelect');
  const variationSelect = document.getElementById('variationSelect');
  const currentVariationDiv = document.getElementById('currentVariation');

  // Update variation dropdown when test changes
  testSelect?.addEventListener('change', () => {
    const selectedCookieName = testSelect.value;
    const currentValue = abTestCookies[selectedCookieName];
    const currentVariation = extractVariation(currentValue);
    
    // Update variation dropdown selection
    variationSelect.value = currentVariation;
    
    // Update current variation display
    currentVariationDiv.textContent = `Current: ${currentValue}`;
  });

  // Toggle panel
  toggle?.addEventListener('click', () => {
    panel?.classList.toggle('active');
  });

  // Close panel
  closeBtn?.addEventListener('click', () => {
    panel?.classList.remove('active');
  });

  // Apply changes
  applyBtn?.addEventListener('click', () => {
    const selectedCookieName = testSelect.value;
    const selectedVariation = variationSelect.value;
    const testId = extractTestId(selectedCookieName);
    
    const newCookieValue = generateCookieValue(testId, selectedVariation);
    const currentValue = abTestCookies[selectedCookieName];
    
    if (newCookieValue !== currentValue) {
      setCookie(selectedCookieName, newCookieValue);
      alert('Değişiklik uygulandı! Yeni varyasyonu görmek için sayfa yeniden yüklenecek.');
      window.location.reload();
    } else {
      alert('Değişiklik algılanmadı.');
    }
  });

  // Refresh tool
  refreshBtn?.addEventListener('click', () => {
    // Remove current tool
    const existingToolContainer = document.querySelector('.ab-test-tool');
    if (existingToolContainer) {
      existingToolContainer.remove();
    }
    
    // Reinitialize
    setTimeout(() => {
      initABTestTool();
    }, 100);
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ab-test-tool')) {
      panel?.classList.remove('active');
    }
  });
}
