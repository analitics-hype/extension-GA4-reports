import {  watchUrlChanges } from "./modules/url-watcher.js";
import { notifyPageLoaded, setupMessageListener } from "./modules/message-handlers.js";



// URL değişikliklerini izle ve eklentiyi başlat
function initializeExtension() {
  let currentUrl = window.location.href;
  let checkInterval = null;

  // History API'yi izle
  const pushState = history.pushState;
  history.pushState = function() {
      pushState.apply(history, arguments);
      if (currentUrl !== window.location.href) {
          currentUrl = window.location.href;
          checkInterval = watchUrlChanges(currentUrl, checkInterval);
      }
  };

  // popstate eventi için listener ekle
  window.addEventListener('popstate', () => {
      if (currentUrl !== window.location.href) {
          currentUrl = window.location.href;
          checkInterval = watchUrlChanges(currentUrl, checkInterval);
      }
  });

  // URL değişikliklerini sürekli kontrol et
  setInterval(() => {
      if (currentUrl !== window.location.href) {
          currentUrl = window.location.href;
          checkInterval = watchUrlChanges(currentUrl, checkInterval);
      }
  }, 1000);

  // İlk yüklemede kontrol başlat
  console.log('İlk URL:', currentUrl);
  checkInterval = watchUrlChanges(currentUrl, checkInterval);
}

// Eklentiyi başlat
initializeExtension();

// Sayfa yüklendiğinde extension'a hazır olduğunu bildir
notifyPageLoaded();

// Extension'dan gelen mesajları dinle
setupMessageListener();
