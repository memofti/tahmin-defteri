/* ============================================================================
   TAHMİN DEFTERİ — API SONDASI
   ----------------------------------------------------------------------------
   Amaç: tek çalıştırmada şu dört soruyu CEVAPLAMAK, tahmin etmemek:

     1. API-Football Süper Lig'i veriyor mu?  (lig id'si ve aktif sezon)
     2. Fikstür geliyor mu, ve saatler ne biçimde? (TSİ'ye çevrilebiliyor mu)
     3. ORAN geliyor mu? (ücretsiz katmanda /odds açık mı)
     4. Günlük kota gerçekten 100 mü, ve bir tarama kaç istek yiyor?

   Bu betik HİÇBİR ŞEY YAZMAZ, sadece okur ve rapor eder. Güvenli.

   ÖNEMLİ DÜRÜSTLÜK NOTU: bu kod hiç çalıştırılmadan yazıldı. Claude'un
   çalıştığı konteyner bütün API sunucularına kapalı (altı aday da denendi,
   altısı da proxy tarafından engellendi). Yani ilk gerçek test BU koşu.
   Bu yüzden betik savunmacı yazıldı: her adım ayrı ayrı raporlanır, biri
   patlarsa diğerleri yine de çalışır ve log tanı koymaya yeter.
   ========================================================================== */

"use strict";

const TABAN = "https://v3.football.api-sports.io";
const ANAHTAR = process.env.API_KEY;

if (!ANAHTAR) {
  console.error("HATA: API_KEY secret'ı tanımlı değil.");
  console.error("GitHub → repo → Settings → Secrets and variables → Actions →");
  console.error("New repository secret → isim: API_KEY, değer: api-football anahtarın");
  process.exit(1);
}

let istekSayisi = 0;
const kotaIzi = [];

async function cagir(yol) {
  istekSayisi++;
  const url = TABAN + yol;
  const t0 = Date.now();
  let r;
  try {
    r = await fetch(url, { headers: { "x-apisports-key": ANAHTAR } });
  } catch (e) {
    console.log(`  ✗ AĞ HATASI (${yol}): ${e.message}`);
    return { hata: e.message };
  }
  const ms = Date.now() - t0;

  /* Kota başlıkları — kaç istek kaldığını SÖYLÜYORLAR, tahmin etmeye gerek yok */
  const kalanGun = r.headers.get("x-ratelimit-requests-remaining");
  const limitGun = r.headers.get("x-ratelimit-requests-limit");
  const kalanDk = r.headers.get("x-ratelimit-remaining");
  kotaIzi.push({ yol, kalanGun, limitGun, kalanDk });

  let j;
  try { j = await r.json(); }
  catch (e) { console.log(`  ✗ JSON okunamadı (${yol}): ${e.message}`); return { hata: "json" }; }

  /* API-Football hatalari HTTP 200 ile de gelebiliyor, `errors` alanina bak */
  const hatalar = j && j.errors;
  const hataVar = hatalar && (Array.isArray(hatalar) ? hatalar.length : Object.keys(hatalar).length);
  if (hataVar) {
    console.log(`  ✗ API HATASI (${yol}): ${JSON.stringify(hatalar)}`);
    return { hata: hatalar, ham: j };
  }

  console.log(`  ✓ ${yol}  (${ms} ms · HTTP ${r.status} · sonuç ${j.results})`);
  return { ok: true, veri: j.response || [], ham: j };
}

function tsi(isoVeyaTs) {
  /* API-Football her fikstürde `timestamp` (saniye, UTC) veriyor.
     TSİ sabit UTC+3, yaz saati yok — çevirisi tek satır ve hatasız. */
  const d = new Date((typeof isoVeyaTs === "number" ? isoVeyaTs * 1000 : Date.parse(isoVeyaTs)));
  const t = new Date(d.getTime() + 3 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())} TSİ`;
}

(async () => {
  console.log("================ TAHMİN DEFTERİ · API SONDASI ================");
  console.log("zaman:", new Date().toISOString(), "(UTC)");
  console.log("");

  const rapor = {};

  /* ---------- 1. SORU: SÜPER LİG VAR MI? ---------- */
  console.log("1) SÜPER LİG ARANIYOR  (/leagues?country=Turkey)");
  const ligler = await cagir("/leagues?country=Turkey");
  let ligId = null, sezon = null;

  if (ligler.ok) {
    console.log(`  Türkiye'de ${ligler.veri.length} lig/kupa bulundu:`);
    ligler.veri.forEach((x) => {
      const l = x.league, aktif = (x.seasons || []).find((s) => s.current);
      console.log(`    · ${String(l.id).padEnd(6)} ${l.name}  (${l.type})` +
        (aktif ? `  → aktif sezon ${aktif.year}` : "  → aktif sezon YOK"));
      const ad = (l.name || "").toLowerCase();
      if (!ligId && (ad.includes("süper") || ad.includes("super")) && l.type === "League") {
        ligId = l.id; sezon = aktif ? aktif.year : null;
      }
    });
    rapor.superLig = ligId ? `VAR (id ${ligId}, sezon ${sezon})` : "YOK — listede Süper Lig geçmiyor";
  } else {
    rapor.superLig = "SORGULANAMADI";
  }
  console.log(`  >>> SONUÇ: ${rapor.superLig}`);
  console.log("");

  /* ---------- 2. SORU: FİKSTÜR VE SAAT ---------- */
  console.log("2) FİKSTÜR VE SAAT KONTROLÜ");
  let ornekFikstur = null;
  if (ligId && sezon) {
    const fx = await cagir(`/fixtures?league=${ligId}&season=${sezon}&next=5`);
    if (fx.ok && fx.veri.length) {
      console.log("  Sıradaki 5 maç (saatler TSİ'ye çevrildi):");
      fx.veri.forEach((f) => {
        console.log(`    · ${tsi(f.fixture.timestamp)}  ${f.teams.home.name} – ${f.teams.away.name}`);
      });
      ornekFikstur = fx.veri[0].fixture.id;
      rapor.fikstur = `VAR (${fx.veri.length} maç, timestamp alanı dolu → TSİ çevrimi güvenli)`;
    } else {
      rapor.fikstur = "BOŞ — lig bulundu ama fikstür gelmedi";
    }
  } else {
    rapor.fikstur = "ATLANDI (lig id'si yok)";
    console.log("  atlandı — Süper Lig bulunamadı");
  }
  console.log(`  >>> SONUÇ: ${rapor.fikstur}`);
  console.log("");

  /* ---------- 3. SORU: ORAN GELİYOR MU? ---------- */
  console.log("3) ORAN KONTROLÜ  (ücretsiz katmanda /odds açık mı)");
  if (ornekFikstur) {
    const od = await cagir(`/odds?fixture=${ornekFikstur}`);
    if (od.ok && od.veri.length) {
      const b = od.veri[0].bookmakers || [];
      console.log(`  ${b.length} bahisçi geldi.`);
      const ilk = b[0];
      if (ilk) {
        console.log(`  örnek bahisçi: ${ilk.name}`);
        (ilk.bets || []).slice(0, 6).forEach((bet) => {
          console.log(`    · ${bet.name}: ` +
            (bet.values || []).slice(0, 4).map((v) => `${v.value}=${v.odd}`).join("  "));
        });
        const pazarlar = (ilk.bets || []).map((x) => x.name.toLowerCase());
        rapor.oran = "VAR — " + b.length + " bahisçi" +
          (pazarlar.some((p) => p.includes("match winner")) ? " · 1X2 ✓" : " · 1X2 ✗") +
          (pazarlar.some((p) => p.includes("over/under")) ? " · alt/üst ✓" : " · alt/üst ✗") +
          (pazarlar.some((p) => p.includes("both teams")) ? " · KG ✓" : " · KG ✗");
      } else {
        rapor.oran = "BOŞ — /odds cevap verdi ama bahisçi listesi boş (maç çok ileride olabilir)";
      }
    } else {
      rapor.oran = "BOŞ veya KAPALI — /odds sonuç döndürmedi";
    }
  } else {
    rapor.oran = "ATLANDI (örnek fikstür yok)";
    console.log("  atlandı");
  }
  console.log(`  >>> SONUÇ: ${rapor.oran}`);
  console.log("");

  /* ---------- 4. SORU: KOTA ---------- */
  console.log("4) KOTA DURUMU");
  const son = kotaIzi[kotaIzi.length - 1];
  if (son && son.limitGun) {
    console.log(`  günlük limit: ${son.limitGun}`);
    console.log(`  bu koşudan sonra kalan: ${son.kalanGun}`);
    console.log(`  dakikalık kalan: ${son.kalanDk}`);
    rapor.kota = `limit ${son.limitGun}/gün · bu sonda ${istekSayisi} istek harcadı`;
  } else {
    rapor.kota = "başlıklar okunamadı";
    console.log("  kota başlıkları gelmedi");
  }
  console.log("");

  /* ---------- ÖZET ---------- */
  console.log("======================= ÖZET =======================");
  Object.entries(rapor).forEach(([k, v]) => console.log(`  ${k.padEnd(12)}: ${v}`));
  console.log("");
  console.log(`  toplam istek: ${istekSayisi}`);
  console.log("");
  const gecti = ligId && rapor.fikstur.startsWith("VAR") && String(rapor.oran).startsWith("VAR");
  console.log(gecti
    ? "  >>> SONDA GEÇTİ. Kurulum başlayabilir."
    : "  >>> SONDA GEÇMEDİ. Yukarıdaki satırlara bak — kurulum başlamadan karar vereceğiz.");
  console.log("====================================================");
})();
