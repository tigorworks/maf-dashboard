/** Utilitas format & sanitasi yang dipakai lintas komponen. */

const DATE_FMT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const NUM_FMT = new Intl.NumberFormat('id-ID');

/** Escape untuk interpolasi ke dalam template HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function num(value) {
  return NUM_FMT.format(value ?? 0);
}

/** '2020-05-01' -> '01 Mei 2020'; nilai non-ISO dikembalikan apa adanya. */
export function formatDate(iso) {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? iso : DATE_FMT.format(date);
}

export function year(iso) {
  const match = /^(\d{4})/.exec(iso || '');
  return match ? match[1] : '';
}

/** Inisial untuk avatar fallback logo tim. */
export function initials(name) {
  const words = String(name || '?')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Hue deterministik dari string — warna avatar stabil antar reload. */
export function hueOf(text) {
  let hash = 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) % 360;
  return hash;
}

/** Normalisasi untuk pencarian: lowercase + buang diakritik. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Bungkus potongan yang cocok dengan <mark>.
 * Pencocokan hanya case-insensitive (tanpa NFD) supaya offset tetap sejajar
 * dengan string asli; escape dilakukan per potongan.
 */
export function highlight(text, query) {
  const raw = String(text ?? '');
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return esc(raw);
  const at = raw.toLowerCase().indexOf(needle);
  if (at < 0) return esc(raw);
  return `${esc(raw.slice(0, at))}<mark>${esc(raw.slice(at, at + needle.length))}</mark>${esc(
    raw.slice(at + needle.length)
  )}`;
}

export function debounce(fn, wait = 200) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** Bandingkan untuk sort: null selalu di belakang, teks pakai localeCompare. */
export function compare(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'id', { sensitivity: 'base', numeric: true });
}

