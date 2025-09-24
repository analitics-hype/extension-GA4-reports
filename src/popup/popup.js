// Stil dosyasını import et
import './popup.css';

// // Popup.js artık boş olabilir çünkü tüm işlevsellik content.js'e taşındı 

// Global variables
let currentAbTestCookies = {};

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

  // A/B Test yönetimini başlat
  initABTestManagement();
});

// A/B Test yönetimini başlat
function initABTestManagement() {
  // Content script'den A/B test cookie'lerini al
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'getABTestCookies'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Content script not ready or not applicable page');
          showNoABTestMessage();
          return;
        }
        
        if (response && response.success && Object.keys(response.cookies).length > 0) {
          currentAbTestCookies = response.cookies;
          showABTestManagement(response.cookies);
        } else {
          showNoABTestMessage();
        }
      });
    } else {
      showNoABTestMessage();
    }
  });

  // A/B Test event listener'larını kur
  setupABTestEventListeners();
}

// A/B Test yönetimi UI'ını göster
function showABTestManagement(cookies) {
  const abTestSection = document.getElementById('abTestSection');
  const noAbTestSection = document.getElementById('noAbTestSection');
  
  if (abTestSection && noAbTestSection) {
    abTestSection.style.display = 'block';
    noAbTestSection.style.display = 'none';
    
    populateTestDropdown(cookies);
  }
}

// A/B Test bulunamadı mesajını göster
function showNoABTestMessage() {
  const abTestSection = document.getElementById('abTestSection');
  const noAbTestSection = document.getElementById('noAbTestSection');
  
  if (abTestSection && noAbTestSection) {
    abTestSection.style.display = 'none';
    noAbTestSection.style.display = 'block';
  }
}

// Test dropdown'unu doldur
function populateTestDropdown(cookies) {
  const testSelect = document.getElementById('testSelect');
  if (!testSelect) return;
  
  // Dropdown'u temizle
  testSelect.innerHTML = '';
  
  // Test seçeneklerini ekle
  Object.keys(cookies).forEach(cookieName => {
    const testId = extractTestId(cookieName);
    const option = document.createElement('option');
    option.value = cookieName;
    option.textContent = testId;
    testSelect.appendChild(option);
  });
  
  // İlk test'i seç ve variation'ı güncelle
  if (testSelect.options.length > 0) {
    testSelect.selectedIndex = 0;
    updateVariationDropdown();
  }
}

// Variation dropdown'unu güncelle
function updateVariationDropdown() {
  const testSelect = document.getElementById('testSelect');
  const variationSelect = document.getElementById('variationSelect');
  const currentVariationDiv = document.getElementById('currentVariation');
  
  if (!testSelect || !variationSelect || !currentVariationDiv) return;
  
  const selectedCookieName = testSelect.value;
  const currentValue = currentAbTestCookies[selectedCookieName];
  
  if (currentValue) {
    const currentVariation = extractVariation(currentValue);
    
    // Variation dropdown'unda seçili yap
    variationSelect.value = currentVariation;
    
    // Mevcut variation'ı göster
    currentVariationDiv.textContent = `Current: ${currentValue}`;
  }
}

// A/B Test event listener'larını kur
function setupABTestEventListeners() {
  const testSelect = document.getElementById('testSelect');
  const applyBtn = document.getElementById('applyABChanges');
  const refreshBtn = document.getElementById('refreshABTool');
  
  // Test değiştiğinde variation'ı güncelle
  testSelect?.addEventListener('change', updateVariationDropdown);
  
  // Apply butonu
  applyBtn?.addEventListener('click', applyABTestChanges);
  
  // Refresh butonu
  refreshBtn?.addEventListener('click', refreshABTestTool);
}

// A/B test değişikliklerini uygula
function applyABTestChanges() {
  const testSelect = document.getElementById('testSelect');
  const variationSelect = document.getElementById('variationSelect');
  
  if (!testSelect || !variationSelect) return;
  
  const selectedCookieName = testSelect.value;
  const selectedVariation = variationSelect.value;
  const testId = extractTestId(selectedCookieName);
  
  const newCookieValue = generateCookieValue(testId, selectedVariation);
  const currentValue = currentAbTestCookies[selectedCookieName];
  
  if (newCookieValue !== currentValue) {
    // Content script'e cookie değişikliği gönder
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setABTestCookie',
        cookieName: selectedCookieName,
        cookieValue: newCookieValue
      }, function(response) {
        if (response && response.success) {
          // Popup'u kapat ve sayfayı yenile
          if (confirm('Değişiklik uygulandı! Yeni varyasyonu görmek için sayfa yeniden yüklenecek.')) {
            chrome.tabs.reload(tabs[0].id);
            window.close();
          }
        } else {
          alert('Değişiklik uygulanamadı. Lütfen tekrar deneyin.');
        }
      });
    });
  } else {
    alert('Değişiklik algılanmadı.');
  }
}

// A/B test tool'u yenile
function refreshABTestTool() {
  initABTestManagement();
}

// Yardımcı fonksiyonlar (ab-test-tool.js'den kopyalandı)
function extractTestId(cookieName) {
  return cookieName.replace('_gtm_exp_', '');
}

function extractVariation(cookieValue) {
  const parts = cookieValue.split('_');
  return parts[parts.length - 1] || 'control';
}

function generateCookieValue(testId, variation) {
  return `gtm_ab_${testId}_${variation}`;
} 