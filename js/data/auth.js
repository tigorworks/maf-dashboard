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
import { GAS_URL } from './source.js';

const COOKIE = 'maf_sesi';
const IDLE_MS = 3 * 60 * 60 * 1000; // samakan dengan CONFIG.SESI_IDLE_MS di Code.gs
const TIMEOUT = 25000;

export const PERAN = { ADMIN: 'admin', RELAWAN: 'relawan' };

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

/** Admin maupun relawan sama-sama boleh melihat ID card. */
export function bolehLihatIdCard() {
  return Boolean(sesi);
}

function pasangSesi(data, token) {
  sesi = { nama: data.nama, peran: data.peran, token, sampai: Date.now() + IDLE_MS };
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
 * Kode Tim beserta kontak PIC-nya. HANYA admin — GAS yang menegakkannya.
 *
 * Data ini TIDAK ada di payload publik: Kode Tim dan No HP sengaja tidak pernah
 * dikirim di doGet, jadi satu-satunya jalannya adalah permintaan ber-token ini.
 */
export async function ambilKodeTim({ game = '', teamId = '' } = {}) {
  const hasil = await kirimTerautentikasi({ action: 'kodeTim', game, teamId });
  return hasil.kode || [];
}

/**
 * Kunci / buka kunci roster satu cabor. HANYA admin — GAS yang menegakkannya.
 * Efeknya: Kode Tim berhenti berlaku untuk mengunggah. Admin tidak terpengaruh.
 */
export async function aturKunciRoster(game, kunci) {
  const hasil = await kirimTerautentikasi({ action: 'lockRoster', game, kunci });
  return hasil.terkunciSemua || {};
}

export async function simpanRoster(teamId, roster) {
  const hasil = await kirimTerautentikasi({ action: 'saveRoster', teamId, roster });
  return { roster: hasil.roster || [], jumlah: hasil.jumlah || 0 };
}
