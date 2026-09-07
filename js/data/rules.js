/**
 * Aturan kelengkapan tim, dipakai untuk menandai baris yang belum memenuhi
 * syarat di tabel.
 *
 * Aturannya murni turunan dari data yang SUDAH ada di browser — tidak ada
 * permintaan jaringan tambahan, dan hasilnya ikut berubah begitu sebuah
 * unggahan berhasil (store diperbarui, tabel dirender ulang).
 *
 * Ini pemeriksaan TAMPILAN, bukan penegakan. Ia memberi tahu panitia mana yang
 * perlu ditindaklanjuti; ia tidak memblokir apa pun. Penegakan yang benar-benar
 * mengikat (mis. logo wajib sebelum ID card) hidup di alur unggahan.
 */

import { nickBermasalah } from './nick.js';

/** Batas pemain berstatus TAD dalam satu tim. */
export const MAKS_TAD = 3;

const TAD = 'TAD';

/**
 * Periksa satu tim. Mengembalikan daftar masalah — kosong berarti tim lengkap.
 *
 * Tiap masalah punya:
 *   kode  : penanda stabil untuk styling/pengujian
 *   label : teks sangat pendek untuk chip di dalam baris tabel
 *   pesan : kalimat utuh untuk tooltip dan pembaca layar
 */
export function periksaTim(team) {
  const masalah = [];
  const anggota = team?.members || [];

  const tad = anggota.filter((m) => (m.status || '').trim().toUpperCase() === TAD).length;
  if (tad > MAKS_TAD) {
    masalah.push({
      kode: 'tad',
      label: `TAD ${tad}/${MAKS_TAD}`,
      pesan: `${tad} pemain berstatus TAD — maksimal ${MAKS_TAD} per tim`,
    });
  }

  if (!team?.logo_url) {
    masalah.push({ kode: 'logo', label: 'Logo', pesan: 'Logo tim belum diunggah' });
  }

  // "Sudah unggah ID card" berarti SELURUH anggota punya, bukan sebagian:
  // verifikasi identitas tidak selesai kalau masih ada yang kosong.
  const berIdCard = anggota.filter((m) => m.has_idcard).length;
  if (anggota.length && berIdCard < anggota.length) {
    masalah.push({
      kode: 'idcard',
      label: `ID ${berIdCard}/${anggota.length}`,
      pesan: `ID card baru ${berIdCard} dari ${anggota.length} pemain`,
    });
  }

  // Format nick: POLA inisial + pemisah + nama, dengan pemisah per cabor (titik
  // untuk MLBB, huruf x untuk PUBG — lihat nick.js). Yang diperiksa hanya
  // polanya; pencocokan inisial dengan kontingen sudah dilepas karena singkatan
  // yang dipakai di lapangan beragam dan sah-sah saja. Diringkas jadi satu
  // masalah per tim — daftar nama yang melanggar ada di panel timnya, bukan di
  // baris tabel.
  const nick = nickBermasalah(team);
  if (nick.length) {
    masalah.push({
      kode: 'nick',
      label: `Nick ${nick.length}`,
      pesan:
        nick.length === 1
          ? `1 nick belum sesuai format: ${nick[0].full_name || nick[0].game_nick || 'pemain'}`
          : `${nick.length} nick belum sesuai format`,
    });
  }

  return masalah;
}

export function timLengkap(team) {
  return periksaTim(team).length === 0;
}

/* ==================== komposisi susunan yang diturunkan ==================== */

/**
 * Susunan yang boleh diturunkan dalam satu pertandingan: 5 pemain, dan yang
 * berstatus TAD/KRIYA paling banyak 2 di antaranya.
 *
 * Beda dari `periksaTim()` di atas: yang itu memeriksa RODA PENDAFTARAN — satu
 * tim boleh mendaftarkan sampai 8 orang, dan batas TAD-nya berlaku untuk seluruh
 * daftar. Yang di sini memeriksa lima orang yang benar-benar turun.
 *
 * SATU aturan yang mengikat, bukan dua: batasnya ada di TAD/KRIYA. Angka 3
 * pegawai organik/PKWT adalah AKIBATNYA, bukan syarat tersendiri — susunan
 * lima orang yang hanya boleh memuat 2 TAD/KRIYA dengan sendirinya memuat
 * minimal 3 organik/PKWT.
 *
 * Karena itu `SUSUNAN_MIN_ORGANIK` diturunkan, dan namanya MIN: susunan yang
 * seluruhnya organik/PKWT tidak melanggar apa pun. Menuliskannya sebagai
 * "tepat 3" akan menandai susunan terkuat yang bisa diturunkan sebuah tim
 * sebagai pelanggaran.
 */
export const SUSUNAN_TOTAL = 5;
export const SUSUNAN_MAKS_LUAR = 2;

/** Akibat dari dua angka di atas, bukan aturan ketiga. */
export const SUSUNAN_MIN_ORGANIK = SUSUNAN_TOTAL - SUSUNAN_MAKS_LUAR;

const GOLONGAN_ORGANIK = ['TETAP', 'PKWT'];
const GOLONGAN_LUAR = ['TAD', 'KRIYA'];

/** Nama tiap golongan untuk ditampilkan — satu tempat, dipakai chip dan pesan. */
export const NAMA_GOLONGAN = {
  organik: 'Organik/PKWT',
  luar: 'TAD/KRIYA',
};

/**
 * Golongan satu status kepegawaian: 'organik' | 'luar' | ''.
 *
 * String kosong berarti statusnya TIDAK dikenal — termasuk saat kolomnya belum
 * diisi. Ia sengaja tidak dijatuhkan ke salah satu golongan: menganggapnya
 * organik akan meloloskan susunan yang belum bisa dinilai, dan menganggapnya
 * TAD/KRIYA akan menuduh pemain yang mungkin justru pegawai tetap.
 */
export function golonganStatus(status) {
  const s = String(status || '').trim().toUpperCase();
  if (GOLONGAN_ORGANIK.includes(s)) return 'organik';
  if (GOLONGAN_LUAR.includes(s)) return 'luar';
  return '';
}

/**
 * Periksa satu susunan. `terpilih` adalah daftar anggota yang dipilih panitia.
 *
 * Mengembalikan hitungan per golongan beserta daftar pelanggarannya. Bentuk
 * masalahnya sama dengan `periksaTim()` (kode + pesan) supaya layar bisa
 * merendernya dengan cara yang sama.
 *
 * Tiga keadaan yang harus bisa dibedakan pemanggilnya, dan itu sebabnya
 * `masalah` tidak dipakai sendirian sebagai jawaban:
 *   kosong (`kosong`)         — belum memilih siapa pun
 *   belum lengkap (`kurang`)  — sudah diisi, belum sampai lima
 *   melanggar (`masalah`)     — TAD/KRIYA lebih dari 2, kelebihan orang, atau
 *                               ada pemain yang statusnya tidak diketahui
 * Hanya yang terakhir benar-benar salah. Dua yang pertama sekadar belum
 * selesai, dan menyamakan ketiganya membuat pesan pelanggaran menyala sejak
 * klik pertama lalu berhenti dibaca.
 *
 * Yang TIDAK ada di sini: batas atas pegawai organik/PKWT. Susunan berisi lima
 * organik/PKWT memenuhi syarat.
 */
export function periksaSusunan(terpilih) {
  const anggota = terpilih || [];
  let organik = 0;
  let luar = 0;
  let tanpa = 0;

  anggota.forEach((m) => {
    const g = golonganStatus(m?.status);
    if (g === 'organik') organik += 1;
    else if (g === 'luar') luar += 1;
    else tanpa += 1;
  });

  const total = anggota.length;
  const masalah = [];

  // Kelebihan orang diperiksa lebih dulu: susunan berisi enam pemain tidak
  // bisa dinilai komposisinya sama sekali — yang harus dibetulkan bukan
  // golongannya, melainkan jumlahnya.
  if (total > SUSUNAN_TOTAL) {
    masalah.push({
      kode: 'total-lebih',
      label: `Total ${total}/${SUSUNAN_TOTAL}`,
      pesan: `${total} pemain terpilih — susunan hanya ${SUSUNAN_TOTAL} pemain`,
    });
  }

  if (luar > SUSUNAN_MAKS_LUAR) {
    masalah.push({
      kode: 'luar',
      label: `${NAMA_GOLONGAN.luar} ${luar}/${SUSUNAN_MAKS_LUAR}`,
      pesan: `${luar} pemain ${NAMA_GOLONGAN.luar} — maksimal ${SUSUNAN_MAKS_LUAR}`,
    });
  }

  // Status tak dikenal disebut terakhir tapi tetap membatalkan susunan: tanpa
  // status, golongan pemainnya tidak diketahui, jadi "memenuhi syarat" adalah
  // pernyataan yang tidak bisa dibuat.
  if (tanpa) {
    masalah.push({
      kode: 'tanpa-status',
      label: `Tanpa status ${tanpa}`,
      pesan:
        tanpa === 1
          ? '1 pemain terpilih belum punya status kepegawaian'
          : `${tanpa} pemain terpilih belum punya status kepegawaian`,
    });
  }

  // "Belum lengkap" bukan pelanggaran, jadi ia disimpan di kunci terpisah dan
  // TIDAK ikut `masalah`. Kalau digabung, setiap pemain pertama yang ditandai
  // akan dijawab sebagai susunan yang salah — padahal ia baru mulai diisi.
  const kurang = Math.max(0, SUSUNAN_TOTAL - total);

  return {
    organik,
    luar,
    tanpa,
    total,
    kurang,
    kosong: total === 0,
    valid: total === SUSUNAN_TOTAL && masalah.length === 0,
    masalah,
  };
}
