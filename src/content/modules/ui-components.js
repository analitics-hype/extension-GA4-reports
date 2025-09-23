import { getReportInfo } from './data-extraction.js';
import { checkKPIDataAndUpdateButton, prepareAnalysisData, prepareDirectAnalysisData, saveKPIData, consolidateData } from './data-processing.js';
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
  
  console.log('📅 [DEBUG] formatData - Tarih formatlanıyor:', {
    reportName: reportName,
    dateRange: dateRange,
    periodCount: data.periodCount
  });
  
  // Konsolide edilmiş veri ise dateRange'i kontrol et
  let actualDateRange = dateRange;
  
  // Eğer konsolide edilmiş veri varsa ve farklı bir tarih aralığı varsa onu kullan
  if (data.periodCount && data.periodCount > 1) {
    console.log('📅 [DEBUG] Konsolide edilmiş tarih aralığı kullanılıyor:', actualDateRange);
  }
  
  const testDuration = calculateTestDuration(actualDateRange);

  // testDuration'ı orijinal data objesine set et
  data.testDuration = testDuration;

  const dates = actualDateRange.split(' - ');
  if (dates.length !== 2) return null;

  const startDate = parseTurkishDate(dates[0]);
  const endDate = parseTurkishDate(dates[1]);
  
  // Tarihleri Türkçe formata çevir
  const formattedStartDate = formatDateTurkish(startDate);
  const formattedEndDate = formatDateTurkish(endDate);
  
  console.log('📅 [DEBUG] Formatlanmış tarihler:', {
    actualDateRange: actualDateRange,
    formattedStartDate: formattedStartDate,
    formattedEndDate: formattedEndDate,
    testDuration: testDuration
  });
  
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

  // Dışarı tıklama ve ESC tuşu ile kapatma özelliği
  function setupButtonGroupAutoClose() {
    // Dışarıya tıklama event listener'ı
    function handleOutsideClick(event) {
      // Eğer expandableContainer açık değilse, işlem yapma
      if (expandableContainer.classList.contains('collapsed')) {
        return;
      }
      
      // Eğer tıklanan element mainContainer içinde değilse, kapat
      if (!mainContainer.contains(event.target)) {
        console.log('📎 [DEBUG] Dışarıya tıklandı, buton grubu kapatılıyor');
        closeButtonGroup();
      }
    }
    
    // ESC tuşu ile kapatma
    function handleKeyPress(event) {
      if (event.key === 'Escape' && expandableContainer.classList.contains('expanded')) {
        console.log('📎 [DEBUG] ESC tuşu ile buton grubu kapatılıyor');
        closeButtonGroup();
      }
    }
    
    // Buton grubunu kapatma fonksiyonu
    function closeButtonGroup() {
      expandableContainer.classList.remove('expanded');
      expandableContainer.classList.add('collapsed');
      
      // Ana butonu yeniden göster ve close butonunu gizle
      hideCloseButton(mainContainer);
      
      // Arrow'u sıfırla
      const arrow = analyzeButton.querySelector('img');
      if (arrow) {
        arrow.style.transform = 'rotate(0deg)';
      }
    }
    
    // Event listener'ları ekle
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyPress);
    
    // Cleanup için fonksiyonları kaydet
    mainContainer._autoCloseListeners = {
      outsideClick: handleOutsideClick,
      keyPress: handleKeyPress,
      close: closeButtonGroup
    };
  }
  
  // Auto-close özelliğini başlat
  setupButtonGroupAutoClose();

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

      console.log('🔍 [DEBUG] Buton tıklandı:', {
        buttonMode: button.dataset.mode,
        reportData: results.data,
        currentTime: new Date().toISOString()
      });

      // Buton tipine göre işlem yap
      switch (button.dataset.mode) {
        case 'session':
          console.log('📥 [DEBUG] Session butonu - Veri kaydediliyor...');
          saveKPIData(results.data, results.data.tableData, 'session');
          // Button'ı tab ismi ile güncelle
          updateButtonWithTabName(button, 'session');
          break;
        case 'conversion':
          console.log('📥 [DEBUG] Conversion butonu - Veri kaydediliyor...');
          saveKPIData(results.data, results.data.tableData, 'conversion');
          // Button'ı tab ismi ile güncelle
          updateButtonWithTabName(button, 'conversion');
          break;
        case 'topla':
          console.log('🔗 [DEBUG] Topla butonu tıklandı - Session storage içeriği:');
          try {
            const currentStorage = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
            console.log('📦 [DEBUG] Mevcut session storage:', currentStorage);
            
            const reportName = results.data.reportName;
            const reportData = currentStorage[reportName];
            
            if (!reportData || !reportData.sessionData || !reportData.conversionData) {
              showNotification('Toplamak için hem session hem de conversion verisi gerekli!', 'error');
              break;
            }
            
            // Veriyi konsolide et
            const consolidatedData = consolidateData(reportData);
            
            // Konsolide edilmiş veriyi storage'a kaydet
            currentStorage[reportName].consolidatedData = consolidatedData;
            sessionStorage.setItem('ga4_abtest_data', JSON.stringify(currentStorage));
            
            console.log('🔗 [DEBUG] Konsolidasyon tamamlandı:', consolidatedData);
            
            // Topla butonunu güncelle - tarih aralığını göster
            updateToplaButton(button, consolidatedData.dateRange, consolidatedData.periodCount);
            
            // Analiz Et butonunu aktif et
            setTimeout(() => updateButtonState(mainContainer), 100);
            
            showNotification(`${consolidatedData.periodCount} dönem birleştirildi: ${consolidatedData.dateRange}`, 'success');
            
          } catch (error) {
            console.error('🔗 [DEBUG] Topla hatası:', error);
            showNotification('Toplarken hata oluştu: ' + error.message, 'error');
          }
          break;
        case 'temizle':
          console.log('🗑️ [DEBUG] Temizle butonu - Session storage temizleniyor...');
          try {
            const currentStorage = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
            console.log('📦 [DEBUG] Temizlenmeden önce storage:', currentStorage);
            
            const reportName = results.data.reportName;
            
            // Sadece mevcut rapor için temizleme yap
            if (currentStorage[reportName]) {
              delete currentStorage[reportName];
              sessionStorage.setItem('ga4_abtest_data', JSON.stringify(currentStorage));
              console.log('✅ [DEBUG] Rapor verisi temizlendi:', reportName);
              showNotification(`"${reportName}" raporu temizlendi`, 'success');
            } else {
              console.log('ℹ️ [DEBUG] Temizlenecek veri bulunamadı');
              showNotification('Temizlenecek veri bulunamadı', 'info');
            }
            
            // Temizleme sonrası buton durumunu güncelle
            setTimeout(() => updateButtonState(mainContainer), 100);
            
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

          const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
          console.log("Analiz için hazırlanan veri: ", storedData);
          const analysisData = prepareAnalysisData(storedData);
          const analysis = await analyzeABTest(analysisData);
          
          console.log('🔍 [DEBUG] displayResults çağrısı hazırlanıyor:', {
            currentDateRange: results.data.dateRange,
            analysisDataRange: analysisData.dateRange,
            periodCount: analysisData.periodCount
          });

          displayResults(
            document.getElementById('ga4-abtest-content'),
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

      // Buton tıklama sonrası grup otomatik kapanma
      if (button.dataset.mode !== 'analyze' && button.dataset.mode !== 'analyze-direct') {
        // Session Al, Dönüşüm Al, Topla, Temizle butonları için grup kapat
        console.log('📎 [DEBUG] Buton işlemi tamamlandı, grup kapatılıyor:', button.dataset.mode);
        setTimeout(() => {
          if (mainContainer._autoCloseListeners) {
            mainContainer._autoCloseListeners.close();
          }
        }, 500); // 500ms bekle ki kullanıcı işlemi görsün
      }

      // Popup'ı göster (analiz durumlarında)
      if (button.dataset.mode === 'analyze' || button.dataset.mode === 'analyze-direct') {
        document.getElementById('ga4-abtest-overlay').style.display = 'block';
        document.getElementById('ga4-abtest-results').style.display = 'flex';
        
        // Analiz popup açıldığında da grup kapat
        console.log('📎 [DEBUG] Analiz popup açıldı, grup kapatılıyor');
        setTimeout(() => {
          if (mainContainer._autoCloseListeners) {
            mainContainer._autoCloseListeners.close();
          }
        }, 300);
      }

      // İşlem sonrası storage durumunu konsola yazdır
      const storageData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
      if (button.dataset.mode === 'analyze' || button.dataset.mode === 'analyze-direct') {
        console.log('AB Test Analiz Et butonuna tıklandı. Storage verisi:', storageData);
      }

    } catch (error) {
      console.error('İşlem hatası:', error);
      showNotification('İşlem sırasında bir hata oluştu: ' + error.message, 'error');
      
      // Hata durumunda da kapat
      setTimeout(() => {
        if (mainContainer._autoCloseListeners) {
          mainContainer._autoCloseListeners.close();
        }
      }, 1500);
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
  
  // Her açılışta Topla butonunun durumunu güncelle
  setTimeout(() => {
    const toplaButton = container.querySelector('.topla-button');
    if (toplaButton) {
      const results = getReportInfo();
      if (results.success) {
        const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
        const reportData = storedData[results.data.reportName];
        
        if (reportData && reportData.consolidatedData) {
          console.log('🔄 [DEBUG] Buton grubu açılışında Topla butonu güncelleniyor');
          updateToplaButton(toplaButton, reportData.consolidatedData.dateRange, reportData.consolidatedData.periodCount);
        }
      }
    }
  }, 100);
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
    
    // İlk oluşturulduğunda mevcut consolidatedData kontrolü
    const results = getReportInfo();
    if (results.success) {
      const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
      const reportData = storedData[results.data.reportName];
      
      // Eğer consolidatedData varsa butonu güncelle
      if (reportData && reportData.consolidatedData) {
        console.log('🔄 [DEBUG] İlk oluşturma sırasında consolidatedData bulundu, buton güncelleniyor');
        updateToplaButton(toplaButton, reportData.consolidatedData.dateRange, reportData.consolidatedData.periodCount);
      }
    }
    
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
 * Topla butonuna tooltip ekle - periods listesini göster
 * @param {HTMLElement} button - Topla butonu
 */
function addTooltipToButton(button) {
  // Tooltip elementini oluştur
  const tooltip = document.createElement('div');
  tooltip.className = 'topla-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    background: white;
    color: #333;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 12px;
    z-index: 10000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    max-width: 300px;
    white-space: normal;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid #e0e0e0;
  `;
  
  // Arrow oku ekle
  const arrow = document.createElement('div');
  arrow.className = 'tooltip-arrow';
  arrow.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid white;
    margin-bottom: -1px;
  `;
  tooltip.appendChild(arrow);
  
  // Arrow border (gölge için)
  const arrowBorder = document.createElement('div');
  arrowBorder.className = 'tooltip-arrow-border';
  arrowBorder.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-bottom: 7px solid #e0e0e0;
    margin-bottom: 0px;
  `;
  tooltip.appendChild(arrowBorder);
  
  // Tooltip'i body'e ekle (overflow problemini önlemek için)
  document.body.appendChild(tooltip);
  
  // Tooltip pozisyon hesaplama fonksiyonu
  function updateTooltipPosition() {
    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const arrowElement = tooltip.querySelector('.tooltip-arrow');
    const arrowBorderElement = tooltip.querySelector('.tooltip-arrow-border');
    
    // Butonun altında ortalayarak konumlandır
    let left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
    let top = buttonRect.bottom + 8; // 8px boşluk
    
    // Ekran sınırları kontrolü
    if (left < 10) {
      left = 10;
    } else if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    
    if (top + tooltipRect.height > window.innerHeight - 10) {
      // Eğer altında yer yoksa, üstte göster
      top = buttonRect.top - tooltipRect.height - 8;
      // Arrow'u ters çevir (tooltip üstteyken arrow aşağı bakar)
      if (arrowElement) {
        arrowElement.style.bottom = 'auto';
        arrowElement.style.top = '100%';
        arrowElement.style.borderBottom = 'none';
        arrowElement.style.borderTop = '6px solid white';
        arrowElement.style.marginTop = '-1px';
        arrowElement.style.marginBottom = 'auto';
      }
      
      // Arrow border'ı da güncelle
      if (arrowBorderElement) {
        arrowBorderElement.style.bottom = 'auto';
        arrowBorderElement.style.top = '100%';
        arrowBorderElement.style.borderBottom = 'none';
        arrowBorderElement.style.borderTop = '7px solid #e0e0e0';
        arrowBorderElement.style.marginTop = '0px';
        arrowBorderElement.style.marginBottom = 'auto';
      }
    } else {
      // Normal pozisyon (altta) - arrow tooltip'in üstünde, aşağı bakar
      if (arrowElement) {
        arrowElement.style.top = 'auto';
        arrowElement.style.bottom = '100%';
        arrowElement.style.borderTop = 'none';
        arrowElement.style.borderBottom = '6px solid white';
        arrowElement.style.marginBottom = '-1px';
        arrowElement.style.marginTop = 'auto';
      }
      
      // Arrow border'ı da güncelle
      if (arrowBorderElement) {
        arrowBorderElement.style.top = 'auto';
        arrowBorderElement.style.bottom = '100%';
        arrowBorderElement.style.borderTop = 'none';
        arrowBorderElement.style.borderBottom = '7px solid #e0e0e0';
        arrowBorderElement.style.marginBottom = '0px';
        arrowBorderElement.style.marginTop = 'auto';
      }
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  
  // Mouse events
  button.addEventListener('mouseenter', () => {
    updateTooltipContent(tooltip);
    updateTooltipPosition();
    
    // Position güncellendikten sonra göster
    setTimeout(() => {
      tooltip.style.opacity = '1';
    }, 10);
  });
  
  button.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
  });
  
  // Scroll ve resize durumlarında pozisyonu güncelle
  window.addEventListener('scroll', () => {
    if (tooltip.style.opacity === '1') {
      updateTooltipPosition();
    }
  });
  
  window.addEventListener('resize', () => {
    if (tooltip.style.opacity === '1') {
      updateTooltipPosition();
    }
  });
  
  // Cleanup için tooltip referansını button'a kaydet
  button._tooltip = tooltip;
}

/**
 * Tooltip içeriğini güncelle
 * @param {HTMLElement} tooltip - Tooltip elementi
 */
function updateTooltipContent(tooltip) {
  const results = getReportInfo();
  if (!results.success) return;
  
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  const reportData = storedData[results.data.reportName];
  
  if (!reportData) {
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; color: #333;">Başlangıç ve bitiş aralığı</div>
      <div style="color: #999;">Henüz veri eklenmedi</div>
    `;
    tooltip.style.opacity = '1';
    return;
  }
  
  let periodsToShow = [];
  
  // Periods array'dan verileri al
  if (reportData.periods && reportData.periods.length > 0) {
    reportData.periods.forEach((period, index) => {
      periodsToShow.push({
        index: index + 1,
        dateRange: period.dateRange
      });
    });
  }
  
  // Mevcut session/conversion verilerini ekle (eğer periods'ta yoksa)
  if (reportData.sessionData && reportData.conversionData) {
    const currentDateRange = reportData.sessionData.dateRange;
    const existsInPeriods = periodsToShow.some(p => p.dateRange === currentDateRange);
    
    if (!existsInPeriods) {
      periodsToShow.push({
        index: periodsToShow.length + 1,
        dateRange: currentDateRange
      });
    }
  }
  
  // Konsolide edilmiş veri varsa onu da göster
  let consolidatedInfo = '';
  if (reportData.consolidatedData) {
    consolidatedInfo = `
      <div style="border-top: 1px solid #e0e0e0; margin-top: 8px; padding-top: 8px;">
        <div style="font-weight: bold; color: #2196F3;">Birleştirilmiş:</div>
        <div style="color: #333;">${reportData.consolidatedData.dateRange}</div>
        <div style="font-size: 10px; color: #666;">${reportData.consolidatedData.periodCount} dönem</div>
      </div>
    `;
  }
  
  // Tooltip içeriği
  tooltip.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #333;">Başlangıç ve bitiş aralığı</div>
    ${periodsToShow.length > 0 ? 
      periodsToShow.map(period => `
        <div style="margin-bottom: 4px; color: #333;">
          <span style="display: inline-block; width: 20px; color: #2196F3; font-weight: bold;">${String(period.index).padStart(2, '0')}</span>
          ${formatDateRangeForTooltip(period.dateRange)}
        </div>
      `).join('') :
      '<div style="color: #999;">Henüz veri eklenmedi</div>'
    }
    ${consolidatedInfo}
  `;
  
  tooltip.style.opacity = '1';
}

/**
 * Tarih aralığını tooltip için formatla
 * @param {string} dateRange - Orijinal tarih aralığı
 * @returns {string} Formatlanmış tarih aralığı
 */
function formatDateRangeForTooltip(dateRange) {
  try {
    // "Aug 24 - Aug 31, 2025" formatını "24.08.2025 - 31.08.2025" formatına çevir
    const [start, end] = dateRange.split(' - ');
    const startFormatted = formatSingleDateForTooltip(start.trim());
    const endFormatted = formatSingleDateForTooltip(end.trim());
    
    return `${startFormatted} - ${endFormatted}`;
  } catch (error) {
    console.warn('Tarih formatlanırken hata:', error);
    return dateRange; // Hata durumunda orijinal formatı döndür
  }
}

/**
 * Tek tarihi tooltip için formatla
 * @param {string} dateStr - "Aug 24" veya "Aug 31, 2025" formatında tarih
 * @returns {string} "24.08.2025" formatında tarih
 */
function formatSingleDateForTooltip(dateStr) {
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  // "Aug 31, 2025" veya "Aug 31" formatını parse et
  const parts = dateStr.split(' ');
  if (parts.length >= 2) {
    const monthName = parts[0];
    const day = parts[1].replace(',', '');
    const year = parts[2] || '2025'; // Eğer yıl yoksa 2025 varsayımı
    
    if (months[monthName]) {
      return `${day.padStart(2, '0')}.${months[monthName]}.${year}`;
    }
  }
  
  return dateStr; // Parse edilemezse orijinal formatı döndür
}

/**
 * Topla butonunu güncelle - tarih aralığını göster ve tooltip'i güncelle
 * @param {HTMLElement} button - Topla butonu
 * @param {string} dateRange - Birleştirilmiş tarih aralığı
 * @param {number} periodCount - Birleştirilen dönem sayısı
 */
function updateToplaButton(button, dateRange, periodCount) {
  console.log('🔄 [DEBUG] Topla butonu güncelleniyor:', { dateRange, periodCount });
  
  // Button içeriğini güncelle
  const buttonContent = button.querySelector('.button-content');
  if (buttonContent) {
    const textContainer = buttonContent.querySelector('.button-text');
    if (textContainer) {
      // Mevcut title'ı bul veya oluştur
      let titleElement = textContainer.querySelector('.button-title');
      if (!titleElement) {
        titleElement = document.createElement('span');
        titleElement.className = 'button-title';
        textContainer.appendChild(titleElement);
      }
      
      // Subtitle'ı bul veya oluştur
      let subtitleElement = textContainer.querySelector('.button-subtitle');
      if (!subtitleElement) {
        subtitleElement = document.createElement('span');
        subtitleElement.className = 'button-subtitle';
        textContainer.appendChild(subtitleElement);
      }
      
      // İçerikleri güncelle
      titleElement.textContent = 'Topla';
      subtitleElement.textContent = `${periodCount} dönem: ${dateRange}`;
      subtitleElement.style.fontSize = '10px';
      subtitleElement.style.color = '#666';
      subtitleElement.style.marginTop = '2px';
      subtitleElement.style.maxWidth = '120px';
      subtitleElement.style.overflow = 'hidden';
      subtitleElement.style.textOverflow = 'ellipsis';
      subtitleElement.style.whiteSpace = 'nowrap';
      
      console.log('🔄 [DEBUG] Topla butonu güncellendi');
    }
  }
  
  // Tooltip içeriğini de güncelle (eğer varsa)
  const tooltip = button.querySelector('.topla-tooltip');
  if (tooltip) {
    updateTooltipContent(tooltip);
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
<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="none">
  <g clip-path="url(#clip0_38_318)">
    <path d="M28.1924 9.80763C26.3743 7.98954 24.0579 6.75141 21.5362 6.24981C19.0144 5.7482 16.4006 6.00564 14.0251 6.98958C11.6497 7.97352 9.61936 9.63976 8.1909 11.7776C6.76244 13.9154 6 16.4289 6 19C6 21.5712 6.76244 24.0846 8.1909 26.2224C9.61936 28.3603 11.6497 30.0265 14.0251 31.0105C16.4006 31.9944 19.0144 32.2518 21.5362 31.7502C24.0579 31.2486 26.3743 30.0105 28.1924 28.1924C30.6269 25.7526 31.9942 22.4467 31.9942 19C31.9942 15.5533 30.6269 12.2474 28.1924 9.80763ZM11.3397 26.6603C9.82461 25.1453 8.79283 23.215 8.37483 21.1135C7.95682 19.012 8.17136 16.8338 8.99131 14.8543C9.81126 12.8747 11.1998 11.1828 12.9813 9.99243C14.7629 8.80205 16.8574 8.16668 19 8.16668C21.1426 8.16668 23.2371 8.80205 25.0187 9.99243C26.8002 11.1828 28.1888 12.8747 29.0087 14.8543C29.8286 16.8338 30.0432 19.012 29.6252 21.1135C29.2072 23.215 28.1754 25.1453 26.6603 26.6603C24.6271 28.6891 21.8722 29.8284 19 29.8284C16.1278 29.8284 13.3729 28.6891 11.3397 26.6603ZM22.8302 22.8302C22.627 23.0333 22.3515 23.1475 22.0641 23.1475C21.7768 23.1475 21.5013 23.0333 21.2981 22.8302L19 20.5321L16.7019 22.8302C16.4987 23.0333 16.2232 23.1475 15.9359 23.1475C15.6486 23.1475 15.373 23.0333 15.1698 22.8302C14.9667 22.627 14.8525 22.3515 14.8525 22.0641C14.8525 21.7768 14.9667 21.5013 15.1698 21.2981L17.4679 19L15.1698 16.7019C14.9667 16.4988 14.8525 16.2232 14.8525 15.9359C14.8525 15.6486 14.9667 15.373 15.1698 15.1699C15.373 14.9667 15.6486 14.8526 15.9359 14.8526C16.2232 14.8526 16.4987 14.9667 16.7019 15.1699L19 17.468L21.2981 15.1699C21.5013 14.9667 21.7768 14.8526 22.0641 14.8526C22.3515 14.8526 22.627 14.9667 22.8302 15.1699C23.0333 15.373 23.1475 15.6486 23.1475 15.9359C23.1475 16.2232 23.0333 16.4988 22.8302 16.7019L20.5321 19L22.8302 21.2981C23.0333 21.5013 23.1475 21.7768 23.1475 22.0641C23.1475 22.3515 23.0333 22.627 22.8302 22.8302Z" fill="#E45E5E"/>
  </g>
  <defs>
    <clipPath id="clip0_38_318">
      <rect width="26" height="26" fill="white" transform="translate(19 0.615234) rotate(135)"/>
    </clipPath>
  </defs>
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

