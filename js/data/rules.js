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
