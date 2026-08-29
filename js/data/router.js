/**
 * Sinkronisasi dua arah antara state navigasi dan fragment URL.
 *
 * Bentuk fragment:
 *   #mlbb                      daftar tim
 *   #mlbb/tim/<team_id>        halaman verifikasi satu tim
 *   #mlbb/tim/<team_id>/berkas halaman unggah logo & ID card
 *   #mlbb/tim/<team_id>/foto   halaman unggah foto tim & pemain
 *   #mlbb/kode                 daftar Kode Tim (khusus admin)
 *
 * Alur:
 *   URL  -> store : saat halaman dimuat dan saat tombol back/forward ditekan
 *   store -> URL  : saat pengguna memilih cabor, membuka tim, atau kembali
 *
 * Halaman tim adalah halaman penuh, bukan popup — jadi ia HARUS punya alamat
 * sendiri: kalau tidak, me-refresh saat sedang memeriksa satu tim akan melempar
 * pengguna kembali ke daftar, dan tombol Back browser tidak berarti apa-apa.
 *
 * Tidak ada loop tak berujung karena kedua arah berhenti begitu nilainya sama.
 */
import { clearGame, selectTeam, setFilter, setShowCodes, store } from './app-state.js';
import { adalahAdmin } from './auth.js';

/** Uraikan fragment menjadi { game, teamId, mode }. */
function bacaHash() {
  const mentah = (location.hash || '').replace(/^#/, '').trim();
  if (!mentah) return { game: '', teamId: '', mode: null };

  const bagian = mentah.split('/').filter(Boolean);
  const game = (bagian[0] || '').toUpperCase();
  // Segmen "tim" adalah penanda; tanpa itu sisanya diabaikan.
  const punyaTim = bagian[1] === 'tim' && bagian[2];
  return {
    game,
    teamId: punyaTim ? decodeURIComponent(bagian[2]) : '',
    mode: punyaTim && ['berkas', 'foto'].indexOf(bagian[3]) !== -1 ? bagian[3] : null,
    kode: bagian[1] === 'kode',
  };
}

/** Susun fragment dari state. Kembalikan '' kalau belum ada cabor terpilih. */
function tulisHash(state) {
  const game = state.filters.game;
  if (!game) return '';
  const dasar = game.toLowerCase();
  if (state.showCodes) return `${dasar}/kode`;
  if (!state.selectedTeamId) return dasar;
  const ekor = ['berkas', 'foto'].indexOf(state.selectedFocus) !== -1 ? `/${state.selectedFocus}` : '';
  return `${dasar}/tim/${encodeURIComponent(state.selectedTeamId)}${ekor}`;
}

/** Terapkan isi URL ke store. Aman dipanggil berkali-kali. */
function applyHash() {
  const state = store.state;
  if (state.phase !== 'ready') return;

  const { game, teamId, mode, kode } = bacaHash();
  const gameSah = state.facets.games.includes(game) ? game : '';

  if (gameSah !== state.filters.game) {
    if (gameSah) setFilter({ game: gameSah });
    else clearGame();
  }

  // Halaman kode hanya untuk admin. Alamat yang diketik tangan atau tautan lama
  // tidak boleh menjadi jalan masuk — pengecekan sesungguhnya tetap di GAS,
  // yang menolak permintaan kode dari siapa pun selain admin.
  const kodeSah = Boolean(gameSah && kode && adalahAdmin());
  if (kodeSah) {
    // Berhenti di sini. Melanjutkan ke cabang tim akan memanggil selectTeam(null),
    // dan itu menyetel showCodes kembali ke false — halaman kode membatalkan
    // dirinya sendiri sebelum sempat tampil.
    if (!store.state.showCodes) setShowCodes(true);
    return;
  }
  if (store.state.showCodes) setShowCodes(false);

  // Tim hanya diterima kalau memang ada di dataset — fragment bisa saja basi
  // atau diketik tangan.
  const timSah = gameSah && state.teams.some((t) => t.team_id === teamId) ? teamId : '';
  // Dibandingkan sebagai string: selectedTeamId bernilai null saat kosong,
  // sedangkan timSah bernilai '' — tanpa penyeragaman ini keduanya selalu
  // dianggap berbeda dan selectTeam dipanggil pada tiap perubahan hash.
  const terpilih = store.state.selectedTeamId || '';
  if (timSah !== terpilih || (timSah && mode !== store.state.selectedFocus)) {
    selectTeam(timSah || null, timSah ? mode : null);
  }
}

export function initGameRouting() {
  window.addEventListener('hashchange', applyHash);

  store.subscribe((state) => {
    if (state.phase !== 'ready') return;

    // Dibandingkan dengan hash yang SEDANG berlaku, bukan dengan nilai terakhir
    // yang pernah ditulis. Bedanya terasa saat sebuah alamat ditolak (misalnya
    // relawan membuka /kode): state tidak berubah, sehingga penjaga "sama
    // dengan tulisan terakhir" akan membiarkan URL-nya tetap salah selamanya.
    // Membandingkan ke keadaan nyata membuatnya memperbaiki diri.
    const inginkan = tulisHash(state);
    const sekarang = (location.hash || '').replace(/^#/, '');
    if (sekarang === inginkan) return;

    if (inginkan) {
      // location.hash membuat entri riwayat baru, sehingga tombol Back
      // mengembalikan pengguna satu langkah: tim -> daftar -> pilihan cabor.
      location.hash = inginkan;
    } else {
      // Hapus fragment tanpa meninggalkan "#" telanjang di address bar.
      history.pushState(null, '', location.pathname + location.search);
    }
  });

  return applyHash;
}
