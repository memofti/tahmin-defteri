/* ============================================================================
   TAHMİN DEFTERİ — SONDA 2
   ----------------------------------------------------------------------------
   SONDA 1 NE ÖĞRETTİ (19 Ekim 2026, memofti/tahmin-defteri koşu #1):
     · API-Football Süper Lig'i TANIYOR (id 203, aktif sezon 2026) — kapsam iyi.
     · AMA ücretsiz plan şunu dedi:
         "Free plans do not have access to this season, try from 2022 to 2024."
       Yani İÇİNDE BULUNDUĞUMUZ SEZON KAPALI. Fikstür yok, skor yok, oran yok.
     · Sonuç: API-Football ücretsiz katmanı bu iş için KULLANILAMAZ.

   SONDA 2 NE SORUYOR — iki ayrı sağlayıcı, iki ayrı iş:
     A) TheSportsDB  → fikstür + skor + puan durumu (GÜNCEL sezon geliyor mu?)
     B) The Odds API → oran (Türkiye ligi var mı, hangi pazarlar, kota ne?)

   Hiçbir şey yazmaz, sadece okur ve rapor eder.
   ÖNEMLİ: bu kod da çalıştırılmadan yazıldı — konteyner API'lere kapalı.
   ========================================================================== */

"use strict";

/* TheSportsDB: ücretsiz test anahtarı "3". Kendi anahtarın varsa secret ekle. */
const TSDB_KEY = process.env.TSDB_KEY || "3";
const TSDB = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`;
const SUPER_LIG = 4339;            /* thesportsdb.com/season/4339-turkish-super-lig */

/* The Odds API: ücretsiz 500 kredi/ay, anahtar şart. Yoksa B bölümü atlanır. */
const ODDS_KEY = process.env.ODDS_KEY || "";

const rapor = {};
let istek = 0;

async function al(url, baslik) {
  istek++;
  let r;
  try { r = await fetch(url); }
  catch (e) { console.log(`    x AĞ HATASI: ${e.message}`); return { hata: e.message }; }

  const kalan = r.headers.get("x-requests-remaining");
  const kullanilan = r.headers.get("x-requests-used");

  let j = null, metin = "";
  try { metin = await r.text(); j = JSON.parse(metin); }
  catch (e) { console.log(`    x JSON değil (HTTP ${r.status}): ${metin.slice(0, 120)}`); return { hata: "json", kod: r.status }; }

  console.log(`    ✓ ${baslik}  (HTTP ${r.status})` +
    (kalan ? `  · kalan kredi ${kalan}` : ""));
  return { ok: r.ok, j, kalan, kullanilan, kod: r.status };
}

function gun(ofset) {
  const d = new Date(Date.now() + ofset * 86400000);
  return d.toISOString().slice(0, 10);
}

(async () => {
  console.log("============== SONDA 2 ==============");
  console.log("zaman:", new Date().toISOString(), "(UTC)\n");

  /* ========== A) THESPORTSDB — FİKSTÜR / SKOR / TABLO ========== */
  console.log("A) THESPORTSDB  (anahtar: " + (process.env.TSDB_KEY ? "kendi anahtarın" : "ücretsiz test anahtarı 3") + ")");

  console.log("  A1) lig tanınıyor mu?");
  const lig = await al(`${TSDB}/lookupleague.php?id=${SUPER_LIG}`, "lookupleague");
  let sezon = null;
  if (lig.ok && lig.j && lig.j.leagues && lig.j.leagues[0]) {
    const L = lig.j.leagues[0];
    console.log(`      ${L.strLeague}  ·  ülke: ${L.strCountry}  ·  güncel sezon: ${L.strCurrentSeason}`);
    sezon = L.strCurrentSeason;
    rapor.tsdbLig = `VAR — ${L.strLeague}, güncel sezon ${L.strCurrentSeason}`;
  } else {
    rapor.tsdbLig = "YOK veya erişilemedi";
    console.log("      lig bulunamadı");
  }

  console.log("  A2) GÜNCEL SEZON maçları geliyor mu?  (asıl soru bu)");
  if (sezon) {
    const ev = await al(`${TSDB}/eventsseason.php?id=${SUPER_LIG}&s=${sezon}`, "eventsseason");
    const liste = ev.ok && ev.j && ev.j.events;
    if (liste && liste.length) {
      console.log(`      ${liste.length} maç geldi.`);
      const oynanmis = liste.filter((e) => e.intHomeScore !== null && e.intHomeScore !== "");
      const gelecek = liste.filter((e) => e.intHomeScore === null || e.intHomeScore === "");
      console.log(`      oynanmış (skorlu): ${oynanmis.length}  ·  gelecek: ${gelecek.length}`);
      if (oynanmis.length) {
        const s = oynanmis[oynanmis.length - 1];
        console.log(`      son skor örneği: ${s.dateEvent}  ${s.strHomeTeam} ${s.intHomeScore}-${s.intAwayScore} ${s.strAwayTeam}`);
      }
      if (gelecek.length) {
        const g = gelecek[0];
        console.log(`      sıradaki maç : ${g.dateEvent} ${g.strTime || "?"} UTC  ${g.strHomeTeam} - ${g.strAwayTeam}`);
      }
      rapor.tsdbMac = `VAR — ${liste.length} maç (${oynanmis.length} skorlu, ${gelecek.length} gelecek)`;
    } else {
      rapor.tsdbMac = "BOŞ — güncel sezon maçları gelmedi";
      console.log("      maç listesi boş");
    }
  } else { rapor.tsdbMac = "ATLANDI (sezon bilinmiyor)"; }

  console.log("  A3) bugünün maçları (gün bazlı sorgu çalışıyor mu?)");
  const bugun = await al(`${TSDB}/eventsday.php?d=${gun(0)}&s=Soccer`, "eventsday");
  if (bugun.ok && bugun.j && bugun.j.events) {
    const hepsi = bugun.j.events;
    const tr = hepsi.filter((e) => /super lig|süper lig/i.test(e.strLeague || ""));
    console.log(`      bugün toplam ${hepsi.length} futbol maçı · Süper Lig: ${tr.length}`);
    tr.slice(0, 5).forEach((e) => console.log(`        · ${e.strTime || "?"} UTC  ${e.strHomeTeam} - ${e.strAwayTeam}`));
    rapor.tsdbGun = `VAR — gün sorgusu ${hepsi.length} maç döndürdü`;
  } else {
    rapor.tsdbGun = "BOŞ veya kapalı (bu uç ücretli olabilir)";
    console.log("      gün sorgusu boş döndü");
  }

  console.log("  A4) puan durumu (motor için gerekli: n / attığı / yediği)");
  if (sezon) {
    const tb = await al(`${TSDB}/lookuptable.php?l=${SUPER_LIG}&s=${sezon}`, "lookuptable");
    const t = tb.ok && tb.j && (tb.j.table || tb.j.nothing);
    if (Array.isArray(t) && t.length) {
      const x = t[0];
      console.log(`      ${t.length} takım · örnek: ${x.strTeam} — O:${x.intPlayed} A:${x.intGoalsFor} Y:${x.intGoalsAgainst}`);
      rapor.tsdbTablo = `VAR — ${t.length} takım, gol verileri dolu`;
    } else {
      rapor.tsdbTablo = "BOŞ veya kapalı";
      console.log("      tablo gelmedi");
    }
  } else { rapor.tsdbTablo = "ATLANDI"; }
  console.log("");

  /* ========== B) THE ODDS API — ORAN ========== */
  console.log("B) THE ODDS API  (oran)");
  if (!ODDS_KEY) {
    rapor.oran = "ATLANDI — ODDS_KEY secret'ı yok";
    console.log("  atlandı: ODDS_KEY tanımlı değil.");
    console.log("  (the-odds-api.com'dan ücretsiz anahtar al, repoya ODDS_KEY secret'ı ekle,");
    console.log("   sondayı tekrar çalıştır. Kart istemiyor, 500 kredi/ay.)");
  } else {
    console.log("  B1) hangi futbol ligleri var? Türkiye aranıyor");
    const sp = await al(`https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_KEY}`, "sports");
    let trAnahtar = null;
    if (sp.ok && Array.isArray(sp.j)) {
      const futbol = sp.j.filter((s) => String(s.key).startsWith("soccer"));
      console.log(`      ${sp.j.length} spor · ${futbol.length} futbol ligi`);
      const tr = futbol.filter((s) => /turkey|turkish|super.?lig/i.test(s.key + " " + s.title));
      if (tr.length) {
        tr.forEach((s) => console.log(`        · ${s.key}  —  ${s.title}  (aktif: ${s.active})`));
        trAnahtar = tr[0].key;
      } else {
        console.log("        Türkiye ligi BULUNAMADI. Mevcut futbol ligleri (ilk 15):");
        futbol.slice(0, 15).forEach((s) => console.log(`        · ${s.key}`));
      }
      rapor.oranLig = trAnahtar ? `VAR — ${trAnahtar}` : "YOK — Türkiye ligi listede değil";
    } else { rapor.oranLig = "sorgulanamadı"; }

    if (trAnahtar) {
      console.log("  B2) oran geliyor mu, hangi pazarlar?");
      const od = await al(
        `https://api.the-odds-api.com/v4/sports/${trAnahtar}/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`,
        "odds");
      if (od.ok && Array.isArray(od.j) && od.j.length) {
        const m = od.j[0];
        console.log(`      ${od.j.length} maç · örnek: ${m.home_team} - ${m.away_team}  (${m.commence_time})`);
        const bk = m.bookmakers || [];
        console.log(`      ${bk.length} bahisçi`);
        if (bk[0]) {
          console.log(`      örnek bahisçi: ${bk[0].title}`);
          (bk[0].markets || []).forEach((mk) => {
            console.log(`        · ${mk.key}: ` +
              (mk.outcomes || []).map((o) => `${o.name}=${o.price}`).join("  "));
          });
        }
        rapor.oran = `VAR — ${od.j.length} maç, ${bk.length} bahisçi` +
          (od.kalan ? ` · kalan kredi ${od.kalan}` : "");
      } else {
        rapor.oran = "BOŞ — lig var ama oran dönmedi (sezon dışı olabilir)";
        console.log("      oran listesi boş");
      }
    } else if (ODDS_KEY) {
      rapor.oran = "ATLANDI — Türkiye ligi yok";
    }
  }
  console.log("");

  /* ========== ÖZET ========== */
  console.log("================== ÖZET ==================");
  Object.entries(rapor).forEach(([k, v]) => console.log(`  ${k.padEnd(11)}: ${v}`));
  console.log(`\n  toplam istek: ${istek}`);

  const macVar = String(rapor.tsdbMac || "").startsWith("VAR");
  const tabloVar = String(rapor.tsdbTablo || "").startsWith("VAR");
  const oranVar = String(rapor.oran || "").startsWith("VAR");

  console.log("");
  console.log("  FİKSTÜR+SKOR : " + (macVar ? "ÇÖZÜLDÜ (TheSportsDB)" : "ÇÖZÜLMEDİ"));
  console.log("  PUAN DURUMU  : " + (tabloVar ? "ÇÖZÜLDÜ (motor çalışabilir)" : "ÇÖZÜLMEDİ"));
  console.log("  ORAN         : " + (oranVar ? "ÇÖZÜLDÜ (The Odds API)" :
    (ODDS_KEY ? "ÇÖZÜLMEDİ" : "HENÜZ DENENMEDİ — ODDS_KEY gerekiyor")));
  console.log("==========================================");
})();
