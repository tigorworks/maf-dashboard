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

  /* Baris "98 dari 125 tim memenuhi syarat" di bawah label.
     TIDAK nowrap seperti .label: ini kalimat, bukan sebutan satu kata, dan
     memaksanya satu baris akan memotongnya di kartu sempit. */
  .sub {
    margin-top: 3px;
    font-size: var(--fs-xs);
    font-weight: 600;
    line-height: 1.35;
    color: var(--text-muted);
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
  /* Centang di dalam perisai: kelengkapan yang sudah diperiksa, bukan sekadar
     centang biasa yang di kartu lain bisa terbaca sebagai "selesai". */
  lengkap:
    '<path d="M10 3 4 5.2v4.3c0 3.4 2.4 6.5 6 7.5 3.6-1 6-4.1 6-7.5V5.2L10 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m7.5 9.8 1.9 1.9 3.4-3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
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

    // Kelengkapan data. Penyebutnya jumlah tim YANG SEDANG TAMPIL, sama dengan
    // angka di kartu "Tim", supaya kartunya konsisten dengan dirinya sendiri.
    const totalTim = stats.teams;
    const lengkap = stats.lengkap ?? 0;
    // Tanpa tim sama sekali (penyaring tidak menemukan apa pun), pertanyaannya
    // tidak punya jawaban — bukan 0%, yang akan terbaca sebagai "semuanya
    // bermasalah". Tanda pisah lebih jujur.
    const adaTim = totalTim > 0;
    const rasio = adaTim ? lengkap / totalTim : 0;
    // Dibulatkan ke bawah, TIDAK dibulatkan biasa: 124 dari 125 tim adalah
    // 99,2% dan boleh tampil 99%, tapi pembulatan biasa akan menampilkannya
    // sebagai 100% — mengaku selesai padahal masih ada satu tim tertinggal.
    // Hal yang sama di ujung bawah: 1 dari 300 tidak boleh jadi 0%.
    const persen = adaTim
      ? `${lengkap > 0 && lengkap < totalTim ? Math.max(1, Math.floor(rasio * 100)) : Math.floor(rasio * 100)}%`
      : '—';
    // #45c47a bukan hijau pilihan sendiri: itu warna yang sudah dipakai pita
    // "Memenuhi syarat" di panel detail tim. Arti yang sama harus berwarna
    // sama, kalau tidak orang harus belajar dua kosakata warna.
    const warnaLengkap = !adaTim
      ? 'var(--text-faint)'
      : rasio === 1
        ? '#45c47a'
        : rasio >= 0.5
          ? 'var(--brand-gold)'
          : 'var(--peringatan)';

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
        label: 'Data lengkap',
        // Angka besarnya PERSENTASE, bukan jumlah — yang dicari sekilas adalah
        // "sudah sejauh mana", dan jumlah mentah tidak menjawab itu tanpa
        // dibandingkan dulu dengan totalnya.
        value: persen,
        kelas: 'persen',
        // Pembilang dan penyebutnya tetap disebut di bawahnya: persentase saja
        // menyembunyikan besaran: 100% dari 3 tim dan 100% dari 125 tim
        // terbaca sama, padahal artinya jauh berbeda.
        sub: `${num(lengkap)} dari ${num(totalTim)} tim memenuhi syarat`,
        tone: warnaLengkap,
        icon: `<svg viewBox="0 0 20 20" fill="none">${ICONS.lengkap}</svg>`,
      },
    ];

    this.shadowRoot.innerHTML = `
      <div class="grid">
        ${cards
          .map(
            (card) => `
          <article class="${esc(card.kelas || '')}" style="--tone:${card.tone}">
            <div class="icon">${card.icon}</div>
            <div class="body">
              <div class="value">${
                /* Kartu persentase sudah membawa nilainya sebagai teks jadi
                   ("78%" / "—"); num() akan merusaknya. Kartu lain tetap lewat
                   num() supaya pemisah ribuannya seragam. */
                card.kelas === 'persen' ? esc(card.value) : num(card.value)
              }${card.of || ''}</div>
              <div class="label">${esc(card.label)}</div>
              ${card.sub ? `<div class="sub">${esc(card.sub)}</div>` : ''}
            </div>
          </article>`
          )
          .join('')}
      </div>`;
  }
}

define('stat-grid', StatGrid);
