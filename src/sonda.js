/* ============================================================================
   TAHMİN DEFTERİ — SONDA 5: MAÇ ÖNCESİ ORAN (son boşluk)
   ----------------------------------------------------------------------------
   DURUM (dört sondadan sonra):
     ✓ kalabalik  — OLBG, iki sayfa, runner'dan taze geliyor
     ✓ skor       — soccerbase, runner'dan taze geliyor
     ✓ tablo      — gerek yok, skorlardan hesaplanir
     ✓ gecmis oran— football-data.co.uk T1.csv (Super Lig, B365, 113 sutun)
     ? MAC ONCESI ORAN — tek acik soru

   BU SONDA IKI SEYE BAKIYOR:
     A) football-data.co.uk/fixtures.csv  — site GELECEK maclari da oranlariyla
        yayinliyor olabilir. Oyleyse tek kaynak her seyi cozer: ayni bicim,
        ayni site, Cloudflare yok, parse etmesi kolay.
     B) kickoff.co.uk — sonda 4'te maç sayfası açıldı (92 oran). Peki GUNLUK
        LISTE sayfasi var mi, ve Super Lig'i kapsiyor mu?

   Ayrica football-data.co.uk'in hangi ligleri verdigini de sayiyoruz —
   Fatih'in bakti§i ligler kapsamda mi, onu bilmemiz lazim.
   ========================================================================== */

"use strict";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function al(url, csv) {
  const t0 = Date.now();
  let r, metin = "";
  try {
    r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "*/*" }, redirect: "follow" });
    metin = await r.text();
  } catch (e) { return { hata: e.message, ms: Date.now() - t0 }; }
  const ms = Date.now() - t0;
  if (!r.ok) {
    const cf = /cloudflare|just a moment|attention required/i.test(metin);
    return { kod: r.status, cf, ms, kb: Math.round(metin.length / 1024) };
  }
  if (/just a moment|enable javascript and cookies/i.test(metin)) {
    return { kod: 200, cf: true, ms, kb: Math.round(metin.length / 1024) };
  }
  return { ok: true, ms, kb: Math.round(metin.length / 1024), metin };
}

function csvSatirlar(m) { return m.split("\n").map((s) => s.trim()).filter(Boolean); }

(async () => {
  console.log("====== SONDA 5 · MAÇ ÖNCESİ ORAN ======");
  console.log("zaman:", new Date().toISOString(), "(UTC)\n");
  const rapor = {};

  /* ---------- A) football-data.co.uk gelecek maçlar ---------- */
  console.log("A) football-data.co.uk/fixtures.csv  (gelecek maçlar + oran?)");
  const fx = await al("https://www.football-data.co.uk/fixtures.csv", true);
  if (fx.ok) {
    const sat = csvSatirlar(fx.metin);
    const bas = (sat[0] || "").split(",").map((x) => x.trim());
    console.log(`  açıldı · ${sat.length - 1} satır · ${bas.length} sütun (${fx.kb} KB)`);
    const iB365 = bas.findIndex((h) => /^B365H$/i.test(h));
    const iDiv = bas.indexOf("Div"), iDate = bas.indexOf("Date");
    const iHome = bas.indexOf("HomeTeam"), iAway = bas.indexOf("AwayTeam");
    console.log(`  B365H sütunu: ${iB365 >= 0 ? "VAR (" + iB365 + ")" : "YOK"}`);
    if (sat.length > 1) {
      console.log("  ilk 3 maç:");
      sat.slice(1, 4).forEach((s) => {
        const p = s.split(",");
        console.log(`    · ${p[iDiv]} ${p[iDate]}  ${p[iHome]} - ${p[iAway]}` +
          (iB365 >= 0 ? `   B365: ${p[iB365]} / ${p[iB365 + 1]} / ${p[iB365 + 2]}` : ""));
      });
      /* Türkiye var mı? Div kodu T1 */
      const tr = sat.slice(1).filter((s) => s.split(",")[iDiv] === "T1");
      console.log(`  Türkiye (T1) maçı: ${tr.length}`);
      tr.slice(0, 5).forEach((s) => {
        const p = s.split(",");
        console.log(`    · ${p[iDate]}  ${p[iHome]} - ${p[iAway]}` +
          (iB365 >= 0 ? `   ${p[iB365]} / ${p[iB365 + 1]} / ${p[iB365 + 2]}` : ""));
      });
      /* hangi ligler var */
      const ligler = {};
      sat.slice(1).forEach((s) => { const d = s.split(",")[iDiv]; if (d) ligler[d] = (ligler[d] || 0) + 1; });
      console.log(`  kapsanan lig kodları: ${Object.keys(ligler).sort().join(" ")}`);
      rapor.fixtures = `VAR — ${sat.length - 1} gelecek maç` +
        (iB365 >= 0 ? ", B365 oranı DAHİL" : ", oran YOK") +
        `, T1: ${tr.length}`;
    } else rapor.fixtures = "BOŞ — dosya var ama satır yok";
  } else {
    rapor.fixtures = fx.hata ? "AĞ HATASI" : `HTTP ${fx.kod}${fx.cf ? " (Cloudflare)" : ""}`;
    console.log("  " + rapor.fixtures);
  }
  console.log("");

  /* ---------- A2) Türkiye sezon dosyası ne kadar güncel? ---------- */
  console.log("A2) T1.csv tazeliği (sonda 4'te son satır 12/10/2026 idi)");
  const t1 = await al("https://www.football-data.co.uk/mmz4281/2627/T1.csv", true);
  if (t1.ok) {
    const sat = csvSatirlar(t1.metin);
    const son = sat[sat.length - 1].split(",");
    console.log(`  ${sat.length - 1} maç · son kayıt: ${son[1]} ${son[2]} ${son[3]} ${son[4]}-${son[5]} ${son[4 + 0]}`);
    console.log(`  son satır ham: ${sat[sat.length - 1].slice(0, 90)}`);
    rapor.t1 = `${sat.length - 1} maç, son tarih ${son[1]}`;
  } else { rapor.t1 = "alınamadı"; console.log("  alınamadı"); }
  console.log("");

  /* ---------- B) kickoff.co.uk ---------- */
  console.log("B) kickoff.co.uk — günlük liste ve Türkiye kapsamı");
  const adaylar = [
    "https://www.kickoff.co.uk/",
    "https://www.kickoff.co.uk/football-predictions/",
    "https://www.kickoff.co.uk/turkish-super-lig-predictions-stats-odds/"
  ];
  let kickoffOk = 0;
  for (const u of adaylar) {
    const r = await al(u);
    if (r.ok) {
      kickoffOk++;
      const oran = (r.metin.match(/\b[1-9]\d?[.,]\d{2}\b/g) || []).length;
      const tr = /süper lig|super lig|galatasaray|fenerbah/i.test(r.metin);
      console.log(`  ✓ ${u}`);
      console.log(`      ${r.kb} KB · ${oran} oran görünümü · Türkiye izi: ${tr ? "VAR" : "yok"}`);
    } else {
      console.log(`  ✗ ${u}  →  ${r.hata ? "AĞ HATASI" : "HTTP " + r.kod + (r.cf ? " (Cloudflare)" : "")}`);
    }
  }
  rapor.kickoff = `${kickoffOk}/${adaylar.length} sayfa açıldı`;
  console.log("");

  console.log("================== ÖZET ==================");
  Object.entries(rapor).forEach(([k, v]) => console.log(`  ${k.padEnd(10)}: ${v}`));
  console.log("");
  const cozuldu = String(rapor.fixtures || "").startsWith("VAR") &&
                  String(rapor.fixtures || "").includes("DAHİL");
  console.log("  MAÇ ÖNCESİ ORAN: " + (cozuldu
    ? "ÇÖZÜLDÜ — football-data.co.uk/fixtures.csv tek başına yetiyor"
    : "fixtures.csv yetmedi — kickoff satırlarına bak"));
  console.log("==========================================");
})();
