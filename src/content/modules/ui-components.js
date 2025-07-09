import { getReportInfo } from './data-extraction.js';
import { checkKPIDataAndUpdateButton, prepareAnalysisData, prepareDirectAnalysisData, saveKPIData } from './data-processing.js';
import { formatDateTurkish, parseTurkishDate } from './date-utils.js';
import { waitForAllElements } from './dom-helpers.js';
import { setupResultEventListeners } from './event-handlers.js';
import { analyzeABTest, calculateSignificance, calculateTestDuration, calculateBinaryWinnerProbabilities, calculateExtraTransactions } from './statistics.js';
import { getResultsTemplate } from './templates.js';
/**
 * UI bileşenleri ile ilgili fonksiyonlar
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
    
    // Binary winner probabilities hesapla ve control significance güncelle
    const binaryWinnerProbabilities = await calculateBinaryWinnerProbabilities(data.analysis);
    if (binaryWinnerProbabilities && binaryWinnerProbabilities.length > 0) {
      // Calculate average control win probability across all binary comparisons
      const avgControlWinProb = binaryWinnerProbabilities.reduce((sum, result) => 
        sum + result.controlWinProbability, 0) / binaryWinnerProbabilities.length;
      
      // Update control row significance (6th column now)
      const controlSignifCell = popup.querySelector('.control-row td:nth-child(6)');
      if (controlSignifCell) {
        controlSignifCell.textContent = `${(avgControlWinProb * 100).toFixed(1)}%`;
      }
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
  popup.querySelector('.control-row td:nth-child(6)').textContent = `${stats.controlProbability.toFixed(1)}%`;
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
  const templateData = await formatData(data);
  // HTML şablonunu ekle (async template function)
  const templateHtml = await getResultsTemplate(templateData);
  resultDiv.innerHTML = templateHtml;

  // Event listener'ları ekle
  setupResultEventListeners(resultDiv, data);
}

export async function formatData(data) {
  const { reportName, dateRange, analysis, bussinessImpact } = data;
  const testDuration = calculateTestDuration(dateRange);

  const dates = dateRange.split(' - ');
  if (dates.length !== 2) return null;

  const startDate = parseTurkishDate(dates[0]);
  const endDate = parseTurkishDate(dates[1]);
  
  // Tarihleri Türkçe formata çevir
  const formattedStartDate = formatDateTurkish(startDate);
  const formattedEndDate = formatDateTurkish(endDate);
  
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
    `${analysis.variants?.[0]?.stats?.controlProbability || (analysis.stats?.controlProbability || 0)}%`
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
 * Analiz butonunu ve sonuç popup'ını sayfaya ekle
 */
export function injectAnalyzeButton() {

  
  // Eğer butonlar zaten varsa tekrar ekleme
  if (document.querySelector('.ga4-abtest-buttons')) {
    return;
  }

  // Buton container'ı oluştur
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'ga4-abtest-buttons';
  
  // Container'ı header'a ekle
  const headerSpacer = document.querySelector('.gmp-header-spacer');
  
  if (headerSpacer) {
    headerSpacer.parentNode.insertBefore(buttonContainer, headerSpacer.nextSibling);

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
      setTimeout(() => updateButtonState(buttonContainer), 100);
    }
  });

  // Crosstab elementini bekle ve observer'ı başlat
  function setupObserver() {
    const contentArea = document.querySelector('.crosstab');

      
    if (contentArea) {
      console.log('Crosstab bulundu, observer başlatılıyor');
      observer.observe(contentArea, { 
        childList: true, 
        subtree: true,
        characterData: true,
        attributes: true
      });
      // İlk durumu ayarla
      updateButtonState(buttonContainer);
    } else {
      console.log('Crosstab bekleniyor...');
      setTimeout(setupObserver, 500);
    }
  }

  // Tüm elementlerin yüklenmesini bekle
  waitForAllElements((loaded) => {
    if (loaded) {
      buttonContainer.style.display = 'inline-flex';
      setupObserver(); // Observer'ı başlat
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

  // Buton tıklamalarını dinle
  buttonContainer.addEventListener('click', async (event) => {
    const button = event.target.closest('.ga4-abtest-button');
    if (!button) return;

    try {
      const results = getReportInfo();
      if (!results.success) {
        showNotification('Hata: ' + (results.error || 'Bilinmeyen bir hata oluştu'), 'error');
        return;
      }

      // Buton tipine göre işlem yap
      switch (button.dataset.mode) {
        case 'session':
          saveKPIData(results.data, results.data.tableData, 'session');
          break;
        case 'conversion':
          saveKPIData(results.data, results.data.tableData, 'conversion');
          break;
        case 'analyze':
          if (button.disabled) {
            showNotification('Analiz için hem session hem de dönüşüm verisi gerekli', 'error');
            return;
          }

          const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
          console.log("Analiz için hazırlanan veri: ", storedData);
          const analysisData = prepareAnalysisData(storedData);
          const analysis = await analyzeABTest(analysisData);
          
          displayResults(
            document.getElementById('ga4-abtest-content'),
            {
              reportName: results.data.reportName,
              dateRange: results.data.dateRange,
              sessionTab: analysisData.sessionTab.split('-')[1],
              conversionTab: analysisData.conversionTab.split('-')[1],
              analysis,
              bussinessImpact:""
            }
          );
          break;
        case 'analyze-direct':
          const directAnalysisData = prepareDirectAnalysisData(results.data.tableData);
          console.log("Doğrudan analiz için hazırlanan veri: ", directAnalysisData);
          const directAnalysis = analyzeABTest(directAnalysisData);
          displayResults(
            document.getElementById('ga4-abtest-content'),
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
        document.getElementById('ga4-abtest-overlay').style.display = 'block';
        document.getElementById('ga4-abtest-results').style.display = 'flex';
      }

      // İşlem sonrası storage durumunu konsola yazdır
      const storageData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
      if (button.dataset.mode === 'analyze' || button.dataset.mode === 'analyze-direct') {
        console.log('AB Test Analiz Et butonuna tıklandı. Storage verisi:', storageData);
      }

    } catch (error) {
      console.error('İşlem hatası:', error);
      showNotification('İşlem sırasında bir hata oluştu: ' + error.message, 'error');
    }
  });

  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    resultsPopup.style.display = 'none';
  });
}

// Buton durumunu güncelle
function updateButtonState(buttonContainer) {

  
  const results = getReportInfo();
  if (results.success) {
    checkKPIDataAndUpdateButton(buttonContainer, results.data.tableData, results.data);
    // Storage durumunu konsola yazdır
    const storageData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  }
}

