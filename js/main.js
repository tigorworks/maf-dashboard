/**
 * Entry point. Satu-satunya tugasnya: mendaftarkan komponen akar.
 * Seluruh perilaku lain hidup di dalam komponen masing-masing.
 */
import './app/app-shell.js';

// Bantu diagnosis saat dashboard dibuka langsung lewat file:// (ES module diblokir CORS).
if (location.protocol === 'file:') {
  console.warn(
    'Dashboard dibuka lewat file:// — ES module dan fetch akan diblokir browser.\n' +
      'Jalankan: python3 -m http.server 3456, lalu buka http://localhost:3456/'
  );
}
