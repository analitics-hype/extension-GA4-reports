# HypeCro — GA4 AB Test Chrome Extension

**Manifest v3** · **v1.8** — GA4 segment karşılaştırma raporlarından A/B test verisi çeker, istatistiksel analiz yapar ve HypeCro backend’e kaydeder.

Monorepo kökü: [../README.md](../README.md) · Geliştirme planı: [../TODO.md](../TODO.md)

---

## Özellikler

- GA4 rapor sayfalarında otomatik UI enjeksiyonu
- **Session Al** / **Dönüşüm Al** / **Analiz Et** / **Analiz & Kaydet**
- Selector fallback zinciri (`ga4-selectors.js`) — DOM değişikliklerine dayanıklılık
- Popup: JWT giriş, güvenilirlik eşiği, son 5 kayıt, dashboard deep link
- **Snapshot hatırlatıcısı** — 7+ gün güncellenmeyen canlı testler (API)
- Marka seçici (prefix tanınmazsa API’den liste)
- AI yorum paneli: şablon, ek prompt, önizleme
- GA dışı sayfalarda bilgilendirici popup (`disabled.html` akışı)
- VWO/GTM sayfalarında A/B varyasyon aracı (cookie tabanlı)
- `listing.html` kaldırıldı — tüm listeleme React dashboard’da

---

## Kurulum

### Gereksinimler
- Node.js 18+
- Google Chrome
- Çalışan backend (`localhost:3000`) ve isteğe bağlı frontend (`3001`)

```bash
cd extension-GA4-reports
npm install
npm run dev          # watch build → dist/
```

Chrome: `chrome://extensions` → **Geliştirici modu** → **Paketlenmemiş öğe yükle** → `dist/` klasörü

---

## Ortam ve build

| Komut | Ortam | API | Dashboard |
|-------|--------|-----|-----------|
| `npm run dev` | development (watch) | `http://localhost:3000/api` | `http://localhost:3001` |
| `npm run build:dev` | development (tek build) | aynı | aynı |
| `npm run build` | production | Railway API | abtestcalculator.com.tr |

Dosyalar:

- `.env.development` — local URL’ler
- `.env.production` — canlı URL’ler
- `.env.local` — kişisel override (gitignore, isteğe bağlı)

Örnek: [.env.example](./.env.example)

Build log örneği:

```
[extension] development → API=http://localhost:3000/api | Dashboard=http://localhost:3001
```

---

## Kullanım

1. Extension popup’tan veya dashboard’dan **giriş yapın** (JWT `chrome.storage`)
2. GA4’te **segment karşılaştırma** raporunu açın
3. **Session Al** → **Dönüşüm Al** (veya tek tık **Analiz & Kaydet**)
4. Gerekirse marka seçin → rapor backend’e kaydedilir
5. Popup’tan **Dashboard’da Gör** veya son kayıtlara tıklayın

---

## Test

DOM extraction regression testleri (jsdom + fixture HTML):

```bash
npm run test:dom
```

Fixture’lar: `scripts/build-fixtures.mjs` → `test/fixtures/`

---

## Proje yapısı

```
extension-GA4-reports/
├── dist/                    # Webpack çıktısı (Chrome’a yüklenecek)
├── src/
│   ├── background/          # Service worker
│   ├── content/
│   │   ├── content.js
│   │   └── modules/
│   │       ├── api-service.js
│   │       ├── data-extraction.js
│   │       ├── ga4-selectors.js
│   │       ├── dom-helpers.js
│   │       ├── report-save.js
│   │       ├── statistics.js
│   │       └── ...
│   ├── popup/               # popup.html, popup.js, popup.css
│   └── utils/
│       ├── auth-store.js
│       ├── recent-reports.js
│       ├── lifecycle-reminders.js
│       └── dashboard-config.js
├── test/
├── webpack.common.js
├── webpack.dev.js
└── webpack.prod.js
```

---

## Modül sorumlulukları

| Modül | Görev |
|-------|--------|
| `ga4-selectors.js` | Fallback selector zincirleri |
| `data-extraction.js` | Tablo / KPI veri çekme |
| `report-save.js` | Popup & quick-save POST akışı |
| `api-service.js` | Backend HTTP + auth header |
| `lifecycle-reminders.js` | Snapshot hatırlatıcı API |
| `auth-store.js` | Token & kullanıcı adı storage |

---

## Backend entegrasyonu

- `POST /api/reports` — rapor oluşturma/güncelleme (extension payload)
- `GET /api/reports/lifecycle/reminders` — popup snapshot listesi
- Auth: `POST /api/auth/login`

Extension giriş yapmadan kayıt **yapılamaz** (popup’tan login gerekli).

---

## Lisans

MIT
