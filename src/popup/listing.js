// Stil dosyasını import et
import { setupResultEventListeners } from '../content/modules/event-handlers';
import { getResultsTemplate } from '../content/modules/templates';
import { getResultsStyles } from '../content/modules/styles';
import { recalculateResults } from '../content/modules/ui-components';
import './listing.css';
let data = [];
let reportCache = {}; // Rapor verilerini önbelleğe almak için
const apiUrl = process.env.API_URL;
//  const apiUrl = "http://localhost:3000/api";

// console.log("apiUrl",apiUrl);
// Backend'den verileri çek
async function fetchReports() {
    try {
        const response = await fetch(`${apiUrl}/reports`);
        const result = await response.json();
        if (result.success) {
            data = result.data;
            // console.log("data",data);
            createBrandList();
        } else {
            console.error('Raporlar alınırken hata:', result.error);
        }
    } catch (error) {
        console.error('Sunucu bağlantısında hata:', error);
    }
}

async function fetchReport(id) {
    try {
        // Önbellekte varsa oradan al
        if (reportCache[id]) {
            return reportCache[id];
        }
        
        // const response = await fetch(`http://localhost:3000/api/reports/${id}`);
        const response = await fetch(`${apiUrl}/reports/${id}`);
        const result = await response.json();
        // console.log("result",result);
        
        // Önbelleğe ekle
        if (result.success) {
            reportCache[id] = result;
        }
        
        return result;
    } catch (error) {
        console.error('Sunucu bağlantısında hata:', error);
    }
}

// Metrik değişikliği olayını dinle
document.addEventListener('metricChanged', async (event) => {
    const { reportId, metricIndex } = event.detail;
    
    try {
        // Raporu al (önbellekten veya API'den)
        const report = await fetchReport(reportId);
        
        if (report && report.success && report.data.analysis && 
            report.data.analysis.length > metricIndex) {
            
            // Seçilen analiz verilerini kullan
            const selectedData = {
                ...report.data,
                analysis: report.data.analysis[metricIndex],
                resultStatus: report.data.analysis[metricIndex].resultStatus,
                sessionTab: report.data.analysis[metricIndex].control.tabName,
                conversionTab: report.data.analysis[metricIndex].name
            };
            
            // Popup'ı güncelle
            const popup = document.getElementById('ga4-abtest-results');
            const template = getResultsTemplate({...selectedData, _id: reportId}, 'listing');
            
            // Stil bilgisini koru
            const styleTag = popup.querySelector('style');
            popup.innerHTML = `${styleTag.outerHTML}${template}`;
            
            // Event listener'ları yeniden ekle
            setupResultEventListeners(popup, selectedData, 'listing');
        }
    } catch (error) {
        console.error('Metrik değişikliği işlenirken hata:', error);
    }
});

// Rapor durumunu güncelle
async function updateReportStatus(id, newStatus) {
  
    try {
  

        const response = await fetch(`${apiUrl}/reports/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });
        // console.log(response);
        const result = await response.json();
        if (result.success) {
            // Başarılı güncelleme sonrası listeyi yenile
            await fetchReports();
        } else {
            console.error('Durum güncellenirken hata:', result.error);
        }
    } catch (error) {
        console.error('Sunucu bağlantısında hata:', error);
    }
}

function createStatusDropdown(test) {
    const statusOptions = ['Canlı', 'Durduruldu', 'Taslak'];
    const dropdown = document.createElement('div');
    dropdown.className = 'status-dropdown';
    dropdown.innerHTML = `
        <span class="status status-${test.status}">${test.status}</span>
        <div class="dropdown-content">
            ${statusOptions.map(status => `
                <div class="dropdown-item ${status === test.status ? 'selected' : ''}" 
                     data-status="${status}">
                    ${status}
                </div>
            `).join('')}
        </div>
    `;

    // Dropdown olaylarını ekle
    const statusSpan = dropdown.querySelector('.status');
    const dropdownContent = dropdown.querySelector('.dropdown-content');

    statusSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
    });

    // Dropdown item'larına tıklama olayı ekle
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newStatus = item.dataset.status;
            dropdownContent.style.display = 'none';
            
            await updateReportStatus(test.id, newStatus);
        });
    });

    // Dışarı tıklandığında dropdown'ı kapat
    document.addEventListener('click', () => {
        dropdownContent.style.display = 'none';
    });

    return dropdown;
}

function showPopup(test) {
    const popup = document.getElementById('ga4-abtest-results');
    const overlay = document.getElementById('ga4-abtest-overlay');
    
    // Veri yok veya geçersizse işlemi sonlandır
    if (!test || !test.data || !test.data.analysis || !test.data.analysis.length) {
        console.error('Geçersiz rapor verisi:', test);
        return;
    }
    
    // Orijinal veriyi sakla
    const originalData = {...test.data};
    
    // Metrikleri hazırla
    const metrics = originalData.analysis.map(analysis => analysis.name || 'Metrik');
    // console.log('metrics', metrics);
    
    // Varsayılan olarak ilk metriği göster
    let selectedIndex = 0;
    let selectedData = {
        ...originalData,
        analysis: originalData.analysis[selectedIndex],
        resultStatus: originalData.analysis[selectedIndex].resultStatus || 'Etkisiz',
        sessionTab: originalData.analysis[selectedIndex].control?.tabName || 'Sessions',
        conversionTab: originalData.analysis[selectedIndex].name || 'Transactions',
        bussinessImpact: originalData.bussinessImpact || "",
        _id: originalData._id || test.id // ID'yi sakla
    };

    // Template oluştur
    const template = getResultsTemplate(selectedData, 'listing', metrics);
    const style = getResultsStyles();
    popup.innerHTML = `<style>${style}</style>${template}`;
    
    // Event listener'ları ekle
    setupResultEventListeners(popup, selectedData, 'listing');
    
    // Metrik tıklama işlevselliğini ekle
    setTimeout(() => {
        const metricElements = document.querySelectorAll('.listing-metric-name');
        metricElements.forEach((metricEl, index) => {
            // İlk metriği aktif olarak işaretle
            if (index === 0) {
                metricEl.classList.add('active');
            }
            
            metricEl.addEventListener('click', () => {
                // Aktif sınıfını güncelle
                metricElements.forEach(el => {
                    el.classList.remove('active');
                });
                metricEl.classList.add('active');
                
                // Tabloyu güncelle
                updateTable(index, originalData);
            });
        });
    }, 100);
    
    popup.style.display = 'flex';
    overlay.style.display = 'block';
}

// Tabloyu seçilen metriğe göre güncelle
function updateTable(index, originalData) {
    if (!originalData || !originalData.analysis || !originalData.analysis[index]) {
        console.error('Metrik verisi bulunamadı:', index);
        return;
    }
    
    // Seçilen analiz verilerini hazırla
    const selectedData = {
        ...originalData,
        analysis: originalData.analysis[index],
        resultStatus: originalData.analysis[index].resultStatus,
        sessionTab: originalData.analysis[index].control.tabName || 'Sessions',
        conversionTab: originalData.analysis[index].name || 'Transactions',
        bussinessImpact: originalData.bussinessImpact,
        _id: originalData._id
    };
    
    // Tablo başlıklarını güncelle
    const sessionTabInput = document.querySelector('.header-input[value]');
    const conversionTabInput = document.querySelector('.header-input[value]:nth-of-type(2)');
    
    if (sessionTabInput) {
        sessionTabInput.value = selectedData.sessionTab;
    }
    
    if (conversionTabInput) {
        conversionTabInput.value = selectedData.conversionTab;
    }
    
    // Tablo verilerini güncelle
    // Kontrol grubu
    const controlSessions = document.querySelector('[data-type="control-users"]');
    const controlConversions = document.querySelector('[data-type="control-conversions"]');
    
    if (controlSessions && selectedData.analysis.control) {
        controlSessions.value = selectedData.analysis.control.sessions || 0;
    }
    
    if (controlConversions && selectedData.analysis.control) {
        controlConversions.value = selectedData.analysis.control.conversions || 0;
    }
    
    // CR değerini güncelle
    const controlCR = document.querySelector('.control-row td:nth-child(4)');
    
    if (controlCR && selectedData.analysis.control) {
        controlCR.textContent = `${(selectedData.analysis.control.cr || 0).toFixed(2)}%`;
    }
    
    // Kontrol olasılığını güncelle
    const controlSignificance = document.querySelector('.control-row td:last-child');
    
    if (controlSignificance) {
        const controlProb = selectedData.analysis.variants?.[0]?.stats?.controlProbability || 
                           (selectedData.analysis.stats ? selectedData.analysis.stats.controlProbability : 0);
        controlSignificance.textContent = `${controlProb}%`;
    }
    
    // Tablo başlıklarını güncelle
    const sessionTab = document.querySelector('.results-table thead tr th:nth-child(2)');
    const conversionTab = document.querySelector('.results-table thead tr th:nth-child(3)');

    if (sessionTab) {
        sessionTab.innerHTML = selectedData.sessionTab;
    }
    
    if (conversionTab) {
        conversionTab.innerHTML = selectedData.conversionTab;
    }
    
    // Varyant satırlarını güncelle
    let totalUsers = selectedData.analysis.control ? (selectedData.analysis.control.sessions || 0) : 0;
    
    // Helper function to calculate uplift
    const calculateUplift = (variantCR, controlCR) => {
      if (!controlCR || controlCR === 0) return 0;
      return ((variantCR - controlCR) / controlCR) * 100;
    };
    
    // Birden fazla varyant varsa (yeni format)
    if (selectedData.analysis.variants && Array.isArray(selectedData.analysis.variants)) {
        // Varyant satırlarını bul veya oluştur
        const tbody = document.querySelector('.results-table tbody');
        
        // Mevcut varyant satırlarını temizle (kontrol satırı hariç)
        const existingVariantRows = tbody.querySelectorAll('.variant-row');
        existingVariantRows.forEach(row => row.remove());
        
        // Her varyant için satır ekle
        selectedData.analysis.variants.forEach((variant, idx) => {
            if (!variant) return; // Skip null variants
            
            totalUsers += variant.sessions || 0;
            
            // Calculate uplift if not already present
            const variantCR = variant.cr || 0;
            const controlCR = selectedData.analysis.control.cr || 0;
            const uplift = variant.improvement !== undefined && variant.improvement !== null 
                ? variant.improvement 
                : calculateUplift(variantCR, controlCR);
            
            const variantRow = document.createElement('tr');
            variantRow.className = 'variant-row';
            variantRow.dataset.variantIndex = idx;
            
            variantRow.innerHTML = `
                <td>${variant.name || `Varyasyon ${idx + 1}`}</td>
                <td><input type="number" class="table-input" value="${variant.sessions || 0}" data-type="variant-users-${idx}" /></td>
                <td><input type="number" class="table-input" value="${variant.conversions || 0}" data-type="variant-conversions-${idx}" /></td>
                <td>${variantCR.toFixed(2)}%</td>
                <td class="metric-change ${uplift >= 0 ? 'positive' : 'negative'}">${uplift.toFixed(2)}%</td>
                <td>${variant.stats ? variant.stats.variantProbability || 0 : 0}%</td>
            `;
            
            tbody.appendChild(variantRow);
        });
    } else if (selectedData.analysis.variant) {
        // Tek varyant (eski format)
        totalUsers += selectedData.analysis.variant.sessions || 0;
        
        const variantSessions = document.querySelector('[data-type="variant-users"]');
        const variantConversions = document.querySelector('[data-type="variant-conversions"]');
        
        if (variantSessions) {
            variantSessions.value = selectedData.analysis.variant.sessions || 0;
        }
        
        if (variantConversions) {
            variantConversions.value = selectedData.analysis.variant.conversions || 0;
        }
        
        const variantCR = document.querySelector('.variant-row td:nth-child(4)');
        
        if (variantCR) {
            variantCR.textContent = `${(selectedData.analysis.variant.cr || 0).toFixed(2)}%`;
        }
        
        // Calculate uplift if not already present
        const uplift = selectedData.analysis.improvement !== undefined && selectedData.analysis.improvement !== null 
            ? selectedData.analysis.improvement 
            : calculateUplift(selectedData.analysis.variant.cr || 0, selectedData.analysis.control.cr || 0);
        
        const upliftCell = document.querySelector('.variant-row td:nth-child(5)');
        if (upliftCell) {
            upliftCell.textContent = `${uplift.toFixed(2)}%`;
            upliftCell.className = uplift >= 0 ? 'metric-change positive' : 'metric-change negative';
        }
        
        const variantSignificance = document.querySelector('.variant-row td:last-child');
        
        if (variantSignificance && selectedData.analysis.stats) {
            variantSignificance.textContent = `${selectedData.analysis.stats.variantProbability || 0}%`;
        }
    }
    
    // Toplam kullanıcı sayısını güncelle
    const usersText = document.querySelector('.users-text');
    if (usersText) {
        usersText.textContent = totalUsers.toLocaleString();
    }
    
    // Sonuç durumunu güncelle
    const resultElement = document.querySelector('.conclusion-result');
    const resultDescElement = document.querySelector('.conclusion-result-desc');
    
    if (resultElement && resultDescElement) {
        // Eski sınıfları kaldır
        resultElement.classList.remove('kazandı', 'kaybetti', 'etkisiz');
        // Yeni sınıfı ekle
        resultElement.classList.add(selectedData.resultStatus.toLowerCase());
        // Sonuç metnini güncelle
        resultDescElement.textContent = selectedData.resultStatus;
    }
    
    // Veri değişikliklerini dinle
    const tableInputs = document.querySelectorAll('.table-input');
    tableInputs.forEach(input => {
        input.addEventListener('change', () => {
            recalculateResults(document.querySelector('.abtest-popup'), selectedData);
        });
    });
}

// Close popup when clicking outside
document.getElementById('ga4-abtest-overlay').addEventListener('click', function() {
    document.getElementById('ga4-abtest-results').style.display = 'none';
    this.style.display = 'none';
});



function hidePopup() {
    const popup = document.getElementById('ga4-abtest-results');
    popup.style.display = 'none';
}

function createBrandList() {
    const brandListContainer = document.getElementById('brandList');
    brandListContainer.innerHTML = ''; // Clear existing content
    
    data.forEach(brand => {
        const brandContainer = document.createElement('div');
        brandContainer.className = 'brand-container';
        
        // Create brand header
        const brandHeader = document.createElement('div');
        brandHeader.className = 'brand-header';
        
        // Brand name
        const brandName = document.createElement('div');
        brandName.className = 'brand-name';
        brandName.textContent = brand.name;
        
        // Stats
        const stats = document.createElement('div');
        stats.className = 'stats';
        
        const statItems = [
            { label: 'Taslak:', value: brand.stats.taslak, class: 'taslak' },
            { label: 'Durduruldu:', value: brand.stats.durduruldu, class: 'durduruldu' },
            { label: 'Canlı:', value: brand.stats.canli, class: 'canli' },
            { label: 'Toplam:', value: brand.stats.toplam, class: 'toplam' }
        ];
        
        statItems.forEach(item => {
            const statItem = document.createElement('div');
            statItem.className = `stat-item ${item.class}`;
            statItem.innerHTML = `${item.label} <strong>${item.value}</strong>`;
            stats.appendChild(statItem);
        });
        
        brandHeader.appendChild(brandName);
        brandHeader.appendChild(stats);
        brandContainer.appendChild(brandHeader);
        
        // Create test items container
        const testItemsContainer = document.createElement('div');
        testItemsContainer.className = 'test-items-container';
        
        // Create and append all test items
        brand.tests.forEach((test, index) => {
            const testItem = document.createElement('div');
            testItem.className = 'test-item';
            if (index >= 3) {
                testItem.style.display = 'none';
            }
            
            const testName = document.createElement('div');
            testName.textContent = test.name;
            testName.className = 'test-name';
            
            const testActions = document.createElement('div');
            testActions.style.display = 'flex';
            testActions.style.gap = '15px';
            testActions.style.alignItems = 'center';
            
            // Status dropdown'ı ekle
            const statusDropdown = createStatusDropdown(test);
            
            const button = document.createElement('button');
            button.className = 'button';
            button.textContent = 'İncele';
            button.onclick = async () => {
                const report = await fetchReport(test.id);
                showPopup(report);
            };
            
            testActions.appendChild(statusDropdown);
            testActions.appendChild(button);
            
            testItem.appendChild(testName);
            testItem.appendChild(testActions);
            
            testItemsContainer.appendChild(testItem);
        });
        
        brandContainer.appendChild(testItemsContainer);
        
        // Add "Show More" button if there are more than 3 tests
        if (brand.tests.length > 3) {
            const showMoreButton = document.createElement('button');
            showMoreButton.className = 'show-more-button';
            showMoreButton.textContent = 'Daha Fazla Göster';
            
            let expanded = false;
            showMoreButton.onclick = () => {
                const testItems = testItemsContainer.querySelectorAll('.test-item');
                testItems.forEach((item, index) => {
                    if (index >= 3) {
                        item.style.display = expanded ? 'none' : 'flex';
                    }
                });
                showMoreButton.textContent = expanded ? 'Daha Fazla Göster' : 'Daha Az Göster';
                expanded = !expanded;
            };
            
            brandContainer.appendChild(showMoreButton);
        }
        
        brandListContainer.appendChild(brandContainer);
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // İlk yüklemede verileri çek
    fetchReports();
    
    // Add event listeners for popup actions
    const popup = document.getElementById('ga4-abtest-results');
    // const closeBtn = document.querySelector('.close-btn');
    
    
    // Close popup when clicking outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            hidePopup();
        }
    });


});