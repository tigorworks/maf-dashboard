/**
 * <stat-grid> — kartu ringkasan. Angka mengikuti hasil filter aktif, dan
 * menampilkan pembanding "dari total" begitu ada filter yang menyala.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, num } from '../core/format.js';

const styles = css`
  :host {
    display: block;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--sp-3);
  }
  article {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
  }
  article:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  article::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--tone, var(--accent));
  }
  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: var(--r-sm);
    background: color-mix(in srgb, var(--tone, var(--accent)) 16%, transparent);
    color: var(--tone, var(--accent));
  }
  .icon svg {
    width: 20px;
    height: 20px;
  }
  .body {
    min-width: 0;
  }
  .value {
    font-size: var(--fs-2xl);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .label {
    margin-top: 2px;
    font-size: var(--fs-xs);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-faint);
    white-space: nowrap;
  }
  .of {
    margin-left: var(--sp-1);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-faint);
    letter-spacing: 0;
    text-transform: none;
  }

  /* Empat kartu satu kolom akan memakan seluruh layar ponsel sebelum tabel
     terlihat — jadi dua kolom dan kartu yang lebih padat. */
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-2);
    }
    article {
      gap: var(--sp-2);
      padding: var(--sp-3);
    }
    .icon {
      width: 32px;
      height: 32px;
    }
    .icon svg {
      width: 17px;
      height: 17px;
    }
    .value {
      font-size: var(--fs-xl);
    }
    .label {
      font-size: 10px;
      white-space: normal;
    }
  }
`;

const ICONS = {
  players:
    '<path d="M13 17v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 2 15.5V17M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 17v-1.5a3.5 3.5 0 0 0-2.6-3.4M13.5 3.1a3 3 0 0 1 0 5.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  teams:
    '<path d="M3 7.5 10 4l7 3.5-7 3.5-7-3.5Zm0 4.5 7 3.5 7-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  contingent:
    '<path d="M4 17V6.2a.7.7 0 0 1 1-.6l5.6 2.5a.7.7 0 0 0 1-.6V4.4a.7.7 0 0 1 1-.6l3.4 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  unit:
    '<path d="M3 17h14M5 17V7.5l5-3.5 5 3.5V17M8.5 10.5h3M8.5 13.5h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
};

export class StatGrid extends BaseElement {
  static styles = [styles];

  constructor() {
    super();
    this._stats = null;
    this._total = 0;
    this._filtered = false;
  }

  /** @param {{stats:object,total:number,filtered:boolean}} data */
  set data(data) {
    this._stats = data.stats;
    this._total = data.total;
    this._filtered = data.filtered;
    this.requestRender();
  }

  render() {
    const stats = this._stats;
    if (!stats) return;
    const of = (value) => (this._filtered ? `<span class="of">/ ${num(value)}</span>` : '');

    // Jumlah per cabor sudah ditampilkan di layar pilihan <sport-gate>,
    // jadi kartu di sini fokus ke agregat cabor yang sedang dibuka.
    const cards = [
      {
        label: 'Tim',
        value: stats.teams,
        tone: 'var(--brand-gold)',
        icon: `<svg viewBox="0 0 20 20" fill="none">${ICONS.teams}</svg>`,
        of: of(this._total),
      },
      {
        label: 'Pemain',
        value: stats.players,
        tone: 'var(--game-mlbb)',
        icon: `<svg viewBox="0 0 20 20" fill="none">${ICONS.players}</svg>`,
      },
      {
        label: 'Kontingen',
        value: stats.kontingen,
        tone: 'var(--brand-orange)',
        icon: `<svg viewBox="0 0 20 20" fill="none">${ICONS.contingent}</svg>`,
      },
      {
        label: 'Unit Kerja',
        value: stats.units,
        tone: '#dbe6ff',
        icon: `<svg viewBox="0 0 20 20" fill="none">${ICONS.unit}</svg>`,
      },
    ];

    this.shadowRoot.innerHTML = `
      <div class="grid">
        ${cards
          .map(
            (card) => `
          <article style="--tone:${card.tone}">
            <div class="icon">${card.icon}</div>
            <div class="body">
              <div class="value">${num(card.value)}${card.of || ''}</div>
              <div class="label">${esc(card.label)}</div>
            </div>
          </article>`
          )
          .join('')}
      </div>`;
  }
}

define('stat-grid', StatGrid);
