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
    console.log('🔍 [DEBUG] saveKPIData başladı:', {
      type: type,
      reportName: reportInfo.reportName,
      dateRange: reportInfo.dateRange,
      segments: reportInfo.segments,
      tableDataKPIs: tableData.kpis
    });
    
    const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    console.log('🔍 [DEBUG] Mevcut session storage:', storedData);
    
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

    // Önceki konsolide edilmiş veriyi periods'a taşı (eğer varsa)
    const existingReport = storedData[reportInfo.reportName];
    if (existingReport.consolidatedData) {
      console.log('📦 [DEBUG] Önceki konsolide veri periods\'a aktarılıyor:', existingReport.consolidatedData.dateRange);
      
      // periods array'i oluştur veya genişlet
      if (!existingReport.periods) {
        existingReport.periods = [];
      }
      
      // Konsolide edilmiş veriyi period formatına çevir
      const periodData = {
        dateRange: existingReport.consolidatedData.dateRange,
        sessionData: {
          reportName: existingReport.consolidatedData.reportName,
          dateRange: existingReport.consolidatedData.dateRange,
          segment: existingReport.consolidatedData.control.segment,
          segments: existingReport.consolidatedData.segments,
          value: existingReport.consolidatedData.control.sessions,
          variants: existingReport.consolidatedData.variants.map(v => ({
            segment: v.segment,
            value: v.sessions
          })),
          tabName: existingReport.consolidatedData.sessionTab,
          bussinessImpact: existingReport.consolidatedData.bussinessImpact
        },
        conversionData: {
          reportName: existingReport.consolidatedData.reportName,
          dateRange: existingReport.consolidatedData.dateRange,
          segment: existingReport.consolidatedData.control.segment,
          segments: existingReport.consolidatedData.segments,
          value: existingReport.consolidatedData.control.conversions,
          variants: existingReport.consolidatedData.variants.map(v => ({
            segment: v.segment,
            value: v.conversions
          })),
          tabName: existingReport.consolidatedData.conversionTab,
          bussinessImpact: existingReport.consolidatedData.bussinessImpact
        }
      };
      
      // Bu period zaten mevcut mu kontrol et (aynı tarih aralığı)
      const existingPeriodIndex = existingReport.periods.findIndex(p => 
        p.dateRange === periodData.dateRange || 
        p.sessionData?.dateRange === periodData.dateRange ||
        p.conversionData?.dateRange === periodData.dateRange
      );
      
      if (existingPeriodIndex === -1) {
        existingReport.periods.push(periodData);
        console.log('📦 [DEBUG] Period eklendi:', periodData.dateRange);
      } else {
        console.log('📦 [DEBUG] Period zaten mevcut:', periodData.dateRange);
      }
      
      // Konsolide edilmiş veriyi temizle (artık periods'ta)
      delete existingReport.consolidatedData;
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
    
    console.log('🔍 [DEBUG] Kayıt tamamlandı! Güncellenmiş session storage:', {
      type: type,
      tabName: tabName,
      savedData: storedData[reportInfo.reportName],
      fullStorage: storedData
    });
    
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
  
  // Konsolide edilmiş veri varsa onu kullan
  if (reportData.consolidatedData) {
    console.log('📊 [DEBUG] Konsolide edilmiş veri kullanılıyor:', reportData.consolidatedData);
    return prepareConsolidatedAnalysisData(reportData.consolidatedData);
  }
  
  // Normal veri kontrolü
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
 * Farklı tarih aralıklarındaki verileri birleştir (Topla butonu için)
 * @param {Object} reportData - Mevcut rapor verisi
 * @returns {Object} Birleştirilmiş veriler
 */
export function consolidateData(reportData) {
  console.log('🔗 [DEBUG] consolidateData başladı:', reportData);
  
  const { sessionData, conversionData, periods = [] } = reportData;
  
  // Validasyonlar
  if (!sessionData || !conversionData) {
    throw new Error('Session ve conversion verisi gerekli!');
  }
  
  if (sessionData.tabName !== conversionData.tabName.replace('1-', '0-') && 
      conversionData.tabName !== sessionData.tabName.replace('0-', '1-')) {
    console.warn('Tab isimleri uyumsuz:', sessionData.tabName, conversionData.tabName);
  }
  
  // Mevcut veri setini hazırla
  const currentPeriod = {
    sessionData: sessionData,
    conversionData: conversionData,
    dateRange: sessionData.dateRange
  };
  
  // Tüm periyotları birleştir (periods + mevcut)
  const allPeriods = [...periods, currentPeriod];
  console.log('🔗 [DEBUG] Birleştirilecek periyotlar:', allPeriods);
  
  // Tarih kontrolü ve sıralama
  const sortedPeriods = validateAndSortPeriods(allPeriods);
  
  // Veri birleştirme
  const consolidatedResult = mergePeriodsData(sortedPeriods, sessionData.tabName, conversionData.tabName);
  
  console.log('🔗 [DEBUG] Birleştirme tamamlandı:', consolidatedResult);
  return consolidatedResult;
}

/**
 * Periyotları validate et ve tarih sırasına göre sırala
 * @param {Array} periods - Periyot dizisi
 * @returns {Array} Sıralı ve validate edilmiş periyotlar
 */
function validateAndSortPeriods(periods) {
  console.log('📅 [DEBUG] Tarih validasyonu başladı:', periods);
  
  // Tarih aralıklarını parse et
  const parsedPeriods = periods.map((period, index) => {
    const dateRange = period.dateRange || period.sessionData?.dateRange || period.conversionData?.dateRange;
    if (!dateRange) {
      throw new Error(`Periyot ${index + 1} için tarih aralığı bulunamadı`);
    }
    
    const [startStr, endStr] = dateRange.split(' - ');
    const startDate = parseDateString(startStr.trim());
    const endDate = parseDateString(endStr.trim());
    
    return {
      ...period,
      dateRange,
      startDate,
      endDate,
      index
    };
  });
  
  // Tarihe göre sırala
  parsedPeriods.sort((a, b) => a.startDate - b.startDate);
  
  // Ardışıklık kontrolü
  for (let i = 1; i < parsedPeriods.length; i++) {
    const prevEnd = parsedPeriods[i - 1].endDate;
    const currentStart = parsedPeriods[i].startDate;
    
    // Bir gün fark olmalı (prevEnd + 1 day = currentStart)
    const nextDay = new Date(prevEnd);
    nextDay.setDate(nextDay.getDate() + 1);
    
    if (Math.abs(nextDay - currentStart) > 24 * 60 * 60 * 1000) { // 1 günden fazla fark varsa
      console.warn('⚠️ [DEBUG] Tarihler ardışık değil:', 
        formatDate(prevEnd), '→', formatDate(currentStart));
    }
  }
  
  console.log('📅 [DEBUG] Sıralı periyotlar:', parsedPeriods.map(p => p.dateRange));
  return parsedPeriods;
}

/**
 * Tarih string'ini Date objesine çevir
 * @param {string} dateStr - "Aug 24" veya "Sep 1" formatında tarih
 * @returns {Date} Date objesi
 */
function parseDateString(dateStr) {
  // "Aug 24, 2025" formatını parse et
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const parts = dateStr.split(' ');
  if (parts.length >= 2) {
    const monthName = parts[0];
    const day = parseInt(parts[1].replace(',', ''));
    const year = parts[2] ? parseInt(parts[2]) : 2025; // Default year
    
    if (months[monthName] !== undefined) {
      return new Date(year, months[monthName], day);
    }
  }
  
  // Fallback - direkt Date constructor'a ver
  return new Date(dateStr + ', 2025');
}

/**
 * Date objesini string'e çevir
 * @param {Date} date - Date objesi
 * @returns {string} "Aug 24" formatında tarih
 */
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Periyotların verilerini birleştir
 * @param {Array} sortedPeriods - Sıralı periyotlar
 * @param {string} sessionTabName - Session tab ismi
 * @param {string} conversionTabName - Conversion tab ismi
 * @returns {Object} Birleştirilmiş veri
 */
function mergePeriodsData(sortedPeriods, sessionTabName, conversionTabName) {
  console.log('🔢 [DEBUG] Veri birleştirme başladı');
  
  let totalSessionsControl = 0;
  let totalConversionsControl = 0;
  let totalSessionsVariants = {};
  let totalConversionsVariants = {};
  
  const firstPeriod = sortedPeriods[0];
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const consolidatedDateRange = `${formatDate(firstPeriod.startDate)} - ${formatDate(lastPeriod.endDate)}, 2025`;
  
  // Her periyodun verilerini topla
  sortedPeriods.forEach((period, index) => {
    console.log(`🔢 [DEBUG] Periyot ${index + 1} işleniyor:`, period.dateRange);
    
    const sessionData = period.sessionData;
    const conversionData = period.conversionData;
    
    if (sessionData && conversionData) {
      // Control grubu topla
      totalSessionsControl += sessionData.value || 0;
      totalConversionsControl += conversionData.value || 0;
      
      // Varyantları topla
      if (sessionData.variants) {
        sessionData.variants.forEach(variant => {
          const segmentName = variant.segment;
          if (!totalSessionsVariants[segmentName]) {
            totalSessionsVariants[segmentName] = 0;
          }
          totalSessionsVariants[segmentName] += variant.value || 0;
        });
      }
      
      if (conversionData.variants) {
        conversionData.variants.forEach(variant => {
          const segmentName = variant.segment;
          if (!totalConversionsVariants[segmentName]) {
            totalConversionsVariants[segmentName] = 0;
          }
          totalConversionsVariants[segmentName] += variant.value || 0;
        });
      }
    }
  });
  
  // Birleştirilmiş veriyi oluştur
  const consolidatedData = {
    reportName: firstPeriod.sessionData.reportName,
    dateRange: consolidatedDateRange,
    segments: firstPeriod.sessionData.segments,
    sessionTab: sessionTabName,
    conversionTab: conversionTabName,
    periodCount: sortedPeriods.length,
    control: {
      segment: firstPeriod.sessionData.segment, // Control segment adını ekle
      sessions: totalSessionsControl,
      conversions: totalConversionsControl
    },
    variants: Object.keys(totalSessionsVariants).map(segmentName => ({
      segment: segmentName,
      sessions: totalSessionsVariants[segmentName] || 0,
      conversions: totalConversionsVariants[segmentName] || 0
    })),
    bussinessImpact: ""
  };
  
  console.log('🔢 [DEBUG] Birleştirilmiş veri:', consolidatedData);
  return consolidatedData;
}

/**
 * Konsolide edilmiş veriyi analiz formatına çevir
 * @param {Object} consolidatedData - Konsolide edilmiş veri
 * @returns {Object} Analiz için hazırlanmış veriler
 */
function prepareConsolidatedAnalysisData(consolidatedData) {
  console.log('📊 [DEBUG] Konsolide veri analiz formatına çevriliyor:', consolidatedData);
  
  // Control segment'ini ekle
  const segments = [{
    segment: consolidatedData.control.segment || 'V0', // Control segment adı
    metrics: {
      'Sessions': consolidatedData.control.sessions,
      'Conversions': consolidatedData.control.conversions
    }
  }];
  
  // Varyant segmentlerini ekle
  if (consolidatedData.variants && consolidatedData.variants.length > 0) {
    consolidatedData.variants.forEach(variant => {
      segments.push({
        segment: variant.segment,
        metrics: {
          'Sessions': variant.sessions,
          'Conversions': variant.conversions
        }
      });
    });
  }
  
  const analysisData = {
    kpis: ['Sessions', 'Conversions'],
    segments: segments,
    sessionTab: consolidatedData.sessionTab,
    conversionTab: consolidatedData.conversionTab,
    // Ek bilgileri koru - ÖNEMLI: periodCount'u koru ki formatData anlasın
    dateRange: consolidatedData.dateRange,
    periodCount: consolidatedData.periodCount,
    reportName: consolidatedData.reportName,
    bussinessImpact: consolidatedData.bussinessImpact
  };
  
  console.log('📊 [DEBUG] Analiz verisi hazır:', analysisData);
  return analysisData;
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
