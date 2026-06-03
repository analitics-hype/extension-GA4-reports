/**
 * GA4 Explore DOM selector registry — ordered fallback chains (most specific first)
 */
export const GA4_SELECTORS = {
  reportName: [
    '.analysis-header-shared span',
    '.analysis-header-shared',
    '[class*="analysis-header"] span',
  ],
  dateRange: [
    '.primary-date-range-text',
    '[class*="date-range-text"]',
    '.date-range-primary',
  ],
  segmentChips: [
    '#segment_comparison [data-guidedhelpid="concept-chip-list-container-segment-comparison"] .chip-text-content .chip-title',
    '#segment_comparison .chip-text-content .chip-title',
    '#segment_comparison .chip-title',
  ],
  kpiChips: [
    '#value .chip-text-content .chip-title',
    '#value .chip-title',
    '#value mat-chip .chip-title',
  ],
  analysisArea: [
    '.analysis-area',
    'vero-crosstab',
    '.crosstab',
  ],
  crosstab: [
    '.crosstab',
    '.table-scroller',
    'table.adv-table',
  ],
  activeTab: [
    '.analysis-area-header .cdk-drag .step-tab-active',
    '.analysis-area-header .step-tab-active',
    '.step-tab-active',
  ],
  activeTabInput: [
    '.step-tab-active .mat-mdc-input-element',
    '.step-tab-active input[aria-label]',
    '.step-tab-active input',
  ],
  newTableMarker: [
    'td.adv-table-data-cell .cell-value',
    'table.adv-table td.adv-table-data-cell .cell-value',
  ],
  oldTableMarker: [
    '.cells-wrapper .cell text.align-right',
    '.cells-wrapper text.align-right',
  ],
  newTableKpiHeaders: [
    'thead th .header-display-labels xap-text-trigger',
    'thead th xap-text-trigger',
    'table.adv-table thead th xap-text-trigger',
  ],
  newTableSegmentNames: [
    'tbody tr td.adv-table-option-cell .projected-content-container',
    'td.adv-table-option-cell .projected-content-container',
  ],
  newTableCellValues: [
    'tbody tr td.adv-table-data-cell .cell-value',
    'td.adv-table-data-cell .cell-value',
  ],
  oldTableKpiHeaders: [
    '.column-headers-wrapper .header-value text',
    '.column-headers-wrapper text.align-right',
  ],
  oldTableSegmentNames: [
    '.row-headers-draw-area .row-header-column:first-child .header-value text.align-left:not(.row-index)',
    '.row-header-column .header-value text.align-left:not(.row-index)',
  ],
  oldTableCellValues: [
    '.cells-wrapper .cell text.align-right',
    '.cells-wrapper text.align-right',
  ],
};

/** Keys required before GA4 data extraction can run */
export const GA4_REQUIRED_KEYS = ['reportName', 'dateRange', 'segmentChips', 'kpiChips', 'tableValues'];

export default GA4_SELECTORS;
