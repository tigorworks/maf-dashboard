/**
 * <filter-bar> — pencarian + penyaring kontingen.
 * Pemilihan cabor TIDAK di sini: ia terjadi di layar awal <sport-gate>, dan
 * cabor aktif ditampilkan sebagai chip di header. Hitungan pada tiap opsi dihitung "tanpa dirinya sendiri" (facet count)
 * supaya angka tidak selalu nol saat filter lain aktif.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { num } from '../core/format.js';
import { activeFilterCount, filterTeams, resetFilters, setFilter, store } from '../data/app-state.js';
import '../ui/ui-search.js';
import '../ui/ui-combo.js';

const styles = css`
  :host {
    display: block;
    padding: var(--sp-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-3);
  }
  ui-search {
    flex: 1 1 300px;
  }
  ui-combo {
    flex: 1 1 220px;
    max-width: 320px;
  }
  .reset {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    height: 42px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    white-space: nowrap;
  }
  .reset:hover {
    color: var(--brand-orange);
    border-color: var(--brand-orange);
  }
  .reset b {
    padding: 0 6px;
    color: var(--accent-contrast);
    background: var(--accent);
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
  }
  /* Di layar sempit tinggal pencarian saja.
     Penyaring kontingen dibuang di sini karena daftar tim sudah berubah jadi
     kartu: menyaring lalu menggulir kartu lebih lambat daripada langsung
     mengetik nama kontingennya di kotak pencarian — pencarian memang sudah
     menjangkau kolom kontingen. Filter yang sempat aktif di layar lebar tetap
     berlaku dan tetap bisa dibersihkan lewat tombol Reset, yang tidak ikut
     disembunyikan justru supaya keadaan tersaring tidak pernah tak terlihat. */
  @media (max-width: 900px) {
    ui-combo {
      display: none;
    }
  }
  @media (max-width: 640px) {
    :host {
      padding: var(--sp-3);
    }
    .row {
      gap: var(--sp-2);
    }
    ui-search {
      flex: 1 1 100%;
    }
    .reset {
      flex: 1 1 100%;
      justify-content: center;
      height: 40px;
    }
  }
`;

export class FilterBar extends BaseElement {
  static styles = [styles];

  /**
   * DOM dibangun sekali saja; pembaruan berikutnya hanya menyinkronkan nilai.
   * Kalau innerHTML ditulis ulang tiap perubahan state, fokus input pencarian
   * akan hilang di tengah pengguna mengetik.
   */
  render() {
    if (!this._built) {
      this.shadowRoot.innerHTML = `
        <div class="row">
          <ui-search placeholder="Cari tim, kontingen, PIC, atau nama pemain…"></ui-search>
          <ui-combo id="kontingen" label="Filter kontingen" placeholder="Semua kontingen"></ui-combo>
          <button class="reset" type="button" hidden>Reset filter <b>0</b></button>
        </div>`;
      this._built = true;
    }
    this._sync();
  }

  /** Isi property komponen anak (bukan atribut) + hitung facet count. */
  _sync() {
    const state = store.state;
    const { filters, facets } = state;
    const count = activeFilterCount(filters);

    const search = this.$('ui-search');
    if (search.getAttribute('value') !== filters.q) search.setAttribute('value', filters.q);

    const reset = this.$('.reset');
    reset.toggleAttribute('hidden', !count);
    reset.querySelector('b').textContent = num(count);

    const countWithout = (key, value) => {
      const probe = { ...state, filters: { ...filters, [key]: value } };
      return filterTeams(probe).length;
    };

    const kontingen = this.$('#kontingen');
    kontingen.options = facets.kontingen.map((value) => ({
      value,
      label: value,
      count: countWithout('kontingen', value),
    }));
    kontingen.setAttribute('value', filters.kontingen);

  }

  onMount() {
    this.track(store.subscribe(() => this.requestRender()));

    this.listen(this.shadowRoot, 'search', (e) => setFilter({ q: e.detail.value }));
    this.listen(this.shadowRoot, 'change', (e) => {
      if (e.target.id === 'kontingen') setFilter({ kontingen: e.detail.value });
    });
    this.listen(this.shadowRoot, 'click', (e) => {
      if (e.target.closest('.reset')) resetFilters();
    });
  }
}

define('filter-bar', FilterBar);
