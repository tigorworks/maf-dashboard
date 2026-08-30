/**
 * Aturan format Nick Game.
 *
 * Nick wajib berpola INISIAL + TITIK + NAMA:
 *
 *     REG3. SKYLAR      REG3 . SKYLAR      REG3 .SKYLAR      CMB . MayorBob
 *
 * Spasi di sekitar titik bebas — semuanya sah.
 *
 * Yang diperiksa HANYA POLANYA, bukan isi inisialnya.
 *
 * Versi pertama aturan ini juga mencocokkan inisial dengan kontingen timnya,
 * lengkap dengan daftar singkatan resmi. Itu dilepas: singkatan yang dipakai di
 * lapangan ternyata beragam dan sah-sah saja (CMB, DIROPS, YOKKE, H&E), dan
 * pencocokannya menandai nick yang sebenarnya benar sebagai salah. Menegakkan
 * ejaan singkatan adalah pekerjaan panitia saat verifikasi, bukan pekerjaan
 * aturan otomatis — yang bisa dipertanggungjawabkan mesin cuma bentuknya.
 *
 * Dipisah dari rules.js karena pemeriksaannya PER PEMAIN, sedangkan rules.js
 * menjawab pertanyaan per tim; keduanya bertemu di periksaTim() yang meringkas
 * jumlah pelanggarannya.
 */

/** Contoh yang ditampilkan di pesan galat. */
const CONTOH = 'REG3. SKYLAR';

/**
 * Periksa satu nick.
 *
 * Mengembalikan { ok, kode, pesan }. Kode yang mungkin:
 *   kosong  : nick belum diisi
 *   titik   : tidak ada titik pemisah sama sekali
 *   inisial : ada titik, tapi bagian depannya kosong
 *   nama    : ada titik, tapi tidak ada nama di belakangnya
 */
export function periksaNick(nick) {
  const teks = String(nick || '').trim();
  if (!teks) return { ok: false, kode: 'kosong', pesan: 'Nick game belum diisi' };

  // Dipecah di titik PERTAMA: titik berikutnya milik nama mainnya sendiri,
  // dan nama seperti "SKY.LAR" tidak boleh ikut dipersoalkan.
  const titik = teks.indexOf('.');
  if (titik < 0) {
    return {
      ok: false,
      kode: 'titik',
      pesan: `Nick harus berpola inisial, titik, lalu nama — contoh: ${CONTOH}`,
    };
  }

  const inisial = teks.slice(0, titik).trim();
  const nama = teks.slice(titik + 1).trim();

  if (!inisial) {
    return {
      ok: false,
      kode: 'inisial',
      pesan: `Tidak ada inisial sebelum titik — contoh: ${CONTOH}`,
    };
  }
  if (!nama) {
    return { ok: false, kode: 'nama', pesan: `Tidak ada nama setelah titik — contoh: ${CONTOH}` };
  }
  return { ok: true };
}

/** Berapa pemain satu tim yang nick-nya belum sesuai pola. */
export function nickBermasalah(team) {
  return (team?.members || []).filter((m) => !periksaNick(m.game_nick).ok);
}
