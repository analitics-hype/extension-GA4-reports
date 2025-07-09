/**
 * HTML şablonları
 */

import { calculateBinaryWinnerProbabilities, calculateExtraTransactions } from './statistics.js';

/**
 * Metin uzunluğunu kısaltma yardımcı fonksiyonu
 * @param {string} text - Kısaltılacak metin
 * @param {number} maxLength - Maksimum karakter sayısı
 * @returns {string} Kısaltılmış metin
 */

// uzunluğa göre fontsize ı  dinamik yap
// function textLengthToFontSize(text) {
//    console.log('text', text.length);
//    if (text.length > 36) {
//     return 'style="font-size: 10px !important;"';
//    }else if (text.length > 34) {
//     return 'style="font-size: 12px !important;"';
//    }else if (text.length > 30) {
//     return 'style="font-size: 14px !important;"';
//    }else{
//     return '';
//    }
//   }
/**
 * Sonuç popup'ı için HTML şablonu
 * @param {Object} data - Gösterilecek veriler
 * @param {string} type - Gösterim tipi ('popup' veya 'listing')
 * @param {Array} metrics - Metrik isimleri listesi (listing tipi için)
 * @returns {Promise<string>} HTML içeriği
 */
export async function getResultsTemplate(data, type='popup', metrics) {

    // {
    //     "_id": "67d184f595f2981e2e55e94d",
    //     "reportName": "IP-51 - 29 Ocak",
    //     "brand": "İpragaz",
    //     "dateRange": "Jan 29 - Feb 10, 2025",
    //     "bussinessImpact": "",
    //     "testDuration": 13,
    //     "formattedStartDate": "29 Ocak 2025",
    //     "formattedEndDate": "10 Şubat 2025",
    //     "analysis": [
    //         {
    //             "control": {
    //                 "name": "IP-51 - Control",
    //                 "tabName": "Event count",
    //                 "sessions": 67662,
    //                 "conversions": 1461,
    //                 "cr": 2.1592622151281367
    //             },
    //             "variant": {
    //                 "name": "IP-51 - V1",
    //                 "tabName": "Sessions",
    //                 "sessions": 61616,
    //                 "conversions": 1255,
    //                 "cr": 2.036808621137367
    //             },
    //             "stats": {
    //                 "confidence": 6.273,
    //                 "isSignificant": false,
    //                 "probability": 0.06273,
    //                 "controlProbability": 93.7,
    //                 "variantProbability": 6.3
    //             },
    //             "improvement": -5.671084925806608,
    //             "date": "2025-03-12T13:07:10.629Z",
    //             "name": "Sessions",
    //             "resultStatus": "Kaybetti"
    //         }
    //     ],
    //     "status": "Canlı",
    //     "createdAt": "2025-03-12T12:58:29.898Z",
    //     "__v": 0
    // }

    
    
  const { reportName, dateRange, analysis, formattedStartDate, formattedEndDate, testDuration, resultStatus, sessionTab, conversionTab, bussinessImpact } = data;
  
  // Calculate binary winner probabilities for all variants (each vs control)
  const binaryWinnerProbabilities = await calculateBinaryWinnerProbabilities(analysis);
  
  // Helper function to get winner probability for a specific variant (binary comparison)
  const getBinaryWinnerProbability = (variantName) => {
    if (!binaryWinnerProbabilities) return 0;
    const binaryResult = binaryWinnerProbabilities.find(result => result.variantName === variantName);
    return binaryResult ? (binaryResult.variantWinProbability * 100) : 0;
  };
  
  // Varyantların dinnamik olarak oluşturulması
  let variantRows = '';
  
  // Helper function to calculate uplift
  const calculateUplift = (variantCR, controlCR) => {
    if (!controlCR || controlCR === 0) return 0;
    return ((variantCR - controlCR) / controlCR) * 100;
  };
  
  if (analysis.variants && Array.isArray(analysis.variants)) {
    // Tüm varyantları listele
    analysis.variants.forEach((variant, index) => {
      if (!variant) return; // Skip null variants
      
      const variantCR = variant.cr || 0;
      const controlCR = analysis.control?.cr || 0;
      
      // Calculate uplift if not present
      const uplift = variant.improvement !== undefined && variant.improvement !== null 
        ? variant.improvement 
        : calculateUplift(variantCR, controlCR);
        
      // Get binary winner probability for this variant (vs control only)
      const variantName = variant.name || `Varyasyon ${index + 1}`;
      const significanceValue = getBinaryWinnerProbability(variantName);
      
      // Calculate extra transactions for this variant
      const extraTransactions = calculateExtraTransactions(
        analysis.control?.conversions || 0,
        analysis.control?.sessions || 0,
        variant.conversions || 0,
        variant.sessions || 0,
        1000, // Default daily traffic
        0.5,  // Default traffic split (50%)
        testDuration || null // Test duration from data
      );
      
      variantRows += `
        <tr class="variant-row" data-variant-index="${index}">
            <td>${variant.name || `Varyasyon ${index + 1}`}</td>
            <td><input type="number" class="table-input" value="${variant.sessions || 0}" data-type="variant-users-${index}" /></td>
            <td><input type="number" class="table-input" value="${variant.conversions || 0}" data-type="variant-conversions-${index}" /></td>
            <td>${variantCR.toFixed(2)}%</td>
            <td class="metric-change ${uplift >= 0 ? 'positive' : 'negative'}">${uplift.toFixed(2)}%</td>
            <td>${significanceValue.toFixed(1)}%</td>
            <td class="metric-change ${extraTransactions.monthlyExtraTransactions >= 0 ? 'positive' : 'negative'}">${Math.round(extraTransactions.monthlyExtraTransactions).toLocaleString()}</td>
            <td class="metric-change ${extraTransactions.yearlyExtraTransactions >= 0 ? 'positive' : 'negative'}">${Math.round(extraTransactions.yearlyExtraTransactions).toLocaleString()}</td>
        </tr>
      `;
    });
  } else if (analysis.variant) {
    // Geriye dönük uyumluluk için (tek varyant durumu)
    const variantCR = analysis.variant.cr || 0;
    const controlCR = analysis.control?.cr || 0;
    
    // Calculate uplift if not present
    const uplift = analysis.improvement !== undefined && analysis.improvement !== null 
      ? analysis.improvement 
      : calculateUplift(variantCR, controlCR);
      
    // Get binary winner probability for this variant (vs control only)
    const variantName = analysis.variant.name || 'Varyasyon 1';
    const significanceValue = getBinaryWinnerProbability(variantName);
    
    // Calculate extra transactions for this variant
    const extraTransactions = calculateExtraTransactions(
      analysis.control?.conversions || 0,
      analysis.control?.sessions || 0,
      analysis.variant.conversions || 0,
      analysis.variant.sessions || 0,
      1000, // Default daily traffic
      0.5,  // Default traffic split (50%)
      testDuration || null // Test duration from data
    );
    
    variantRows = `
      <tr class="variant-row">
          <td>${analysis.variant.name || 'Varyasyon 1'}</td>
          <td><input type="number" class="table-input" value="${analysis.variant.sessions || 0}" data-type="variant-users" /></td>
          <td><input type="number" class="table-input" value="${analysis.variant.conversions || 0}" data-type="variant-conversions" /></td>
          <td>${variantCR.toFixed(2)}%</td>
          <td class="metric-change ${uplift >= 0 ? 'positive' : 'negative'}">${uplift.toFixed(2)}%</td>
          <td>${significanceValue.toFixed(1)}%</td>
          <td class="metric-change ${extraTransactions.monthlyExtraTransactions >= 0 ? 'positive' : 'negative'}">${Math.round(extraTransactions.monthlyExtraTransactions).toLocaleString()}</td>
          <td class="metric-change ${extraTransactions.yearlyExtraTransactions >= 0 ? 'positive' : 'negative'}">${Math.round(extraTransactions.yearlyExtraTransactions).toLocaleString()}</td>
      </tr>
    `;
  }
  
  return `
    ${type === 'listing' ? `
    <div class="listing-metrics">
        <div class="listing-metric-title">Metrics</div>
        <div class="listing-metrics-container">
            ${metrics && metrics.map((metricName, index) => `
                <div class="listing-metric-name" data-index="${index}">${metricName}</div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    <div class="abtest-popup">
      <div class="popup-header">
        <h2>${reportName}</h2>
        <div class="action-buttons">
          <div class="action-btn csv-btn">
                               <img src="https://useruploads.vwo.io/useruploads/529944/images/82a66a3300776ce62af68fba10f21463_group35.svg" alt="CSV" />
          </div>
          <div class="action-btn copy-btn">
            <img src="https://useruploads.vwo.io/useruploads/529944/images/0cb451af35031a4f1680968ddc953786_group3.svg" alt="Copy" />
          </div>
          <div class="action-btn close-btn">
            <img src="https://useruploads.vwo.io/useruploads/529944/images/14e9d32cf627604a3f3b67c04cee2499_group342.svg" alt="Close" />
          </div>
        </div>
      </div>

      <!-- Test detayları tablosu -->
      <div class="test-details">
                      <table class="details-table">
                    <tr>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Test Duration</th>
                        <th>Users</th>
                    </tr>
                    <tr>
                        <td><input type="text" class="detail-input" value="${formattedStartDate}" /></td>
                        <td>    <div class="end-date-container">
                                <select class="end-date-select">
                                    <option value="in_progress" selected>In Progress</option>
                                    <option value="end_date" >${formattedEndDate}</option>
                                     <option value="edit" >Düzenle</option>
                                </select>
                                <input type="text" class="end-date-input detail-input" value="${formattedEndDate}" style="display: none;" />
                                <div class="select-arrow">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                            </div></td>
                        <td>${testDuration} gün</td>
                        <td class="users-text">${getTotalUsers(analysis)}</td>
                    </tr>
                </table>
      </div>

      <!-- Test sonuçları tablosu -->
      <div class="test-results">
 <table class="results-table">
                    <thead>
                        <tr>
                            <th>Variant</th>
                            <th><input type="text" class="header-input" value="${data.sessionTab ? data.sessionTab: 'Users'}" /></th>
                            <th><input type="text" class="header-input" value="${data.conversionTab ? data.conversionTab  : 'Purchase'}"
                            
                             /></th>
                            <th>Conv. Rate</th>
                            <th>Uplift</th>
                            <th>Signif.</th>
                            <th>Monthly</th>
                            <th>Yearly</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="control-row">
                            <td>${analysis.control?.name || 'Kontrol'}</td>
                            <td><input type="number" class="table-input" value="${analysis.control?.sessions || 0}" data-type="control-users" /></td>
                            <td><input type="number" class="table-input" value="${analysis.control?.conversions || 0}" data-type="control-conversions" /></td>
                            <td>${(analysis.control?.cr || 0).toFixed(2)}%</td>
                            <td>-</td>
                            <td>${(() => {
                              // For control, show average win probability across all binary comparisons
                              if (!binaryWinnerProbabilities || binaryWinnerProbabilities.length === 0) return '0.0';
                              
                              // Calculate average control win probability across all binary comparisons
                              const avgControlWinProb = binaryWinnerProbabilities.reduce((sum, result) => 
                                sum + result.controlWinProbability, 0) / binaryWinnerProbabilities.length;
                              
                              return (avgControlWinProb * 100).toFixed(1);
                            })()}%</td>
                            <td>-</td>
                            <td>-</td>
                        </tr>
                        ${variantRows}
                    </tbody>
                </table>
      </div>

      <!-- Test sonuç bölümü -->
      <div class="test-conclusion">
                <div class="conclusion-header">
                    <label>Business Impact:</label>
                </div>
                <div class="conclusion-content">
                    <textarea id="conclusion-input" class="conclusion-input" rows="3" >${bussinessImpact}</textarea>
                    <div id="conclusion-input-copy"></div>
                </div>
                <div class="conclusion-footer">
                    <div class="conclusion-result ${getOverallResultStatus(analysis).toLowerCase()}">
                        <div class="conclusion-result-title">Sonuç</div>
                        <div class="conclusion-result-desc">${getOverallResultStatus(analysis)}</div>
                    </div>
                </div>
      </div>
    </div>
  `;
}

/**
 * Toplam kullanıcı sayısını hesaplar
 * @param {Object} analysis - Analiz verileri
 * @returns {string} Toplam kullanıcı sayısı
 */
function getTotalUsers(analysis) {
  if (!analysis || !analysis.control) return '0';
  
  let total = analysis.control.sessions || 0;
  
  if (analysis.variants && Array.isArray(analysis.variants)) {
    analysis.variants.forEach(variant => {
      if (variant) {
        total += variant.sessions || 0;
      }
    });
  } else if (analysis.variant) {
    total += analysis.variant.sessions || 0;
  }
  
  return total.toLocaleString();
}

/**
 * Genel sonuç durumunu belirler
 * @param {Object} analysis - Analiz verileri
 * @returns {string} Sonuç durumu
 */
function getOverallResultStatus(analysis) {
  if (!analysis) return 'Etkisiz';
  
  // Eski yapı için uyumluluk kontrolü
  if (analysis.stats && analysis.improvement !== undefined) {
    if (analysis.stats.variantProbability >= 95) {
      return 'Kazandı';
    } else if (analysis.stats.controlProbability >= 95) {
      return 'Kaybetti';
    } else {
      return 'Etkisiz';
    }
  }
  
  // Yeni yapı: tüm varyantları kontrol et
  if (analysis.variants && Array.isArray(analysis.variants) && analysis.variants.length > 0) {
    try {
      // En az bir kazanan varyant var mı kontrol et
      const winningVariants = analysis.variants.filter(v => v && v.stats && v.stats.variantProbability >= 95);
      
      if (winningVariants.length > 0) {
        return 'Kazandı';
      }
      
      // Tüm varyantlar kaybettiyse
      const losingVariants = analysis.variants.filter(v => v && v.stats && v.stats.controlProbability >= 95);
      if (losingVariants.length === analysis.variants.filter(v => v).length) {
        return 'Kaybetti';
      }
    } catch (error) {
      console.error('Sonuç durumu hesaplanırken hata:', error);
      return 'Etkisiz';
    }
  }
  
  return 'Etkisiz';
} 