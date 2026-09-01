/**
 * <maf-app> — komponen akar. Memuat data, menurunkan view dari state, dan
 * meneruskannya ke komponen anak. Juga menangani state loading dan error.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc } from '../core/format.js';
import { loadDataset } from '../data/source.js';
import {
  derive, kembaliKeDaftar, setAuth, setDataset, setError, setPage, store,
} from '../data/app-state.js';
import { initGameRouting } from '../data/router.js';
import { adalahAdmin, onAuth, pulihkanSesi } from '../data/auth.js';
import './app-header.js';
import './login-dialog.js';
import './code-list.js';
import './audit-list.js';
import './jejak-list.js';
import './sport-gate.js';
import './stat-grid.js';
import './filter-bar.js';
import './team-table.js';
import './team-detail.js';

const styles = css`
  :host {
    display: block;
    min-height: 100vh;
  }
  main {
    display: grid;
    /* minmax(0, 1fr), bukan 1fr: item grid tidak boleh menyusut di bawah lebar
       min-content-nya, sehingga satu anak yang panjang (mis. nama tim di kepala
       halaman tim) melebarkan seluruh trek dan menyebabkan halaman bisa
       digeser ke samping di ponsel. */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-4);
    max-width: var(--maxw);
    margin: 0 auto;
    padding: var(--sp-5);
  }
  /* Layar pilihan cabor memakai lebar & tinggi penuh, tanpa padding main. */
  main:has(sport-gate) {
    max-width: none;
    padding: 0;
  }
  /* Halaman tim mengatur paddingnya sendiri supaya pita judulnya bisa
     membentang penuh selebar halaman. */
  main:has(team-detail),
  main:has(code-list),
  main:has(audit-list),
  main:has(jejak-list) {
    padding: 0;
    gap: 0;
  }

  .state {
    display: grid;
    place-items: center;
    gap: var(--sp-3);
    padding: var(--sp-7) var(--sp-4);
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .state h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .state p {
    margin: 0;
    max-width: 56ch;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .state code {
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--text);
    background: var(--surface-inset);
    border-radius: var(--r-xs);
  }

  /* --- Layar gagal muat ---
     Urutannya sengaja: ikon, apa yang terjadi, apa yang bisa dilakukan, lalu
     rincian teknis paling bawah dengan ukuran terkecil. Rincian itu tetap ada
     karena berguna saat melapor ke panitia, tapi ia jawaban untuk pertanyaan
     ketiga — bukan yang pertama dibaca. */
  .state.galat {
    max-width: 560px;
    margin: var(--sp-7) auto;
    padding: var(--sp-7) var(--sp-5);
  }
  .state-ikon {
    width: 44px;
    height: 44px;
    color: var(--peringatan);
  }
  .state.galat h2 {
    color: var(--text);
  }
  .state-aksi {
    margin-top: var(--sp-2);
  }
  .state-aksi button {
    height: 42px;
    padding: 0 var(--sp-5);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--bg);
    background: var(--accent);
    border: 0;
    border-radius: var(--r-sm);
  }
  .state-aksi button:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .state-aksi button:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .state-rinci {
    margin-top: var(--sp-2);
    font-size: var(--fs-xs);
    color: var(--text-faint);
    overflow-wrap: anywhere;
  }
  /* --- Layar memuat ---
     Rangka berkilau (shimmer) menjanjikan bentuk yang belum tentu datang, dan
     di jaringan lambat ia diam saja selama belasan detik: tidak ada yang
     memberi tahu apakah prosesnya masih hidup. Layar ini justru berdenyut,
     menyebut tahapnya, dan mengakui sendiri kalau pemuatannya lama. */
  .muat {
    display: grid;
    place-items: center;
    gap: var(--sp-5);
    min-height: min(60vh, 460px);
    padding: var(--sp-6) var(--sp-4);
    text-align: center;
  }
  .muat-cincin {
    position: relative;
    display: grid;
    place-items: center;
    width: 132px;
    height: 132px;
  }
  /* Dua cincin berputar berlawanan arah dengan kecepatan berbeda: satu cincin
     saja terbaca seperti pemutar generik, sedangkan ini bergerak seperti nyala
     — bentuk yang sama dengan logo di tengahnya. */
  .muat-cincin::before,
  .muat-cincin::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid transparent;
  }
  .muat-cincin::before {
    border-top-color: var(--brand-gold, var(--accent));
    border-right-color: color-mix(in srgb, var(--brand-orange) 70%, transparent);
    animation: putar 1.6s linear infinite;
  }
  .muat-cincin::after {
    inset: 14px;
    border-bottom-color: var(--brand-blue-bright, var(--accent));
    animation: putar 2.4s linear infinite reverse;
  }
  .muat-logo {
    width: 74px;
    height: 74px;
    background-image: var(--logo-maf);
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    animation: denyut-muat 2.2s var(--ease) infinite;
  }
  .muat-teks {
    display: grid;
    gap: 6px;
  }
  .muat-judul {
    font-size: var(--fs-lg);
    font-weight: 800;
  }
  .muat-nota {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  /* Batang tak tentu: ia TIDAK berpura-pura tahu berapa persen selesai —
     panjangnya tetap, hanya posisinya yang berjalan. */
  .muat-bar {
    position: relative;
    width: min(280px, 70vw);
    height: 4px;
    background: var(--surface-2);
    border-radius: var(--r-pill);
    overflow: hidden;
  }
  .muat-bar::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, var(--brand-gold, var(--accent)), transparent);
    animation: geser 1.5s var(--ease) infinite;
  }
  @keyframes putar {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes denyut-muat {
    50% {
      opacity: 0.55;
      transform: scale(0.94);
    }
  }
  @keyframes geser {
    0% {
      left: -40%;
    }
    100% {
      left: 100%;
    }
  }
  /* Yang meminta gerakan dikurangi tetap mendapat kabar, tanpa animasi. */
  @media (prefers-reduced-motion: reduce) {
    .muat-cincin::before,
    .muat-cincin::after,
    .muat-logo,
    .muat-bar::after {
      animation: none;
    }
    .muat-cincin::before {
      border-color: var(--brand-gold, var(--accent));
      opacity: 0.5;
    }
  }

  @media (max-width: 900px) {
    main {
      gap: var(--sp-3);
      padding: var(--sp-4);
    }
  }
  @media (max-width: 560px) {
    main {
      padding: var(--sp-3);
    }
  }
`;

export class AppShell extends BaseElement {
  static styles = [styles];

  render() {
    const state = store.state;

    if (!this._built) {
      this.shadowRoot.innerHTML = `
        <app-header></app-header>
        <main></main>
        <login-dialog></login-dialog>`;
      this._built = true;
    }

    const main = this.$('main');

    if (state.phase === 'loading') {
      const kabar = this._kabarMuat();
      main.innerHTML = `
        <div class="muat" role="status" aria-live="polite">
          <div class="muat-cincin" aria-hidden="true">
            <div class="muat-logo"></div>
          </div>
          <div class="muat-teks">
            <span class="muat-judul">${esc(kabar.judul)}</span>
            <span class="muat-nota">${esc(kabar.nota)}</span>
          </div>
          <div class="muat-bar" aria-hidden="true"></div>
        </div>`;
      this._jalankanJamMuat();
      return;
    }

    if (state.phase === 'error') {
      main.innerHTML = this._layarGalat(state.error);
      return;
    }

    // Belum memilih cabor -> tampilkan layar pilihan, bukan dashboard.
    if (!state.filters.game) {
      if (!main.querySelector('sport-gate')) main.innerHTML = '<sport-gate></sport-gate>';
      return;
    }

    // Halaman kode tim (khusus admin) juga halaman penuh.
    if (state.showAudit) {
      if (!main.querySelector('audit-list')) main.innerHTML = '<audit-list></audit-list>';
      return;
    }

    if (state.showCodes) {
      if (!main.querySelector('code-list')) main.innerHTML = '<code-list></code-list>';
      return;
    }

    if (state.showJejak) {
      if (!main.querySelector('jejak-list')) main.innerHTML = '<jejak-list></jejak-list>';
      return;
    }

    // Satu tim sedang dibuka -> HALAMAN PENUH, menggantikan daftar. Bukan popup:
    // verifikasi dikerjakan lama di satu tim, dan dialog yang menutupi konteks
    // di belakangnya tidak memberi manfaat apa pun untuk pekerjaan itu.
    if (state.selectedTeamId) {
      if (!main.querySelector('team-detail')) main.innerHTML = '<team-detail></team-detail>';
      return;
    }

    // Struktur konten dibangun sekali; selanjutnya hanya property yang di-update.
    // Kembali dari halaman tim berarti team-detail masih ada di main dan harus
    // diganti — karena itu pemeriksaannya juga menengok team-detail.
    if (!main.querySelector('team-table')) {
      main.innerHTML = `
        <filter-bar></filter-bar>
        <team-table></team-table>`;
    }

    const view = derive(state);
    this._view = view;

    /* Ringkasan hanya untuk admin.
       Angka-angka itu alat pemantauan panitia — berapa tim masuk, berapa yang
       kurang — bukan informasi yang dicari peserta, sementara di ponsel ia
       memakan hampir separuh layar pertama sebelum satu nama tim pun terlihat.
       Ditambah/dibuang di sini, bukan sekadar disembunyikan lewat CSS, supaya
       ia tidak ikut terkirim ke pengunjung yang tidak berhak melihatnya.
       Masuk & keluar dijalankan tanpa memuat ulang halaman, jadi keduanya
       ditangani: elemen dibuat saat admin masuk, dan dibuang saat ia keluar. */
    const bolehLihatRingkasan = adalahAdmin();
    let ringkasan = main.querySelector('stat-grid');
    if (bolehLihatRingkasan && !ringkasan) {
      ringkasan = document.createElement('stat-grid');
      main.prepend(ringkasan);
    } else if (!bolehLihatRingkasan && ringkasan) {
      ringkasan.remove();
      ringkasan = null;
    }
    if (ringkasan) {
      ringkasan.data = {
        stats: view.stats,
        total: view.totalTeams,
        filtered: view.filtered.length !== view.totalTeams,
      };
    }
    this.$('team-table').view = view;
  }

  /**
   * Kabar yang berubah seiring waktu tunggu.
   *
   * Bukan hiasan: pemuatan pertama setelah cache GAS kedaluwarsa memang bisa
   * memakan delapan detik atau lebih, dan layar yang mengucapkan kalimat sama
   * selama itu terbaca seperti macet. Menyebut apa yang sedang terjadi — lalu
   * mengakui kalau memang lama — lebih jujur daripada memutar animasi tanpa
   * kata.
   */
  _kabarMuat() {
    const detik = this._detikMuat || 0;
    if (detik < 3) {
      return { judul: 'Menghubungi server…', nota: 'Mengambil data peserta e-sport MAF 2026.' };
    }
    if (detik < 8) {
      return { judul: 'Menyiapkan data…', nota: 'Menyusun daftar tim dan roster pemain.' };
    }
    return {
      judul: 'Masih memuat…',
      nota: 'Pemuatan pertama memang paling lama karena seluruh data dibaca ulang. Mohon tunggu.',
    };
  }

  /**
   * Penghitung detik selama memuat. Dinyalakan sekali, dan mati sendiri begitu
   * fasenya bukan 'loading' lagi — termasuk saat pemuatannya gagal.
   */
  _jalankanJamMuat() {
    if (this._jamMuat) return;
    this._detikMuat = 0;
    this._jamMuat = setInterval(() => {
      if (store.state.phase !== 'loading') {
        clearInterval(this._jamMuat);
        this._jamMuat = 0;
        return;
      }
      this._detikMuat += 1;
      // Hanya dirender ulang saat kabarnya benar-benar berganti.
      if (this._detikMuat === 3 || this._detikMuat === 8) this.requestRender();
    }, 1000);
  }

  /**
   * Layar gagal muat.
   *
   * Yang dulu tampil di sini adalah pesan galat mentah ditambah petunjuk
   * menjalankan python3 -m http.server — instruksi untuk pengembang di mesinnya
   * sendiri, yang di halaman publik justru menyesatkan: sebabnya hampir selalu
   * jaringan atau layanan Google yang lambat, bukan cara halaman ini dibuka.
   * Pengunjung yang membacanya tidak punya "folder proyek" untuk dijalankan,
   * dan panitia yang melihatnya menyimpulkan situsnya rusak.
   *
   * Susunannya sekarang mengikuti tiga hal yang ingin diketahui orang saat
   * sesuatu gagal: APA yang terjadi, APA yang bisa dilakukan, dan — kalau perlu
   * melapor — APA rinciannya. Petunjuk pengembang hanya muncul kalau halamannya
   * memang sedang dibuka lewat file://.
   */
  _layarGalat(pesan) {
    const teks = String(pesan || '');
    const luring = typeof navigator !== 'undefined' && navigator.onLine === false;

    // Kalimat sebab dipilih dari pesan teknisnya, bukan menggantikannya:
    // rinciannya tetap tercetak di bawah untuk dilaporkan ke panitia.
    var sebab;
    if (luring) {
      sebab = 'Perangkat ini sedang tidak terhubung ke internet. Periksa koneksi, lalu coba lagi.';
    } else if (/waktu muat|tidak merespons|timeout/i.test(teks)) {
      sebab =
        'Server data belum menjawab pada waktunya. Ini biasanya sementara — ' +
        'jaringan sedang lambat, atau layanan Google sedang sibuk.';
    } else if (/dataset kosong/i.test(teks)) {
      sebab =
        'Server menjawab, tetapi belum ada satu tim pun yang terbaca. ' +
        'Kemungkinan data pesertanya memang belum diunggah panitia.';
    } else if (/HTTP\s*\d/i.test(teks)) {
      sebab = 'Server data menolak permintaan ini. Kalau berulang, hubungi panitia.';
    } else {
      sebab = 'Data peserta tidak bisa diambil dari server. Coba lagi sebentar lagi.';
    }

    // Petunjuk pengembang HANYA saat berkasnya dibuka langsung, bukan lewat
    // HTTP. Di GitHub Pages kondisi ini tidak pernah benar.
    const lokal = typeof location !== 'undefined' && location.protocol === 'file:';

    return `
      <div class="state galat">
        <svg class="state-ikon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
          <path d="M12 7.6v5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="12" cy="16.5" r="1.05" fill="currentColor" />
        </svg>
        <h2>Data peserta belum bisa ditampilkan</h2>
        <p>${esc(sebab)}</p>
        <div class="state-aksi">
          <button type="button" data-act="muat-ulang" ${this._memuatUlang ? 'disabled' : ''}>
            ${this._memuatUlang ? 'Memuat…' : 'Coba lagi'}
          </button>
        </div>
        ${teks ? `<p class="state-rinci">Rincian: ${esc(teks)}</p>` : ''}
        ${
          lokal
            ? `<p class="state-rinci">Halaman ini memakai ES module, jadi harus dibuka lewat HTTP —
                 bukan <code>file://</code>. Jalankan <code>python3 -m http.server 3456</code>
                 dari folder proyek lalu buka <code>http://localhost:3456/</code>.</p>`
            : ''
        }
      </div>`;
  }

  /**
   * Ambil dataset, dan laporkan kegagalannya ke store.
   *
   * Dipisah dari onMount supaya tombol "Coba lagi" bisa memanggilnya lagi tanpa
   * memuat ulang seluruh halaman — memuat ulang berarti sesi dipulihkan dari
   * cookie sekali lagi dan seluruh komponen dirakit ulang, padahal yang gagal
   * cuma satu permintaan.
   */
  async _muatData(applyHash) {
    this._memuatUlang = true;
    if (store.state.phase === 'error') this.requestRender();
    try {
      const dataset = await loadDataset(this.dataset.src || '');
      if (!dataset.teams.length) throw new Error('Dataset kosong — belum ada tim yang terbaca.');
      setDataset(dataset);
      if (applyHash) applyHash();
    } catch (error) {
      setError(error.message || String(error));
    }
    this._memuatUlang = false;
  }

  async onMount() {
    this.track(store.subscribe(() => this.requestRender()));
    // Dipasang sebelum data dimuat supaya perubahan cabor apa pun tercermin di
    // URL; `applyHash` dijalankan setelah dataset siap karena ia perlu tahu
    // daftar cabor yang sah.
    const applyHash = initGameRouting();

    this.listen(this.shadowRoot, 'page', (e) => setPage(e.detail.page));

    // Sesi dicerminkan ke store supaya komponen cukup berlangganan satu sumber.
    //
    // Sekaligus: begitu sesi BERAKHIR, layar kembali ke daftar tim. Halaman Kode
    // Tim dan notifikasi hanya berisi data ber-token; ditinggalkan terbuka,
    // keduanya berubah jadi layar galat "Sesi berakhir" yang tidak bisa
    // diapa-apakan. Halaman detail tim memang masih bisa dibaca tanpa sesi,
    // tetapi separuh isinya baru saja lenyap — kembali ke daftar lebih jujur
    // daripada halaman yang diam-diam menyusut.
    //
    // Dipasang di SINI, bukan di penangan tombol Keluar, karena sesi bisa
    // berakhir dengan tiga cara: ditekan keluar, habis 3 jam menganggur, atau
    // GAS menjawab "sesi berakhir" di tengah permintaan. Ketiganya berujung ke
    // umumkan() yang sama, jadi satu aturan di satu tempat mengurus semuanya.
    //
    // Perpindahannya yang diperhatikan, bukan keadaannya: onAuth memanggil
    // pendengarnya sekali saat dipasang — dan saat itu sesinya memang belum ada.
    // Tanpa penjaga ini, panggilan pembuka itu akan menutup halaman yang justru
    // sedang dituju oleh alamat yang baru saja dibuka.
    let adaSesi = false;
    this.track(
      onAuth((sesi) => {
        setAuth(sesi);
        if (adaSesi && !sesi) kembaliKeDaftar();
        adaSesi = Boolean(sesi);
      })
    );
    this.listen(this.shadowRoot, 'minta-masuk', () => this.$('login-dialog')?.buka());

    // Pulihkan sesi dari cookie tanpa menahan pemuatan data: token diverifikasi
    // ke GAS, dan itu perjalanan jaringan tersendiri.
    pulihkanSesi();

    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('[data-act="muat-ulang"]')) this._muatData(applyHash);
    });

    await this._muatData(applyHash);
  }

}

define('maf-app', AppShell);
