/**
 * Brand picker in analysis popup when prefix cannot be resolved
 */
import { fetchAccessibleBrands, matchBrandByPrefix } from '../../utils/brand-service.js';
import { getStoredToken } from '../../utils/auth-store.js';
import { buildBrandManagementUrlAsync, openExternalUrl } from '../../utils/dashboard-config.js';

function insertAfterPopupHeader(popup, element) {
  const header = popup.querySelector('.popup-header');
  if (header?.parentNode) {
    header.insertAdjacentElement('afterend', element);
  }
}

/** Render add-brand control — anchor keeps native navigation if extension API fails */
function renderAddBrandButton(label, brandMgmtUrl) {
  const safeUrl = escapeHtml(brandMgmtUrl);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="brand-add-btn" id="brandAddBtn" title="Dashboard marka yönetimi">${escapeHtml(label)}</a>`;
}

function bindAddBrandButton(row, brandMgmtUrl) {
  const btn = row.querySelector('#brandAddBtn');
  if (!btn || !brandMgmtUrl) return;

  btn.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Sync open — no await so user-gesture chain stays intact for tab/window open
      openExternalUrl(brandMgmtUrl);
    },
    true,
  );
}

/** Mount brand UI below popup header; returns selection helpers for save */
export async function initBrandSelector(popup, reportName) {
  const row = document.createElement('div');
  row.className = 'brand-select-row';

  const token = await getStoredToken();
  if (!token) {
    row.innerHTML =
      '<span class="brand-select-hint">Rapor kaydetmek için extension popup\'tan giriş yapın.</span>';
    insertAfterPopupHeader(popup, row);
    return {
      needsSelection: false,
      getSelectedBrandId: () => null,
      autoBrandId: null,
    };
  }

  let brands = [];
  // Resolve dashboard URL once before rendering add-brand links
  const brandMgmtUrl = await buildBrandManagementUrlAsync();

  try {
    brands = await fetchAccessibleBrands();
  } catch (err) {
    console.error('Brand fetch failed:', err);
    row.innerHTML = `
      <span class="brand-select-error">Marka listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.</span>
      ${renderAddBrandButton('+ Yeni marka ekle', brandMgmtUrl)}
    `;
    insertAfterPopupHeader(popup, row);
    bindAddBrandButton(row, brandMgmtUrl);
    return {
      needsSelection: true,
      getSelectedBrandId: () => null,
      autoBrandId: null,
    };
  }

  const matched = matchBrandByPrefix(reportName, brands);

  // Prefix matched a real brand — auto-assign, no dropdown
  if (matched && matched.name !== 'Diğer') {
    row.innerHTML = `
      <span class="brand-detected-badge">
        Marka: <strong>${escapeHtml(matched.name)}</strong>
        ${matched.prefix ? `<span class="brand-prefix-tag">${escapeHtml(matched.prefix)}</span>` : ''}
      </span>
    `;
    insertAfterPopupHeader(popup, row);
    return {
      needsSelection: false,
      getSelectedBrandId: () => matched._id,
      autoBrandId: matched._id,
    };
  }

  // Prefix unknown — user must pick brand before save
  const options = brands.filter((b) => b.name !== 'Diğer');
  const list = options.length ? options : brands;

  if (!list.length) {
    row.innerHTML = `
      <span class="brand-select-error">Erişilebilir marka bulunamadı.</span>
      ${renderAddBrandButton('+ Yeni marka ekle', brandMgmtUrl)}
      <span class="brand-select-hint">Markayı ekledikten sonra bu sayfayı yenileyip tekrar kaydedin.</span>
    `;
    insertAfterPopupHeader(popup, row);
    bindAddBrandButton(row, brandMgmtUrl);
    return {
      needsSelection: true,
      getSelectedBrandId: () => null,
      autoBrandId: null,
    };
  }

  row.innerHTML = `
    <div class="brand-select-controls">
      <label class="brand-select-label" for="brandSelect">Marka *</label>
      <select id="brandSelect" class="brand-select-input">
        <option value="">— Marka seçin —</option>
        ${list
          .map(
            (b) =>
              `<option value="${b._id}">${escapeHtml(b.name)}${
                b.prefix ? ` (${escapeHtml(b.prefix)})` : ''
              }</option>`,
          )
          .join('')}
      </select>
      <button type="button" class="brand-save-btn" id="brandSaveBtn" disabled>Kaydet</button>
      ${renderAddBrandButton('+ Yeni marka', brandMgmtUrl)}
    </div>
    <span class="brand-select-hint">Rapor adından marka otomatik tanınamadı — listede yoksa yeni marka ekleyin</span>
  `;
  insertAfterPopupHeader(popup, row);
  bindAddBrandButton(row, brandMgmtUrl);

  const select = row.querySelector('#brandSelect');

  chrome.storage.sync.get(['lastBrandId'], (result) => {
    const lastId = result.lastBrandId;
    if (lastId && select?.querySelector(`option[value="${lastId}"]`)) {
      select.value = lastId;
    }
  });

  return {
    needsSelection: true,
    getSelectedBrandId: () => select?.value || null,
    autoBrandId: null,
    rememberSelection(brandId) {
      if (brandId) chrome.storage.sync.set({ lastBrandId: brandId });
    },
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
