/** <ui-search> — input pencarian dengan debounce, tombol clear, shortcut "/". */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { debounce, esc } from '../core/format.js';

const styles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .field {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    height: 42px;
    padding: 0 var(--sp-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  }
  .field:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  svg {
    flex: none;
    width: 17px;
    height: 17px;
    color: var(--text-faint);
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    font: inherit;
    font-size: var(--fs-md);
    color: var(--text);
  }
  input::placeholder {
    color: var(--text-faint);
  }
  kbd {
    flex: none;
    padding: 2px 6px;
    font-family: var(--font);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--r-xs);
  }
  .clear {
    flex: none;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    color: var(--text-muted);
    background: var(--surface-inset);
    border: 0;
    border-radius: var(--r-pill);
    line-height: 1;
  }
  .clear:hover {
    color: var(--text);
    background: var(--border-strong);
  }

  /* Tidak ada papan ketik fisik di ponsel — petunjuk "/" hanya makan tempat. */
  @media (max-width: 640px), (pointer: coarse) {
    kbd {
      display: none;
    }
  }
`;

export class UiSearch extends BaseElement {
  static styles = [styles];
  static observedAttributes = ['value', 'placeholder'];

  constructor() {
    super();
    this._emit = debounce((value) => this.emit('search', { value }), 180);
  }

  attributeChangedCallback(name, oldValue, value) {
    if (name === 'value' && this.isConnected) {
      const input = this.$('input');
      if (input && input.value !== value) input.value = value ?? '';
      this.$('.clear')?.toggleAttribute('hidden', !value);
    }
  }

  render() {
    const value = this.getAttribute('value') ?? '';
    const placeholder = this.getAttribute('placeholder') ?? 'Cari…';
    this.shadowRoot.innerHTML = `
      <div class="field">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8" />
          <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input type="search" value="${esc(value)}" placeholder="${esc(placeholder)}"
               aria-label="${esc(placeholder)}" autocomplete="off" spellcheck="false" />
        <button class="clear" type="button" aria-label="Bersihkan pencarian" ${value ? '' : 'hidden'}>×</button>
        <kbd>/</kbd>
      </div>`;
  }

  onMount() {
    const input = this.$('input');
    this.listen(input, 'input', () => {
      this.$('.clear').toggleAttribute('hidden', !input.value);
      this.$('kbd').toggleAttribute('hidden', Boolean(input.value));
      this._emit(input.value);
    });
    this.listen(input, 'keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        event.stopPropagation();
        this.clear();
      }
    });
    this.listen(this.$('.clear'), 'click', () => this.clear());

    // "/" di mana saja memfokuskan pencarian — kebiasaan power user.
    this.listen(document, 'keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(deepActiveElement())) return;
      event.preventDefault();
      this.focusInput();
    });
  }

  clear() {
    const input = this.$('input');
    input.value = '';
    this.$('.clear').setAttribute('hidden', '');
    this.$('kbd').removeAttribute('hidden');
    this._emit.cancel();
    this.emit('search', { value: '' });
    input.focus();
  }

  focusInput() {
    this.$('input')?.focus();
    this.$('input')?.select();
  }
}

/**
 * document.activeElement berhenti di host komponen, bukan elemen di dalam
 * Shadow DOM — telusuri sampai elemen terdalam yang benar-benar fokus.
 */
function deepActiveElement() {
  let node = document.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
}

function isTypingTarget(node) {
  if (!node) return false;
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable;
}

define('ui-search', UiSearch);
