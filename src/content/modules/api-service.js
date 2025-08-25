/**
 * API işlemleri ile ilgili fonksiyonlar
 */

import { showNotification } from './ui-components.js';

/**
 * AI ile yorum al
 * @param {Object} data - Analiz edilecek veriler
 * @returns {Promise<string>} AI yorumu
 */
export async function getAIComment(data) {
  // Veriyi backend formatına dönüştür
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
      variants: data.analysis.variants || []
    }
  };

  // Geriye dönük uyumluluk için (eski sistem için)
  if (data.analysis.variant && !data.analysis.variants) {
    backendData.analysis.variant = data.analysis.variant;
    backendData.analysis.improvement = data.analysis.improvement;
    backendData.analysis.stats = data.analysis.stats;
  } 
  // Yeni çoklu varyant sistemi için - sadece genel stats'ı ayarla
  else if (data.analysis.variants && data.analysis.variants.length > 0) {
    const firstVariant = data.analysis.variants[0];
    backendData.analysis.variant = firstVariant;
    backendData.analysis.improvement = firstVariant.improvement;
    backendData.analysis.stats = firstVariant.stats;
  }

  // Backend AI endpoint'ine gönder
  return fetch(process.env.API_URL + '/reports/ai-comment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backendData)
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
  // Veriyi backend formatına dönüştür
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
      // Yeni çoklu varyant desteği - her variant kendi stats'ı ile birlikte
      variants: data.analysis.variants || []
    }
  };
  
  // Geriye dönük uyumluluk için (eski sistem için)
  if (data.analysis.variant && !data.analysis.variants) {
    backendData.analysis.variant = data.analysis.variant;
    backendData.analysis.improvement = data.analysis.improvement;
    backendData.analysis.stats = data.analysis.stats;
  } 
  // Yeni çoklu varyant sistemi için - sadece genel stats'ı ayarla
  else if (data.analysis.variants && data.analysis.variants.length > 0) {
    // Eğer variants dizisi varsa, ilk varyantın improvement ve stats değerlerini genel analysis için kullan
    const firstVariant = data.analysis.variants[0];
    backendData.analysis.variant = firstVariant;
    backendData.analysis.improvement = firstVariant.improvement;
    backendData.analysis.stats = firstVariant.stats;
    
    // ÖNEMLI: Her variant'ın kendi stats verisi korunuyor
    // Bu, variants dizisinde zaten mevcut olduğu için ekstra bir işlem gerektirmiyor
  }
  
  // Backend API'ye gönder
  return fetch(process.env.API_URL + '/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backendData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Rapor başarıyla kaydedildi!', 'success');
      return { success: true, data };
    } else {
      if (data.error && data.error.includes('duplicate key error')) {
        showNotification('Bu isimde bir rapor zaten mevcut!', 'error');
      } else {
        showNotification('Rapor kaydedilirken hata oluştu: ' + (data.error || 'Bilinmeyen hata'), 'error');
      }
      throw new Error(data.error || 'Bilinmeyen hata');
    }
  })
  .catch(error => {
    console.error('Rapor gönderilirken hata:', error);
    showNotification('Sunucu bağlantısında hata oluştu.', 'error');
    throw error;
  });
} 