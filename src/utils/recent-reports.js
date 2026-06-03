/**
 * Recent reports for popup — local cache + optional API fetch
 */
import { getAuthHeaders } from './auth-store.js';
import {
  getDashboardBaseUrlAsync,
  buildDashboardUrlAsync,
  buildReportDetailUrlAsync,
  openExternalUrl,
  saveDashboardBaseUrl,
} from './dashboard-config.js';

export const RECENT_LIMIT = 5;

/** Sync fallback for build-time URL (prefer async getters in content scripts) */
export function getDashboardBaseUrl() {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.DASHBOARD_URL
      ? process.env.DASHBOARD_URL
      : 'https://www.abtestcalculator.com.tr';
  return fromEnv.replace(/\/+$/, '');
}

export function buildReportDetailUrl(reportId) {
  return `${getDashboardBaseUrl()}/dashboard/reports/${reportId}`;
}

export function buildDashboardUrl() {
  return `${getDashboardBaseUrl()}/dashboard`;
}

export function buildBrandManagementUrl() {
  return `${getDashboardBaseUrl()}/dashboard/brands`;
}

export {
  getDashboardBaseUrlAsync,
  buildDashboardUrlAsync,
  buildReportDetailUrlAsync,
  buildBrandManagementUrlAsync,
  openExternalUrl,
  saveDashboardBaseUrl,
} from './dashboard-config.js';

/** @deprecated use openExternalUrl */
export function openDashboardPage(url) {
  return openExternalUrl(url);
}

export function getLocalRecentReports() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['recentReports'], (data) => {
      resolve((data.recentReports || []).slice(0, RECENT_LIMIT));
    });
  });
}

export function persistRecentReport(entry) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'saveReport', report: entry }, resolve);
  });
}

export async function fetchRecentReportsFromApi() {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) return [];

  const response = await fetch(`${process.env.API_URL}/reports`, { headers });
  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) return [];

  const flat = [];
  json.data.forEach((brand) => {
    (brand.tests || []).forEach((test) => {
      flat.push({
        id: test.id,
        name: test.name,
        status: test.status,
        brandName: brand.name,
        createdAt: test.createdAt,
        savedAt: test.createdAt,
      });
    });
  });

  flat.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return flat.slice(0, RECENT_LIMIT);
}

export async function loadRecentReports(isAuthenticated) {
  if (isAuthenticated) {
    try {
      const fromApi = await fetchRecentReportsFromApi();
      if (fromApi.length) return fromApi;
    } catch (err) {
      console.warn('Recent reports API fetch failed:', err);
    }
  }
  return getLocalRecentReports();
}
