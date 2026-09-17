/**
 * GA4 report DOM extraction — uses fallback selector chains
 */
import {
  queryAll,
  queryFirst,
  queryText,
  detectTableVariant,
  probeSelectorChain,
} from './dom-helpers.js';

/**
 * Parse locale-formatted number strings from GA4 cells
 */
function parseLocaleNumber(raw) {
  const str = raw.trim();
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot > -1 && lastComma > -1) {
    if (lastDot > lastComma) return parseFloat(str.replace(/,/g, ''));
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }

  if (lastComma > -1) {
    if (/,\d{3}$/.test(str)) return parseFloat(str.replace(/,/g, ''));
    return parseFloat(str.replace(',', '.'));
  }

  if (lastDot > -1) {
    if (/\.\d{3}$/.test(str)) return parseFloat(str.replace(/\./g, ''));
    return parseFloat(str);
  }

  return parseFloat(str) || 0;
}

/** Build segment + metrics structure from extracted arrays */
function buildTableData(kpiHeaders, segmentNames, allValues) {
  const tableData = segmentNames.map((segment, segmentIndex) => {
    const segmentData = { segment, metrics: {} };
    kpiHeaders.forEach((kpi, kpiIndex) => {
      const valueIndex = segmentIndex * kpiHeaders.length + kpiIndex;
      segmentData.metrics[kpi] = allValues[valueIndex];
    });
    return segmentData;
  });
  return { kpis: kpiHeaders, segments: tableData };
}

/** Log which selector matched so 360 vs standard DOM diffs are visible */
function logTableExtract(variant, root, extra = {}) {
  console.group('[GA4 extract]', variant);
  console.log('hostname:', window.location?.hostname);
  console.log('newTableMarker', probeSelectorChain(root, 'newTableMarker'));
  console.log('oldTableMarker', probeSelectorChain(root, 'oldTableMarker'));
  console.log('newTableSegmentNames', probeSelectorChain(root, 'newTableSegmentNames'));
  console.log('newTableKpiHeaders', probeSelectorChain(root, 'newTableKpiHeaders'));
  console.log('newTableCellValues', probeSelectorChain(root, 'newTableCellValues'));
  if (variant === 'old') {
    console.log('oldTableSegmentNames', probeSelectorChain(root, 'oldTableSegmentNames'));
    console.log('oldTableKpiHeaders', probeSelectorChain(root, 'oldTableKpiHeaders'));
    console.log('oldTableCellValues', probeSelectorChain(root, 'oldTableCellValues'));
  }
  console.log('result', extra);
  console.groupEnd();
}

/** New mat-table GA4 structure */
function getTableDataNew(root = document) {
  const kpiHeaders = queryAll(root, 'newTableKpiHeaders').map((el) => el.textContent.trim());
  const segmentNames = queryAll(root, 'newTableSegmentNames').map((el) => el.textContent.trim());

  const allValues = [];
  queryAll(root, 'newTableCellValues').forEach((el) => {
    allValues.push(parseLocaleNumber(el.textContent));
  });

  const tableData = buildTableData(kpiHeaders, segmentNames, allValues);
  logTableExtract('new', root, {
    kpiHeaders,
    segmentNames,
    allValues,
    segmentCount: tableData.segments.length,
  });
  return tableData;
}

/** Legacy SVG crosstab GA4 structure */
function getTableDataOld(root = document) {
  const kpiHeaders = queryAll(root, 'oldTableKpiHeaders').map((el) => el.textContent.trim());
  const segmentNames = queryAll(root, 'oldTableSegmentNames').map((el) => el.textContent.trim());
  const allValues = queryAll(root, 'oldTableCellValues').map((el) =>
    parseLocaleNumber(el.textContent),
  );

  return buildTableData(kpiHeaders, segmentNames, allValues);
}

/**
 * Extract crosstab table data — auto-detects old vs new GA4 DOM
 */
export function getTableData(root = document) {
  const variant = detectTableVariant(root);
  if (variant === 'new') return getTableDataNew(root);
  if (variant === 'old') {
    const tableData = getTableDataOld(root);
    logTableExtract('old', root, {
      kpiHeaders: tableData.kpis,
      segmentNames: tableData.segments.map((s) => s.segment),
      segmentCount: tableData.segments.length,
    });
    return tableData;
  }
  logTableExtract('none', root, { kpis: [], segments: [] });
  return { kpis: [], segments: [] };
}

/**
 * Read report metadata and table from the GA4 Explore page
 */
export function getReportInfo(root = document) {
  try {
    const reportName = queryText(root, 'reportName');
    if (!reportName) {
      return {
        success: false,
        error: 'Rapor elementleri henüz yüklenmedi. Lütfen sayfanın tamamen yüklenmesini bekleyin.',
      };
    }

    const dateRange = queryText(root, 'dateRange');
    if (!dateRange) {
      return {
        success: false,
        error: 'Tarih aralığı elementi henüz yüklenmedi. Lütfen sayfanın tamamen yüklenmesini bekleyin.',
      };
    }

    const segmentElements = queryAll(root, 'segmentChips');
    if (segmentElements.length < 1) {
      return { success: false, error: 'Lütfen en az bir segment seçin' };
    }
    const segments = segmentElements.map((el) => el.textContent.trim());

    const kpiElements = queryAll(root, 'kpiChips');
    if (kpiElements.length < 1) {
      return { success: false, error: 'Lütfen en az bir KPI seçin' };
    }
    const kpis = kpiElements.map((el) => el.textContent.trim());

    const tableData = getTableData(root);

    return {
      success: true,
      data: {
        reportName,
        dateRange,
        segments,
        kpis,
        tableData,
      },
    };
  } catch (error) {
    console.error('Rapor bilgileri alma hatası:', error);
    return {
      success: false,
      error: 'Rapor bilgileri alınırken bir hata oluştu. Lütfen sayfayı yenileyin.',
    };
  }
}

/**
 * Active analysis tab label for session/conversion pairing
 */
export function getTabName(root = document) {
  try {
    const activeTab = queryFirst(root, 'activeTab');
    if (!activeTab) throw new Error('Aktif tab bulunamadı');

    const stepIndex = activeTab.closest('.cdk-drag')?.getAttribute('data-step-index');
    const tabInput = queryFirst(activeTab, 'activeTabInput') || queryFirst(root, 'activeTabInput');
    const tabName = tabInput?.getAttribute('aria-label') || tabInput?.value;

    if (!stepIndex || !tabName) throw new Error('Tab bilgileri eksik');

    return `${stepIndex}-${tabName}`;
  } catch (error) {
    console.error('Tab ismi alma hatası:', error);
    throw error;
  }
}
