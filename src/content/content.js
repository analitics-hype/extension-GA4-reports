import {  watchUrlChanges } from "./modules/url-watcher.js";
import { notifyPageLoaded, setupMessageListener } from "./modules/message-handlers.js";
import { initABTestTool, setupABTestMessageListener } from "./modules/ab-test-tool.js";

// Check if current site is Google Analytics
function isGoogleAnalyticsSite() {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.includes('analytics.google.com') || 
         hostname.includes('marketingplatform.google.com') ||
         (hostname.includes('google.com') && window.location.pathname.includes('analytics'));
}



// URL değişikliklerini izle ve eklentiyi başlat
function initializeExtension() {
  let currentUrl = window.location.href;
  let checkInterval = null;

  // Setup A/B test message listener once (for popup communication)
  setupABTestMessageListener();

  // History API'yi izle
  const pushState = history.pushState;
  history.pushState = function() {
      pushState.apply(history, arguments);
      if (currentUrl !== window.location.href) {
          currentUrl = window.location.href;
          
          // Initialize GA reporting features only on Google Analytics sites
          if (isGoogleAnalyticsSite()) {
            checkInterval = watchUrlChanges(currentUrl, checkInterval);
          }
          
          // Initialize A/B test tool on all sites
          setTimeout(() => {
            initABTestTool();
          }, 2000);
      }
  };

  // popstate eventi için listener ekle
  window.addEventListener('popstate', () => {
      if (currentUrl !== window.location.href) {
          currentUrl = window.location.href;
          
          // Initialize GA reporting features only on Google Analytics sites
          if (isGoogleAnalyticsSite()) {
            checkInterval = watchUrlChanges(currentUrl, checkInterval);
          }
          
          // Initialize A/B test tool on all sites
          setTimeout(() => {
            initABTestTool();
          }, 2000);
      }
  });

  // URL değişikliklerini sürekli kontrol et
  setInterval(() => {
      if (currentUrl !== window.location.href) {
          currentUrl = window.location.href;
          
          // Initialize GA reporting features only on Google Analytics sites
          if (isGoogleAnalyticsSite()) {
            checkInterval = watchUrlChanges(currentUrl, checkInterval);
          }
          
          // Initialize A/B test tool on all sites
          setTimeout(() => {
            initABTestTool();
          }, 2000);
      }
  }, 1000);

  // İlk yüklemede kontrol başlat
  // console.log('İlk URL:', currentUrl);
  
  // Initialize GA reporting features only on Google Analytics sites
  if (isGoogleAnalyticsSite()) {
    checkInterval = watchUrlChanges(currentUrl, checkInterval);
  }

  // Initialize A/B test tool on all sites (runs independently of GA)
  setTimeout(() => {
    initABTestTool();
  }, 2000); // Wait 2 seconds for page to fully load
}

// Eklentiyi başlat
initializeExtension();

// Always set up message listener for extension communication
setupMessageListener();

// GA reporting features initialization (only on Google Analytics sites)
if (isGoogleAnalyticsSite()) {
  // Sayfa yüklendiğinde extension'a hazır olduğunu bildir
  notifyPageLoaded();
}
