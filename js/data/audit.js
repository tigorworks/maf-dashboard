/**
 * Pemeriksaan pelanggaran aturan turnamen, untuk layar notifikasi panitia.
 *
 * Bedanya dengan rules.js: rules.js menjawab "apa yang kurang dari SATU tim"
 * dan hasilnya menempel di baris tabel. Berkas ini menjawab pertanyaan yang
 * hanya bisa dilihat dari atas — berapa tim yang didaftarkan satu kontingen,
 * apakah ada dua orang berbeda yang mengisi formulir untuk kontingen yang sama,
 * apakah ada nama tim kembar. Pertanyaan seperti itu mustahil dijawab dari satu
 * baris; ia butuh seluruh peserta sekaligus.
 *
 * Semuanya murni turunan dari data yang sudah ada di browser — tidak ada
 * permintaan jaringan tambahan, dan hasilnya ikut berubah begitu data berubah.
 *
 * Pengelompokannya selalu PER CABOR. Satu kontingen bisa mengirim tim ke MLBB
 * dan PUBG sekaligus, dan batas-batas ini berlaku pada masing-masing cabor,
 * bukan pada jumlah gabungannya.
 */
import { normalKontingen, rapiKontingen } from '../core/format.js';
import { MAKS_TAD } from './rules.js';
import { periksaNick } from './nick.js';

/** Batas jumlah tim yang boleh didaftarkan satu kontingen dalam satu cabor. */
export const MAKS_TIM_PER_KONTINGEN = 3;

export const JENIS = {
  MANAGER: 'manager',
  GANDA: 'ganda',
  JUMLAH: 'jumlah',
  KEMBAR: 'kembar',
  TAD: 'tad',
  NICK: 'nick',
  RANGKAP: 'rangkap',
  LOGO: 'logo',
  IDCARD: 'idcard',
};

export const JUDUL = {
  [JENIS.MANAGER]: 'PIC kontingen lebih dari satu',
  [JENIS.GANDA]: 'Kiriman ganda — tim yang sama didaftarkan berulang',
  [JENIS.JUMLAH]: `Lebih dari ${MAKS_TIM_PER_KONTINGEN} tim per kontingen`,
  [JENIS.KEMBAR]: 'Nama tim kembar dalam satu kontingen',
  [JENIS.TAD]: `Lebih dari ${MAKS_TAD} pemain TAD dalam satu tim`,
  [JENIS.NICK]: 'Nick tidak sesuai format',
  [JENIS.RANGKAP]: 'Pemain merangkap PIC/Manager tim lain',
  [JENIS.LOGO]: 'Logo tim belum diunggah',
  [JENIS.IDCARD]: 'ID card belum lengkap',
};

export const KETERANGAN = {
  [JENIS.MANAGER]:
    'Satu kontingen seharusnya punya satu PIC. Dua nama berbeda hampir selalu ' +
    'berarti dua orang mengisi formulir pendaftaran untuk kontingen yang sama — ' +
    'dan itu biasanya juga penyebab tim berlebih serta nama tim kembar.',
  [JENIS.GANDA]:
    'Nama tim DAN daftar pesertanya sama persis — formulirnya terkirim lebih ' +
    'dari sekali. Salinannya perlu DIHAPUS; menggantinya nama tidak menolong, ' +
    'karena timnya memang cuma satu. Ini juga penyebab paling sering kontingen ' +
    'tampak melebihi batas jumlah tim.',
  [JENIS.JUMLAH]: `Batasnya ${MAKS_TIM_PER_KONTINGEN} tim per kontingen di tiap cabor.`,
  [JENIS.KEMBAR]:
    'Nama yang sama dipakai lebih dari sekali, TAPI daftar pesertanya berbeda — ' +
    'jadi ini memang tim yang berbeda, dan yang perlu dibetulkan namanya. ' +
    'Kalau pesertanya juga sama, temuannya muncul sebagai "Kiriman ganda".',
  [JENIS.TAD]: `Maksimal ${MAKS_TAD} pemain berstatus TAD dalam satu tim.`,
  [JENIS.NICK]:
    'Nick harus diawali inisial tim, lalu nama — misalnya REG3. SKYLAR, ' +
    'CBxLASAK, REG12・Luci, atau BMTP Joeyy. Pemisahnya bebas; yang ditandai ' +
    'hanya nick tanpa inisial di depan sama sekali.',
  [JENIS.RANGKAP]:
    'Seseorang tidak boleh bermain di satu tim sekaligus menjadi PIC atau ' +
    'Manager tim lain di cabor yang sama. Dicocokkan menurut NAMA, jadi nama ' +
    'yang kebetulan sama persis akan ikut tertandai — periksa dulu sebelum ' +
    'ditindak.',
  [JENIS.LOGO]: 'Logo wajib diunggah sebelum tim dianggap lengkap.',
  [JENIS.IDCARD]:
    'ID card wajib untuk SETIAP pemain. Verifikasi identitas belum selesai ' +
    'selama masih ada satu pun yang kosong.',
};

/** Samakan penulisan sebelum membandingkan nama orang atau nama tim. */
function normal(teks) {
  return String(teks || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Kelompokkan tim per (cabor, kontingen).
 *
 * Cabor dan kontingen disimpan sebagai field tersendiri, bukan disatukan jadi
 * satu teks lalu dipecah lagi: nama kontingen mengandung spasi ("CORPORATE
 * BANKING"), sehingga memecahnya kembali di spasi akan memotongnya jadi
 * "CORPORATE" saja.
 */
function perKontingen(teams) {
  const peta = new Map();
  for (const team of teams || []) {
    const game = team.game || '\u2014';
    // Dikelompokkan menurut nama BAKU, bukan ejaan mentahnya. Ekspor JotForm
    // tidak seragam — satu kontingen bisa tertulis "*REGION XII*" di satu berkas
    // dan "REGION XII" di berkas lain — dan dua ejaan yang terhitung sebagai dua
    // kontingen membuat batas "3 tim per kontingen" serta pencarian nama tim
    // kembar terlewat tepat pada kasus yang paling perlu ditemukan.
    //
    // Aturan pembakuannya SAMA dengan yang dipakai GAS untuk memutuskan Kode Tim
    // mana berlaku untuk tim mana (normalKontingen di core/format.js). Kalau
    // keduanya berbeda, layar bercerita lain daripada yang ditegakkan server.
    const kunci = normalKontingen(team.kontingen);
    // Pemisah kuncinya NUL, bukan spasi: nama kontingen memuat spasi, dan
    // pemisah yang juga muncul di dalam nilainya membuat kunci bisa bertabrakan.
    const k = `${game}\u0000${kunci}`;
    if (!peta.has(k)) {
      // Yang DITAMPILKAN adalah ejaan yang sudah dirapikan — bukan kunci
      // kapitalnya, dan bukan pula ejaan berhias dari baris pertama.
      peta.set(k, {
        game,
        kontingen: rapiKontingen(team.kontingen) || '(tanpa kontingen)',
        tim: [],
      });
    }
    peta.get(k).tim.push(team);
  }
  return [...peta.values()];
}

/**
 * Seluruh temuan. Tiap temuan berbentuk:
 *   { jenis, game, kontingen, ringkas, rinci[], tim[] }
 *
 * `tim` selalu berisi tim yang terlibat, supaya layarnya bisa menautkan
 * langsung ke sana — temuan tanpa jalan menuju timnya hanya jadi keluhan.
 * Urutannya: pelanggaran tingkat kontingen dulu, baru tingkat tim.
 */
export function periksaSemua(teams) {
  return [
    ...temuanManager(teams),
    // Kiriman ganda didahulukan dari batas jumlah tim dan nama kembar: kalau
    // ada, ialah SEBABNYA — dan membuang salinannya sering membuat kedua temuan
    // berikutnya hilang dengan sendirinya.
    ...temuanKirimanGanda(teams),
    ...temuanJumlahTim(teams),
    ...temuanNamaKembar(teams),
    ...temuanTad(teams),
    ...temuanNick(teams),
    ...temuanPemainPic(teams),
    ...temuanLogo(teams),
    ...temuanIdCard(teams),
  ];
}

/** 1. Lebih dari satu nama PIC kontingen di kontingen yang sama. */
export function temuanManager(teams) {
  const hasil = [];
  for (const { game, kontingen, tim } of perKontingen(teams)) {
    const nama = new Map(); // nama ternormalisasi -> tulisan aslinya
    for (const t of tim) {
      const asli = String(t.pic_name || '').trim();
      if (asli) nama.set(normal(asli), asli);
    }
    if (nama.size <= 1) continue;
    hasil.push({
      jenis: JENIS.MANAGER,
      game,
      kontingen,
      ringkas: `${nama.size} nama PIC berbeda`,
      rinci: [...nama.values()],
      tim,
    });
  }
  return hasil;
}

/** 2. Kontingen mendaftarkan tim melebihi batas. */
export function temuanJumlahTim(teams) {
  const hasil = [];
  for (const { game, kontingen, tim } of perKontingen(teams)) {
    if (tim.length <= MAKS_TIM_PER_KONTINGEN) continue;
    hasil.push({
      jenis: JENIS.JUMLAH,
      game,
      kontingen,
      ringkas: `${tim.length} tim, batas ${MAKS_TIM_PER_KONTINGEN}`,
      rinci: [],
      tim,
    });
  }
  return hasil;
}

/**
 * Sidik jari isi sebuah tim: nama + daftar pesertanya.
 *
 * Dipakai memisahkan dua hal yang dulu bertumpuk di satu temuan padahal tindak
 * lanjutnya berlawanan — salinan yang harus DIHAPUS, versus dua tim berbeda yang
 * namanya harus DIBETULKAN.
 *
 * Pesertanya diurutkan lebih dulu: dua kiriman yang sama bisa menuliskan
 * urutannya berbeda, dan itu tidak membuat keduanya jadi tim yang berbeda.
 */
function sidikRoster(team) {
  const peserta = (team.members || [])
    .map((m) => normal(m.full_name))
    .filter(Boolean)
    .sort()
    .join('|');
  return `${normal(team.team_name)}#${peserta}`;
}

/**
 * 2b. Tim yang sama didaftarkan berulang — nama DAN pesertanya sama persis.
 *
 * Dibedakan dari "nama tim kembar" karena obatnya berbeda: yang ini salinan yang
 * harus dibuang, sedangkan nama kembar adalah dua tim betulan yang bertabrakan
 * namanya. Menyatukan keduanya membuat panitia harus membuka tiap tim untuk
 * menebak mana yang mana.
 */
export function temuanKirimanGanda(teams) {
  const hasil = [];
  for (const { game, kontingen, tim } of perKontingen(teams)) {
    const perSidik = new Map();
    for (const t of tim) {
      // Tim tanpa satu pun nama peserta dilewati: sidiknya akan sama untuk
      // semuanya, dan menyebutnya "kiriman ganda" belum tentu benar.
      if (!(t.members || []).some((m) => normal(m.full_name))) continue;
      const k = sidikRoster(t);
      if (!perSidik.has(k)) perSidik.set(k, []);
      perSidik.get(k).push(t);
    }
    const ganda = [...perSidik.values()].filter((v) => v.length > 1);
    if (!ganda.length) continue;
    const salinan = ganda.reduce((n, v) => n + v.length - 1, 0);
    hasil.push({
      jenis: JENIS.GANDA,
      game,
      kontingen,
      ringkas: `${salinan} salinan berlebih · ${ganda
        .map((v) => `${v[0].team_name} ×${v.length}`)
        .join(', ')}`,
      rinci: ganda.map(
        (v) => `${v[0].team_name}: ${v.length} kiriman identik, ${v[0].members.length} pemain`
      ),
      tim: ganda.flat(),
    });
  }
  return hasil;
}

/**
 * 3. Nama tim yang sama muncul lebih dari sekali dalam satu kontingen, TAPI
 * pesertanya berbeda — jadi memang dua tim, bukan salinan.
 *
 * Yang pesertanya juga sama sengaja dikeluarkan dari sini; ia sudah dilaporkan
 * temuanKirimanGanda(). Tanpa pemisahan itu, tiap kiriman ganda muncul dua kali
 * dengan dua saran yang bertentangan.
 */
export function temuanNamaKembar(teams) {
  const hasil = [];
  for (const { game, kontingen, tim } of perKontingen(teams)) {
    const perNama = new Map();
    for (const t of tim) {
      const n = normal(t.team_name);
      if (!n) continue;
      if (!perNama.has(n)) perNama.set(n, []);
      perNama.get(n).push(t);
    }
    const kembar = [...perNama.values()].filter((v) => {
      if (v.length < 2) return false;
      // Roster berbeda -> memang dua tim, dan namanya yang harus dibetulkan.
      if (new Set(v.map(sidikRoster)).size > 1) return true;
      // Roster IDENTIK biasanya berarti kiriman ganda, dan sudah dilaporkan
      // temuanKirimanGanda(). Kecuali kalau tidak ada satu pun peserta bernama:
      // saat itu "identik" hanya berarti kedua-duanya kosong, bukan bukti
      // salinan — dan temuanKirimanGanda memang melewatinya. Tanpa pengecualian
      // ini, nama kembar bersama roster kosong lolos dari KEDUA temuan.
      return !v.some((t) => (t.members || []).some((m) => normal(m.full_name)));
    });
    if (!kembar.length) continue;
    hasil.push({
      jenis: JENIS.KEMBAR,
      game,
      kontingen,
      ringkas: kembar.map((v) => `${v[0].team_name} ×${v.length}`).join(', '),
      rinci: [],
      tim: kembar.flat(),
    });
  }
  return hasil;
}

/** 4. Terlalu banyak pemain berstatus TAD dalam satu tim. */
export function temuanTad(teams) {
  return (teams || [])
    .map((t) => ({ t, tad: (t.members || []).filter((m) => normal(m.status) === 'TAD') }))
    .filter(({ tad }) => tad.length > MAKS_TAD)
    .map(({ t, tad }) => ({
      jenis: JENIS.TAD,
      game: t.game,
      kontingen: String(t.kontingen || '').trim() || '(tanpa kontingen)',
      ringkas: `${t.team_name}: ${tad.length} pemain TAD`,
      rinci: tad.map((m) => m.full_name || '—'),
      tim: [t],
    }));
}

/** 5. Nick yang belum berpola inisial + pemisah + nama, sesuai cabornya. */
export function temuanNick(teams) {
  return (teams || [])
    .map((t) => ({
      t,
      // Cabor ikut dikirim: pemisah yang sah berbeda antara MLBB dan PUBG.
      salah: (t.members || []).filter((m) => !periksaNick(m.game_nick, t.game).ok),
    }))
    .filter(({ salah }) => salah.length)
    .map(({ t, salah }) => ({
      jenis: JENIS.NICK,
      game: t.game,
      kontingen: String(t.kontingen || '').trim() || '(tanpa kontingen)',
      ringkas: `${t.team_name}: ${salah.length} nick`,
      rinci: salah.map((m) => `${m.full_name || '—'} — ${m.game_nick || '(kosong)'}`),
      tim: [t],
    }));
}

/**
 * 6. Pemain di satu tim yang merangkap PIC/Manager tim lain.
 *
 * Dibandingkan PER CABOR: MLBB dan PUBG adalah dua lomba yang berbeda, dan
 * bermain di satu sambil mengurus tim di yang lain bukan rangkap jabatan.
 *
 * Pencocokannya lewat NAMA, bukan NIP — NIP memang tidak pernah dikirim ke
 * browser. Konsekuensinya dua orang yang namanya sama persis akan tertandai,
 * dan itu disebutkan di keterangan aturannya supaya tidak ditindak buta.
 *
 * Yang diperiksa hanya PIC/Manager TIM (kolom kontak tim), bukan PIC kontingen:
 * PIC kontingen mengurus seluruh kontingen dan wajar bila ia juga bermain.
 */
export function temuanPemainPic(teams) {
  // (cabor + nama) -> tim tempat ia BERMAIN
  const bermain = new Map();
  for (const t of teams || []) {
    for (const m of t.members || []) {
      const nama = normal(m.full_name);
      if (!nama) continue;
      const k = `${t.game}\u0000${nama}`;
      if (!bermain.has(k)) bermain.set(k, []);
      bermain.get(k).push(t);
    }
  }

  const hasil = [];
  for (const t of teams || []) {
    // Satu orang bisa tercatat dua kali (PIC dan Manager sekaligus) — cukup
    // dilaporkan sekali per tim.
    const sudah = new Set();
    for (const kontak of t.contacts || []) {
      const nama = normal(kontak.name);
      if (!nama || sudah.has(nama)) continue;

      const timLain = (bermain.get(`${t.game}\u0000${nama}`) || []).filter(
        (lain) => lain.team_id !== t.team_id
      );
      if (!timLain.length) continue;

      sudah.add(nama);
      hasil.push({
        jenis: JENIS.RANGKAP,
        game: t.game,
        kontingen: String(t.kontingen || '').trim() || '(tanpa kontingen)',
        // Tim lain yang namanya SAMA PERSIS diberi keterangan. Tanpa itu
        // kalimatnya berbunyi "PIC di HOPELESS, pemain di HOPELESS" dan terbaca
        // seperti kekeliruan program — padahal keduanya memang dua tim berbeda
        // yang namanya kembar, dan justru itu petunjuk tambahan bagi panitia.
        ringkas: `${kontak.name}: ${kontak.role || 'PIC'} di ${t.team_name}, pemain di ${timLain
          .map((x) =>
            normal(x.team_name) === normal(t.team_name)
              ? `${x.team_name} (tim lain, nama kembar)`
              : x.team_name
          )
          .join(', ')}`,
        rinci: [],
        // Kedua sisi dibawa: yang perlu diperiksa panitia adalah hubungan
        // antara tim tempat ia mengurus dan tim tempat ia bermain.
        tim: [t, ...timLain],
      });
    }
  }
  return hasil;
}

/**
 * 7. Tim yang belum mengunggah logo — DIRINGKAS PER KONTINGEN.
 *
 * Berbeda dari lima aturan sebelumnya, kekurangan berkas adalah keadaan biasa
 * di awal: sebelum pengumpulan berjalan, SELURUH tim belum punya logo. Satu
 * temuan per tim akan menghasilkan ratusan baris yang menenggelamkan
 * pelanggaran yang benar-benar perlu ditindak — PIC ganda, nama kembar, tim
 * berlebih. Diringkas per kontingen, ia tetap terlihat tanpa menutupi apa pun,
 * dan daftar timnya tetap lengkap di dalam rinciannya.
 */
export function temuanLogo(teams) {
  const hasil = [];
  for (const { game, kontingen, tim } of perKontingen(teams)) {
    const belum = tim.filter((t) => !t.logo_url);
    if (!belum.length) continue;
    hasil.push({
      jenis: JENIS.LOGO,
      game,
      kontingen,
      ringkas: `${belum.length} dari ${tim.length} tim belum mengunggah logo`,
      rinci: [],
      tim: belum,
    });
  }
  return hasil;
}

/**
 * 8. ID card belum lengkap — juga diringkas per kontingen.
 *
 * "Sudah unggah ID card" berarti SELURUH anggota punya, bukan sebagian: sama
 * seperti aturan di baris tabel. Tim tanpa satu pun anggota dilewati — yang
 * kurang di sana bukan ID card-nya, melainkan rosternya.
 */
export function temuanIdCard(teams) {
  const hasil = [];
  for (const { game, kontingen, tim } of perKontingen(teams)) {
    const belum = tim
      .map((t) => {
        const anggota = t.members || [];
        return { t, anggota, ada: anggota.filter((m) => m.has_idcard).length };
      })
      .filter(({ anggota, ada }) => anggota.length && ada < anggota.length);
    if (!belum.length) continue;
    hasil.push({
      jenis: JENIS.IDCARD,
      game,
      kontingen,
      ringkas: `${belum.length} dari ${tim.length} tim belum lengkap ID card-nya`,
      // Rinciannya menyebut kekurangan tiap tim, bukan nama tiap pemain: pada
      // tahap awal daftar nama itu berarti ratusan baris yang tidak menolong.
      rinci: belum.map(({ t, anggota, ada }) => `${t.team_name} ${ada}/${anggota.length}`),
      tim: belum.map(({ t }) => t),
    });
  }
  return hasil;
}

/** Jumlah temuan per jenis, untuk kartu ringkasan dan lencana di header. */
export function ringkasan(temuan) {
  const per = {};
  for (const jenis of Object.values(JENIS)) per[jenis] = 0;
  for (const t of temuan || []) per[t.jenis] = (per[t.jenis] || 0) + 1;
  return { per, total: (temuan || []).length };
}
