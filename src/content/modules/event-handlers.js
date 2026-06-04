/**
 * Event listener'lar
 */

import { formatData, recalculateResults } from "./ui-components.js";
import { exportToCSV } from "./ui-components.js";
import { showNotification } from "./ui-components.js";
import { openAiCommentPanel } from "./ai-comment-panel.js";
import { initBrandSelector } from "./brand-selector.js";
import { saveReportFromPopup } from "./report-save.js";
import { getStoredToken } from "../../utils/auth-store.js";
import html2canvas from 'html2canvas';

/** Snapshot table inputs for dirty-state detection */
function captureTableInputSnapshot(popup) {
  const inputs = popup?.querySelectorAll('.table-input');
  if (!inputs?.length) return '';
  return Array.from(inputs, (input) => input.value).join('|');
}

/** Show popup header save button after metric edits */
function showDirtySaveButton(popup) {
  const btn = popup?.querySelector('.save-btn-dirty');
  if (btn) btn.style.display = '';
}

/** Hide popup header save button */
function hideDirtySaveButton(popup) {
  const btn = popup?.querySelector('.save-btn-dirty');
  if (btn) btn.style.display = 'none';
}

/** Run save with loading state on the clicked button */
async function runPopupSave(saveBtn, data, brandSelector, popup, onSuccess) {
  if (!saveBtn) return;

  const originalContent = saveBtn.innerHTML;
  saveBtn.innerHTML = `
      <div class="copy-loading">
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
  saveBtn.disabled = true;
  saveBtn.style.pointerEvents = 'none';
  saveBtn.classList.add('copy-loading-active');

  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    const result = await saveReportFromPopup(data, brandSelector);
    if (result.success) {
      showNotification('Rapor kaydedildi', 'success');
      hideDirtySaveButton(popup);
      onSuccess?.();
    }
  } catch (error) {
    console.error('Kaydetme işlemi hatası:', error);
  } finally {
    saveBtn.innerHTML = originalContent;
    saveBtn.disabled = false;
    saveBtn.style.pointerEvents = '';
    saveBtn.classList.remove('copy-loading-active');
  }
}

/**
 * Sonuç popup'ı için event listener'ları ekle
 * @param {HTMLElement} resultDiv - Sonuç div'i
 * @param {Object} data - Gösterilecek veriler
 * @param {string} type - Gösterim tipi ('popup' veya 'listing')
 */
export async function setupResultEventListeners(resultDiv, data, type = 'popup') {
  const popup = resultDiv.querySelector('.abtest-popup');
  if (!popup) return;

  const isLoggedIn = !!(await getStoredToken());

  // Brand picker — popup save flow only
  let brandSelector = null;
  if (type === 'popup') {
    brandSelector = await initBrandSelector(popup, data.reportName);
  }

  let tableInputBaseline = '';

  const refreshBaseline = () => {
    tableInputBaseline = captureTableInputSnapshot(popup);
  };

  const checkDirtyAndShowSave = () => {
    if (!isLoggedIn || type !== 'popup') return;
    if (captureTableInputSnapshot(popup) !== tableInputBaseline) {
      showDirtySaveButton(popup);
    }
  };

  const onTableInputChange = () => {
    recalculateResults(popup, data).catch((error) => {
      console.error('Sonuçlar yeniden hesaplanırken hata:', error);
    });
    checkDirtyAndShowSave();
  };

  // Listen for metric edits — show save when values change
  const tableInputs = popup.querySelectorAll('.table-input');
  tableInputs.forEach((input) => {
    input.addEventListener('change', onTableInputChange);
    input.addEventListener('input', onTableInputChange);
  });

  recalculateResults(popup, data)
    .then(() => refreshBaseline())
    .catch((error) => {
      console.error('İlk hesaplama yapılırken hata:', error);
    });

  setupDateDropdowns();

  popup.querySelector('.csv-btn')?.addEventListener('click', () => {
    exportToCSV(data);
  });

  // AI comment — only when logged in (button omitted from template otherwise)
  const aiBtn = popup.querySelector('.ai-btn');
  if (aiBtn && type === 'popup') {
    aiBtn.addEventListener('click', async () => {
      try {
        const formattedData = await formatData(data);
        openAiCommentPanel(popup, formattedData, (aiComment) => {
          const conclusionInput = document.querySelector('#conclusion-input');
          if (conclusionInput && aiComment) {
            conclusionInput.value = aiComment;
            conclusionInput.focus();
            conclusionInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      } catch (error) {
        console.error('AI panel açılırken hata:', error);
        showNotification('AI paneli açılamadı.', 'error');
      }
    });
  }

  // Dirty-state save in popup header
  const dirtySaveBtn = popup.querySelector('.save-btn-dirty');
  if (dirtySaveBtn && isLoggedIn && type === 'popup') {
    dirtySaveBtn.addEventListener('click', (event) => {
      const saveBtn = event.target.closest('.save-btn-dirty');
      runPopupSave(saveBtn, data, brandSelector, popup, refreshBaseline);
    });
  }

  // Brand row save when prefix could not be resolved
  const brandSaveBtn = popup.querySelector('#brandSaveBtn');
  const brandSelect = popup.querySelector('#brandSelect');
  if (brandSaveBtn && brandSelect && type === 'popup') {
    const syncBrandSaveDisabled = () => {
      brandSaveBtn.disabled = !brandSelect.value;
    };
    brandSelect.addEventListener('change', syncBrandSaveDisabled);
    syncBrandSaveDisabled();
    brandSaveBtn.addEventListener('click', () => {
      runPopupSave(brandSaveBtn, data, brandSelector, popup, refreshBaseline);
    });
  }

  // Auto-save after Analiz Et when brand was auto-detected
  if (data.saveAfterAnalyze && type === 'popup' && isLoggedIn && brandSelector?.autoBrandId) {
    setTimeout(async () => {
      try {
        const result = await saveReportFromPopup(data, brandSelector);
        if (result.success) {
          showNotification('Rapor kaydedildi', 'success');
          refreshBaseline();
        }
      } catch (err) {
        console.error('Analiz sonrası kayıt hatası:', err);
      }
    }, 400);
  }

  popup.querySelector('.copy-btn')?.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('.copy-btn');
    const originalContent = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <div class="copy-loading">
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
    copyBtn.disabled = true;
    copyBtn.style.pointerEvents = 'none';
    copyBtn.classList.add('copy-loading-active');

    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      await copyResultsAsImage(popup, data, type);
    } catch (error) {
      console.error('Kopyalama işlemi hatası:', error);
    } finally {
      copyBtn.innerHTML = originalContent;
      copyBtn.disabled = false;
      copyBtn.style.pointerEvents = '';
      copyBtn.classList.remove('copy-loading-active');
    }
  });

  popup.querySelector('.close-btn')?.addEventListener('click', () => {
    document.getElementById('ga4-abtest-overlay').style.display = 'none';
    document.getElementById('ga4-abtest-results').style.display = 'none';
  });

  if (type === 'listing') {
    setupMetricClickListeners(resultDiv, data);
  }
}

/**
 * Tarih dropdown'ları için event listener'ları ekle
 */
function setupDateDropdowns() {
  document.querySelectorAll('.end-date-select').forEach((dropdown) => {
    const input = dropdown.nextElementSibling;

    dropdown.addEventListener('change', (e) => {
      if (e.target.value === 'edit') {
        dropdown.style.display = 'none';
        input.style.display = 'block';
        input.focus();
      }
    });

    input.addEventListener('blur', () => {
      dropdown.style.display = 'block';
      input.style.display = 'none';
      dropdown.querySelector('option[value="end_date"]').textContent = input.value;
      dropdown.value = 'end_date';
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    });
  });
}

/**
 * Sonuçları görüntü olarak kopyala
 * @param {HTMLElement} popup - Popup elementi
 * @param {Object} data - Gösterilecek veriler
 */
async function copyResultsAsImage(popup, data, type = 'extension') {
  return new Promise(async (resolve, reject) => {
    try {
      const lastAnalysisData = sessionStorage.getItem('lastAnalysisData');

      if (lastAnalysisData) {
        data = await formatData(JSON.parse(lastAnalysisData));
      }

      document.querySelector('#conclusion-input-copy').innerHTML = document.querySelector('#conclusion-input').value;
      document.querySelector('#conclusion-input-copy').style.display = 'block';
      document.querySelector('#conclusion-input').style.display = 'none';
      document.querySelector('.action-buttons').style.display = 'none';
      document.querySelector('.select-arrow').style.display = 'none';

      const loadingElements = document.querySelectorAll('.copy-loading, .loading-spinner');
      loadingElements.forEach((el) => (el.style.display = 'none'));

      const popupElement = document.querySelector('.abtest-popup');
      const monthlyHeaders = popupElement.querySelectorAll('th:nth-child(7)');
      const yearlyHeaders = popupElement.querySelectorAll('th:nth-child(8)');
      const monthlyCells = popupElement.querySelectorAll('td:nth-child(7)');
      const yearlyCells = popupElement.querySelectorAll('td:nth-child(8)');

      monthlyHeaders.forEach((header) => (header.style.display = 'none'));
      yearlyHeaders.forEach((header) => (header.style.display = 'none'));
      monthlyCells.forEach((cell) => (cell.style.display = 'none'));
      yearlyCells.forEach((cell) => (cell.style.display = 'none'));

      html2canvas(popupElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      })
        .then((canvas) => {
          canvas.toBlob((blob) => {
            navigator.clipboard
              .write([new ClipboardItem({ 'image/png': blob })])
              .then(() => {
                showNotification('Görüntü panoya kopyalandı', 'success');
                resolve();
              })
              .catch((err) => {
                showNotification('Kopyalama başarısız: ' + err.message, 'error');
                reject(err);
              });
          });
        })
        .catch((err) => {
          showNotification('Görüntü oluşturulurken hata oluştu: ' + err.message, 'error');
          reject(err);
        })
        .finally(() => {
          document.querySelector('.action-buttons').style.display = 'flex';
          document.querySelector('.select-arrow').style.display = 'flex';
          document.querySelector('#conclusion-input').style.display = 'block';
          document.querySelector('#conclusion-input-copy').style.display = 'none';

          loadingElements.forEach((el) => (el.style.display = ''));

          monthlyHeaders.forEach((header) => (header.style.display = ''));
          yearlyHeaders.forEach((header) => (header.style.display = ''));
          monthlyCells.forEach((cell) => (cell.style.display = ''));
          yearlyCells.forEach((cell) => (cell.style.display = ''));
        });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Metrik tıklama işlevselliğini ekle
 * @param {HTMLElement} resultDiv - Sonuç div'i
 * @param {Object} data - Gösterilecek veriler
 */
function setupMetricClickListeners(resultDiv, data) {
  const metricElements = resultDiv.querySelectorAll('.listing-metric-name');

  metricElements.forEach((metricEl, index) => {
    metricEl.addEventListener('click', () => {
      metricElements.forEach((el) => {
        el.classList.remove('active');
      });
      metricEl.classList.add('active');

      if (data && data.analysis && Array.isArray(data.analysis) && data.analysis.length > index) {
        const selectedData = {
          ...data,
          analysis: data.analysis[index],
          resultStatus: data.analysis[index].resultStatus,
          sessionTab: data.analysis[index].control.tabName,
          conversionTab: data.analysis[index].name,
        };

        updateTableWithSelectedData(resultDiv, selectedData);
      } else if (data && !Array.isArray(data.analysis)) {
        if (index === 0) {
          return;
        }
      }
    });
  });
}

/**
 * Tabloyu seçilen verilerle güncelle
 * @param {HTMLElement} resultDiv - Sonuç div'i
 * @param {Object} selectedData - Seçilen veri
 */
function updateTableWithSelectedData(resultDiv, selectedData) {
  const popup = resultDiv.querySelector('.abtest-popup');

  const sessionTabInput = popup.querySelector('.header-input:nth-of-type(1)');
  const conversionTabInput = popup.querySelector('.header-input:nth-of-type(2)');

  if (sessionTabInput) {
    sessionTabInput.value = selectedData.sessionTab || 'Users';
  }

  if (conversionTabInput) {
    conversionTabInput.value = selectedData.conversionTab || 'Purchase';
  }

  const controlSessions = popup.querySelector('[data-type="control-users"]');
  const controlConversions = popup.querySelector('[data-type="control-conversions"]');

  if (controlSessions && selectedData.analysis.control) {
    controlSessions.value = selectedData.analysis.control.sessions;
  }

  if (controlConversions && selectedData.analysis.control) {
    controlConversions.value = selectedData.analysis.control.conversions;
  }

  if (selectedData.analysis.variant) {
    const variantSessions = popup.querySelector('[data-type="variant-users"]');
    const variantConversions = popup.querySelector('[data-type="variant-conversions"]');

    if (variantSessions) {
      variantSessions.value = selectedData.analysis.variant.sessions;
    }

    if (variantConversions) {
      variantConversions.value = selectedData.analysis.variant.conversions;
    }

    const controlCR = popup.querySelector('.control-row td:nth-child(4)');
    const variantCR = popup.querySelector('.variant-row td:nth-child(4)');

    if (controlCR) {
      controlCR.textContent = `${selectedData.analysis.control.cr.toFixed(2)}%`;
    }

    if (variantCR) {
      variantCR.textContent = `${selectedData.analysis.variant.cr.toFixed(2)}%`;
    }

    const upliftCell = popup.querySelector('.variant-row td:nth-child(5)');
    if (upliftCell) {
      upliftCell.textContent = `${selectedData.analysis.improvement.toFixed(2)}%`;
      upliftCell.className =
        selectedData.analysis.improvement >= 0 ? 'metric-change positive' : 'metric-change negative';
    }

    const controlSignificance = popup.querySelector('.control-row td:last-child');
    const variantSignificance = popup.querySelector('.variant-row td:last-child');

    if (controlSignificance) {
      controlSignificance.textContent = '-';
    }

    if (variantSignificance && selectedData.analysis.stats) {
      variantSignificance.textContent = `${selectedData.analysis.stats.variantProbability}%`;
    }
  } else if (selectedData.analysis.variants && Array.isArray(selectedData.analysis.variants)) {
    selectedData.analysis.variants.forEach((variant, index) => {
      const variantRow = popup.querySelector(`[data-variant-index="${index}"]`);
      if (!variantRow) return;

      const variantUsers = variantRow.querySelector(`[data-type="variant-users-${index}"]`);
      const variantConversions = variantRow.querySelector(`[data-type="variant-conversions-${index}"]`);

      if (variantUsers) {
        variantUsers.value = variant.sessions;
      }

      if (variantConversions) {
        variantConversions.value = variant.conversions;
      }

      const variantCR = variantRow.querySelector('td:nth-child(4)');
      const upliftCell = variantRow.querySelector('td:nth-child(5)');
      const variantSignificance = variantRow.querySelector('td:last-child');

      if (variantCR) {
        variantCR.textContent = `${variant.cr.toFixed(2)}%`;
      }

      if (upliftCell) {
        upliftCell.textContent = `${variant.improvement.toFixed(2)}%`;
        upliftCell.className = variant.improvement >= 0 ? 'metric-change positive' : 'metric-change negative';
      }

      if (variantSignificance && variant.stats) {
        variantSignificance.textContent = `${variant.stats.variantProbability}%`;
      }
    });

    const controlCR = popup.querySelector('.control-row td:nth-child(4)');
    const controlSignificance = popup.querySelector('.control-row td:last-child');

    if (controlCR) {
      controlCR.textContent = `${selectedData.analysis.control.cr.toFixed(2)}%`;
    }

    if (controlSignificance) {
      controlSignificance.textContent = '-';
    }
  }

  const usersText = popup.querySelector('.users-text');
  if (usersText) {
    let totalUsers = selectedData.analysis.control.sessions;

    if (selectedData.analysis.variant) {
      totalUsers += selectedData.analysis.variant.sessions;
    } else if (selectedData.analysis.variants) {
      selectedData.analysis.variants.forEach((variant) => {
        totalUsers += variant.sessions;
      });
    }

    usersText.textContent = totalUsers.toLocaleString();
  }

  const resultElement = popup.querySelector('.conclusion-result');
  const resultDescElement = popup.querySelector('.conclusion-result-desc');

  if (resultElement && resultDescElement) {
    resultElement.classList.remove('kazandı', 'kaybetti', 'etkisiz');
    const resultStatus = selectedData.resultStatus ? selectedData.resultStatus.toLowerCase() : 'etkisiz';
    resultElement.classList.add(resultStatus);
    resultDescElement.textContent = selectedData.resultStatus || 'Etkisiz';
  }

  recalculateResults(popup, selectedData).catch((error) => {
    console.error('Sonuçlar yeniden hesaplanırken hata:', error);
  });
}
