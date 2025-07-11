/**
 * İstatistik hesaplama ile ilgili fonksiyonlar
 */

/**
 * AB Test analizi yapar
 * @param {Object} tableData - Tablo verileri
 * @returns {Promise<Object>} Analiz sonuçları
 */
export async function analyzeABTest(tableData) {
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
  
  // Her bir varyant için sonuçları hesapla - Promise.all ile paralel işleme
  const variantPromises = variants.map(async (variant) => {
    // Varyant için conversion rate hesapla
    const variantCR = variant.metrics[primaryMetric] > 0 
      ? (variant.metrics[goalMetric] / variant.metrics[primaryMetric]) * 100 
      : 0;
    
    // Değişim oranı (uplift) hesapla
    const improvement = controlCR > 0 
      ? ((variantCR - controlCR) / controlCR) * 100 
      : variantCR > 0 ? Infinity : 0;
    
    // İstatistiksel anlamlılık hesapla - ARTIK AWAIT KULLANILIYOR
    const stats = await calculateSignificance(
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

  // Tüm varyant promise'larını bekle
  const variantResults = await Promise.all(variantPromises);

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
    // Giriş validasyonu
    if (controlSessions < 0 || controlConversions < 0 || variantSessions < 0 || variantConversions < 0) {
        return { variantProbability: 50, controlProbability: 50, significant: false };
    }
    
    if (controlConversions > controlSessions || variantConversions > variantSessions) {
        return { variantProbability: 50, controlProbability: 50, significant: false };
    }

    // Monte Carlo simülasyonu - Beta dağılımından örnekleme
    const iterations = 50000;
    let variantWins = 0;
    let controlWins = 0;

    // Beta dağılımı parametreleri (Bayesian yaklaşım)
    const controlAlpha = controlConversions + 1;
    const controlBeta = controlSessions - controlConversions + 1;
    const variantAlpha = variantConversions + 1;
    const variantBeta = variantSessions - variantConversions + 1;

    for (let i = 0; i < iterations; i++) {
        const controlSample = betaRandom(controlAlpha, controlBeta);
        const variantSample = betaRandom(variantAlpha, variantBeta);

        if (variantSample > controlSample) {
            variantWins++;
        } else if (controlSample > variantSample) {
            controlWins++;
        }
        // Eşitlik durumu variantWins ve controlWins'e eklenmez
    }

    const variantProbability = (variantWins / iterations) * 100;
    const controlProbability = (controlWins / iterations) * 100;
    
    // Güven seviyesini Chrome storage'dan al
    return new Promise((resolve) => {
        chrome.storage.sync.get(['confidenceLevel'], (result) => {
            const confidenceLevel = result.confidenceLevel || 95;
            
            // Hem pozitif hem negatif etkileri tespit et
            const isSignificant = variantProbability >= confidenceLevel || controlProbability >= confidenceLevel;
            
            resolve({
                variantProbability: parseFloat(variantProbability.toFixed(1)),
                controlProbability: parseFloat(controlProbability.toFixed(1)),
                significant: isSignificant
            });
        });
    });
}

/**
 * Beta dağılımından rastgele sayı üretir
 * @param {number} alpha - Alpha parametresi
 * @param {number} beta - Beta parametresi
 * @returns {number} Beta dağılımından rastgele sayı (0-1 arası)
 */
function betaRandom(alpha, beta) {
  // Gamma dağılımlarından Beta dağılımı üretme
  const x = gammaRandom(alpha, 1);
  const y = gammaRandom(beta, 1);
  return x / (x + y);
}

/**
 * Gamma dağılımından rastgele sayı üretir
 * @param {number} shape - Shape parametresi (alpha)
 * @param {number} scale - Scale parametresi
 * @returns {number} Gamma dağılımından rastgele sayı
 */
function gammaRandom(shape, scale) {
  // Marsaglia and Tsang's method
  if (shape < 1) {
    // For shape < 1, use rejection method
    return gammaRandom(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  
  while (true) {
    let x, v;
    
    do {
      x = normalRandom(0, 1);
      v = 1 + c * x;
    } while (v <= 0);
    
    v = v * v * v;
    const u = Math.random();
    
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale;
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Standart normal dağılımdan rastgele sayı üretir (Box-Muller yöntemi)
 * @param {number} mean - Ortalama
 * @param {number} stddev - Standart sapma
 * @returns {number} Normal dağılımdan rastgele sayı
 */
function normalRandom(mean, stddev) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z * stddev + mean;
}

/**
 * Normal dağılım yaklaşımı için yardımcı fonksiyon (deprecated - artık kullanılmıyor)
 * @param {number} mean - Ortalama
 * @param {number} stddev - Standart sapma
 * @returns {number} Normal dağılım değeri
 */
export function normalApproximation(mean, stddev) {
  console.warn('normalApproximation fonksiyonu deprecated - normalRandom kullanın');
  return normalRandom(mean, stddev);
}

/**
 * Binary winner probabilities hesaplar (her varyant vs kontrol ayrı ayrı)
 * Frontend popup ile uyumlu olması için
 * @param {Object} analysis - Analiz verileri
 * @returns {Object|null} Binary winner probabilities
 */
export async function calculateBinaryWinnerProbabilities(analysis) {
  if (!analysis || !analysis.control) return null;
  
  try {
    const results = [];
    
    // Control data
    const controlData = {
      name: analysis.control.name || 'Control',
      conversions: analysis.control.conversions || 0,
      sessions: analysis.control.sessions || 0,
      isControl: true
    };

    // Handle multiple variants or single variant
    const variants = [];
    if (analysis.variants && Array.isArray(analysis.variants)) {
      analysis.variants.forEach((variant, index) => {
        if (variant) {
          variants.push({
            name: variant.name || `Varyasyon ${index + 1}`,
            conversions: variant.conversions || 0,
            sessions: variant.sessions || 0,
            isControl: false
          });
        }
      });
    } else if (analysis.variant) {
      // Legacy single variant
      variants.push({
        name: analysis.variant.name || 'Varyasyon 1',
        conversions: analysis.variant.conversions || 0,
        sessions: analysis.variant.sessions || 0,
        isControl: false
      });
    }

    // Calculate binary comparison for each variant vs control
    for (const variant of variants) {
      // Calculate significance for this binary comparison
      const binaryStats = await calculateSignificance(
        controlData.sessions,
        controlData.conversions,
        variant.sessions,
        variant.conversions
      );
      
      // Store results for this variant comparison
      results.push({
        variantName: variant.name,
        controlWinProbability: binaryStats.controlProbability / 100,
        variantWinProbability: binaryStats.variantProbability / 100
      });
    }

    return results;
  } catch (error) {
    console.error('Error calculating binary winner probabilities:', error);
    return null;
  }
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

/**
 * Extra transactions hesaplar (monthly ve yearly)
 * @param {number} controlConversions - Kontrol grubu conversions
 * @param {number} controlSessions - Kontrol grubu sessions
 * @param {number} variantConversions - Varyant conversions
 * @param {number} variantSessions - Varyant sessions
 * @param {number} dailyTraffic - Günlük trafik (default: 1000)
 * @param {number} trafficSplit - Trafik dağılımı (default: 0.5)
 * @param {number} testDuration - Test süresi (gün, opsiyonel)
 * @returns {Object} Extra transactions data
 */
export function calculateExtraTransactions(controlConversions, controlSessions, variantConversions, variantSessions, dailyTraffic = 1000, trafficSplit = 0.5, testDuration = null) {
  try {
    // Conversion rate'leri hesapla
    const controlRate = controlSessions > 0 ? controlConversions / controlSessions : 0;
    const variantRate = variantSessions > 0 ? variantConversions / variantSessions : 0;
    
    // Lift hesapla
    const absoluteLift = variantRate - controlRate; // Absolute lift
    const relativeLift = controlRate > 0 ? (variantRate - controlRate) / controlRate : 0; // Relative lift (percentage)
    
    // Calculate daily total traffic (control + variant combined)
    let dailyTotalTraffic;
    if (testDuration && testDuration > 0) {
      // Use actual total traffic per day from test
      dailyTotalTraffic = (controlSessions + variantSessions) / testDuration;
    } else {
      // Use provided daily traffic (assuming it represents total traffic)
      dailyTotalTraffic = dailyTraffic;
    }
    
    // Calculate daily extra transactions using absolute lift
    // If winning variant was deployed to all traffic:
    // Daily extra = (daily total traffic * absolute lift)
    const dailyExtraTransactions = dailyTotalTraffic * absoluteLift;
    const monthlyExtraTransactions = dailyExtraTransactions * 30;
    const yearlyExtraTransactions = dailyExtraTransactions * 365;
    
    return {
      dailyExtraTransactions,
      monthlyExtraTransactions,
      yearlyExtraTransactions,
      lift: relativeLift * 100 // Percentage lift
    };
  } catch (error) {
    console.error('Error calculating extra transactions:', error);
    return {
      dailyExtraTransactions: 0,
      monthlyExtraTransactions: 0,
      yearlyExtraTransactions: 0,
      lift: 0
    };
  }
} 