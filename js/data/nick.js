/**
 * Aturan format Nick Game.
 *
 * Nick wajib berpola INISIAL + PEMISAH + NAMA. Pemisahnya BERBEDA PER CABOR:
 *
 *     MLBB : titik   REG3. SKYLAR    REG3 . SKYLAR    REG3 .SKYLAR
 *     PUBG : huruf x REG3xSKYLAR     CBxLASAK         Reg3 x Supersemar
 *
 * Spasi di sekitar pemisah bebas — semuanya sah.
 *
 * Yang diperiksa HANYA POLANYA, bukan isi inisialnya. Versi pertama aturan ini
 * juga mencocokkan inisial dengan kontingen timnya, lengkap dengan daftar
 * singkatan resmi. Itu dilepas: singkatan yang dipakai di lapangan beragam dan
 * sah-sah saja (CMB, DIROPS, YOKKE, H&E), dan pencocokannya menandai nick yang
 * sebenarnya benar sebagai salah. Menegakkan ejaan singkatan adalah pekerjaan
 * panitia saat verifikasi; yang bisa dipertanggungjawabkan mesin cuma bentuknya.
 *
 * Dipisah dari rules.js karena pemeriksaannya PER PEMAIN, sedangkan rules.js
 * menjawab pertanyaan per tim; keduanya bertemu di periksaTim() yang meringkas
 * jumlah pelanggarannya.
 */

/**
 * Pemisah resmi tiap cabor.
 *
 * Cabor yang tidak terdaftar memakai titik — bawaan yang sama dengan MLBB.
 * Cabor baru tidak boleh langsung dianggap salah semua hanya karena aturannya
 * belum sempat dituliskan di sini.
 */
const PEMISAH = {
  MLBB: { tanda: '.', nama: 'titik', contoh: 'REG3. SKYLAR' },
  PUBG: { tanda: 'x', nama: 'huruf x', contoh: 'REG3xSKYLAR' },
};

const BAWAAN = PEMISAH.MLBB;

/** Aturan pemisah untuk satu cabor. */
export function aturanNick(game) {
  return PEMISAH[String(game || '').trim().toUpperCase()] || BAWAAN;
}

/**
 * Periksa satu nick terhadap aturan cabornya.
 *
 * Mengembalikan { ok, kode, pesan }. Kode yang mungkin:
 *   kosong  : nick belum diisi
 *   pemisah : tidak ada pemisah sama sekali
 *   inisial : ada pemisah, tapi bagian depannya kosong
 *   nama    : ada pemisah, tapi tidak ada nama di belakangnya
 */
export function periksaNick(nick, game) {
  const teks = String(nick || '').trim();
  if (!teks) return { ok: false, kode: 'kosong', pesan: 'Nick game belum diisi' };

  const aturan = aturanNick(game);

  // Dipecah di pemisah PERTAMA: kemunculan berikutnya milik nama mainnya
  // sendiri. "REG3. SKY.LAR" dan "CBxMaxx" tidak boleh dipersoalkan.
  const posisi = aturan.tanda === 'x' ? cariX(teks) : teks.indexOf(aturan.tanda);

  if (posisi < 0) {
    return {
      ok: false,
      kode: 'pemisah',
      pesan: `Nick harus berpola inisial, ${aturan.nama}, lalu nama — contoh: ${aturan.contoh}`,
    };
  }

  const inisial = teks.slice(0, posisi).trim();
  const nama = teks.slice(posisi + 1).trim();

  if (!inisial) {
    return {
      ok: false,
      kode: 'inisial',
      pesan: `Tidak ada inisial sebelum ${aturan.nama} — contoh: ${aturan.contoh}`,
    };
  }
  if (!nama) {
    return {
      ok: false,
      kode: 'nama',
      pesan: `Tidak ada nama setelah ${aturan.nama} — contoh: ${aturan.contoh}`,
    };
  }
  return { ok: true };
}

/**
 * Posisi huruf x yang berfungsi sebagai pemisah, atau -1.
 *
 * Berbeda dari titik, x adalah HURUF: ia bisa berada di dalam inisial maupun di
 * dalam nama. Yang dicari adalah x pertama yang benar-benar memisahkan — masih
 * ada sesuatu di kiri dan di kanannya. Karena itu x di ujung tidak dihitung,
 * dan "xNAMA" ditolak sebagai nick tanpa inisial, bukan diterima diam-diam.
 */
function cariX(teks) {
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (c !== 'x' && c !== 'X') continue;
    if (teks.slice(0, i).trim() && teks.slice(i + 1).trim()) return i;
  }
  // x yang ada tapi tidak memisahkan (di ujung) tetap dilaporkan sebagai
  // posisinya, supaya pesannya menyebut "tidak ada inisial/nama", bukan
  // "tidak ada pemisah" — keduanya kekeliruan yang berbeda.
  const kasar = teks.search(/[xX]/);
  return kasar;
}

/** Berapa pemain satu tim yang nick-nya belum sesuai pola cabor timnya. */
export function nickBermasalah(team) {
  return (team?.members || []).filter((m) => !periksaNick(m.game_nick, team?.game).ok);
}
