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
    // // console.log('🔍 [DEBUG] saveKPIData başladı:', {
    //   type: type,
    //   reportName: reportInfo.reportName,
    //   dateRange: reportInfo.dateRange,
    //   segments: reportInfo.segments,
    //   tableDataKPIs: tableData.kpis
    // });
    
    const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    // // console.log('🔍 [DEBUG] Mevcut session storage:', storedData);
    
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
    
    // console.log('🔍 [DEBUG] Kayıt tamamlandı! Güncellenmiş session storage:', {
    //   type: type,
    //   tabName: tabName,
    //   savedData: storedData[reportInfo.reportName],
    //   fullStorage: storedData
    // });
    
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
 * Parse GA4 date range string ("Aug 24 - Sep 1, 2025") into start/end Date objects
 * @param {string} dateRange - GA4 date range
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function parseDateRange(dateRange) {
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const monthNames = Object.keys(months);

  // Handles both "Mar 22, 2026" (EN) and "22 Mar 2026" (TR/GA4) formats
  function parseOne(str) {
    const clean = str.trim().replace(',', '');
    const parts = clean.split(' ');
    let month, day, year;
    if (monthNames.includes(parts[0])) {
      // EN: "Mar 22 2026" or "Mar 22"
      month = months[parts[0]];
      day = parseInt(parts[1]);
      year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
    } else {
      // TR/GA4: "22 Mar 2026" or "22 Mar"
      day = parseInt(parts[0]);
      month = months[parts[1]];
      year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
    }
    return new Date(year, month, day);
  }

  const [startStr, endStr] = dateRange.split(' - ');
  return { startDate: parseOne(startStr), endDate: parseOne(endStr) };
}

/**
 * Same control / variant picking as saveKPIData (handles long GA4 labels like "V0 to click")
 */
function pickControlAndVariantsForTopla(segments) {
  const control = segments.find(segment =>
    segment.segment.toLowerCase().includes('v0') ||
    segment.segment.toLowerCase().includes('control')
  );
  const variants = segments.filter(segment => {
    const segmentLower = segment.segment.toLowerCase();
    return !(segmentLower.includes('v0') || segmentLower.includes('control')) &&
      (segmentLower.includes('v1') ||
        segmentLower.includes('v2') ||
        segmentLower.includes('v3') ||
        segmentLower.includes('variant') ||
        segmentLower.includes('totals'));
  });
  return { control, variants };
}

/**
 * Map GA4 segment labels to stable V0 / V1 / V2 keys for storage and cross-period validation
 */
function canonicalVariantLabel(rawName, index) {
  const lower = rawName.toLowerCase();
  if (/\bv3\b/.test(lower)) return 'V3';
  if (/\bv2\b/.test(lower)) return 'V2';
  if (/\bv1\b/.test(lower) || lower.includes('totals')) return 'V1';
  return `V${index + 1}`;
}

/**
 * Save current page data as a period row in the Topla table
 * @param {Object} reportInfo - GA4 report info
 * @param {Object} tableData - Table data from page
 * @param {string} type - 'session' or 'conversion'
 * @returns {Object} Updated topla periods array
 */
export function saveTopaPeriodData(reportInfo, tableData, type) {
  const tabName = getTabName();
  const segments = tableData.segments;
  const kpi = tableData.kpis[0];

  const { control, variants } = pickControlAndVariantsForTopla(segments);

  if (!control) {
    throw new Error('Kontrol grubu bulunamadı. V0 veya Control içeren segment gerekli.');
  }
  if (variants.length === 0) {
    throw new Error('Varyant grubu bulunamadı. V1, V2, Variant veya Totals içeren segment gerekli.');
  }

  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  if (!storedData[reportInfo.reportName]) storedData[reportInfo.reportName] = {};
  if (!storedData[reportInfo.reportName].toplaPeriods) storedData[reportInfo.reportName].toplaPeriods = [];

  const periods = storedData[reportInfo.reportName].toplaPeriods;
  const dateRange = reportInfo.dateRange;

  // Find or create period row for this date range
  let period = periods.find(p => p.dateRange === dateRange);
  if (!period) {
    period = { dateRange, sessionData: null, conversionData: null };
    periods.push(period);
  }

  const dataEntry = {
    tabName,
    controlSegment: 'V0',
    controlValue: Math.round(control.metrics[kpi]),
    variants: variants.map((v, i) => ({
      segment: canonicalVariantLabel(v.segment, i),
      value: Math.round(v.metrics[kpi])
    }))
  };

  if (type === 'session') {
    period.sessionData = dataEntry;
  } else {
    period.conversionData = dataEntry;
  }

  // Sort periods by start date
  periods.sort((a, b) => {
    const aDate = parseDateRange(a.dateRange).startDate;
    const bDate = parseDateRange(b.dateRange).startDate;
    return aDate - bDate;
  });

  sessionStorage.setItem('ga4_abtest_data', JSON.stringify(storedData));
  return periods;
}

/**
 * Get topla periods from storage
 * @param {string} reportName - Report name
 * @returns {Array} Periods array
 */
export function getToplaPeriods(reportName) {
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  return storedData[reportName]?.toplaPeriods || [];
}

/**
 * Delete a period row from topla table
 * @param {string} reportName - Report name
 * @param {string} dateRange - Date range to delete
 * @returns {Array} Updated periods array
 */
export function deleteTopaPeriod(reportName, dateRange) {
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  if (!storedData[reportName]?.toplaPeriods) return [];
  storedData[reportName].toplaPeriods = storedData[reportName].toplaPeriods.filter(p => p.dateRange !== dateRange);
  sessionStorage.setItem('ga4_abtest_data', JSON.stringify(storedData));
  return storedData[reportName].toplaPeriods;
}

/**
 * Clear only conversion data for one period row (keep session data)
 * @param {string} reportName - Report name
 * @param {string} dateRange - Period date range key
 * @returns {Array} Updated periods array
 */
export function clearTopaPeriodConversion(reportName, dateRange) {
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  const periods = storedData[reportName]?.toplaPeriods;
  if (!periods) return [];
  const period = periods.find(p => p.dateRange === dateRange);
  if (period) {
    period.conversionData = null;
    sessionStorage.setItem('ga4_abtest_data', JSON.stringify(storedData));
  }
  return storedData[reportName].toplaPeriods;
}

/**
 * Clear all topla periods for a report
 * @param {string} reportName - Report name
 */
export function clearToplaPeriods(reportName) {
  const storedData = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
  if (storedData[reportName]) {
    delete storedData[reportName].toplaPeriods;
    sessionStorage.setItem('ga4_abtest_data', JSON.stringify(storedData));
  }
}

/**
 * Validate periods are consecutive and determine analyzable range
 * Returns the longest consecutive sub-range where every period has both session AND conversion
 * @param {Array} periods - Sorted periods array
 * @returns {{ valid: boolean, analyzablePeriods: Array, error: string|null }}
 */
export function validateToplaPeriods(periods) {
  if (!periods || periods.length === 0) {
    return { valid: false, analyzablePeriods: [], error: 'Henüz veri eklenmedi.' };
  }

  // Check segment consistency across periods
  const segmentSets = [];
  for (const p of periods) {
    const data = p.sessionData || p.conversionData;
    if (data) {
      const names = [data.controlSegment, ...data.variants.map(v => v.segment)].sort().join(',');
      segmentSets.push(names);
    }
  }
  const uniqueSegments = [...new Set(segmentSets)];
  if (uniqueSegments.length > 1) {
    return { valid: false, analyzablePeriods: [], error: 'Segment isimleri tutarsız! Tüm dönemlerde aynı segmentler olmalı.' };
  }

  // Check tab name consistency
  const sessionTabs = [...new Set(periods.filter(p => p.sessionData).map(p => p.sessionData.tabName))];
  const conversionTabs = [...new Set(periods.filter(p => p.conversionData).map(p => p.conversionData.tabName))];
  if (sessionTabs.length > 1) {
    return { valid: false, analyzablePeriods: [], error: 'Session tab isimleri tutarsız!' };
  }
  if (conversionTabs.length > 1) {
    return { valid: false, analyzablePeriods: [], error: 'Dönüşüm tab isimleri tutarsız!' };
  }

  // Find consecutive range with both session + conversion
  const completePeriods = [];
  for (const p of periods) {
    if (p.sessionData && p.conversionData) {
      completePeriods.push(p);
    } else {
      break; // Stop at first incomplete period
    }
  }

  if (completePeriods.length === 0) {
    return { valid: false, analyzablePeriods: [], error: 'Hiçbir dönemde hem session hem dönüşüm verisi yok.' };
  }

  // Check consecutive dates in complete periods
  for (let i = 1; i < completePeriods.length; i++) {
    const prevEnd = parseDateRange(completePeriods[i - 1].dateRange).endDate;
    const currStart = parseDateRange(completePeriods[i].dateRange).startDate;
    const nextDay = new Date(prevEnd);
    nextDay.setDate(nextDay.getDate() + 1);

    if (Math.abs(nextDay - currStart) > 24 * 60 * 60 * 1000) {
      return { valid: false, analyzablePeriods: completePeriods.slice(0, i), error: `Tarihler ardışık değil: ${completePeriods[i - 1].dateRange} → ${completePeriods[i].dateRange}` };
    }
  }

  return { valid: true, analyzablePeriods: completePeriods, error: null };
}

/**
 * Build analysis data from topla periods (sum all periods)
 * @param {Array} periods - Analyzable periods with both session + conversion
 * @returns {Object} Analysis-ready data structure
 */
export function prepareToplaAnalysisData(periods) {
  if (!periods || periods.length === 0) throw new Error('Analiz edilecek dönem yok.');

  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];
  const controlSegment = firstPeriod.sessionData.controlSegment;
  const variantNames = firstPeriod.sessionData.variants.map(v => v.segment);

  let totalSessionControl = 0;
  let totalConversionControl = 0;
  const totalSessionVariants = {};
  const totalConversionVariants = {};
  variantNames.forEach(name => { totalSessionVariants[name] = 0; totalConversionVariants[name] = 0; });

  for (const p of periods) {
    totalSessionControl += p.sessionData.controlValue || 0;
    totalConversionControl += p.conversionData.controlValue || 0;
    p.sessionData.variants.forEach(v => { totalSessionVariants[v.segment] = (totalSessionVariants[v.segment] || 0) + (v.value || 0); });
    p.conversionData.variants.forEach(v => { totalConversionVariants[v.segment] = (totalConversionVariants[v.segment] || 0) + (v.value || 0); });
  }

  const segments = [{ segment: controlSegment, metrics: { 'Sessions': Math.round(totalSessionControl), 'Conversions': Math.round(totalConversionControl) } }];
  variantNames.forEach(name => {
    segments.push({ segment: name, metrics: { 'Sessions': Math.round(totalSessionVariants[name]), 'Conversions': Math.round(totalConversionVariants[name]) } });
  });

  const firstDate = parseDateRange(firstPeriod.dateRange);
  const lastDate = parseDateRange(lastPeriod.dateRange);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateRange = `${months[firstDate.startDate.getMonth()]} ${firstDate.startDate.getDate()} - ${months[lastDate.endDate.getMonth()]} ${lastDate.endDate.getDate()}, ${lastDate.endDate.getFullYear()}`;

  // Test duration = total days from first start to last end (inclusive)
  const msPerDay = 24 * 60 * 60 * 1000;
  const testDuration = Math.round((lastDate.endDate - firstDate.startDate) / msPerDay) + 1;

  return {
    kpis: ['Sessions', 'Conversions'],
    segments,
    sessionTab: firstPeriod.sessionData.tabName,
    conversionTab: firstPeriod.conversionData.tabName,
    dateRange,
    testDuration,
    periodCount: periods.length,
    bussinessImpact: ''
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
 * Inject button styles into document head (idempotent - runs once)
 * Call early when UI is first created so buttons render styled from the start
 */
export function injectButtonStyles() {
  if (document.getElementById('ga4-abtest-button-style') === null) {
    const style = document.createElement('style');
    style.setAttribute('id', 'ga4-abtest-button-style');
    style.textContent = getResultsStyles();
    document.head.appendChild(style);
  }
}

/**
 * KPI verilerini kontrol et ve buton durumunu güncelle
 * Yeni yapıda artık sadece CSS stilleri eklenir, buton yönetimi UI components'da yapılır
 * @param {HTMLElement} buttonContainer - Ana buton konteyneri
 * @param {Object} tableData - Tablo verileri
 * @param {Object} reportInfo - Rapor bilgileri
 */
export function checkKPIDataAndUpdateButton(buttonContainer, tableData, reportInfo) {
  injectButtonStyles();
}
