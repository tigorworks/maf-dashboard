# js/vendor — pustaka pihak ketiga

Satu-satunya dependensi proyek ini. Ditaruh apa adanya (tidak diubah sebaris
pun) supaya bisa diganti versi baru dengan menimpa berkasnya, dan supaya
kewajiban LGPL terpenuhi tanpa perlu memikirkan apa pun lagi.

## libheif-bundle.mjs

| | |
|---|---|
| Pustaka | [libheif-js](https://github.com/catdad-experiments/libheif-js) 1.19.8 (Emscripten build dari libheif) |
| Lisensi | **LGPL-3.0** — teks lengkap di `LICENSE-libheif.txt` |
| Asal | `npm:libheif-js@1.19.8` → `libheif-wasm/libheif-bundle.mjs` |
| Ukuran | ~1,4 MB |

**Kenapa ada.** Mendekode HEIC/HEIF — format bawaan kamera iPhone. Hanya Safari
yang bisa mendekodenya sendiri; Chrome, Firefox, dan Edge tidak. Tanpa ini,
peserta yang mengunggah foto ID card langsung dari iPhone lewat peramban selain
Safari selalu gagal.

**Kenapa versi `-bundle.mjs`, bukan `libheif.js` + `libheif.wasm` yang 25% lebih
kecil.** Yang bundle sudah memuat WASM-nya di dalam dirinya sendiri dan berupa ES
module asli, jadi bisa dipanggil dengan `await import()` biasa — tanpa tag
`<script>` suntikan dan tanpa menebak-nebak dari mana `.wasm` harus diunduh
(varian terpisah mencarinya relatif terhadap URL skripnya). Proyek ini tidak
punya build step; kesederhanaan pemuatan lebih berharga daripada 338 KB.

**Kenapa dimuat malas (`await import()` di dalam fungsi, bukan di kepala
berkas).** 1,4 MB tidak boleh dibebankan pada semua orang untuk masalah yang
hanya dialami sebagian. Ia baru diunduh saat ada berkas HEIC yang benar-benar
dipilih — unggahan JPG/PNG biasa tidak menyentuhnya sama sekali.
