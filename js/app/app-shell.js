/**
 * <maf-app> — komponen akar. Memuat data, menurunkan view dari state, dan
 * meneruskannya ke komponen anak. Juga menangani state loading dan error.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc } from '../core/format.js';
import { loadDataset } from '../data/source.js';
import { derive, setAuth, setDataset, setError, setPage, store } from '../data/app-state.js';
import { initGameRouting } from '../data/router.js';
import { onAuth, pulihkanSesi } from '../data/auth.js';
import './app-header.js';
import './login-dialog.js';
import './code-list.js';
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
  main:has(code-list) {
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
  .skeleton {
    height: 78px;
    background: var(--skeleton);
    background-size: 400% 100%;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    animation: shimmer 1.4s ease-in-out infinite;
  }
  .sk-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--sp-3);
  }
  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: 0 0;
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
      main.innerHTML = `
        <div class="sk-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          ${'<div class="skeleton" style="height:98px"></div>'.repeat(2)}
        </div>
        <div class="sk-grid">${'<div class="skeleton"></div>'.repeat(4)}</div>
        <div class="skeleton" style="height:110px"></div>
        <div class="skeleton" style="height:420px"></div>`;
      return;
    }

    if (state.phase === 'error') {
      main.innerHTML = `
        <div class="state">
          <h2>Gagal memuat data</h2>
          <p>${esc(state.error)}</p>
          <p>Halaman ini memakai ES module, jadi harus dibuka lewat HTTP — bukan <code>file://</code>.
             Jalankan <code>python3 -m http.server 3456</code> dari folder proyek lalu buka
             <code>http://localhost:3456/</code>.</p>
        </div>`;
      return;
    }

    // Belum memilih cabor -> tampilkan layar pilihan, bukan dashboard.
    if (!state.filters.game) {
      if (!main.querySelector('sport-gate')) main.innerHTML = '<sport-gate></sport-gate>';
      return;
    }

    // Halaman kode tim (khusus admin) juga halaman penuh.
    if (state.showCodes) {
      if (!main.querySelector('code-list')) main.innerHTML = '<code-list></code-list>';
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
        <stat-grid></stat-grid>
        <filter-bar></filter-bar>
        <team-table></team-table>`;
    }

    const view = derive(state);
    this._view = view;

    this.$('stat-grid').data = {
      stats: view.stats,
      total: view.totalTeams,
      filtered: view.filtered.length !== view.totalTeams,
    };
    this.$('team-table').view = view;
  }

  async onMount() {
    this.track(store.subscribe(() => this.requestRender()));
    // Dipasang sebelum data dimuat supaya perubahan cabor apa pun tercermin di
    // URL; `applyHash` dijalankan setelah dataset siap karena ia perlu tahu
    // daftar cabor yang sah.
    const applyHash = initGameRouting();

    this.listen(this.shadowRoot, 'page', (e) => setPage(e.detail.page));

    // Sesi dicerminkan ke store supaya komponen cukup berlangganan satu sumber.
    this.track(onAuth((sesi) => setAuth(sesi)));
    this.listen(this.shadowRoot, 'minta-masuk', () => this.$('login-dialog')?.buka());

    // Pulihkan sesi dari cookie tanpa menahan pemuatan data: token diverifikasi
    // ke GAS, dan itu perjalanan jaringan tersendiri.
    pulihkanSesi();

    try {
      const dataset = await loadDataset(this.dataset.src || '');
      if (!dataset.teams.length) throw new Error('Dataset kosong — belum ada tim yang terbaca.');
      setDataset(dataset);
      applyHash();
    } catch (error) {
      setError(error.message || String(error));
    }
  }

}

define('maf-app', AppShell);
