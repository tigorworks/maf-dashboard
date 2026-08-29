# MAF 2026 — Dashboard Peserta E-Sport

Dashboard peserta lomba e-sport MAF 2026 (Road to HUT 28): daftar tim, roster
pemain, dan kelengkapan berkas tiap tim. Halaman statis — tidak ada yang perlu
dipasang untuk membukanya, cukup peramban.

> Berkas ini adalah README untuk situs yang dipublikasikan. Panduan pemasangan,
> konfigurasi, dan pengelolaan datanya dipegang panitia secara terpisah.

## Yang bisa dilihat siapa saja

Tanpa masuk sama sekali:

- **Daftar tim per cabang olahraga** — MLBB dan PUBG, dipilih di layar awal.
- **Roster tiap tim** — nama pemain, nickname, ID game, dan tahun bergabung.
- **Penanggung jawab tim** — nama PIC kontingen dan PIC/Manager tim.
- **Penanda kelengkapan** — tim yang belum memenuhi syarat ditandai di daftar,
  lengkap dengan alasannya (misalnya jumlah pemain berstatus TAD melebihi batas,
  atau ID card belum lengkap).

Pencarian di atas daftar menjangkau nama tim, kontingen, PIC, **dan nama
pemain** — mencari seorang pemain akan menemukan timnya.

## Data pribadi tidak dikirim ke peramban

NIP, nomor telepon, dan alamat email peserta **tidak pernah ikut** dikirim ke
halaman ini. Penyaringannya terjadi di server, bukan sekadar disembunyikan dari
tampilan, sehingga membuka alat pengembang peramban pun tidak akan
menampilkannya.

Foto ID card dan foto peserta disimpan privat dan hanya bisa dibuka oleh panitia
yang sudah masuk.

## Untuk panitia dan PIC tim

Tombol masuk ada di pojok kanan atas.

| Peran | Yang bisa dilakukan |
|---|---|
| **PIC tim** | Membetulkan nickname, ID game, dan server pemainnya; menambah pemain; mengunggah logo, ID card, dan foto — semuanya **hanya untuk timnya sendiri** |
| **Relawan** | Melihat ID card seluruh tim untuk keperluan verifikasi |
| **Panitia** | Seluruh pengelolaan data peserta |

PIC tim masuk memakai **Kode Tim** yang diberikan panitia. Kode itu berlaku
sementara dan berhenti berlaku dengan sendirinya; kalau sudah tidak bisa dipakai,
mintalah kode baru ke panitia.

Nama dan status kepegawaian pemain tidak bisa diubah dari sini — keduanya
mengikuti data pendaftaran resmi. Hubungi panitia kalau ada yang perlu
diperbaiki.

## Di ponsel

Tampilannya menyesuaikan layar: daftar tim berubah menjadi kartu, dan panel
detail tim menyusun ulang isinya agar roster terbaca tanpa menggulir jauh.
Sebagian besar peserta membuka dashboard ini dari ponsel, jadi tata letak
ponselnya diperlakukan sebagai tampilan utama, bukan sisa.

## Menjalankan salinan lokal

Halaman ini memakai ES module, jadi ia harus dibuka lewat HTTP — membukanya
langsung sebagai berkas (`file://`) akan diblokir peramban.

```bash
python3 -m http.server 3456
# lalu buka http://localhost:3456/
```

## Catatan teknis singkat

- Tanpa kerangka kerja dan tanpa proses build. Seluruh antarmuka dirakit dari
  custom element dengan Shadow DOM.
- Satu-satunya kebutuhan dari luar adalah Google Fonts; sisanya berkas lokal.
- Membutuhkan JavaScript aktif dan peramban modern (Chrome, Safari, Firefox,
  atau Edge versi mutakhir).
