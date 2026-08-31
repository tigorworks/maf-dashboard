/**
 * <jejak-list> — jejak audit: siapa mengubah apa, kapan. Khusus admin.
 *
 * Menjawab satu pertanyaan, dan bentuknya mengikuti pertanyaan itu: "apa yang
 * TERAKHIR berubah, dan oleh siapa" — dengan "berubah" berarti DATA PESERTA
 * saja. Pembuatan Kode Tim tidak tercatat: ia tidak mengubah satu sel pun, dan
 * jumlahnya akan menenggelamkan perubahan yang sesungguhnya dicari.
 * Karena itu urutannya terbaru di atas,
 * jawaban ringkasnya dicetak di pita paling atas sebelum daftar apa pun, dan
 * kelompoknya per hari — bukan tabel bertanggal penuh di tiap baris, yang
 * memaksa pembaca membandingkan tanggal sendiri untuk tahu mana yang hari ini.
 *
 * Datanya TIDAK berasal dari store dan tidak ikut cache: _Jejak hanya bisa
 * dibaca lewat permintaan ber-token, dan riwayat yang di-cache akan basi tepat
 * pada saat ia paling dibutuhkan.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, normalize, num } from '../core/format.js';
import { setShowJejak } from '../data/app-state.js';
import { ambilJejak } from '../data/auth.js';
import {
  jamJejak, jarakWaktu, jejakMembuang, perHari, sasaranJejak,
} from '../data/jejak.js';

const styles = css`
  :host {
    display: block;
    min-height: calc(100vh - var(--header-h));
    background: var(--bg);
  }
  .panel {
    display: flex;
    flex-direction: column;
    --tepi: max(var(--sp-6), calc((100% - var(--maxw)) / 2));
  }
  header {
    position: sticky;
    top: var(--header-h);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--tepi);
    background: var(--header-bg);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
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
  }
  .kembali:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .kembali svg {
    width: 15px;
    height: 15px;
  }
  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  h2 small {
    margin-left: var(--sp-2);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
  }
  .cari {
    flex: none;
    width: min(280px, 40vw);
    height: 36px;
    padding: 0 var(--sp-3);
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    outline: 0;
  }
  .cari:focus {
    border-color: var(--accent);
  }
  .segar {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    color: var(--text-faint);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .segar:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
  }
  .segar:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  .segar svg {
    width: 15px;
    height: 15px;
  }

  /* Jawaban ringkasnya berdiri SEBELUM daftar: pertanyaan yang membawa orang ke
     layar ini hampir selalu "terakhir diubah siapa", dan itu tidak seharusnya
     menuntut membaca baris pertama tabel lalu menafsirkannya sendiri. */
  .pita {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-2) var(--sp-3);
    padding: var(--sp-4) var(--tepi);
    font-size: var(--fs-sm);
    color: var(--text-muted);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .pita b {
    font-size: var(--fs-md);
    color: var(--text);
  }
  .pita .kapan {
    color: var(--accent);
    font-weight: 700;
  }

  .isi {
    padding: var(--sp-5) var(--tepi) var(--sp-7);
  }

  .hari {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin: var(--sp-5) 0 var(--sp-2);
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .hari:first-child {
    margin-top: 0;
  }
  .hari::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
  }
  li {
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 0 var(--sp-3);
    padding: var(--sp-3);
    border-bottom: 1px solid var(--border);
  }
  li:last-child {
    border-bottom: 0;
  }
  li:nth-child(even) {
    background: var(--row-stripe);
  }
  .jam {
    font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }
  .oleh {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text);
  }
  /* Sasaran perubahan (tim / pemain) dan isinya ditempatkan di baris kedua:
     yang dicari lebih dulu adalah SIAPA, dan menaruh keduanya sebaris membuat
     nama orang tenggelam di antara nama tim dan nama kolom. */
  .apa {
    grid-column: 2;
    margin-top: 2px;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text-muted);
  }
  .sasaran {
    font-weight: 700;
    color: var(--game-pubg);
  }
  .kolom {
    color: var(--text-muted);
  }
  .nilai {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--text);
    word-break: break-word;
  }
  .nilai.kosong {
    color: var(--text-faint);
    font-style: italic;
  }
  .panah {
    color: var(--text-faint);
  }
  /* Baris yang menghapus sesuatu diberi warna peringatan: dalam daftar panjang
     berisi pembetulan nickname, penghapusan adalah satu-satunya yang perlu
     ditemukan cepat. */
  li.buang .sasaran,
  li.buang .nilai {
    color: var(--peringatan);
  }

  .status {
    display: grid;
    place-items: center;
    gap: var(--sp-2);
    padding: var(--sp-7) var(--sp-4);
    text-align: center;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  @media (max-width: 900px) {
    header {
      flex-wrap: wrap;
      padding: var(--sp-2) var(--sp-3);
    }
    .kembali span {
      display: none;
    }
    .cari {
      order: 3;
      width: 100%;
    }
    .isi,
    .pita {
      padding-left: var(--sp-3);
      padding-right: var(--sp-3);
    }
    /* Jam turun jadi label di baris pertama, bersama nama orangnya: di 390 px,
       kolom jam selebar 58 px memotong nama panjang jadi dua-tiga baris. */
    li {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .jam {
      float: right;
      margin-left: var(--sp-3);
      font-size: var(--fs-xs);
    }
    .apa {
      grid-column: 1;
    }
  }
`;

const IKON_KEMBALI = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const IKON_SEGAR = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  <path d="M13.6 1.8v2.6H11" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

export class JejakList extends BaseElement {
  static styles = [styles];

  constructor() {
    super();
    this._data = null; // null = belum dimuat
    this._total = 0;
    this._galat = '';
    this._cari = '';
    this._sibuk = false;
  }

  render() {
    const baris = this._tersaring();
    const terakhir = this._data?.[0] || null;

    this.shadowRoot.innerHTML = `
      <section class="panel">
        <header>
          <button class="kembali" type="button" data-act="kembali" aria-label="Kembali ke daftar tim">
            ${IKON_KEMBALI}<span>Kembali</span>
          </button>
          <h2>Jejak perubahan${
            this._data
              ? `<small>${num(baris.length)} dari ${num(this._total)} catatan</small>`
              : ''
          }</h2>
          <input class="cari" type="search" placeholder="Cari nama, tim, kolom…"
                 value="${esc(this._cari)}" aria-label="Cari" />
          <button class="segar" type="button" data-act="segarkan" ${this._sibuk ? 'disabled' : ''}
                  title="Muat ulang jejak" aria-label="Muat ulang jejak">
            ${IKON_SEGAR}
          </button>
        </header>

        ${
          terakhir
            ? `<p class="pita">
                 Terakhir diubah <b>${esc(terakhir.oleh || '—')}</b>
                 <span class="kapan">${esc(jarakWaktu(terakhir.waktu))}</span>
               </p>`
            : ''
        }

        <div class="isi">${this._isi(baris)}</div>
      </section>`;
  }

  _isi(baris) {
    if (this._galat) return `<div class="status">${esc(this._galat)}</div>`;
    if (!this._data) return '<div class="status">Mengambil jejak perubahan…</div>';
    if (!this._data.length) {
      return `<div class="status">
                Belum ada perubahan tercatat. Yang muncul di sini hanya perubahan
                <b>data peserta</b> — suntingan roster dan penghapusan tim.
                Pembuatan Kode Tim tidak dicatat: ia tidak mengubah data.
              </div>`;
    }
    if (!baris.length) {
      return `<div class="status">Tidak ada catatan yang cocok dengan “${esc(this._cari)}”.</div>`;
    }

    return perHari(baris)
      .map(
        (g) => `
        <h3 class="hari">${esc(g.label)}</h3>
        <ol>${g.item.map((b) => this._baris(b)).join('')}</ol>`
      )
      .join('');
  }

  _baris(b) {
    const buang = jejakMembuang(b);
    const nilai = (v, kosong) =>
      v ? `<span class="nilai">${esc(v)}</span>` : `<span class="nilai kosong">${kosong}</span>`;

    return `
      <li class="${buang ? 'buang' : ''}">
        <span class="jam">${esc(jamJejak(b.waktu))}</span>
        <span class="oleh">${esc(b.oleh || '—')}</span>
        <span class="apa">
          <span class="sasaran">${esc(sasaranJejak(b))}</span>
          <span class="kolom">— ${esc(b.kolom || 'perubahan')}:</span>
          ${nilai(b.sebelum, 'kosong')}
          <span class="panah">→</span>
          ${nilai(b.sesudah, 'kosong')}
        </span>
      </li>`;
  }

  _tersaring() {
    if (!this._data) return [];
    const q = normalize(this._cari.trim());
    if (!q) return this._data;
    return this._data.filter((b) =>
      normalize(
        [b.oleh, b.tim, b.teamId, b.game, b.kontingen, b.kolom, b.sebelum, b.sesudah].join(' ')
      ).includes(q)
    );
  }

  onMount() {
    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('[data-act="kembali"]')) {
        setShowJejak(false);
        return;
      }
      if (event.target.closest('[data-act="segarkan"]')) this._muat();
    });

    this.listen(this.shadowRoot, 'input', (event) => {
      if (!event.target.classList.contains('cari')) return;
      this._cari = event.target.value;
      // Render ulang mengganti seluruh isi, termasuk kotak cari — fokus dan
      // posisi kursor dikembalikan supaya mengetik tidak terputus.
      const posisi = event.target.selectionStart;
      this.render();
      const kotak = this.$('.cari');
      kotak?.focus();
      kotak?.setSelectionRange(posisi, posisi);
    });

    this._muat();
  }

  async _muat() {
    if (this._sibuk) return;
    this._sibuk = true;
    this.render();
    try {
      const hasil = await ambilJejak();
      this._data = hasil.jejak;
      this._total = hasil.total;
      this._galat = '';
    } catch (error) {
      this._galat = error.message || 'Gagal mengambil jejak perubahan.';
    }
    this._sibuk = false;
    this.requestRender();
  }
}

define('jejak-list', JejakList);
