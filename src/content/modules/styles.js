/**
 * CSS stilleri
 */

/**
 * Sonuç popup'ı için CSS stilleri
 * @returns {string} CSS içeriği
 */
export function getResultsStyles() {
  return `
         .ga4-abtest-main-container {
          display: inline-flex;
          align-items: center;
          margin-left: 16px;
          gap: 0;
              display: inline-flex;
    float: right;
    margin-right: 36px;
      }
       .ga4-abtest-buttons-container {
           display: flex;
    gap: 10px;
    margin: 6px;
       }   
      
      .ga4-abtest-close-button {
          display: inline-flex;
          align-items: center;
          margin-left: 16px;
      }
      
      .ga4-abtest-button.close-btn {
          background: #ffffff;
          border: 1px solid #e8eaed;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .ga4-abtest-button.close-btn:hover {
          background: #f8f9fa;
          border-color: #dadce0;
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .ga4-abtest-button.close-btn svg {
          color: #5f6368;
          transition: color 0.3s ease;
      }
      
      .ga4-abtest-button.close-btn:hover svg {
          color: #202124;
      }
      
      .ga4-abtest-analyze-button {
          display: inline-flex;
          align-items: center;
      }
      
      .ga4-abtest-expandable-buttons {
          display: inline-flex;
          gap: 12px;
          align-items: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          max-height: 60px;
      }
      
      .ga4-abtest-expandable-buttons.collapsed {
          width: 0;
          opacity: 0;
          margin-left: 0;
          gap: 0;
          max-height: 0;
      }
      
      .ga4-abtest-expandable-buttons.expanded {
          width: auto;
          opacity: 1;
          margin-left: 12px;
          animation: slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      @keyframes slideInFromRight {
          0% {
              width: 0;
              opacity: 0;
              margin-left: 0;
              transform: translateX(20px);
          }
          50% {
              opacity: 0.5;
          }
          100% {
              width: auto;
              opacity: 1;
              margin-left: 12px;
              transform: translateX(0);
          }
      }
      .ga4-abtest-button {
            position: relative;
            border: none;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease, transform 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            border-radius: 30px;
            background: #1BAF6D;
            width: auto;
            height: 45px;
            font-size: 14px;
            padding: 8px 15px 8px 15px;
            line-height: normal;
            color: #FFF;
      }
      
      /* Specific button widths */
      .ga4-abtest-button.session {
            width: 138px;
      }
      
      .ga4-abtest-button.conversion {
            width: 143px;
      }
      
      .ga4-abtest-button.topla {
            width: 109px;
      }
      
      .ga4-abtest-button.temizle {
            width: 116px;
      }
      
      .ga4-abtest-button.analyze,
      .ga4-abtest-button.analyze-direct {
            width: 110px;
            justify-content: center;
      }
      
      .ga4-abtest-button.analyze-toggle svg {
          transition: transform 0.3s ease;
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
            border-radius: 30px;
            border: 1px solid #DDD;
            background: #FFF;
            padding: 6px;
            color: #0E2C2D;
      }
      .ga4-abtest-button.conversion {
          border-radius: 30px;
            border: 1px solid #DDD;
            background: #FFF;
            padding: 6px;
            color: #0E2C2D;
      }
      .ga4-abtest-button.analyze,
      .ga4-abtest-button.analyze-direct {
          background: linear-gradient(135deg, #ea4335, #d62516);
      }
      .ga4-abtest-button.topla {
          border-radius: 30px;
            border: 1px solid #DDD;
            background: #FFF;
            padding: 6px;
            color: #0E2C2D;
      }
      .ga4-abtest-button.temizle {
          border-radius: 30px;
            border: 1px solid #DDD;
            background: #FFF;
            padding: 6px;
            color: #0E2C2D;
      }
      .ga4-abtest-button.analyze-main {
          flex-direction: row;
          gap: 10px;
          justify-content: center;
          align-items: center;
          width: 168px;
          height: 45px;
      }
      
      .ga4-abtest-button.analyze-main img {
          transition: transform 0.3s ease;
          width: 24px;
          height: 24px;
      }
      .ga4-abtest-button.disabled {
          background: linear-gradient(135deg, #9aa0a6, #80868b);
          cursor: not-allowed;
          opacity: 0.8;
      }
      /* Button content layout: icon + text horizontal */
      .button-content {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
      }
      
      /* Button icon (left side) */
      .button-icon {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
      }
      
      /* Button text container (right side) */
      .button-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
          min-width: 0; /* Allow text to shrink */
      }
      
      /* Button title (main text) */
      .button-title {
          font-size: 14px;
          font-weight: 600;
          color: inherit;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: left;
      }
      
      /* Button subtitle (tab name, smaller text below title) */
      .button-subtitle {
          font-size: 11px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          margin-top: 1px;
          text-align: left;
      }
      
      /* White buttons have different subtitle color */
      .ga4-abtest-button.session .button-subtitle,
      .ga4-abtest-button.conversion .button-subtitle,
      .ga4-abtest-button.topla .button-subtitle,
      .ga4-abtest-button.temizle .button-subtitle {
          color: rgba(14, 44, 45, 0.6);
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
            cursor: pointer;
    position: relative;
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
             background-color: rgba(14, 13, 13, 0.1);
        }

        /* AI button specific styles */
        .ai-btn {
    display: inline-flex;
    padding: 12px 24px;
    justify-content: center;
    align-items: center;
    gap: 8px;

    border-radius: 24px;
    border: 1px solid #2192EF;
    color: #0E2C2D;
    font-family: sans-serif;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
        }

        .ai-btn:hover:not(:disabled) {
            background: #2192EF;
            color: #fff;
        }

        .ai-btn svg {
            color: #0E2C2D;
        }

        /* AI button loading state */
            .ai-btn.copy-loading-active {
                background: #2192EF;
                color: #fff;
        }

        .ai-btn .copy-loading .dot {
             background-color: #fff;
        }

        /* CSV button specific styles */
        .csv-btn {
            display: inline-flex;
padding: 12px 24px;
justify-content: center;
align-items: center;
gap: 8px;
border-radius: 24px;
border: 1px solid #E8E8E8;
color: #0E2C2D;
font-family: sans-serif;
font-size: 16px;
font-style: normal;
font-weight: 700;
line-height: normal;
        }

        .csv-btn:hover:not(:disabled) {
            background: #0E2C2D;
            color: #fff;
        }
        .csv-btn:hover:not(:disabled) svg {
            stroke: #fff;
        }
        .csv-btn svg {
            color: #0E2C2D;
        }

        /* Save button specific styles */
        .save-btn {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    padding: 12px 24px;
    justify-content: center;
    align-items: center;
    gap: 8px;
    border-radius: 24px;
    border: 1px solid #E8E8E8;
    background: #FFF;
    color: #0E2C2D;
    font-family: sans-serif;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
        }

        .save-btn:hover:not(:disabled) {
            background: #0E2C2D;
            color: #fff;
        }
        .save-btn:hover:not(:disabled) svg {
            stroke: #fff;
        }

        .save-btn svg {
            color: #0E2C2D;
        }

        /* Copy button specific styles */
        .copy-btn {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    padding: 12px 24px;
    justify-content: center;
    align-items: center;
    gap: 8px;
    border-radius: 24px;
    background: #1AAF6B;
    color: #FFF;
    font-family: sans-serif;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
    border: 1px solid #1AAF6B;
        }

        .copy-btn:hover:not(:disabled) {
            background: #fff;
            color: #1AAF6B;
            border: 1px solid #1AAF6B;
        }
        .copy-btn:hover:not(:disabled) svg {
        stroke: #1AAF6B;
        }

        .copy-btn svg {
            color: #ffffff;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
        }

        /* Close button specific styles */


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
    min-height: 100px;
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
    min-height: 100px;
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
        
        .ga4-tooltip {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: pre-line;
            visibility: hidden;
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 1000;
            margin-bottom: 5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            pointer-events: none;
            min-width: 180px;
            text-align: center;
            line-height: 1.4;
        }
        
        .ga4-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
  `;
 
} 