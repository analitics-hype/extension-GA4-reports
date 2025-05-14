/**
 * Veri işleme ile ilgili fonksiyonlar
 */

import { getTabName } from './data-extraction.js';
import { getResultsStyles } from './styles.js';
import { createButton, showNotification } from './ui-components.js';

/**
 * KPI verilerini kaydet
 * @param {Object} reportInfo - Rapor bilgileri
 * @param {Object} tableData - Tablo verileri
 * @param {string} type - Veri tipi (session veya conversion)
 */
export function saveKPIData(reportInfo, tableData, type) {
  try {
    const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    const currentKPI = tableData.kpis[0];
    const segments = tableData.segments;

    // Tab ismini al
    const tabName = getTabName();

    // Kontrol ve varyant gruplarını bul
    const control = segments.find(segment => 
      segment.segment.toLowerCase().includes('v0') || 
      segment.segment.toLowerCase().includes('control')
    );
    
    // Varyantları bul (v0 veya control içermeyen tüm segmentler)
    const variants = segments.filter(segment => 
      !(segment.segment.toLowerCase().includes('v0') || 
        segment.segment.toLowerCase().includes('control'))
    );

    if (!control || variants.length === 0) {
      throw new Error('Kontrol veya varyant grubu bulunamadı');
    }

    // Yeni veriyi hazırla
    const newData = {
      reportName: reportInfo.reportName,
      dateRange: reportInfo.dateRange,
      segments: reportInfo.segments,
      value: control.metrics[currentKPI],
      segment: control.segment,
      variants: variants.map(variant => ({
        segment: variant.segment,
        value: variant.metrics[currentKPI]
      })),
      tabName: tabName,
      bussinessImpact: "",
    };

    // Eğer bu rapor için veri yoksa, yeni bir nesne oluştur
    if (!storedData[reportInfo.reportName]) {
      storedData[reportInfo.reportName] = {};
    }

    // Veri tipine göre kaydet
    if (type === 'session') {
      storedData[reportInfo.reportName].sessionData = newData;
      // Sadece aynı tab'deki dönüşüm verisini temizle
      if (storedData[reportInfo.reportName].conversionData && 
          storedData[reportInfo.reportName].conversionData.tabName === tabName) {
        delete storedData[reportInfo.reportName].conversionData;
      }
    } else if (type === 'conversion') {
      storedData[reportInfo.reportName].conversionData = newData;
      // Sadece aynı tab'deki session verisini temizle
      if (storedData[reportInfo.reportName].sessionData && 
          storedData[reportInfo.reportName].sessionData.tabName === tabName) {
        delete storedData[reportInfo.reportName].sessionData;
      }
    }

    sessionStorage.setItem('ga4_abtest_data', JSON.stringify(storedData));
    showNotification(`${type === 'session' ? 'Session' : 'Dönüşüm'} verisi "${tabName}" tabında kaydedildi.`, 'success');

    // Butonları güncelle
    const buttonContainer = document.querySelector('.ga4-abtest-buttons');
    if (buttonContainer) {
      checkKPIDataAndUpdateButton(buttonContainer, tableData, reportInfo);
    }
  } catch (error) {
    console.error('KPI kaydetme hatası:', error);
    showNotification('Veri kaydedilirken bir hata oluştu: ' + error.message, 'error');
  }
}

/**
 * Analiz için verileri hazırla
 * @param {Object} storedData - Kaydedilmiş veriler
 * @returns {Object} Analiz için hazırlanmış veriler
 */
export function prepareAnalysisData(storedData) {
  const reportName = document.querySelector('.analysis-header-shared span')?.innerHTML.trim();
  if (!reportName) {
    throw new Error('Rapor ismi bulunamadı');
  }

  const reportData = storedData[reportName];
  if (!reportData || !reportData.sessionData || !reportData.conversionData) {
    throw new Error('Session ve dönüşüm verileri eksik');
  }

  const sessionData = reportData.sessionData;
  const conversionData = reportData.conversionData;

  // Control ve varyantları içeren segments arrayi oluştur
  const segments = [];
  
  // Kontrol grubu ekle
  segments.push({
    segment: sessionData.segment,
    metrics: {
      'Sessions': sessionData.value,
      'Conversions': conversionData.value
    }
  });
  
  // Tüm varyantları ekle
  for (let i = 0; i < sessionData.variants.length; i++) {
    const sessionVariant = sessionData.variants[i];
    const conversionVariant = conversionData.variants.find(v => v.segment === sessionVariant.segment);
    
    if (conversionVariant) {
      segments.push({
        segment: sessionVariant.segment,
        metrics: {
          'Sessions': sessionVariant.value,
          'Conversions': conversionVariant.value
        }
      });
    }
  }

  return {
    kpis: ['Sessions', 'Conversions'],
    segments: segments,
    sessionTab: sessionData.tabName,
    conversionTab: conversionData.tabName
  };
}

/**
 * İki KPI'lı tablo için analiz verilerini hazırla
 * @param {Object} tableData - Tablo verileri
 * @returns {Object} Analiz için hazırlanmış veriler
 */
export function prepareDirectAnalysisData(tableData) {
  const kpis = tableData.kpis;
  if (kpis.length !== 2) {
    throw new Error('Doğrudan analiz için tabloda tam olarak 2 KPI olmalıdır');
  }

  // Kontrol grubu (v0 veya control içeren)
  const control = tableData.segments.find(segment => 
    segment.segment.toLowerCase().includes('v0') || 
    segment.segment.toLowerCase().includes('control')
  );
  
  // Varyantlar (v0 veya control içermeyen tüm segmentler)
  const variants = tableData.segments.filter(segment => 
    !(segment.segment.toLowerCase().includes('v0') || 
      segment.segment.toLowerCase().includes('control'))
  );

  if (!control || variants.length === 0) {
    throw new Error('Kontrol veya varyant grubu bulunamadı');
  }

  // Segments array'ini oluştur
  const segments = [
    {
      segment: control.segment,
      metrics: {
        'Sessions': control.metrics[kpis[0]],
        'Conversions': control.metrics[kpis[1]]
      }
    }
  ];
  
  // Tüm varyantları ekle
  variants.forEach(variant => {
    segments.push({
      segment: variant.segment,
      metrics: {
        'Sessions': variant.metrics[kpis[0]],
        'Conversions': variant.metrics[kpis[1]]
      }
    });
  });

  return {
    kpis: ['Sessions', 'Conversions'],
    segments: segments
  };
}

/**
 * KPI verilerini kontrol et ve buton durumunu güncelle
 * @param {HTMLElement} buttonContainer - Buton konteyneri
 * @param {Object} tableData - Tablo verileri
 * @param {Object} reportInfo - Rapor bilgileri
 */
export function checkKPIDataAndUpdateButton(buttonContainer, tableData, reportInfo) {
  // Tüm butonları temizle
  buttonContainer.innerHTML = '';

  // Storage'dan mevcut verileri al
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  const currentKPIs = tableData.kpis;

  if (currentKPIs.length === 2) {
      // İki KPI varsa doğrudan analiz butonu
      const analyzeButton = createButton('AB Test Analiz Et', 'analyze-direct');
      buttonContainer.appendChild(analyzeButton);
  } else if (currentKPIs.length === 1) {
      // Session Al butonu
      const sessionButton = createButton('Session Al', 'session');
      if (storedData[reportInfo.reportName] && storedData[reportInfo.reportName].sessionData) {
          const sessionLabel = document.createElement('div');
          sessionLabel.className = 'button-label';
          sessionLabel.textContent = storedData[reportInfo.reportName].sessionData.tabName;
          sessionButton.appendChild(sessionLabel);
      }

      // Dönüşüm Al butonu
      const conversionButton = createButton('Dönüşüm Al', 'conversion');
      if (storedData[reportInfo.reportName] && storedData[reportInfo.reportName].conversionData) {
          const conversionLabel = document.createElement('div');
          conversionLabel.className = 'button-label';
          conversionLabel.textContent = storedData[reportInfo.reportName].conversionData.tabName;
          conversionButton.appendChild(conversionLabel);
      }

      // Analiz Et butonu
      const analyzeButton = createButton('AB Test Analiz Et', 'analyze');
      analyzeButton.disabled = !(storedData[reportInfo.reportName] && storedData[reportInfo.reportName].sessionData && storedData[reportInfo.reportName].conversionData);
      if (analyzeButton.disabled) {
          analyzeButton.classList.add('disabled');
      }

      buttonContainer.appendChild(sessionButton);
      buttonContainer.appendChild(conversionButton);
      buttonContainer.appendChild(analyzeButton);
  }

  // Buton stilleri için CSS ekle
  if (document.getElementById('ga4-abtest-button-style') === null) {
    
    const style = document.createElement('style');
    style.setAttribute('id', 'ga4-abtest-button-style');
    style.textContent = getResultsStyles();
    document.head.appendChild(style);
  }

}
