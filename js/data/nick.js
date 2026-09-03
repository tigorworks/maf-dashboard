/**
 * Aturan format Nick Game.
 *
 * Nick wajib berpola INISIAL + PEMISAH + NAMA:
 *
 *     REG3. SKYLAR      REG12・LuciFer     BMTP Joeyy
 *     CBxLASAK          Reg1_Azi           CSBx•voodoo™•
 *
 * Yang diperiksa cuma ADANYA prefix di depan, bukan pemisah tertentu.
 *
 * Versi sebelumnya menuntut pemisah SPESIFIK PER CABOR — titik untuk MLBB,
 * huruf x untuk PUBG. Itu dilonggarkan karena menandai salah nick yang
 * sebenarnya benar, dan datanya membuktikannya: satu tim PUBG memakai titik
 * tengah Katakana (`REG12・LuciFer`), satu tim MLBB memakai konvensi x
 * (`CSBxKayzz`), dan banyak yang memakai spasi (`BMTP Joeyy`). Ketiganya punya
 * prefix seragam yang jelas terbaca manusia, tapi ditolak mesin hanya karena
 * memilih tanda yang berbeda. Pemisah yang dipakai di lapangan beragam dan
 * sah-sah saja — sama seperti alasan pencocokan inisial dengan kontingen
 * dilepas lebih dulu.
 *
 * Yang TETAP ditandai: nick tanpa prefix sama sekali (`Shadow`, `AFK`). Di
 * situlah pemeriksaan ini masih berguna.
 *
 * Dipisah dari rules.js karena pemeriksaannya PER PEMAIN, sedangkan rules.js
 * menjawab pertanyaan per tim; keduanya bertemu di periksaTim() yang meringkas
 * jumlah pelanggarannya.
 */

/**
 * Karakter tak terlihat yang harus dibuang sebelum apa pun diperiksa.
 *
 * BUKAN kerapian — ini penentu benar/salah. Dua nick di data nyata berawalan
 * U+2060 WORD JOINER: `⁠Reg3. Ar` punya prefix yang jelas sah, tapi karena
 * karakter tak terlihat itu berada di depan, "bagian sebelum pemisah" jadi
 * berisi karakter hantu dan pemeriksaan bentuk menolaknya. Yang ditandai
 * salah bukan nick-nya, melainkan sesuatu yang bahkan tidak bisa dilihat
 * orang yang disuruh membetulkannya.
 *
 * Zero-width space/non-joiner/joiner, word joiner, BOM, dan soft hyphen.
 */
const TAK_TERLIHAT = /[​-‍⁠﻿­]/g;

/** Nick yang sudah dibersihkan dari karakter hantu dan spasi tepi. */
function rapikan(nick) {
  return String(nick || '').replace(TAK_TERLIHAT, '').trim();
}

/**
 * Contoh untuk pesan galat. Dibiarkan per cabor supaya contohnya terasa
 * familiar bagi yang membacanya, walau aturannya kini sama untuk semua.
 */
const CONTOH = {
  MLBB: 'REG3. SKYLAR',
  PUBG: 'CBxLASAK',
};

const CONTOH_BAWAAN = CONTOH.MLBB;

/** Contoh nick untuk satu cabor. */
export function aturanNick(game) {
  const kunci = String(game || '').trim().toUpperCase();
  return { contoh: CONTOH[kunci] || CONTOH_BAWAAN };
}

/**
 * Posisi huruf x yang berfungsi sebagai pemisah, atau -1.
 *
 * x adalah HURUF, jadi ia bisa berada di dalam inisial maupun di dalam nama.
 * Yang dicari adalah x pertama yang benar-benar MEMISAHKAN — masih ada sesuatu
 * di kiri dan di kanannya. x di ujung tidak dihitung.
 */
function cariX(teks) {
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (c !== 'x' && c !== 'X') continue;
    if (teks.slice(0, i).trim() && teks.slice(i + 1).trim()) return i;
  }
  return -1;
}

/**
 * Posisi pemisah non-alfanumerik pertama yang benar-benar memisahkan, atau -1.
 *
 * Apa pun yang bukan huruf/angka dihitung sebagai pemisah — titik, spasi,
 * garis bawah, titik tengah, bullet. Yang penting ada isi di kedua sisinya.
 */
function cariPemisah(teks) {
  for (let i = 0; i < teks.length; i++) {
    if (/[0-9A-Za-z]/.test(teks[i])) continue;
    if (teks.slice(0, i).trim() && teks.slice(i + 1).trim()) return i;
  }
  return -1;
}

/**
 * Periksa satu nick.
 *
 * Mengembalikan { ok, kode, pesan }. Kode yang mungkin:
 *   kosong : nick belum diisi
 *   prefix : tidak ada inisial di depan nama
 */
export function periksaNick(nick, game) {
  const teks = rapikan(nick);
  if (!teks) return { ok: false, kode: 'kosong', pesan: 'Nick game belum diisi' };

  // Dua bentuk yang sah, diperiksa berurutan:
  //   1. pemisah non-alfanumerik apa pun  — REG3. SKYLAR, REG12・Luci, BMTP Joeyy
  //   2. konvensi huruf x, SEMUA cabor    — CBxLASAK, CSBxKayzz
  // Nomor 2 tidak bisa digabung ke nomor 1: x adalah huruf, jadi nick bergaya
  // x tidak punya satu pun karakter non-alfanumerik untuk dijadikan pemisah.
  if (cariPemisah(teks) >= 0 || cariX(teks) >= 0) return { ok: true };

  const { contoh } = aturanNick(game);
  return {
    ok: false,
    kode: 'prefix',
    pesan: `Nick harus diawali inisial tim, lalu nama — contoh: ${contoh}`,
  };
}

/** Berapa pemain satu tim yang nick-nya belum berprefix. */
export function nickBermasalah(team) {
  return (team?.members || []).filter((m) => !periksaNick(m.game_nick, team?.game).ok);
}
