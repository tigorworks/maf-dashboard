/**
 * Tagged template `css` -> CSSStyleSheet yang bisa dibagi-pakai antar instance
 * komponen (constructable stylesheet). Kalau browser tidak mendukung,
 * fallback ke elemen <style> di dalam shadow root.
 */

const SUPPORTS_CONSTRUCTABLE =
  typeof CSSStyleSheet !== 'undefined' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  'adoptedStyleSheets' in Document.prototype;

export function css(strings, ...values) {
  const text = strings.raw.reduce((out, chunk, i) => out + chunk + (values[i] ?? ''), '');
  if (!SUPPORTS_CONSTRUCTABLE) return text;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  return sheet;
}

export function applyStyles(shadowRoot, sheets) {
  if (SUPPORTS_CONSTRUCTABLE) {
    shadowRoot.adoptedStyleSheets = sheets;
    return;
  }
  const style = document.createElement('style');
  style.textContent = sheets.join('\n');
  shadowRoot.prepend(style);
}

/** Reset dasar yang diadopsi setiap komponen. */
export const baseStyles = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font);
    color: var(--text);
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  [hidden] {
    display: none !important;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--r-xs);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
`;
