/**
 * A/B Test veri işleme ile ilgili fonksiyonlar
 * KPI verilerini kaydetme, analiz için hazırlama ve buton durumlarını yönetme
 */

import { getTabName } from './data-extraction.js';
import { getResultsStyles } from './styles.js';
import { createButton, showNotification } from './ui-components.js';

/**
 * KPI verilerini session storage'a kaydet
 * @param {Object} reportInfo - GA4 rapor bilgileri (isim, tarih aralığı vb.)
 * @param {Object} tableData - Tablo verileri (KPI'lar ve segment verileri)
 * @param {string} type - Veri tipi ('session' veya 'conversion')
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
    
    // Varyantları bul (v0, control içermeyen ve geçerli segmentler)
    const variants = segments.filter(segment => {
      const segmentLower = segment.segment.toLowerCase();
      return !(segmentLower.includes('v0') || segmentLower.includes('control')) && 
             (segmentLower.includes('v1') || 
              segmentLower.includes('v2') || 
              segmentLower.includes('v3') || 
              segmentLower.includes('variant') ||
              segmentLower.includes('totals')); // Totals'ı geçici olarak kabul et
    });

    if (!control) {
      console.error('Kontrol grubu bulunamadı. Mevcut segmentler:', segments.map(s => s.segment));
      throw new Error('Kontrol grubu bulunamadı. V0 veya Control içeren segment gerekli.');
    }
    
    if (variants.length === 0) {
      console.error('Varyant grubu bulunamadı. Mevcut segmentler:', segments.map(s => s.segment));
      throw new Error('Varyant grubu bulunamadı. V1, V2 veya Variant içeren segment gerekli.');
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
    const mainContainer = document.querySelector('.ga4-abtest-main-container');
    if (mainContainer) {
      checkKPIDataAndUpdateButton(mainContainer, tableData, reportInfo);
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
  if (!reportData) {
    throw new Error(`${reportName} için veri bulunamadı. Önce Session Al ve Dönüşüm Al butonlarını kullanın.`);
  }
  if (!reportData.sessionData) {
    throw new Error('Session verisi eksik. Session Al butonunu kullanın.');
  }
  if (!reportData.conversionData) {
    throw new Error('Dönüşüm verisi eksik. Dönüşüm Al butonunu kullanın.');
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
  
  // Tüm varyantları ekle - sessionData'daki her varyant için conversion karşılığını bul
  for (let i = 0; i < sessionData.variants.length; i++) {
    const sessionVariant = sessionData.variants[i];
    let conversionVariant = conversionData.variants.find(v => v.segment === sessionVariant.segment);
    
    // Eğer tam eşleşme bulunamazsa, alternatif eşleştirme dene
    if (!conversionVariant) {
      // V1, V2 gibi varyantlar için alternatif eşleştirme
      if (sessionVariant.segment.toLowerCase().includes('v1')) {
        conversionVariant = conversionData.variants.find(v => 
          v.segment.toLowerCase().includes('v1') || 
          v.segment.toLowerCase().includes('variant') ||
          v.segment.toLowerCase().includes('totals') // Totals'ı V1 olarak kabul et
        );
      }
    }
    
    if (conversionVariant) {
      segments.push({
        segment: sessionVariant.segment, // Session'dan gelen segment adını kullan
        metrics: {
          'Sessions': sessionVariant.value,
          'Conversions': conversionVariant.value
        }
      });
    } else {
      console.warn(`Conversion karşılığı bulunamadı: ${sessionVariant.segment}`);
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
 * Yeni yapıda artık sadece CSS stilleri eklenir, buton yönetimi UI components'da yapılır
 * @param {HTMLElement} buttonContainer - Ana buton konteyneri
 * @param {Object} tableData - Tablo verileri
 * @param {Object} reportInfo - Rapor bilgileri
 */
export function checkKPIDataAndUpdateButton(buttonContainer, tableData, reportInfo) {
  // Buton stilleri için CSS ekle (sadece bir kez)
  if (document.getElementById('ga4-abtest-button-style') === null) {
    const style = document.createElement('style');
    style.setAttribute('id', 'ga4-abtest-button-style');
    style.textContent = getResultsStyles();
    document.head.appendChild(style);
  }
  
  // Artık buton yönetimi UI components'da yapılıyor
  // Bu fonksiyon sadece stil ekleme için kullanılıyor
}
