/**
 * AI comment panel — template picker, custom instructions, prompt preview
 */
import { fetchAIPromptTemplates, previewAIPrompt, getAIComment } from './api-service.js';
import { showNotification } from './ui-components.js';

const STORAGE_KEY = 'aiPromptPreferences';

/** Load saved template + custom instructions from extension storage */
function loadPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || { promptTemplate: 'executive', customInstructions: '' });
    });
  });
}

function savePreferences(prefs) {
  chrome.storage.local.set({ [STORAGE_KEY]: prefs });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Debounce helper for prompt preview refresh */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Open AI settings panel inside analysis popup
 * @param {HTMLElement} popup
 * @param {Object} reportData - formatted report payload
 * @param {(comment: string) => void} onGenerated
 */
export async function openAiCommentPanel(popup, reportData, onGenerated) {
  popup.querySelector('.ai-prompt-panel')?.remove();

  const prefs = await loadPreferences();
  let templates = [];

  try {
    templates = await fetchAIPromptTemplates();
  } catch {
    templates = [
      { id: 'executive', label: 'Executive Özet', description: 'Kısa yönetici özeti' },
      { id: 'detailed', label: 'Detaylı CRO Analizi', description: 'Derinlemesine analiz' },
      { id: 'stakeholder', label: 'Stakeholder Özeti', description: 'Teknik olmayan dil' },
      { id: 'action', label: 'Karar & Aksiyon', description: 'Net karar ve adımlar' },
      { id: 'risk', label: 'Risk Analizi', description: 'İstatistiksel riskler' },
    ];
  }

  const panel = document.createElement('div');
  panel.className = 'ai-prompt-panel';
  panel.innerHTML = `
    <div class="ai-prompt-panel-header">
      <div>
        <h3 class="ai-prompt-title">AI Yorum Ayarları</h3>
        <p class="ai-prompt-subtitle">Şablon seçin, isteğe bağlı ek talimat ekleyin ve promptu inceleyin</p>
      </div>
      <button type="button" class="ai-prompt-close" aria-label="Kapat">&times;</button>
    </div>

    <label class="ai-prompt-label" for="aiPromptTemplate">Yorum şablonu</label>
    <select id="aiPromptTemplate" class="ai-prompt-select">
      ${templates
        .map(
          (t) =>
            `<option value="${escapeHtml(t.id)}" title="${escapeHtml(t.description || '')}">${escapeHtml(t.label)}</option>`,
        )
        .join('')}
    </select>
    <p class="ai-prompt-template-desc" id="aiPromptTemplateDesc"></p>

    <label class="ai-prompt-label" for="aiPromptCustom">Ek talimatlar <span class="ai-prompt-optional">(isteğe bağlı)</span></label>
    <textarea
      id="aiPromptCustom"
      class="ai-prompt-textarea"
      rows="3"
      maxlength="1200"
      placeholder="Örn: Mobil trafik ağırlıklı yorumla / Rakip kampanya dönemini dikkate al / Sonuçları İngilizce yaz"
    ></textarea>

    <details class="ai-prompt-preview-wrap">
      <summary class="ai-prompt-preview-toggle">Temel promptu görüntüle</summary>
      <pre class="ai-prompt-preview" id="aiPromptPreview">Yükleniyor...</pre>
    </details>

    <div class="ai-prompt-actions">
      <button type="button" class="ai-prompt-cancel">İptal</button>
      <button type="button" class="ai-prompt-generate">
        <span class="ai-prompt-generate-label">Yorum Oluştur</span>
      </button>
    </div>
  `;

  const actionButtons = popup.querySelector('.action-buttons');
  if (actionButtons) {
    actionButtons.insertAdjacentElement('beforebegin', panel);
  } else {
    popup.appendChild(panel);
  }

  const templateSelect = panel.querySelector('#aiPromptTemplate');
  const templateDesc = panel.querySelector('#aiPromptTemplateDesc');
  const customInput = panel.querySelector('#aiPromptCustom');
  const previewEl = panel.querySelector('#aiPromptPreview');
  const generateBtn = panel.querySelector('.ai-prompt-generate');
  const generateLabel = panel.querySelector('.ai-prompt-generate-label');

  templateSelect.value = prefs.promptTemplate || 'executive';
  customInput.value = prefs.customInstructions || '';

  const updateTemplateDesc = () => {
    const selected = templates.find((t) => t.id === templateSelect.value);
    templateDesc.textContent = selected?.description || '';
  };

  const getOptions = () => ({
    promptTemplate: templateSelect.value,
    customInstructions: customInput.value.trim(),
  });

  const refreshPreview = debounce(async () => {
    previewEl.textContent = 'Yükleniyor...';
    try {
      const prompt = await previewAIPrompt(reportData, getOptions());
      previewEl.textContent = prompt || 'Prompt oluşturulamadı.';
    } catch {
      previewEl.textContent = 'Prompt önizlemesi alınamadı.';
    }
  }, 350);

  const closePanel = () => panel.remove();

  templateSelect.addEventListener('change', () => {
    updateTemplateDesc();
    savePreferences(getOptions());
    refreshPreview();
  });

  customInput.addEventListener('input', () => {
    savePreferences(getOptions());
    refreshPreview();
  });

  panel.querySelector('.ai-prompt-close').addEventListener('click', closePanel);
  panel.querySelector('.ai-prompt-cancel').addEventListener('click', closePanel);

  generateBtn.addEventListener('click', async () => {
    const options = getOptions();
    savePreferences(options);

    generateBtn.disabled = true;
    generateLabel.textContent = 'Oluşturuluyor...';

    try {
      const comment = await getAIComment(reportData, options);
      onGenerated?.(comment);
      showNotification('AI yorumu oluşturuldu', 'success');
      closePanel();
    } catch (err) {
      console.error('AI yorum hatası:', err);
    } finally {
      generateBtn.disabled = false;
      generateLabel.textContent = 'Yorum Oluştur';
    }
  });

  updateTemplateDesc();
  refreshPreview();
}
