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
  <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="19" viewBox="0 0 18 19" fill="none">
    <g clip-path="url(#clip0_1_15)">
      <path d="M11.4525 10.73L9.975 12.5L11.4525 14.27C11.715 14.585 11.6775 15.0575 11.355 15.3275C11.2125 15.4475 11.0475 15.5 10.875 15.5C10.6575 15.5 10.4475 15.41 10.2975 15.23L9 13.67L7.7025 15.23C7.5525 15.41 7.3425 15.5 7.125 15.5C6.9525 15.5 6.7875 15.44 6.645 15.3275C6.33 15.065 6.285 14.5925 6.5475 14.27L8.025 12.5L6.5475 10.73C6.285 10.415 6.3225 9.9425 6.645 9.6725C6.9675 9.41 7.4325 9.4475 7.7025 9.77L9 11.33L10.2975 9.77C10.56 9.455 11.0325 9.41 11.355 9.6725C11.67 9.935 11.715 10.4075 11.4525 10.73ZM16.5 8.3675V14.75C16.5 16.82 14.82 18.5 12.75 18.5H5.25C3.18 18.5 1.5 16.82 1.5 14.75V4.25C1.5 2.18 3.18 0.5 5.25 0.5H8.6325C10.035 0.5 11.355 1.0475 12.345 2.0375L14.955 4.655C15.945 5.645 16.4925 6.965 16.4925 8.3675H16.5ZM11.2875 3.095C11.0475 2.855 10.785 2.6525 10.5 2.4875V5.75C10.5 6.1625 10.8375 6.5 11.25 6.5H14.505C14.34 6.215 14.1375 5.9525 13.8975 5.7125L11.2875 3.095ZM15 8.36C15 8.24 15 8.1125 14.985 7.9925H11.25C10.0125 7.9925 9 6.98 9 5.7425V2.015C8.88 2 8.76 2 8.6325 2H5.25C4.0125 2 3 3.0125 3 4.25V14.75C3 15.9875 4.0125 17 5.25 17H12.75C13.9875 17 15 15.9875 15 14.75V8.3675V8.36Z" fill="#0E2C2D"/>
    </g>
    <defs>
      <clipPath id="clip0_1_15">
        <rect width="18" height="18" fill="white" transform="translate(0 0.5)"/>
      </clipPath>
    </defs>
  </svg></span> CSV Formatı
        </div>
        <div class="action-btn ai-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="19" viewBox="0 0 18 19" fill="none">
                <g opacity="0.8" clip-path="url(#clip0_1_19)">
                  <path d="M14.6247 18.4999C14.4747 18.5 14.3282 18.4552 14.2041 18.3713C14.0799 18.2873 13.9837 18.1681 13.9279 18.0289L13.2949 16.4442L11.7079 15.7759C11.5718 15.7158 11.4564 15.6168 11.3764 15.4914C11.2963 15.3659 11.2551 15.2196 11.2579 15.0708C11.2607 14.922 11.3074 14.7774 11.3921 14.655C11.4769 14.5327 11.5959 14.4381 11.7342 14.3832L13.3002 13.7899L13.9279 12.2209C13.9856 12.0838 14.0825 11.9668 14.2065 11.8845C14.3304 11.8022 14.4759 11.7583 14.6247 11.7583C14.7734 11.7583 14.9189 11.8022 15.0428 11.8845C15.1668 11.9668 15.2637 12.0838 15.3214 12.2209L15.9522 13.7959L17.5272 14.4267C17.6645 14.4841 17.7819 14.5809 17.8644 14.7049C17.9469 14.8289 17.991 14.9745 17.991 15.1234C17.991 15.2723 17.9469 15.418 17.8644 15.5419C17.7819 15.6659 17.6645 15.7627 17.5272 15.8202L15.9522 16.4509L15.3214 18.0259C15.2661 18.1656 15.1701 18.2855 15.0459 18.37C14.9217 18.4545 14.7749 18.4998 14.6247 18.4999ZM7.49966 16.2499C7.17564 16.2538 6.85907 16.1527 6.59732 15.9616C6.33558 15.7706 6.14274 15.5 6.04766 15.1902L4.83716 11.4049L1.03991 10.1344C0.733428 10.032 0.467444 9.83478 0.280371 9.57129C0.0932984 9.3078 -0.00517948 8.99167 -0.000839003 8.66855C0.00350147 8.34544 0.110436 8.03207 0.304519 7.7737C0.498602 7.51533 0.769787 7.32534 1.07891 7.23117L4.84616 6.08067L6.11516 2.29017C6.20951 1.97882 6.40468 1.70767 6.66997 1.51936C6.93525 1.33106 7.25561 1.23627 7.58066 1.24992C7.90473 1.25036 8.21995 1.35574 8.47913 1.5503C8.7383 1.74485 8.9275 2.01811 9.01841 2.32917L10.1674 6.09042L13.9399 7.29792C14.2442 7.39998 14.5087 7.59506 14.6961 7.8556C14.8836 8.11614 14.9844 8.42898 14.9844 8.74992C14.9844 9.07087 14.8836 9.3837 14.6961 9.64424C14.5087 9.90478 14.2442 10.0999 13.9399 10.2019L10.1607 11.4109L8.95166 15.1902C8.85657 15.5 8.66373 15.7706 8.40199 15.9616C8.14024 16.1527 7.82368 16.2538 7.49966 16.2499ZM15.3747 5.74992C15.2075 5.74992 15.0451 5.69405 14.9133 5.59118C14.7814 5.48832 14.6878 5.34436 14.6472 5.18217L14.3794 4.10967L13.3047 3.82092C13.1431 3.77752 13.0007 3.68137 12.9001 3.54775C12.7995 3.41412 12.7464 3.25071 12.7494 3.08347C12.7523 2.91623 12.8111 2.75477 12.9163 2.62475C13.0215 2.49474 13.1672 2.40363 13.3302 2.36592L14.3802 2.12217L14.6472 1.06767C14.6878 0.905501 14.7815 0.76156 14.9133 0.658711C15.0451 0.555861 15.2075 0.5 15.3747 0.5C15.5418 0.5 15.7042 0.555861 15.836 0.658711C15.9678 0.76156 16.0615 0.905501 16.1022 1.06767L16.3677 2.13117L17.4312 2.39742C17.5933 2.43807 17.7373 2.53173 17.8401 2.66354C17.943 2.79534 17.9988 2.95774 17.9988 3.12492C17.9988 3.29211 17.943 3.4545 17.8401 3.58631C17.7373 3.71811 17.5933 3.81178 17.4312 3.85242L16.3677 4.11867L16.1022 5.18217C16.0615 5.34436 15.9679 5.48832 15.8361 5.59118C15.7043 5.69405 15.5419 5.74992 15.3747 5.74992Z" fill="url(#paint0_linear_1_19)"/>
                </g>
                <defs>
                  <linearGradient id="paint0_linear_1_19" x1="8.99893" y1="0.5" x2="8.99893" y2="18.4999" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#2192EF"/>
                    <stop offset="1" stop-color="#1AD8BC"/>
                  </linearGradient>
                  <clipPath id="clip0_1_19">
                    <rect width="18" height="18" fill="white" transform="translate(0 0.5)"/>
                  </clipPath>
                </defs>
              </svg> Ai ile Yorumla
        </div>
        <div class="action-btn save-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="19" viewBox="0 0 16 19" fill="none">
                <path d="M13.9177 18.4974C13.6487 18.4966 13.3825 18.4409 13.1344 18.3334C12.8864 18.226 12.6615 18.0689 12.4727 17.8712L7.99999 13.2864L3.52732 17.8742C3.24007 18.1747 2.87168 18.379 2.47018 18.4605C2.06868 18.542 1.65269 18.4968 1.27644 18.3309C0.896454 18.1733 0.571389 17.9012 0.343692 17.5502C0.115994 17.1992 -0.00375214 16.7855 8.96253e-05 16.3632V4.24946C8.96253e-05 3.25504 0.383201 2.30135 1.06514 1.59819C1.74709 0.895031 2.672 0.5 3.63641 0.5L12.3636 0.5C12.8411 0.5 13.314 0.596983 13.7551 0.78541C14.1963 0.973838 14.5972 1.25002 14.9348 1.59819C15.2725 1.94636 15.5404 2.3597 15.7231 2.8146C15.9058 3.26951 15.9999 3.75707 15.9999 4.24946V16.3632C16.004 16.7851 15.8847 17.1986 15.6575 17.5496C15.4303 17.9006 15.1059 18.1728 14.7265 18.3309C14.4703 18.4414 14.1954 18.498 13.9177 18.4974ZM3.63641 1.99978C3.05776 1.99978 2.50282 2.2368 2.09365 2.6587C1.68448 3.08059 1.45462 3.65281 1.45462 4.24946V16.3632C1.45436 16.4882 1.49001 16.6104 1.55709 16.7145C1.62417 16.8185 1.71965 16.8998 1.83148 16.9479C1.94331 16.9961 2.06647 17.009 2.1854 16.985C2.30434 16.961 2.4137 16.9012 2.4997 16.8131L7.49091 11.6981C7.62717 11.5585 7.8115 11.4801 8.00363 11.4801C8.19576 11.4801 8.38009 11.5585 8.51635 11.6981L13.5017 16.8116C13.5877 16.8997 13.6971 16.9595 13.816 16.9835C13.935 17.0075 14.0581 16.9946 14.17 16.9464C14.2818 16.8983 14.3773 16.817 14.4444 16.713C14.5114 16.6089 14.5471 16.4867 14.5468 16.3617V4.24946C14.5468 3.65281 14.317 3.08059 13.9078 2.6587C13.4986 2.2368 12.9437 1.99978 12.365 1.99978H3.63641Z" fill="#0E2C2D"/>
              </svg> Kaydet
        </div>
        <div class="action-btn copy-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="19" viewBox="0 0 18 19" fill="none">
                <g clip-path="url(#clip0_1_6)">
                  <path d="M11.25 15.5H3.75C2.7558 15.4988 1.80267 15.1033 1.09966 14.4003C0.396661 13.6973 0.00119089 12.7442 0 11.75L0 4.25C0.00119089 3.2558 0.396661 2.30267 1.09966 1.59966C1.80267 0.896661 2.7558 0.501191 3.75 0.5L11.25 0.5C12.2442 0.501191 13.1973 0.896661 13.9003 1.59966C14.6033 2.30267 14.9988 3.2558 15 4.25V11.75C14.9988 12.7442 14.6033 13.6973 13.9003 14.4003C13.1973 15.1033 12.2442 15.4988 11.25 15.5ZM3.75 2C3.15326 2 2.58097 2.23705 2.15901 2.65901C1.73705 3.08097 1.5 3.65326 1.5 4.25V11.75C1.5 12.3467 1.73705 12.919 2.15901 13.341C2.58097 13.7629 3.15326 14 3.75 14H11.25C11.8467 14 12.419 13.7629 12.841 13.341C13.2629 12.919 13.5 12.3467 13.5 11.75V4.25C13.5 3.65326 13.2629 3.08097 12.841 2.65901C12.419 2.23705 11.8467 2 11.25 2H3.75ZM18 14.75V5C18 4.80109 17.921 4.61032 17.7803 4.46967C17.6397 4.32902 17.4489 4.25 17.25 4.25C17.0511 4.25 16.8603 4.32902 16.7197 4.46967C16.579 4.61032 16.5 4.80109 16.5 5V14.75C16.5 15.3467 16.2629 15.919 15.841 16.341C15.419 16.7629 14.8467 17 14.25 17H4.5C4.30109 17 4.11032 17.079 3.96967 17.2197C3.82902 17.3603 3.75 17.5511 3.75 17.75C3.75 17.9489 3.82902 18.1397 3.96967 18.2803C4.11032 18.421 4.30109 18.5 4.5 18.5H14.25C15.2442 18.4988 16.1973 18.1033 16.9003 17.4003C17.6033 16.6973 17.9988 15.7442 18 14.75Z" fill="white"/>
                </g>
                <defs>
                  <clipPath id="clip0_1_6">
                    <rect width="18" height="18" fill="white" transform="translate(0 0.5)"/>
                  </clipPath>
                </defs>
              </svg> Kopyala
        </div>
        <div class="action-btn close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">
                <g clip-path="url(#clip0_1_9)">
                  <path d="M20.8838 10.8837L16.7675 15L20.8838 19.1163L19.1163 20.8838L15 16.7675L10.8837 20.8838L9.11625 19.1163L13.2325 15L9.11625 10.8837L10.8837 9.11625L15 13.2325L19.1163 9.11625L20.8838 10.8837ZM30 15C30 23.2712 23.2712 30 15 30C6.72875 30 0 23.2712 0 15C0 6.72875 6.72875 0 15 0C23.2712 0 30 6.72875 30 15ZM27.5 15C27.5 8.1075 21.8925 2.5 15 2.5C8.1075 2.5 2.5 8.1075 2.5 15C2.5 21.8925 8.1075 27.5 15 27.5C21.8925 27.5 27.5 21.8925 27.5 15Z" fill="#D2D2D2"/>
                </g>
                <defs>
                  <clipPath id="clip0_1_9">
                    <rect width="30" height="30" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
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