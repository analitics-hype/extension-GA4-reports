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
 * Parse a date string in either Turkish ("22 Mar 2026", "1 Oca 2026")
 * or English GA4 ("Mar 22, 2026", "Mar 22") format.
 * @param {string} dateStr - Date string to parse
 * @returns {Date}
 */
export function parseTurkishDate(dateStr) {
  const trToEn = {
    'Oca': 'Jan', 'Şub': 'Feb', 'Mar': 'Mar', 'Nis': 'Apr',
    'May': 'May', 'Haz': 'Jun', 'Tem': 'Jul', 'Ağu': 'Aug',
    'Eyl': 'Sep', 'Eki': 'Oct', 'Kas': 'Nov', 'Ara': 'Dec'
  };

  // English month names (GA4 topla format: "Mar 22" or "Mar 22, 2026")
  const enMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const str = dateStr.trim().replace(',', '');
  const parts = str.split(' ');

  if (parts.length >= 2) {
    const firstToken = parts[0];
    const isEnglishMonth = enMonths.includes(firstToken);

    if (isEnglishMonth) {
      // EN format: "Mar 22 2026" or "Mar 22"
      const month = firstToken;
      const day = parseInt(parts[1]);
      const year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
      return new Date(`${month} ${day}, ${year}`);
    } else {
      // TR format: "22 Mar 2026" or "22 Oca 2026"
      const day = parts[0];
      const month = trToEn[parts[1]] || parts[1];
      const year = parts[2] || new Date().getFullYear();
      return new Date(`${month} ${day}, ${year}`);
    }
  }

  return new Date(dateStr);
} 