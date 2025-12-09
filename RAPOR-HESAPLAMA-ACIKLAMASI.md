# A/B Test Raporu Hesaplama Açıklaması

Bu dokümanda, A/B test raporlarında gösterilen metriklerin nasıl hesaplandığı basit ve anlaşılır bir dille açıklanmaktadır.

---

## 📊 Raporda Gösterilen Metrikler

Raporunuzda şu bilgiler yer almaktadır:

- **Session (Ziyaretçi Sayısı)**: Her grup için kaç kişi test edildi
- **Conversion (Dönüşüm Sayısı)**: Her grupta kaç kişi hedef eylemi gerçekleştirdi (satın alma, kayıt vb.)
- **Conv. Rate (Dönüşüm Oranı)**: Ziyaretçilerin ne kadarının dönüşüm yaptığı
- **Uplift (İyileşme Oranı)**: Varyasyonun kontrol grubuna göre ne kadar daha iyi performans gösterdiği
- **Signif. (İstatistiksel Anlamlılık)**: Sonuçların güvenilir olup olmadığı
- **Monthly/Yearly**: Kazanan varyasyonun tüm trafiğe uygulanması durumunda aylık/yıllık ekstra kazanç tahmini

---

## 1️⃣ Conversion Rate (Dönüşüm Oranı) Hesaplama

### Ne Anlama Geliyor?
Conversion Rate, ziyaretçilerinizin ne kadarının hedef eylemi gerçekleştirdiğini gösterir.

### Nasıl Hesaplanıyor?

**Formül:**
```
Dönüşüm Oranı = (Dönüşüm Sayısı / Ziyaretçi Sayısı) × 100
```

### Örnek:

**Kontrol Grubu:**
- 10,000 ziyaretçi
- 200 satın alma
- Dönüşüm Oranı = (200 / 10,000) × 100 = **2.00%**

**Varyasyon 1:**
- 10,000 ziyaretçi
- 250 satın alma
- Dönüşüm Oranı = (250 / 10,000) × 100 = **2.50%**

**Anlamı:** Varyasyon 1'de her 100 ziyaretçiden 2.5'i satın alma yapıyor, kontrol grubunda ise 2'si yapıyor.

---

## 2️⃣ Uplift (İyileşme Oranı) Hesaplama

### Ne Anlama Geliyor?
Uplift, varyasyonun kontrol grubuna göre yüzde kaç daha iyi performans gösterdiğini ifade eder.

### Nasıl Hesaplanıyor?

**Formül:**
```
İyileşme Oranı = ((Varyasyon Dönüşüm Oranı - Kontrol Dönüşüm Oranı) / Kontrol Dönüşüm Oranı) × 100
```

### Örnek:

**Kontrol Grubu:** 2.00% dönüşüm oranı
**Varyasyon 1:** 2.50% dönüşüm oranı

İyileşme Oranı = ((2.50 - 2.00) / 2.00) × 100 = **+25%**

**Anlamı:** Varyasyon 1, kontrol grubuna göre %25 daha iyi performans gösteriyor.

**Negatif Değerler:**
Eğer sonuç negatif çıkarsa (örneğin -10%), bu varyasyonun kontrol grubundan %10 daha kötü performans gösterdiği anlamına gelir.

---

## 3️⃣ Significance (İstatistiksel Anlamlılık) Hesaplama

### Ne Anlama Geliyor?
Significance, test sonuçlarının gerçek bir farklılık mı yoksa şans eseri mi olduğunu gösterir. Bu, test sonuçlarına ne kadar güvenebileceğinizi belirler.

### Nasıl Hesaplanıyor?

Bizim sistemimiz, **Monte Carlo Simülasyonu** adı verilen gelişmiş bir istatistiksel yöntem kullanır. Bu yöntem şu şekilde çalışır:

1. **50,000 kez simülasyon yapılır**: Her simülasyonda, kontrol ve varyasyon gruplarının gerçek performanslarını tahmin ederiz.

2. **Kazanan sayılır**: Her simülasyonda hangi grubun daha iyi performans gösterdiğine bakılır.

3. **Kazanma olasılığı hesaplanır**: Varyasyonun kaç simülasyonda kazandığı sayılır ve yüzdeye çevrilir.

### Örnek:

**Test Sonuçları:**
- Kontrol: 10,000 ziyaretçi, 200 dönüşüm (2.00%)
- Varyasyon: 10,000 ziyaretçi, 250 dönüşüm (2.50%)

**Simülasyon Süreci:**
- 50,000 simülasyon yapılır
- Varyasyon 45,000 simülasyonda kazanır
- Kontrol 5,000 simülasyonda kazanır

**Significance Sonucu:** %90

**Anlamı:** 
- %90 olasılıkla varyasyon gerçekten daha iyi performans gösteriyor
- %10 olasılıkla bu sonuç şans eseri olabilir

### Güven Seviyesi

Sistemimiz varsayılan olarak **%95 güven seviyesi** kullanır. Bu şu anlama gelir:

- **Significance ≥ %95**: Sonuçlar **istatistiksel olarak anlamlı**dır. Varyasyonun gerçekten daha iyi olduğuna %95 güvenle inanabilirsiniz.
- **Significance < %95**: Sonuçlar henüz **yeterince güvenilir değil**dir. Daha fazla veri toplamak gerekebilir.

**Örnek Senaryolar:**

| Significance | Anlamı | Ne Yapmalı? |
|--------------|--------|-------------|
| %98 | Çok güvenilir sonuç | Varyasyonu uygulayabilirsiniz |
| %85 | Orta seviye güven | Test süresini uzatmayı düşünün |
| %60 | Düşük güven | Daha fazla veri toplayın |

---

## 4️⃣ Monthly/Yearly Extra Transactions Hesaplama

### Ne Anlama Geliyor?
Bu metrikler, kazanan varyasyonun tüm trafiğe uygulanması durumunda ne kadar ekstra kazanç elde edilebileceğini gösterir.

### Nasıl Hesaplanıyor?

**Adım 1: Mutlak İyileşme Hesaplama**
```
Mutlak İyileşme = Varyasyon Dönüşüm Oranı - Kontrol Dönüşüm Oranı
```

**Adım 2: Günlük Ekstra Dönüşüm**
```
Günlük Ekstra Dönüşüm = (Günlük Toplam Trafik × Mutlak İyileşme)
```

**Adım 3: Aylık ve Yıllık Tahmin**
```
Aylık Ekstra = Günlük Ekstra × 30
Yıllık Ekstra = Günlük Ekstra × 365
```

### Örnek:

**Test Sonuçları:**
- Kontrol: 2.00% dönüşüm oranı
- Varyasyon: 2.50% dönüşüm oranı
- Test süresi: 14 gün
- Toplam trafik (kontrol + varyasyon): 280,000 ziyaretçi

**Hesaplama:**

1. **Mutlak İyileşme:** 2.50% - 2.00% = **0.50%**

2. **Günlük Trafik:** 280,000 ÷ 14 = **20,000 ziyaretçi/gün**

3. **Günlük Ekstra Dönüşüm:** 20,000 × 0.005 = **100 ekstra dönüşüm/gün**

4. **Aylık Ekstra:** 100 × 30 = **3,000 ekstra dönüşüm/ay**

5. **Yıllık Ekstra:** 100 × 365 = **36,500 ekstra dönüşüm/yıl**

**Anlamı:** Eğer kazanan varyasyonu tüm trafiğe uygularsanız, günde 100, ayda 3,000, yılda 36,500 ekstra dönüşüm elde edebilirsiniz.

---

## 📋 Özet Tablo

| Metrik | Ne Gösterir | Nasıl Hesaplanır |
|--------|-------------|------------------|
| **Conv. Rate** | Her 100 ziyaretçiden kaçının dönüşüm yaptığı | (Dönüşüm / Ziyaretçi) × 100 |
| **Uplift** | Varyasyonun kontrol grubuna göre ne kadar daha iyi olduğu | ((Varyasyon CR - Kontrol CR) / Kontrol CR) × 100 |
| **Significance** | Sonuçların güvenilir olup olmadığı | Monte Carlo simülasyonu ile hesaplanır (50,000 iterasyon) |
| **Monthly/Yearly** | Kazanan varyasyonun tüm trafiğe uygulanması durumunda ekstra kazanç | Günlük trafik × Mutlak iyileşme × Gün sayısı |

---

## ❓ Sık Sorulan Sorular

### 1. Significance neden önemli?
Significance, test sonuçlarının gerçek bir farklılık mı yoksa şans eseri mi olduğunu gösterir. Düşük significance değeri, sonuçların güvenilir olmadığı anlamına gelir.

### 2. %95 güven seviyesi ne demek?
%95 güven seviyesi, sonuçların %95 olasılıkla doğru olduğu anlamına gelir. Yani 100 testten 95'inde aynı sonucu alırsınız.

### 3. Negatif uplift ne anlama geliyor?
Negatif uplift, varyasyonun kontrol grubundan daha kötü performans gösterdiği anlamına gelir. Bu durumda varyasyonu uygulamamanız önerilir.

### 4. Monthly/Yearly değerleri kesin mi?
Hayır, bu değerler tahminidir. Gerçek sonuçlar, trafik değişiklikleri, sezonluk etkiler ve diğer faktörlere bağlı olarak değişebilir.

### 5. Birden fazla varyasyon varsa nasıl değerlendirilir?
Her varyasyon, kontrol grubuyla ayrı ayrı karşılaştırılır. En yüksek significance ve uplift değerine sahip varyasyon genellikle kazanan olarak kabul edilir.

---

## 📞 İletişim

Bu hesaplamalar hakkında sorularınız için lütfen bizimle iletişime geçin.

---

**Son Güncelleme:** 2025
**Versiyon:** 1.0

