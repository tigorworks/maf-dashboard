/**
 * Login admin & relawan.
 *
 * Yang disimpan di browser hanyalah TOKEN SESI, bukan kuncinya. Kunci dikirim
 * sekali saat login lalu dibuang; kalau cookie dicuri, yang didapat adalah token
 * yang bisa dicabut dari sisi GAS dan mati sendiri setelah 3 jam menganggur.
 *
 * Kedaluwarsa ditegakkan di DUA tempat, dan itu disengaja:
 *   - GAS  : otoritatifnya. Setiap permintaan ber-token diperiksa dan diperpanjang.
 *   - sini : hanya kenyamanan, supaya UI tidak menampilkan "admin" untuk sesi
 *            yang sebenarnya sudah mati di server.
 * Timer di browser tidak pernah menjadi dasar wewenang — menghapusnya lewat
 * DevTools tidak memberi hak apa pun.
 */
import { normalKontingen } from '../core/format.js';
import { GAS_URL } from './source.js';

const COOKIE = 'maf_sesi';
const IDLE_MS = 3 * 60 * 60 * 1000; // samakan dengan CONFIG.SESI_IDLE_MS di Code.gs
const TIMEOUT = 25000;

export const PERAN = { ADMIN: 'admin', RELAWAN: 'relawan', TIM: 'tim' };

/**
 * Tiga jenis Kode Tim, bertingkat. Jenisnya melekat pada kode saat dibuat, jadi
 * mengganti wewenang berarti membuat kode baru.
 *
 *   unggah : hanya mengunggah berkas
 *   penuh  : menyunting roster + mengunggah
 *   hapus  : semua yang di atas, ditambah menghapus tim
 *
 * Menghapus berdiri sebagai tingkat tersendiri dan sengaja TIDAK ikut dalam
 * 'penuh': salah mengetik nick bisa dibetulkan menit berikutnya, sedangkan tim
 * yang terhapus tidak bisa didaftarkan ulang oleh PIC-nya sama sekali.
 */
export const JENIS_KODE = { UNGGAH: 'unggah', PENUH: 'penuh', HAPUS: 'hapus' };

/**
 * Umur Kode Tim, dalam jam. HARUS sama dengan CONFIG.KODE_TIM_TTL_MS di Code.gs.
 *
 * Ditulis di satu tempat karena angkanya muncul di delapan kalimat yang tersebar
 * di tiga layar — tooltip pemilih jenis, pita konfirmasi buat-semua, keadaan
 * kosong halaman Kode Tim. Saat angkanya diubah, yang mudah terjadi bukan lupa
 * mengubah GAS-nya, melainkan lupa mengubah salah satu dari delapan kalimat itu,
 * sehingga layar menjanjikan umur yang berbeda dari yang sesungguhnya berlaku.
 *
 * Tidak dibaca dari `ttlMs` yang dikirim GAS: kalimat-kalimat itu tampil SEBELUM
 * ada satu pun permintaan, jadi angkanya harus sudah diketahui saat merender.
 * Kesamaannya dengan Code.gs ditegakkan oleh uji, bukan oleh ingatan.
 */
export const UMUR_KODE_JAM = 12;

/** "12 jam" — untuk disisipkan ke kalimat di layar. */
export const UMUR_KODE = `${UMUR_KODE_JAM} jam`;

/**
 * Nama tiap jenis, satu tempat untuk seluruh layar.
 *
 * Ketiga layar yang menampilkannya — detail tim, dialog di daftar tim, dan
 * halaman Kode Tim — dulu masing-masing menuliskan sendiri "Ubah data + unggah
 * berkas". Dengan tingkat ketiga, kalimat yang berbeda-beda di tiap layar
 * berhenti jadi soal rasa dan mulai jadi soal benar: `panjang` yang dibaca saat
 * MEMILIH wewenang, `pendek` untuk penanda di sela baris.
 */
export const NAMA_JENIS = {
  [JENIS_KODE.UNGGAH]: { pendek: 'unggah saja', panjang: 'Unggah berkas saja' },
  [JENIS_KODE.PENUH]: { pendek: 'ubah + unggah', panjang: 'Ubah data + unggah berkas' },
  [JENIS_KODE.HAPUS]: { pendek: 'ubah + hapus', panjang: 'Ubah data + hapus tim + unggah' },
};

/** Jenis yang dikenal; apa pun di luarnya jatuh ke yang PALING SEMPIT. */
export function jenisKode(nilai) {
  return NAMA_JENIS[nilai] ? nilai : JENIS_KODE.UNGGAH;
}

/** Nama jenis untuk ditampilkan. */
export function namaJenis(nilai, bentuk = 'pendek') {
  return NAMA_JENIS[jenisKode(nilai)][bentuk];
}

/* ------------------------------ cookie ------------------------------ */

function bacaCookie() {
  const cocok = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return cocok ? decodeURIComponent(cocok.slice(COOKIE.length + 1)) : '';
}

function tulisCookie(token) {
  // Secure hanya di HTTPS: di http://localhost cookie ber-Secure akan ditolak
  // diam-diam, dan login akan tampak "berhasil tapi tidak nyangkut".
  const aman = location.protocol === 'https:' ? '; Secure' : '';
  const umur = Math.round(IDLE_MS / 1000);
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${umur}; SameSite=Lax${aman}`;
}

function hapusCookie() {
  const aman = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${aman}`;
}

/* ------------------------------ jaringan ------------------------------ */

/**
 * POST ke GAS. Body dikirim sebagai text/plain: application/json memicu CORS
 * preflight (OPTIONS) yang tidak bisa dilayani Apps Script.
 */
export async function kirim(body, { timeout = TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const hasil = await response.json();
    if (!hasil.ok) throw new Error(hasil.error || 'Permintaan ditolak.');
    return hasil;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Server tidak merespons. Coba lagi.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ sesi ------------------------------ */

let sesi = null; // { nama, peran, token, sampai }
const pendengar = new Set();
let timerIdle = 0;

function umumkan() {
  pendengar.forEach((fn) => fn(sesi));
}

/** Berlangganan perubahan sesi. Mengembalikan fungsi berhenti. */
export function onAuth(fn) {
  pendengar.add(fn);
  fn(sesi);
  return () => pendengar.delete(fn);
}

export function sesiSekarang() {
  return sesi;
}

export function adalahAdmin() {
  return sesi?.peran === PERAN.ADMIN;
}

/** Relawan hanya boleh melihat — tidak mengunggah, tidak menyunting. */
export function adalahRelawan() {
  return sesi?.peran === PERAN.RELAWAN;
}

/** PIC kontingen: masuk dengan Kode Tim, wewenangnya sebatas kontingennya. */
export function adalahTim() {
  return sesi?.peran === PERAN.TIM;
}

/** Apakah tim ini berada di kontingen yang dipegang sesi sekarang? */
function kontingenSendiri(team) {
  const milik = sesi?.kontingen;
  if (!milik) return false;
  return normalKontingen(team?.kontingen) === normalKontingen(milik);
}

/**
 * Bolehkah sesi ini MENYUNTING tim tertentu?
 *
 * Admin: semua tim. PIC kontingen: seluruh tim kontingennya — lintas cabor —
 * dan hanya kalau kodenya berjenis 'penuh'; kode 'unggah' memang tidak
 * dimaksudkan menyentuh data.
 *
 * Argumennya TIM, bukan teamId: satu kode kini mencakup banyak tim, jadi
 * jawabannya bergantung pada kontingen tim itu dan bukan lagi pada satu id yang
 * bisa dicocokkan langsung. Ini pertanyaan TAMPILAN; penolakan yang
 * sesungguhnya tetap terjadi di GAS.
 */
export function bolehSuntingTim(team) {
  if (adalahAdmin()) return true;
  return bolehUnggahTim(team) && jenisKode(sesi?.jenis) !== JENIS_KODE.UNGGAH;
}

/**
 * Bolehkah sesi ini MENGHAPUS tim tertentu?
 *
 * Menuntut jenis 'hapus' — 'penuh' tidak cukup. Admin dijawab `false` di sini
 * dengan sengaja: wewenangnya memang ada (GAS mengizinkannya), tapi jalurnya
 * menu ⋮ di daftar tim, bukan tombol di halaman detail. Yang ditanyakan fungsi
 * ini adalah "haruskah zona bahaya di detail tim muncul", dan jawabannya untuk
 * admin adalah tidak.
 */
export function bolehHapusTim(team) {
  return bolehUnggahTim(team) && !adalahAdmin() && jenisKode(sesi?.jenis) === JENIS_KODE.HAPUS;
}

/**
 * Bolehkah sesi ini MENGUNGGAH berkas tim tertentu?
 * Kedua jenis kode boleh — itu justru satu-satunya hal yang bisa dilakukan
 * pemegang kode 'unggah'.
 */
export function bolehUnggahTim(team) {
  if (adalahAdmin()) return true;
  return adalahTim() && kontingenSendiri(team);
}

/**
 * Admin dan relawan boleh melihat ID card tim mana pun; PIC kontingen hanya
 * kontingennya sendiri. GAS menolak sisanya, jadi meminta gambar kontingen lain
 * hanya akan menghasilkan kotak galat — lebih baik tidak diminta sama sekali.
 */
export function bolehLihatIdCard(team) {
  if (!sesi) return false;
  if (!adalahTim()) return true;
  return kontingenSendiri(team);
}

function pasangSesi(data, token) {
  // kontingen hanya terisi untuk peran tim. Ia datang dari GAS, bukan dari apa
  // pun yang bisa disetel di browser — di sini ia sekadar dibawa agar tampilan
  // tahu tim mana yang boleh disunting. Wewenang sesungguhnya tetap diperiksa
  // ulang di GAS pada setiap permintaan.
  sesi = {
    nama: data.nama,
    peran: data.peran,
    kontingen: data.kontingen || '',
    jenis: data.jenis || '',
    token,
    sampai: Date.now() + IDLE_MS,
  };
  tulisCookie(token);
  jadwalkanKedaluwarsa();
  umumkan();
}

/**
 * Jadwalkan penandaan "sesi berakhir" di sisi UI. Dipasang ulang tiap kali
 * token dipakai, sehingga menjadi idle timeout dan bukan umur mati.
 */
function jadwalkanKedaluwarsa() {
  clearTimeout(timerIdle);
  if (!sesi) return;
  timerIdle = setTimeout(() => {
    sesi = null;
    hapusCookie();
    umumkan();
  }, Math.max(0, sesi.sampai - Date.now()));
}

/** Perpanjang jendela idle setelah permintaan ber-token yang berhasil. */
function segarkan() {
  if (!sesi) return;
  sesi.sampai = Date.now() + IDLE_MS;
  tulisCookie(sesi.token);
  jadwalkanKedaluwarsa();
}

export async function masuk(kunci) {
  const hasil = await kirim({ action: 'login', key: String(kunci || '').trim() });
  pasangSesi(hasil, hasil.token);
  return sesi;
}

export async function keluar() {
  const token = sesi?.token;
  sesi = null;
  clearTimeout(timerIdle);
  hapusCookie();
  umumkan();
  // Cabut juga di server; kegagalan jaringan tidak boleh membatalkan logout
  // yang sudah terjadi di sisi pengguna.
  if (token) await kirim({ action: 'logout', token }).catch(() => {});
}

/**
 * Pulihkan sesi dari cookie saat halaman dimuat. Token diverifikasi ke GAS —
 * cookie yang masih ada belum tentu masih sah di server.
 */
export async function pulihkanSesi() {
  const token = bacaCookie();
  if (!token) return null;
  try {
    const hasil = await kirim({ action: 'session', token }, { timeout: 12000 });
    pasangSesi(hasil, token);
    return sesi;
  } catch (error) {
    hapusCookie();
    return null;
  }
}

/**
 * Permintaan yang membutuhkan sesi. Menyisipkan token, memperpanjang idle saat
 * berhasil, dan menutup sesi lokal begitu server bilang sesinya sudah mati.
 */
export async function kirimTerautentikasi(body) {
  if (!sesi) throw new Error('Belum masuk.');
  try {
    const hasil = await kirim({ ...body, token: sesi.token });
    segarkan();
    return hasil;
  } catch (error) {
    if (/sesi berakhir|sesi tidak aktif/i.test(error.message)) {
      sesi = null;
      clearTimeout(timerIdle);
      hapusCookie();
      umumkan();
    }
    throw error;
  }
}

/**
 * Ambil gambar ID card satu pemain (data URL). Butuh sesi admin/relawan.
 * `thumb` meminta versi kecil — dipakai untuk pratinjau di dalam kartu pemain,
 * supaya membuka satu tim tidak berarti mengunduh 8 berkas ukuran penuh.
 */
export async function ambilIdCard(playerId, { thumb = false } = {}) {
  return ambilBerkas({ kind: 'idcard', playerId, thumb });
}

/**
 * Ambil berkas privat (ID card atau foto) sebagai data URL.
 * `playerId` untuk berkas perorangan, `teamId` untuk foto bersama tim.
 */
export async function ambilBerkas({ kind = 'idcard', playerId = '', teamId = '', thumb = false } = {}) {
  const hasil = await kirimTerautentikasi({ action: 'berkas', kind, playerId, teamId, thumb });
  return hasil.dataUrl;
}

/**
 * Simpan SELURUH roster satu tim: `roster` adalah daftar pemain yang DIINGINKAN,
 * berurutan. Menyunting, menambah, menghapus, dan mengurutkan ulang semuanya
 * lewat jalur ini — pemain tanpa `playerId` dianggap baru, dan pemain lama yang
 * tidak ada di daftar dianggap dihapus.
 *
 * Satu permintaan, bukan satu per pemain: tiap panggilan Apps Script memakan
 * beberapa detik.
 */
/**
 * Kode yang sedang aktif — SATU baris per kontingen — beserta kontak PIC-nya,
 * berapa tim yang dicakupnya, dan cabor apa saja. HANYA admin; GAS yang
 * menegakkannya.
 *
 * Data ini TIDAK ada di payload publik: Kode Tim dan No HP sengaja tidak pernah
 * dikirim di doGet, jadi satu-satunya jalannya adalah permintaan ber-token ini.
 *
 * Kontingen yang belum punya kode tidak muncul: daftar ini menjawab "kode apa
 * yang sedang beredar", bukan "siapa saja pesertanya".
 */
export async function ambilKodeTim() {
  const hasil = await kirimTerautentikasi({ action: 'kodeTim' });
  return hasil.kode || [];
}

/**
 * Buat Kode Tim baru yang berlaku terbatas. HANYA admin — GAS menegakkannya.
 *
 * Satuannya KONTINGEN, bukan tim: satu kontingen punya satu PIC yang mengurus
 * seluruh timnya di semua cabor, jadi memberinya satu kode per tim hanya
 * memperbanyak yang harus dibagikan tanpa mempersempit apa pun.
 *
 * Membuat ulang MENGGANTI kode sebelumnya: satu kontingen selalu punya paling
 * banyak satu kode hidup.
 *
 * `teamId` boleh dipakai sebagai ganti nama kontingen — layar detail tim tahu
 * timnya, dan GAS yang menyimpulkan kontingennya.
 */
export async function buatKodeTim({ kontingen = '', teamId = '' }, jenis = JENIS_KODE.UNGGAH) {
  const hasil = await kirimTerautentikasi({ action: 'buatKode', kontingen, teamId, jenis });
  return {
    kontingen: hasil.kontingen || kontingen,
    kode: hasil.kode || '',
    jenis: hasil.jenis || JENIS_KODE.UNGGAH,
    sampai: Number(hasil.sampai || 0),
  };
}

/**
 * Buat kode untuk SELURUH kontingen sekaligus. HANYA admin.
 *
 * Dipakai saat pengumpulan dibuka: tanpa ini panitia menekan tombol yang sama
 * sebanyak jumlah kontingen. Kontingen yang sudah punya kode hidup ikut
 * diperbarui — memang itu maksudnya: satu gelombang kode dengan masa berlaku
 * seragam, sehingga tidak ada kode yang mati lebih dulu dari yang lain.
 */
export async function buatKodeSemua(jenis = JENIS_KODE.UNGGAH) {
  const hasil = await kirimTerautentikasi({ action: 'buatKodeSemua', jenis });
  return { dibuat: Number(hasil.dibuat || 0), kode: hasil.kode || [] };
}

/**
 * Kunci / buka kunci roster satu cabor. HANYA admin — GAS yang menegakkannya.
 * Efeknya: Kode Tim berhenti berlaku untuk mengunggah. Admin tidak terpengaruh.
 */
export async function aturKunciRoster(game, kunci) {
  const hasil = await kirimTerautentikasi({ action: 'lockRoster', game, kunci });
  return hasil.terkunciSemua || {};
}

/**
 * Hapus satu tim beserta berkasnya. HANYA admin — GAS yang menegakkannya.
 * Konfirmasinya di layar (dialog), bukan lewat kiriman: yang menahan
 * penghapusan sembarangan adalah sesi admin.
 */
/**
 * Kontak PIC kontingen & PIC tim beserta nomornya. HANYA admin.
 *
 * Nomor telepon tidak pernah ikut payload publik, jadi layar notifikasi harus
 * memintanya lewat jalur ber-token ini — sekali saat layarnya dibuka.
 */
export async function ambilKontak() {
  const hasil = await kirimTerautentikasi({ action: 'kontak' });
  return hasil.kontak || [];
}

/**
 * Buang SELURUH Kode Tim yang sedang aktif. HANYA admin.
 * Dipakai saat panitia ingin menghentikan semua akses peserta sekaligus —
 * misalnya setelah data ditulis ulang atau menjelang penutupan.
 */
export async function resetKodeTim() {
  const hasil = await kirimTerautentikasi({ action: 'resetKode' });
  return Number(hasil.dihapus || 0);
}

/**
 * Riwayat perubahan terakhir — siapa mengubah apa, kapan. HANYA admin.
 *
 * Tidak ada di payload publik dan tidak ikut cache: yang ditanyakan layar ini
 * selalu "apa yang BARU SAJA berubah", dan riwayat yang di-cache akan basi
 * tepat pada saat ia paling dibutuhkan.
 */
export async function ambilJejak({ teamId = '', batas = 0 } = {}) {
  const hasil = await kirimTerautentikasi({ action: 'jejak', teamId, batas });
  return { jejak: hasil.jejak || [], total: Number(hasil.total || 0) };
}

export async function hapusTim(teamId) {
  return kirimTerautentikasi({ action: 'hapusTim', teamId });
}

export async function simpanRoster(teamId, roster) {
  const hasil = await kirimTerautentikasi({ action: 'saveRoster', teamId, roster });
  return { roster: hasil.roster || [], jumlah: hasil.jumlah || 0 };
}
