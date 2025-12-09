/**
 * Event listener'lar
 */

import { formatData, recalculateResults } from "./ui-components.js";
import { exportToCSV } from "./ui-components.js";
import { showNotification } from "./ui-components.js";
import { sendReportToBackend, getAIComment } from "./api-service.js";
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

  // AI ile yorum yapma
  popup.querySelector('.ai-btn').addEventListener('click', async (event) => {
    // console.log('AI yorum butonuna tıklandı');
    
    const aiBtn = event.target.closest('.ai-btn');
    
    // Hemen loading state'e geç
    const originalContent = aiBtn.innerHTML;
    aiBtn.innerHTML = `
      <div class="copy-loading">
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
    aiBtn.disabled = true;
    aiBtn.style.pointerEvents = 'none';
    aiBtn.classList.add('copy-loading-active');
    
    // console.log('AI Loading state aktif, AI yorum işlemi başlatılıyor');
    
    // DOM güncellenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      // Raporu AI'ya gönder
      if (type === 'popup') {
        // Önce formatData ile eksik alanları doldur
        const formattedData = await formatData(data);
        
        const aiComment = await getAIComment(formattedData);
        
        // AI yorumunu business impact alanına yaz
        const conclusionInput = document.querySelector('#conclusion-input');
        if (conclusionInput && aiComment) {
          conclusionInput.value = aiComment;
          // Textarea'ya focus ver ve değişikliği tetikle
          conclusionInput.focus();
          conclusionInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // console.log('AI yorum işlemi başarıyla tamamlandı');
      }
    } catch (error) {
      console.error('AI yorum işlemi hatası:', error);
    } finally {
      // Loading'i kapat
      // console.log('AI Loading state kapatılıyor');
      aiBtn.innerHTML = originalContent;
      aiBtn.disabled = false;
      aiBtn.style.pointerEvents = '';
      aiBtn.classList.remove('copy-loading-active');
    }
  });

  // Raporu kaydetme
  popup.querySelector('.save-btn').addEventListener('click', async (event) => {
    // console.log('Kaydet butonuna tıklandı');
    
    const saveBtn = event.target.closest('.save-btn');
    
    // Hemen loading state'e geç
    const originalContent = saveBtn.innerHTML;
    saveBtn.innerHTML = `
      <div class="copy-loading">
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
    saveBtn.disabled = true;
    saveBtn.style.pointerEvents = 'none';
    saveBtn.classList.add('copy-loading-active');
    
    // console.log('Loading state aktif, kaydetme işlemi başlatılıyor');
    
    // DOM güncellenmesini bekle (loading efektinin görünmesi için)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      // Raporu backend'e gönder
      if (type === 'popup') {
        // Güncel bussinessImpact değerini al
        const currentBussinessImpact = document.querySelector('#conclusion-input').value || "";
        
        // Önce formatData ile eksik alanları doldur
        const dataWithBussinessImpact = {
          ...data,
          bussinessImpact: currentBussinessImpact
        };
        
        const formattedData = await formatData(dataWithBussinessImpact);
        
        await sendReportToBackend(formattedData);
        // console.log('Kaydetme işlemi başarıyla tamamlandı');
      }
    } catch (error) {
      console.error('Kaydetme işlemi hatası:', error);
    } finally {
      // Loading'i kapat
      // console.log('Loading state kapatılıyor');
      saveBtn.innerHTML = originalContent;
      saveBtn.disabled = false;
      saveBtn.style.pointerEvents = '';
      saveBtn.classList.remove('copy-loading-active');
    }
  });

  // Görüntüyü kopyalama
  popup.querySelector('.copy-btn').addEventListener('click', async (event) => {
    // console.log('Kopyala butonuna tıklandı - Loading başlatılıyor');
    
    const copyBtn = event.target.closest('.copy-btn');
    
    // Hemen loading state'e geç
    const originalContent = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <div class="copy-loading">
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
    copyBtn.disabled = true;
    copyBtn.style.pointerEvents = 'none';
    copyBtn.classList.add('copy-loading-active');
    
    // console.log('Loading state aktif, kopyalama işlemi başlatılıyor');
    
    // DOM güncellenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      await copyResultsAsImage(popup, data, type);
      // console.log('Kopyalama işlemi tamamlandı');
    } catch (error) {
      console.error('Kopyalama işlemi hatası:', error);
    } finally {
      // Loading'i kapat
      // console.log('Loading state kapatılıyor');
      copyBtn.innerHTML = originalContent;
      copyBtn.disabled = false;
      copyBtn.style.pointerEvents = '';
      copyBtn.classList.remove('copy-loading-active');
    }
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
  return new Promise(async (resolve, reject) => {
    try {
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
      
      // Loading spinner'ları da gizle (screenshot için)
      const loadingElements = document.querySelectorAll('.copy-loading, .loading-spinner');
      loadingElements.forEach(el => el.style.display = 'none');
      
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
            resolve();
          }).catch(err => {
            showNotification('Kopyalama başarısız: ' + err.message, 'error');
            reject(err);
          });
        });
      }).catch(err => {
        showNotification('Görüntü oluşturulurken hata oluştu: ' + err.message, 'error');
        reject(err);
      }).finally(() => {
        // UI elementlerini eski haline getir
        document.querySelector('.action-buttons').style.display = 'flex';
        document.querySelector('.select-arrow').style.display = 'flex';
        document.querySelector('#conclusion-input').style.display = 'block';
        document.querySelector('#conclusion-input-copy').style.display = 'none';
        
        // Loading spinner'ları tekrar göster
        loadingElements.forEach(el => el.style.display = '');
        
        // Monthly ve Yearly sütunlarını tekrar göster
        monthlyHeaders.forEach(header => header.style.display = '');
        yearlyHeaders.forEach(header => header.style.display = '');
        monthlyCells.forEach(cell => cell.style.display = '');
        yearlyCells.forEach(cell => cell.style.display = '');
      });
    } catch (error) {
      reject(error);
    }
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
    
    if (controlSignificance) {
      controlSignificance.textContent = '-'; // Control significance gösterilmiyor
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
    
    if (controlSignificance) {
      controlSignificance.textContent = '-'; // Control significance gösterilmiyor
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