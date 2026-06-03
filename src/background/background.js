// Background service worker — reports cache, GA4 popup toggle, external links

const DEFAULT_DASHBOARD_URL = 'https://www.abtestcalculator.com.tr';

function persistRecentReport(report, sendResponse) {
  chrome.storage.local.get('recentReports', (data) => {
    const recentReports = data.recentReports || [];
    const withoutDup = recentReports.filter((r) => r.id !== report.id);
    withoutDup.unshift({ ...report, savedAt: report.savedAt || new Date().toISOString() });
    while (withoutDup.length > 10) withoutDup.pop();
    chrome.storage.local.set({ recentReports: withoutDup }, () => {
      sendResponse({ success: true });
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ confidenceLevel: 95, recentReports: [] });
  // Seed dashboard URL for content scripts (build-time env baked into service worker bundle)
  const dashboardUrl =
    typeof process !== 'undefined' && process.env?.DASHBOARD_URL
      ? process.env.DASHBOARD_URL
      : DEFAULT_DASHBOARD_URL;
  chrome.storage.sync.set({ dashboardBaseUrl: dashboardUrl.replace(/\/+$/, '') });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'pageLoaded') {
    const isGA4Page = request.url?.includes('analytics.google.com');
    chrome.action.setIcon({
      path: {
        16: isGA4Page ? 'images/icon16.png' : 'images/icon16_disabled.png',
        48: isGA4Page ? 'images/icon48.png' : 'images/icon48_disabled.png',
        128: isGA4Page ? 'images/icon128.png' : 'images/icon128_disabled.png',
      },
    });
    chrome.action.setPopup({ popup: isGA4Page ? 'popup.html' : 'disabled.html' });
    return false;
  }

  if (request.action === 'saveReport') {
    persistRecentReport(request.report, sendResponse);
    return true;
  }

  if (request.action === 'openDashboardUrl' && request.url) {
    const url = String(request.url);
    if (!/^https?:\/\//i.test(url)) {
      sendResponse({ success: false, error: 'Invalid URL' });
      return false;
    }
    chrome.tabs.create({ url }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});
