/**
 * Base class seluruh komponen: Shadow DOM + adopted stylesheet + render()
 * idempoten + pembersihan listener/subscription otomatis saat unmount.
 */
import { applyStyles, baseStyles } from './css.js';

export class BaseElement extends HTMLElement {
  /** @type {Array<CSSStyleSheet|string>} diisi subclass */
  static styles = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._cleanups = [];
    this._frame = 0;
    this._mounted = false;
  }

  connectedCallback() {
    if (!this._stylesApplied) {
      applyStyles(this.shadowRoot, [baseStyles, ...this.constructor.styles]);
      this._stylesApplied = true;
    }
    this._mounted = true;
    this.render();
    this.onMount?.();
  }

  disconnectedCallback() {
    this._mounted = false;
    cancelAnimationFrame(this._frame);
    this._cleanups.forEach((fn) => fn());
    this._cleanups = [];
    this.onUnmount?.();
  }

  /** Daftarkan fungsi pembersih (unsubscribe store, removeEventListener, dll). */
  track(cleanup) {
    if (typeof cleanup === 'function') this._cleanups.push(cleanup);
    return cleanup;
  }

  /** addEventListener yang otomatis dilepas saat komponen dilepas. */
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.track(() => target.removeEventListener(type, handler, options));
  }

  /** Render ditunda ke frame berikutnya; panggilan beruntun dikoalesir. */
  requestRender() {
    if (!this._mounted || this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      if (this._mounted) this.render();
    });
  }

  /** Subclass mengoverride ini. */
  render() {}

  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  $$(selector) {
    return [...this.shadowRoot.querySelectorAll(selector)];
  }

  /** Event kustom yang menembus shadow boundary. */
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

/** Registrasi aman terhadap hot-reload / double import. */
export function define(tagName, ctor) {
  if (!customElements.get(tagName)) customElements.define(tagName, ctor);
  return ctor;
}
