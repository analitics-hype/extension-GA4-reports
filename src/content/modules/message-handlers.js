/**
 * Chrome extension mesaj işleyicileri
 */

import { getReportInfo } from "./data-extraction.js";
import { recalculateResults } from "./ui-components.js";

/**
 * Sayfa yüklendiğinde extension'a hazır olduğunu bildir
 */
export function notifyPageLoaded() {
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href
  });
}

/**
 * Extension'dan gelen mesajları dinle
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getReportName') {
      const result = getReportInfo();
      sendResponse(result);
    } else if (request.action === 'updateConfidenceLevel') {
      // Sonuçları yeniden hesapla ve göster
      const resultDiv = document.querySelector('.ab-test-results');
      if (resultDiv && window.lastAnalysisData) {
        const popup = resultDiv.querySelector('.ab-test-popup');
        if (popup) {
          recalculateResults(popup, window.lastAnalysisData).catch(error => {
            console.error('Güvenilirlik oranı güncellenirken hata:', error);
          });
        }
      }
    }
    return true;
  });
} 