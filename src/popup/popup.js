import './popup.css';
import {
  loginToApi,
  logoutFromApi,
  getStoredUsername,
  isLoggedIn,
} from '../utils/auth-store.js';
import {
  loadRecentReports,
  buildReportDetailUrl,
  buildDashboardUrl,
  saveDashboardBaseUrl,
} from '../utils/recent-reports.js';
import { fetchSnapshotReminders } from '../utils/lifecycle-reminders.js';

const STATUS_CLASS = {
  Canlı: 'status-live',
  Taslak: 'status-draft',
  Durduruldu: 'status-stopped',
};

// Auth UI in popup
async function refreshAuthUI() {
  const loggedIn = await isLoggedIn();
  const username = await getStoredUsername();
  const authStatus = document.getElementById('authStatus');
  const authForm = document.getElementById('authForm');
  const logoutBtn = document.getElementById('authLogoutBtn');
  const authError = document.getElementById('authError');
  const authSection = document.getElementById('authSection');
  const authAvatar = document.getElementById('authAvatar');

  if (loggedIn) {
    const displayName = username || 'Kullanıcı';
    authStatus.textContent = displayName;
    authStatus.classList.remove('guest-text');
    authForm.style.display = 'none';
    logoutBtn.style.display = 'block';
    authSection?.classList.add('logged-in');
    if (authAvatar) {
      authAvatar.textContent = displayName.charAt(0).toUpperCase();
      authAvatar.classList.remove('guest');
    }
  } else {
    authStatus.textContent = 'Rapor kaydetmek için giriş yapın';
    authStatus.classList.add('guest-text');
    authForm.style.display = 'flex';
    logoutBtn.style.display = 'none';
    authSection?.classList.remove('logged-in');
    if (authAvatar) {
      authAvatar.textContent = '?';
      authAvatar.classList.add('guest');
    }
  }
  if (authError) authError.style.display = 'none';

  await renderRecentReports(loggedIn);
  await renderSnapshotReminders(loggedIn);
}

function setupEnvBadge() {
  const badge = document.getElementById('envBadge');
  if (!badge) return;
  const env = typeof process !== 'undefined' && process.env?.EXTENSION_ENV;
  if (env === 'development') {
    badge.hidden = false;
    badge.title = 'Local development build';
  }
}

/** Render last 5 reports with dashboard deep links */
async function renderRecentReports(loggedIn) {
  const section = document.getElementById('recentReportsSection');
  const listEl = document.getElementById('recentReportsList');
  const emptyEl = document.getElementById('recentReportsEmpty');
  if (!section || !listEl) return;

  section.style.display = 'block';
  listEl.innerHTML = '';

  if (!loggedIn) {
    if (emptyEl) {
      emptyEl.textContent = 'Son kayıtları görmek için giriş yapın.';
      emptyEl.style.display = 'block';
    }
    return;
  }

  const reports = await loadRecentReports(true);

  if (!reports.length) {
    if (emptyEl) {
      emptyEl.textContent = 'Henüz kayıtlı rapor yok. GA4\'te analiz kaydedin.';
      emptyEl.style.display = 'block';
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  reports.forEach((report) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'recent-row';
    row.title = 'Dashboard\'da aç';

    const status = report.status || 'Taslak';
    const statusClass = STATUS_CLASS[status] || 'status-draft';
    const dateStr = formatRelativeDate(report.savedAt || report.createdAt);
    const detailUrl = report.id ? buildReportDetailUrl(report.id) : buildDashboardUrl();

    row.innerHTML = `
      <span class="recent-main">
        <span class="recent-name">${escapeHtml(report.name || 'İsimsiz rapor')}</span>
        <span class="recent-meta">
          ${report.brandName ? `<span>${escapeHtml(report.brandName)}</span>` : ''}
          ${dateStr ? `<span>${dateStr}</span>` : ''}
        </span>
      </span>
      <span class="recent-status ${statusClass}">${escapeHtml(status)}</span>
      <span class="recent-arrow" aria-hidden="true">›</span>
    `;

    row.addEventListener('click', () => {
      chrome.tabs.create({ url: detailUrl });
    });

    listEl.appendChild(row);
  });
}

/** Show live tests needing GA4 snapshot (7+ days since last capture) */
async function renderSnapshotReminders(loggedIn) {
  const section = document.getElementById('snapshotRemindersSection');
  const listEl = document.getElementById('snapshotRemindersList');
  const hintEl = document.getElementById('snapshotRemindersHint');
  if (!section || !listEl) return;

  if (!loggedIn) {
    section.style.display = 'none';
    return;
  }

  const reminders = await fetchSnapshotReminders();
  if (!reminders.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  listEl.innerHTML = '';
  if (hintEl) {
    hintEl.textContent = `${reminders.length} canlı test için GA4'ten yeni snapshot alın.`;
  }

  reminders.slice(0, 5).forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'recent-row';
    row.title = 'Dashboard\'da aç';

    row.innerHTML = `
      <span class="recent-main">
        <span class="recent-name">${escapeHtml(item.name || 'İsimsiz')}</span>
        <span class="recent-meta">
          ${item.brand ? `<span>${escapeHtml(item.brand)}</span>` : ''}
          <span>Canlı · snapshot gerekli</span>
        </span>
      </span>
      <span class="recent-arrow" aria-hidden="true">›</span>
    `;

    row.addEventListener('click', () => {
      const url = item.id ? buildReportDetailUrl(item.id) : buildDashboardUrl();
      chrome.tabs.create({ url });
    });

    listEl.appendChild(row);
  });
}

function formatRelativeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} sa önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Global variables
let currentAbTestCookies = {};

function setupDashboardLink() {
  document.getElementById('dashboardLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: buildDashboardUrl() });
  });
}

function setupAuthHandlers() {
  document.getElementById('authLoginBtn')?.addEventListener('click', async () => {
    const username = document.getElementById('authUsername')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const authError = document.getElementById('authError');

    if (!username || !password) {
      if (authError) {
        authError.textContent = 'Kullanıcı adı ve şifre gerekli';
        authError.style.display = 'block';
      }
      return;
    }

    try {
      await loginToApi(username, password);
      document.getElementById('authPassword').value = '';
      await refreshAuthUI();
    } catch (err) {
      if (authError) {
        authError.textContent = err.message || 'Giriş başarısız';
        authError.style.display = 'block';
      }
    }
  });

  document.getElementById('authLogoutBtn')?.addEventListener('click', async () => {
    await logoutFromApi();
    await refreshAuthUI();
  });
}

// Options sayfası linkini düzenle
document.addEventListener('DOMContentLoaded', () => {
  saveDashboardBaseUrl(process.env.DASHBOARD_URL || 'https://www.abtestcalculator.com.tr');

  setupEnvBadge();
  setupAuthHandlers();
  setupDashboardLink();
  refreshAuthUI();

  // Güvenilirlik oranı ayarlarını yönet
  const confidenceInput = document.getElementById('confidenceLevel');
  if (confidenceInput) {
      // Kayıtlı değeri yükle
      chrome.storage.sync.get(['confidenceLevel'], function(result) {
          if (result.confidenceLevel) {
              confidenceInput.value = result.confidenceLevel;
          }
      });

      // Değer değiştiğinde kaydet
      confidenceInput.addEventListener('change', function() {
          let value = parseFloat(this.value);
          
          // Değer aralığını kontrol et
          if (value < 1) value = 1;
          if (value > 99.9) value = 99.9;
          
          this.value = value;
          
          // Değeri kaydet
          chrome.storage.sync.set({
              confidenceLevel: value
          }, function() {
              // Content script'e değişikliği bildir
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'updateConfidenceLevel',
                      confidenceLevel: value
                  });
              });
          });
      });
  }

  // A/B Test yönetimini başlat
  initABTestManagement();
});

// A/B Test yönetimini başlat
function initABTestManagement() {
  // Content script'den A/B test cookie'lerini al
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'getABTestCookies'
      }, function(response) {
        if (chrome.runtime.lastError) {
          // console.log('Content script not ready or not applicable page');
          showNoABTestMessage();
          return;
        }
        
        if (response && response.success && Object.keys(response.cookies).length > 0) {
          currentAbTestCookies = response.cookies;
          showABTestManagement(response.cookies);
        } else {
          showNoABTestMessage();
        }
      });
    } else {
      showNoABTestMessage();
    }
  });

  // A/B Test event listener'larını kur
  setupABTestEventListeners();
}

// A/B Test yönetimi UI'ını göster
function showABTestManagement(cookies) {
  const abTestSection = document.getElementById('abTestSection');
  const noAbTestSection = document.getElementById('noAbTestSection');
  
  if (abTestSection && noAbTestSection) {
    abTestSection.style.display = 'block';
    noAbTestSection.style.display = 'none';
    
    populateTestDropdown(cookies);
  }
}

// A/B Test bulunamadı mesajını göster
function showNoABTestMessage() {
  const abTestSection = document.getElementById('abTestSection');
  const noAbTestSection = document.getElementById('noAbTestSection');

  if (abTestSection) abTestSection.style.display = 'none';
  if (noAbTestSection) {
    noAbTestSection.style.display = 'none';
  }
}

// Test dropdown'unu doldur
function populateTestDropdown(cookies) {
  const testSelect = document.getElementById('testSelect');
  if (!testSelect) return;
  
  // Dropdown'u temizle
  testSelect.innerHTML = '';
  
  // Test seçeneklerini ekle
  Object.keys(cookies).forEach(cookieName => {
    const testId = extractTestId(cookieName);
    const option = document.createElement('option');
    option.value = cookieName;
    option.textContent = testId;
    testSelect.appendChild(option);
  });
  
  // İlk test'i seç ve variation'ı güncelle
  if (testSelect.options.length > 0) {
    testSelect.selectedIndex = 0;
    updateVariationDropdown();
  }
}

// Variation dropdown'unu güncelle
function updateVariationDropdown() {
  const testSelect = document.getElementById('testSelect');
  const variationSelect = document.getElementById('variationSelect');
  const currentVariationDiv = document.getElementById('currentVariation');
  
  if (!testSelect || !variationSelect || !currentVariationDiv) return;
  
  const selectedCookieName = testSelect.value;
  const currentValue = currentAbTestCookies[selectedCookieName];
  
  if (currentValue) {
    const currentVariation = extractVariation(currentValue);
    
    // Variation dropdown'unda seçili yap
    variationSelect.value = currentVariation;
    
    // Mevcut variation'ı göster
    currentVariationDiv.textContent = `Current: ${currentValue}`;
  }
}

// A/B Test event listener'larını kur
function setupABTestEventListeners() {
  const testSelect = document.getElementById('testSelect');
  const applyBtn = document.getElementById('applyABChanges');
  const refreshBtn = document.getElementById('refreshABTool');
  
  // Test değiştiğinde variation'ı güncelle
  testSelect?.addEventListener('change', updateVariationDropdown);
  
  // Apply butonu
  applyBtn?.addEventListener('click', applyABTestChanges);
  
  // Refresh butonu
  refreshBtn?.addEventListener('click', refreshABTestTool);
}

// A/B test değişikliklerini uygula
function applyABTestChanges() {
  const testSelect = document.getElementById('testSelect');
  const variationSelect = document.getElementById('variationSelect');
  
  if (!testSelect || !variationSelect) return;
  
  const selectedCookieName = testSelect.value;
  const selectedVariation = variationSelect.value;
  const testId = extractTestId(selectedCookieName);
  
  const newCookieValue = generateCookieValue(testId, selectedVariation);
  const currentValue = currentAbTestCookies[selectedCookieName];
  
  if (newCookieValue !== currentValue) {
    // Content script'e cookie değişikliği gönder
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setABTestCookie',
        cookieName: selectedCookieName,
        cookieValue: newCookieValue
      }, function(response) {
        if (response && response.success) {
          // Popup'u kapat ve sayfayı yenile
          if (confirm('Değişiklik uygulandı! Yeni varyasyonu görmek için sayfa yeniden yüklenecek.')) {
            chrome.tabs.reload(tabs[0].id);
            window.close();
          }
        } else {
          alert('Değişiklik uygulanamadı. Lütfen tekrar deneyin.');
        }
      });
    });
  } else {
    alert('Değişiklik algılanmadı.');
  }
}

// A/B test tool'u yenile
function refreshABTestTool() {
  initABTestManagement();
}

// Yardımcı fonksiyonlar (ab-test-tool.js'den kopyalandı)
function extractTestId(cookieName) {
  return cookieName.replace('_gtm_exp_', '');
}

function extractVariation(cookieValue) {
  const parts = cookieValue.split('_');
  return parts[parts.length - 1] || 'control';
}

function generateCookieValue(testId, variation) {
  return `gtm_ab_${testId}_${variation}`;
} 