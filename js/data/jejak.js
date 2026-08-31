/**
 * Pembacaan jejak audit: waktu, sasaran, dan sifat sebuah catatan.
 *
 * Dipisah dari layarnya karena jejak kini tampil di DUA tempat — layar penuh
 * <jejak-list> dan blok riwayat di panel detail tim. Yang berbeda di antara
 * keduanya hanya markup dan kerapatannya; cara membaca catatan itu sendiri
 * harus sama, kalau tidak "Kemarin" di satu layar bisa berarti "Hari ini" di
 * layar lain untuk baris yang sama.
 *
 * Seluruhnya fungsi murni atas satu baris jejak dari GAS:
 *   { waktu, oleh, playerId, teamId, tim, game, kontingen, kolom, sebelum, sesudah }
 */

const HARI_FMT = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const JAM_FMT = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Jam:menit lokal dari epoch ms. */
export function jamJejak(epoch) {
  return epoch ? JAM_FMT.format(new Date(Number(epoch))) : '';
}

/** Kunci hari kalender lokal — dipakai mengelompokkan, bukan ditampilkan. */
export function kunciHari(epoch) {
  const d = new Date(epoch);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Label hari: "Hari ini" / "Kemarin" / tanggal penuh.
 *
 * Dibandingkan per HARI KALENDER, bukan dengan selisih 24 jam. Perubahan pukul
 * 23.50 tadi malam harus terbaca "Kemarin", bukan "Hari ini" hanya karena
 * jaraknya belum 24 jam.
 */
export function labelHari(epoch, sekarang = Date.now()) {
  const kunci = kunciHari(epoch);
  if (kunci === kunciHari(sekarang)) return 'Hari ini';
  if (kunci === kunciHari(sekarang - 86400000)) return 'Kemarin';
  return HARI_FMT.format(new Date(epoch));
}

/**
 * "baru saja" / "12 menit lalu" / "3 jam lalu" / tanggalnya.
 *
 * Dipakai untuk menjawab "kapan TERAKHIR" — di situ jarak lebih berarti
 * daripada jam dinding. Baris di dalam daftar tetap memakai jam pastinya,
 * karena di sana yang dibutuhkan adalah urutan yang bisa dicocokkan dengan
 * ingatan orang.
 */
export function jarakWaktu(epoch, sekarang = Date.now()) {
  const detik = Math.max(0, Math.floor((sekarang - epoch) / 1000));
  if (detik < 60) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  // "5 jam lalu" hanya sah selama masih di hari yang sama. Melewati tengah
  // malam, jarak dalam jam berhenti membantu: yang dicari orang saat itu adalah
  // "kemarin", bukan "sembilan jam lalu".
  if (jam < 24 && kunciHari(epoch) === kunciHari(sekarang)) return `${jam} jam lalu`;
  return `${labelHari(epoch, sekarang)} · ${jamJejak(epoch)}`;
}

/**
 * Sasaran perubahan dalam satu frasa.
 *
 * _Jejak menyimpan Team ID dan Player ID, bukan kalimat. Tim yang sudah dihapus
 * tidak punya nama lagi — id-nya yang dipakai, karena jejaknya justru harus
 * tetap terbaca setelah timnya lenyap.
 *
 * Cabang 'Kode Tim' TIDAK dead code walau GAS berhenti mencatat pembuatan kode:
 * baris lama yang sudah tertulis di _Jejak tetap ada sampai converter
 * mengosongkannya, dan selama itu ia harus tetap bisa dibaca.
 */
export function sasaranJejak(b) {
  if (b.tim) return b.game ? `${b.tim} · ${b.game}` : b.tim;
  if (b.teamId) return b.teamId;
  return b.kolom === 'Kode Tim' ? b.sebelum || '—' : '—';
}

/**
 * Apakah catatan ini MEMBUANG sesuatu?
 *
 * Dikenali dari penanda yang ditulis Code.gs saat sesuatu lenyap: "(dihapus)",
 * "(tim dihapus)", "(direset)". Yang dilakukan di sini hanya mengenalinya
 * sebagai isyarat untuk diberi warna, bukan mengurai bentuknya — bentuk itu
 * milik Code.gs dan boleh berubah tanpa merusak apa pun di sini.
 */
export function jejakMembuang(b) {
  return /dihapus|direset/.test(b.sesudah || '') || /dihapus/.test(b.kolom || '');
}

/**
 * Kelompokkan catatan per hari, dengan urutan masukan dipertahankan.
 *
 * Daftarnya sudah urut dari GAS (terbaru di atas), jadi tidak ada yang diurutkan
 * ulang di sini — hanya dipenggal setiap kali tanggalnya berganti.
 */
export function perHari(daftar, sekarang = Date.now()) {
  const hasil = [];
  var kunciAktif = '';
  (daftar || []).forEach((b) => {
    const kunci = kunciHari(b.waktu);
    if (kunci !== kunciAktif) {
      kunciAktif = kunci;
      hasil.push({ label: labelHari(b.waktu, sekarang), item: [] });
    }
    hasil[hasil.length - 1].item.push(b);
  });
  return hasil;
}
