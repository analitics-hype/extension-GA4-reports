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
    try {
      if (request.action === 'getReportName') {
        // Only handle GA-specific requests on GA sites
        const hostname = window.location.hostname.toLowerCase();
        const isGAsite = hostname.includes('analytics.google.com') || 
                         hostname.includes('marketingplatform.google.com') ||
                         (hostname.includes('google.com') && window.location.pathname.includes('analytics'));
        
        if (isGAsite) {
          const result = getReportInfo();
          sendResponse(result);
        } else {
          sendResponse({ error: 'Not on Google Analytics site' });
        }
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
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    }
    return true;
  });
} 