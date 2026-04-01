import { getReportInfo } from './data-extraction.js';
import { checkKPIDataAndUpdateButton, injectButtonStyles, prepareAnalysisData, prepareDirectAnalysisData, saveKPIData, saveTopaPeriodData, getToplaPeriods, deleteTopaPeriod, clearTopaPeriodConversion, clearToplaPeriods, validateToplaPeriods, prepareToplaAnalysisData, parseDateRange } from './data-processing.js';
import { formatDateTurkish, parseTurkishDate } from './date-utils.js';
import { waitForAllElements } from './dom-helpers.js';
import { setupResultEventListeners } from './event-handlers.js';
import { analyzeABTest, calculateSignificance, calculateTestDuration, calculateBinaryWinnerProbabilities, calculateExtraTransactions } from './statistics.js';
import { getResultsTemplate } from './templates.js';
/**
 * UI bileşenleri ile ilgili fonksiyonlar - A/B Test analiz araçları için
 */


/**
 * Sonuçları yeniden hesapla ve UI'ı güncelle
 * @param {HTMLElement} popup - Popup elementi
 * @param {Object} data - Hesaplanacak veriler
 * @returns {Promise<void>}
 */
export async function recalculateResults(popup, data) {
  // Eski format (tek varyant) için geri uyumluluk
  if (data.analysis.variant && !data.analysis.variants) {
    await recalculateSingleVariant(popup, data);
    return;
  }
  
  // Çoklu varyant formatı
  if (data.analysis.variants && Array.isArray(data.analysis.variants)) {
    // Kontrol grubu değerlerini al
    const controlUsers = parseInt(popup.querySelector('[data-type="control-users"]').value) || 0;
    const controlConversions = parseInt(popup.querySelector('[data-type="control-conversions"]').value) || 0;
    
    // Kontrol rate hesapla
    const controlCR = (controlUsers > 0) ? (controlConversions / controlUsers) * 100 : 0;
    
    // Güvenilirlik seviyesini al
    const confidenceLevel = await new Promise(resolve => {
      chrome.storage.sync.get(['confidenceLevel'], function(result) {
        resolve(result.confidenceLevel || 95);
      });
    });
    
    // Control satırını güncelle
    popup.querySelector('.control-row td:nth-child(4)').textContent = `${controlCR.toFixed(2)}%`;
    
    // Binary winner probabilities hesapla
    const updatedAnalysis = {
      ...data.analysis,
      control: {
        ...data.analysis.control,
        sessions: controlUsers,
        conversions: controlConversions,
        cr: controlCR
      }
    };
    
    // Tüm varyantları güncelle
    for (let i = 0; i < data.analysis.variants.length; i++) {
      const variantRow = popup.querySelector(`[data-variant-index="${i}"]`);
      if (!variantRow) continue;
      
      // Varyant değerlerini al
      const variantUsers = parseInt(variantRow.querySelector(`[data-type="variant-users-${i}"]`).value) || 0;
      const variantConversions = parseInt(variantRow.querySelector(`[data-type="variant-conversions-${i}"]`).value) || 0;
      
      // CR ve Uplift hesapla
      const variantCR = (variantUsers > 0) ? (variantConversions / variantUsers) * 100 : 0;
      const improvement = (controlCR > 0) ? ((variantCR - controlCR) / controlCR) * 100 : 0;
      
      // İstatistiksel anlamlılığı hesapla
      const stats = await calculateSignificance(controlUsers, controlConversions, variantUsers, variantConversions);
      
      // Extra transactions hesapla
      const extraTransactions = calculateExtraTransactions(
        controlConversions,
        controlUsers,
        variantConversions,
        variantUsers,
        1000, // Default daily traffic
        0.5,  // Default traffic split (50%)
        data.testDuration || null // Test duration from data
      );

      // UI'yı güncelle
      variantRow.querySelector('td:nth-child(4)').textContent = `${variantCR.toFixed(2)}%`;
      const upliftCell = variantRow.querySelector('td:nth-child(5)');
      upliftCell.textContent = `${improvement.toFixed(2)}%`;
      upliftCell.className = improvement >= 0 ? 'metric-change positive' : 'metric-change negative';
      variantRow.querySelector('td:nth-child(6)').textContent = `${stats.variantProbability.toFixed(1)}%`;
      
      // Monthly ve Yearly sütunlarını güncelle
      const monthlyCell = variantRow.querySelector('td:nth-child(7)');
      if (monthlyCell) {
        monthlyCell.textContent = Math.round(extraTransactions.monthlyExtraTransactions).toLocaleString();
        monthlyCell.className = extraTransactions.monthlyExtraTransactions >= 0 ? 'metric-change positive' : 'metric-change negative';
      }
      
      const yearlyCell = variantRow.querySelector('td:nth-child(8)');
      if (yearlyCell) {
        yearlyCell.textContent = Math.round(extraTransactions.yearlyExtraTransactions).toLocaleString();
        yearlyCell.className = extraTransactions.yearlyExtraTransactions >= 0 ? 'metric-change positive' : 'metric-change negative';
      }
      
      // Veri güncelle
      data.analysis.variants[i] = {
        ...data.analysis.variants[i],
        sessions: variantUsers,
        conversions: variantConversions,
        cr: variantCR,
        improvement: improvement,
        stats: stats
      };
    }
    
    // Kontrol verisini güncelle
    data.analysis.control = {
      ...data.analysis.control,
      sessions: controlUsers,
      conversions: controlConversions,
      cr: controlCR
    };
    
    // Control significance gösterilmiyor, sadece "-" göster
    const controlSignifCell = popup.querySelector('.control-row td:nth-child(6)');
    if (controlSignifCell) {
      controlSignifCell.textContent = '-';
    }
    
    // Toplam kullanıcı sayısını güncelle
    let totalUsers = controlUsers;
    data.analysis.variants.forEach(variant => {
      totalUsers += variant.sessions;
    });
    popup.querySelector('.users-text').textContent = totalUsers.toLocaleString();
    
    // Sonuç durumunu güncelle
    const resultElement = popup.querySelector('.conclusion-result');
    const resultDescElement = popup.querySelector('.conclusion-result-desc');
    
    // Genel sonuç durumunu belirle
    let resultStatus = '';
    const winningVariants = data.analysis.variants.filter(v => v.stats.variantProbability >= confidenceLevel);
    
    if (winningVariants.length > 0) {
      resultStatus = 'kazandı';
    } else {
      const losingVariants = data.analysis.variants.filter(v => v.stats.controlProbability >= confidenceLevel);
      if (losingVariants.length === data.analysis.variants.length) {
        resultStatus = 'kaybetti';
      } else {
        resultStatus = 'etkisiz';
      }
    }
    
    // Eski sınıfları kaldır
    resultElement.classList.remove('kazandı', 'kaybetti', 'etkisiz');
    // Yeni sınıfı ekle
    resultElement.classList.add(resultStatus);
    // Sonuç metnini güncelle
    resultDescElement.textContent = resultStatus.charAt(0).toUpperCase() + resultStatus.slice(1);
    
    data.bussinessImpact = document.querySelector('#conclusion-input').value || "";
    
    sessionStorage.setItem('lastAnalysisData', JSON.stringify(data));
  }
}

/**
 * Tek varyant için sonuçları yeniden hesapla (geriye dönük uyumluluk için)
 * @param {HTMLElement} popup - Popup elementi
 * @param {Object} data - Hesaplanacak veriler
 * @returns {Promise<void>}
 */
async function recalculateSingleVariant(popup, data) {
  // Input değerlerini al
  const controlUsers = parseInt(popup.querySelector('[data-type="control-users"]').value) || 0;
  const controlConversions = parseInt(popup.querySelector('[data-type="control-conversions"]').value) || 0;
  const variantUsers = parseInt(popup.querySelector('[data-type="variant-users"]').value) || 0;
  const variantConversions = parseInt(popup.querySelector('[data-type="variant-conversions"]').value) || 0;

  // Conversion rate'leri hesapla
  const controlCR = (controlUsers > 0) ? (controlConversions / controlUsers) * 100 : 0;
  const variantCR = (variantUsers > 0) ? (variantConversions / variantUsers) * 100 : 0;

  // Uplift hesapla
  const improvement = (controlCR > 0) ? ((variantCR - controlCR) / controlCR) * 100 : 0;

  // İstatistiksel anlamlılığı hesapla
  const stats = await calculateSignificance(controlUsers, controlConversions, variantUsers, variantConversions);

  // Extra transactions hesapla
  const extraTransactions = calculateExtraTransactions(
    controlConversions,
    controlUsers,
    variantConversions,
    variantUsers,
    1000, // Default daily traffic
    0.5,  // Default traffic split (50%)
    data.testDuration || null // Test duration from data
  );

  // Güvenilirlik seviyesini al
  const confidenceLevel = await new Promise(resolve => {
    chrome.storage.sync.get(['confidenceLevel'], function(result) {
      resolve(result.confidenceLevel || 95);
    });
  });

  // Sonuç durumunu belirle
  let resultStatus = '';
  if (stats.variantProbability >= confidenceLevel) {
    resultStatus = 'kazandı';
  } else if (stats.controlProbability >= confidenceLevel) {
    resultStatus = 'kaybetti';
  } else {
    resultStatus = 'etkisiz';
  }

  // Değerleri güncelle
  popup.querySelector('.control-row td:nth-child(4)').textContent = `${controlCR.toFixed(2)}%`;
  popup.querySelector('.variant-row td:nth-child(4)').textContent = `${variantCR.toFixed(2)}%`;
  
  const upliftCell = popup.querySelector('.variant-row td:nth-child(5)');
  upliftCell.textContent = `${improvement.toFixed(2)}%`;
  upliftCell.className = improvement >= 0 ? 'metric-change positive' : 'metric-change negative';

  // Significance sütunları (6. sütun)
  popup.querySelector('.control-row td:nth-child(6)').textContent = '-'; // Control significance gösterilmiyor
  popup.querySelector('.variant-row td:nth-child(6)').textContent = `${stats.variantProbability.toFixed(1)}%`;
  
  // Monthly ve Yearly sütunları (7. ve 8. sütun)
  const variantMonthlyCell = popup.querySelector('.variant-row td:nth-child(7)');
  if (variantMonthlyCell) {
    variantMonthlyCell.textContent = Math.round(extraTransactions.monthlyExtraTransactions).toLocaleString();
    variantMonthlyCell.className = extraTransactions.monthlyExtraTransactions >= 0 ? 'metric-change positive' : 'metric-change negative';
  }
  
  const variantYearlyCell = popup.querySelector('.variant-row td:nth-child(8)');
  if (variantYearlyCell) {
    variantYearlyCell.textContent = Math.round(extraTransactions.yearlyExtraTransactions).toLocaleString();
    variantYearlyCell.className = extraTransactions.yearlyExtraTransactions >= 0 ? 'metric-change positive' : 'metric-change negative';
  }

  // Sonuç durumunu güncelle
  const resultElement = popup.querySelector('.conclusion-result');
  const resultDescElement = popup.querySelector('.conclusion-result-desc');
  
  // Eski sınıfları kaldır
  resultElement.classList.remove('kazandı', 'kaybetti', 'etkisiz');
  // Yeni sınıfı ekle
  resultElement.classList.add(resultStatus);
  // Sonuç metnini güncelle
  resultDescElement.textContent = resultStatus.charAt(0).toUpperCase() + resultStatus.slice(1);

  // Toplam kullanıcı sayısını güncelle
  popup.querySelector('.users-text').textContent = (controlUsers + variantUsers).toLocaleString();

  data.bussinessImpact = document.querySelector('#conclusion-input').value || "";

  // Data objesini güncelle
  data.analysis = {
    ...data.analysis,
    control: {
      ...data.analysis.control,
      sessions: controlUsers,
      conversions: controlConversions,
      cr: controlCR
    },
    variant: {
      ...data.analysis.variant,
      sessions: variantUsers,
      conversions: variantConversions,
      cr: variantCR
    },
    improvement: improvement,
    stats: stats
  };
  
  sessionStorage.setItem('lastAnalysisData', JSON.stringify(data));
}

/**
 * Buton oluştur
 * @param {string} text - Buton metni
 * @param {string} mode - Buton modu
 * @returns {HTMLButtonElement} Oluşturulan buton
 */
export function createButton(text, mode) {
  const button = document.createElement('button');
  button.className = `ga4-abtest-button ${mode}`;
  button.textContent = text;
  button.dataset.mode = mode;
  return button;
}

/**
 * Bildirim göster
 * @param {string} message - Bildirim mesajı
 * @param {string} type - Bildirim tipi (info, success, error)
 * @param {number} duration - Bildirim süresi (ms)
 */
export function showNotification(message, type = 'info', duration = 3000) {
  // Varsa eski notification'ı kaldır
  const existingNotification = document.querySelector('.ga4-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Yeni notification oluştur
  const notification = document.createElement('div');
  notification.className = `ga4-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Animasyon için setTimeout kullan
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Belirtilen süre sonra kaldır
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

/**
 * Sonuçları göster
 * @param {HTMLElement} resultDiv - Sonuçların gösterileceği element
 * @param {Object} data - Gösterilecek veriler
 * @returns {Promise<void>}
 */
export async function displayResults(resultDiv, data) {
  try {
    // Element kontrolü
    if (!resultDiv || !resultDiv.parentNode) {
      console.error('❌ [DEBUG] resultDiv null veya DOM\'dan kaldırılmış');
      return;
    }

    // Data kontrolü
    if (!data) {
      console.error('❌ [DEBUG] displayResults - data null');
      return;
    }

    const templateData = await formatData(data);
    if (!templateData) {
      console.error('❌ [DEBUG] formatData null döndü');
      return;
    }

    // HTML şablonunu ekle (async template function)
    const templateHtml = await getResultsTemplate(templateData);
    if (!templateHtml) {
      console.error('❌ [DEBUG] getResultsTemplate null döndü');
      return;
    }

    // Element hala var mı kontrol et (async işlemler sırasında kaybolmuş olabilir)
    if (!resultDiv || !resultDiv.parentNode) {
      console.error('❌ [DEBUG] resultDiv async işlem sırasında kayboldu');
      return;
    }

    resultDiv.innerHTML = templateHtml;

    // Event listener'ları ekle
    setupResultEventListeners(resultDiv, data);
  } catch (error) {
    console.error('❌ [DEBUG] displayResults hatası:', error);
    if (resultDiv && resultDiv.parentNode) {
      resultDiv.innerHTML = '<div style="color: red; padding: 20px;">Sonuçlar yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
  }
}

export async function formatData(data) {
  const { reportName, dateRange, analysis, bussinessImpact } = data;
  
  // console.log('📅 [DEBUG] formatData - Tarih formatlanıyor:', {
  //   reportName: reportName,
  //   dateRange: dateRange,
  //   periodCount: data.periodCount
  // });
  
  // Konsolide edilmiş veri ise dateRange'i kontrol et
  let actualDateRange = dateRange;
  
  // Eğer konsolide edilmiş veri varsa ve farklı bir tarih aralığı varsa onu kullan
  if (data.periodCount && data.periodCount > 1) {
    // console.log('📅 [DEBUG] Konsolide edilmiş tarih aralığı kullanılıyor:', actualDateRange);
  }
  
  // Prefer pre-calculated testDuration (e.g. from topla), else derive from dateRange string
  const testDuration = data.testDuration != null ? data.testDuration : calculateTestDuration(actualDateRange);
  data.testDuration = testDuration;

  const dates = actualDateRange.split(' - ');
  if (dates.length !== 2) return null;

  const startDate = parseTurkishDate(dates[0]);
  const endDate = parseTurkishDate(dates[1]);
  
  // Tarihleri Türkçe formata çevir
  const formattedStartDate = formatDateTurkish(startDate);
  const formattedEndDate = formatDateTurkish(endDate);
  
  // console.log('📅 [DEBUG] Formatlanmış tarihler:', {
  //   actualDateRange: actualDateRange,
  //   formattedStartDate: formattedStartDate,
  //   formattedEndDate: formattedEndDate,
  //   testDuration: testDuration
  // });
  
  // Sonuç durumu için resultStatus belirleme
  let resultStatus = '';
  
  try {
     // Güvenilirlik seviyesini al
     const confidenceLevel = await new Promise(resolve => {
      chrome.storage.sync.get(['confidenceLevel'], function(result) {
          resolve(result.confidenceLevel || 95);
      });
    });
    
    // Eski format kontrolü (compatibility için)
    if (analysis.improvement !== undefined && analysis.stats) {
      if (analysis.stats.variantProbability >= confidenceLevel) {
          resultStatus = 'Kazandı';
      } else if (analysis.stats.controlProbability >= confidenceLevel) {
          resultStatus = 'Kaybetti';
      } else {
          resultStatus = 'Etkisiz';
      }
    } 
    // Yeni format (variants array)
    else if (analysis.variants && Array.isArray(analysis.variants)) {
      const winningVariants = analysis.variants.filter(v => v.stats.variantProbability >= confidenceLevel);
      
      if (winningVariants.length > 0) {
        resultStatus = 'Kazandı';
      } else {
        const losingVariants = analysis.variants.filter(v => v.stats.controlProbability >= confidenceLevel);
        if (losingVariants.length === analysis.variants.length) {
          resultStatus = 'Kaybetti';
        } else {
          resultStatus = 'Etkisiz';
        }
      }
    }
  } catch (error) {
    console.error('Result status belirlenirken hata:', error);
    resultStatus = 'Etkisiz';
  }

  // Şablon verilerini hazırla
  const templateData = {
    ...data,
    formattedStartDate,
    formattedEndDate,
    testDuration,
    resultStatus
  };
  
  return templateData;
}

/**
 * Verileri CSV olarak dışa aktar
 * @param {Object} data - Dışa aktarılacak veriler
 */
export function exportToCSV(data) {
  const { reportName, dateRange, analysis } = data;
  
  // CSV başlıkları
  const rows = [
    ['Test Name', reportName],
    ['Date Range', dateRange],
    [''],
    ['Variant', 'Users', 'Purchase', 'Conv. Rate', 'Uplift', 'Significance']
  ];

  // Kontrol satırı
  rows.push([
    analysis.control.name || 'Control', 
    analysis.control.sessions, 
    analysis.control.conversions, 
    `${analysis.control.cr.toFixed(2)}%`, 
    '-', 
    '-' // Control significance gösterilmiyor
  ]);

  // Eski format (tek varyant) kontrolü
  if (analysis.variant) {
    rows.push([
      analysis.variant.name || 'Variation 1', 
      analysis.variant.sessions, 
      analysis.variant.conversions,
      `${analysis.variant.cr.toFixed(2)}%`, 
      `${analysis.improvement.toFixed(2)}%`, 
      `${analysis.stats?.variantProbability || 0}%`
    ]);
  } 
  // Yeni format (birden fazla varyant)
  else if (analysis.variants && Array.isArray(analysis.variants)) {
    analysis.variants.forEach((variant, index) => {
      rows.push([
        variant.name || `Variation ${index + 1}`, 
        variant.sessions, 
        variant.conversions,
        `${variant.cr.toFixed(2)}%`, 
        `${variant.improvement.toFixed(2)}%`, 
        `${variant.stats.variantProbability}%`
      ]);
    });
  }

  const csvContent = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_test_results.csv`;
  link.click();
}

/**
 * A/B Test analiz butonlarını sayfaya ekle
 * Tüm butonlar sürekli görünür ve yan yana
 */
export function injectAnalyzeButton() {

  // Eğer butonlar zaten varsa tekrar ekleme
  if (document.querySelector('.ga4-abtest-main-container')) {
    return;
  }

  // Inject styles early so buttons render styled from first paint
  injectButtonStyles();

  // Ana konteyner oluştur - tüm butonları içerecek
  const mainContainer = document.createElement('div');
  mainContainer.className = 'ga4-abtest-main-container';
  
  // Butonlar konteyneri - artık sürekli açık
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'ga4-abtest-buttons-container';
  
  // Konteyneri ana konteyner'a ekle
  mainContainer.appendChild(buttonsContainer);
  
  // Ana konteyner'ı header'a ekle - yeni konum: analysis-area sonrası
  const analysisAreaElement = document.querySelector(".analysis-area");
  
  if (analysisAreaElement) {
    analysisAreaElement.insertBefore(mainContainer, analysisAreaElement.firstChild);
  }  else {
    console.warn('⚠️ analysis-area elementi bulunamadı, butonlar eklenemedi');
    return;
  }

  // Tablo ve sekme değişikliklerini izle
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    for (const mutation of mutations) {
      // Tablo içeriği değişti mi?
      if (mutation.target.classList.contains('table-area') ||
          mutation.target.classList.contains('cells-wrapper') ||
          mutation.target.classList.contains('header-value')) {
        shouldUpdate = true;
        break;
      }
      
      // KPI değişti mi?
      if (mutation.target.closest('#value')) {
        shouldUpdate = true;
        break;
      }

      // Sekme değişti mi?
      if (mutation.target.closest('.tab-content-wrapper')) {
        shouldUpdate = true;
        break;
      }
    }

    if (shouldUpdate) {
      // Kısa bir gecikme ekleyerek DOM'un güncellenmesini bekle
      setTimeout(() => updateButtonState(mainContainer), 100);
    }
  });

  // Crosstab elementini bekle ve observer'ı başlat
  function setupObserver() {
    const contentArea = document.querySelector('.crosstab');
      
    if (contentArea) {
      // console.log('Crosstab bulundu, observer başlatılıyor');
      observer.observe(contentArea, { 
        childList: true, 
        subtree: true,
        characterData: true,
        attributes: true
      });
      // İlk durumu ayarla
      updateButtonState(mainContainer);
    } else {
      // console.log('Crosstab bekleniyor...');
      setTimeout(setupObserver, 500);
    }
  }

  // Tüm elementlerin yüklenmesini bekle
  waitForAllElements((loaded) => {
    if (loaded) {
      mainContainer.style.display = 'inline-flex';
      setupObserver(); // Observer'ı başlat
      
      // İlk butonları ekle
      const results = getReportInfo();
      if (results.success) {
        addDataButtons(buttonsContainer, results.data.tableData, results.data);
      }
    }
  });

  // Sonuç popup'ı için container'ları oluştur
  const overlay = document.createElement('div');
  overlay.id = 'ga4-abtest-overlay';
  
  const resultsPopup = document.createElement('div');
  resultsPopup.id = 'ga4-abtest-results';
  resultsPopup.innerHTML = `
    <div id="ga4-abtest-content"></div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(resultsPopup);

  // Butonlar konteyneri buton tıklamalarını dinle
  buttonsContainer.addEventListener('click', async (event) => {
    const button = event.target.closest('.ga4-abtest-button');
    if (!button) return;

    try {
      const results = getReportInfo();
      if (!results.success) {
        showNotification('Hata: ' + (results.error || 'Bilinmeyen bir hata oluştu'), 'error');
        return;
      }

      // console.log('🔍 [DEBUG] Buton tıklandı:', {
      //   buttonMode: button.dataset.mode,
      //   reportData: results.data,
      //   currentTime: new Date().toISOString()
      // });

      // Buton tipine göre işlem yap
      switch (button.dataset.mode) {
        case 'session':
          // console.log('📥 [DEBUG] Session butonu - Veri kaydediliyor...');
          saveKPIData(results.data, results.data.tableData, 'session');
          // Butonları yeniden oluştur (Analiz Et butonunu aktif etmek ve subtitle'ı güncellemek için)
          setTimeout(() => {
            addDataButtons(buttonsContainer, results.data.tableData, results.data);
          }, 100);
          break;
        case 'conversion':
          // console.log('📥 [DEBUG] Conversion butonu - Veri kaydediliyor...');
          saveKPIData(results.data, results.data.tableData, 'conversion');
          // Butonları yeniden oluştur (Analiz Et butonunu aktif etmek ve subtitle'ı güncellemek için)
          setTimeout(() => {
            addDataButtons(buttonsContainer, results.data.tableData, results.data);
          }, 100);
          break;
        case 'topla':
          openToplaPanel(results.data);
          break;
        case 'temizle':
          // console.log('🗑️ [DEBUG] Temizle butonu - Session storage temizleniyor...');
          try {
            let currentStorage;
            try {
              currentStorage = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
            } catch (parseError) {
              console.error('❌ [DEBUG] Temizle - SessionStorage parse hatası:', parseError);
              // Parse hatası durumunda tüm storage'ı temizle
              sessionStorage.removeItem('ga4_abtest_data');
              showNotification('Bozuk veri temizlendi', 'success');
              break;
            }
            // console.log('📦 [DEBUG] Temizlenmeden önce storage:', currentStorage);
            
            const reportName = results.data.reportName;
            
            // Sadece mevcut rapor için temizleme yap
            if (currentStorage[reportName]) {
              delete currentStorage[reportName];
              sessionStorage.setItem('ga4_abtest_data', JSON.stringify(currentStorage));
              // console.log('✅ [DEBUG] Rapor verisi temizlendi:', reportName);
              showNotification(`"${reportName}" raporu temizlendi`, 'success');
            } else {
              // console.log('ℹ️ [DEBUG] Temizlenecek veri bulunamadı');
              showNotification('Temizlenecek veri bulunamadı', 'info');
            }
            
            // Temizleme sonrası butonları yeniden oluştur
            setTimeout(() => {
              addDataButtons(buttonsContainer, results.data.tableData, results.data);
            }, 100);
            
          } catch (error) {
            console.error('🗑️ [DEBUG] Temizleme hatası:', error);
            // Fallback - tüm storage'ı temizle
            sessionStorage.removeItem('ga4_abtest_data');
            showNotification('Tüm veriler temizlendi', 'success');
          }
          break;
        case 'analyze':
          if (button.disabled) {
            showNotification('Analiz için hem session hem de dönüşüm verisi gerekli', 'error');
            return;
          }

          let storedData;
          try {
            storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
          } catch (parseError) {
            console.error('❌ [DEBUG] SessionStorage parse hatası:', parseError);
            showNotification('Veri formatı bozuk. Lütfen temizleyip tekrar deneyin.', 'error');
            return;
          }
          // console.log("Analiz için hazırlanan veri: ", storedData);
          
          const analysisData = prepareAnalysisData(storedData);
          if (!analysisData) {
            console.error('❌ [DEBUG] prepareAnalysisData null döndü');
            showNotification('Analiz verisi hazırlanamadı', 'error');
            return;
          }

          const analysis = await analyzeABTest(analysisData);
          if (!analysis) {
            console.error('❌ [DEBUG] analyzeABTest null döndü');
            showNotification('Analiz yapılamadı', 'error');
            return;
          }
          
          // console.log('🔍 [DEBUG] displayResults çağrısı hazırlanıyor:', {
            // currentDateRange: results.data.dateRange,
            // analysisDataRange: analysisData.dateRange,
            // periodCount: analysisData.periodCount
          // });

          // Element kontrolü
          const contentElement = document.getElementById('ga4-abtest-content');
          if (!contentElement) {
            console.error('❌ [DEBUG] ga4-abtest-content elementi bulunamadı');
            showNotification('Popup elementi bulunamadı. Lütfen sayfayı yenileyin.', 'error');
            return;
          }

          await displayResults(
            contentElement,
            {
              reportName: results.data.reportName,
              // Konsolide edilmiş veri varsa onu kullan, yoksa mevcut tarih aralığını kullan
              dateRange: analysisData.dateRange || results.data.dateRange,
              sessionTab: analysisData.sessionTab.split('-')[1],
              conversionTab: analysisData.conversionTab.split('-')[1],
              analysis,
              bussinessImpact: analysisData.bussinessImpact || "",
              // Konsolide bilgilerini de aktar
              periodCount: analysisData.periodCount,
              reportName: analysisData.reportName || results.data.reportName
            }
          );
          break;
        case 'analyze-direct':
          const directAnalysisData = prepareDirectAnalysisData(results.data.tableData);
          if (!directAnalysisData) {
            console.error('❌ [DEBUG] prepareDirectAnalysisData null döndü');
            showNotification('Direkt analiz verisi hazırlanamadı', 'error');
            return;
          }

          // console.log("Doğrudan analiz için hazırlanan veri: ", directAnalysisData);
          const directAnalysis = await analyzeABTest(directAnalysisData);
          if (!directAnalysis) {
            console.error('❌ [DEBUG] directAnalysis null döndü');
            showNotification('Direkt analiz yapılamadı', 'error');
            return;
          }

          // Element kontrolü
          const directContentElement = document.getElementById('ga4-abtest-content');
          if (!directContentElement) {
            console.error('❌ [DEBUG] ga4-abtest-content elementi bulunamadı (direct)');
            showNotification('Popup elementi bulunamadı. Lütfen sayfayı yenileyin.', 'error');
            return;
          }

          await displayResults(
            directContentElement,
            {
              reportName: results.data.reportName,
              dateRange: results.data.dateRange,
              analysis: directAnalysis,
              sessionTab: results.data.tableData.kpis[0],
              conversionTab: results.data.tableData.kpis[1],
              bussinessImpact:""
            }
          );
          break;
      }

      // Popup'ı göster (analiz durumlarında)
      if (button.dataset.mode === 'analyze' || button.dataset.mode === 'analyze-direct') {
        const overlayElement = document.getElementById('ga4-abtest-overlay');
        const resultsElement = document.getElementById('ga4-abtest-results');
        
        if (!overlayElement || !resultsElement) {
          console.error('❌ [DEBUG] Popup elementleri bulunamadı:', {
            overlay: !!overlayElement,
            results: !!resultsElement
          });
          showNotification('Popup gösterilemiyor. Lütfen sayfayı yenileyin.', 'error');
          return;
        }

        overlayElement.style.display = 'block';
        resultsElement.style.display = 'flex';
      }

      // İşlem sonrası storage durumunu konsola yazdır
      try {
        const storageData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
        if (button.dataset.mode === 'analyze' || button.dataset.mode === 'analyze-direct') {
          // console.log('AB Test Analiz Et butonuna tıklandı. Storage verisi:', storageData);
        }
      } catch (parseError) {
        console.error('❌ [DEBUG] Storage log parse hatası:', parseError);
      }

    } catch (error) {
      console.error('İşlem hatası:', error);
      showNotification('İşlem sırasında bir hata oluştu: ' + error.message, 'error');
    }
  });

  overlay.addEventListener('click', () => {
    if (overlay && overlay.style) {
      overlay.style.display = 'none';
    }
    if (resultsPopup && resultsPopup.style) {
      resultsPopup.style.display = 'none';
    }
  });
}

/**
 * Veri butonlarını (Session Al, Dönüşüm Al, Analiz Et) konteynere ekle
 * @param {HTMLElement} container - Butonlar konteyneri
 * @param {Object} tableData - Tablo verileri  
 * @param {Object} reportInfo - Rapor bilgileri
 */
function addDataButtons(container, tableData, reportInfo) {
  // Mevcut tüm butonları temizle ve tooltip'lerini de kaldır
  const existingButtons = container.querySelectorAll('.ga4-abtest-button');
  existingButtons.forEach(button => {
    // Eğer button'da tooltip referansı varsa onu da temizle
    if (button._tooltip) {
      button._tooltip.remove();
      button._tooltip = null;
    }
    button.remove();
  });

  // Storage'dan mevcut verileri al
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  const currentKPIs = tableData.kpis;
  
  // Debug: Storage durumunu kontrol et
  console.log('🔄 [DEBUG] addDataButtons çağrıldı:', {
    reportName: reportInfo.reportName,
    hasStoredData: !!storedData[reportInfo.reportName],
    hasSession: !!(storedData[reportInfo.reportName]?.sessionData),
    hasConversion: !!(storedData[reportInfo.reportName]?.conversionData),
    kpiCount: currentKPIs.length
  });

  if (currentKPIs.length === 2) {
      // İki KPI varsa doğrudan analiz butonu
      const analyzeButton = createButton('AB Test Analiz Et', 'analyze-direct');
      container.appendChild(analyzeButton);
  } else if (currentKPIs.length === 1) {
      // Session Al butonu
      const sessionButton = createButton('Session Al', 'session');
      
      // Button içeriği container'ı
      const sessionContent = document.createElement('div');
      sessionContent.className = 'button-content';
      
      // Icon
      const sessionImg = document.createElement('img');
      sessionImg.src = "https://useruploads.vwo.io/useruploads/529944/images/a0aa5148b06e41c0965a1ceb2b6b4d95_group402515601.svg?timestamp=1756368887567";
      sessionImg.className = 'button-icon';
      sessionImg.alt = 'Session icon';
      
      // Text container (title + subtitle)
      const sessionTextContainer = document.createElement('div');
      sessionTextContainer.className = 'button-text';
      
      // Main title
      const sessionTitle = document.createElement('span');
      sessionTitle.className = 'button-title';
      sessionTitle.textContent = 'Session Al';
      
      // Subtitle (tab name)
      const sessionSubtitle = document.createElement('span');
      sessionSubtitle.className = 'button-subtitle';
      if (storedData[reportInfo.reportName] && storedData[reportInfo.reportName].sessionData) {
          // Tab ismindeki index kısmını kaldır ve sadece ismi göster
          const tabName = storedData[reportInfo.reportName].sessionData.tabName;
          const cleanTabName = tabName.includes('-') ? tabName.split('-')[1] : tabName;
          sessionSubtitle.textContent = cleanTabName;
          console.log('✅ [DEBUG] Session subtitle ayarlandı:', cleanTabName);
      } else {
          // Boş subtitle - görünmez olsun
          sessionSubtitle.textContent = '';
          sessionSubtitle.style.display = 'none';
      }
      
      // Assemble text container
      sessionTextContainer.appendChild(sessionTitle);
      sessionTextContainer.appendChild(sessionSubtitle);
      
      // Assemble button content
      sessionContent.appendChild(sessionImg);
      sessionContent.appendChild(sessionTextContainer);
      
      // Clear button and add new content
      sessionButton.innerHTML = '';
      sessionButton.appendChild(sessionContent);

      // Dönüşüm Al butonu
      const conversionButton = createButton('Dönüşüm Al', 'conversion');
      
      // Button içeriği container'ı
      const conversionContent = document.createElement('div');
      conversionContent.className = 'button-content';
      
      // Icon
      const conversionImg = document.createElement('img');
      conversionImg.src = "https://useruploads.vwo.io/useruploads/529944/images/624db0d01d55e2fec22c9aed2cb68437_group402515602.svg?timestamp=1756374571001";
      conversionImg.className = 'button-icon';
      conversionImg.alt = 'Conversion icon';
      
      // Text container (title + subtitle)
      const conversionTextContainer = document.createElement('div');
      conversionTextContainer.className = 'button-text';
      
      // Main title
      const conversionTitle = document.createElement('span');
      conversionTitle.className = 'button-title';
      conversionTitle.textContent = 'Dönüşüm Al';
      
      // Subtitle (tab name)
      const conversionSubtitle = document.createElement('span');
      conversionSubtitle.className = 'button-subtitle';
      if (storedData[reportInfo.reportName] && storedData[reportInfo.reportName].conversionData) {
          // Tab ismindeki index kısmını kaldır ve sadece ismi göster
          const tabName = storedData[reportInfo.reportName].conversionData.tabName;
          const cleanTabName = tabName.includes('-') ? tabName.split('-')[1] : tabName;
          conversionSubtitle.textContent = cleanTabName;
          console.log('✅ [DEBUG] Conversion subtitle ayarlandı:', cleanTabName);
      } else {
          // Boş subtitle - görünmez olsun
          conversionSubtitle.textContent = '';
          conversionSubtitle.style.display = 'none';
      }
      
      // Assemble text container
      conversionTextContainer.appendChild(conversionTitle);
      conversionTextContainer.appendChild(conversionSubtitle);
      
      // Assemble button content
      conversionContent.appendChild(conversionImg);
      conversionContent.appendChild(conversionTextContainer);
      
      // Clear button and add new content
      conversionButton.innerHTML = '';
      conversionButton.appendChild(conversionContent);

      // Butonları sırayla ekle: Session, Conversion
      container.appendChild(sessionButton);
      container.appendChild(conversionButton);
  }
  
  // Topla ve Temizle butonlarını en sona ekle
  addToplaTemizleButtons(container);
}

/**
 * Topla, Temizle ve Analiz Et butonlarını container'a ekle
 * @param {HTMLElement} container - Button container
 */
function addToplaTemizleButtons(container) {
  const hasTopla = container.querySelector('.topla-button');
  const hasTemizle = container.querySelector('.temizle-button');
  
  if (!hasTopla) {
    const toplaButton = createButton('Topla', 'topla');
    toplaButton.classList.add('topla-button');
    
    const toplaContent = document.createElement('div');
    toplaContent.className = 'button-content';
    
    const toplaImg = document.createElement('img');
    toplaImg.src = "https://useruploads.vwo.io/useruploads/529944/images/5316b95da0557fd6cce236e3f4c5ad9a_group402515603.svg";
    toplaImg.className = 'button-icon';
    toplaImg.alt = 'Topla icon';
    
    const toplaTextContainer = document.createElement('div');
    toplaTextContainer.className = 'button-text';
    const toplaTitle = document.createElement('span');
    toplaTitle.className = 'button-title';
    toplaTitle.textContent = 'Topla';
    toplaTextContainer.appendChild(toplaTitle);

    // Subtitle: show period count if data exists
    const results = getReportInfo();
    if (results.success) {
      const periods = getToplaPeriods(results.data.reportName);
      if (periods.length > 0) {
        const sub = document.createElement('span');
        sub.className = 'button-subtitle';
        sub.textContent = `${periods.length} dönem`;
        sub.style.cssText = 'font-size:10px;color:#666;margin-top:2px;';
        toplaTextContainer.appendChild(sub);
      }
    }
    
    toplaContent.appendChild(toplaImg);
    toplaContent.appendChild(toplaTextContainer);
    toplaButton.innerHTML = '';
    toplaButton.appendChild(toplaContent);
    container.appendChild(toplaButton);
  }
  
  if (!hasTemizle) {
    const temizleButton = createButton('Temizle', 'temizle');
    temizleButton.classList.add('temizle-button');
    
    const temizleContent = document.createElement('div');
    temizleContent.className = 'button-content';
    
    const temizleImg = document.createElement('img');
    temizleImg.src = "https://useruploads.vwo.io/useruploads/529944/images/c7353fa6be18961df1d8296d409b2789_group402515604.svg";
    temizleImg.className = 'button-icon';
    temizleImg.alt = 'Temizle icon';
    
    const temizleTextContainer = document.createElement('div');
    temizleTextContainer.className = 'button-text';
    const temizleTitle = document.createElement('span');
    temizleTitle.className = 'button-title';
    temizleTitle.textContent = 'Temizle';
    temizleTextContainer.appendChild(temizleTitle);
    
    temizleContent.appendChild(temizleImg);
    temizleContent.appendChild(temizleTextContainer);
    temizleButton.innerHTML = '';
    temizleButton.appendChild(temizleContent);
    container.appendChild(temizleButton);
  }
  
  // Analiz Et button (for single-period session+conversion flow)
  const hasAnalyze = container.querySelector('.ga4-abtest-button.analyze:not(.analyze-main):not(.analyze-direct)');
  if (!hasAnalyze) {
    const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    const results = getReportInfo();
    if (results.success) {
      const reportInfo = results.data;
      const analyzeDataButton = createButton('Analiz Et', 'analyze');
      const hasSessionData = !!(storedData[reportInfo.reportName]?.sessionData);
      const hasConversionData = !!(storedData[reportInfo.reportName]?.conversionData);
      const shouldEnable = hasSessionData && hasConversionData;
      analyzeDataButton.disabled = !shouldEnable;
      if (analyzeDataButton.disabled) analyzeDataButton.classList.add('disabled');
      container.appendChild(analyzeDataButton);
    }
  }
}

// ─── Topla Panel ────────────────────────────────────────────────────────────

/**
 * Open the Topla panel (tooltip-style popup below the button)
 * @param {Object} reportInfo - Current report info from getReportInfo().data
 */
function openToplaPanel(reportInfo) {
  // Close existing panel if open
  const existing = document.getElementById('topla-panel');
  if (existing) { existing.remove(); document.getElementById('topla-panel-overlay')?.remove(); }

  const reportName = reportInfo.reportName;
  const periods = getToplaPeriods(reportName);

  // Overlay to close on outside click
  const overlay = document.createElement('div');
  overlay.id = 'topla-panel-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9998;background:transparent;';
  document.body.appendChild(overlay);

  // Panel element
  const panel = document.createElement('div');
  panel.id = 'topla-panel';
  panel.style.cssText = `
    position:fixed; z-index:9999; background:#fff; border-radius:12px;
    box-shadow:0 8px 30px rgba(0,0,0,0.18); border:1px solid #e0e0e0;
    padding:20px; min-width:500px; max-width:90vw; max-height:80vh; overflow-y:auto;
    font-family:sans-serif; font-size:14px; color:#333;
  `;
  document.body.appendChild(panel);

  // Position panel below the Topla button
  const toplaBtn = document.querySelector('.topla-button');
  if (toplaBtn) {
    const rect = toplaBtn.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.left = `${Math.max(10, rect.left - 100)}px`;
  } else {
    panel.style.top = '100px';
    panel.style.left = '100px';
  }

  overlay.addEventListener('click', () => { panel.remove(); overlay.remove(); });

  renderToplaPanelContent(panel, reportInfo);
}

/**
 * Render/refresh the Topla panel content (table + buttons)
 */
function renderToplaPanelContent(panel, reportInfo) {
  const reportName = reportInfo.reportName;
  const periods = getToplaPeriods(reportName);
  const validation = validateToplaPeriods(periods);

  // Determine segment names from first period that has data
  let segmentNames = [];
  for (const p of periods) {
    const d = p.sessionData || p.conversionData;
    if (d) { segmentNames = [d.controlSegment, ...d.variants.map(v => v.segment)]; break; }
  }

  // Determine tab names for headers
  let sessionTabLabel = 'Sessions';
  let conversionTabLabel = 'Dönüşüm';
  for (const p of periods) {
    if (p.sessionData) { sessionTabLabel = p.sessionData.tabName.includes('-') ? p.sessionData.tabName.split('-')[1] : p.sessionData.tabName; }
    if (p.conversionData) { conversionTabLabel = p.conversionData.tabName.includes('-') ? p.conversionData.tabName.split('-')[1] : p.conversionData.tabName; }
    if (p.sessionData && p.conversionData) break;
  }

  // Build HTML
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0;font-size:18px;font-weight:700;color:#111;">Dönem Toplama Tablosu</h3>
    <button id="topla-panel-close" style="background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;">✕</button>
  </div>`;

  if (periods.length === 0 && segmentNames.length === 0) {
    // No data yet - show help text and current date range
    const currentDate = reportInfo.dateRange || '';
    html += `<p style="color:#888;margin-bottom:12px;">Henüz veri eklenmedi. Sayfadaki tarih aralığını seçip aşağıdaki butonlarla veri ekleyin.</p>`;
    if (currentDate) {
      html += `<p style="color:#333;font-weight:600;">Mevcut sayfa tarihi: <span style="color:#2196F3;">${currentDate}</span></p>`;
    }
  } else {
    // Build table
    const colCount = segmentNames.length;
    html += `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;text-align:center;">`;
    
    // Table header
    html += `<thead><tr style="background:#f5f5f5;">
      <th style="padding:10px 8px;border:1px solid #e0e0e0;min-width:140px;">Tarih Aralığı</th>`;
    segmentNames.forEach(seg => {
      html += `<th style="padding:10px 4px;border:1px solid #e0e0e0;" colspan="1">${seg}<br><span style="font-weight:400;font-size:11px;color:#666;">${sessionTabLabel}</span></th>`;
    });
    segmentNames.forEach(seg => {
      html += `<th style="padding:10px 4px;border:1px solid #e0e0e0;" colspan="1">${seg}<br><span style="font-weight:400;font-size:11px;color:#666;">${conversionTabLabel}</span></th>`;
    });
    html += `<th style="padding:8px 4px;border:1px solid #e0e0e0;width:44px;font-size:11px;color:#2563eb;font-weight:600;" title="Bu dönem için sadece dönüşüm verisini sil (session kalır)">Dönüşüm<br>sil</th>`;
    html += `<th style="padding:10px 4px;border:1px solid #e0e0e0;width:40px;" title="Tüm satırı sil">Satır</th></tr></thead>`;

    // Table body
    html += `<tbody>`;
    periods.forEach((period, idx) => {
      const isAnalyzable = validation.analyzablePeriods.includes(period);
      const rowBg = isAnalyzable ? '#fff' : '#fff8f0';
      html += `<tr style="background:${rowBg};">`;
      html += `<td style="padding:8px;border:1px solid #e0e0e0;font-weight:600;white-space:nowrap;">${period.dateRange}</td>`;
      
      // Session values
      segmentNames.forEach(seg => {
        let val = '-';
        if (period.sessionData) {
          if (period.sessionData.controlSegment === seg) val = (period.sessionData.controlValue || 0).toLocaleString();
          else { const v = period.sessionData.variants.find(x => x.segment === seg); if (v) val = (v.value || 0).toLocaleString(); }
        }
        const cellColor = period.sessionData ? '#059669' : '#ccc';
        html += `<td style="padding:8px;border:1px solid #e0e0e0;color:${cellColor};font-weight:500;">${val}</td>`;
      });

      // Conversion values
      segmentNames.forEach(seg => {
        let val = '-';
        if (period.conversionData) {
          if (period.conversionData.controlSegment === seg) val = (period.conversionData.controlValue || 0).toLocaleString();
          else { const v = period.conversionData.variants.find(x => x.segment === seg); if (v) val = (v.value || 0).toLocaleString(); }
        }
        const cellColor = period.conversionData ? '#2563eb' : '#ccc';
        html += `<td style="padding:8px;border:1px solid #e0e0e0;color:${cellColor};font-weight:500;">${val}</td>`;
      });

      // Clear conversion only (session stays)
      const convClearDisabled = !period.conversionData ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : 'style="cursor:pointer;"';
      html += `<td style="padding:4px;border:1px solid #e0e0e0;">
        <button type="button" class="topla-clear-conversion" data-date="${period.dateRange}" ${convClearDisabled}
          style="background:none;border:none;color:#2563eb;font-size:16px;padding:2px 6px;" title="Bu dönemin dönüşüm verisini sil (session kalır)">✕</button>
      </td>`;

      // Delete full row
      html += `<td style="padding:4px;border:1px solid #e0e0e0;">
        <button type="button" class="topla-delete-row" data-date="${period.dateRange}" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:2px 6px;" title="Satırı tamamen sil">✕</button>
      </td>`;
      html += `</tr>`;
    });

    // Totals row (sum of analyzable periods)
    if (validation.analyzablePeriods.length > 0) {
      html += `<tr style="background:#f0fdf4;font-weight:700;">`;
      html += `<td style="padding:8px;border:1px solid #e0e0e0;">TOPLAM (${validation.analyzablePeriods.length} dönem)</td>`;
      
      segmentNames.forEach(seg => {
        let total = 0;
        validation.analyzablePeriods.forEach(p => {
          if (p.sessionData) {
            if (p.sessionData.controlSegment === seg) total += p.sessionData.controlValue || 0;
            else { const v = p.sessionData.variants.find(x => x.segment === seg); if (v) total += v.value || 0; }
          }
        });
        html += `<td style="padding:8px;border:1px solid #e0e0e0;color:#059669;">${total.toLocaleString()}</td>`;
      });
      segmentNames.forEach(seg => {
        let total = 0;
        validation.analyzablePeriods.forEach(p => {
          if (p.conversionData) {
            if (p.conversionData.controlSegment === seg) total += p.conversionData.controlValue || 0;
            else { const v = p.conversionData.variants.find(x => x.segment === seg); if (v) total += v.value || 0; }
          }
        });
        html += `<td style="padding:8px;border:1px solid #e0e0e0;color:#2563eb;">${total.toLocaleString()}</td>`;
      });
      html += `<td style="border:1px solid #e0e0e0;"></td><td style="border:1px solid #e0e0e0;"></td></tr>`;
    }

    html += `</tbody></table></div>`;
  }

  // Validation warning
  if (validation.error && periods.length > 0) {
    html += `<div style="margin-top:12px;padding:8px 12px;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;font-size:12px;color:#92400e;">⚠️ ${validation.error}</div>`;
  }

  // Current page date range info
  const currentDate = reportInfo.dateRange || '';
  if (currentDate) {
    html += `<div style="margin-top:12px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;color:#1e40af;">
      Sayfa tarihi: <strong>${currentDate}</strong>
    </div>`;
  }

  // Action buttons row
  html += `<div style="display:flex;gap:10px;margin-top:16px;align-items:center;">
    <button id="topla-session-btn" style="padding:8px 16px;border-radius:20px;border:1px solid #ddd;background:#fff;color:#0E2C2D;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.2s;">Session Al</button>
    <button id="topla-conversion-btn" style="padding:8px 16px;border-radius:20px;border:1px solid #ddd;background:#fff;color:#0E2C2D;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.2s;">Dönüşüm Al</button>
    <button id="topla-clear-btn" style="padding:8px 16px;border-radius:20px;border:1px solid #ef4444;background:#fff;color:#ef4444;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.2s;">Temizle</button>
    <div style="flex:1;"></div>
    <button id="topla-analyze-btn" style="padding:10px 24px;border-radius:20px;border:none;background:${validation.valid && validation.analyzablePeriods.length > 0 ? 'linear-gradient(135deg, #ea4335, #d62516)' : '#9aa0a6'};color:#fff;font-weight:700;font-size:14px;cursor:${validation.valid && validation.analyzablePeriods.length > 0 ? 'pointer' : 'not-allowed'};transition:all 0.2s;"
      ${validation.valid && validation.analyzablePeriods.length > 0 ? '' : 'disabled'}>Analiz Et</button>
  </div>`;

  panel.innerHTML = html;

  // Event listeners
  panel.querySelector('#topla-panel-close').addEventListener('click', () => {
    panel.remove();
    document.getElementById('topla-panel-overlay')?.remove();
    // Refresh main buttons to update period count subtitle
    const buttonsContainer = document.querySelector('.ga4-abtest-buttons-container');
    if (buttonsContainer) {
      const results = getReportInfo();
      if (results.success) addDataButtons(buttonsContainer, results.data.tableData, results.data);
    }
  });

  // Session Al inside panel
  panel.querySelector('#topla-session-btn').addEventListener('click', () => {
    try {
      const results = getReportInfo();
      if (!results.success) { showNotification(results.error, 'error'); return; }
      saveTopaPeriodData(results.data, results.data.tableData, 'session');
      showNotification('Session verisi tabloya eklendi.', 'success');
      renderToplaPanelContent(panel, results.data);
    } catch (e) { showNotification(e.message, 'error'); }
  });

  // Dönüşüm Al inside panel
  panel.querySelector('#topla-conversion-btn').addEventListener('click', () => {
    try {
      const results = getReportInfo();
      if (!results.success) { showNotification(results.error, 'error'); return; }
      saveTopaPeriodData(results.data, results.data.tableData, 'conversion');
      showNotification('Dönüşüm verisi tabloya eklendi.', 'success');
      renderToplaPanelContent(panel, results.data);
    } catch (e) { showNotification(e.message, 'error'); }
  });

  // Clear all
  panel.querySelector('#topla-clear-btn').addEventListener('click', () => {
    clearToplaPeriods(reportName);
    showNotification('Tüm dönem verileri temizlendi.', 'success');
    renderToplaPanelContent(panel, reportInfo);
  });

  // Clear conversion only for one period
  panel.querySelectorAll('.topla-clear-conversion').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (btn.disabled) return;
      e.stopPropagation();
      clearTopaPeriodConversion(reportName, btn.dataset.date);
      showNotification('Bu dönemin dönüşüm verisi silindi; session verisi korundu.', 'success');
      const results = getReportInfo();
      renderToplaPanelContent(panel, results.success ? results.data : reportInfo);
    });
  });

  // Delete individual rows
  panel.querySelectorAll('.topla-delete-row').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteTopaPeriod(reportName, btn.dataset.date);
      showNotification('Satır silindi.', 'success');
      const results = getReportInfo();
      renderToplaPanelContent(panel, results.success ? results.data : reportInfo);
    });
  });

  // Analyze button inside panel
  const analyzeBtn = panel.querySelector('#topla-analyze-btn');
  if (analyzeBtn && !analyzeBtn.disabled) {
    analyzeBtn.addEventListener('click', async () => {
      try {
        const latestValidation = validateToplaPeriods(getToplaPeriods(reportName));
        if (!latestValidation.valid || latestValidation.analyzablePeriods.length === 0) {
          showNotification(latestValidation.error || 'Analiz yapılamaz.', 'error');
          return;
        }

        const analysisData = prepareToplaAnalysisData(latestValidation.analyzablePeriods);
        const analysis = await analyzeABTest(analysisData);
        if (!analysis) { showNotification('Analiz yapılamadı', 'error'); return; }

        // Close panel
        panel.remove();
        document.getElementById('topla-panel-overlay')?.remove();

        const contentElement = document.getElementById('ga4-abtest-content');
        if (!contentElement) { showNotification('Popup elementi bulunamadı.', 'error'); return; }

        await displayResults(contentElement, {
          reportName: reportName,
          dateRange: analysisData.dateRange,
          sessionTab: analysisData.sessionTab.includes('-') ? analysisData.sessionTab.split('-')[1] : analysisData.sessionTab,
          conversionTab: analysisData.conversionTab.includes('-') ? analysisData.conversionTab.split('-')[1] : analysisData.conversionTab,
          analysis,
          bussinessImpact: '',
          periodCount: analysisData.periodCount,
          testDuration: analysisData.testDuration
        });

        const overlayEl = document.getElementById('ga4-abtest-overlay');
        const resultsEl = document.getElementById('ga4-abtest-results');
        if (overlayEl) overlayEl.style.display = 'block';
        if (resultsEl) resultsEl.style.display = 'flex';
      } catch (e) {
        showNotification('Analiz hatası: ' + e.message, 'error');
      }
    });
  }
}

/**
 * Button'ı tab ismi ile güncelle (veri kaydedildikten sonra)
 * @param {HTMLElement} button - Güncellenecek button
 * @param {string} type - Button tipi ('session' veya 'conversion')
 */
function updateButtonWithTabName(button, type) {
  const results = getReportInfo();
  if (!results.success) return;
  
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  const reportName = results.data.reportName;
  
  if (storedData[reportName]) {
    const dataKey = type === 'session' ? 'sessionData' : 'conversionData';
    const data = storedData[reportName][dataKey];
    
    if (data && data.tabName) {
      // Button içindeki subtitle'ı bul ve güncelle
      const subtitle = button.querySelector('.button-subtitle');
      if (subtitle) {
        // Tab ismindeki index kısmını kaldır ve sadece ismi göster
        const cleanTabName = data.tabName.includes('-') ? data.tabName.split('-')[1] : data.tabName;
        subtitle.textContent = cleanTabName;
      }
      
      // Button'a başarı efekti ekle
      button.style.transform = 'scale(1.05)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 200);

    }
  }
}
// Ana buton durumunu güncelle - yeni yapıda sadece CSS stillerini kontrol eder
function updateButtonState(buttonContainer) {
  const results = getReportInfo();
  if (results.success) {
    // Ana konteyner bul
    const mainContainer = buttonContainer.closest('.ga4-abtest-main-container') || 
                          buttonContainer.querySelector('.ga4-abtest-main-container') ||
                          buttonContainer;
    
    // Sadece CSS stillerini ekle
    checkKPIDataAndUpdateButton(mainContainer, results.data.tableData, results.data);
    
    // Storage durumunu konsola yazdır (debug için)
    const storageData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    // console.log('Mevcut storage verisi:', storageData);
  }
}

