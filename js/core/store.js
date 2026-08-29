/**
 * Store observable minimal: satu sumber kebenaran, komponen berlangganan
 * perubahan. Notifikasi dibatch ke microtask agar beberapa set() beruntun
 * hanya memicu satu kali render.
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();
  let pending = false;

  function flush() {
    pending = false;
    for (const fn of [...listeners]) fn(state);
  }

  return {
    get state() {
      return state;
    },

    /** patch berupa objek atau fungsi (state) => patch. */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      let changed = false;
      for (const key of Object.keys(next)) {
        if (!Object.is(state[key], next[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return state;
      state = { ...state, ...next };
      if (!pending) {
        pending = true;
        queueMicrotask(flush);
      }
      return state;
    },

    /** Kembalikan unsubscribe; `immediate` untuk sinkronisasi awal. */
    subscribe(listener, immediate = false) {
      listeners.add(listener);
      if (immediate) listener(state);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Bungkus selector agar listener hanya jalan saat irisan state yang dipedulikan
 * berubah (perbandingan dangkal).
 */
export function select(store, selector, listener, immediate = false) {
  let prev = selector(store.state);
  const unsub = store.subscribe((state) => {
    const next = selector(state);
    if (shallowEqual(prev, next)) return;
    prev = next;
    listener(next, state);
  });
  if (immediate) listener(prev, store.state);
  return unsub;
}

export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.is(a[k], b[k]));
}
