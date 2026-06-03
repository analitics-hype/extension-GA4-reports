/**
 * Resilient DOM query helpers with GA4 selector fallbacks
 */
import { GA4_SELECTORS, GA4_REQUIRED_KEYS } from './ga4-selectors.js';

function resolveSelectors(selectorKeyOrList) {
  if (Array.isArray(selectorKeyOrList)) return selectorKeyOrList;
  return GA4_SELECTORS[selectorKeyOrList] || [selectorKeyOrList];
}

/** First matching element from a selector key or custom list */
export function queryFirst(root, selectorKeyOrList, doc = document) {
  const scope = root || doc;
  for (const sel of resolveSelectors(selectorKeyOrList)) {
    const el = scope.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/** First non-empty NodeList from fallback chain */
export function queryAll(root, selectorKeyOrList, doc = document) {
  const scope = root || doc;
  for (const sel of resolveSelectors(selectorKeyOrList)) {
    const nodes = scope.querySelectorAll(sel);
    if (nodes.length) return Array.from(nodes);
  }
  return [];
}

/** Trimmed text from first matched element */
export function queryText(root, selectorKeyOrList, doc = document) {
  const el = queryFirst(root, selectorKeyOrList, doc);
  if (!el) return null;
  return (el.textContent || el.innerText || '').trim();
}

/** Detect GA4 crosstab table DOM variant */
export function detectTableVariant(root = document) {
  if (queryFirst(root, 'newTableMarker')) return 'new';
  if (queryFirst(root, 'oldTableMarker')) return 'old';
  return null;
}

/** Report which required GA4 regions are missing on the page */
export function getMissingGa4Regions(root = document) {
  const missing = [];

  for (const key of GA4_REQUIRED_KEYS) {
    if (key === 'tableValues') {
      if (!detectTableVariant(root)) missing.push(key);
      continue;
    }
    if (key === 'segmentChips' || key === 'kpiChips') {
      if (queryAll(root, key).length === 0) missing.push(key);
      continue;
    }
    if (!queryFirst(root, key)) missing.push(key);
  }

  return missing;
}

/**
 * Wait for a single selector (legacy helper)
 */
export function waitForSelector(selector, callback, maxAttempts = 50) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    const element = document.querySelector(selector);

    if (element) {
      clearInterval(interval);
      callback(element);
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      console.warn(`[GA4 Extension] Element not found: ${selector}`);
    }
  }, 200);
}

/**
 * Wait until all required GA4 regions are present (fallback-aware)
 */
export function waitForAllElements(callback, onTimeout) {
  let attempts = 0;
  const maxAttempts = 50;

  const checkInterval = setInterval(() => {
    attempts += 1;
    const missing = getMissingGa4Regions();

    if (missing.length === 0) {
      clearInterval(checkInterval);
      callback(true);
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.warn('[GA4 Extension] GA4 regions not ready:', missing.join(', '));
      if (onTimeout) onTimeout(missing);
    }
  }, 200);
}
