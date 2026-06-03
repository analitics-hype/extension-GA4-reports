/**
 * API işlemleri ile ilgili fonksiyonlar
 */

import { showNotification } from './ui-components.js';
import { getAuthHeaders } from '../../utils/auth-store.js';
import { persistRecentReport } from '../../utils/recent-reports.js';

/**
 * Build backend payload from analysis data
 */
function buildAICommentPayload(data) {
  const backendData = {
    reportName: data.reportName,
    dateRange: data.dateRange,
    formattedStartDate: data.formattedStartDate,
    formattedEndDate: data.formattedEndDate,
    testDuration: data.testDuration,
    resultStatus: data.resultStatus,
    sessionTab: data.sessionTab,
    conversionTab: data.conversionTab,
    analysis: {
      control: data.analysis.control,
      variants: data.analysis.variants || [],
    },
  };

  if (data.analysis.variant && !data.analysis.variants) {
    backendData.analysis.variant = data.analysis.variant;
    backendData.analysis.improvement = data.analysis.improvement;
    backendData.analysis.stats = data.analysis.stats;
  } else if (data.analysis.variants?.length > 0) {
    const firstVariant = data.analysis.variants[0];
    backendData.analysis.variant = firstVariant;
    backendData.analysis.improvement = firstVariant.improvement;
    backendData.analysis.stats = firstVariant.stats;
  }

  return backendData;
}

/** Fetch available AI prompt templates */
export async function fetchAIPromptTemplates() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${process.env.API_URL}/reports/ai-prompt-templates`, { headers });
  const json = await response.json();
  if (!json.success) throw new Error(json.error || 'Şablonlar alınamadı');
  return json.data || [];
}

/** Preview assembled prompt without calling OpenAI */
export async function previewAIPrompt(data, options = {}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${process.env.API_URL}/reports/ai-comment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...buildAICommentPayload(data),
      previewOnly: true,
      promptTemplate: options.promptTemplate || 'executive',
      customInstructions: options.customInstructions || '',
    }),
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error || 'Önizleme alınamadı');
  return json.prompt;
}

/**
 * AI ile yorum al
 * @param {Object} data - Analiz edilecek veriler
 * @param {Object} options - promptTemplate, customInstructions
 * @returns {Promise<string>} AI yorumu
 */
export async function getAIComment(data, options = {}) {
  const headers = await getAuthHeaders();

  return fetch(process.env.API_URL + '/reports/ai-comment', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...buildAICommentPayload(data),
      promptTemplate: options.promptTemplate || 'executive',
      customInstructions: options.customInstructions || '',
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      return data.comment;
    } else {
      showNotification('AI yorum alınırken hata oluştu: ' + (data.error || 'Bilinmeyen hata'), 'error');
      throw new Error(data.error || 'Bilinmeyen hata');
    }
  })
  .catch(error => {
    console.error('AI yorum alınırken hata:', error);
    showNotification('AI servisi şu anda kullanılamıyor.', 'error');
    throw error;
  });
}

/**
 * Rapor verilerini backend'e gönder
 * @param {Object} data - Gönderilecek veriler
 */
export async function sendReportToBackend(data) {
  const backendData = {
    reportName: data.reportName,
    dateRange: data.dateRange,
    bussinessImpact: data.bussinessImpact || "",
    formattedStartDate: data.formattedStartDate,
    formattedEndDate: data.formattedEndDate,
    testDuration: data.testDuration,
    resultStatus: data.resultStatus,
    sessionTab: data.sessionTab,
    conversionTab: data.conversionTab,
    analysis: {
      control: data.analysis.control,
      variants: data.analysis.variants || []
    }
  };
  
  if (data.analysis.variant && !data.analysis.variants) {
    backendData.analysis.variant = data.analysis.variant;
    backendData.analysis.improvement = data.analysis.improvement;
    backendData.analysis.stats = data.analysis.stats;
  } else if (data.analysis.variants && data.analysis.variants.length > 0) {
    const firstVariant = data.analysis.variants[0];
    backendData.analysis.variant = firstVariant;
    backendData.analysis.improvement = firstVariant.improvement;
    backendData.analysis.stats = firstVariant.stats;
  }

  if (data.brand) {
    backendData.brand = data.brand;
  }

  const headers = await getAuthHeaders();

  if (!headers.Authorization) {
    showNotification('Rapor kaydetmek için extension popup\'tan giriş yapın.', 'error');
    throw new Error('Not authenticated');
  }
  
  return fetch(process.env.API_URL + '/reports', {
    method: 'POST',
    headers,
    body: JSON.stringify(backendData)
  })
  .then(async (response) => {
    const data = await response.json();
    if (data.success) {
      showNotification('Rapor başarıyla kaydedildi!', 'success');

      const saved = data.data || {};
      await persistRecentReport({
        id: saved._id,
        name: saved.reportName,
        status: saved.status || 'Taslak',
        brandName: saved.brand?.name || null,
        savedAt: new Date().toISOString(),
      });

      return { success: true, data };
    }
    if (response.status === 401) {
      showNotification('Oturum süresi doldu. Extension popup\'tan tekrar giriş yapın.', 'error');
    } else if (data.error && data.error.includes('duplicate key error')) {
      showNotification('Bu isimde bir rapor zaten mevcut!', 'error');
    } else {
      showNotification('Rapor kaydedilirken hata oluştu: ' + (data.error || 'Bilinmeyen hata'), 'error');
    }
    throw new Error(data.error || 'Bilinmeyen hata');
  })
  .catch(error => {
    if (error.message !== 'Not authenticated') {
      console.error('Rapor gönderilirken hata:', error);
      showNotification('Sunucu bağlantısında hata oluştu.', 'error');
    }
    throw error;
  });
}
