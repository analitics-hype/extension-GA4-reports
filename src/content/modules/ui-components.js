import { getReportInfo } from './data-extraction.js';
import { checkKPIDataAndUpdateButton, prepareAnalysisData, prepareDirectAnalysisData, saveKPIData } from './data-processing.js';
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

  // testDuration'ı orijinal data objesine set et
  data.testDuration = testDuration;

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
 * A/B Test analiz butonunu ve popup'ını sayfaya ekle
 * Ana buton tıklandığında animasyonla diğer butonlar gösterilir
 */
export function injectAnalyzeButton() {

  
  // Eğer butonlar zaten varsa tekrar ekleme
  if (document.querySelector('.ga4-abtest-main-container')) {
    return;
  }

  // Ana konteyner oluştur
  const mainContainer = document.createElement('div');
  mainContainer.className = 'ga4-abtest-main-container';
  
  // Ana analiz butonu (yeşil buton)
  const analyzeButton = document.createElement('div');
  analyzeButton.className = 'ga4-abtest-analyze-button';
  analyzeButton.innerHTML = `
    <button class="ga4-abtest-button analyze-main">
      <span>A/B Test Analizi</span>
      <img src="https://useruploads.vwo.io/useruploads/529944/images/6d6d2d6df0f82d5d42fe6485708e4ec8_add81.svg?timestamp=1756366118182" >
    </button>
  `;
  
  // Genişleyebilir butonlar konteyneri (başlangıçta gizli)
  const expandableContainer = document.createElement('div');
  expandableContainer.className = 'ga4-abtest-expandable-buttons collapsed';
  
  // Konteynerleri ana konteyner'a ekle
  mainContainer.appendChild(analyzeButton);
  mainContainer.appendChild(expandableContainer);
  
  // Ana konteyner'ı header'a ekle
  const headerSpacer = document.querySelector('.gmp-header-spacer');
  
  if (headerSpacer) {
    headerSpacer.parentNode.insertBefore(mainContainer, headerSpacer.nextSibling);
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
      console.log('Crosstab bulundu, observer başlatılıyor');
      observer.observe(contentArea, { 
        childList: true, 
        subtree: true,
        characterData: true,
        attributes: true
      });
      // İlk durumu ayarla
      updateButtonState(mainContainer);
    } else {
      console.log('Crosstab bekleniyor...');
      setTimeout(setupObserver, 500);
    }
  }

  // Tüm elementlerin yüklenmesini bekle
  waitForAllElements((loaded) => {
    if (loaded) {
      mainContainer.style.display = 'inline-flex';
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

  // Ana buton tıklama fonksiyonu - animasyonla diğer butonları göster/gizle
  analyzeButton.addEventListener('click', (event) => {
    // Eğer tıklanan element analiz butonu değilse, normal analiz işlemini yap
    if (!event.target.closest('.analyze-main')) {
      return;
    }
    
    const isCollapsed = expandableContainer.classList.contains('collapsed');
    const arrow = analyzeButton.querySelector('img');
    
    if (isCollapsed) {
      // Genişletme animasyonu
      expandableContainer.classList.remove('collapsed');
      expandableContainer.classList.add('expanded');
      arrow.style.transform = 'rotate(90deg)';
      
      // Ana buton gizle ve çarpı ikonu göster
      analyzeButton.style.display = 'none';
      showCloseButton(mainContainer);

      
      // Mevcut KPI verilerini kontrol et ve gerekli butonları ekle
      const results = getReportInfo();
      if (results.success) {
        addDataButtons(expandableContainer, results.data.tableData, results.data);
      }
    } else {
      // Daraltma animasyonu
      expandableContainer.classList.remove('expanded');
      expandableContainer.classList.add('collapsed');
      arrow.style.transform = 'rotate(0deg)';
    }
  });

  // Genişleyebilir konteyner buton tıklamalarını dinle
  expandableContainer.addEventListener('click', async (event) => {
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
          // Button'ı tab ismi ile güncelle
          updateButtonWithTabName(button, 'session');
          break;
        case 'conversion':
          saveKPIData(results.data, results.data.tableData, 'conversion');
          // Button'ı tab ismi ile güncelle
          updateButtonWithTabName(button, 'conversion');
          break;
        case 'topla':
          // Veri toplama fonksiyonu - gelecekte genişletilebilir
          showNotification('Topla özelliği başarıyla çalıştı', 'success');
          break;
        case 'temizle':
          // Veri temizleme fonksiyonu
          sessionStorage.removeItem('ga4_abtest_data');
          showNotification('Tüm veriler temizlendi', 'success');
          // Temizleme sonrası buton durumunu güncelle
          setTimeout(() => updateButtonState(mainContainer), 100);
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

/**
 * Veri butonlarını (Session Al, Dönüşüm Al, Analiz Et) genişleyebilir konteynere ekle
 * @param {HTMLElement} container - Genişleyebilir konteyner
 * @param {Object} tableData - Tablo verileri  
 * @param {Object} reportInfo - Rapor bilgileri
 */
function addDataButtons(container, tableData, reportInfo) {
  // Mevcut tüm butonları temizle
  const existingButtons = container.querySelectorAll('.ga4-abtest-button');
  existingButtons.forEach(button => button.remove());

  // Storage'dan mevcut verileri al
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  const currentKPIs = tableData.kpis;

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
  // Topla ve Temizle butonlarını ekle (eğer yoksa)
  const hasTopla = container.querySelector('.topla-button');
  const hasTemizle = container.querySelector('.temizle-button');
  
  if (!hasTopla) {
    const toplaButton = createButton('Topla', 'topla');
    toplaButton.classList.add('topla-button');
    
    // Button içeriği container'ı
    const toplaContent = document.createElement('div');
    toplaContent.className = 'button-content';
    
    // Icon
    const toplaImg = document.createElement('img');
    toplaImg.src = "https://useruploads.vwo.io/useruploads/529944/images/5316b95da0557fd6cce236e3f4c5ad9a_group402515603.svg";
    toplaImg.className = 'button-icon';
    toplaImg.alt = 'Topla icon';
    
    // Text container (sadece title, subtitle yok)
    const toplaTextContainer = document.createElement('div');
    toplaTextContainer.className = 'button-text';
    
    // Main title
    const toplaTitle = document.createElement('span');
    toplaTitle.className = 'button-title';
    toplaTitle.textContent = 'Topla';
    
    // Assemble text container
    toplaTextContainer.appendChild(toplaTitle);
    
    // Assemble button content
    toplaContent.appendChild(toplaImg);
    toplaContent.appendChild(toplaTextContainer);
    
    // Clear button and add new content
    toplaButton.innerHTML = '';
    toplaButton.appendChild(toplaContent);
    
    // Add tooltip with dynamic date information
    addTooltipToButton(toplaButton);
    
    container.appendChild(toplaButton);
  }
  
  if (!hasTemizle) {
    const temizleButton = createButton('Temizle', 'temizle');
    temizleButton.classList.add('temizle-button');
    
    // Button içeriği container'ı
    const temizleContent = document.createElement('div');
    temizleContent.className = 'button-content';
    
    // Icon
    const temizleImg = document.createElement('img');
    temizleImg.src = "https://useruploads.vwo.io/useruploads/529944/images/c7353fa6be18961df1d8296d409b2789_group402515604.svg";
    temizleImg.className = 'button-icon';
    temizleImg.alt = 'Temizle icon';
    
    // Text container (sadece title, subtitle yok)
    const temizleTextContainer = document.createElement('div');
    temizleTextContainer.className = 'button-text';
    
    // Main title
    const temizleTitle = document.createElement('span');
    temizleTitle.className = 'button-title';
    temizleTitle.textContent = 'Temizle';
    
    // Assemble text container
    temizleTextContainer.appendChild(temizleTitle);
    
    // Assemble button content
    temizleContent.appendChild(temizleImg);
    temizleContent.appendChild(temizleTextContainer);
    
    // Clear button and add new content
    temizleButton.innerHTML = '';
    temizleButton.appendChild(temizleContent);
    
    container.appendChild(temizleButton);
  }
  
  // AB Test Analiz Et butonunu en sona ekle
  const hasAnalyze = container.querySelector('.ga4-abtest-button.analyze:not(.analyze-main):not(.analyze-direct)');
  
  if (!hasAnalyze) {
    // Storage'dan mevcut verileri al
    const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    
    // Rapor bilgilerini al
    const results = getReportInfo();
    if (results.success) {
      const reportInfo = results.data;
      
      // Analiz Et butonu
      const analyzeDataButton = createButton('Analiz Et', 'analyze');
      analyzeDataButton.disabled = !(storedData[reportInfo.reportName] && storedData[reportInfo.reportName].sessionData && storedData[reportInfo.reportName].conversionData);
      if (analyzeDataButton.disabled) {
          analyzeDataButton.classList.add('disabled');
      }
      
      container.appendChild(analyzeDataButton);
    }
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

/**
 * Button'a dinamik tooltip ekle
 * @param {HTMLElement} button - Tooltip eklenecek button
 */
function addTooltipToButton(button) {
  const results = getReportInfo();
  if (!results.success) {
    return; // Tarih bilgisi alınamazsa tooltip ekleme
  }
  
  const dateRange = results.data.dateRange;
  const dates = dateRange.split(' - ');
  
  if (dates.length === 2) {
    const startDate = dates[0].trim();
    const endDate = dates[1].trim();
    
    // Tooltip içeriği oluştur
    const tooltipContent = `Başlangıç ve bitiş aralığı\n${startDate} - ${endDate}`;
    
    // Tooltip container oluştur
    const tooltip = document.createElement('div');
    tooltip.className = 'ga4-tooltip';
    tooltip.textContent = tooltipContent;
    
    // Button'a tooltip ekle
    button.style.position = 'relative';
    button.appendChild(tooltip);
    
    // Hover event'ları ekle
    button.addEventListener('mouseenter', () => {
      tooltip.style.visibility = 'visible';
      tooltip.style.opacity = '1';
    });
    
    button.addEventListener('mouseleave', () => {
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
    });
  }
}

/**
 * Close button'u göster (Ana analiz butonu gizlendiğinde)
 * @param {HTMLElement} mainContainer - Ana konteyner
 */
function showCloseButton(mainContainer) {
  // Eğer zaten varsa, tekrar ekleme
  if (mainContainer.querySelector('.ga4-abtest-close-button')) {
    return;
  }
  
  // Close button oluştur
  const closeButton = document.createElement('div');
  closeButton.className = 'ga4-abtest-close-button';
  closeButton.innerHTML = `
    <button class="ga4-abtest-button close-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
  
  // Ana konteyner'a ekle
  mainContainer.appendChild(closeButton);
  
  // Click event ekle
  closeButton.addEventListener('click', () => {
    hideCloseButton(mainContainer);
  });
}

/**
 * Close button'u gizle ve ana analiz butonunu göster
 * @param {HTMLElement} mainContainer - Ana konteyner
 */
function hideCloseButton(mainContainer) {
  // Close button'u kaldır
  const closeButton = mainContainer.querySelector('.ga4-abtest-close-button');
  if (closeButton) {
    closeButton.remove();
  }
  
  // Ana analiz butonunu göster
  const analyzeButton = mainContainer.querySelector('.ga4-abtest-analyze-button');
  if (analyzeButton) {
    analyzeButton.style.display = 'inline-flex';
  }
  
  // Expandable container'ı kapat
  const expandableContainer = mainContainer.querySelector('.ga4-abtest-expandable-buttons');
  if (expandableContainer) {
    expandableContainer.classList.remove('expanded');
    expandableContainer.classList.add('collapsed');
    
    // Arrow'u sıfırla
    const arrow = analyzeButton.querySelector('img');
    if (arrow) {
      arrow.style.transform = 'rotate(0deg)';
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
    console.log('Mevcut storage verisi:', storageData);
  }
}

