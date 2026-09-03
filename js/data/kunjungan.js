/**
 * Hitungan kunjungan panel detail tim, beserta penjaga "sekali per 24 jam".
 *
 * Satu peramban yang membuka tim yang sama berulang kali — memuat ulang
 * halaman, membuka-tutup panel — hanya menambah hitungan SEKALI dalam 24 jam.
 * Tanpa penjaga ini, angkanya mengukur jumlah render, bukan jumlah orang.
 *
 * Penjaganya harus di SISI PERAMBAN. Rute `kunjungan` di GAS sengaja tanpa
 * sesi (pengunjung panel tim umumnya tidak masuk), jadi server tidak punya
 * cara mengenali peramban yang sama datang dua kali.
 *
 * Yang TIDAK dilakukan penjaga ini: melewatkan panggilannya. Angka yang tampil
 * berasal dari jawaban rute itu, jadi melewatkannya akan membuat angkanya
 * hilang setiap kali halaman dimuat ulang. Panggilannya tetap dikirim, hanya
 * dengan penanda `catat: false` — server menjawab angkanya tanpa menambah.
 *
 * Dipisah dari auth.js karena urusannya berbeda: auth.js mengurus sesi dan
 * wewenang, berkas ini mengurus satu angka yang tidak butuh keduanya.
 */

import { kirim } from './auth.js';

/** Satu peramban dihitung sekali per tim per rentang ini. */
export const KUNJUNGAN_TTL_MS = 24 * 60 * 60 * 1000;

const KUNCI = 'maf-kunjungan';

/**
 * Baca catatan kunjungan peramban ini: { teamId: waktuEpoch }.
 *
 * SELALU di dalam try/catch. localStorage bukan sesuatu yang pasti ada:
 * mode penyamaran, setelan yang memblokir penyimpanan situs, dan kuota penuh
 * semuanya MELEMPAR — bukan mengembalikan null. Kalau dibiarkan, kegagalan
 * membaca penyimpanan akan menggagalkan pemuatan panel tim, dan itu harga
 * yang sangat mahal untuk sebuah angka hiasan.
 */
function bacaCatatan() {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return {};
    const data = JSON.parse(mentah);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (error) {
    // Penyimpanan tidak bisa dibaca atau isinya rusak. Diperlakukan sebagai
    // "belum pernah berkunjung" — paling buruk satu kunjungan terhitung dua
    // kali, dan itu jauh lebih murah daripada panel yang gagal terbuka.
    return {};
  }
}

/** Tulis catatan, sekalian buang yang sudah kedaluwarsa. */
function tulisCatatan(catatan) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(catatan));
  } catch (error) {
    // Kuota penuh atau penyimpanan diblokir. Tidak ada yang perlu dilakukan:
    // konsekuensinya hanya kunjungan berikutnya ikut terhitung lagi.
  }
}

/**
 * Sudahkah peramban ini menghitung kunjungan tim ini dalam 24 jam terakhir?
 *
 * Rentang BERGULIR 24 jam, bukan "hari kalender". Hari kalender menuntut
 * kesepakatan zona waktu antara peramban dan server, dan menghasilkan
 * perilaku aneh di sekitar tengah malam — kunjungan pukul 23.59 dan 00.01
 * terhitung dua kali padahal jaraknya dua menit.
 */
export function sudahDihitung(teamId, sekarang = Date.now()) {
  if (!teamId) return false;
  const waktu = Number(bacaCatatan()[teamId]) || 0;
  // Waktu di masa depan (jam sistem sempat salah, lalu dibetulkan) tidak boleh
  // memblokir hitungan selamanya — diperlakukan sebagai belum pernah.
  if (waktu > sekarang) return false;
  return sekarang - waktu < KUNJUNGAN_TTL_MS;
}

/**
 * Tandai tim ini sudah dihitung sekarang.
 *
 * Catatan yang sudah lewat 24 jam DIBUANG di sini, bukan dibiarkan menumpuk:
 * seorang panitia bisa membuka ratusan tim, dan catatan yang tidak pernah
 * dibersihkan akan tumbuh terus di penyimpanan peramban tanpa pernah dipakai
 * lagi.
 */
export function tandaiDihitung(teamId, sekarang = Date.now()) {
  if (!teamId) return;
  const catatan = bacaCatatan();
  const bersih = {};
  for (const id of Object.keys(catatan)) {
    const waktu = Number(catatan[id]) || 0;
    if (waktu <= sekarang && sekarang - waktu < KUNJUNGAN_TTL_MS) bersih[id] = waktu;
  }
  bersih[teamId] = sekarang;
  tulisCatatan(bersih);
}

/**
 * Catat kunjungan tim ini bila perlu, lalu kembalikan total kunjungannya.
 *
 * Mengembalikan null kalau gagal — ini angka hiasan yang dipanggil di latar,
 * dan pemanggilnya tidak punya apa pun yang berguna untuk dilakukan atas
 * sebuah kegagalan. Galat di layar hanya akan membuat orang mengira panel
 * timnya rusak. Satu-satunya jejaknya di console.
 */
export async function catatKunjungan(teamId, sekarang = Date.now()) {
  if (!teamId) return null;

  // Sudah dihitung dalam 24 jam terakhir -> minta angkanya saja.
  const catat = !sudahDihitung(teamId, sekarang);

  try {
    const hasil = await kirim({ action: 'kunjungan', teamId, catat });
    const jumlah = Number(hasil?.jumlah);

    // Ditandai hanya kalau server BENAR-BENAR mencatatnya. Kalau kuncinya
    // sedang dipakai server menjawab dicatat:false — menandainya di sini akan
    // membuang kunjungan itu selama 24 jam ke depan padahal ia tidak pernah
    // terhitung.
    if (catat && hasil?.dicatat) tandaiDihitung(teamId, sekarang);

    return Number.isFinite(jumlah) ? jumlah : null;
  } catch (error) {
    console.warn('Kunjungan tidak tercatat: ' + error.message);
    return null;
  }
}

/**
 * SELURUH hitungan kunjungan sekaligus: { teamId: jumlah }.
 *
 * Untuk kolom "Kunjungan" di daftar tim. Satu permintaan untuk seluruh baris —
 * memanggil `catatKunjungan` per baris berarti 125 permintaan GAS.
 *
 * Gagal -> objek KOSONG, bukan null dan bukan melempar. Pemanggilnya merender
 * tabel; kalau hitungannya tidak ada, kolomnya cukup menampilkan tanda pisah.
 * Tabel tidak boleh gagal tampil karena angka hiasan tidak bisa diambil.
 */
export async function ambilSemuaKunjungan() {
  try {
    const hasil = await kirim({ action: 'kunjunganSemua' });
    const jumlah = hasil?.jumlah;
    if (!jumlah || typeof jumlah !== 'object' || Array.isArray(jumlah)) return {};

    // Disaring ulang di sisi ini juga. Bukan karena server tidak dipercaya,
    // tapi karena yang dipakai merender harus dipastikan berupa ANGKA — satu
    // nilai aneh yang lolos akan tampil apa adanya di dalam tabel.
    const bersih = {};
    for (const id of Object.keys(jumlah)) {
      const n = Number(jumlah[id]);
      if (Number.isFinite(n) && n > 0) bersih[id] = n;
    }
    return bersih;
  } catch (error) {
    console.warn('Hitungan kunjungan tidak bisa diambil: ' + error.message);
    return {};
  }
}
