/**
 * <sport-gate> — layar pilihan cabang olahraga sebelum masuk dashboard.
 *
 * Cabor dipindah ke sini, bukan lagi menjadi dua kartu besar di dalam dashboard.
 * Alasannya ruang: kartu itu memakan baris teratas layar terus-menerus padahal
 * dipakai sekali di awal. Cabor yang sedang aktif tetap terlihat sebagai chip di
 * header, dan chip itulah jalan kembali ke layar ini.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, num } from '../core/format.js';
import { GAME_META, summarize } from '../data/source.js';
import { setFilter, store } from '../data/app-state.js';

const styles = css`
  :host {
    display: grid;
    place-items: center;
    min-height: calc(100vh - var(--header-h));
    padding: var(--sp-6) var(--sp-5) var(--sp-7);
  }
  .wrap {
    width: 100%;
    max-width: 900px;
    text-align: center;
  }
  .logo {
    width: 128px;
    height: 128px;
    margin: 0 auto var(--sp-4);
    background-image: var(--logo-maf);
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .lead {
    margin: var(--sp-2) 0 var(--sp-6);
    font-size: var(--fs-md);
    color: var(--text-muted);
  }

  .rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-4);
  }
  button {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-6) var(--sp-5);
    text-align: center;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--r-lg);
    overflow: hidden;
    transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease), background var(--dur) var(--ease);
  }
  button::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 4px;
    background: var(--tone);
    transform: scaleX(0);
    transition: transform 260ms var(--ease);
  }
  button:hover {
    transform: translateY(-3px);
    border-color: var(--tone);
    background: linear-gradient(160deg, color-mix(in srgb, var(--tone) 16%, transparent), transparent 62%),
      var(--surface);
    box-shadow: var(--shadow-md);
  }
  button:hover::after {
    transform: scaleX(1);
  }
  .badge {
    display: grid;
    place-items: center;
    width: 104px;
    height: 104px;
    background: color-mix(in srgb, var(--tone) 15%, transparent);
    border-radius: var(--r-md);
  }
  .badge img {
    width: 84px;
    height: 84px;
    object-fit: contain;
  }
  /* .info dan anak-anaknya harus block: sebagai span inline, nama, subjudul,
     dan hitungan berdempetan jadi satu baris. */
  .info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-width: 0;
  }
  .name,
  .full,
  .counts {
    display: block;
  }
  .name {
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .full {
    margin-top: 2px;
    font-size: var(--fs-xs);
    font-weight: 500;
    color: var(--text-faint);
  }
  .counts {
    margin-top: var(--sp-3);
    padding-top: var(--sp-3);
    width: 100%;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    border-top: 1px solid var(--border);
  }
  .counts b {
    color: var(--text);
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--tone);
  }
  .go svg {
    width: 14px;
    height: 14px;
    transition: transform var(--dur) var(--ease);
  }
  button:hover .go svg {
    transform: translateX(3px);
  }

  @media (max-width: 700px) {
    :host {
      min-height: auto;
      padding: var(--sp-5) var(--sp-4) var(--sp-6);
    }
    .logo {
      width: 92px;
      height: 92px;
    }
    h2 {
      font-size: var(--fs-xl);
    }
    .rail {
      grid-template-columns: 1fr;
      gap: var(--sp-3);
    }
    button {
      flex-direction: row;
      align-items: center;
      text-align: left;
      padding: var(--sp-4);
    }
    .info {
      align-items: flex-start;
    }
    .badge {
      width: 68px;
      height: 68px;
      flex: none;
    }
    .badge img {
      width: 54px;
      height: 54px;
    }
    .counts {
      width: auto;
      margin-top: var(--sp-2);
      padding-top: var(--sp-2);
      font-size: var(--fs-xs);
    }
    .go {
      display: none;
    }
  }
`;

const ARROW = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M3 8h9m0 0L8.6 4.6M12 8l-3.4 3.4" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

export class SportGate extends BaseElement {
  static styles = [styles];

  render() {
    const state = store.state;
    if (!state.teams.length) return;

    const totals = summarize(state.teams);

    this.shadowRoot.innerHTML = `
      <div class="wrap">
        <div class="logo" role="img" aria-label="MAF 2026"></div>
        <h2>Peserta E-Sport MAF 2026</h2>
        <p class="lead">Pilih cabang olahraga untuk melihat daftar timnya.</p>

        <div class="rail" role="list">
          ${state.facets.games
            .map((game) => {
              const meta = GAME_META[game] || { label: game, full: '', logo: '', color: 'var(--accent)' };
              const bucket = totals.perGame[game] || { teams: 0, players: 0 };
              return `
              <button type="button" role="listitem" data-value="${esc(game)}" style="--tone:${meta.color}">
                <span class="badge"><img src="${esc(meta.logo)}" alt="" /></span>
                <span class="info">
                  <span class="name">${esc(meta.label)}</span>
                  <span class="full">${esc(meta.full || '')}</span>
                  <span class="counts">
                    <b>${num(bucket.teams)}</b> tim · <b>${num(bucket.players)}</b> pemain
                  </span>
                </span>
                <span class="go">Lihat tim ${ARROW}</span>
              </button>`;
            })
            .join('')}
        </div>
      </div>`;
  }

  onMount() {
    this.track(store.subscribe(() => this.requestRender()));

    this.listen(this.shadowRoot, 'click', (event) => {
      const button = event.target.closest('button[data-value]');
      if (button) setFilter({ game: button.dataset.value });
    });
  }
}

define('sport-gate', SportGate);
