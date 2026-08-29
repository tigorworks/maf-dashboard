/**
 * <ui-combo> — combobox dengan pencarian di dalam popup. Dipakai untuk filter
 * kontingen (18 opsi) dan unit kerja (puluhan opsi) di mana <select> polos
 * menyulitkan pencarian.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, normalize, num } from '../core/format.js';

const styles = css`
  :host {
    display: block;
    position: relative;
    min-width: 0;
  }
  .trigger {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    height: 42px;
    padding: 0 var(--sp-3);
    font-size: var(--fs-md);
    text-align: left;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  }
  .trigger:hover {
    border-color: var(--border-strong);
  }
  .trigger[aria-expanded='true'] {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value[data-empty='true'] {
    color: var(--text-faint);
  }
  .caret {
    flex: none;
    width: 14px;
    height: 14px;
    color: var(--text-faint);
    transition: transform var(--dur) var(--ease);
  }
  .trigger[aria-expanded='true'] .caret {
    transform: rotate(180deg);
  }
  .popup {
    position: absolute;
    z-index: 40;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    max-height: 320px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
  .popup input {
    height: 40px;
    padding: 0 var(--sp-3);
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--surface-2);
    border: 0;
    border-bottom: 1px solid var(--border);
    outline: 0;
  }
  ul {
    margin: 0;
    padding: var(--sp-1);
    overflow-y: auto;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    font-size: var(--fs-sm);
    border-radius: var(--r-xs);
    cursor: pointer;
  }
  li[aria-selected='true'] {
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-soft);
  }
  li.active {
    background: var(--row-hover);
  }
  li .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  li .count {
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }
  .empty {
    padding: var(--sp-4);
    font-size: var(--fs-sm);
    text-align: center;
    color: var(--text-faint);
  }
`;

export class UiCombo extends BaseElement {
  static styles = [styles];
  static observedAttributes = ['value', 'placeholder', 'label'];

  constructor() {
    super();
    this._options = [];
    this._open = false;
    this._query = '';
    this._active = 0;
  }

  set options(list) {
    this._options = list || [];
    this.requestRender();
  }

  get options() {
    return this._options;
  }

  attributeChangedCallback() {
    this.requestRender();
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  render() {
    const value = this.value;
    const placeholder = this.getAttribute('placeholder') || 'Semua';
    const label = this.getAttribute('label') || placeholder;
    const selected = this._options.find((o) => o.value === value);

    this.shadowRoot.innerHTML = `
      <button class="trigger" type="button" aria-haspopup="listbox"
              aria-expanded="${this._open}" aria-label="${esc(label)}">
        <span class="value" data-empty="${!selected}">${esc(selected ? selected.label : placeholder)}</span>
        <svg class="caret" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      ${this._open ? this._popup(placeholder) : ''}`;

    if (this._open) {
      const search = this.$('.popup input');
      search.value = this._query;
      search.focus();
      this._scrollActiveIntoView();
    }
  }

  /** `required` menghilangkan opsi kosong "Semua" (mis. untuk pemilih urutan). */
  _visibleOptions() {
    const needle = normalize(this._query);
    const all = this.hasAttribute('required')
      ? [...this._options]
      : [{ value: '', label: this.getAttribute('placeholder') || 'Semua' }, ...this._options];
    return needle ? all.filter((o) => normalize(o.label).includes(needle)) : all;
  }

  _popup(placeholder) {
    const items = this._visibleOptions();
    return `
      <div class="popup" role="dialog">
        <input type="text" placeholder="Cari ${esc(placeholder.toLowerCase())}…" aria-label="Cari opsi" autocomplete="off" />
        ${
          items.length
            ? `<ul role="listbox">
                ${items
                  .map(
                    (option, i) => `
                  <li role="option" data-value="${esc(option.value)}"
                      class="${i === this._active ? 'active' : ''}"
                      aria-selected="${option.value === this.value}">
                    <span class="label">${esc(option.label)}</span>
                    ${option.count === undefined ? '' : `<span class="count">${num(option.count)}</span>`}
                  </li>`
                  )
                  .join('')}
              </ul>`
            : '<p class="empty">Tidak ada yang cocok</p>'
        }
      </div>`;
  }

  onMount() {
    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('.trigger')) {
        this._toggle(!this._open);
        return;
      }
      const item = event.target.closest('li[data-value]');
      if (item) this._commit(item.dataset.value);
    });

    this.listen(this.shadowRoot, 'input', (event) => {
      if (event.target.tagName !== 'INPUT') return;
      this._query = event.target.value;
      this._active = 0;
      this.render();
    });

    this.listen(this.shadowRoot, 'keydown', (event) => this._onKeydown(event));
    this.listen(this.shadowRoot, 'mousemove', (event) => {
      const item = event.target.closest('li[data-value]');
      if (!item) return;
      const index = [...item.parentElement.children].indexOf(item);
      if (index === this._active) return;
      this._active = index;
      this.$$('li').forEach((el, i) => el.classList.toggle('active', i === index));
    });

    // Klik di luar komponen menutup popup.
    this.listen(document, 'pointerdown', (event) => {
      if (this._open && !event.composedPath().includes(this)) this._toggle(false);
    });
  }

  _onKeydown(event) {
    if (!this._open) {
      if (['Enter', ' ', 'ArrowDown'].includes(event.key) && event.target.closest('.trigger')) {
        event.preventDefault();
        this._toggle(true);
      }
      return;
    }

    const items = this._visibleOptions();
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._toggle(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this._active = (this._active + step + items.length) % items.length;
      this.$$('li').forEach((el, i) => el.classList.toggle('active', i === this._active));
      this._scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = items[this._active];
      if (option) this._commit(option.value);
    }
  }

  _scrollActiveIntoView() {
    this.$('li.active')?.scrollIntoView({ block: 'nearest' });
  }

  _toggle(open) {
    this._open = open;
    this._query = '';
    this._active = Math.max(
      0,
      this._visibleOptions().findIndex((o) => o.value === this.value)
    );
    this.render();
    if (!open) this.$('.trigger')?.focus();
  }

  _commit(value) {
    this._open = false;
    this.setAttribute('value', value);
    this.render();
    this.$('.trigger')?.focus();
    this.emit('change', { value });
  }
}

define('ui-combo', UiCombo);
