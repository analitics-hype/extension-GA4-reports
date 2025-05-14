/**
 * Tarihi Türkçe formata çevirir
 * @param {Date} date - Formatlanacak tarih
 * @returns {string} Türkçe formatlanmış tarih
 */
export function formatDateTurkish(date) {
  const months = {
    'Jan': 'Ocak',
    'Feb': 'Şubat',
    'Mar': 'Mart',
    'Apr': 'Nisan',
    'May': 'Mayıs',
    'Jun': 'Haziran',
    'Jul': 'Temmuz',
    'Aug': 'Ağustos',
    'Sep': 'Eylül',
    'Oct': 'Ekim',
    'Nov': 'Kasım',
    'Dec': 'Aralık'
  };
  
  const day = date.getDate();
  const month = months[date.toLocaleString('en', { month: 'short' })];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

/**
 * Türkçe tarih formatını parse eder
 * @param {string} dateStr - Parse edilecek tarih string'i
 * @returns {Date} Parse edilmiş tarih
 */
export function parseTurkishDate(dateStr) {
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

  // "1 Oca 2024" formatındaki tarihi parse et
  const parts = dateStr.trim().split(' ');
  const day = parts[0];
  const month = monthMap[parts[1]] || parts[1];
  const year = parts[2] || new Date().getFullYear(); // Yıl yoksa mevcut yılı kullan
  
  return new Date(`${month} ${day}, ${year}`);
} 