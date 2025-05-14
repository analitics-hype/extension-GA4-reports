/**
 * DOM ile ilgili yardımcı fonksiyonlar
 */

/**
 * Belirli bir elementi bekle
 * @param {string} selector - CSS seçici
 * @param {Function} callback - Element bulunduğunda çağrılacak fonksiyon
 * @param {number} maxAttempts - Maksimum deneme sayısı
 */
export function waitForSelector(selector, callback, maxAttempts = 50) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const element = document.querySelector(selector);
    
    if (element) {
      clearInterval(interval);
      callback(element);
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      console.log(`Element bulunamadı: ${selector}`);
    }
  }, 200);
}

/**
 * Tüm gerekli elementlerin yüklenmesini bekle
 * @param {Function} callback - Tüm elementler bulunduğunda çağrılacak fonksiyon
 */
export function waitForAllElements(callback) {
  
  const requiredSelectors = {
    reportName: '.analysis-header-shared span',
    dateRange: '.primary-date-range-text',
    segments: '#segment_comparison [data-guidedhelpid="concept-chip-list-container-segment-comparison"] .chip-text-content .chip-title',
    kpis: '#value .chip-text-content .chip-title',
    tableValues: '.cells-wrapper .cell text.align-right'
  };

  let loadedElements = {};
  let checkInterval;
  let attempts = 0;
  const maxAttempts = 50;

  function checkElements() {
    attempts++;
    let allFound = true;

    for (const [key, selector] of Object.entries(requiredSelectors)) {
      if (!loadedElements[key]) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          loadedElements[key] = true;
        } else {
          allFound = false;
        }
      }
    }

    if (allFound) {
      clearInterval(checkInterval);
      callback(true);
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.log('Tüm elementler yüklenemedi');
    }
  }

  checkInterval = setInterval(checkElements, 200);
} 