/**
 * Event listener'lar
 */

import { formatData, recalculateResults } from "./ui-components.js";
import { exportToCSV } from "./ui-components.js";
import { showNotification } from "./ui-components.js";
import { sendReportToBackend } from "./api-service.js";
import html2canvas from 'html2canvas';

/**
 * Sonuç popup'ı için event listener'ları ekle
 * @param {HTMLElement} resultDiv - Sonuç div'i
 * @param {Object} data - Gösterilecek veriler
 * @param {string} type - Gösterim tipi ('popup' veya 'listing')
 */
export function setupResultEventListeners(resultDiv, data, type = 'popup') {
  const popup = resultDiv.querySelector('.abtest-popup');
  
  // Veri değişikliklerini dinle ve yeniden hesapla
  const tableInputs = popup.querySelectorAll('.table-input');
  tableInputs.forEach(input => {
    input.addEventListener('change', () => {
      recalculateResults(popup, data).catch(error => {
        console.error('Sonuçlar yeniden hesaplanırken hata:', error);
      });
    });
  });

  // İlk hesaplamayı yap
  recalculateResults(popup, data).catch(error => {
    console.error('İlk hesaplama yapılırken hata:', error);
  });

  // Tarih dropdown ve input işlevselliği
  setupDateDropdowns();
  
  // CSV indirme
  popup.querySelector('.csv-btn').addEventListener('click', () => {
    exportToCSV(data);
  });

  // Görüntüyü kopyalama
  popup.querySelector('.copy-btn').addEventListener('click', () => {
    copyResultsAsImage(popup, data, type);
  });

  // Kapatma butonu
  popup.querySelector('.close-btn').addEventListener('click', () => {
    document.getElementById('ga4-abtest-overlay').style.display = 'none';
    document.getElementById('ga4-abtest-results').style.display = 'none';
  });
  
  // Listing tipi için metrik tıklama işlevselliğini ekle
  if (type === 'listing') {
    setupMetricClickListeners(resultDiv, data);
  }
}

/**
 * Tarih dropdown'ları için event listener'ları ekle
 */
function setupDateDropdowns() {
  document.querySelectorAll('.end-date-select').forEach(dropdown => {
    const input = dropdown.nextElementSibling;
    
    dropdown.addEventListener('change', (e) => {
      if (e.target.value === 'edit') {
        dropdown.style.display = 'none';
        input.style.display = 'block';
        input.focus();
      }
    });

    input.addEventListener('blur', () => {
      dropdown.style.display = 'block';
      input.style.display = 'none';
      dropdown.querySelector('option[value="end_date"]').textContent = input.value;
      dropdown.value = 'end_date';
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    });
  });
}

/**
 * Sonuçları görüntü olarak kopyala
 * @param {HTMLElement} popup - Popup elementi
 * @param {Object} data - Gösterilecek veriler
 */
async function copyResultsAsImage(popup, data, type = 'extension') {
  const lastAnalysisData = sessionStorage.getItem('lastAnalysisData');

  if (lastAnalysisData) {
    data = await formatData(JSON.parse(lastAnalysisData));
  }

  // UI elementlerini screenshot için hazırla
  document.querySelector('#conclusion-input-copy').innerHTML = document.querySelector('#conclusion-input').value;
  document.querySelector('#conclusion-input-copy').style.display = 'block';
  document.querySelector('#conclusion-input').style.display = 'none';
  document.querySelector('.action-buttons').style.display = 'none';
  document.querySelector('.select-arrow').style.display = 'none';
  
  // Monthly ve Yearly sütunlarını gizle (7. ve 8. sütunlar)
  const popupElement = document.querySelector('.abtest-popup');
  const monthlyHeaders = popupElement.querySelectorAll('th:nth-child(7)'); // 7. sütun: Monthly
  const yearlyHeaders = popupElement.querySelectorAll('th:nth-child(8)'); // 8. sütun: Yearly
  const monthlyCells = popupElement.querySelectorAll('td:nth-child(7)'); // 7. sütun: Monthly
  const yearlyCells = popupElement.querySelectorAll('td:nth-child(8)'); // 8. sütun: Yearly
  
  // Gizle
  monthlyHeaders.forEach(header => header.style.display = 'none');
  yearlyHeaders.forEach(header => header.style.display = 'none');
  monthlyCells.forEach(cell => cell.style.display = 'none');
  yearlyCells.forEach(cell => cell.style.display = 'none');

  // html2canvas is now available globally
  html2canvas(popupElement, {
    backgroundColor: '#ffffff',
    scale: 2, // Better quality for retina displays
    logging: false,
    useCORS: true
  }).then(canvas => {
    canvas.toBlob(blob => {
      navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]).then(() => {
        showNotification('Görüntü panoya kopyalandı', 'success');
        // Raporu backend'e gönder
        
        if (type === 'popup') {
          sendReportToBackend(data);
        }
      }).catch(err => {
        showNotification('Kopyalama başarısız: ' + err.message, 'error');
      });
    });
  }).catch(err => {
    showNotification('Görüntü oluşturulurken hata oluştu: ' + err.message, 'error');
  }).finally(() => {
    // UI elementlerini eski haline getir
    document.querySelector('.action-buttons').style.display = 'flex';
    document.querySelector('.select-arrow').style.display = 'flex';
    document.querySelector('#conclusion-input').style.display = 'block';
    document.querySelector('#conclusion-input-copy').style.display = 'none';
    
    // Monthly ve Yearly sütunlarını tekrar göster
    monthlyHeaders.forEach(header => header.style.display = '');
    yearlyHeaders.forEach(header => header.style.display = '');
    monthlyCells.forEach(cell => cell.style.display = '');
    yearlyCells.forEach(cell => cell.style.display = '');
  });
}

/**
 * Metrik tıklama işlevselliğini ekle
 * @param {HTMLElement} resultDiv - Sonuç div'i
 * @param {Object} data - Gösterilecek veriler
 */
function setupMetricClickListeners(resultDiv, data) {
  // Metrik elementlerini seç
  const metricElements = resultDiv.querySelectorAll('.listing-metric-name');
  
  // Tıklama olaylarını ekle
  metricElements.forEach((metricEl, index) => {
    metricEl.addEventListener('click', () => {
      // Aktif sınıfını güncelle
      metricElements.forEach(el => {
        el.classList.remove('active');
      });
      metricEl.classList.add('active');
      
      // Orijinal veri varsa ve birden fazla analiz içeriyorsa
      if (data && data.analysis && Array.isArray(data.analysis) && data.analysis.length > index) {
        // Seçilen analiz verilerini hazırla
        const selectedData = {
          ...data,
          analysis: data.analysis[index],
          resultStatus: data.analysis[index].resultStatus,
          sessionTab: data.analysis[index].control.tabName,
          conversionTab: data.analysis[index].name
        };
        
        // Tabloyu güncelle
        updateTableWithSelectedData(resultDiv, selectedData);
      } else if (data && !Array.isArray(data.analysis)) {
        // Tek bir analiz varsa, indeksi kontrol et
        if (index === 0) {
          // Zaten gösterilen veri, bir şey yapma
          return;
        }
      }
    });
  });
}

/**
 * Tabloyu seçilen verilerle güncelle
 * @param {HTMLElement} resultDiv - Sonuç div'i
 * @param {Object} selectedData - Seçilen veri
 */
function updateTableWithSelectedData(resultDiv, selectedData) {
  const popup = resultDiv.querySelector('.abtest-popup');
  
  // Tablo başlıklarını güncelle
  const sessionTabInput = popup.querySelector('.header-input:nth-of-type(1)');
  const conversionTabInput = popup.querySelector('.header-input:nth-of-type(2)');
  
  if (sessionTabInput) {
    sessionTabInput.value = selectedData.sessionTab || 'Users';
  }
  
  if (conversionTabInput) {
    conversionTabInput.value = selectedData.conversionTab || 'Purchase';
  }
  
  // Kontrol değerlerini güncelle
  const controlSessions = popup.querySelector('[data-type="control-users"]');
  const controlConversions = popup.querySelector('[data-type="control-conversions"]');
  
  if (controlSessions && selectedData.analysis.control) {
    controlSessions.value = selectedData.analysis.control.sessions;
  }
  
  if (controlConversions && selectedData.analysis.control) {
    controlConversions.value = selectedData.analysis.control.conversions;
  }
  
  // Eski formatla uyumluluk için tek varyant kontrolü
  if (selectedData.analysis.variant) {
    const variantSessions = popup.querySelector('[data-type="variant-users"]');
    const variantConversions = popup.querySelector('[data-type="variant-conversions"]');
    
    if (variantSessions) {
      variantSessions.value = selectedData.analysis.variant.sessions;
    }
    
    if (variantConversions) {
      variantConversions.value = selectedData.analysis.variant.conversions;
    }
    
    // CR değerlerini güncelle
    const controlCR = popup.querySelector('.control-row td:nth-child(4)');
    const variantCR = popup.querySelector('.variant-row td:nth-child(4)');
    
    if (controlCR) {
      controlCR.textContent = `${selectedData.analysis.control.cr.toFixed(2)}%`;
    }
    
    if (variantCR) {
      variantCR.textContent = `${selectedData.analysis.variant.cr.toFixed(2)}%`;
    }
    
    // Uplift değerini güncelle
    const upliftCell = popup.querySelector('.variant-row td:nth-child(5)');
    if (upliftCell) {
      upliftCell.textContent = `${selectedData.analysis.improvement.toFixed(2)}%`;
      upliftCell.className = selectedData.analysis.improvement >= 0 ? 'metric-change positive' : 'metric-change negative';
    }
    
    // Significance değerlerini güncelle
    const controlSignificance = popup.querySelector('.control-row td:last-child');
    const variantSignificance = popup.querySelector('.variant-row td:last-child');
    
    if (controlSignificance && selectedData.analysis.stats) {
      controlSignificance.textContent = `${selectedData.analysis.stats.controlProbability}%`;
    }
    
    if (variantSignificance && selectedData.analysis.stats) {
      variantSignificance.textContent = `${selectedData.analysis.stats.variantProbability}%`;
    }
  } 
  // Yeni format (çoklu varyant)
  else if (selectedData.analysis.variants && Array.isArray(selectedData.analysis.variants)) {
    // Varyantları güncelle
    selectedData.analysis.variants.forEach((variant, index) => {
      const variantRow = popup.querySelector(`[data-variant-index="${index}"]`);
      if (!variantRow) return;
      
      // Input değerlerini güncelle
      const variantUsers = variantRow.querySelector(`[data-type="variant-users-${index}"]`);
      const variantConversions = variantRow.querySelector(`[data-type="variant-conversions-${index}"]`);
      
      if (variantUsers) {
        variantUsers.value = variant.sessions;
      }
      
      if (variantConversions) {
        variantConversions.value = variant.conversions;
      }
      
      // CR ve Uplift değerlerini güncelle
      const variantCR = variantRow.querySelector('td:nth-child(4)');
      const upliftCell = variantRow.querySelector('td:nth-child(5)');
      const variantSignificance = variantRow.querySelector('td:last-child');
      
      if (variantCR) {
        variantCR.textContent = `${variant.cr.toFixed(2)}%`;
      }
      
      if (upliftCell) {
        upliftCell.textContent = `${variant.improvement.toFixed(2)}%`;
        upliftCell.className = variant.improvement >= 0 ? 'metric-change positive' : 'metric-change negative';
      }
      
      if (variantSignificance && variant.stats) {
        variantSignificance.textContent = `${variant.stats.variantProbability}%`;
      }
    });
    
    // Kontrol CR ve significance değerlerini güncelle
    const controlCR = popup.querySelector('.control-row td:nth-child(4)');
    const controlSignificance = popup.querySelector('.control-row td:last-child');
    
    if (controlCR) {
      controlCR.textContent = `${selectedData.analysis.control.cr.toFixed(2)}%`;
    }
    
    if (controlSignificance && selectedData.analysis.variants[0]?.stats) {
      controlSignificance.textContent = `${selectedData.analysis.variants[0].stats.controlProbability}%`;
    }
  }
  
  // Toplam kullanıcı sayısını güncelle
  const usersText = popup.querySelector('.users-text');
  if (usersText) {
    let totalUsers = selectedData.analysis.control.sessions;
    
    if (selectedData.analysis.variant) {
      totalUsers += selectedData.analysis.variant.sessions;
    } else if (selectedData.analysis.variants) {
      selectedData.analysis.variants.forEach(variant => {
        totalUsers += variant.sessions;
      });
    }
    
    usersText.textContent = totalUsers.toLocaleString();
  }
  
  // Sonuç durumunu güncelle
  const resultElement = popup.querySelector('.conclusion-result');
  const resultDescElement = popup.querySelector('.conclusion-result-desc');
  
  if (resultElement && resultDescElement) {
    // Eski sınıfları kaldır
    resultElement.classList.remove('kazandı', 'kaybetti', 'etkisiz');
    // Yeni sınıfı ekle
    const resultStatus = selectedData.resultStatus ? selectedData.resultStatus.toLowerCase() : 'etkisiz';
    resultElement.classList.add(resultStatus);
    // Sonuç metnini güncelle
    resultDescElement.textContent = selectedData.resultStatus || 'Etkisiz';
  }
  
  // Yeniden hesaplama için veriyi güncelle
  recalculateResults(popup, selectedData).catch(error => {
    console.error('Sonuçlar yeniden hesaplanırken hata:', error);
  });
} 