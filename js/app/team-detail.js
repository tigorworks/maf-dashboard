/**
 * <team-detail> — profil tim sebagai satu "lembar tim" penuh.
 *
 * Prinsip tata letaknya: roster terbesar di data ini 8 pemain, jadi lineup
 * ditata 4 kolom sehingga tim manapun selesai dalam 2 baris dan muat sekali
 * pandang tanpa menggulir — itu sebabnya PIC/Manager dipadatkan jadi pita
 * horizontal, bukan kolom samping yang memakan lebar roster.
 *
 * Urutan bacanya tetap: identitas tim → PIC/Manager → roster.
 * Kartu pemain sengaja tidak berbentuk label-nilai: identitasnya dipimpin
 * nickname (nama yang dipakai di dalam game), dengan NIP/ID game turun jadi
 * baris kecil berikon.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import {
  esc, formatDate, hueOf, initials, normalKontingen, num, sisaWaktu, year,
} from '../core/format.js';
import { GAME_META } from '../data/source.js';
import {
  applyPlayerPatch, applyUpload, buangTim, caborTerkunci, gantiRoster, selectTeam, store,
} from '../data/app-state.js';
import { ACCEPTED_TYPES, uploadTeamFile } from '../data/upload.js';
import {
  adalahAdmin, adalahTim, ambilIdCard, ambilKodeTim, bolehLihatIdCard,
  ambilJejak, bolehHapusTim, bolehSuntingTim, bolehUnggahTim, buatKodeTim, hapusTim,
  JENIS_KODE, namaJenis, onAuth, sesiSekarang, simpanRoster, UMUR_KODE,
} from '../data/auth.js';
import { jamJejak, jarakWaktu, jejakMembuang, perHari } from '../data/jejak.js';
import { periksaTim } from '../data/rules.js';
import { periksaNick } from '../data/nick.js';

const styles = css`
  /* Halaman penuh, bukan dialog. Verifikasi satu tim adalah pekerjaan yang
     dikerjakan lama; menahannya di dalam popup berarti daftar di belakangnya
     ikut mengunci scroll halaman tanpa memberi manfaat apa pun. */
  :host {
    display: block;
    min-height: calc(100vh - var(--header-h));
    background: var(--bg);
  }

  .panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    /* Latar tiap pita membentang penuh, tapi ISINYA dikunci ke lebar baca yang
       sama dengan daftar tim. Tanpa ini, di layar 1500 px+ nama dan angka
       terlempar ke dua ujung layar. */
    --tepi: max(var(--sp-6), calc((100% - var(--maxw)) / 2));
  }
  header,
  .pj,
  .roster,
  .berkas {
    padding-left: var(--tepi);
    padding-right: var(--tepi);
  }

  .kembali {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 8px var(--sp-4) 8px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .kembali:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .kembali svg {
    width: 15px;
    height: 15px;
  }

  /* ================= kepala: identitas tim ================= */
  /* Satu baris saja: tombol kembali, identitas tim, penanda mode. Sebelumnya
     ini dua band terpisah dengan judul sebesar 3xl — sendirian sudah memakan
     seperempat layar, padahal halaman penuh justru dibuat agar isinya muat
     tanpa menggulir. */
  header {
    position: sticky;
    top: var(--header-h);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-6);
    background: linear-gradient(120deg, color-mix(in srgb, var(--tone) 20%, var(--header-bg)), var(--header-bg) 62%);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
  }
  /* Tombol masuk mode ubah, sejajar dengan penanda mode. */
  .ubah {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: none;
    padding: 7px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .ubah:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .ubah svg {
    width: 14px;
    height: 14px;
  }
  .mode-tag.sunting {
    color: #10203f;
    background: var(--gold, var(--accent));
  }

  /* Bilah simpan: menempel di dasar layar selama mode ubah, supaya tombolnya
     tetap terjangkau saat roster panjang digulir. */
  .putar {
    flex: none;
    width: 15px;
    height: 15px;
    margin-top: 1px;
    border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: berputar 0.7s linear infinite;
  }
  @keyframes berputar {
    to {
      transform: rotate(360deg);
    }
  }
  /* Hormati pengguna yang mematikan animasi: penandanya tetap ada, hanya diam. */
  @media (prefers-reduced-motion: reduce) {
    .putar {
      animation: none;
    }
  }
  .bilah-simpan {
    position: sticky;
    bottom: 0;
    z-index: 8;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--tepi);
    background: var(--header-bg);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--border-strong);
  }
  .bilah-simpan.mengirim {
    border-top-color: var(--accent);
  }
  .bilah-ket {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bilah-ket b {
    color: var(--text);
  }
  .bilah-ket i.gagal {
    font-style: normal;
    font-weight: 700;
    color: var(--peringatan);
  }
  /* Menempel di dasar layar. Daftar 8 pemain mendorong tombol ini keluar
     layar, padahal ia satu-satunya jalan menyelesaikan unggahan. */
  .bilah-berkas {
    margin-top: var(--sp-4);
  }
  .bilah-berkas.mengirim .bilah-ket {
    flex: none;
    max-width: 46%;
  }

  /* Batang kemajuan. Unggahan ke Apps Script memakan beberapa detik PER
     berkas; tanpa sesuatu yang bergerak, layar terbaca seperti menggantung. */
  .kemajuan {
    flex: 1;
    min-width: 120px;
    height: 8px;
    background: var(--surface-inset);
    border-radius: var(--r-pill);
    overflow: hidden;
  }
  .kemajuan-isi {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--gold, var(--accent)), var(--game-mlbb));
    border-radius: inherit;
    transition: width 260ms var(--ease);
  }
  /* Garis bergerak di ujung batang: berkas yang SEDANG dikirim belum menambah
     persentase, jadi tanpa ini batangnya diam selama beberapa detik. */
  .kemajuan-isi::after {
    content: '';
    display: block;
    height: 100%;
    margin-left: auto;
    width: 28px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55));
    animation: geser 900ms linear infinite;
  }
  @keyframes geser {
    0% {
      transform: translateX(-14px);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translateX(14px);
      opacity: 0;
    }
  }
  .kemajuan-angka {
    flex: none;
    min-width: 44px;
    text-align: right;
    font-size: var(--fs-sm);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  /* Berkas yang sedang dikirim: berdenyut, supaya terlihat baris mana yang
     sedang diproses tanpa perlu membaca teksnya. */
  .pratinjau-baris.sedang {
    border-color: var(--gold, var(--accent));
    animation: denyut 1s ease-in-out infinite;
  }
  @keyframes denyut {
    50% {
      opacity: 0.45;
    }
  }
  .bilah-simpan button {
    flex: none;
    height: 38px;
    padding: 0 var(--sp-5);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .bilah-simpan button.utama {
    color: #10203f;
    background: var(--gold, var(--accent));
    border-color: transparent;
  }
  .bilah-simpan button:disabled {
    opacity: 0.55;
    cursor: progress;
  }

  .mode-tag {
    flex: none;
    padding: 5px 12px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    background: var(--surface-inset);
    border-radius: var(--r-pill);
  }
  .crest {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    font-size: 15px;
    font-weight: 800;
    color: hsl(var(--hue) 88% 93%);
    background: linear-gradient(140deg, hsl(var(--hue) 66% 46%), hsl(var(--hue) 70% 30%));
    border-radius: var(--r-md);
    box-shadow: var(--shadow-md);
  }
  .head-body {
    flex: 1;
    min-width: 0;
  }
  /* Kolom nama tim menggantikan judul di tempat yang sama, dan meniru
     bentuknya: ukuran dan tebal huruf yang sama, hanya diberi garis bawah dan
     latar tipis supaya jelas ia bisa diketik. Kolom yang tampak berbeda dari
     judul yang digantikannya membuat kepala halaman seakan bergeser saat mode
     ubah dinyalakan. */
  .ubah-nama {
    width: 100%;
    padding: 2px var(--sp-2);
    font: inherit;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.015em;
    color: var(--text);
    background: var(--surface-inset);
    border: 1px solid var(--border-strong, var(--border));
    border-radius: var(--r-sm);
    outline: 0;
  }
  .ubah-nama:focus {
    border-color: var(--accent);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .sub {
    margin: 1px 0 0;
    font-size: var(--fs-xs);
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  .game-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: none;
    padding: 7px 15px 7px 8px;
    font-size: var(--fs-md);
    font-weight: 800;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
    border-radius: var(--r-pill);
  }
  .game-tag img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
  .body {
    flex: 1;
    min-height: 0;
  }

  /* ================= pita status aturan ================= */
  .aturan {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
    padding: var(--sp-3) var(--tepi);
    font-size: var(--fs-sm);
    color: var(--peringatan);
    background: color-mix(in srgb, var(--peringatan) 10%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--peringatan) 26%, transparent);
  }
  .aturan svg {
    flex: none;
    width: 17px;
    height: 17px;
  }
  .aturan .judul {
    font-weight: 800;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .aturan .daftar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    min-width: 0;
  }
  .aturan .butir {
    padding: 2px 10px;
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text);
    background: color-mix(in srgb, var(--peringatan) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--peringatan) 32%, transparent);
    border-radius: var(--r-pill);
  }
  .aturan .ket {
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }
  /* Hijau, dan tetap memakai ikon centang — supaya bedanya tidak hanya warna. */
  .aturan.lengkap {
    color: #45c47a;
    background: rgba(69, 196, 122, 0.1);
    border-bottom-color: rgba(69, 196, 122, 0.26);
  }

  /* ================= penanggung jawab ================= */
  .pj {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;
    gap: var(--sp-5);
    padding: var(--sp-4) var(--tepi);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .pj-grup h3 {
    margin: 0 0 var(--sp-2);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .pj-daftar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-5);
  }
  .pj-orang {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
  }
  .pj-ava {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    font-size: 11px;
    font-weight: 800;
    color: hsl(var(--hue) 88% 94%);
    background: linear-gradient(145deg, hsl(var(--hue) 62% 48%), hsl(var(--hue) 66% 32%));
    border-radius: var(--r-pill);
  }
  .pj-teks {
    min-width: 0;
    font-size: var(--fs-md);
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .pj-teks small {
    display: block;
    margin-top: 1px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  /* Satu baris memuat semuanya: kode, tombolnya, sisa waktu, dan tombol buat
     ulang. Sebelumnya kelimanya menumpuk jadi lima baris dan blok ini memakan
     lebih banyak ruang daripada seluruh daftar penanggung jawab di sebelahnya —
     padahal isinya satu nilai pendek.
     Dibungkus (wrap) supaya di layar sempit ia turun dengan rapi, bukan
     menembus tepi. */
  .kode-baris {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .kode-baris .kode-nota {
    margin: 0;
  }
  /* Angka sisa waktunya sedikit lebih terang daripada kalimat di sekitarnya:
     itu satu-satunya bagian yang menentukan apakah kode ini masih layak
     dibagikan. */
  /* Penanda jenis: kecil, tapi ia satu-satunya yang membedakan dua kode yang
     bentuknya persis sama. */
  .kode-jenis {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--brand-orange);
    background: color-mix(in srgb, var(--brand-orange) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-orange) 36%, transparent);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .kode-baris .kode-nota b {
    color: var(--text-muted);
  }
  .kode-baris .kode-buat {
    margin-top: 0;
    height: 30px;
  }
  /* Seukuran nama di kelompok sebelahnya (.pj-teks), bukan lebih besar:
     kode ini bukan informasi yang dibaca terus-menerus — ia diminta sekali
     lalu disalin. Menonjolkannya justru membuatnya lebih sering terekspos. */
  .kode-nilai {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }
  /* Kode yang sedang terbuka memakai oranye, sama dengan dialog di daftar tim.
     Emas di dashboard ini sudah berarti "aksi" — tombol, tautan, sorotan
     pencarian — sedangkan kode adalah NILAI yang disalin, bukan sesuatu yang
     ditekan. Satu warna khusus membuatnya langsung terpisah dari sekitarnya. */
  .kode-nilai.terbuka {
    color: var(--brand-orange);
  }
  .kode-mata {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    color: var(--text-faint);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .kode-mata:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
  }
  .kode-mata:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .kode-mata svg {
    width: 15px;
    height: 15px;
  }
  .kode-salin {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    color: var(--text-faint);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .kode-salin:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .kode-salin.selesai {
    color: #45c47a;
    border-color: #45c47a;
  }
  .kode-salin svg {
    width: 14px;
    height: 14px;
  }
  .kode-baris {
    min-height: 30px;
  }
  .kode-nota {
    margin: 3px 0 0;
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .kode-buat {
    margin-top: var(--sp-2);
    height: 32px;
    padding: 0 var(--sp-3);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--accent);
    background: none;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    border-radius: var(--r-sm);
  }
  .kode-buat:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  /* Pilihan terluas dibedakan WARNA, bukan hanya urutan: tiga tombol seragam
     berdampingan mengundang tekanan berdasarkan posisi, dan yang di ujung
     kebetulan yang paling berkuasa. */
  .kode-buat.bahaya {
    color: var(--peringatan);
    border-color: color-mix(in srgb, var(--peringatan) 45%, transparent);
  }
  .kode-buat.bahaya:hover {
    color: #fff;
    background: var(--peringatan);
    border-color: var(--peringatan);
  }
  .pj-kosong {
    margin: 0;
    padding: 7px 0;
    font-size: var(--fs-sm);
    font-style: italic;
    color: var(--text-faint);
  }

  /* Logo menggantikan monogram begitu tim mengunggahnya. */
  .crest img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
  }

  /* ================= panel berkas ================= */
  .berkas {
    padding: var(--sp-4) var(--sp-6);
    border-bottom: 1px solid var(--border);
  }
  /* --- layar "Unggah berkas" ---
     Ditata padat seperti daftar kontak: satu baris per orang, tinggi tetap,
     aksi rata kanan. Versi sebelumnya memakai kartu besar per pemain dan satu
     tim 8 orang langsung memenuhi dua layar penuh untuk pekerjaan yang
     sebetulnya cuma "tekan unggah". */
  .mode-unggah .berkas {
    padding: var(--sp-5) var(--sp-6) var(--sp-6);
    border-bottom: 0;
  }

  /* Kode tim dan logo berdampingan dalam satu pita, bukan dua blok bertingkat. */
  .unggah-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--sp-4);
    padding-bottom: var(--sp-4);
    margin-bottom: var(--sp-4);
    border-bottom: 1px solid var(--border);
  }
  .kode-label {
    display: block;
    margin-bottom: 6px;
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .kode-blok.admin .kode-label {
    color: var(--brand-gold, var(--accent));
  }
  .kode-nota {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  .logo-mini {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .logo-thumb {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-faint);
    background: var(--surface);
    border-radius: var(--r-xs);
    overflow: hidden;
  }
  .logo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .logo-teks {
    font-size: var(--fs-sm);
    font-weight: 700;
    white-space: nowrap;
  }
  .logo-teks small {
    display: block;
    margin-top: 1px;
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
  }
  .logo-teks em.opsional {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 7px;
    font-size: 9px;
    font-style: normal;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    background: var(--surface-inset);
    border-radius: var(--r-pill);
    vertical-align: middle;
  }
  .logo-teks em {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 7px;
    font-size: 9px;
    font-style: normal;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffb4b4;
    background: rgba(255, 120, 120, 0.16);
    border-radius: var(--r-pill);
    vertical-align: middle;
  }
  /* Logo wajib: selama belum ada, kotaknya diberi tepi peringatan supaya
     jelas ia yang menghalangi, bukan tombol ID card yang rusak. */
  /* Kartu logo/foto bersama ikut berdenyut saat berkasnya yang sedang dikirim —
     pratinjaunya ada di sini, bukan di baris pemain, jadi tanpa ini pengiriman
     logo berjalan tanpa penanda apa pun. */
  .logo-mini.sedang {
    border-color: var(--gold, var(--accent));
    animation: denyut 1s ease-in-out infinite;
  }
  .logo-mini.gagal {
    border-color: var(--peringatan);
  }
  .logo-mini.wajib {
    border-color: rgba(255, 120, 120, 0.45);
    background: color-mix(in srgb, #ff7878 8%, var(--surface-2));
  }
  /* Pesan hasil aksi. Sebelumnya <p> polos tanpa satu pun aturan CSS — pesan
     sepenting "Kode tim salah" praktis tidak terlihat. Kini berupa bilah
     berwarna, dan ditempatkan DI ATAS daftar supaya berdampingan dengan tombol
     yang baru ditekan, bukan di bawah tujuh baris. */
  .pesan {
    display: none;
    align-items: flex-start;
    gap: var(--sp-2);
    margin: 0 0 var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 600;
    line-height: 1.45;
    border-radius: var(--r-sm);
  }
  .pesan.galat,
  .pesan.sukses,
  .pesan.sibuk {
    display: flex;
  }
  .pesan svg {
    flex: none;
    width: 17px;
    height: 17px;
    margin-top: 1px;
  }
  .pesan.galat {
    color: var(--peringatan);
    background: color-mix(in srgb, var(--peringatan) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--peringatan) 40%, transparent);
  }
  .pesan.sukses {
    color: #45c47a;
    background: rgba(69, 196, 122, 0.12);
    border: 1px solid rgba(69, 196, 122, 0.34);
  }
  .pesan.sibuk {
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
  }

  .terkunci {
    margin: 0 0 var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--fs-sm);
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px dashed var(--border-strong);
    border-radius: var(--r-sm);
  }
  .terkunci b {
    color: var(--text);
  }
  /* Pemberitahuan roster terkunci: emas, sewarna dengan gembok di halaman kode. */
  .terkunci.roster {
    color: var(--gold, var(--accent));
    background: color-mix(in srgb, var(--gold, var(--accent)) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold, var(--accent)) 32%, transparent);
    border-style: solid;
  }
  .terkunci.roster b {
    display: block;
    color: var(--text);
  }
  .daftar-unggah.terkunci {
    opacity: 0.55;
  }

  .unggah-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
    margin-bottom: var(--sp-3);
  }

  .daftar-unggah {
    display: grid;
    /* Sama seperti <main>: tanpa minmax(0, 1fr) satu baris dengan nama panjang
       melebarkan kolomnya dan isinya terpotong di layar sempit. */
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .daftar-unggah li {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    height: 58px;
    padding: 0 var(--sp-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .daftar-unggah .ava {
    display: grid;
    place-items: center;
    flex: none;
    width: 34px;
    height: 34px;
    font-size: 11px;
    font-weight: 800;
    color: hsl(var(--hue) 88% 94%);
    background: linear-gradient(145deg, hsl(var(--hue) 62% 48%), hsl(var(--hue) 66% 32%));
    border-radius: var(--r-pill);
  }
  .nama-baris {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    font-weight: 700;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nama-baris small {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--accent);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Pratinjau berkas yang baru dipilih, tepat di barisnya. */
  .pratinjau-baris {
    display: grid;
    place-items: center;
    flex: none;
    width: 52px;
    height: 34px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: var(--r-xs);
    overflow: hidden;
  }
  .pratinjau-baris.gagal {
    border-color: var(--peringatan);
  }
  .pratinjau-baris img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tanda-kecil {
    flex: none;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .daftar-unggah li.sudah .tanda-kecil {
    color: #45c47a;
  }
  /* Aturan dasar tombol unggah. Tanpa ini tombolnya jatuh ke gaya bawaan
     browser dan terbaca seperti tombol nonaktif. */
  .unggah {
    height: 36px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease),
      background var(--dur) var(--ease);
  }
  .unggah:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--surface-2);
  }
  .unggah:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  /* Selagi antrean dikirim, memilih berkas baru hanya akan membingungkan. */
  .mode-unggah.menyimpan .unggah {
    pointer-events: none;
    opacity: 0.55;
  }
  /* Yang belum punya ID card diberi warna aksi: itu pekerjaan yang tersisa.
     Yang sudah cukup tampil netral supaya tidak ikut menarik perhatian. */
  .daftar-unggah li:not(.sudah) .unggah {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .unggah.kecil {
    flex: none;
    width: auto;
    min-width: 84px;
    height: 34px;
    padding: 0 var(--sp-4);
  }

  /* Penanda status per baris. Warna mengikuti maknanya, bukan sekadar teks. */
  .tanda-kecil.dipilih {
    color: var(--accent);
  }
  .tanda-kecil.sedang {
    color: var(--brand-gold);
  }
  .tanda-kecil.gagal {
    color: var(--peringatan);
  }

  @media (max-width: 720px) {
    .unggah-bar {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
    /* Di baris sesempit ini "SUDAH/BELUM" mengalah demi nama pemain — status
       diamnya sudah terbaca dari warna barisnya. Yang sedang BERGERAK tetap
       tampil: justru saat itulah orang menunggu kabar. */
    .tanda-kecil {
      display: none;
    }
    .tanda-kecil.dipilih,
    .tanda-kecil.sedang,
    .tanda-kecil.gagal {
      display: inline;
    }
  }

  /* ================= lineup ================= */
  .roster {
    position: relative;
    /* Menahan logo watermark agar tidak pernah meluber keluar kotaknya sendiri
       — logo yang diunggah PIC bisa berbentuk apa saja, tidak seperti aset MAF
       yang dikurasi rapi. */
    overflow: hidden;
    padding: var(--sp-5) var(--sp-6) var(--sp-6);
  }
  /* Logo tim sebagai watermark di balik roster — HANYA saat logonya ada; lihat
     markup, <img>-nya sama sekali tidak dirender tanpa team.logo_url.
     Kanan-bawah dipilih supaya tidak bersaing dengan nomor slot pertama yang
     selalu duduk di kiri-atas grid (lihat .slot).
     Grayscale + opasitas rendah menyeragamkan tampilannya: logo ini diunggah
     PIC sendiri dalam bentuk dan warna apa pun, bukan aset yang dikurasi
     seperti logo MAF — tanpa penyeragaman ini, logo yang kontras/terang akan
     bersaing dengan teks kartu di depannya alih-alih diam di latar.
     z-index -1 dari .roster yang position:relative, bukan urutan DOM: itu
     menjaminnya tetap di belakang seluruh isi roster apa pun urutan
     render-nya, tanpa perlu menandai tiap elemen lain dengan z-index sendiri. */
  .roster-logo {
    position: absolute;
    right: var(--sp-4);
    bottom: var(--sp-4);
    z-index: -1;
    width: min(200px, 32%);
    height: min(200px, 32%);
    object-fit: contain;
    opacity: 0.08;
    filter: grayscale(1);
    pointer-events: none;
    user-select: none;
  }
  @media (max-width: 720px) {
    .roster-logo {
      width: 110px;
      height: 110px;
    }
  }
  .roster-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  h3 {
    margin: 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .roster-head .count {
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }

  /* Tiga kolom, bukan empat. Web ini dipakai untuk VERIFIKASI: yang dibaca
     berulang-ulang adalah Nickname dan ID Game, dan keduanya butuh ruang untuk
     tampil besar. Kartu yang lebih lebar lebih berharga daripada memaksa 8
     pemain muat dalam dua baris. */
  .roster ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .roster li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    background: linear-gradient(160deg, color-mix(in srgb, hsl(var(--hue) 60% 50%) 12%, transparent), transparent 62%),
      var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: border-color var(--dur) var(--ease);
  }
  .roster li:hover {
    border-color: var(--border-strong);
  }
  /* Nomor slot sebagai angka hantu, bukan badge kaku. */
  .slot {
    position: absolute;
    top: -10px;
    right: 6px;
    font-size: 62px;
    font-weight: 800;
    line-height: 1;
    color: rgba(255, 255, 255, 0.05);
    pointer-events: none;
    user-select: none;
  }
  .top {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    font-size: var(--fs-sm);
    font-weight: 800;
    color: hsl(var(--hue) 88% 94%);
    background: linear-gradient(145deg, hsl(var(--hue) 62% 48%), hsl(var(--hue) 66% 32%));
    border-radius: var(--r-pill);
  }
  .ident {
    min-width: 0;
    flex: 1;
  }

  /* Nama pemain memimpin kartu. Di layar verifikasi, yang dicari lebih dulu
     adalah "siapa orang ini", baru identitas in-game-nya. */
  .nama-pemain {
    display: block;
    font-size: var(--fs-lg);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .top .ikon {
    display: grid;
    place-items: center;
    flex: none;
    width: 30px;
    height: 30px;
    color: var(--text-faint);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .top .ikon:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .top .ikon svg {
    width: 15px;
    height: 15px;
  }

  /* Nick Game dan ID Game dijadikan SATU blok: keduanya adalah identitas yang
     sama-sama dicocokkan ke layar game, dan memisahkannya membuat mata
     bolak-balik. Dipisah garis tipis, bukan dua kotak terpisah. */
  .kotak-game {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
    align-items: stretch;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .kotak-game .garis {
    background: var(--border);
  }
  .kotak-game .lbl {
    display: block;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .kotak-game .val {
    display: block;
    margin-top: 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  /* Nick yang belum sesuai format: warna peringatan plus tanda seru kecil.
     Warna saja tidak cukup — sebagian orang tidak membedakannya. */
  .kotak-game .val.nick.salah {
    color: var(--peringatan);
  }
  /* Hint milik sendiri, bukan atribut title.
     title bawaan peramban baru muncul setelah jeda sekitar satu detik, ukuran
     dan warnanya tidak bisa diatur, dan di layar sentuh ia tidak pernah muncul
     sama sekali. Yang ini tampil SEKETIKA saat kursor masuk — tanpa transisi,
     tanpa tunda — dan ukurannya seukuran teks biasa supaya benar-benar terbaca. */
  /* Dijangkarkan ke KARTUNYA, bukan ke sel nick.
     Kartu pemain memakai overflow: hidden, jadi hint yang menggantung di bawah
     kotak game akan terpotong pada kartu yang pendek — misalnya milik pengunjung
     yang belum masuk, yang tidak punya blok ID card. Dipatok ke tepi bawah
     kartu, lebarnya selalu selebar kartu dan tidak ada yang bisa terpotong. */
  .nick-hint {
    position: absolute;
    left: var(--sp-3);
    right: var(--sp-3);
    bottom: var(--sp-3);
    z-index: 3;
    padding: var(--sp-2) var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 600;
    line-height: 1.45;
    color: var(--peringatan);
    background: var(--surface-2);
    border: 1px solid color-mix(in srgb, var(--peringatan) 45%, transparent);
    border-radius: var(--r-sm);
    box-shadow: var(--shadow-md);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  /* Seluruh sel nick jadi pemicunya, bukan hanya tanda serunya: sasaran sebesar
     15 px terlalu kecil untuk diburu kursor. Fokus papan ketik ikut memicunya. */
  .bagian.ada-hint:hover .nick-hint,
  .bagian.ada-hint:focus-within .nick-hint {
    opacity: 1;
    visibility: visible;
  }
  .nick-tanda:focus-visible {
    outline: 2px solid var(--peringatan);
    outline-offset: 2px;
    border-radius: 50%;
  }
  .nick-tanda {
    display: inline-grid;
    place-items: center;
    width: 15px;
    height: 15px;
    margin-left: 5px;
    font-size: 10px;
    font-style: normal;
    font-weight: 900;
    color: var(--peringatan);
    border: 1.5px solid var(--peringatan);
    border-radius: 50%;
    vertical-align: middle;
  }
  .kotak-game .val.nick {
    color: var(--accent);
  }
  .kotak-game .val.id {
    color: var(--text);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }
  .kotak-game .srv {
    display: inline-block;
    margin-left: 5px;
    font-size: var(--fs-xs);
    font-style: normal;
    color: var(--text-faint);
  }

  /* --- ID card di dalam kartu pemain (admin & relawan) --- */
  .idcard-blok .lbl {
    display: block;
    margin-bottom: 5px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .idcard-gambar {
    display: block;
    width: 100%;
    padding: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    overflow: hidden;
    transition: border-color var(--dur) var(--ease);
  }
  .idcard-gambar:hover {
    border-color: var(--accent);
  }
  /* Kotak POTRET, dan isinya 'contain' — bukan 'cover'.
     ID card pegawai hampir selalu potret, sedangkan kotak lebar-pendek
     sebelumnya memotongnya jadi pita setinggi 118 px yang praktis hanya memuat
     wajah: nama, NIP, dan unit kerja — justru yang perlu dicocokkan — terpotong
     habis, sehingga tiap kartu harus diklik satu per satu.
     'contain' dipilih daripada 'cover' supaya kartu yang terlanjur diunggah
     mendatar tetap terlihat utuh, hanya dengan pita kosong di kiri-kanannya. */
  .idcard-gambar img {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    max-height: 300px;
    object-fit: contain;
    background: var(--surface-inset);
  }
  .idcard-kosong {
    display: grid;
    place-items: center;
    height: 46px;
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
    background: repeating-linear-gradient(
      45deg,
      var(--surface),
      var(--surface) 7px,
      var(--surface-inset) 7px,
      var(--surface-inset) 14px
    );
    border-radius: var(--r-sm);
  }
  /* Saat memuat, ruangnya sudah dipesan seukuran gambar yang akan datang —
     tanpa ini kartu melonjak tinggi begitu pratinjaunya tiba, dan daftar yang
     sedang dibaca ikut melompat. Keadaan "Belum diunggah" sengaja TIDAK ikut
     dibuat setinggi itu: sebagian besar pemain belum mengunggah, dan ratusan
     kotak potret kosong hanya memanjangkan halaman tanpa isi. */
  .idcard-kosong.memuat {
    height: auto;
    aspect-ratio: 3 / 4;
    max-height: 300px;
    animation: kedip 1.1s ease-in-out infinite;
  }
  @keyframes kedip {
    50% {
      opacity: 0.5;
    }
  }

  .kaki {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: auto;
  }
  .status {
    padding: 3px 10px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--st);
    background: color-mix(in srgb, var(--st) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--st) 32%, transparent);
    border-radius: var(--r-pill);
  }
  .joined {
    font-size: var(--fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }
  .kaki .tumbuh {
    flex: 1;
  }


  /* --- form sunting (admin) --- */
  .sunting {
    display: grid;
    gap: var(--sp-2);
  }
  .sunting-kepala {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    margin-bottom: var(--sp-1);
  }
  .sunting-tanda {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .hapus {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: var(--text-faint);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .hapus:hover {
    color: var(--peringatan);
    border-color: var(--peringatan);
  }
  .hapus svg {
    width: 14px;
    height: 14px;
  }

  .sunting select {
    width: 100%;
    height: 34px;
    padding: 0 var(--sp-2);
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-xs);
    outline: 0;
  }
  .sunting select:focus {
    border-color: var(--accent);
  }

  /* Baris ID card di dalam form: dipisah garis karena perilakunya BEDA dari
     field di atasnya — unggahan berlaku seketika, sedangkan isian form baru
     tersimpan saat menekan Simpan. */
  .baris-idcard {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    margin-top: var(--sp-1);
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--border);
  }
  .idcard-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .idcard-status::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: var(--r-pill);
    background: currentColor;
  }
  .idcard-status.ada {
    color: #45c47a;
  }

  /* Keterangan singkat kenapa sebagian field tidak bisa disentuh. */
  .sunting-nota {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .sunting input[readonly],
  .sunting select:disabled {
    color: var(--text-muted);
    background: var(--surface-inset);
    border-color: transparent;
    cursor: not-allowed;
  }
  .tambah-pemain {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-3);
    width: 100%;
    margin-top: var(--sp-4);
    padding: var(--sp-4);
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--accent);
    background: transparent;
    border: 1.5px dashed color-mix(in srgb, var(--accent) 45%, transparent);
    border-radius: var(--r-md);
    transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .tambah-pemain:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-color: var(--accent);
  }
  .tambah-pemain:disabled {
    color: var(--text-faint);
    border-color: var(--border);
    cursor: not-allowed;
  }
  .tambah-pemain small {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
  }
  .sunting label {
    display: block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .sunting input {
    width: 100%;
    height: 34px;
    padding: 0 var(--sp-3);
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-xs);
    outline: 0;
  }
  .sunting input:focus {
    border-color: var(--accent);
  }
  .sunting .dua {
    display: grid;
    grid-template-columns: 1fr 84px;
    gap: var(--sp-2);
  }

  /* --- riwayat perubahan tim (admin) ---
     Ditempatkan SETELAH roster, bukan di dekat kepala panel: ia menjawab
     "kapan ini terakhir disentuh", pertanyaan yang muncul sesudah membaca
     datanya — bukan sebelum. */
  .riwayat {
    padding: var(--sp-5) var(--tepi) 0;
  }
  .riwayat-kepala {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-2) var(--sp-3);
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--border);
  }
  .riwayat-kepala h3 {
    margin: 0;
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  /* Jawaban ringkasnya berdiri di kepala, sebelum daftarnya dibuka: sering kali
     "terakhir disentuh siapa, kapan" sudah cukup, dan rinciannya tidak perlu
     dibaca sama sekali. */
  .riwayat-nota {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .riwayat-kepala button {
    flex: none;
    height: 32px;
    padding: 0 var(--sp-3);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--accent);
    background: none;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    border-radius: var(--r-sm);
  }
  .riwayat-kepala button:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  .riwayat-hari {
    margin: var(--sp-4) 0 var(--sp-2);
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .riwayat-daftar {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .riwayat-daftar li {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .riwayat-daftar li:last-child {
    border-bottom: 0;
  }
  .rw-jam {
    flex: none;
    width: 46px;
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }
  .rw-isi {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text-muted);
  }
  .rw-isi b {
    color: var(--text);
  }
  .rw-nilai {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--text);
    word-break: break-word;
  }
  .rw-nilai.kosong {
    color: var(--text-faint);
    font-style: italic;
  }
  .rw-panah {
    color: var(--text-faint);
  }
  .riwayat-daftar li.buang .rw-nilai,
  .riwayat-daftar li.buang b {
    color: var(--peringatan);
  }
  .riwayat-kosong {
    margin: var(--sp-4) 0 0;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .riwayat-kosong.galat {
    color: var(--peringatan);
  }

  /* --- zona bahaya: hapus tim (PIC) ---
     Ditaruh di DASAR halaman, terpisah dari segala yang lain. Aksinya tidak
     bisa dibatalkan dan tidak bisa diulang sendiri oleh PIC, jadi ia tidak
     boleh berada dalam jangkauan jempol yang sedang mengerjakan hal lain —
     mencapainya harus berarti menggulir melewati seluruh roster lebih dulu. */
  .zona-bahaya {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-top: var(--sp-7);
    padding: var(--sp-4) var(--tepi, var(--sp-6));
    border-top: 1px solid color-mix(in srgb, var(--peringatan) 28%, transparent);
  }
  .zona-bahaya .ket {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text-muted);
  }
  .zona-bahaya .ket b {
    display: block;
    color: var(--peringatan);
  }
  .zona-bahaya button {
    flex: none;
    height: 40px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--peringatan);
    background: none;
    border: 1px solid color-mix(in srgb, var(--peringatan) 45%, transparent);
    border-radius: var(--r-sm);
  }
  .zona-bahaya button:hover {
    color: #fff;
    background: var(--peringatan);
    border-color: var(--peringatan);
  }

  /* --- lapisan konfirmasi hapus --- */
  .lapis {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: var(--sp-4);
    background: rgba(4, 8, 20, 0.72);
    backdrop-filter: blur(3px);
  }
  .kotak {
    width: min(460px, 100%);
    max-height: 100%;
    padding: var(--sp-5);
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--peringatan);
    border-radius: var(--r-md);
  }
  .kotak h3 {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-lg);
    color: var(--peringatan);
  }
  .kotak p {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--text-muted);
  }
  .kotak p b {
    color: var(--text);
  }
  /* Peringatan yang paling menentukan diberi bidangnya sendiri: di dalam
     paragraf biasa ia terbaca sebagai keterangan tambahan, padahal justru
     inilah satu-satunya hal yang tidak bisa diperbaiki sesudahnya. */
  .kotak p.tegas {
    padding: var(--sp-3);
    color: var(--text);
    background: color-mix(in srgb, var(--peringatan) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--peringatan) 34%, transparent);
    border-radius: var(--r-sm);
  }
  .kotak p.lapis-galat {
    color: var(--peringatan);
  }
  .lapis-aksi {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
  }
  .lapis-aksi button {
    height: 42px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .lapis-aksi button.bahaya {
    color: #fff;
    background: var(--peringatan);
    border-color: var(--peringatan);
  }
  .lapis-aksi button[disabled] {
    opacity: 0.55;
  }

  /* --- penampil ID card --- */
  .lihat-idcard {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    grid-template-rows: auto 1fr;
    background: rgba(8, 13, 30, 0.96);
    backdrop-filter: blur(2px);
  }
  .lihat-idcard header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-6);
    border-bottom: 1px solid var(--border);
  }
  .lihat-idcard .judul {
    font-size: var(--fs-lg);
    font-weight: 800;
  }
  .lihat-idcard .judul small {
    display: block;
    margin-top: 2px;
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
  }
  .lihat-idcard .isi {
    display: grid;
    place-items: center;
    padding: var(--sp-4);
    overflow: auto;
  }
  .lihat-idcard img {
    max-width: 100%;
    max-height: 100%;
    border-radius: var(--r-sm);
  }
  .lihat-idcard .info {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  /* ================= responsif ================= */
  @media (max-width: 1080px) {
    .roster ol {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 720px) {
    /* Layar sempit: kepala tim harus muat dalam satu baris 430 px. Label tombol,
       penanda mode, dan chip cabor dilepas — cabor sudah tampil di header
       aplikasi tepat di atasnya, jadi mengulangnya di sini hanya mendorong
       isinya keluar layar. */
    .kembali span,
    .mode-tag,
    .game-tag,
    .ubah span {
      display: none;
    }
    .ubah {
      padding: 7px;
    }
    .bilah-simpan {
      padding: var(--sp-2) var(--sp-3);
    }
    .bilah-ket {
      display: none;
    }
    .bilah-simpan button {
      flex: 1;
    }
    .kembali {
      padding: 8px;
    }
    .head-body {
      min-width: 0;
    }
    /* Baris keterangan dipangkas jadi satu baris: dua baris membuat tinggi
       kepala melar tanpa menambah informasi yang dicari di layar sempit. */
    .sub {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Grid, bukan flex-wrap: tanpa ini nama tim terjepit jadi 3 baris karena
       badge cabor dan tombol tutup ikut berebut baris yang sama. */
    header {
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
    }
    .crest {
      width: 36px;
      height: 36px;
      font-size: 12px;
    }
    .game-tag {
      font-size: var(--fs-xs);
      padding: 4px 10px 4px 4px;
    }
    .game-tag img {
      width: 18px;
      height: 18px;
    }
    h2 {
      font-size: var(--fs-md);
    }
    .pj,
    .berkas,
    .roster {
      padding: var(--sp-4);
    }
    .pj {
      grid-template-columns: 1fr;
      gap: var(--sp-4);
    }
    .roster {
      padding-bottom: calc(var(--sp-5) + env(safe-area-inset-bottom));
    }
  }
  @media (max-width: 720px) {
    .roster ol {
      grid-template-columns: 1fr;
    }
    /* Pratinjau ID card berhenti jadi tombol.
       Kartunya kini tampil utuh dalam bentuk potret, jadi memperbesar tidak
       lagi diperlukan — sementara di layar sentuh ia justru mudah tertekan
       tanpa sengaja saat menggulir roster, dan yang terbuka adalah lapisan
       penuh layar yang harus ditutup lagi. */
    .idcard-gambar {
      pointer-events: none;
    }
    .idcard-gambar:hover {
      border-color: var(--border);
    }
    .lihat-idcard header {
      padding: var(--sp-4);
    }

    /* Pita penanggung jawab dipadatkan. Di layar lebar ia satu baris di samping
       roster; begitu ketiga kelompoknya menumpuk, ia memakan hampir satu layar
       penuh sebelum pemain pertama terlihat — padahal roster itulah yang dicari
       orang saat membuka sebuah tim. Yang dibuang hanya ruang dan hiasan, bukan
       satu pun nama atau peran. */
    .pj {
      gap: var(--sp-3);
      padding-top: var(--sp-3);
      padding-bottom: var(--sp-3);
    }
    .pj-grup h3 {
      margin-bottom: 2px;
    }
    /* Monogram tidak menambah apa pun: namanya tercetak utuh tepat di sebelahnya.
       Di layar sempit ia justru memakan lebar yang dibutuhkan nama panjang. */
    .pj-ava {
      display: none;
    }
    .pj-orang {
      gap: 0;
    }
    .pj-daftar {
      gap: 2px var(--sp-4);
    }
    .pj-teks {
      font-size: var(--fs-sm);
    }
    /* Peran jadi sufiks sebaris — menghemat satu baris penuh per orang. */
    .pj-teks small {
      display: inline;
      margin: 0 0 0 6px;
    }
    .pj-kosong {
      padding: 2px 0;
      font-size: var(--fs-xs);
    }

    /* Riwayat: jam turun ke atas isinya. Di 390 px, kolom jam 46 px memotong
       nama pelaku dan nilainya jadi banyak baris pendek. */
    .riwayat {
      padding-left: var(--sp-3);
      padding-right: var(--sp-3);
    }
    .riwayat-daftar li {
      flex-direction: column;
      gap: 0;
    }
    .rw-jam {
      width: auto;
    }

    /* Zona bahaya menumpuk: sebaris, tombolnya terjepit di sisa lebar setelah
       keterangan — dan tombol sempit adalah tombol yang tertekan setengah
       sengaja. Ditumpuk, ia selebar layar dan jelas apa yang ditekan. */
    .zona-bahaya {
      flex-direction: column;
      align-items: stretch;
      gap: var(--sp-3);
    }
    .zona-bahaya button {
      width: 100%;
    }
    /* Dialognya menempel ke dasar layar: di ponsel, kotak yang melayang di
       tengah menaruh tombolnya jauh dari jempol. */
    .lapis {
      place-items: end stretch;
      padding: 0;
    }
    .kotak {
      width: 100%;
      border-radius: var(--r-md) var(--r-md) 0 0;
      padding-bottom: calc(var(--sp-5) + env(safe-area-inset-bottom, 0px));
    }
    .lapis-aksi button {
      flex: 1;
      height: 46px;
    }
  }
  @media (max-width: 460px) {
    h2 {
      font-size: var(--fs-xl);
    }
  }
`;

/* Nada status memakai palet yang sama dengan sisa dashboard. */
const STATUS_TONE = {
  TETAP: 'var(--game-mlbb)',
  TAD: 'var(--game-pubg)',
  PKWT: 'var(--brand-gold)',
  KRIYA: '#c9d4f2',
};

const IKON_PERINGATAN = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M8 2.4 14.6 13.6H1.4L8 2.4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
  <path d="M8 6.4v3.1M8 11.6h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>`;

const ICON_HAPUS = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M2.8 4.4h10.4M6.4 4.4V3.2h3.2v1.2M4.2 4.4l.6 8.2a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.2"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const IKON_CEK = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.4" />
  <path d="m5.2 8.2 1.9 1.9 3.7-4" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/* Penanda "sedang berjalan". Berputar, BUKAN batang kemajuan: menyimpan roster
   adalah satu permintaan tunggal — batang yang merayap sendiri hanya mengarang
   kemajuan yang tidak diketahui siapa pun, termasuk oleh halaman ini. */
const IKON_SIBUK = '<span class="putar" aria-hidden="true"></span>';

/**
 * Galat yang berlaku untuk SELURUH antrean, bukan untuk satu berkas.
 * Begitu salah satunya muncul, sisa antrean dihentikan: mencobanya satu per
 * satu hanya menghasilkan kegagalan identik.
 *
 * "Server tidak merespons" ikut di sini bukan karena pasti menyeluruh, tapi
 * karena ongkosnya: tiap percobaan menunggu 60 detik sampai timeout, jadi
 * tujuh berkas berarti hampir tiga menit menunggu untuk hasil yang hampir
 * pasti sama. Menghentikan lalu meminta tekan Simpan lagi jauh lebih murah.
 */
const GALAT_MENYELURUH =
  /kode tim|sesi berakhir|sesi tidak aktif|relawan tidak boleh|tim tidak ditemukan|belum masuk|endpoint|tidak merespons/i;

const IKON_FOTO = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style="width:20px;height:20px">
  <path d="M2 5.6a1.6 1.6 0 0 1 1.6-1.6h1.1l.8-1.3h4.6l.8 1.3h1.5A1.6 1.6 0 0 1 14 5.6v6.2a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 11.8V5.6Z"
        stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
  <circle cx="8" cy="8.6" r="2.4" stroke="currentColor" stroke-width="1.3" />
</svg>`;

/* Panah melingkar: "buat ulang". Tanpa teks, bentuk inilah satu-satunya
   penjelas — jadi lingkarannya dibiarkan hampir penuh dengan satu mata panah,
   bukan dua busur kecil yang di ukuran 15 px terbaca seperti noda. */
const IKON_SILANG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>`;

const IKON_ULANG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.7" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" />
  <path d="M13.4 2.6v2.6h-2.6" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const IKON_MATA = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M1.5 8S3.9 3.6 8 3.6 14.5 8 14.5 8 12.1 12.4 8 12.4 1.5 8 1.5 8Z"
        stroke="currentColor" stroke-width="1.4" />
  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4" />
</svg>`;

const IKON_MATA_TUTUP = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M2.6 4.6C1.9 5.5 1.5 6.4 1.5 8c0 0 2.4 4.4 6.5 4.4 1.3 0 2.4-.4 3.3-1"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="M13.6 10.2c.6-.9.9-1.7.9-2.2 0 0-2.4-4.4-6.5-4.4-.7 0-1.3.1-1.9.3"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="m2.6 2.6 10.8 10.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
</svg>`;

const ICON_SALIN = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1.8" stroke="currentColor" stroke-width="1.4" />
  <path d="M10.6 5.4V4.2a1.8 1.8 0 0 0-1.8-1.8H4.2a1.8 1.8 0 0 0-1.8 1.8v4.6a1.8 1.8 0 0 0 1.8 1.8h1.2"
        stroke="currentColor" stroke-width="1.4" />
</svg>`;

const ICON_SUNTING = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M11.2 2.6a1.7 1.7 0 0 1 2.4 2.4L6 12.6l-3.2.8.8-3.2 7.6-7.6Z"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Baris kode milik kontingen tim ini, dari daftar seluruh kode aktif.
 *
 * daftarKode di GAS menjawab per KONTINGEN, bukan per tim: satu kode mencakup
 * semua tim satu kontingen di semua cabor. Panel ini hanya butuh satu barisnya,
 * dan mencocokkannya lewat nama kontingen yang sudah dibakukan — penulisan di
 * spreadsheet tidak seragam ("*REGION XII*" vs "REGION XII"), dan pencocokan
 * mentah akan menyimpulkan "belum ada kode" untuk kode yang sebenarnya ada.
 *
 * Bentuk kembaliannya sengaja sama dengan yang dipakai render: tidak ketemu
 * berarti kode kosong, bukan galat.
 */
function kodeKontingen(daftar, team) {
  const milik = normalKontingen(team?.kontingen);
  const baris = (daftar || []).find((k) => normalKontingen(k.kontingen) === milik);
  return { kode: baris?.kode || '', jenis: baris?.jenis || '', sampai: baris?.sampai || 0 };
}

export class TeamDetail extends BaseElement {
  static styles = [styles];

  constructor() {
    super();
    this._team = null;
    // Dipertahankan lintas render: unggahan memicu render ulang, dan tanpa ini
    // kode yang sudah diketik serta pesan hasilnya akan terhapus.
    this._pesanTeks = '';
    this._pesanJenis = '';
    // Mode sunting berlaku untuk SATU TIM sekaligus, bukan per pemain.
    this._sunting = false;
    // Salinan roster yang sedang disunting. Dipisah dari store supaya menambah
    // dan menghapus baris tidak menyentuh data asli sampai ditekan Simpan.
    this._roster = null;
    // Nama tim yang sedang diketik. Dipisah dari _roster karena ia milik TIM,
    // bukan salah satu pemainnya.
    this._namaTim = null;
    this._lihat = null; // { playerId, nama, dataUrl, memuat, galat }
    this._mode = 'lihat'; // 'lihat' (verifikasi) | 'berkas' (logo & ID card) | 'foto'
    this._kodeTim = null; // { memuat } | { kode, sampai } | { galat } — khusus admin
    this._kodeMemuat = false; // permintaan keadaan kode sedang berjalan
    this._pilihJenis = false; // dua pilihan jenis sedang ditampilkan
    this._kodeSibuk = false; // tombol "Buat kode" sedang bekerja
    this._idcard = {}; // cache pratinjau per playerId
    // Pratinjau LOKAL berkas yang baru dipilih, sebelum/selagi dikirim.
    // Dikunci per sasaran (teamId untuk logo & foto tim, playerId untuk sisanya)
    // supaya tiap baris menampilkan gambarnya sendiri.
    this._pilihan = {};
    this._menyimpan = false;
    // Kemajuan pengiriman antrean berkas: { selesai, total, nama }.
    this._progres = null;
    // Konfirmasi hapus tim (PIC): { teamId, nama, sibuk, galat }.
    this._hapus = null;
    // Riwayat perubahan tim ini: null = belum diminta. { memuat } | { daftar } |
    // { galat }. Diminta atas permintaan, bukan saat panel dibuka — lihat
    // _grupRiwayat().
    this._riwayat = null;
  }

  render() {
    const team = this._team;
    if (!team) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const game = GAME_META[team.game] || { label: team.game, logo: '', color: 'var(--accent)' };
    const pic = team.pic || {};
    const members = team.members || [];
    const sudahIdCard = members.filter((m) => m.has_idcard).length;
    // Peran hanya menentukan APA YANG TAMPIL. Wewenangnya sendiri ditegakkan
    // GAS: menyalakan tombol lewat DevTools tidak memberi hak apa pun.
    const sesi = sesiSekarang();
    const admin = adalahAdmin();
    // PIC kontingen: boleh menyunting, tapi hanya tim kontingennya sendiri dan
    // hanya sebagian field.
    const timSendiri = adalahTim() && bolehSuntingTim(team);
    // Roster terkunci menutup penyuntingan peserta — termasuk pemegang kode
    // "ubah + unggah". GAS sudah menolaknya; tombolnya disembunyikan di sini
    // supaya penolakan itu tidak datang sebagai kegagalan simpan setelah
    // seseorang selesai mengetik.
    const bolehUbah = admin || (timSendiri && !caborTerkunci(team.game));
    // ID card tim lain tidak akan dikirim GAS, jadi jangan diminta sama sekali.
    const bolehIdCard = bolehLihatIdCard(team);

    // Keadaan Kode Tim ditanyakan sekali saat panel dibuka.
    //
    // Dulu ia hanya diambil ketika tombol mata ditekan, dan itu masuk akal
    // selama kode bersifat permanen: ia PASTI ada, jadi tidak ada yang perlu
    // diketahui lebih awal. Sejak kode dibuat sesuai kebutuhan dan mati sendiri,
    // panel ini harus tahu ADA atau TIDAK sebelum menggambar apa pun — tanpa
    // itu, tim yang kodenya baru saja dibuat dari daftar tim tetap tampil
    // seolah belum punya kode.
    //
    // Dipanggil SEBELUM markup disusun: penandaan "sedang memuat" terjadi
    // serentak di dalamnya, jadi render ini langsung menggambar keadaan yang
    // benar alih-alih berkedip lewat "belum ada kode" dulu.
    if (admin) this._muatKode();
    // Dua mode yang sengaja dipisah. "Lihat tim" adalah layar VERIFIKASI: tidak
    // ada satu pun field unggahan di sana, supaya tidak ada yang salah tekan
    // sambil membaca data. "Unggah berkas" adalah layar KERJA BERKAS.
    // Relawan dipaksa ke layar verifikasi walaupun URL-nya menunjuk /berkas:
    // menu unggahnya memang disembunyikan, tapi tautan lama atau alamat yang
    // diketik tangan tidak boleh menjatuhkan mereka ke layar yang tak berguna.
    // Layar unggah hanya terbuka untuk yang benar-benar boleh mengunggah tim
    // INI: admin, atau PIC tim yang sudah masuk dengan kode timnya. Sebelumnya
    // siapa pun bisa membukanya lalu menempelkan kode; kini kodenya sudah
    // dipakai saat masuk, jadi tidak ada gunanya membuka layar yang pasti
    // ditolak GAS. Alamat yang diketik tangan pun jatuh ke layar verifikasi.
    // Menyunting menuntut kode 'penuh'; mengunggah cukup dengan kode mana pun.
    const bolehUnggah = bolehUnggahTim(team);
    const unggah = this._mode === 'berkas' && bolehUnggah;
    const foto = this._mode === 'foto' && bolehUnggah;
    // Berkas yang sudah dipilih tapi belum terkirim. Angkanya dipakai bilah
    // simpan di mode ubah, supaya satu tombol Simpan mengurus keduanya.
    const antreBerkas = Object.keys(this._pilihan).length;

    this.shadowRoot.innerHTML = `
      <section class="panel ${unggah || foto ? 'mode-unggah' : 'mode-lihat'}${this._menyimpan ? ' menyimpan' : ''}"
               aria-label="${unggah ? 'Unggah berkas' : foto ? 'Unggah foto' : 'Detail'} tim ${esc(team.team_name)}"
               style="--tone:${game.color}">
        <header>
          <button class="kembali" type="button" data-act="kembali" aria-label="Kembali ke daftar tim">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Kembali</span>
          </button>
          <div class="crest" style="--hue:${hueOf(team.team_name)}" aria-hidden="true">
            ${
              team.logo_url
                ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
                : esc(initials(team.team_name))
            }
          </div>
          <div class="head-body">
            ${
              /* Nama tim disunting DI TEMPAT judulnya berada, bukan di baris
                 form tersendiri. Yang diubah adalah judul halaman ini; menaruh
                 kolomnya jauh dari situ memaksa orang membaca dua kali untuk
                 yakin ia sedang mengubah nama yang benar.
                 HANYA ADMIN — bukan bolehUbah, yang juga true untuk PIC
                 kontingen. Nama tim adalah identitas resmi pendaftaran, beda
                 kelasnya dengan nickname atau ID game yang memang urusan
                 sehari-hari PIC; GAS menolak diam-diam kalau tombol ini
                 dinyalakan lewat DevTools. */
              admin && this._sunting
                ? `<input class="ubah-nama" type="text" name="teamName" maxlength="80"
                          aria-label="Nama tim"
                          value="${esc(this._namaTim ?? team.team_name)}" />`
                : `<h2>${esc(team.team_name)}</h2>`
            }
            <p class="sub">${esc(team.kontingen || '')}${team.unit_kerja ? ` · ${esc(team.unit_kerja)}` : ''}${
      team.submission_date ? ` · Didaftarkan ${esc(formatDate(team.submission_date))}` : ''
    }</p>
          </div>
          <span class="game-tag">
            ${game.logo ? `<img src="${esc(game.logo)}" alt="" />` : ''}${esc(game.label)}
          </span>
          ${
            bolehUbah && !unggah && !foto
              ? this._sunting
                ? '<span class="mode-tag sunting">Mode ubah</span>'
                : `<button class="ubah" type="button" data-act="mulai-sunting">
                     ${ICON_SUNTING}<span>Ubah data</span>
                   </button>`
              : `<span class="mode-tag">${unggah ? 'Unggah berkas' : foto ? 'Unggah foto' : 'Verifikasi'}</span>`
          }
        </header>

        <div class="body">
          ${this._pitaAturan(team)}
          ${
            foto
              ? this._bagianFoto(team, members, admin, timSendiri)
              : unggah
              ? this._bagianUnggah(team, members, sudahIdCard, admin, timSendiri)
              : `
          ${this._pitaPic(team, pic)}

          <section class="roster">
            ${
              // Watermark, bukan informasi — aria-hidden dan tanpa alt text.
              // onerror="this.remove()" sama seperti crest di daftar tim:
              // tautan Drive yang gagal dimuat tidak boleh meninggalkan ikon
              // gambar rusak di pojok panel.
              team.logo_url
                ? `<img class="roster-logo" src="${esc(team.logo_url)}" alt="" aria-hidden="true"
                        loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
                : ''
            }
            ${
              /* Judul "Roster" dan hitungan pemainnya dibuang: kartu pemain
                 bernomor 1..n tepat di bawahnya sudah mengatakan keduanya.
                 Yang tersisa hanya hitungan ID card, dan hanya untuk sesi yang
                 sudah masuk — itu angka kerja verifikasi, bukan label. */
              bolehIdCard
                ? `<div class="roster-head">
                     <span class="count">ID card ${num(sudahIdCard)}/${num(members.length)}</span>
                   </div>`
                : ''
            }
            ${this._bilahPesan()}
            <ol>
              ${
                bolehUbah && this._sunting
                  ? this._roster.map((baris, i) => this._formSunting(baris, i + 1)).join('')
                  : members
                      .map((member, index) => this._card(member, index + 1, { sesi: bolehIdCard, admin }))
                      .join('')
              }
            </ol>
            ${bolehUbah && this._sunting ? `<input type="file" id="berkas" accept="${ACCEPTED_TYPES.join(',')}" hidden />` : ''}
            ${
              /* Menambah pemain HANYA untuk admin. PIC hanya membetulkan yang
                 sudah ada: susunan peserta ditetapkan lewat pendaftaran resmi,
                 dan nama serta status kepegawaian — dua hal yang menentukan
                 keabsahan seorang pemain — justru field yang tidak boleh
                 disunting PIC. Menyembunyikannya di sini, bukan mematikannya,
                 supaya tidak ada tombol yang mengundang lalu menolak. */
              bolehUbah && this._sunting && !this._suntingTerbatas()
                ? `<button class="tambah-pemain" type="button" data-act="tambah-pemain"
                           ${this._roster.length >= this._maksPemain() ? 'disabled' : ''}>
                     + Tambah pemain
                     <small>${num(this._roster.length)} / ${num(this._maksPemain())} slot</small>
                   </button>`
                : ''
            }
          </section>
          ${
            this._sunting
              ? `<div class="bilah-simpan ${this._menyimpan ? 'mengirim' : ''}">
                   <span class="bilah-ket">
                     ${
                       this._menyimpan
                         ? `${IKON_SIBUK} Menyimpan ${num(this._roster.length)} pemain${
                             antreBerkas ? ` dan ${num(antreBerkas)} berkas` : ''
                           }…`
                         : `Mengubah <b>${num(this._roster.length)} pemain</b> di ${esc(team.team_name)}${
                             antreBerkas ? ` · <b>${num(antreBerkas)} berkas</b> menunggu` : ''
                           }`
                     }
                   </span>
                   <button type="button" data-act="batal-sunting" ${this._menyimpan ? 'disabled' : ''}>
                     Batal
                   </button>
                   <button type="button" class="utama" data-act="simpan-sunting"
                           ${this._menyimpan ? 'disabled' : ''}>
                     ${
                       this._menyimpan
                         ? 'Menyimpan…'
                         : antreBerkas
                           ? 'Simpan perubahan & berkas'
                           : 'Simpan perubahan'
                     }
                   </button>
                 </div>`
              : ''
          }
          ${admin ? this._grupRiwayat(team) : ''}
          ${this._zonaBahaya(team)}`
          }
        </div>

        ${this._kotakHapus()}
        ${this._lihat ? this._penampilIdCard() : ''}
      </section>`;

    // Pratinjau ID card baru diminta setelah markup ada, dan hanya di mode
    // lihat: mode unggah tidak menampilkan gambarnya sama sekali.
    if (!unggah && !foto && bolehIdCard) this._muatPratinjau(members);
  }

  /**
   * Layar "Unggah berkas": kode tim, logo, lalu satu baris per pemain untuk ID
   * card. Tidak ada data verifikasi di sini — itu urusan layar "Lihat tim".
   */
  /** Pemberitahuan bahwa roster terkunci, di layar unggah mana pun. */
  _pitaTerkunci(admin) {
    if (!caborTerkunci(this._team?.game)) return '';
    return `
      <p class="terkunci roster">
        <b>Roster cabor ini sudah dikunci panitia.</b>
        ${
          admin
            ? 'Kode Tim tidak berlaku lagi — tapi Anda masuk sebagai admin, jadi unggahan tetap bisa dilakukan.'
            : 'Kode Tim tidak berlaku lagi. Hubungi panitia bila masih ada berkas yang perlu dikirim.'
        }
      </p>`;
  }

  _bagianUnggah(team, members, sudahIdCard, admin, timSendiri = false) {
    // Logo yang baru dipilih sudah dihitung memenuhi syarat: penguncian ini
    // menjaga urutan kerja, bukan menghukum orang yang sudah memilihnya tapi
    // belum menekan Simpan.
    const adaLogo = Boolean(team.logo_url) || this._adaLogoDipilih();
    // Terkunci -> seluruh tombol unggah mati untuk non-admin.
    const mati = !admin && caborTerkunci(team.game);
    const kunciLogo = this._kunciPilihan('logo', team.team_id);
    return `
      <section class="berkas">
        <div class="unggah-bar">
          ${
            /* Tidak ada lagi kolom Kode Tim di sini.
               Wewenang unggah kini sepenuhnya dari sesi: PIC masuk sekali dengan
               Kode Tim-nya, lalu bekerja. Menempelkan kode di tiap unggahan
               berarti kredensial itu berkeliaran di formulir, tangkapan layar,
               dan riwayat isian browser — untuk keuntungan yang tidak ada,
               karena sesinya toh sudah membuktikan hal yang sama. */
            `<div class="kode-blok admin">
               <span class="kode-label">Masuk sebagai ${admin ? 'admin' : 'PIC tim'}</span>
               <span class="kode-nota">${
                 admin ? 'Berlaku untuk semua tim.' : 'Hanya untuk tim ini.'
               }</span>
             </div>`
          }

          <div class="logo-mini ${adaLogo ? '' : 'wajib'} ${esc(this._statusPilihan(kunciLogo))}">
            <span class="logo-thumb">
              ${
                this._pilihan[kunciLogo]
                  ? `<img src="${esc(this._pilihan[kunciLogo].url)}" alt="Pratinjau logo" />`
                  : team.logo_url
                    ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
                    : esc(initials(team.team_name))
              }
            </span>
            <span class="logo-teks">
              Logo tim ${adaLogo ? '' : '<em>wajib</em>'}
              <small>${this._ketPilihan(kunciLogo, team.logo_url)}</small>
            </span>
            <button class="unggah kecil" type="button" data-kind="logo"
                    ${mati ? 'disabled title="Roster sudah dikunci"' : ''}>
              ${team.logo_url ? 'Ganti' : 'Unggah'}
            </button>
          </div>
        </div>

        ${this._pitaTerkunci(admin)}
        ${this._bilahPesan()}

        <div class="unggah-head">
          <h3>ID Card per pemain</h3>
          <span class="tanda ${sudahIdCard === members.length && members.length ? 'ada' : 'belum'}">
            ${num(sudahIdCard)} / ${num(members.length)}
          </span>
        </div>

        ${
          adaLogo
            ? ''
            : `<p class="terkunci">
                 Pilih <b>logo tim</b> lebih dulu — logo wajib ada sebelum ID card
                 pemain bisa dikirim.
               </p>`
        }

        <ul class="daftar-unggah ${adaLogo ? '' : 'terkunci'}">
          ${members
            .map(
              (m) => `
            <li class="${m.has_idcard ? 'sudah' : ''}">
              <span class="ava" style="--hue:${hueOf(m.game_nick || m.full_name || '')}" aria-hidden="true">
                ${esc(initials(m.full_name || m.game_nick || '?'))}
              </span>
              <span class="nama-baris">
                ${esc(m.full_name || '—')}
                ${m.game_nick ? `<small>${esc(m.game_nick)}</small>` : ''}
              </span>
              ${this._kotakPilihan(this._kunciPilihan('idcard', m.player_id))}
              ${this._tandaBaris(this._kunciPilihan('idcard', m.player_id), m.has_idcard)}
              <button class="unggah kecil" type="button" data-act="unggah-idcard"
                      data-player="${esc(m.player_id || '')}"
                      ${
      mati ? 'disabled title="Roster sudah dikunci"' : adaLogo ? '' : 'disabled title="Pilih logo tim dulu"'
    }>
                ${m.has_idcard ? 'Ganti' : 'Unggah'}
              </button>
            </li>`
            )
            .join('')}
        </ul>

        ${this._bilahBerkas()}
        <input type="file" id="berkas" accept="${ACCEPTED_TYPES.join(',')}" hidden />
      </section>`;
  }

  /**
   * Penanggung jawab tim: kontingen dan tim dipisah jadi dua kelompok berlabel.
   *
   * Versi sebelumnya menderetkan semuanya dalam satu baris dengan peran sebagai
   * sufiks kecil, sehingga tidak jelas siapa PIC tingkat kontingen dan siapa
   * PIC tim. Dua hal lain yang membuatnya makin kabur, keduanya nyata di data:
   *
   *   - 81 dari 91 tim TIDAK punya PIC tim sama sekali, jadi kolomnya sering
   *     kosong dan harus mengatakan itu, bukan menghilang diam-diam;
   *   - pada beberapa tim, PIC dan Manager adalah ORANG YANG SAMA — namanya
   *     tercetak dua kali dan terbaca seperti kesalahan tampilan.
   *
   * Karena itu kontak digabung per orang dan perannya dikumpulkan jadi satu.
   */
  _pitaPic(team, pic) {
    const orang = [];
    (team.contacts || []).forEach((c) => {
      const nama = (c.name || '').trim();
      if (!nama) return;
      const kunci = nama.toLowerCase();
      const ada = orang.find((o) => o.kunci === kunci);
      const peran = (c.role || 'PIC').trim();
      if (ada) {
        if (!ada.peran.includes(peran)) ada.peran.push(peran);
      } else {
        orang.push({ kunci, nama, peran: [peran] });
      }
    });
    // Urutan tetap PIC lalu Manager, apa pun urutan di formulir aslinya.
    const bobot = (p) => (/^pic$/i.test(p) ? 0 : 1);
    orang.forEach((o) => o.peran.sort((a, b) => bobot(a) - bobot(b)));
    orang.sort((a, b) => bobot(a.peran[0]) - bobot(b.peran[0]));

    const kartu = (nama, peran) => `
      <div class="pj-orang">
        <span class="pj-ava" style="--hue:${hueOf(nama)}" aria-hidden="true">${esc(initials(nama))}</span>
        <span class="pj-teks">
          ${esc(nama)}
          ${peran ? `<small>${esc(peran)}</small>` : ''}
        </span>
      </div>`;

    return `
      <section class="pj">
        <div class="pj-grup">
          <h3>Penanggung jawab kontingen</h3>
          ${pic.name ? kartu(pic.name, '') : '<p class="pj-kosong">Tidak tercatat</p>'}
        </div>
        <div class="pj-grup">
          <h3>PIC / Manager tim</h3>
          ${
            orang.length
              ? `<div class="pj-daftar">${orang.map((o) => kartu(o.nama, o.peran.join(' · '))).join('')}</div>`
              : '<p class="pj-kosong">Tidak diisi saat pendaftaran</p>'
          }
        </div>
        ${adalahAdmin() ? this._grupKode() : ''}
      </section>`;
  }

  /**
   * Layar "Unggah foto": satu foto bersama tim, lalu satu baris per pemain.
   *
   * TIDAK wajib — tidak ada penguncian seperti logo, dan tidak ikut diperiksa
   * aturan kelengkapan. Fotonya disimpan privat seperti ID card: ia gambar
   * orang, dan tidak ada alasan membuatnya bisa diakses siapa pun bertautan.
   */
  _bagianFoto(team, members, admin, timSendiri = false) {
    const sudah = members.filter((m) => m.has_foto).length;
    const mati = !admin && caborTerkunci(team.game);
    const kunciFotoTim = this._kunciPilihan('foto', team.team_id);
    return `
      <section class="berkas">
        <div class="unggah-bar">
          ${
            /* Tidak ada lagi kolom Kode Tim di sini.
               Wewenang unggah kini sepenuhnya dari sesi: PIC masuk sekali dengan
               Kode Tim-nya, lalu bekerja. Menempelkan kode di tiap unggahan
               berarti kredensial itu berkeliaran di formulir, tangkapan layar,
               dan riwayat isian browser — untuk keuntungan yang tidak ada,
               karena sesinya toh sudah membuktikan hal yang sama. */
            `<div class="kode-blok admin">
               <span class="kode-label">Masuk sebagai ${admin ? 'admin' : 'PIC tim'}</span>
               <span class="kode-nota">${
                 admin ? 'Berlaku untuk semua tim.' : 'Hanya untuk tim ini.'
               }</span>
             </div>`
          }

          <div class="logo-mini ${esc(this._statusPilihan(kunciFotoTim))}">
            <span class="logo-thumb">
              ${
                this._pilihan[kunciFotoTim]
                  ? `<img src="${esc(this._pilihan[kunciFotoTim].url)}" alt="Pratinjau foto bersama" />`
                  : team.has_foto_tim
                    ? IKON_FOTO
                    : esc(initials(team.team_name))
              }
            </span>
            <span class="logo-teks">
              Foto bersama <em class="opsional">opsional</em>
              <small>${this._ketPilihan(kunciFotoTim, team.has_foto_tim)}</small>
            </span>
            <button class="unggah kecil" type="button" data-act="unggah-foto-tim"
                    ${mati ? 'disabled title="Roster sudah dikunci"' : ''}>
              ${team.has_foto_tim ? 'Ganti' : 'Unggah'}
            </button>
          </div>
        </div>

        ${this._pitaTerkunci(admin)}
        ${this._bilahPesan()}

        <div class="unggah-head">
          <h3>Foto per pemain</h3>
          <span class="tanda ${sudah === members.length && members.length ? 'ada' : 'belum'}">
            ${num(sudah)} / ${num(members.length)}
          </span>
          <span class="kode-nota">Tidak wajib — unggah seadanya.</span>
        </div>

        <ul class="daftar-unggah">
          ${members
            .map(
              (m) => `
            <li class="${m.has_foto ? 'sudah' : ''}">
              <span class="ava" style="--hue:${hueOf(m.game_nick || m.full_name || '')}" aria-hidden="true">
                ${esc(initials(m.full_name || m.game_nick || '?'))}
              </span>
              <span class="nama-baris">
                ${esc(m.full_name || '—')}
                ${m.game_nick ? `<small>${esc(m.game_nick)}</small>` : ''}
              </span>
              ${this._kotakPilihan(this._kunciPilihan('foto', m.player_id))}
              ${this._tandaBaris(this._kunciPilihan('foto', m.player_id), m.has_foto)}
              <button class="unggah kecil" type="button" data-act="unggah-foto"
                      data-player="${esc(m.player_id || '')}"
                      ${mati ? 'disabled title="Roster sudah dikunci"' : ''}>
                ${m.has_foto ? 'Ganti' : 'Unggah'}
              </button>
            </li>`
            )
            .join('')}
        </ul>

        ${this._bilahBerkas()}
        <input type="file" id="berkas" accept="${ACCEPTED_TYPES.join(',')}" hidden />
      </section>`;
  }

  /**
   * Kode Tim — hanya admin, dan hanya lewat permintaan ber-token.
   * Nilainya tidak ada di store: Kode Tim sengaja tidak pernah ikut payload
   * publik, jadi ia diambil terpisah saat halaman dibuka.
   */
  /**
   * Kode Tim. Tertutup secara bawaan dan TIDAK diambil sampai diminta.
   *
   * Dua alasan ia tidak ikut dimuat bersama halaman: ia kredensial — memegang
   * hak mengunggah berkas tim — jadi tidak seharusnya tergeletak di layar tiap
   * kali sebuah tim dibuka, apalagi saat layar dibagikan atau dipotret. Dan
   * mengambilnya berarti satu permintaan jaringan tambahan yang hampir selalu
   * tidak terpakai.
   */
  _grupKode() {
    const k = this._kodeTim;
    const terbuka = Boolean(this._kodeTampil && k?.kode);
    const panjang = k?.kode?.length || 8;
    const sisa = k?.sampai ? sisaWaktu(k.sampai) : '';
    // Kode yang sudah lewat waktunya diperlakukan sama dengan tidak ada.
    const adaKode = Boolean(k?.kode) && Boolean(sisa);

    // Tidak ada kode yang hidup: yang tampil HANYA tombol pembuatnya.
    //
    // Titik-titik penyamar dan tombol mata muncul kalau — dan hanya kalau — ada
    // yang bisa disamarkan. Menampilkannya saat kosong menyodorkan kendali yang
    // tidak bisa ditekan, dan membuat panitia mengira ada kode yang gagal
    // dimuat. Keadaan "sedang mengambil" ikut ke cabang ini karena alasan yang
    // sama: saat itu pun belum ada kode.
    if (!adaKode) {
      const nota = k?.memuat ? 'memeriksa kode aktif…' : k?.galat ? k.galat : 'belum ada kode aktif';
      return `
        <div class="pj-grup">
          <h3>Kode kontingen</h3>
          <div class="kode-baris">
            ${k?.memuat ? '' : this._tombolBuatKode('Buat kode kontingen')}
            ${this._pilihJenis ? '' : `<span class="kode-nota">${esc(nota)}</span>`}
          </div>
        </div>`;
    }

    return `
      <div class="pj-grup">
        <h3>Kode kontingen</h3>
        <div class="kode-baris">
          <span class="kode-nilai ${terbuka ? 'terbuka' : ''}">
            ${terbuka ? esc(k.kode) : '•'.repeat(panjang)}
          </span>
          <button class="kode-mata" type="button" data-act="lihat-kode"
                  title="${terbuka ? 'Sembunyikan kode' : 'Tampilkan kode kontingen'}"
                  aria-pressed="${terbuka}"
                  aria-label="${terbuka ? 'Sembunyikan kode kontingen' : 'Tampilkan kode kontingen'}">
            ${terbuka ? IKON_MATA_TUTUP : IKON_MATA}
          </button>
          ${
            terbuka
              ? `<button class="kode-salin ${this._kodeTersalin ? 'selesai' : ''}" type="button"
                         data-act="salin-kode" title="Salin kode kontingen"
                         aria-label="Salin kode kontingen">
                   ${this._kodeTersalin ? IKON_CEK : ICON_SALIN}
                 </button>`
              : ''
          }
          ${
            /* Tombol buat ulang: ikon saja, sebaris dengan tombol mata dan
               salin. Masa berlakunya tidak lagi ditulis di sini — halaman Kode
               Tim dan popup pembuatannya sudah menyebutkannya, dan di panel ini
               ia hanya menambah teks yang dibaca sekali lalu diabaikan.
               Judul tombol tetap memuat peringatan dan sisa waktunya, sehingga
               keduanya tersedia saat benar-benar dibutuhkan: pada detik
               seseorang menimbang menekannya. */
            adaKode
              ? `<span class="kode-jenis">${esc(namaJenis(k.jenis))}</span>
                 ${this._tombolBuatKode('')}`
              : ''
          }
        </div>
      </div>`;
  }

  /**
   * Tombol pembuat kode — dan dua pilihannya begitu ditekan.
   *
   * Pilihannya muncul di tempat, bukan lewat lapisan penuh layar: keputusannya
   * kecil (dua kemungkinan), dan panel ini hanya dua baris. Label kosong berarti
   * bentuk ikon, dipakai saat kode sudah ada dan yang diminta adalah membuat
   * ulang.
   */
  _tombolBuatKode(label) {
    if (this._kodeSibuk) {
      return label
        ? '<button class="kode-buat" type="button" disabled>Membuat…</button>'
        : '<button class="kode-mata" type="button" disabled>' + IKON_ULANG + '</button>';
    }

    if (this._pilihJenis) {
      // Urutannya dari yang paling sempit ke yang paling luas, dan yang paling
      // luas diberi penanda bahaya. Menaruh "hapus" di ujung membuat pilihan
      // bawaan — yang paling dekat, paling mudah ditekan — tetap yang paling
      // aman, alih-alih yang paling berkuasa.
      return `
        <button class="kode-buat" type="button" data-act="buat-kode-unggah"
                title="Hanya mengunggah logo, ID card, dan foto. Berlaku ${UMUR_KODE} untuk SELURUH tim kontingen ini.">
          Unggah saja
        </button>
        <button class="kode-buat" type="button" data-act="buat-kode-penuh"
                title="Membetulkan nick, ID game, dan server pemain yang sudah terdaftar, plus unggah berkas. TIDAK bisa menambah, menghapus pemain, maupun menghapus tim. Berlaku ${UMUR_KODE} untuk SELURUH tim kontingen ini.">
          Ubah + unggah
        </button>
        <button class="kode-buat bahaya" type="button" data-act="buat-kode-hapus"
                title="Semua di atas, DITAMBAH menghapus tim. Tim yang dihapus PIC tidak bisa didaftarkan ulang olehnya. Berlaku ${UMUR_KODE} untuk SELURUH tim kontingen ini.">
          Ubah + hapus
        </button>
        <button class="kode-mata" type="button" data-act="batal-pilih-kode"
                aria-label="Batal membuat kode" title="Batal">
          ${IKON_SILANG}
        </button>`;
    }

    return label
      ? `<button class="kode-buat" type="button" data-act="pilih-jenis-kode"
                 title="Kode berlaku ${UMUR_KODE} sejak dibuat, untuk seluruh tim kontingen ini">${esc(label)}</button>`
      : `<button class="kode-mata" type="button" data-act="pilih-jenis-kode"
                 aria-label="Buat ulang kode kontingen"
                 title="Buat ulang kode — membuat ulang membatalkan yang sekarang">
           ${IKON_ULANG}
         </button>`;
  }

  /**
   * Buat Kode Tim baru untuk KONTINGEN tim yang sedang dibuka.
   *
   * Dibuat dari sini karena di sinilah panitia sedang melihat timnya, bukan
   * karena kodenya milik tim ini: satu kode mencakup seluruh tim kontingen yang
   * sama di semua cabor. Pesan hasilnya menyebutkan itu terang-terangan supaya
   * cakupannya tidak baru diketahui setelah kode terlanjur dibagikan.
   *
   * Hasilnya langsung ditampilkan terbuka: kode ini baru saja dibuat atas
   * permintaan admin dan memang untuk dibacakan ke PIC — menyembunyikannya lagi
   * hanya menambah satu klik tanpa menambah keamanan apa pun.
   */
  async _buatKode(jenis) {
    const team = this._team;
    if (!team || this._kodeSibuk) return;

    this._kodeSibuk = true;
    this._pilihJenis = false;
    this.render();
    try {
      // teamId dikirim, bukan nama kontingennya: GAS yang menyimpulkan
      // kontingen tim ini, sehingga hanya ada SATU tempat yang memutuskan
      // kontingen mana yang dimaksud.
      const hasil = await buatKodeTim({ teamId: team.team_id }, jenis);
      this._kodeTim = { kode: hasil.kode, jenis: hasil.jenis, sampai: hasil.sampai };
      this._kodeTampil = true;
      this._kodeSibuk = false;
      this.render();
      this._pesan(
        `Kode ${namaJenis(hasil.jenis)} dibuat untuk kontingen ` +
          `${hasil.kontingen || team.kontingen} — berlaku untuk SEMUA timnya, ` +
          `${sisaWaktu(hasil.sampai)} lagi.`,
        'sukses'
      );
    } catch (error) {
      this._kodeSibuk = false;
      this.render();
      this._pesan(error.message || 'Gagal membuat kode kontingen.', 'galat');
    }
  }

  /**
   * Ambil keadaan kode untuk KONTINGEN tim yang sedang dibuka — sekali saja.
   *
   * Kodenya ikut terbawa, tapi TETAP TERTUTUP di layar sampai tombol mata
   * ditekan. Itu menjaga alasan aslinya: kredensial tidak seharusnya tergeletak
   * terbaca setiap kali sebuah tim dibuka, apalagi saat layar dibagikan atau
   * dipotret.
   */
  async _muatKode() {
    const team = this._team;
    if (!team || this._kodeMemuat) return;
    // Sudah ada jawabannya (termasuk "tidak ada kode") -> tidak perlu bertanya lagi.
    if (this._kodeTim && !this._kodeTim.memuat) return;

    this._kodeMemuat = true;
    // Sinkron, sebelum await pertama — inilah yang dibaca render yang sedang
    // memanggil fungsi ini.
    this._kodeTim = { memuat: true };
    try {
      // Kosong = kontingen ini belum punya kode aktif. Bukan galat.
      this._kodeTim = kodeKontingen(await ambilKodeTim(), team);
    } catch (error) {
      this._kodeTim = { galat: error.message || 'Gagal mengambil kode' };
    }
    this._kodeMemuat = false;
    // Tim bisa sudah berganti selagi permintaan berjalan.
    if (this._team?.team_id === team.team_id) this.render();
  }

  /** Tampilkan / sembunyikan kode; ambil dari GAS hanya saat pertama diminta. */
  async _toggleKode() {
    if (this._kodeTampil) {
      this._kodeTampil = false;
      this.render();
      return;
    }

    // Sudah pernah diambil -> cukup dibuka lagi, tanpa permintaan baru.
    if (this._kodeTim?.kode) {
      this._kodeTampil = true;
      this.render();
      return;
    }

    const team = this._team;
    if (!team) return;
    this._kodeTim = { memuat: true };
    this.render();

    try {
      this._kodeTim = kodeKontingen(await ambilKodeTim(), team);
      this._kodeTampil = true;
    } catch (error) {
      this._kodeTim = { galat: error.message || 'Gagal mengambil kode' };
      this._kodeTampil = false;
    }
    if (this._team?.team_id === team.team_id) this.render();
  }

  /**
   * Status kelengkapan tim. Ditampilkan di KEDUA layar: di layar verifikasi ia
   * menjawab "tim ini beres atau belum" tanpa menghitung sendiri, dan di layar
   * unggah ia menyebutkan tepat apa yang masih kurang.
   */
  _pitaAturan(team) {
    const masalah = periksaTim(team);
    if (!masalah.length) {
      return `
        <div class="aturan lengkap" role="status">
          ${IKON_CEK}
          <span class="judul">Memenuhi syarat</span>
          <span class="ket">Logo dan ID card lengkap, jumlah TAD dalam batas.</span>
        </div>`;
    }
    return `
      <div class="aturan" role="status">
        ${IKON_PERINGATAN}
        <span class="judul">Belum memenuhi syarat</span>
        <span class="daftar">
          ${masalah.map((m) => `<span class="butir">${esc(m.pesan)}</span>`).join('')}
        </span>
      </div>`;
  }

  /** Lapisan penuh di atas panel untuk memeriksa satu ID card. */
  /**
   * Riwayat perubahan TIM INI — siapa mengubah apa, kapan. Khusus admin.
   *
   * Dimuat atas permintaan, bukan saat panel dibuka. Setiap panggilan Apps
   * Script memakan beberapa detik, dan membuka sebuah tim paling sering
   * dikerjakan untuk memeriksa rosternya — bukan untuk membaca riwayatnya.
   * Menariknya otomatis akan memperlambat pekerjaan yang paling sering
   * dilakukan demi data yang jarang dilihat.
   *
   * Penyaringan per tim terjadi di GAS, bukan di sini: catatan satu tim bisa
   * berselang jauh di antara catatan tim lain, jadi menyaring di browser akan
   * menghasilkan kosong untuk tim yang sebenarnya punya riwayat.
   */
  _grupRiwayat(team) {
    const r = this._riwayat;
    const daftar = r?.daftar || [];

    return `
      <section class="riwayat">
        <div class="riwayat-kepala">
          <h3>Riwayat perubahan</h3>
          ${
            r?.daftar?.length
              ? `<span class="riwayat-nota">
                   Terakhir ${esc(jarakWaktu(daftar[0].waktu))} oleh ${esc(daftar[0].oleh || '—')}
                 </span>`
              : ''
          }
          <button type="button" data-act="muat-riwayat" ${r?.memuat ? 'disabled' : ''}>
            ${r?.memuat ? 'Memuat…' : r ? 'Muat ulang' : 'Lihat riwayat'}
          </button>
        </div>
        ${
          r?.galat
            ? `<p class="riwayat-kosong galat">${esc(r.galat)}</p>`
            : !r || r.memuat
              ? ''
              : daftar.length
                ? perHari(daftar)
                    .map(
                      (g) => `
                      <h4 class="riwayat-hari">${esc(g.label)}</h4>
                      <ol class="riwayat-daftar">
                        ${g.item.map((b) => this._barisRiwayat(b)).join('')}
                      </ol>`
                    )
                    .join('')
                : '<p class="riwayat-kosong">Belum ada perubahan tercatat untuk tim ini.</p>'
        }
      </section>`;
  }

  /**
   * Satu baris riwayat. Lebih rapat daripada di layar <jejak-list>: di sini
   * nama tim sudah jelas dari panelnya sendiri, jadi yang tersisa hanya jam,
   * pelaku, dan apa yang berubah.
   */
  _barisRiwayat(b) {
    const nilai = (v) =>
      v ? `<span class="rw-nilai">${esc(v)}</span>` : '<span class="rw-nilai kosong">kosong</span>';
    return `
      <li class="${jejakMembuang(b) ? 'buang' : ''}">
        <span class="rw-jam">${esc(jamJejak(b.waktu))}</span>
        <span class="rw-isi">
          <b>${esc(b.oleh || '—')}</b>
          <span class="rw-kolom">${esc(b.kolom || 'perubahan')}:</span>
          ${nilai(b.sebelum)} <span class="rw-panah">→</span> ${nilai(b.sesudah)}
        </span>
      </li>`;
  }

  /** Ambil riwayat tim yang sedang dibuka. Dipanggil dari tombolnya. */
  async _muatRiwayat() {
    const team = this._team;
    if (!team || this._riwayat?.memuat) return;
    this._riwayat = { memuat: true };
    this.render();
    var hasil = null;
    var galat = '';
    try {
      hasil = await ambilJejak({ teamId: team.team_id, batas: 40 });
    } catch (error) {
      galat = error.message || 'Gagal mengambil riwayat.';
    }
    // Tim bisa sudah berganti selagi permintaan berjalan; jawaban untuk tim lama
    // tidak boleh menempel di panel tim yang sekarang.
    if (this._team?.team_id !== team.team_id) return;
    this._riwayat = galat ? { galat } : { daftar: hasil.jejak };
    this.render();
  }

  /**
   * Tombol hapus tim untuk PIC — di dasar layar, bukan di menu ⋮.
   *
   * Sengaja TIDAK ditampilkan untuk admin: admin sudah punya jalurnya di menu ⋮
   * daftar tim, dan menghadirkan aksi yang tak bisa dibatalkan di dua tempat
   * hanya menggandakan kesempatan salah tekan tanpa menambah kemampuan apa pun.
   *
   * Menuntut kode jenis 'hapus' — 'penuh' tidak cukup. Itulah gunanya tingkat
   * ketiga: kode yang dibagikan untuk membetulkan nickname tidak ikut memasang
   * tombol yang tak bisa ditarik kembali di dasar halaman. Roster yang terkunci
   * ikut menutupnya, dan GAS menolaknya lagi kalau tombolnya dinyalakan lewat
   * DevTools. Disembunyikan pula selagi mode ubah aktif: layar itu tentang
   * menyimpan perubahan, dan tombol yang membuang segalanya tidak pantas
   * berdiri di sana.
   */
  _zonaBahaya(team) {
    if (!bolehHapusTim(team) || caborTerkunci(team.game) || this._sunting) return '';
    return `
      <div class="zona-bahaya">
        <span class="ket">
          <b>Batal ikut turnamen?</b>
          Menghapus ${esc(team.team_name)} membuang timnya beserta seluruh berkasnya.
        </span>
        <button type="button" data-act="minta-hapus">Hapus tim</button>
      </div>`;
  }

  /**
   * Konfirmasi hapus tim.
   *
   * Yang wajib terbaca di sini bukan "berkasnya ikut terhapus" — itu bisa
   * ditarik dari sampah Drive — melainkan bahwa PIC TIDAK BISA mendaftarkan
   * timnya kembali sendiri. Pendaftaran berjalan lewat form panitia, bukan
   * lewat dashboard ini, jadi tombol ini satu arah bagi peserta. Kalimat itu
   * diberi bidangnya sendiri supaya tidak terlewat sebagai keterangan kecil.
   */
  _kotakHapus() {
    const h = this._hapus;
    if (!h) return '';
    return `
      <div class="lapis" role="dialog" aria-modal="true"
           aria-label="Hapus tim ${esc(h.nama)}">
        <div class="kotak">
          <h3>Hapus ${esc(h.nama)}?</h3>
          <p class="tegas">
            Setelah dihapus, <b>Anda tidak dapat menambahkan tim ini kembali</b>.
            Pendaftaran tim hanya bisa dilakukan panitia, jadi harap berhati-hati
            — hubungi panitia dulu bila masih ragu.
          </p>
          <p>
            Seluruh berkas timnya ikut dibuang: logo, ID card, dan foto. Berkasnya
            masih tertahan 30 hari di sampah Drive panitia, tetapi data timnya
            sendiri langsung hilang dari daftar.
          </p>
          ${h.galat ? `<p class="lapis-galat">${esc(h.galat)}</p>` : ''}
          <div class="lapis-aksi">
            <button type="button" data-act="batal-hapus" ${h.sibuk ? 'disabled' : ''}>
              Batal
            </button>
            <button type="button" class="bahaya" data-act="ya-hapus" ${h.sibuk ? 'disabled' : ''}>
              ${h.sibuk ? 'Menghapus…' : 'Ya, hapus tim'}
            </button>
          </div>
        </div>
      </div>`;
  }

  /**
   * Jalankan penghapusan, lalu tinggalkan halaman timnya.
   *
   * Store dibersihkan sendiri alih-alih memuat ulang seluruh data: daftar tim,
   * kartu ringkasan, dan penyaring kontingen semuanya diturunkan dari state
   * yang sama, jadi membuang satu baris di sana sudah membuat seluruh layar
   * sepakat — tanpa satu pun permintaan tambahan ke GAS.
   */
  async _jalankanHapus() {
    const h = this._hapus;
    if (!h || h.sibuk) return;
    this._hapus = { ...h, sibuk: true, galat: '' };
    this.render();
    try {
      await hapusTim(h.teamId);
      this._hapus = null;
      buangTim(h.teamId);
      // Panelnya menampilkan tim yang sudah tidak ada; kembali ke daftar.
      selectTeam(null);
    } catch (error) {
      this._hapus = { ...h, sibuk: false, galat: error.message || 'Gagal menghapus tim.' };
      this.render();
    }
  }

  _penampilIdCard() {
    const v = this._lihat;
    return `
      <div class="lihat-idcard" role="dialog" aria-label="ID card ${esc(v.nama)}">
        <header>
          <span class="judul">${esc(v.nama)}<small>ID Card — hanya untuk verifikasi</small></span>
          <button class="close" type="button" data-act="tutup-idcard" aria-label="Tutup ID card">×</button>
        </header>
        <div class="isi">
          ${
            v.memuat
              ? '<span class="info">Mengambil berkas…</span>'
              : v.galat
                ? `<span class="info">${esc(v.galat)}</span>`
                : `<img src="${esc(v.dataUrl)}" alt="ID card ${esc(v.nama)}" />`
          }
        </div>
      </div>`;
  }

  _card(member, slot, { sesi, admin }) {
    const nick = member.game_nick || '';
    // Nick wajib berformat "INISIAL. NAMA". Ditandai di kartunya sendiri, bukan
    // hanya dihitung di lencana tabel: yang memperbaikinya perlu tahu SIAPA.
    const hasilNick = periksaNick(nick, this._team?.game);
    const nickSalah = hasilNick.ok ? '' : hasilNick.pesan;
    const nama = member.full_name || nick || '—';
    const tone = STATUS_TONE[member.status] || 'var(--text-muted)';
    const pid = member.player_id || '';

    // Mode ubah menyalakan form untuk SELURUH kartu sekaligus, sehingga satu
    // tim bisa dirapikan lalu disimpan dalam satu kali tekan.

    const pratinjau = this._idcard?.[pid];

    return `
      <li style="--hue:${hueOf(nick || nama)}" data-player="${esc(pid)}">
        <span class="slot">${slot}</span>

        <div class="top">
          <span class="avatar" aria-hidden="true">${esc(initials(nama))}</span>
          <span class="ident">
            <span class="nama-pemain">${esc(nama)}</span>
          </span>
        </div>

        <div class="kotak-game">
          <div class="bagian ${nickSalah ? 'ada-hint' : ''}">
            <span class="lbl">Nick Game</span>
            <span class="val nick ${nickSalah ? 'salah' : ''}">
              ${esc(nick || '—')}
              ${
                nickSalah
                  ? `<i class="nick-tanda" tabindex="0" role="img"
                        aria-label="${esc(nickSalah)}">!</i>`
                  : ''
              }
            </span>
            ${nickSalah ? `<span class="nick-hint" role="tooltip">${esc(nickSalah)}</span>` : ''}
          </div>
          <div class="garis"></div>
          <div class="bagian">
            <span class="lbl">ID Game</span>
            <span class="val id">${esc(member.game_id || '—')}${
      member.game_server ? `<i class="srv">(${esc(member.game_server)})</i>` : ''
    }</span>
          </div>
        </div>

        ${
          // ID card hanya untuk yang sudah masuk. Ditampilkan UTUH di dalam
          // kartu supaya panitia bisa membaca nama dan NIP di kartunya tanpa
          // membuka apa pun; klik hanya untuk memperbesar kalau tulisannya
          // terlalu kecil.
          sesi
            ? `<div class="idcard-blok">
                 <span class="lbl">ID Card</span>
                 ${
                   !member.has_idcard
                     ? '<div class="idcard-kosong">Belum diunggah</div>'
                     : pratinjau?.dataUrl
                       ? `<button class="idcard-gambar" type="button" data-act="lihat-idcard"
                                  data-player="${esc(pid)}"
                                  title="Perbesar ID card ${esc(nama)} (layar lebar)">
                            <img src="${esc(pratinjau.dataUrl)}" alt="ID card ${esc(nama)}" />
                          </button>`
                       : pratinjau?.galat
                         ? `<div class="idcard-kosong">${esc(pratinjau.galat)}</div>`
                         : '<div class="idcard-kosong memuat">Memuat…</div>'
                 }
               </div>`
            : ''
        }

        <div class="kaki">
          ${member.status ? `<span class="status" style="--st:${tone}">${esc(member.status)}</span>` : ''}
          <span class="tumbuh"></span>
          ${
            member.join_date
              ? `<span class="joined" title="Bergabung ${esc(formatDate(member.join_date))}">${esc(
                  year(member.join_date)
                )}</span>`
              : ''
          }
        </div>
      </li>`;
  }

  /**
   * Ambil pratinjau ID card seluruh anggota yang punya berkas.
   *
   * Versi thumbnail, bukan berkas penuh: satu tim bisa 8 orang, dan berkas asli
   * sampai 3 MB masing-masing. Hasilnya di-cache per playerId supaya render
   * ulang (mis. setelah menyunting) tidak menembak ulang jaringan.
   */
  _muatPratinjau(members) {
    this._idcard = this._idcard || {};
    members
      .filter((m) => m.has_idcard && m.player_id && !this._idcard[m.player_id])
      .forEach((m) => {
        this._idcard[m.player_id] = { memuat: true };
        ambilIdCard(m.player_id, { thumb: true })
          .then((dataUrl) => {
            this._idcard[m.player_id] = { dataUrl };
          })
          .catch((error) => {
            this._idcard[m.player_id] = { galat: error.message || 'Gagal memuat' };
          })
          .finally(() => {
            // Panel bisa saja sudah ditutup atau berpindah tim.
            if (this._team?.members?.some((x) => x.player_id === m.player_id)) this.requestRender();
          });
      });
  }

  /**
   * Form sunting menggantikan isi kartu di tempat, bukan membuka dialog kedua.
   * Alasannya konteks: admin sedang membandingkan kartu ini dengan ID card di
   * sebelahnya, dan memindahkannya ke jendela lain memutus perbandingan itu.
   */
  /**
   * Ambil salinan roster untuk disunting. Tiap baris diberi `uid` lokal karena
   * pemain baru belum punya playerId — dan tanpa kunci yang stabil, menghapus
   * baris di tengah akan membuat React-less render ini salah memasangkan nilai.
   */
  _mulaiSunting() {
    this._uid = 0;
    // Nama tim ikut disunting. Disimpan terpisah dari _roster karena ia milik
    // TIM, bukan salah satu pemainnya — dan render ulang tidak boleh
    // mengembalikannya ke nama lama selagi orang masih mengetik.
    this._namaTim = this._team?.team_name || '';
    this._roster = (this._team?.members || []).map((m) => ({
      uid: `u${++this._uid}`,
      playerId: m.player_id || '',
      name: m.full_name || '',
      nick: m.game_nick || '',
      gameId: m.game_id || '',
      server: m.game_server || '',
      status: (m.status || '').toUpperCase(),
      hasIdCard: Boolean(m.has_idcard),
    }));
    this._sunting = true;
    this._pesan('');
    this.render();
    this.$('.sunting input')?.focus();
  }

  /** Simpan tiap ketikan ke _roster supaya render ulang tidak menghapusnya. */
  _catatKetikan(el) {
    if (!this._sunting || !el?.name) return;
    // Nama tim tidak berada di dalam blok pemain mana pun.
    if (el.name === 'teamName') {
      this._namaTim = el.value;
      return;
    }
    const blok = el.closest?.('.sunting[data-uid]');
    if (!blok) return;
    const baris = this._roster.find((r) => r.uid === blok.dataset.uid);
    if (baris && Object.prototype.hasOwnProperty.call(baris, el.name)) baris[el.name] = el.value;
  }

  _tambahPemain() {
    if (this._roster.length >= this._maksPemain()) return;
    this._roster.push({
      uid: `u${++this._uid}`, playerId: '', name: '', nick: '', gameId: '',
      server: '', status: '', hasIdCard: false,
    });
    this.render();
    // Fokus ke kartu yang baru dibuat, bukan ke kartu pertama.
    this.$$('.sunting[data-uid] input[name="name"]').slice(-1)[0]?.focus();
  }

  _hapusPemain(uid) {
    if (this._roster.length <= 1) {
      this._pesan('Tim harus punya minimal satu pemain.', 'galat');
      return;
    }
    this._roster = this._roster.filter((r) => r.uid !== uid);
    this.render();
  }

  async _salinKode() {
    const kode = this._kodeTim?.kode;
    if (!kode) return;
    try {
      await navigator.clipboard.writeText(kode);
      this._kodeTersalin = true;
      this.render();
      clearTimeout(this._timerKode);
      this._timerKode = setTimeout(() => {
        this._kodeTersalin = false;
        this.requestRender();
      }, 1600);
    } catch (error) {
      // Clipboard bisa ditolak; kodenya tetap terlihat untuk disalin manual.
    }
  }

  /**
   * Bilah simpan untuk berkas yang sedang ditahan. Hanya muncul kalau memang
   * ada yang dipilih — layar tanpa antrean tidak perlu tombol yang tak berguna.
   */
  _bilahBerkas() {
    const jumlah = Object.keys(this._pilihan).length;
    if (!jumlah && !this._menyimpan) return '';

    // Selagi mengirim, bilah berubah jadi penunjuk kemajuan. Angka "n dari N"
    // saja tidak cukup: unggahan ke Apps Script memakan beberapa detik per
    // berkas, dan tanpa batang yang bergerak layar terasa menggantung.
    if (this._menyimpan && this._progres) {
      const { selesai, total, nama } = this._progres;
      const persen = total ? Math.round((selesai / total) * 100) : 0;
      return `
        <div class="bilah-simpan bilah-berkas mengirim">
          <span class="bilah-ket">
            <b>${num(selesai + 1)} dari ${num(total)}</b>
            ${nama ? `· ${esc(nama)}` : ''}
          </span>
          <span class="kemajuan" role="progressbar"
                aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${selesai}"
                aria-label="Kemajuan unggahan">
            <span class="kemajuan-isi" style="width:${persen}%"></span>
          </span>
          <span class="kemajuan-angka">${persen}%</span>
        </div>`;
    }

    const gagal = Object.keys(this._pilihan).filter((k) => this._pilihan[k].status === 'gagal').length;
    return `
      <div class="bilah-simpan bilah-berkas">
        <span class="bilah-ket">
          <b>${num(jumlah)} berkas</b> dipilih, belum disimpan${
      gagal ? ` · <i class="gagal">${num(gagal)} gagal</i>` : ''
    }
        </span>
        <button type="button" data-act="batal-berkas">Batal</button>
        <button type="button" class="utama" data-act="simpan-berkas">Simpan ${num(jumlah)} berkas</button>
      </div>`;
  }

  /**
   * Kunci antrean unggahan: JENIS + sasaran, bukan sasaran saja.
   *
   * Dulu kuncinya hanya playerId (atau teamId untuk berkas tingkat tim), dan
   * itu membuat dua jenis berkas untuk sasaran yang sama saling menimpa diam-
   * diam: memilih foto seorang pemain menghapus ID card-nya yang belum
   * tersimpan, dan foto bersama menimpa logo tim. Pratinjau serta penanda
   * 'sedang/gagal' pun bisa tampil di layar yang salah, karena keduanya dicari
   * dengan kunci yang sama.
   */
  _kunciPilihan(kind, sasaran) {
    return `${kind}:${sasaran || ''}`;
  }

  /**
   * Keterangan satu berkas tingkat tim (logo / foto bersama).
   *
   * Menyebut SELURUH keadaan yang bisa dialami berkas itu, bukan hanya
   * "sudah/belum diunggah". Tanpa tahap antara, menekan Simpan terasa seperti
   * tidak terjadi apa-apa: layar diam beberapa detik, lalu berubah — atau tidak
   * berubah sama sekali kalau gagal, dan tidak ada yang mengatakan kenapa.
   */
  _ketPilihan(kunci, sudahAda) {
    const pilihan = this._pilihan[kunci];
    if (pilihan?.status === 'sedang') return 'Mengunggah…';
    if (pilihan?.status === 'gagal') return `Gagal — ${pilihan.galat || 'coba simpan lagi'}`;
    if (pilihan) return 'Dipilih — belum disimpan';
    return sudahAda ? 'Sudah diunggah' : 'Belum diunggah';
  }

  /**
   * Penanda satu baris pemain. Sama seperti _ketPilihan, tetapi sependek
   * mungkin: ia berdiri di baris yang sempit, di sebelah tombol unggah.
   * Judulnya (title) memuat alasan kegagalan yang tidak muat ditulis.
   */
  _tandaBaris(kunci, sudahAda) {
    const pilihan = this._pilihan[kunci];
    if (pilihan?.status === 'sedang') return '<span class="tanda-kecil sedang">Mengunggah…</span>';
    if (pilihan?.status === 'gagal') {
      return `<span class="tanda-kecil gagal" title="${esc(pilihan.galat || '')}">Gagal</span>`;
    }
    if (pilihan) return '<span class="tanda-kecil dipilih">Dipilih</span>';
    return `<span class="tanda-kecil">${sudahAda ? 'Sudah' : 'Belum'}</span>`;
  }

  /** Kelas status ('sedang' / 'gagal') untuk satu sasaran, atau ''. */
  _statusPilihan(kunci) {
    return this._pilihan[kunci]?.status || '';
  }

  /** Kotak pratinjau kecil untuk berkas yang baru dipilih di satu baris. */
  _kotakPilihan(kunci) {
    const p = this._pilihan[kunci];
    if (!p) return '';
    return `
      <span class="pratinjau-baris ${esc(p.status || 'siap')}" title="${esc(p.galat || 'Menunggu disimpan')}">
        <img src="${esc(p.url)}" alt="Pratinjau" />
      </span>`;
  }

  /** Lepaskan object URL pratinjau supaya tidak menahan memori. */
  _lepasPilihan(kunci) {
    if (!this._pilihan) return;
    const kunciBuang = kunci ? [kunci] : Object.keys(this._pilihan);
    kunciBuang.forEach((k) => {
      if (this._pilihan[k]?.url) URL.revokeObjectURL(this._pilihan[k].url);
      delete this._pilihan[k];
    });
  }

  /**
   * Bilah pesan hasil aksi. Selalu dirender (tersembunyi lewat CSS saat kosong)
   * supaya `_pesan()` bisa mengisinya tanpa render ulang seluruh layar — kalau
   * dirender bersyarat, mengisinya di tengah unggahan akan membuang isian yang
   * sedang diketik.
   */
  /**
   * Ikon untuk satu jenis pesan. Dipakai _bilahPesan() (saat render) DAN
   * _pesan() (saat pesan diganti tanpa render). Dulu keduanya menyimpan
   * petanya masing-masing dan sempat berbeda isi — 'sibuk' punya entri di satu
   * tempat dan tidak di tempat lain, sehingga pemutarnya muncul atau hilang
   * tergantung jalur mana yang kebetulan menulis terakhir.
   */
  _ikonPesan(jenis) {
    return { galat: IKON_PERINGATAN, sukses: IKON_CEK, sibuk: IKON_SIBUK }[jenis] || '';
  }

  _bilahPesan() {
    const ikon = this._ikonPesan(this._pesanJenis);
    return `
      <p class="pesan ${esc(this._pesanJenis)}" role="status" aria-live="polite">
        ${ikon}<span class="pesan-teks">${esc(this._pesanTeks)}</span>
      </p>`;
  }

  /** Berapa slot pemain tersedia per tim; dari GAS, bukan angka yang ditulis ulang. */
  _maksPemain() {
    return store.state.meta?.maxPlayers || 8;
  }

  _pilihanStatus() {
    return store.state.meta?.statusPemain?.length
      ? store.state.meta.statusPemain
      : ['TETAP', 'PKWT', 'TAD', 'KRIYA'];
  }

  /**
   * Satu kartu dalam mode ubah. Nilainya dibaca dari `this._roster`, bukan dari
   * store — kalau tidak, menambah atau menghapus satu baris akan me-render ulang
   * dan menghapus apa yang sedang diketik di kartu lain.
   */
  _formSunting(baris, nomor) {
    const id = esc(baris.uid);
    const pilihan = this._pilihanStatus();
    const status = (baris.status || '').toUpperCase();

    /* PIC tim menyunting dengan wewenang yang jauh lebih sempit daripada admin.
       Pada pemain yang SUDAH terdaftar ia hanya boleh membetulkan data
       PERMAINAN: Nick Game, ID Game, dan Server — ketiganya hanya ia yang tahu,
       dan paling sering salah ketik saat pendaftaran. Nama dan status
       kepegawaian berasal dari pendaftaran resmi: mengubah nama berarti menukar
       orang, dan status menentukan kelayakan tim (batas jumlah TAD). Menghapus
       pemain juga bukan haknya.
       Pemain BARU tidak dibatasi — seluruh datanya memang berasal dari PIC.
       Semua batas ini ditegakkan ULANG di GAS; yang di sini hanya supaya tidak
       ada tombol yang menjanjikan sesuatu yang akan ditolak. */
    const terbatas = this._suntingTerbatas() && Boolean(baris.playerId);

    return `
      <li style="--hue:${hueOf(baris.nick || baris.name || String(nomor))}" data-uid="${id}">
        <span class="slot">${nomor}</span>
        <div class="sunting" data-uid="${id}">
          <div class="sunting-kepala">
            <span class="sunting-tanda">${baris.playerId ? `Pemain ${nomor}` : 'Pemain baru'}</span>
            ${
              terbatas
                ? '<span class="sunting-nota">Nama & status dikunci panitia</span>'
                : `<button type="button" class="hapus" data-act="hapus-pemain" data-uid="${id}"
                           title="Hapus pemain ini" aria-label="Hapus pemain ${esc(baris.name || nomor)}">
                     ${ICON_HAPUS}
                   </button>`
            }
          </div>
          <div>
            <label for="f-nama-${id}">Nama lengkap</label>
            <input id="f-nama-${id}" name="name" value="${esc(baris.name || '')}" autocomplete="off"
                   ${terbatas ? 'readonly tabindex="-1"' : ''} />
          </div>
          <div>
            <label for="f-nick-${id}">Nick Game</label>
            <input id="f-nick-${id}" name="nick" value="${esc(baris.nick || '')}" autocomplete="off" />
          </div>
          <div class="dua">
            <div>
              <label for="f-gid-${id}">ID Game</label>
              <input id="f-gid-${id}" name="gameId" value="${esc(baris.gameId || '')}"
                     inputmode="numeric" autocomplete="off" />
            </div>
            <div>
              <label for="f-srv-${id}">Server</label>
              <input id="f-srv-${id}" name="server" value="${esc(baris.server || '')}" autocomplete="off" />
            </div>
          </div>
          <div>
            <label for="f-sts-${id}">Status</label>
            <select id="f-sts-${id}" name="status" ${terbatas ? 'disabled' : ''}>
              <option value=""${status ? '' : ' selected'}>— pilih —</option>
              ${pilihan
                .map((v) => `<option value="${esc(v)}"${status === v ? ' selected' : ''}>${esc(v)}</option>`)
                .join('')}
            </select>
          </div>

          <div class="baris-idcard">
            <span class="idcard-status ${baris.hasIdCard ? 'ada' : ''}">
              ID Card · ${baris.hasIdCard ? 'sudah' : 'belum'}
            </span>
            ${
              /* Berkas yang baru dipilih HARUS terlihat di sini juga. Tanpa ini
                 mode ubah adalah jalan buntu: berkasnya masuk antrean tanpa
                 satu pun tanda, lalu terbaca seperti tidak ada yang terpilih. */
              baris.playerId ? this._kotakPilihan(this._kunciPilihan('idcard', baris.playerId)) : ''
            }
            ${
              baris.playerId
                ? this._tandaBaris(this._kunciPilihan('idcard', baris.playerId), baris.hasIdCard)
                : ''
            }
            ${
              // Pemain baru belum punya player_id — dan nama berkas di Drive
              // diturunkan darinya. Jadi unggahannya menunggu simpanan pertama.
              baris.playerId
                ? `<button type="button" class="unggah kecil" data-act="unggah-idcard"
                           data-player="${esc(baris.playerId)}">
                     ${baris.hasIdCard ? 'Ganti' : 'Unggah'}
                   </button>`
                : `<button type="button" class="unggah kecil" disabled
                           title="Simpan dulu supaya pemain ini punya ID">Unggah</button>`
            }
          </div>
        </div>
      </li>`;
  }



  /**
   * Ambil pratinjau ID card seluruh anggota yang punya berkas.
   *
   * Versi thumbnail, bukan berkas penuh: satu tim bisa 8 orang, dan berkas asli
   * sampai 3 MB masing-masing. Hasilnya di-cache per playerId supaya render
   * ulang (mis. setelah menyunting) tidak menembak ulang jaringan.
   */

  onMount() {
    // `immediate` WAJIB: komponen ini kini dibuat SETELAH tim dipilih, jadi
    // tanpa panggilan awal ia akan menunggu perubahan store yang mungkin tidak
    // pernah datang, dan halaman tampil kosong.
    this.track(
      store.subscribe((state) => {
        const team = this._lookup(state);
        // Daftar layarnya harus lengkap di sini: memetakan apa pun selain
        // 'berkas' menjadi 'lihat' membuat layar baru (mis. 'foto') diam-diam
        // terjatuh ke layar verifikasi.
        const modeBaru = ['berkas', 'foto'].includes(state.selectedFocus) ? state.selectedFocus : 'lihat';
        // Perbandingan HARUS mencakup mode, bukan hanya timnya. Berpindah antara
        // "Lihat tim" dan "Unggah berkas" pada tim yang SAMA tidak mengubah
        // objek tim sama sekali — keluar lebih awal di sini membuat layarnya
        // tidak pernah berganti.
        if (team === this._team && modeBaru === this._mode) return;

        // Berpindah ke tim lain -> bersihkan kode, pesan, dan pratinjau tim
        // sebelumnya. Pratinjau ikut dibuang karena ia data pribadi yang tidak
        // perlu menetap di memori lebih lama dari kebutuhannya.
        if (team?.team_id !== this._team?.team_id) {
          this._pesanTeks = '';
          this._pesanJenis = '';
          this._sunting = false;
          this._lihat = null;
          this._idcard = {};
          this._kodeTim = null;
          this._kodeMemuat = false;
          this._pilihJenis = false;
          this._kodeTampil = false;
          // Dialog hapus menunjuk tim TERTENTU; membiarkannya terbuka saat tim
          // berganti berarti tombol "Ya, hapus" menghapus tim yang tidak lagi
          // terlihat di layar.
          this._hapus = null;
          this._namaTim = null;
          this._riwayat = null;
          this._lepasPilihan();
        }
        // Mode ditentukan menu baris: "Unggah berkas" -> layar unggah,
        // "Lihat tim" atau klik baris -> layar verifikasi.
        this._mode = modeBaru;

        const timBaru = team && team.team_id !== this._team?.team_id;
        this._team = team || null;
        this.requestRender();
        // Hanya saat benar-benar berpindah tim — render ulang akibat unggahan
        // tidak boleh merebut fokus dari apa pun yang sedang dipakai.
        if (timBaru) this._fokusAwal();
      }, true)
    );

    // Sesi berubah (masuk/keluar/kedaluwarsa) -> tombol lihat & sunting ikut
    // muncul atau hilang, dan suntingan yang sedang terbuka harus ditutup.
    this.track(
      onAuth(() => {
        if (this._sunting && !this._bolehUbah()) this._sunting = false;
        // Sesi habis di tengah konfirmasi: dialognya ditutup, bukan dibiarkan
        // menawarkan tombol yang pasti dijawab "Sesi berakhir" oleh GAS.
        if (this._hapus && !this._bolehUbah()) this._hapus = null;
        if (this._lihat && !sesiSekarang()) this._lihat = null;
        if (this._team) this.requestRender();
      })
    );

    this.listen(this.shadowRoot, 'click', (event) => {
      // Lapisan konfirmasi hapus diperiksa PALING awal: ia menutupi seluruh
      // panel, dan klik apa pun di dalamnya tidak boleh merembes menjadi aksi
      // di layar yang tertutup di belakangnya.
      if (this._hapus) {
        if (event.target.closest('[data-act="ya-hapus"]')) {
          this._jalankanHapus();
          return;
        }
        // Selagi penghapusan berjalan, menutup dialog hanya menyembunyikan
        // permintaan yang tetap jalan — dan hasilnya tidak pernah terbaca.
        if (this._hapus.sibuk) return;
        // HANYA tombol Batal yang menutup. Klik di latar sengaja diabaikan:
        // dialog ini memuat peringatan yang harus dibaca, dan satu sentuhan
        // meleset di layar sentuh membuangnya sebelum sempat terbaca — termasuk
        // pesan galat yang baru saja muncul di dalamnya.
        if (event.target.closest('[data-act="batal-hapus"]')) {
          this._hapus = null;
          this.render();
        }
        return;
      }

      if (event.target.closest('[data-act="muat-riwayat"]')) {
        this._muatRiwayat();
        return;
      }

      if (event.target.closest('[data-act="minta-hapus"]')) {
        const team = this._team;
        if (team) {
          this._hapus = { teamId: team.team_id, nama: team.team_name, sibuk: false, galat: '' };
          this.render();
        }
        return;
      }

      if (event.target.closest('[data-act="tutup-idcard"]')) {
        this._lihat = null;
        this.render();
        return;
      }
      // Penampil ID card menutupi panel; tombol tutup panel di belakangnya
      // tidak boleh ikut terpicu.
      if (this._lihat) return;

      if (event.target.closest('[data-act="kembali"]')) {
        selectTeam(null);
        return;
      }

      const lihat = event.target.closest('[data-act="lihat-idcard"]');
      if (lihat) {
        // CSS sudah mematikan sentuhannya di ponsel, tapi penekanan lewat papan
        // ketik tidak melalui pointer-events — jadi aturannya ditegakkan di sini
        // juga, di satu tempat yang sama-sama berlaku untuk keduanya.
        if (!this._bolehPerbesar()) return;
        this._bukaIdCard(lihat.dataset.player);
        return;
      }

      if (event.target.closest('[data-act="buat-kode-penuh"]')) {
        this._buatKode(JENIS_KODE.PENUH);
        return;
      }
      if (event.target.closest('[data-act="buat-kode-unggah"]')) {
        this._buatKode(JENIS_KODE.UNGGAH);
        return;
      }
      if (event.target.closest('[data-act="buat-kode-hapus"]')) {
        this._buatKode(JENIS_KODE.HAPUS);
        return;
      }
      if (event.target.closest('[data-act="pilih-jenis-kode"]')) {
        this._pilihJenis = true;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="batal-pilih-kode"]')) {
        this._pilihJenis = false;
        this.render();
        return;
      }

      if (event.target.closest('[data-act="lihat-kode"]')) {
        this._toggleKode();
        return;
      }

      if (event.target.closest('[data-act="salin-kode"]')) {
        this._salinKode();
        return;
      }

      if (event.target.closest('[data-act="mulai-sunting"]')) {
        if (this._bolehUbah()) this._mulaiSunting();
        return;
      }

      if (event.target.closest('[data-act="batal-sunting"]')) {
        this._sunting = false;
        this._roster = null;
        this._namaTim = null;
        this._pesan('');
        this.render();
        return;
      }

      const hapus = event.target.closest('[data-act="hapus-pemain"]');
      if (hapus) {
        // PIC tim tidak boleh menghapus pemain. GAS menolaknya juga, tapi
        // menolak di sini membuat penolakannya terasa sebagai aturan, bukan
        // sebagai kegagalan simpan yang membingungkan.
        if (this._suntingTerbatas()) return;
        this._hapusPemain(hapus.dataset.uid);
        return;
      }

      if (event.target.closest('[data-act="tambah-pemain"]')) {
        // Ditegakkan di penangan juga, bukan hanya dengan menyembunyikan
        // tombolnya: penekanan lewat papan ketik dan tombol yang dimunculkan
        // lewat DevTools melewati markup, tidak melewati sini.
        if (this._suntingTerbatas()) return;
        this._tambahPemain();
        return;
      }

      if (event.target.closest('[data-act="simpan-berkas"]')) {
        this._simpanBerkas();
        return;
      }

      if (event.target.closest('[data-act="batal-berkas"]')) {
        this._batalPilihan();
        return;
      }

      if (event.target.closest('[data-act="simpan-sunting"]')) {
        this._simpanSuntingan();
        return;
      }

      const unggahPemain = event.target.closest('[data-act="unggah-idcard"]');
      if (unggahPemain) {
        this._pilihBerkas('idcard', unggahPemain.dataset.player);
        return;
      }

      if (event.target.closest('[data-act="unggah-foto-tim"]')) {
        this._pilihBerkas('foto', null);
        return;
      }

      const fotoPemain = event.target.closest('[data-act="unggah-foto"]');
      if (fotoPemain) {
        this._pilihBerkas('foto', fotoPemain.dataset.player);
        return;
      }

      const tombol = event.target.closest('.unggah');
      if (tombol) this._pilihBerkas(tombol.dataset.kind);
    });

    this.listen(this.shadowRoot, 'change', (event) => {
      if (event.target.id === 'berkas' && event.target.files?.[0]) {
        this._pilihanBaru(event.target.files[0]);
      }
    });

    this.listen(this.shadowRoot, 'input', (event) => {
      this._catatKetikan(event.target);
    });
    // <select> tidak memancarkan 'input' di semua browser lama; 'change' ikut
    // didengar supaya pilihan status tetap tercatat.
    this.listen(this.shadowRoot, 'change', (event) => this._catatKetikan(event.target));
    this.listen(document, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      // Esc menutup lapisan terluar lebih dulu, bukan langsung seluruh panel.
      if (this._lihat) {
        this._lihat = null;
        this.render();
        return;
      }
      if (this._sunting) {
        this._sunting = false;
        this.render();
        return;
      }
      selectTeam(null);
    });
  }

  /** Ambil dan tampilkan ID card satu pemain. Butuh sesi admin/relawan. */
  async _bukaIdCard(playerId) {
    const pemain = (this._team?.members || []).find((m) => m.player_id === playerId);
    if (!pemain) return;

    this._lihat = { playerId, nama: pemain.full_name || pemain.game_nick || '—', memuat: true };
    this.render();

    try {
      const dataUrl = await ambilIdCard(playerId);
      // Pengguna bisa saja sudah menutup penampilnya atau membuka pemain lain.
      if (this._lihat?.playerId !== playerId) return;
      this._lihat = { ...this._lihat, memuat: false, dataUrl };
    } catch (error) {
      if (this._lihat?.playerId !== playerId) return;
      this._lihat = { ...this._lihat, memuat: false, galat: error.message || 'Gagal mengambil ID card.' };
    }
    this.render();
  }

  /**
   * Kumpulkan seluruh kartu, kirim yang BERUBAH saja dalam satu permintaan.
   *
   * Mengirim hanya yang berubah bukan sekadar penghematan: GAS mencatat tiap
   * perubahan ke sheet jejak, jadi mengirim nilai yang sama persis akan
   * memenuhi riwayat dengan baris "A -> A".
   */
  /**
   * Kirim seluruh roster yang diinginkan dalam SATU permintaan.
   *
   * Yang dikirim adalah keadaan akhir, bukan daftar perintah: GAS membandingkan
   * dengan isi sheet dan menyimpulkan sendiri mana yang berubah, bertambah, dan
   * terhapus. Itu membuat kombinasi apa pun (hapus lalu tambah, urutan berubah)
   * tertangani jalur yang sama.
   */
  async _simpanSuntingan() {
    const team = this._team;
    if (!team || !this._roster) return;

    // Nama tim: HANYA ADMIN. `adalahAdmin()` dipanggil langsung, bukan memakai
    // variabel `admin` dari render() — metode ini bukan bagian dari render, jadi
    // variabel lokalnya tidak terlihat dari sini.
    //
    // Diperiksa lebih dulu karena ia identitas barisnya, dan menolak setelah
    // seluruh roster terkirim berarti orang menunggu sia-sia. Untuk PIC
    // kontingen, kolomnya tidak pernah dirender — this._namaTim tetap sama
    // dengan nama tim yang sudah ada — jadi tidak pernah terkirim sebagai
    // perubahan (lihat simpanRoster di bawah).
    const bolehUbahNama = adalahAdmin();
    const namaTim = String((this._namaTim ?? team.team_name)).trim();
    if (bolehUbahNama) {
      if (!namaTim) {
        this._pesan('Nama tim tidak boleh kosong.', 'galat');
        this.$('.ubah-nama')?.focus();
        return;
      }
      if (namaTim.length > 80) {
        this._pesan('Nama tim terlalu panjang (maksimal 80 karakter).', 'galat');
        this.$('.ubah-nama')?.focus();
        return;
      }
    }

    const kosong = this._roster.find((r) => !r.name.trim());
    if (kosong) {
      this._pesan('Ada pemain tanpa nama. Isi atau hapus barisnya.', 'galat');
      this.$(`.sunting[data-uid="${CSS.escape(kosong.uid)}"] input[name="name"]`)?.focus();
      return;
    }

    const roster = this._roster.map((r) => ({
      playerId: r.playerId || '',
      name: r.name.trim(),
      nick: r.nick.trim(),
      gameId: r.gameId.trim(),
      server: r.server.trim(),
      status: r.status.trim().toUpperCase(),
    }));

    // Berkas yang dipilih dari mode ubah ikut dikirim oleh tombol yang sama.
    // Dulu ia hanya menyimpan roster, sehingga ID card yang baru dipilih diam
    // di antrean tanpa jalan keluar — dan kalau tidak ada field yang berubah,
    // GAS menjawab "Tidak ada perubahan untuk disimpan", membuat seluruh aksi
    // terbaca seperti gagal total.
    const adaBerkas = Object.keys(this._pilihan).length > 0;
    const berubah = this._rosterBerubah(roster);
    // Nama berbeda dari yang tersimpan HARUS memicu jalur yang sama dengan
    // roster berubah — kalau tidak, mengubah HANYA nama tim (tanpa menyentuh
    // satu pun pemain atau berkas) berhenti di sini dengan "Tidak ada
    // perubahan", padahal justru ada satu perubahan yang belum terkirim.
    const namaBerubah = bolehUbahNama && namaTim !== team.team_name.trim();

    if (!berubah && !adaBerkas && !namaBerubah) {
      this._pesan('Tidak ada perubahan untuk disimpan.', 'galat');
      return;
    }

    // Ditandai lewat state lalu dirender, bukan dengan mematikan tombol satu
    // per satu: dengan begitu bilahnya ikut berubah jadi "Menyimpan…" beserta
    // pemutarnya. Sebelumnya tombol hanya meredup tanpa satu kata pun, dan
    // permintaan yang memakan beberapa detik terbaca seperti tidak jalan.
    this._menyimpan = true;
    this.render();

    if (!berubah && !namaBerubah) {
      // Hanya berkas yang berubah: lewati permintaan roster sama sekali.
      // _menyimpan dibiarkan menyala — _simpanBerkas() yang akan mematikannya,
      // sehingga tidak ada kedipan "selesai" di antara kedua tahap.
      this._sunting = false;
      this._roster = null;
      this._namaTim = null;
      this.render();
      await this._simpanBerkas();
      return;
    }

    this._pesan(`Menyimpan ${roster.length} pemain…`, 'sibuk');

    try {
      // Dikirim hanya untuk admin. PIC kontingen tidak diberi wewenang ini;
      // mengirim nama yang tidak berubah pun tidak masalah — GAS mengabaikannya
      // untuk peran tim — tapi tidak mengirimnya sama sekali lebih jelas
      // maksudnya saat membaca jejak permintaan.
      const hasil = await simpanRoster(team.team_id, roster, bolehUbahNama ? namaTim : '');

      // Susun ulang anggota di store dari jawaban server: playerId pemain baru
      // ditentukan GAS, jadi kita tidak boleh menebaknya sendiri.
      const lama = new Map(team.members.map((m) => [m.player_id, m]));
      const anggotaBaru = roster.map((r, i) => {
        const pid = hasil.roster[i]?.playerId || r.playerId;
        const asal = lama.get(pid);
        return {
          ...(asal || { id: `${team.team_id}#${i}`, has_idcard: false, join_date: '', join_year: '' }),
          player_id: pid,
          full_name: r.name,
          game_nick: r.nick,
          game_id: r.gameId,
          game_server: r.server,
          status: r.status,
        };
      });
      // Nama yang dipakai adalah yang DIKEMBALIKAN server, bukan yang diketik:
      // kalau GAS menolak perubahannya karena suatu sebab, layar harus
      // menampilkan nama yang benar-benar tersimpan.
      gantiRoster(team.team_id, anggotaBaru, hasil.teamName || namaTim);

      this._sunting = false;
      this._roster = null;
      this._namaTim = null;
      if (!adaBerkas) this._menyimpan = false;
      this.render();

      if (adaBerkas) {
        // Urutannya penting: pemain baru baru punya Player ID setelah roster
        // tersimpan, dan nama berkas di Drive diturunkan dari ID itu.
        await this._simpanBerkas(`${hasil.jumlah} perubahan tersimpan. `);
        return;
      }
      this._pesan(`${hasil.jumlah} perubahan tersimpan.`, 'sukses');
    } catch (error) {
      const pesan = error.message || 'Gagal menyimpan.';

      // GAS menolak simpanan yang tidak mengubah apa pun. Perbandingan di sini
      // dan perbandingan di sana bisa berbeda pendapat soal nilai yang setara
      // (huruf besar/kecil, spasi). Kalau itu yang terjadi, berkas yang
      // mengantre TIDAK boleh ikut batal — penolakan itu berarti rosternya
      // memang sudah benar, bukan bahwa aksinya gagal.
      if (/tidak ada perubahan/i.test(pesan) && adaBerkas) {
        this._sunting = false;
        this._roster = null;
        this.render();
        await this._simpanBerkas();
        return;
      }

      // Gagal: bilahnya kembali bisa ditekan supaya bisa dicoba lagi.
      this._menyimpan = false;
      this.render();
      this._pesan(pesan, 'galat');
    }
  }

  /** Bolehkah sesi ini menyunting tim yang sedang dibuka? */
  _bolehUbah() {
    return adalahAdmin() || bolehSuntingTim(this._team);
  }

  /**
   * Sedang menyunting dengan wewenang terbatas (PIC tim, bukan admin)?
   *
   * Menentukan field mana yang dikunci, dan bahwa tombol tambah maupun hapus
   * pemain tidak muncul: PIC membetulkan pemain yang sudah terdaftar, tidak
   * menyusun ulang daftarnya.
   */
  _suntingTerbatas() {
    return !adalahAdmin() && adalahTim();
  }

  /**
   * Bolehkah ID card diperbesar? Tidak di layar sempit.
   *
   * Ambangnya disamakan dengan media query di atas (720 px). matchMedia dibaca
   * saat ditekan, bukan disimpan saat dimuat, supaya layar yang diputar atau
   * jendela yang diubah ukurannya langsung mengikuti tanpa render ulang.
   */
  _bolehPerbesar() {
    return !window.matchMedia('(max-width: 720px)').matches;
  }

  /**
   * Apakah roster yang sedang disunting berbeda dari yang tersimpan?
   *
   * Dipakai untuk memutuskan apakah permintaan simpan roster perlu dikirim sama
   * sekali. Tanpa ini, menyimpan berkas saja akan tetap memanggil GAS dan
   * ditolak dengan "Tidak ada perubahan untuk disimpan" — penolakan yang benar,
   * tapi menutupi unggahan yang sebenarnya berhasil.
   */
  _rosterBerubah(roster) {
    const lama = this._team?.members || [];
    if (lama.length !== roster.length) return true;
    return roster.some((r, i) => {
      const m = lama[i];
      if (!m) return true;
      return (
        (r.playerId || '') !== (m.player_id || '') ||
        r.name !== (m.full_name || '') ||
        r.nick !== (m.game_nick || '') ||
        r.gameId !== (m.game_id || '') ||
        r.server !== (m.game_server || '') ||
        r.status !== (m.status || '').toUpperCase()
      );
    });
  }

  /**
   * Tentukan sasaran unggahan, lalu buka pemilih berkas.
   *
   * Wewenangnya boleh datang dari dua arah: Kode Tim yang dipegang PIC, atau
   * sesi admin. Admin tidak dimintai kode — GAS menerima sesinya sebagai ganti.
   */
  /**
   * Pilih berkas untuk satu sasaran. TIDAK langsung mengirim — berkasnya
   * ditahan (staged) sampai pengguna menekan Simpan.
   *
   * Kode tim tidak diminta di sini lagi, melainkan saat menyimpan: memilih
   * berkas lalu ditolak karena kode kosong memaksa mengulang pemilihan.
   */
  _pilihBerkas(kind, playerId = null) {
    // Roster terkunci: Kode Tim berhenti berlaku. Ditahan di sini supaya tidak
    // ada berkas yang dikompres dan dikirim hanya untuk ditolak GAS.
    if (!adalahAdmin() && caborTerkunci(this._team?.game)) {
      this._pesan('Roster cabor ini sudah dikunci panitia — Kode Tim tidak berlaku lagi.', 'galat');
      return;
    }

    // Logo wajib ada sebelum ID card. Aturan alur kerja, bukan batas keamanan.
    // Logo yang BARU DIPILIH (belum terkirim) sudah dihitung memenuhi — kalau
    // tidak, pengguna terpaksa menyimpan dua kali padahal ia sudah memilihnya.
    // Admin dikecualikan: aturan ini menjaga kelengkapan kiriman PIC, sedangkan
    // admin sedang memperbaiki data. Foto tidak pernah dikunci — ia opsional.
    if (kind === 'idcard' && !adalahAdmin() && !this._team?.logo_url && !this._adaLogoDipilih()) {
      this._pesan('Pilih logo tim dulu — logo wajib sebelum ID card.', 'galat');
      this.$('.logo-mini')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const input = this.$('#berkas');
    if (!input) return;
    this._sasaran = {
      kind,
      kunci: this._kunciPilihan(kind, playerId || this._team?.team_id),
      playerId,
    };
    input.value = '';
    input.click();
  }

  _adaLogoDipilih() {
    return Object.keys(this._pilihan).some((k) => this._pilihan[k].kind === 'logo');
  }

  /** Berkas dipilih: tahan beserta pratinjaunya, jangan kirim dulu. */
  _pilihanBaru(file) {
    const sasaran = this._sasaran;
    if (!sasaran?.kunci) return;
    this._lepasPilihan(sasaran.kunci);
    this._pilihan[sasaran.kunci] = {
      url: URL.createObjectURL(file),
      file,
      kind: sasaran.kind,
      playerId: sasaran.playerId || '',
    };
    this._pesan('');
    this.render();
  }

  _batalPilihan() {
    this._lepasPilihan();
    this._pesan('');
    this.render();
  }

  /**
   * Kirim seluruh berkas yang ditahan — satu permintaan per berkas, berurutan.
   *
   * SENGAJA tidak digabung jadi satu permintaan: delapan gambar 3 MB berarti
   * ~32 MB base64 dalam satu POST, rawan ditolak batas Apps Script, dan kalau
   * gagal maka gagal semuanya tanpa bisa ditunjuk yang mana.
   *
   * Konsekuensinya "Simpan" BUKAN transaksi utuh: kalau berkas ke-5 gagal,
   * empat yang pertama sudah tersimpan. Itu dilaporkan apa adanya — yang
   * berhasil dilepas dari antrean, yang gagal tetap tertahan dan ditandai
   * merah supaya tinggal dicoba ulang.
   */
  async _simpanBerkas(awalan = '') {
    const team = this._team;
    // Setiap jalan keluar awal WAJIB memadamkan penandanya: fungsi ini bisa
    // dipanggil dari mode ubah data, yang menyalakannya lebih dulu. Kalau
    // dilewatkan, bilahnya membeku bertuliskan "Menyimpan…" selamanya.
    const batal = () => {
      if (this._menyimpan) {
        this._menyimpan = false;
        this.render();
      }
    };

    if (!team) return batal();

    const antre = Object.keys(this._pilihan).map((kunci) => ({ kunci, ...this._pilihan[kunci] }));
    if (!antre.length) return batal();

    // Logo didahulukan: GAS menolak ID card selama logo tim belum ada, jadi
    // mengirim ID card lebih dulu akan gagal padahal logonya ada di antrean.
    antre.sort((a, b) => (a.kind === 'logo' ? -1 : 0) - (b.kind === 'logo' ? -1 : 0));

    // Wewenangnya sudah dibuktikan sesi; tidak ada kode yang perlu dibaca dari
    // layar. Kalau sesinya tidak berhak, GAS yang menolak — dan pesannya
    // diteruskan apa adanya ke bilah pesan.
    if (!bolehUnggahTim(team)) {
      batal();
      this._pesan('Masuk dulu dengan Kode Tim kontingen ini untuk mengunggah berkas.', 'galat');
      return;
    }

    this._menyimpan = true;
    const { meta } = store.state;
    var berhasil = 0;
    var dibatalkan = 0;
    const gagal = [];

    for (var i = 0; i < antre.length; i++) {
      const item = antre[i];
      this._progres = { selesai: i, total: antre.length, nama: this._labelBerkas(item) };
      // Kemajuan juga diucapkan lewat bilah pesan, bukan hanya lewat batang di
      // bawah: batang itu hanya ada di layar unggah, sedangkan unggahan bisa
      // dijalankan dari mode ubah data yang tidak memilikinya.
      this._pesan(
        `Mengunggah ${num(i + 1)} dari ${num(antre.length)} — ${this._labelBerkas(item)}…`,
        'sibuk'
      );
      this._pilihan[item.kunci].status = 'sedang';
      this.render();

      try {
        const hasil = await uploadTeamFile({
          endpoint: meta?.endpoint,
          teamId: team.team_id,
          playerId: item.playerId,
          token: sesiSekarang()?.token || '',
          kind: item.kind,
          file: item.file,
          maxBytes: meta?.maxUploadBytes,
        });

        this._terapkanHasil(team, item, hasil);
        this._lepasPilihan(item.kunci); // berhasil -> keluar dari antrean
        berhasil++;
      } catch (error) {
        const pesan = error.message || 'Gagal.';

        // Gagal -> DIBIARKAN di antrean, ditandai, supaya bisa dicoba ulang
        // tanpa memilih berkasnya lagi.
        if (this._pilihan[item.kunci]) {
          this._pilihan[item.kunci].status = 'gagal';
          this._pilihan[item.kunci].galat = pesan;
        }
        gagal.push(pesan);

        // Galat yang berlaku untuk SELURUH antrean — kode tim salah, sesi
        // berakhir, tim tidak ditemukan — tidak akan berubah pada berkas
        // berikutnya. Meneruskannya hanya menghasilkan tujuh kegagalan identik
        // dan membuat pengguna menunggu percuma.
        if (GALAT_MENYELURUH.test(pesan)) {
          dibatalkan = antre.length - i - 1;
          // Sisanya belum sempat dicoba: statusnya dikosongkan supaya tidak
          // ditandai merah seolah-olah ikut ditolak.
          for (var j = i + 1; j < antre.length; j++) {
            const sisa = this._pilihan[antre[j].kunci];
            if (sisa) {
              delete sisa.status;
              delete sisa.galat;
            }
          }
          break;
        }
      }
    }

    this._menyimpan = false;
    this._progres = null;
    this.render();

    if (!gagal.length) {
      this._pesan(`${awalan}${berhasil} berkas tersimpan.`, 'sukses');
      return;
    }

    const sudah = berhasil ? `${berhasil} tersimpan. ` : '';
    if (dibatalkan) {
      this._pesan(
        `${awalan}${sudah}${gagal[0]} ${dibatalkan} berkas berikutnya dibatalkan — ` +
          'perbaiki dulu, lalu tekan Simpan lagi.',
        'galat'
      );
      return;
    }

    this._pesan(
      `${awalan}${sudah}${gagal.length} gagal — ${gagal[0]} ` +
        'Berkas yang gagal masih tersimpan di daftar, tinggal tekan Simpan lagi.',
      'galat'
    );
  }

  /** Nama yang enak dibaca untuk satu antrean, dipakai di penunjuk kemajuan. */
  _labelBerkas(item) {
    if (item.kind === 'logo') return 'Logo tim';
    const pemain = (this._team?.members || []).find((m) => m.player_id === item.playerId);
    const nama = pemain?.full_name || '';
    if (item.kind === 'foto') return nama ? `Foto ${nama}` : 'Foto bersama';
    return nama ? `ID Card ${nama}` : 'ID Card';
  }

  /** Cerminkan satu unggahan yang berhasil ke store. */
  _terapkanHasil(team, item, hasil) {
    if (item.kind === 'logo') {
      applyUpload(team.team_id, { logo_url: hasil.url || '' });
      return;
    }
    if (item.kind === 'foto') {
      if (item.playerId) applyPlayerPatch(item.playerId, { has_foto: true });
      else applyUpload(team.team_id, { has_foto_tim: true });
      return;
    }
    applyPlayerPatch(item.playerId, { has_idcard: true });
    const baris = this._roster?.find((r) => r.playerId === item.playerId);
    if (baris) baris.hasIdCard = true;
  }

  _pesan(teks, jenis = '') {
    this._pesanTeks = teks;
    this._pesanJenis = jenis;

    const el = this.$('.pesan');
    if (!el) return;
    const ikon = this._ikonPesan(jenis);
    el.innerHTML = `${ikon}<span class="pesan-teks">${esc(teks)}</span>`;
    el.className = `pesan ${jenis}`.trim();

    // Bawa ke layar: pesan di puncak daftar tidak berguna kalau pengguna sedang
    // menggulir di baris ketujuh.
    //
    // Kabar BERHASIL ikut dibawa, bukan hanya kabar gagal. Setelah menekan
    // Simpan di ujung bawah daftar foto, bilah pesannya ada di luar layar dan
    // satu-satunya yang terlihat hanyalah tombol Simpan yang menghilang —
    // unggahan yang sebenarnya berhasil terbaca seperti tidak terjadi apa-apa.
    if (jenis === 'galat' || jenis === 'sukses') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  _lookup(state) {
    if (!state.selectedTeamId) return null;
    return state.teams.find((team) => team.team_id === state.selectedTeamId) || null;
  }

  /**
   * Halaman ini bukan dialog lagi, jadi tidak ada scroll-lock maupun perangkap
   * fokus. Yang tersisa: menempatkan fokus di tempat yang masuk akal, dan
   * membawa halaman kembali ke puncak — berpindah tim dengan posisi gulir warisan
   * tim sebelumnya membingungkan.
   */
  _fokusAwal() {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      // Sejak kolom Kode Tim dihapus, tidak ada lagi isian wajib yang pantas
      // merebut fokus di layar unggah. Fokus jatuh ke tombol kembali supaya
      // papan ketik tetap punya pijakan yang jelas.
      this.$('.kembali')?.focus();
    });
  }
}

define('team-detail', TeamDetail);
