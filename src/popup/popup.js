// Stil dosyasını import et
import './popup.css';

// // Popup.js artık boş olabilir çünkü tüm işlevsellik content.js'e taşındı 

// Options sayfası linkini düzenle
document.addEventListener('DOMContentLoaded', () => {
  const optionsLink = document.getElementById('optionsLink');
  if (optionsLink) {
      optionsLink.addEventListener('click', (e) => {
          e.preventDefault();
          // Chrome extensions API'sini kullanarak options sayfasını aç
          chrome.runtime.openOptionsPage();
      });
  }

  // Güvenilirlik oranı ayarlarını yönet
  const confidenceInput = document.getElementById('confidenceLevel');
  if (confidenceInput) {
      // Kayıtlı değeri yükle
      chrome.storage.sync.get(['confidenceLevel'], function(result) {
          if (result.confidenceLevel) {
              confidenceInput.value = result.confidenceLevel;
          }
      });

      // Değer değiştiğinde kaydet
      confidenceInput.addEventListener('change', function() {
          let value = parseFloat(this.value);
          
          // Değer aralığını kontrol et
          if (value < 1) value = 1;
          if (value > 99.9) value = 99.9;
          
          this.value = value;
          
          // Değeri kaydet
          chrome.storage.sync.set({
              confidenceLevel: value
          }, function() {
              // Content script'e değişikliği bildir
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'updateConfidenceLevel',
                      confidenceLevel: value
                  });
              });
          });
      });
  }
}); 