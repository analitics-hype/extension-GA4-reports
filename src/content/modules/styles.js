/**
 * CSS stilleri
 */

/**
 * Sonuç popup'ı için CSS stilleri
 * @returns {string} CSS içeriği
 */
export function getResultsStyles() {
  return `
   .ga4-abtest-buttons {
          display: inline-flex;
          gap: 12px;
          margin-left: 16px;
          align-items: center;
      }
      .ga4-abtest-button {
          position: relative;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 120px;
      }
      .ga4-abtest-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0));
          opacity: 0;
          transition: opacity 0.3s ease;
      }
      .ga4-abtest-button:hover::before {
          opacity: 1;
      }
      .ga4-abtest-button:active {
          transform: translateY(1px);
      }
      .ga4-abtest-button.session {
          background: linear-gradient(135deg, #4285f4, #2b6cd4);
      }
      .ga4-abtest-button.conversion {
          background: linear-gradient(135deg, #34a853, #2d8f47);
      }
      .ga4-abtest-button.analyze,
      .ga4-abtest-button.analyze-direct {
          background: linear-gradient(135deg, #ea4335, #d62516);
      }
      .ga4-abtest-button.disabled {
          background: linear-gradient(135deg, #9aa0a6, #80868b);
          cursor: not-allowed;
          opacity: 0.8;
      }
      .button-label {
          font-size: 11px;
          margin-top: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
          text-align: center;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
          letter-spacing: 0.2px;
      }
    
      @keyframes slideIn {
          from {
              opacity: 0;
              transform: translate(-50%, -48%);
          }
          to {
              opacity: 1;
              transform: translate(-50%, -50%);
          }
      }
      #ga4-abtest-results .card {
          background: #ffffff;
          border: 1px solid #e8eaed;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0,0,0,0.02);
      }
      #ga4-abtest-results .card:hover {
          box-shadow: 0 6px 12px rgba(0,0,0,0.05);
          transform: translateY(-1px);
      }
      #ga4-abtest-results .card-title {
          color: #202124;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          letter-spacing: 0.3px;
      }
      #ga4-abtest-results .test-info {
          font-size: 14px;
          line-height: 1.6;
          color: #5f6368;
          margin-bottom: 12px;
      }
      #ga4-abtest-results .test-info strong {
          color: #202124;
          font-weight: 600;
      }
      #ga4-abtest-results .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 24px 0;
      }
      #ga4-abtest-results .metric-card {
          background: #f8f9fa;
          border: 1px solid #e8eaed;
          border-radius: 8px;
          padding: 20px;
          transition: all 0.3s ease;
      }
      #ga4-abtest-results .metric-card:hover {
          background: #ffffff;
          box-shadow: 0 6px 12px rgba(0,0,0,0.05);
          transform: translateY(-2px);
      }
      #ga4-abtest-results .metric-title {
          font-size: 13px;
          color: #5f6368;
          margin-bottom: 8px;
          font-weight: 500;
          letter-spacing: 0.3px;
      }
      #ga4-abtest-results .metric-value {
          font-size: 32px;
          font-weight: 600;
          color: #202124;
          margin-bottom: 16px;
          letter-spacing: -0.5px;
      }
      #ga4-abtest-results .metric-change {
          font-size: 16px;
          font-weight: 600;
          margin: 24px 0;
          text-align: center;
          padding: 16px;
          transition: all 0.3s ease;
      }
      #ga4-abtest-results .metric-change.positive {
          color: #34a853;
      }
      #ga4-abtest-results .metric-change.negative {
          color: #ea4335;
      }
      #ga4-abtest-results .confidence {
          font-size: 14px;
          color: #5f6368;
          margin-top: 16px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          text-align: center;
          font-weight: 500;
          letter-spacing: 0.2px;
          border: 1px solid #e8eaed;
      }

      #ga4-abtest-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          display: none;
          animation: fadeIn 0.3s ease;
          background: rgba(0, 0, 0, 0.70);
          backdrop-filter: blur(5px);
      }
      #ga4-abtest-content {
          display: flex;
      }
      @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
      }
      .ga4-notification {
          position: fixed;
          top: 116px;
          right: 16px;
          padding: 16px 24px;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-size: 14px;
          line-height: 1.5;
          z-index: 10001;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(150%);
          font-weight: 500;
          letter-spacing: 0.2px;
          min-width: 300px;
      }
      .ga4-notification.show {
          transform: translateX(0);
      }
      .ga4-notification.success {
          border-left: 4px solid #34a853;
          color: #0d652d;
          background: #e6f4ea;
      }
      .ga4-notification.error {
          border-left: 4px solid #ea4335;
          color: #b31412;
          background: #fce8e6;
      }
      .ga4-notification.info {
          border-left: 4px solid #4285f4;
          color: #174ea6;
          background: #e8f0fe;
      }
    #ga4-abtest-results {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      width: 1600px;
      max-width: 98vw;
      max-height: 95vh;
      overflow-y: auto;
      z-index: 10000;
      display: none;
      animation: slideIn 0.3s ease;
    }
.end-date-container {
            position: relative;
        }

        .end-date-select, .end-date-input {
            width: 100%;
            padding: 6px 8px;
            border:none;
            border-radius: 6px;
            font-size: 18px;
            color: #111827;
            background: transparent;
            cursor: pointer;
            text-align: center;
        }

        .end-date-select {
            appearance: none;
        }

        .end-date-select:hover, .end-date-input:hover {
            background: rgba(0, 0, 0, 0.02);
        }

        .end-date-select:focus, .end-date-input:focus {
            outline: none;
            border-color: #3B82F6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .select-arrow {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
        }
        .abtest-popup {
            padding: 30px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }

        .popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        }

        .popup-header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            line-height: 1.2;
        }

        .action-buttons {
            display: flex;
            gap: 12px;
            align-items: center;
        }

     .action-btn {
        cursor:pointer;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
        transition: all 0.2s ease;
     }

     .action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
     }
      
        .action-btn svg {
            color: currentColor;
        }

        .action-btn:hover:not(:disabled) {
            opacity: 0.9;
        }

        .copy-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding: 2px;
        }

        .loading-dots {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
        }

        .loading-dots .dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background-color: currentColor;
            animation: loadingDots 1.4s ease-in-out infinite both;
        }

        .loading-dots .dot:nth-child(1) {
            animation-delay: -0.32s;
        }

        .loading-dots .dot:nth-child(2) {
            animation-delay: -0.16s;
        }

        .loading-dots .dot:nth-child(3) {
            animation-delay: 0s;
        }

        @keyframes loadingDots {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1);
                opacity: 1;
            }
        }

        .action-btn.copy-loading-active {
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            transition: all 0.2s ease;
        }

    

        .save-btn .copy-loading .dot {
            background-color: #ffffff;
        }

        /* AI button specific styles */
        .ai-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            position: relative;
            overflow: hidden;
        }

        .ai-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
            transform: translateY(-1px);
        }

        .ai-btn svg {
            color: #ffffff;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
        }

        /* AI button loading state */
        .ai-btn.copy-loading-active {
            background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
            opacity: 0.8;
        }

        .ai-btn .copy-loading .dot {
            background-color: #ffffff;
        }

        /* AI button pulse effect */
        .ai-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }

        .ai-btn:hover::before {
            left: 100%;
        }


        .details-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            background: #F9FAFB;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #dbdbdb;
            table-layout: fixed;
            text-align: center;
            
        }

        .details-table th {
            text-align: center;
            padding: 18px 16px;
            font-size: 18px;
            font-weight: 600;
            color: #000;
            background: #e8e9e9;
            border: 1px solid #dbdbdb;
        }

        .details-table td {
            padding: 18px 16px;
            font-size: 18px;
            color: #111827;
            background: #FFFFFF;
            border: 1px solid #dbdbdb;
        }

        .details-table  tr:first-child td:first-child, .results-table   tr:first-child th:first-child {
            border-top-left-radius: 7px;
        }
        .details-table  tr:first-child td:last-child, .results-table  tr:first-child th:last-child {
            border-top-right-radius: 7px;
        }
        .details-table  tr:last-child td:first-child, .results-table  tr:last-child td:first-child {
            border-bottom-left-radius: 7px;
        }
        .details-table  tr:last-child td:last-child, .results-table  tr:last-child td:last-child {
            border-bottom-right-radius: 7px;
        }
        

        .detail-input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            font-size: 16px !important;
            color: #111827;
            text-align: center;
        }

   

        .results-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            background: #F9FAFB;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #dbdbdb;
            table-layout: fixed;
            text-align: center;
            min-width: 1200px; /* Ensure table is wide enough for all columns */
        }

        .results-table th {
            text-align: center;
            padding: 18px 16px;
            font-size: 18px;
            font-weight: 600;
            color: #000;
            background: #e8e9e9;
            border: 1px solid #dbdbdb;
        }

        .results-table td {
            padding: 18px 16px;
            font-size: 18px;
            color: #111827;
            border: 1px solid #dbdbdb;
            background: #FFFFFF;
        }

        /* Column width adjustments for new Monthly/Yearly columns */
        .results-table th:nth-child(1),
        .results-table td:nth-child(1) {
            width: 15%; /* Variant name */
        }

        .results-table th:nth-child(2),
        .results-table td:nth-child(2) {
            width: 12%; /* Users/Sessions */
        }

        .results-table th:nth-child(3),
        .results-table td:nth-child(3) {
            width: 12%; /* Conversions */
        }

        .results-table th:nth-child(4),
        .results-table td:nth-child(4) {
            width: 12%; /* Conv. Rate */
        }

        .results-table th:nth-child(5),
        .results-table td:nth-child(5) {
            width: 10%; /* Uplift */
        }

        .results-table th:nth-child(6),
        .results-table td:nth-child(6) {
            width: 10%; /* Signif. */
        }

        .results-table th:nth-child(7),
        .results-table td:nth-child(7) {
            width: 14%; /* Monthly */
        }

        .results-table th:nth-child(8),
        .results-table td:nth-child(8) {
            width: 15%; /* Yearly */
        }

      
        .table-input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            font-size: 18px !important;
            color: #111827;
            text-align: center;
        }

        .table-input:focus {
            outline: none;
            border-color: #3B82F6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .positive {
            color: #059669;
            font-weight: 500;
        }

        .negative {
            color: #DC2626;
            font-weight: 500;
        }

        .test-conclusion {
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            border: 2px solid #dbdbdb;
            width: 100%;
            }
        .test-details ,.test-conclusion, .test-results {
            width: 100%;
            filter: drop-shadow(0px 0px 15px rgba(0, 0, 0, 0.10));
        }

        .conclusion-header {
            flex: 1;
            background: #E8E9E9;
            color: #000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .conclusion-header label {
            font-size: 18px;
            color: #000;
            font-weight: 600;
        }

        .conclusion-content {
           flex: 4;
    border-left: 2px  solid #dbdbdb;
    border-right: 2px  solid #dbdbdb;
    display: flex;
    align-items: center;
    justify-content: center;
        }

        #conclusion-input.conclusion-input {
              width: 100%;
    padding: 0;
    background: transparent;
    border: none;
    font-size: 16px !important;
    color: #111827;
    resize: none;
    min-height: 150px;
    max-height: 134px;
    font-family: inherit;
    margin: 18px;
        }
        #conclusion-input-copy {
            display: none;
            font-size: 16px !important;
            color: #111827;
            font-family: inherit;
            resize: none;
            min-height: 100px;
            font-family: inherit;
            text-align:left;
                          width: 100%;
    padding: 0;
    background: transparent;
    border: none;
    font-size: 16px !important;
    color: #111827;
    resize: none;
    min-height: 150px;
    max-height: 134px;
    font-family: inherit;
    margin: 18px;
            
        }
        #conclusion-input.conclusion-input:focus {
            outline: none;
            background: rgba(59, 130, 246, 0.05);
            border-radius: 4px;
        }

        #conclusion-input.conclusion-input:hover {
            background: rgba(0, 0, 0, 0.02);
            border-radius: 4px;
        }

        .conclusion-footer {
            flex: 1;
        }

        .conclusion-result {
            font-size: 18px !important;
        }

        .conclusion-result-title {
            color: #000;
            font-weight: 700;
            height: 40px;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #e8e9e9;
        }

        .conclusion-result-desc {
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 94px;
        }

        .conclusion-result.etkisiz .conclusion-result-desc {
            color: #95A5A6;
        }

        .conclusion-result.kazandı .conclusion-result-desc {
            color: #2ECC71;
        }
        
        .conclusion-result.kaybetti .conclusion-result-desc {
            color: #E74C3C;
        }
        
        


        .header-input {
            background: transparent;
            border: none;
            font-size: 16px !important;
            font-weight: 600;
            color: #000;
            width: 100%;
            padding: 0;
            cursor: text;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .header-input:focus {
            outline: none;
            background: rgba(59, 130, 246, 0.05);
            border-radius: 4px;
        }

        .header-input:hover {
            background: rgba(0, 0, 0, 0.02);
            border-radius: 4px;
        }

        .detail-input {
            width: 100%;
            background: transparent;
            border: none;
            padding: 0;
            font-size: 16px !important;
            color: #111827;
            cursor: text;
            text-align: center;
        }

        .detail-input:focus {
            outline: none;
            background: rgba(59, 130, 246, 0.05);
            border-radius: 4px;
            padding: 2px 4px;
            margin: -2px -4px;
        }

        .detail-input:hover {
            background: rgba(0, 0, 0, 0.02);
            border-radius: 4px;
            padding: 2px 4px;
            margin: -2px -4px;
        }

        .table-input {
            width: 100%;
            background: transparent;
            border: none;
            padding: 0;
            font-size: 16px !important;
            color: #111827;
            text-align: center;
            cursor: text;
        }

        .table-input:focus {
            outline: none;
            background: rgba(59, 130, 246, 0.05);
            border-radius: 4px;
            padding: 2px 4px;
            margin: -2px -4px;
        }

        .table-input:hover {
            background: rgba(0, 0, 0, 0.02);
            border-radius: 4px;
            padding: 2px 4px;
            margin: -2px -4px;
        }
        .listing-metrics {
            min-width: 200px;
            border-radius: 10px;
            background: #FFF;
            box-shadow: 0px 0px 15px 0px rgba(0, 0, 0, 0.10);
            margin: 105px 0 30px 30px;
            padding-bottom: 15px;
        }
        .listing-metric-title {
            color: #000;
            font-size: 20px;
            font-style: normal;
            font-weight: 700;
            line-height: normal;
            margin: 16px 0 0 16px;
            padding-bottom: 10px;
        }
        .listing-metrics-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 16px 20px 0 20px;
            gap: 8px;
        }
        .listing-metric-name {
            width: 100%;
            height: 50px;
            border-radius: 4px;
            background: #F3EBFF;
            display: flex;
            align-items: center;
            padding-left: 10px;
            color: #000;
            font-size: 16px;
            font-style: normal;
            font-weight: 700;
            line-height: normal;
            cursor: pointer;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
        }
        
        .listing-metric-name:hover {
            background: #E8DFFF;
            transform: translateX(2px);
        }
        
        .listing-metric-name.active {
            background: #E8DFFF;
            border-left: 3px solid #6200EE;
            color: #6200EE;
        }
  `;
 
} 