/**
 * URL değişikliklerini izleme ve eklentiyi başlatma ile ilgili fonksiyonlar
 */

import { waitForSelector } from "./dom-helpers.js";
import { injectAnalyzeButton } from "./ui-components.js";

/**
 * Butonları ve ilgili elementleri temizle
 */
export function cleanupExtension(checkInterval) {
  // Buton container'ı kaldır
  const buttonContainer = document.querySelector('.ga4-abtest-buttons');
  if (buttonContainer) {
    buttonContainer.remove();
  }

  // Popup ve overlay'i kaldır
  const resultsPopup = document.getElementById('ga4-abtest-results');
  const overlay = document.getElementById('ga4-abtest-overlay');
  if (resultsPopup) resultsPopup.remove();
  if (overlay) overlay.remove();

  // Varsa notification'ı kaldır
  const notification = document.querySelector('.ga4-notification');
  if (notification) notification.remove();

  // Interval'i temizle
  if (checkInterval) {
    clearInterval(checkInterval);
    return null;
  }
  
  return checkInterval;
}

/**
 * URL değişikliklerini izle
 * @param {string} currentUrl - Mevcut URL
 * @param {number|null} checkInterval - Kontrol interval'i
 * @returns {number|null} - Yeni kontrol interval'i
 */
export function watchUrlChanges(currentUrl, checkInterval) {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  console.log('URL değişti:', window.location.href);

  // Önce mevcut butonları ve elementleri temizle
  cleanupExtension(checkInterval);

  // Analysis panels elementini kontrol et
  function checkAnalysisPanels() {
    const analysisPanel = document.querySelector('.analysis-panels');
    if (analysisPanel) {
      console.log('Analysis panel bulundu, eklenti başlatılıyor...');
      clearInterval(checkInterval);
      waitForSelector(".gmp-header-spacer", () => {
        injectAnalyzeButton();
      });
    }
  }

  // 5 saniye boyunca her 500ms'de bir kontrol et
  let attempts = 0;
  const maxAttempts = 30; // 15 saniye = 30 deneme * 500ms
  
  checkInterval = setInterval(() => {
    attempts++;
    if (attempts >= maxAttempts) {
      console.log('Analysis panel bulunamadı, kontrol sonlandırılıyor');
      clearInterval(checkInterval);
      return;
    }
    checkAnalysisPanels();
  }, 500);
  
  return checkInterval;
} 