/**
 * Dashboard URL resolution + reliable tab open from content/popup scripts
 */

const BUILD_TIME_DASHBOARD_URL =
  typeof process !== 'undefined' && process.env?.DASHBOARD_URL
    ? process.env.DASHBOARD_URL
    : 'https://www.abtestcalculator.com.tr';

const DEFAULT_DASHBOARD_URL = 'https://www.abtestcalculator.com.tr';

/** Normalize base URL — must include protocol */
function normalizeBaseUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return DEFAULT_DASHBOARD_URL;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  return `http://${raw.replace(/^\/+/, '')}`.replace(/\/+$/, '');
}

/** Read dashboard base URL from storage (runtime) or build-time env */
export function getDashboardBaseUrlAsync() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['dashboardBaseUrl'], (result) => {
      const fromStorage = result.dashboardBaseUrl;
      resolve(normalizeBaseUrl(fromStorage || BUILD_TIME_DASHBOARD_URL || DEFAULT_DASHBOARD_URL));
    });
  });
}

/** Persist dashboard URL so content scripts always use the correct host */
export function saveDashboardBaseUrl(url) {
  const normalized = normalizeBaseUrl(url);
  return new Promise((resolve) => {
    chrome.storage.sync.set({ dashboardBaseUrl: normalized }, () => resolve(normalized));
  });
}

export async function buildDashboardUrlAsync() {
  return `${await getDashboardBaseUrlAsync()}/dashboard`;
}

export async function buildBrandManagementUrlAsync() {
  return `${await getDashboardBaseUrlAsync()}/dashboard/brands`;
}

export async function buildReportDetailUrlAsync(reportId) {
  return `${await getDashboardBaseUrlAsync()}/dashboard/reports/${reportId}`;
}

/** Open external dashboard page — background tab API with window.open fallback */
export async function openExternalUrl(url) {
  const target = normalizeFullUrl(url);
  if (!target) {
    console.error('[GA4 Extension] Invalid dashboard URL:', url);
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'openDashboardUrl', url: target }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[GA4 Extension] sendMessage failed:', chrome.runtime.lastError.message);
          window.open(target, '_blank', 'noopener,noreferrer');
          resolve(true);
          return;
        }
        if (response?.success) {
          resolve(true);
          return;
        }
        window.open(target, '_blank', 'noopener,noreferrer');
        resolve(true);
      });
    } catch (err) {
      console.warn('[GA4 Extension] openExternalUrl error:', err);
      window.open(target, '_blank', 'noopener,noreferrer');
      resolve(true);
    }
  });
}

function normalizeFullUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return null;
  return `http://${raw}`;
}
