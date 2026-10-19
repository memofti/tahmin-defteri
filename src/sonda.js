/* ============================================================================
   TAHMİN DEFTERİ — SONDA 4: ORAN KAYNAĞI
   ----------------------------------------------------------------------------
   SONDA 3 NE BULDU (19 Ekim, runner'dan):
     ✓ OLBG (iki sayfa)  — kalabalık, taze, 469 KB
     ✓ soccerbase        — skor, taze
     ✗ betshoot          — HTTP 403, Cloudflare
     ✗ tntsports         — HTTP 403

   Tablo artık sorun değil: skorları kazıyorsak tabloyu kendimiz hesaplarız.
   GERİYE TEK KRİTİK BOŞLUK KALDI: ORAN.
   Oransız başabaş testi yok, değer testi yok, yöntem çöker.

   BU SONDA: yedi aday, tek koşu. "Açılıyor mu" yetmez — içinde GERÇEKTEN
   ondalık oran var mı, ona da bakıyor.

   ODDS_KEY secret'ı varsa The Odds API de test edilir (ücretsiz, 500 kredi/ay).
   Yoksa o bölüm atlanır, diğerleri yine ölçülür.
   ========================================================================== */

"use strict";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ODDS_KEY = process.env.ODDS_KEY || "";

const d = new Date();
const ISO = d.toISOString().slice(0, 10);

/* Ondalık oran deseni: 1.50 · 2,35 gibi. Sayfada kaç tane var, ona bakacağız. */
const ORAN_DESENI = /\b[1-9]\d?[.,]\d{2}\b/g;

const ADAYLAR = [
  { ad: "wincomparator (Championship lig sayfası)",
    not: "14-17 Ekim'de elle kullanıldı; anlık görüntü yayınlıyor ama oran veriyor",
    url: "https://www.wincomparator.com/predictions/football/england/championship-50/" },

  { ad: "kickoff.co.uk (maç sayfası)",
    not: "14 Ekim'de Lincoln-West Ham oranını verdi, Bet365 satırı",
    url: "https://www.kickoff.co.uk/german-bundesliga-2-predictions-stats-odds/holstein-kiel-vs-hertha-berlin/" },

  { ad: "oddslot.com",
    not: "14 Ekim'de Bodo-Dortmund oranını verdi",
    url: "https://oddslot.com/football/" },

  { ad: "sportytrader (maç sayfası)",
    not: "17 Ekim'de Sydney skorunu verdi; oran sayfaları da var",
    url: "https://www.sportytrader.com/en/betting-tips/" },

  { ad: "gainblers.com",
    not: "14 Ekim'de Slovan-Stuttgart teyidinde kullanıldı",
    url: "https://gainblers.com/en/betting/football/" },

  { ad: "footballwebpages.co.uk (fikstür + tablo)",
    not: "daha önce saat dilimi çapası olarak kullanıldı (BK saati)",
    url: "https://www.footballwebpages.co.uk/championship" },

  { ad: "football-data.co.uk (Türkiye CSV)",
    not: "AKADEMİK KAYNAK: sezonluk CSV, B365 dahil oranlar + KAPANIS oranlari. " +
         "Mac oncesi degil mac sonrasi yayinlanir — CLV ve geriye donuk test icin",
    url: "https://www.football-data.co.uk/mmz4281/2627/T1.csv",
    csv: true }
];

async function dene(a) {
  const t0 = Date.now();
  let r, metin = "";
  try {
    r = await fetch(a.url, {
      headers: { "User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-GB,en;q=0.9" },
      redirect: "follow"
    });
    metin = await r.text();
  } catch (e) {
    return { durum: "AĞ HATASI", detay: e.message, ms: Date.now() - t0 };
  }
  const ms = Date.now() - t0;

  if (!r.ok) {
    const cf = /cloudflare|just a moment|attention required/i.test(metin);
    return { durum: `HTTP ${r.status}${cf ? " (Cloudflare)" : ""}`, ms, kb: Math.round(metin.length / 1024) };
  }
  if (/just a moment|enable javascript and cookies|attention required/i.test(metin)) {
    return { durum: "ENGELLENDİ (bot duvarı, 200 ama içerik yok)", ms, kb: Math.round(metin.length / 1024) };
  }

  const bulunan = metin.match(ORAN_DESENI) || [];
  /* Makul oran aralığındakileri say — 1.01 ile 51.00 arası */
  const makul = bulunan.filter((x) => {
    const n = parseFloat(String(x).replace(",", "."));
    return n >= 1.01 && n <= 51;
  });

  let ekstra = "";
  if (a.csv) {
    const satir = metin.split("\n").filter((s) => s.trim());
    const baslik = (satir[0] || "").split(",");
    const b365 = baslik.findIndex((h) => /^B365H$/i.test(h.trim()));
    ekstra = `${satir.length - 1} satır · sütun ${baslik.length}` +
      (b365 >= 0 ? ` · B365H sütunu VAR (${b365}. sütun)` : " · B365 sütunu YOK");
    if (satir.length > 1) ekstra += ` · son satır: ${satir[satir.length - 1].slice(0, 60)}`;
  }

  return {
    durum: "AÇILDI", ms, kb: Math.round(metin.length / 1024),
    oranSayisi: makul.length,
    ornek: makul.slice(0, 8).join(" "),
    bugunIzi: metin.includes(ISO) || metin.includes(String(d.getUTCDate())),
    ekstra
  };
}

(async () => {
  console.log("========== SONDA 4 · ORAN KAYNAĞI ==========");
  console.log("zaman:", new Date().toISOString(), "(UTC)\n");

  const sonuc = [];
  for (const a of ADAYLAR) {
    console.log(`→ ${a.ad}`);
    console.log(`  not: ${a.not}`);
    const s = await dene(a);
    console.log(`  durum: ${s.durum}  (${s.ms} ms${s.kb !== undefined ? ", " + s.kb + " KB" : ""})`);
    if (s.detay) console.log(`  detay: ${s.detay}`);
    if (s.oranSayisi !== undefined) {
      console.log(`  sayfada ondalık oran görünümü: ${s.oranSayisi} adet`);
      if (s.ornek) console.log(`  örnek: ${s.ornek}`);
    }
    if (s.ekstra) console.log(`  csv: ${s.ekstra}`);
    console.log("");
    sonuc.push({ ad: a.ad, ...s });
  }

  /* ---------- The Odds API ---------- */
  let oddsApi = "ATLANDI — ODDS_KEY yok";
  if (ODDS_KEY) {
    console.log("→ THE ODDS API (ücretsiz, 500 kredi/ay)");
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_KEY}`);
      const j = await r.json();
      const kalan = r.headers.get("x-requests-remaining");
      if (Array.isArray(j)) {
        const futbol = j.filter((s) => String(s.key).startsWith("soccer"));
        const tr = futbol.filter((s) => /turkey|turkish/i.test(s.key + " " + s.title));
        console.log(`  ${futbol.length} futbol ligi · kalan kredi: ${kalan}`);
        if (tr.length) {
          tr.forEach((s) => console.log(`    ✓ ${s.key} — ${s.title} (aktif: ${s.active})`));
          const k = tr[0].key;
          const r2 = await fetch(`https://api.the-odds-api.com/v4/sports/${k}/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`);
          const j2 = await r2.json();
          if (Array.isArray(j2) && j2.length) {
            const m = j2[0];
            console.log(`    ${j2.length} maç · örnek: ${m.home_team} - ${m.away_team}`);
            const bk = (m.bookmakers || [])[0];
            if (bk) console.log(`    ${bk.title}: ` +
              ((bk.markets || [])[0]?.outcomes || []).map((o) => `${o.name}=${o.price}`).join("  "));
            oddsApi = `VAR — ${tr[0].key}, ${j2.length} maç, kalan kredi ${r2.headers.get("x-requests-remaining")}`;
          } else oddsApi = `LİG VAR (${k}) ama şu an maç yok`;
        } else {
          console.log("    ✗ Türkiye ligi listede YOK. Mevcut futbol ligleri (ilk 20):");
          futbol.slice(0, 20).forEach((s) => console.log(`      · ${s.key}`));
          oddsApi = "YOK — Türkiye ligi kapsamda değil";
        }
      } else { oddsApi = "cevap beklenen biçimde değil: " + JSON.stringify(j).slice(0, 150); }
    } catch (e) { oddsApi = "HATA: " + e.message; }
    console.log("");
  } else {
    console.log("→ THE ODDS API: atlandı (ODDS_KEY secret'ı yok)\n");
  }

  console.log("================== ÖZET ==================");
  sonuc.forEach((s) => {
    const ok = s.durum === "AÇILDI";
    const oranli = ok && s.oranSayisi > 20;
    console.log(`  ${oranli ? "✓" : ok ? "~" : "✗"} ${s.ad.padEnd(42)} ${s.durum}` +
      (ok ? `  · ${s.oranSayisi} oran` : ""));
  });
  console.log(`  ${/^VAR/.test(oddsApi) ? "✓" : "✗"} THE ODDS API: ${oddsApi}`);
  console.log("");
  console.log("  ✓ = açıldı VE bol oran içeriyor · ~ = açıldı ama oran görünmüyor (JS olabilir)");
  console.log("==========================================");
})();
