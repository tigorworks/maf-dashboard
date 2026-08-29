/**
 * Unggahan logo & ID card tim ke Google Apps Script.
 *
 * Dua hal yang perlu diketahui saat membaca berkas ini:
 *
 * 1. Body dikirim sebagai `text/plain`, bukan `application/json`. Ini disengaja:
 *    `application/json` memicu CORS preflight (OPTIONS), dan Apps Script tidak
 *    bisa melayani OPTIONS sehingga unggahan akan selalu gagal.
 *
 * 2. Gambar dikecilkan di browser SEBELUM dikirim. Foto dari ponsel biasanya
 *    3–8 MB; tanpa dikompres, unggahan lambat dan sering ditolak batas ukuran.
 */

const MAX_SIDE = 1024;
const QUALITY = 0.85;

/** Jenis berkas yang diterima GAS. Harus sama dengan CONFIG.ALLOWED_MIME. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Kecilkan gambar ke sisi terpanjang MAX_SIDE dan encode ulang.
 * Mengembalikan { mimeType, base64, bytes }.
 */
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar (JPG, PNG, atau WebP).');
  }

  const bitmap = await createImageBitmap(file);
  const skala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * skala));
  const height = Math.max(1, Math.round(bitmap.height * skala));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // WebP dipilih karena mendukung transparansi (logo sering PNG transparan)
  // sekaligus jauh lebih kecil. Kalau browser tidak mendukung, jatuh ke JPEG.
  let blob = await toBlob(canvas, 'image/webp', QUALITY);
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', QUALITY);
  }
  if (!blob) throw new Error('Gagal memproses gambar.');

  return { mimeType: blob.type, base64: await toBase64(blob), bytes: blob.size };
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    // hasilnya "data:<mime>;base64,<data>" — ambil bagian setelah koma.
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

/**
 * Kirim berkas ke GAS.
 *
 * Logo dikunci ke `teamId`; ID card dikunci ke `playerId` karena diunggah PER
 * ORANG. Foto boleh keduanya: dengan `playerId` berarti foto pemain, tanpa itu
 * berarti foto bersama tim. Wewenangnya boleh datang dari salah satu dari dua arah:
 *   - `token` : sesi yang sedang berjalan — admin, atau PIC tim yang sudah
 *               masuk dengan Kode Tim-nya. Kode itu sendiri TIDAK ikut dikirim:
 *               ia kunci login, bukan kata sandi yang ditempel tiap unggahan.
 * GAS yang memutuskan, bukan berkas ini — di sana relawan juga ditolak.
 *
 * @param {{endpoint:string, teamId?:string, playerId?:string,
 *          token?:string, kind:'logo'|'idcard', file:File, maxBytes:number}} opts
 * @returns {Promise<{kind:string, url:string|null}>}
 */
export async function uploadTeamFile({ endpoint, teamId, playerId, token, kind, file, maxBytes }) {
  if (!endpoint) throw new Error('Endpoint unggahan belum dikonfigurasi.');
  if (!token) throw new Error('Masuk dulu untuk mengunggah berkas.');
  if (kind === 'idcard' && !playerId) throw new Error('Pemain belum dipilih.');

  const { mimeType, base64, bytes } = await compressImage(file);
  if (maxBytes && bytes > maxBytes) {
    throw new Error(`Gambar masih terlalu besar (${Math.round(bytes / 1024)} KB). Coba gambar lain.`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    // text/plain menghindari preflight — lihat catatan di kepala berkas.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      teamId,
      playerId,
      token: token || '',
      kind,
      mimeType,
      filename: file.name,
      data: base64,
    }),
  });

  if (!response.ok) throw new Error(`Server menolak unggahan (HTTP ${response.status}).`);

  const hasil = await response.json();
  if (!hasil.ok) throw new Error(hasil.error || 'Unggahan gagal.');
  return hasil;
}
