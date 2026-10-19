/* ============================================================================
   TAHMİN DEFTERİ — SONDA 3: KAZIMA YOLU
   ----------------------------------------------------------------------------
   ÖNCEKİ SONDALAR NE ÖĞRETTİ:
     1) API-Football ücretsiz → güncel sezon KAPALI.
     2) TheSportsDB ücretsiz → veri KIRPIK (15 maç, 5 takım) ve BAYAT (23 Ağustos).
     → Ücretsiz API yolu kapandı. Ücretli istemiyoruz.

   BU SONDANIN SORUSU:
     GitHub Actions runner'ı, beş günde elle çalıştığını gördüğümüz kaynaklara
     ERİŞEBİLİYOR MU? Benim konteynerim erişemiyor (proxy), artifact sayfası
     hiçbir yere erişemiyor (CSP) — ama runner serbest olabilir.

   NEDEN ÖNEMLİ: cevap evetse, kazımayı güvenilir bir çalıştırıcıya taşıyıp
   API'siz, anahtarsız, ücretsiz bir altyapı kurabiliriz. Hayırsa bu yol da
   kapanır ve bunu KURMADAN önce bilmiş oluruz.

   İKİ ŞEYE BİRDEN BAKIYOR:
     · ERİŞİM  — sayfa açılıyor mu, yoksa 403/Cloudflare mi?
     · TAZELİK — sayfada BUGÜNÜN izi var mı? (betshoot 16 Ekim'de dünkü
                 programı sunmuştu; erişim yetmez, taze olmalı)

   Hiçbir şey yazmaz. Sadece okur ve rapor eder.
   ========================================================================== */

"use strict";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function bugunParcalari() {
  const d = new Date();
  const yil = d.getUTCFullYear();
  const ay = String(d.getUTCMonth() + 1).padStart(2, "0");
  const gun = String(d.getUTCDate()).padStart(2, "0");
  const aylar = ["January","February","March","April","May","June",
                 "July","August","September","October","November","December"];
  return {
    iso: `${yil}-${ay}-${gun}`,
    ayAdi: aylar[d.getUTCMonth()],
    gunSayi: String(d.getUTCDate()),
    kisa: `${gun}/${ay}`,
    kisaTers: `${gun}-${ay}`
  };
}
const B = bugunParcalari();

/* Her kaynak için: ne işe yarıyor, adresi, ve "taze mi" diye bakılacak izler */
const KAYNAKLAR = [
  {
    ad: "OLBG (kalabalık · İngiltere)",
    is: "tahminci görüşleri — 1X2 + alt/üst + KG",
    url: "https://www.olbg.com/betting-tips/Football/1",
    izler: ["Win Tips", "Tips"],
    tazelik: ["Today", "today"]
  },
  {
    ad: "OLBG (kalabalık · ABD)",
    is: "aynı veri, farklı liste — daha zengin çıkıyor",
    url: "https://www.olbg.com/us/betting-picks/Soccer/1",
    izler: ["Tips", "Full Time Result"],
    tazelik: ["Today", "today"]
  },
  {
    ad: "betshoot (toplu oran + fikstür)",
    is: "günün tüm maçları, 1X2 + alt/üst, tek bahisçi",
    url: "https://www.betshoot.com/football/",
    izler: ["odds", "Odds"],
    tazelik: [B.ayAdi + " " + B.gunSayi, B.gunSayi + " " + B.ayAdi]
  },
  {
    ad: "soccerbase (günlük sonuçlar)",
    is: "skor kapatma — 17 Ekim'de dört maçı doğru verdi",
    url: `https://www.soccerbase.com/matches/results.sd?date=${B.iso}`,
    izler: ["Championship", "matches", "Match"],
    tazelik: [B.iso, B.gunSayi]
  },
  {
    ad: "tntsports (lig tablosu)",
    is: "motor girdisi — oynanan / attığı / yediği",
    url: "https://www.tntsports.co.uk/football/2.-bundesliga/2026-2027/standings.shtml",
    izler: ["standings", "Standings", "Pts", "Hertha"],
    tazelik: []   /* tablo her gün değişmez, tazelik aranmaz */
  }
];

async function dene(k) {
  const t0 = Date.now();
  let r, metin = "";
  try {
    r = await fetch(k.url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9,tr;q=0.8"
      },
      redirect: "follow"
    });
    metin = await r.text();
  } catch (e) {
    return { erisim: "AĞ HATASI", detay: e.message, ms: Date.now() - t0 };
  }
  const ms = Date.now() - t0;

  if (!r.ok) {
    const ipucu = /cloudflare|just a moment|attention required/i.test(metin)
      ? " (Cloudflare bot koruması)" : "";
    return { erisim: `HTTP ${r.status}${ipucu}`, ms, boy: metin.length };
  }

  /* Bot duvarı 200 ile de gelebiliyor — içeriğe bak */
  if (/just a moment|enable javascript and cookies|attention required/i.test(metin)) {
    return { erisim: "ENGELLENDİ (bot duvarı, HTTP 200 ama içerik yok)", ms, boy: metin.length };
  }

  const izVar = k.izler.some((i) => metin.includes(i));
  const tazeVar = k.tazelik.length === 0 ? null : k.tazelik.some((i) => metin.includes(i));

  return {
    erisim: "AÇILDI",
    ms, boy: metin.length,
    icerik: izVar ? "beklenen içerik VAR" : "içerik tanınmadı (yapı değişmiş olabilir)",
    taze: tazeVar === null ? "—" : (tazeVar ? "BUGÜNÜN izi var" : "BUGÜNÜN izi YOK (bayat olabilir)")
  };
}

(async () => {
  console.log("============== SONDA 3 · KAZIMA YOLU ==============");
  console.log("zaman:", new Date().toISOString(), "(UTC)");
  console.log("bugün aranan izler:", B.iso, "/", B.ayAdi, B.gunSayi, "\n");

  const sonuc = [];
  for (const k of KAYNAKLAR) {
    console.log(`→ ${k.ad}`);
    console.log(`  iş: ${k.is}`);
    const s = await dene(k);
    console.log(`  erişim : ${s.erisim}  (${s.ms} ms${s.boy ? ", " + Math.round(s.boy / 1024) + " KB" : ""})`);
    if (s.detay) console.log(`  detay  : ${s.detay}`);
    if (s.icerik) console.log(`  içerik : ${s.icerik}`);
    if (s.taze) console.log(`  tazelik: ${s.taze}`);
    console.log("");
    sonuc.push({ ad: k.ad, ...s });
  }

  console.log("================== ÖZET ==================");
  let acik = 0, engelli = 0;
  sonuc.forEach((s) => {
    const iyi = s.erisim === "AÇILDI";
    if (iyi) acik++; else engelli++;
    console.log(`  ${iyi ? "✓" : "✗"} ${s.ad.padEnd(34)} ${s.erisim}` +
      (s.taze && s.taze !== "—" ? `  · ${s.taze}` : ""));
  });
  console.log(`\n  açılan: ${acik} / ${sonuc.length}`);
  console.log("");

  if (acik === sonuc.length) {
    console.log("  >>> KAZIMA YOLU AÇIK. Runner bütün kaynaklara erişiyor.");
    console.log("      Kurulum bu yoldan yapılabilir: Actions kazır, repoya JSON yazar,");
    console.log("      GitHub Pages sayfası kendi verisini okur (aynı origin).");
  } else if (acik === 0) {
    console.log("  >>> KAZIMA YOLU KAPALI. Runner hiçbir kaynağa erişemiyor.");
    console.log("      Bu yol da elenir; geriye artifact içinde kalmak kalır.");
  } else {
    console.log("  >>> KISMİ. Yukarıda ✗ olanlara bak — o işler için yedek kaynak gerekir.");
    console.log("      Hangi işin kaynaksız kaldığı önemli: kalabalık ve oran kritik,");
    console.log("      skor için alternatif çok.");
  }
  console.log("==========================================");
})();
