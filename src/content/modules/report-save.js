/**
 * Shared report save logic for popup and quick-save flow
 */
import { formatData } from './ui-components.js';
import { showNotification } from './ui-components.js';
import { sendReportToBackend } from './api-service.js';
import { getStoredToken } from '../../utils/auth-store.js';

/** Save report from popup context with brand resolution */
export async function saveReportFromPopup(data, brandSelector) {
  const token = await getStoredToken();
  if (!token) {
    showNotification('Kaydetmek için extension popup\'tan giriş yapın.', 'error');
    return { success: false, reason: 'auth' };
  }

  const conclusionInput = document.querySelector('#conclusion-input');
  const dataWithImpact = {
    ...data,
    bussinessImpact: conclusionInput?.value || data.bussinessImpact || '',
  };

  const formattedData = await formatData(dataWithImpact);

  if (brandSelector) {
    const brandId = brandSelector.autoBrandId || brandSelector.getSelectedBrandId?.();
    if (brandSelector.needsSelection && !brandId) {
      showNotification('Kaydetmeden önce marka seçin.', 'error');
      return { success: false, reason: 'brand' };
    }
    if (brandId) {
      formattedData.brand = brandId;
      brandSelector.rememberSelection?.(brandId);
    }
  }

  await sendReportToBackend(formattedData);
  return { success: true };
}

/** Whether session + conversion KPIs are stored for this report */
export function hasBothKpiData(reportName) {
  try {
    const stored = JSON.parse(sessionStorage.getItem('ga4_abtest_data') || '{}');
    const entry = stored[reportName];
    return !!(entry?.sessionData && entry?.conversionData);
  } catch {
    return false;
  }
}
