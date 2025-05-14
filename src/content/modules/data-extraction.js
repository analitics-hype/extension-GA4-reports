/**
 * Veri çıkarma ile ilgili fonksiyonlar
 */

/**
 * Rapor bilgilerini al
 * @returns {Object} Rapor bilgileri
 */
export function getReportInfo() {
  try {
    // Rapor adını al
    const reportNameElement = document.querySelector('.analysis-header-shared span');
    if (!reportNameElement) {
      return {
        success: false,
        error: 'Rapor elementleri henüz yüklenmedi. Lütfen sayfanın tamamen yüklenmesini bekleyin.'
      };
    }
    const reportName = reportNameElement.innerHTML.trim();

    // Tarih aralığını al
    const dateRangeElement = document.querySelector('.primary-date-range-text');
    if (!dateRangeElement) {
      return {
        success: false,
        error: 'Tarih aralığı elementi henüz yüklenmedi. Lütfen sayfanın tamamen yüklenmesini bekleyin.'
      };
    }
    const dateRange = dateRangeElement.innerText.trim();

    // Segmentleri al
    const segmentElements = document.querySelectorAll('#segment_comparison [data-guidedhelpid="concept-chip-list-container-segment-comparison"] .chip-text-content .chip-title');
    if (segmentElements.length < 1) {
      return {
        success: false,
        error: 'Lütfen en az bir segment seçin'
      };
    }
    const segments = Array.from(segmentElements).map(el => el.textContent.trim());

    // KPI'ları (values) al
    const kpiElements = document.querySelectorAll('#value .chip-text-content .chip-title');
    if (kpiElements.length < 1) {
      return {
        success: false,
        error: 'Lütfen en az bir KPI seçin'
      };
    }
    const kpis = Array.from(kpiElements).map(el => el.textContent.trim());

    // Tablo verilerini al
    const tableData = getTableData();

    return {
      success: true,
      data: {
        reportName: reportName,
        dateRange: dateRange,
        segments: segments,
        kpis: kpis,
        tableData: tableData
      }
    };
  } catch (error) {
    console.error('Rapor bilgileri alma hatası:', error);
    return {
      success: false,
      error: 'Rapor bilgileri alınırken bir hata oluştu. Lütfen sayfayı yenileyin.'
    };
  }
}

/**
 * Tablo verilerini al
 * @returns {Object} Tablo verileri
 */
export function getTableData() {
  // KPI başlıklarını al
  const kpiHeaders = Array.from(
    document.querySelectorAll('.column-headers-wrapper .header-value text')
  ).map(el => el.textContent.trim());

  // Segment isimlerini al
  const segmentNames = Array.from(
    document.querySelectorAll('.row-headers-draw-area .row-header-column:first-child .header-value text.align-left:not(.row-index)')
  ).map(el => el.textContent.trim());

  // Tüm değerleri al
  const allValues = Array.from(
    document.querySelectorAll('.cells-wrapper .cell text.align-right')
  ).map(el => {
    // Binlik ayracı olan virgülü kaldır ve sayıya çevir
    const rawValue = el.textContent.trim();
    const cleanValue = rawValue.replace(/,/g, '');
    return parseFloat(cleanValue);
  });

  // Verileri yapılandır
  const tableData = segmentNames.map((segment, segmentIndex) => {
    const segmentData = {
      segment: segment,
      metrics: {}
    };

    // Her KPI için değerleri eşleştir
    kpiHeaders.forEach((kpi, kpiIndex) => {
      // Her segment için KPI değerini bul
      // Değer dizisindeki index = (segment index * KPI sayısı) + KPI index
      const valueIndex = segmentIndex * kpiHeaders.length + kpiIndex;
      segmentData.metrics[kpi] = allValues[valueIndex];
    });

    return segmentData;
  });

  return {
    kpis: kpiHeaders,
    segments: tableData
  };
}

/**
 * Tab ismini al
 * @returns {string} Tab ismi
 */
export function getTabName() {
  try {
    const activeTab = document.querySelector('.analysis-area-header .cdk-drag .step-tab-active');
    if (!activeTab) {
      throw new Error('Aktif tab bulunamadı');
    }

    const stepIndex = activeTab.closest(".cdk-drag").getAttribute('data-step-index');
    const tabName = activeTab.querySelector('.mat-mdc-input-element').getAttribute("aria-label");

    if (!stepIndex || !tabName) {
      throw new Error('Tab bilgileri eksik');
    }

    return `${stepIndex}-${tabName}`;
  } catch (error) {
    console.error('Tab ismi alma hatası:', error);
    throw error;
  }
} 