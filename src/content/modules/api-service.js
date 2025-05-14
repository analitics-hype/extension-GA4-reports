/**
 * API işlemleri ile ilgili fonksiyonlar
 */

import { showNotification } from './ui-components.js';

/**
 * Rapor verilerini backend'e gönder
 * @param {Object} data - Gönderilecek veriler
 */
export async function sendReportToBackend(data) {
  // Rapor verilerini hazırla
  console.log("Frontend'den gelen veri:", data);
  
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
      // Yeni çoklu varyant desteği
      variants: data.analysis.variants || []
    }
  };
  
  // Geriye dönük uyumluluk için (eski sistem için)
  if (data.analysis.variant && !data.analysis.variants) {
    backendData.analysis.variant = data.analysis.variant;
    backendData.analysis.improvement = data.analysis.improvement;
    backendData.analysis.stats = data.analysis.stats;
  } 
  // Yeni çoklu varyant sistemi için
  else if (data.analysis.variants && data.analysis.variants.length > 0) {
    // Eğer variants dizisi varsa, ilk varyantın improvement ve stats değerlerini kullan
    const firstVariant = data.analysis.variants[0];
    backendData.analysis.variant = firstVariant;
    backendData.analysis.improvement = firstVariant.improvement;
    backendData.analysis.stats = firstVariant.stats;
  }
  
  console.log("Backend'e gönderilecek veri:", backendData);
  
  // Backend API'ye gönder
  fetch(process.env.API_URL + '/reports', {
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
    } else {
      if (data.error && data.error.includes('duplicate key error')) {
        showNotification('Bu isimde bir rapor zaten mevcut!', 'error');
      } else {
        showNotification('Rapor kaydedilirken hata oluştu: ' + (data.error || 'Bilinmeyen hata'), 'error');
      }
    }
  })
  .catch(error => {
    console.error('Rapor gönderilirken hata:', error);
    showNotification('Sunucu bağlantısında hata oluştu.', 'error');
  });
} 