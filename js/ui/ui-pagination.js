/** <ui-pagination> — navigasi halaman dengan elipsis. Jumlah baris per halaman
 * dikunci di app-state, jadi komponen ini tidak lagi menyediakan pemilihnya. */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, num } from '../core/format.js';

const styles = css`
  :host {
    display: block;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--border);
  }
  .info {
    font-size: var(--fs-sm);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .info b {
    color: var(--text);
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
  }
  .pages {
    display: flex;
    gap: 2px;
  }
  button {
    min-width: 32px;
    height: 32px;
    padding: 0 var(--sp-2);
    font-size: var(--fs-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--r-xs);
  }
  button:hover:not(:disabled) {
    color: var(--text);
    background: var(--surface-inset);
  }
  button[aria-current='page'] {
    color: var(--accent-contrast);
    background: var(--accent);
    border-color: var(--accent);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .gap {
    display: grid;
    place-items: center;
    min-width: 24px;
    color: var(--text-faint);
  }
  @media (max-width: 720px) {
    .bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--sp-3);
      padding: var(--sp-3);
    }
    .info,
    .right {
      justify-content: center;
      text-align: center;
    }
    .right {
      flex-direction: column-reverse;
      gap: var(--sp-3);
    }
    .pages {
      justify-content: center;
      width: 100%;
    }
    /* Target sentuh 40px, dan tombol panah dilebarkan agar mudah ditekan. */
    button {
      min-width: 40px;
      height: 40px;
    }
    button[data-go]:first-child,
    button[data-go]:last-child {
      flex: 1;
      max-width: 88px;
      background: var(--surface-2);
      border-color: var(--border);
    }
  }
`;

export class UiPagination extends BaseElement {
  static styles = [styles];
  static observedAttributes = ['page', 'page-count', 'total', 'shown', 'offset', 'unit'];

  attributeChangedCallback() {
    this.requestRender();
  }

  render() {
    const page = Number(this.getAttribute('page') || 1);
    const pageCount = Number(this.getAttribute('page-count') || 1);
    const total = Number(this.getAttribute('total') || 0);
    const shown = Number(this.getAttribute('shown') || 0);
    const offset = Number(this.getAttribute('offset') || 0);
    const unit = this.getAttribute('unit') || 'baris';
    const from = total ? offset + 1 : 0;

    this.shadowRoot.innerHTML = `
      <div class="bar">
        <p class="info">Menampilkan <b>${num(from)}–${num(offset + shown)}</b> dari <b>${num(total)}</b> ${esc(unit)}</p>
        <div class="right">
          <div class="pages" role="group" aria-label="Navigasi halaman">
            <button data-go="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>
            ${pageRange(page, pageCount)
              .map((item) =>
                item === '…'
                  ? '<span class="gap">…</span>'
                  : `<button data-go="${item}" ${item === page ? 'aria-current="page"' : ''}>${item}</button>`
              )
              .join('')}
            <button data-go="${page + 1}" ${page >= pageCount ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button>
          </div>
        </div>
      </div>`;
  }

  onMount() {
    this.listen(this.shadowRoot, 'click', (event) => {
      const button = event.target.closest('button[data-go]');
      if (!button || button.disabled) return;
      this.emit('page', { page: Number(button.dataset.go) });
    });
  }
}

/** [1, …, 4, 5, 6, …, 20] — maksimal 7 slot. */
function pageRange(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

define('ui-pagination', UiPagination);
