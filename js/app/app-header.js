/**
 * <app-header> — identitas MAF 2026 dan ringkasan sumber data.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, formatDate } from '../core/format.js';
import { caborTerkunci, clearGame, setShowCodes, store } from '../data/app-state.js';
import { GAME_META } from '../data/source.js';
import { PERAN, keluar } from '../data/auth.js';

const styles = css`
  :host {
    position: sticky;
    top: 0;
    z-index: 30;
    display: block;
    background: var(--header-bg);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    max-width: var(--maxw);
    height: var(--header-h);
    margin: 0 auto;
    padding: 0 var(--sp-5);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }
  .logo {
    width: 46px;
    height: 46px;
    background-image: var(--logo-maf);
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }
  .titles {
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.2;
    white-space: nowrap;
  }
  h1 span {
    background: linear-gradient(92deg, var(--brand-blue-bright), var(--brand-gold));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  p {
    margin: 2px 0 0;
    font-size: var(--fs-xs);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
    white-space: nowrap;
  }
  .spacer {
    flex: 1;
  }
  /* Chip cabor aktif — sekaligus jalan kembali ke layar pilihan cabor. */
  .cabor {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 5px 12px 5px 6px;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
    border-radius: var(--r-pill);
    transition: background var(--dur) var(--ease);
  }
  .cabor:hover {
    background: color-mix(in srgb, var(--tone) 24%, transparent);
  }
  .cabor img {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }
  .cabor .swap {
    width: 13px;
    height: 13px;
    opacity: 0.75;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 6px var(--sp-3);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .pulse {
    width: 7px;
    height: 7px;
    background: #2ecc71;
    border-radius: var(--r-pill);
    box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.18);
  }

  .terkunci-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 6px var(--sp-3);
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--brand-gold, var(--accent));
    background: color-mix(in srgb, var(--brand-gold, var(--accent)) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-gold, var(--accent)) 36%, transparent);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .terkunci-chip svg {
    width: 14px;
    height: 14px;
  }

  .kode-tim {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 7px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--brand-gold, var(--accent));
    background: color-mix(in srgb, var(--brand-gold, var(--accent)) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-gold, var(--accent)) 34%, transparent);
    border-radius: var(--r-pill);
    transition: background var(--dur) var(--ease);
  }
  .kode-tim:hover {
    background: color-mix(in srgb, var(--brand-gold, var(--accent)) 22%, transparent);
  }
  .kode-tim svg {
    width: 15px;
    height: 15px;
  }

  /* --- Masuk / identitas pengguna --- */
  .masuk {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 7px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .masuk:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .masuk svg {
    width: 15px;
    height: 15px;
  }

  .sesi {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 5px 5px 5px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--peran-tone);
    background: color-mix(in srgb, var(--peran-tone) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--peran-tone) 38%, transparent);
    border-radius: var(--r-pill);
  }
  .sesi .peran {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .sesi .nama {
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }
  .sesi .pisah {
    width: 1px;
    height: 16px;
    background: color-mix(in srgb, var(--peran-tone) 38%, transparent);
  }
  .sesi button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    color: inherit;
    border-radius: var(--r-pill);
  }
  .sesi button:hover {
    background: color-mix(in srgb, var(--peran-tone) 22%, transparent);
  }
  .sesi button svg {
    width: 14px;
    height: 14px;
  }

  @media (max-width: 700px) {
    .sesi .nama,
    .masuk span,
    .kode-tim span,
    .terkunci-chip span {
      display: none;
    }
  }
  @media (max-width: 980px) {
    .bar {
      padding: 0 var(--sp-4);
    }
    .meta {
      display: none;
    }
  }
  @media (max-width: 560px) {
    :host {
      --header-h: 58px;
    }
    .bar {
      gap: var(--sp-2);
      padding: 0 var(--sp-3);
    }
    .logo {
      width: 34px;
      height: 34px;
    }
    h1 {
      font-size: var(--fs-md);
    }
    /* Tagline dilepas agar judul tidak terpotong di layar 360–390 px. */
    p {
      display: none;
    }
  }
`;

export class AppHeader extends BaseElement {
  static styles = [styles];

  render() {
    const { meta, filters, auth } = store.state;
    const game = filters.game ? GAME_META[filters.game] : null;
    const tone = auth?.peran === PERAN.ADMIN ? 'var(--brand-gold, #ffc400)' : 'var(--game-mlbb)';
    // Kode tim hanya berarti kalau ada cabor yang sedang dibuka — daftarnya
    // memang per cabor.
    const bisaLihatKode = auth?.peran === PERAN.ADMIN && Boolean(filters.game);
    this.shadowRoot.innerHTML = `
      <div class="bar">
        <div class="brand">
          <div class="logo" role="img" aria-label="Logo MAF 2026"></div>
          <div class="titles">
            <h1>Dashboard Peserta <span>E-Sport</span></h1>
            <p>MAF 2026 · Road to HUT 28</p>
          </div>
        </div>

        <div class="spacer"></div>

        ${
          game
            ? `<button class="cabor" type="button" data-action="swap-game"
                       style="--tone:${game.color}" title="Ganti cabang olahraga">
                 <img src="${esc(game.logo)}" alt="" />${esc(game.label)}
                 <svg class="swap" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M2.5 5.5h9m0 0L9 3m2.5 2.5L9 8M13.5 10.5h-9m0 0L7 8m-2.5 2.5L7 13"
                         stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                 </svg>
               </button>`
            : ''
        }

        ${
          caborTerkunci(store.state)
            ? `<span class="terkunci-chip" title="Roster cabor ini dikunci — Kode Tim tidak berlaku">
                 <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <rect x="3" y="7" width="10" height="7" rx="1.8" stroke="currentColor" stroke-width="1.5" />
                   <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" stroke-width="1.5" />
                 </svg>
                 <span>Terkunci</span>
               </span>`
            : ''
        }

        ${
          bisaLihatKode
            ? `<button class="kode-tim" type="button" data-action="kode-tim" title="Daftar Kode Tim">
                 <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M9.6 6.4a3.2 3.2 0 1 1-4.5 4.5l-2.7 2.7H1v-1.4l4.1-4.1a3.2 3.2 0 0 1 4.5-1.7Z"
                         stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                   <path d="m10.4 5.6 4.6-4.6M12.4 3.6l1.4 1.4" stroke="currentColor"
                         stroke-width="1.4" stroke-linecap="round" />
                 </svg>
                 <span>Kode Tim</span>
               </button>`
            : ''
        }

        ${
          meta?.lastupdate
            ? `<div class="meta"><span class="pulse"></span>Data ${esc(formatDate(meta.lastupdate))}</div>`
            : ''
        }

        ${
          auth
            ? `<div class="sesi" style="--peran-tone:${tone}">
                 <span class="peran">${esc(auth.peran)}</span>
                 <span class="nama">${esc(auth.nama)}</span>
                 <span class="pisah"></span>
                 <button type="button" data-action="keluar" title="Keluar" aria-label="Keluar dari sesi ${esc(auth.nama)}">
                   <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                     <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11 14 8m0 0-3.5-3M14 8H6"
                           stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                   </svg>
                 </button>
               </div>`
            : `<button class="masuk" type="button" data-action="masuk">
                 <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M11 5.5A3 3 0 1 1 5 5.5a3 3 0 0 1 6 0ZM2.5 14v-.8A3.2 3.2 0 0 1 5.7 10h4.6a3.2 3.2 0 0 1 3.2 3.2v.8"
                         stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                 </svg>
                 <span>Masuk</span>
               </button>`
        }
      </div>`;
  }

  onMount() {
    this.track(store.subscribe(() => this.requestRender()));
    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('[data-action="swap-game"]')) {
        clearGame();
        return;
      }
      if (event.target.closest('[data-action="masuk"]')) {
        this.emit('minta-masuk');
        return;
      }
      if (event.target.closest('[data-action="kode-tim"]')) {
        setShowCodes(true);
        return;
      }
      if (event.target.closest('[data-action="keluar"]')) keluar();
    });
  }
}

define('app-header', AppHeader);
