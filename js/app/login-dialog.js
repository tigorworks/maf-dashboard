/**
 * <login-dialog> — dialog masuk untuk admin & relawan.
 *
 * Yang diminta hanya satu kunci; perannya ditentukan GAS dari kunci itu, bukan
 * dipilih pengguna. Menampilkan pilihan "masuk sebagai admin/relawan" hanya akan
 * membuka informasi bahwa dua tingkat wewenang itu ada, tanpa manfaat apa pun.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc } from '../core/format.js';
import { masuk } from '../data/auth.js';

const styles = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: none;
  }
  :host([open]) {
    display: block;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(6, 10, 24, 0.72);
    backdrop-filter: blur(3px);
  }
  .kotak {
    position: relative;
    width: min(420px, calc(100vw - 2 * var(--sp-4)));
    margin: min(18vh, 140px) auto 0;
    padding: var(--sp-6);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg, 0 24px 64px rgba(0, 0, 0, 0.5));
  }
  .lambang {
    width: 54px;
    height: 54px;
    margin-bottom: var(--sp-3);
    background-image: var(--logo-maf);
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  p.lead {
    margin: var(--sp-2) 0 var(--sp-5);
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  label {
    display: block;
    margin-bottom: var(--sp-2);
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  input {
    width: 100%;
    padding: 13px var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    letter-spacing: 0.08em;
    color: var(--text);
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  input:focus-visible {
    border-color: var(--accent);
  }
  .aksi {
    display: flex;
    gap: var(--sp-2);
    margin-top: var(--sp-5);
  }
  button {
    flex: 1;
    padding: 12px var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 700;
    border-radius: var(--r-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
  }
  button.utama {
    color: #10203f;
    background: var(--gold, var(--accent));
    border-color: transparent;
  }
  button:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  .pesan {
    min-height: 20px;
    margin: var(--sp-3) 0 0;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-muted);
  }
  .pesan.galat {
    color: #ff8f8f;
  }
  .catatan {
    margin: var(--sp-5) 0 0;
    padding-top: var(--sp-4);
    font-size: var(--fs-xs);
    line-height: 1.6;
    color: var(--text-faint);
    border-top: 1px solid var(--border);
  }
`;

export class LoginDialog extends BaseElement {
  static styles = [styles];

  constructor() {
    super();
    this._sibuk = false;
    this._pesanTeks = '';
    this._pesanJenis = '';
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="scrim"></div>
      <section class="kotak" role="dialog" aria-modal="true" aria-labelledby="judul">
        <div class="lambang" role="img" aria-label="MAF 2026"></div>
        <h2 id="judul">Masuk</h2>
        <p class="lead">Untuk panitia, relawan verifikasi, dan PIC tim.</p>

        <form>
          <label for="kunci">Kunci akses atau Kode Tim</label>
          <input id="kunci" name="kunci" type="password" autocomplete="off" spellcheck="false"
                 placeholder="MAF-XXXX-… atau Kode Tim" maxlength="32" />
          <p class="pesan ${esc(this._pesanJenis)}" role="status" aria-live="polite">${esc(this._pesanTeks)}</p>
          <div class="aksi">
            <button type="button" data-act="batal">Batal</button>
            <button type="submit" class="utama" ${this._sibuk ? 'disabled' : ''}>
              ${this._sibuk ? 'Memeriksa…' : 'Masuk'}
            </button>
          </div>
        </form>

        <p class="catatan">
          PIC memakai <b>Kode Tim</b> dari panitia: masuk dengan kode itu membuka
          pengubahan terbatas dan unggahan berkas untuk seluruh tim kontingennya.
          Sesi berakhir sendiri setelah 3 jam tidak digunakan. Kunci dibagikan
          panitia dan berlaku untuk satu orang — jangan diteruskan.
        </p>
      </section>`;
  }

  onMount() {
    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('[data-act="batal"]') || event.target.classList.contains('scrim')) {
        this.tutup();
      }
    });

    this.listen(this.shadowRoot, 'submit', (event) => {
      event.preventDefault();
      this._masuk();
    });

    this.listen(document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.hasAttribute('open')) this.tutup();
    });
  }

  buka() {
    // Render ulang dari keadaan bersih. Tanpa ini, dialog yang pernah dipakai
    // akan dibuka kembali dengan tombol yang masih disabled dan bertuliskan
    // "Memeriksa…" — sisa dari login sebelumnya yang berhasil lalu ditutup.
    this._sibuk = false;
    this._pesanTeks = '';
    this._pesanJenis = '';
    this.render();

    this.setAttribute('open', '');
    this._kembaliFokus = document.activeElement;
    requestAnimationFrame(() => {
      const input = this.$('#kunci');
      if (input) {
        input.value = '';
        input.focus();
      }
    });
  }

  tutup() {
    this.removeAttribute('open');
    this._kembaliFokus?.focus?.();
    this._kembaliFokus = null;
  }

  async _masuk() {
    if (this._sibuk) return;
    const kunci = this.$('#kunci')?.value.trim();
    if (!kunci) {
      this._pesan('Kunci belum diisi.', 'galat');
      this.$('#kunci')?.focus();
      return;
    }

    this._sibuk = true;
    this._pesan('Memeriksa kunci…');
    this.render();

    try {
      const sesi = await masuk(kunci);
      this._sibuk = false;
      this.render(); // kembalikan tombol ke keadaan siap sebelum ditutup
      this.tutup();
      this.emit('masuk', sesi);
    } catch (error) {
      this._sibuk = false;
      this.render();
      this._pesan(error.message || 'Kunci atau Kode Tim tidak dikenal.', 'galat');
      const input = this.$('#kunci');
      input?.focus();
      input?.select();
    }
  }

  _pesan(teks, jenis = '') {
    this._pesanTeks = teks;
    this._pesanJenis = jenis;
    const el = this.$('.pesan');
    if (!el) return;
    el.textContent = teks;
    el.className = `pesan ${jenis}`.trim();
  }
}

define('login-dialog', LoginDialog);
