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

/**
 * Jenis berkas yang diterima GAS. Harus sama dengan CONFIG.ALLOWED_MIME.
 *
 * Ini soal apa yang DIKIRIM, bukan apa yang boleh dipilih peserta — lihat
 * PICKER_TYPES di bawah. Gambar selalu di-encode ulang jadi WebP/JPEG sebelum
 * dikirim, jadi format aslinya tidak pernah sampai ke GAS.
 */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Yang ditawarkan kotak pilih berkas — SENGAJA lebih luas dari ACCEPTED_TYPES.
 *
 * Semua format gambar populer disebut di sini, bukan hanya yang diterima GAS,
 * karena dua hal berbeda: apa yang boleh DIPILIH orang, dan apa yang DIKIRIM.
 * Yang dikirim selalu WebP/JPEG hasil encode ulang, apa pun yang dipilih.
 *
 * Format yang tidak disebut di sini tampil KELABU dan tidak bisa dipilih di
 * kotak berkas — dukungan yang tidak pernah terjangkau. Karena itu daftarnya
 * memuat juga yang butuh usaha ekstra untuk didekode (HEIC/HEIF lewat WASM,
 * lihat dekodeGambar).
 */
export const PICKER_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/tiff',
];

/**
 * Kecilkan gambar ke sisi terpanjang MAX_SIDE dan encode ulang.
 * Mengembalikan { mimeType, base64, bytes }.
 */
export async function compressImage(file) {
  // Penjaga ini SENGAJA meloloskan berkas yang `type`-nya kosong.
  // Sebagian sistem tidak melaporkan MIME untuk HEIC sama sekali — menolak
  // string kosong di sini berarti menolak foto iPhone sebelum dekodernya
  // sempat dicoba. Yang benar-benar memutuskan gambar atau bukan adalah
  // dekodeGambar: berkas yang bukan gambar akan gagal di ketiga lapisannya
  // dan pesannya datang dari sana.
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar.');
  }

  const { sumber, lebar, tinggi, lepas } = await dekodeGambar(file);
  try {
    const skala = Math.min(1, MAX_SIDE / Math.max(lebar, tinggi));
    const width = Math.max(1, Math.round(lebar * skala));
    const height = Math.max(1, Math.round(tinggi * skala));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(sumber, 0, 0, width, height);

    // WebP dipilih karena mendukung transparansi (logo sering PNG transparan)
    // sekaligus jauh lebih kecil. Kalau browser tidak mendukung, jatuh ke JPEG.
    let blob = await toBlob(canvas, 'image/webp', QUALITY);
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(canvas, 'image/jpeg', QUALITY);
    }
    if (!blob) throw new Error('Gagal memproses gambar.');

    return { mimeType: blob.type, base64: await toBase64(blob), bytes: blob.size };
  } finally {
    // Dilepas SETELAH drawImage — melepasnya lebih awal membuat sumbernya
    // kosong justru pada saat ia dibutuhkan.
    lepas();
  }
}

/**
 * Dekode gambar jadi sesuatu yang bisa digambar ke canvas.
 *
 * DUA jalan, dan yang kedua bukan cadangan basa-basi.
 *
 * `createImageBitmap` tidak bisa mendekode HEIC/HEIF — format bawaan kamera
 * iPhone — dan melempar "The source image could not be decoded". Yang membuat
 * kegagalan itu membingungkan: PRATINJAUNYA tetap tampil di layar, karena
 * pratinjau memakai <img src=blob:> yang didekode oleh renderer peramban, dan
 * Safari mendekode HEIC dengan baik. Jadi orang melihat gambarnya jelas-jelas
 * ada, lalu unggahannya berkata gagal.
 *
 * Maka <img> dipakai sebagai jalan kedua: apa pun yang bisa DITAMPILKAN
 * peramban kini bisa pula dikirim, karena kita toh meng-encode ulang jadi
 * WebP/JPEG sesudahnya. Berkas HEIC yang tadinya selalu gagal jadi terkirim
 * sebagai JPEG tanpa peserta perlu mengubah apa pun.
 */
async function dekodeGambar(file) {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      sumber: bitmap,
      lebar: bitmap.width,
      tinggi: bitmap.height,
      lepas: () => bitmap.close?.(),
    };
  } catch (error) {
    // Sengaja ditelan: kegagalan di sini bukan jawaban akhir, hanya tanda
    // bahwa jalan kedua yang harus dicoba.
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await muatGambar(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('ukuran kosong');
    return {
      sumber: img,
      lebar: img.naturalWidth,
      tinggi: img.naturalHeight,
      lepas: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
  }

  // Jalan KETIGA: dekode sendiri dengan libheif (WASM). Hanya untuk HEIC/HEIF,
  // dan hanya sesudah kedua jalan bawaan peramban menyerah — di Safari, HEIC
  // sudah selesai di jalan kedua dan 1,4 MB itu tidak pernah diunduh.
  if (await mungkinHeif(file)) {
    const kanvas = await dekodeHeif(file);
    return {
      sumber: kanvas,
      lebar: kanvas.width,
      tinggi: kanvas.height,
      // Kanvas tidak memegang sumber daya yang perlu dilepas manual; ia
      // dibuang pemulung memori begitu tidak dirujuk lagi.
      lepas: () => {},
    };
  }

  throw new Error(
    'Gambar ini tidak bisa dibaca. Coba kirim ulang sebagai JPG atau PNG. ' +
      'Kalau berkasnya hasil unduhan atau kiriman, mungkin belum terunduh utuh — ' +
      'unduh ulang lalu coba lagi.'
  );
}

/**
 * Apakah berkas ini HEIC/HEIF? Dilihat dari ISINYA, bukan dari `file.type`.
 *
 * `file.type` tidak bisa dipercaya untuk format ini: sebagian sistem melaporkan
 * string kosong, sebagian menyebut `image/heic`, sebagian `image/heif`, dan
 * berkas yang namanya diubah jadi `.jpg` tetap melaporkan `image/jpeg` padahal
 * isinya HEIC. Yang menentukan harus isi berkasnya.
 *
 * HEIF adalah wadah ISO-BMFF: 4 byte panjang, lalu 'ftyp', lalu kode merek di
 * offset 8. Merek-merek di bawah ini yang menandai turunan HEIF/HEIC.
 */
async function mungkinHeif(file) {
  try {
    const kepala = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (kepala.length < 12) return false;
    const ftyp = String.fromCharCode(kepala[4], kepala[5], kepala[6], kepala[7]);
    if (ftyp !== 'ftyp') return false;
    const merek = String.fromCharCode(kepala[8], kepala[9], kepala[10], kepala[11]);
    return ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']
      .indexOf(merek) !== -1;
  } catch (error) {
    // Berkas tidak bisa dibaca sepotong pun — bukan urusan pengendus format.
    return false;
  }
}

/** Dekode HEIC/HEIF jadi <canvas> berukuran asli. */
async function dekodeHeif(file) {
  let libheif;
  try {
    // import() DI DALAM fungsi, bukan di kepala berkas: inilah yang membuat
    // 1,4 MB hanya diunduh oleh orang yang benar-benar mengunggah HEIC.
    const modul = await import('../vendor/libheif-bundle.mjs');
    libheif = await modul.default();
  } catch (error) {
    throw new Error(
      'Foto ini format HEIC (foto iPhone) dan pembacanya gagal dimuat. ' +
        'Periksa koneksi lalu coba lagi, atau kirim ulang berkasnya sebagai JPG.'
    );
  }

  try {
    const gambar = new libheif.HeifDecoder().decode(
      new Uint8Array(await file.arrayBuffer())
    );
    if (!gambar || !gambar.length) throw new Error('tidak ada gambar di dalam berkas');

    // Berkas HEIC bisa memuat beberapa gambar (mis. burst atau Live Photo);
    // yang pertama adalah gambar utamanya.
    const utama = gambar[0];
    const lebar = utama.get_width();
    const tinggi = utama.get_height();

    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const konteks = kanvas.getContext('2d');
    const data = konteks.createImageData(lebar, tinggi);

    await new Promise((selesai, tolak) => {
      utama.display(data, (hasil) =>
        hasil ? selesai(hasil) : tolak(new Error('penyalinan piksel gagal'))
      );
    });

    konteks.putImageData(data, 0, 0);
    return kanvas;
  } catch (error) {
    throw new Error(
      'Foto HEIC ini tidak bisa dibaca — berkasnya mungkin tidak utuh. ' +
        'Kirim ulang berkasnya, atau simpan sebagai JPG lalu unggah lagi.'
    );
  }
}

function muatGambar(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('gagal dimuat'));
    img.src = url;
  });
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
