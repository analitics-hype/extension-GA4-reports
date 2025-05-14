# GA4 AB Test Analysis Chrome Extension

Bu Chrome eklentisi, Google Analytics 4 (GA4) üzerinde AB test sonuçlarını analiz etmek ve görselleştirmek için geliştirilmiştir. Eklenti, GA4 raporlarından veri çeker, istatistiksel analizler yapar ve sonuçları kullanıcı dostu bir arayüzde sunar.

## Özellikler

- GA4 raporlarından otomatik veri çekme
- Session ve conversion verilerini kaydetme
- İstatistiksel anlamlılık hesaplama
- Görsel sonuç raporları oluşturma
- Raporları CSV olarak dışa aktarma
- Raporları görüntü olarak kopyalama
- Özelleştirilebilir güven seviyesi ayarları
- Türkçe dil desteği

## Kurulum

### Geliştirici Modu ile Kurulum

1. Bu repoyu bilgisayarınıza klonlayın:

   ```
   git clone https://github.com/kullanici/ga4-abtest-extension.git
   ```
2. Chrome tarayıcınızda `chrome://extensions/` adresine gidin
3. Sağ üst köşedeki "Geliştirici modu" seçeneğini aktif edin
4. "Paketlenmemiş öğe yükle" butonuna tıklayın
5. Klonladığınız repo içindeki `webpack-extension/dist` klasörünü seçin
6. Eklenti tarayıcınıza yüklenecektir

### Lokal Geliştirme Ortamı Kurulumu

1. Proje klasörüne gidin:

   ```
   cd ga4-abtest-extension/webpack-extension
   ```
2. Gerekli bağımlılıkları yükleyin:

   ```
   npm install
   ```
3. Geliştirme sunucusunu başlatın:

   ```
   npm run dev
   ```
4. Üretim sürümü oluşturmak için:

   ```
   npm run build
   ```

## Kullanım

1. Google Analytics 4 hesabınıza giriş yapın
2. Analiz etmek istediğiniz raporu açın
3. Eklenti otomatik olarak aktif hale gelecek ve sayfanın üst kısmında butonlar görünecektir
4. Session verilerini kaydetmek için "Session Kaydet" butonuna tıklayın
5. Conversion verilerini kaydetmek için "Conversion Kaydet" butonuna tıklayın
6. Her iki veri de kaydedildikten sonra "Analiz Et" butonuna tıklayarak sonuçları görüntüleyin
7. Sonuçları CSV olarak indirmek için "CSV" butonunu kullanın
8. Sonuçları görüntü olarak kopyalamak için "Kopyala" butonunu kullanın

## Proje Yapısı

```
webpack-extension/
├── dist/                  # Derlenen dosyalar
├── src/                   # Kaynak kodları
│   ├── background/        # Arka plan scripti
│   ├── content/           # İçerik scriptleri
│   │   ├── modules/       # Modüler kod yapısı
│   │   │   ├── api-service.js       # API işlemleri
│   │   │   ├── data-extraction.js   # Veri çıkarma
│   │   │   ├── data-processing.js   # Veri işleme
│   │   │   ├── date-utils.js        # Tarih işlemleri
│   │   │   ├── dom-helpers.js       # DOM yardımcıları
│   │   │   ├── event-handlers.js    # Olay işleyicileri
│   │   │   ├── message-handlers.js  # Mesaj işleyicileri
│   │   │   ├── statistics.js        # İstatistik hesaplamaları
│   │   │   ├── styles.js            # CSS stilleri
│   │   │   ├── templates.js         # HTML şablonları
│   │   │   ├── ui-components.js     # UI bileşenleri
│   │   │   └── url-watcher.js       # URL izleme
│   │   └── content.js     # Ana içerik scripti
│   ├── popup/             # Popup arayüzü
│   └── manifest.json      # Eklenti manifest dosyası
├── webpack.common.js      # Ortak webpack yapılandırması
├── webpack.dev.js         # Geliştirme webpack yapılandırması
├── webpack.prod.js        # Üretim webpack yapılandırması
└── package.json           # Proje bağımlılıkları
```

## Geliştirme

### Modüler Yapı

Proje, bakımı ve geliştirmeyi kolaylaştırmak için modüler bir yapıda tasarlanmıştır. Her modül belirli bir sorumluluğa sahiptir:

- **api-service.js**: Backend API ile iletişim
- **data-extraction.js**: GA4 raporlarından veri çıkarma
- **data-processing.js**: Veri işleme ve hazırlama
- **date-utils.js**: Tarih işlemleri ve formatlamalar
- **dom-helpers.js**: DOM manipülasyonu yardımcıları
- **event-handlers.js**: Olay dinleyicileri
- **message-handlers.js**: Chrome mesaj işleyicileri
- **statistics.js**: İstatistiksel hesaplamalar
- **styles.js**: CSS stilleri
- **templates.js**: HTML şablonları
- **ui-components.js**: Kullanıcı arayüzü bileşenleri
- **url-watcher.js**: URL değişikliklerini izleme

### Yeni Özellik Ekleme

Yeni bir özellik eklemek için:

1. İlgili modülü belirleyin veya yeni bir modül oluşturun
2. Gerekli fonksiyonları ekleyin
3. Ana dosyalarda gerekli importları yapın
4. Webpack ile projeyi derleyin
5. Chrome'da eklentiyi yeniden yükleyin

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.

## İletişim

Sorularınız veya önerileriniz için [email@example.com](mailto:email@example.com) adresine e-posta gönderebilirsiniz.
