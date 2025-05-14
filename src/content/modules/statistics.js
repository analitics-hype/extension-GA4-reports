/**
 * İstatistik hesaplama ile ilgili fonksiyonlar
 */

/**
 * AB Test analizi yapar
 * @param {Object} tableData - Tablo verileri
 * @returns {Object} Analiz sonuçları
 */
export function analyzeABTest(tableData) {
  // Kontrol grubunu bul (V0 veya control içeren)
  const control = tableData.segments.find(segment => 
    segment.segment.toLowerCase().includes('v0') || 
    segment.segment.toLowerCase().includes('control')
  );
  
  // Varyant gruplarını bul (kontrol olmayan tüm segmentler)
  const variants = tableData.segments.filter(segment => 
    !(segment.segment.toLowerCase().includes('v0') || 
      segment.segment.toLowerCase().includes('control'))
  );

  if (!control || variants.length === 0) {
    throw new Error('Kontrol veya varyant grubu bulunamadı');
  }

  const primaryMetric = tableData.kpis[0]; // Sessions
  const goalMetric = tableData.kpis[1];    // Transactions veya diğer hedef metrik

  // Kontrol grubu için conversion rate hesapla
  const controlCR = control.metrics[primaryMetric] > 0 
    ? (control.metrics[goalMetric] / control.metrics[primaryMetric]) * 100 
    : 0;
  
  // Her bir varyant için sonuçları hesapla
  const variantResults = variants.map(variant => {
    // Varyant için conversion rate hesapla
    const variantCR = variant.metrics[primaryMetric] > 0 
      ? (variant.metrics[goalMetric] / variant.metrics[primaryMetric]) * 100 
      : 0;
    
    // Değişim oranı (uplift) hesapla
    const improvement = controlCR > 0 
      ? ((variantCR - controlCR) / controlCR) * 100 
      : variantCR > 0 ? Infinity : 0;
    
    // İstatistiksel anlamlılık hesapla
    const stats = calculateSignificance(
      control.metrics[primaryMetric],
      control.metrics[goalMetric],
      variant.metrics[primaryMetric],
      variant.metrics[goalMetric]
    );
    
    return {
      name: variant.segment,
      sessions: variant.metrics[primaryMetric],
      conversions: variant.metrics[goalMetric],
      cr: variantCR,
      improvement,
      stats
    };
  });

  // Tek bir analiz sonucu nesnesi oluşturmak yerine, tüm varyantları içeren bir sonuç döndür
  return {
    control: {
      name: control.segment,
      sessions: control.metrics[primaryMetric],
      conversions: control.metrics[goalMetric],
      cr: controlCR
    },
    variants: variantResults
  };
}

/**
 * İstatistiksel anlamlılık hesaplar
 * @param {number} controlSessions - Kontrol grubu session sayısı
 * @param {number} controlConversions - Kontrol grubu dönüşüm sayısı
 * @param {number} variantSessions - Varyant grubu session sayısı
 * @param {number} variantConversions - Varyant grubu dönüşüm sayısı
 * @returns {Promise<Object>} İstatistiksel anlamlılık sonuçları
 */
export function calculateSignificance(controlSessions, controlConversions, variantSessions, variantConversions) {
  // Eğer variantConversions variantSessions'dan fazlaysa, direkt olarak %100 dön
  if (variantConversions > variantSessions) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['confidenceLevel'], function(result) {
        const requiredConfidence = result.confidenceLevel ? result.confidenceLevel / 100 : 0.95;
        resolve({
          confidence: 100,
          isSignificant: true,
          probability: 1,
          controlProbability: 0,
          variantProbability: 100
        });
      });
    });
  }

  // Monte Carlo simülasyonu için parametreler
  const iterations = 100000;
  let variantWins = 0;

  // Beta dağılımı parametreleri
  const controlAlpha = controlConversions + 1;
  const controlBeta = controlSessions - controlConversions + 1;
  const variantAlpha = variantConversions + 1;
  const variantBeta = variantSessions - variantConversions + 1;

  // Monte Carlo simülasyonu
  for (let i = 0; i < iterations; i++) {
    const controlMean = controlAlpha / (controlAlpha + controlBeta);
    const controlVar = (controlAlpha * controlBeta) / (Math.pow(controlAlpha + controlBeta, 2) * (controlAlpha + controlBeta + 1));
    const controlSample = normalApproximation(controlMean, Math.sqrt(controlVar));

    const variantMean = variantAlpha / (variantAlpha + variantBeta);
    const variantVar = (variantAlpha * variantBeta) / (Math.pow(variantAlpha + variantBeta, 2) * (variantAlpha + variantBeta + 1));
    const variantSample = normalApproximation(variantMean, Math.sqrt(variantVar));

    if (variantSample > controlSample) {
      variantWins++;
    }
  }

  // Varyantın ve kontrolün kazanma olasılıkları
  const variantProbability = (variantWins / iterations) * 100;
  const controlProbability = ((iterations - variantWins) / iterations) * 100;

  
  // Güven düzeyi ve anlamlılık için kayıtlı değeri kullan
  return new Promise((resolve) => {
    chrome.storage.sync.get(['confidenceLevel'], function(result) {
      const requiredConfidence = result.confidenceLevel ? result.confidenceLevel / 100 : 0.95;
      
      const probability = variantProbability / 100;
      const isSignificant = probability >= requiredConfidence;
      
      resolve({
        confidence: probability * 100,
        isSignificant,
        probability,
        controlProbability: parseFloat(controlProbability.toFixed(1)),
        variantProbability: parseFloat(variantProbability.toFixed(1))
      });
    });
  });
}

/**
 * Normal dağılım yaklaşımı için yardımcı fonksiyon
 * @param {number} mean - Ortalama
 * @param {number} stddev - Standart sapma
 * @returns {number} Normal dağılım değeri
 */
export function normalApproximation(mean, stddev) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  let result = mean + z * stddev;
  
  // 0-1 aralığında sınırla
  return Math.max(0, Math.min(1, result));
}

/**
 * Test süresini hesaplar
 * @param {string} dateRange - Tarih aralığı
 * @returns {number|null} Test süresi (gün)
 */
export function calculateTestDuration(dateRange) {
  // "1 Oca 2024 - 31 Oca 2024" formatındaki string'i parse et
  const dates = dateRange.split(' - ');
  if (dates.length !== 2) return null;

  // Türkçe ay isimlerini İngilizce'ye çevir
  const monthMap = {
    'Oca': 'Jan',
    'Şub': 'Feb',
    'Mar': 'Mar',
    'Nis': 'Apr',
    'May': 'May',
    'Haz': 'Jun',
    'Tem': 'Jul',
    'Ağu': 'Aug',
    'Eyl': 'Sep',
    'Eki': 'Oct',
    'Kas': 'Nov',
    'Ara': 'Dec'
  };

  function parseDate(dateStr) {
    // "1 Oca 2024" formatındaki tarihi parse et
    const parts = dateStr.trim().split(' ');
    const day = parts[0];
    const month = monthMap[parts[1]] || parts[1];
    const year = parts[2] || new Date().getFullYear(); // Yıl yoksa mevcut yılı kullan
    
    return new Date(`${month} ${day}, ${year}`);
  }

  const startDate = parseDate(dates[0]);
  const endDate = parseDate(dates[1]);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('Tarih parse edilemedi:', dates);
    return null;
  }
  
  // Milisaniyeyi güne çevir
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays + 1; // Başlangıç gününü de dahil etmek için +1
} 