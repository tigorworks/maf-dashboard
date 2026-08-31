/**
 * <code-list> — daftar kode yang sedang aktif. Khusus admin.
 *
 * Satu baris = satu KONTINGEN, bukan satu tim. Kode berlaku untuk seluruh tim
 * satu kontingen di semua cabor, jadi daftar ini pun tidak disaring per cabor:
 * menyaringnya akan menyembunyikan separuh akibat dari kode yang sama.
 *
 * Datanya TIDAK berasal dari store: kode dan No HP sengaja tidak pernah ikut
 * payload publik (lihat KOLOM_RAHASIA di Code.gs). Halaman ini mengambilnya
 * lewat permintaan ber-token tersendiri, dan GAS menolak siapa pun selain admin.
 *
 * Yang ditampilkan adalah kontak untuk MENGHUBUNGI, jadi tiap baris menyediakan
 * salin cepat: kode untuk dikirim, nomor untuk membuka percakapan.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, jamMenit, normalize, normalKontingen, num, sisaWaktu } from '../core/format.js';
import { caborTerkunci, setShowCodes, setTerkunci, store } from '../data/app-state.js';
import {
  ambilKodeTim, aturKunciRoster, buatKodeSemua, JENIS_KODE, namaJenis, resetKodeTim, UMUR_KODE,
} from '../data/auth.js';
import { GAME_META } from '../data/source.js';

const styles = css`
  :host {
    display: block;
    min-height: calc(100vh - var(--header-h));
    background: var(--bg);
  }
  .panel {
    display: flex;
    flex-direction: column;
    --tepi: max(var(--sp-6), calc((100% - var(--maxw)) / 2));
  }
  header {
    position: sticky;
    top: var(--header-h);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--tepi);
    background: var(--header-bg);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
  }
  .kembali {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 8px var(--sp-4) 8px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
  }
  .kembali:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .kembali svg {
    width: 15px;
    height: 15px;
  }
  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  h2 small {
    margin-left: var(--sp-2);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-faint);
  }
  .cari {
    flex: none;
    width: min(280px, 40vw);
    height: 36px;
    padding: 0 var(--sp-3);
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    outline: 0;
  }
  .cari:focus {
    border-color: var(--accent);
  }

  /* Peringatan ditempatkan sebelum datanya, bukan di kaki halaman: kalau
     dipasang setelah 64 baris, ia hanya terbaca oleh yang menggulir sampai
     bawah — padahal yang perlu diperingatkan justru yang langsung menyalin. */
  .nota {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--tepi);
    font-size: var(--fs-sm);
    color: var(--peringatan);
    background: color-mix(in srgb, var(--peringatan) 10%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--peringatan) 26%, transparent);
  }
  .nota b {
    color: var(--text);
  }
  /* Kabar berhasil memakai kerangka yang sama dengan peringatan supaya
     keduanya menempati tempat yang sama persis — hanya warnanya yang berbeda,
     sehingga daftar di bawahnya tidak bergeser saat kabar itu muncul. */
  .nota.sukses {
    color: #45c47a;
    background: color-mix(in srgb, #45c47a 10%, transparent);
    border-bottom-color: color-mix(in srgb, #45c47a 26%, transparent);
  }

  /* --- kendali kunci roster --- */
  .pita-kunci {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--tepi);
    font-size: var(--fs-sm);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .pita-kunci svg {
    flex: none;
    width: 18px;
    height: 18px;
    color: var(--text-faint);
  }
  .pita-teks {
    flex: 1;
    min-width: 0;
    color: var(--text-muted);
  }
  .pita-teks b {
    display: block;
    color: var(--text);
  }
  .pita-kunci button {
    flex: none;
    height: 34px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--r-sm);
  }
  .pita-kunci button.bahaya {
    color: var(--peringatan);
    border-color: color-mix(in srgb, var(--peringatan) 45%, transparent);
  }
  .pita-kunci button.utama {
    color: #10203f;
    background: var(--gold, var(--accent));
    border-color: transparent;
  }
  .pita-kunci button:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  /* Terkunci: dibedakan warna DAN ikon gembok, bukan warna saja. */
  .pita-kunci.terkunci {
    color: var(--gold, var(--accent));
    background: color-mix(in srgb, var(--gold, var(--accent)) 12%, transparent);
    border-bottom-color: color-mix(in srgb, var(--gold, var(--accent)) 32%, transparent);
  }
  .pita-kunci.terkunci svg {
    color: var(--gold, var(--accent));
  }
  .pita-kunci.konfirmasi {
    background: color-mix(in srgb, var(--peringatan) 12%, transparent);
    border-bottom-color: color-mix(in srgb, var(--peringatan) 32%, transparent);
  }

  .isi {
    padding: var(--sp-5) var(--tepi) var(--sp-7);
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--fs-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
  }
  th,
  td {
    padding: var(--sp-3);
    text-align: left;
    vertical-align: middle;
  }
  thead th {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-faint);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  tbody td {
    border-bottom: 1px solid var(--border);
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  tbody tr:nth-child(even) {
    background: var(--row-stripe);
  }
  .idx {
    width: 46px;
    text-align: right;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .kontingen {
    font-weight: 700;
    color: var(--game-pubg);
  }
  .tim {
    font-weight: 700;
    color: var(--text);
  }
  .pic small {
    display: block;
    margin-top: 1px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .hp {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* Dibungkus satu elemen supaya di mode kartu ponsel — yang menata tiap sel
     sebagai baris flex "label di kiri, nilai di kanan" — sisa waktu dan jam
     berakhirnya tetap menempel jadi satu nilai, bukan dua item yang terlempar
     ke ujung yang berbeda. */
  .berlaku {
    text-align: right;
  }
  .sisa {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: #45c47a;
  }
  .sisa.habis {
    color: var(--peringatan);
  }
  .sampai {
    display: block;
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  /* Kode berwewenang hapus ditandai: dalam satu tabel berisi puluhan baris,
     inilah satu-satunya yang akibatnya tidak bisa ditarik kembali.

     Selektornya menyebut .pic small juga, bukan .jenis-bahaya sendirian:
     aturan .pic small di atas lebih spesifik, dan akan memenangkan warnanya. */
  .pic small.jenis-bahaya {
    color: var(--peringatan);
    font-weight: 700;
  }
  .kode {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--gold, var(--accent));
    white-space: nowrap;
  }
  .salin {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    color: var(--text-faint);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .salin:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .salin svg {
    width: 14px;
    height: 14px;
  }
  .salin.selesai {
    color: #45c47a;
    border-color: #45c47a;
  }
  td.aksi {
    width: 44px;
    text-align: right;
  }

  .status {
    display: grid;
    place-items: center;
    gap: var(--sp-2);
    padding: var(--sp-7) var(--sp-4);
    text-align: center;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  @media (max-width: 900px) {
    header {
      flex-wrap: wrap;
      padding: var(--sp-2) var(--sp-3);
    }
    .kembali span {
      display: none;
    }
    .cari {
      width: 100%;
      order: 3;
    }
    .isi,
    .nota,
    .pita-kunci {
      padding-left: var(--sp-3);
      padding-right: var(--sp-3);
    }
    .pita-kunci {
      flex-wrap: wrap;
    }
    /* Tabel jadi kartu: enam kolom tidak muat di 430 px tanpa memotong kode. */
    table,
    tbody,
    tr,
    td {
      display: block;
      width: 100%;
    }
    thead {
      display: none;
    }
    tbody tr {
      padding: var(--sp-3);
      border-bottom: 1px solid var(--border);
    }
    tbody td {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: 2px 0;
      border: 0;
    }
    tbody td::before {
      content: attr(data-label);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-faint);
    }
    td.idx {
      display: none;
    }
    td.aksi {
      justify-content: flex-end;
      padding-top: var(--sp-2);
    }
  }
`;

const IKON_KEMBALI = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const IKON_GEMBOK = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <rect x="3" y="7" width="10" height="7" rx="1.8" stroke="currentColor" stroke-width="1.4" />
  <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" stroke-width="1.4" />
</svg>`;

const IKON_GEMBOK_TERBUKA = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <rect x="3" y="7" width="10" height="7" rx="1.8" stroke="currentColor" stroke-width="1.4" />
  <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0" stroke="currentColor" stroke-width="1.4" />
</svg>`;

const IKON_SALIN = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1.8" stroke="currentColor" stroke-width="1.4" />
  <path d="M10.6 5.4V4.2a1.8 1.8 0 0 0-1.8-1.8H4.2a1.8 1.8 0 0 0-1.8 1.8v4.6a1.8 1.8 0 0 0 1.8 1.8h1.2"
        stroke="currentColor" stroke-width="1.4" />
</svg>`;

const IKON_CEKLIS = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="m3.4 8.4 3 3 6.2-6.6" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

export class CodeList extends BaseElement {
  static styles = [styles];

  constructor() {
    super();
    this._data = null;
    this._galat = '';
    this._cari = '';
    this._tersalin = '';
    this._konfirmasiSemua = false;
    this._pitaSibukSemua = false;
    this._pesanAksi = '';
  }

  render() {
    const game = store.state.filters.game;
    const meta = GAME_META[game] || { label: game };
    const baris = this._tersaring();

    this.shadowRoot.innerHTML = `
      <section class="panel">
        <header>
          <button class="kembali" type="button" data-act="kembali" aria-label="Kembali ke daftar tim">
            ${IKON_KEMBALI}<span>Kembali</span>
          </button>
          <h2>Kode kontingen${
      this._data
        ? `<small>${num(baris.length)} dari ${num(this._data.length)} kontingen</small>`
        : ''
    }</h2>
          <input class="cari" type="search" placeholder="Cari kontingen, PIC, kode…"
                 value="${esc(this._cari)}" aria-label="Cari" />
        </header>

        ${this._pitaKunci(meta)}

        ${this._pesanAksi ? `<p class="nota sukses">${esc(this._pesanAksi)}</p>` : ''}

        <p class="nota">
          Satu kode berlaku untuk <b>seluruh tim satu kontingen</b>, lintas cabor.
          Kirimkan hanya ke PIC kontingen yang bersangkutan.
        </p>

        <div class="isi">
          ${this._isi(baris)}
        </div>
      </section>`;
  }

  /**
   * Kendali kunci roster. Ditempatkan di halaman ini, bukan di header, karena
   * di sinilah kodenya dilihat — dan kunci inilah yang membuat kode-kode itu
   * berhenti berlaku. Menaruhnya berjauhan akan menyembunyikan hubungan itu.
   */
  _pitaKunci(meta) {
    if (this._konfirmasiReset) return this._pitaReset();
    if (this._konfirmasiSemua) return this._pitaSemua();

    const game = store.state.filters.game;
    const info = store.state.meta?.terkunci?.[game];
    const terkunci = Boolean(info);

    // Mengunci menghentikan seluruh unggahan peserta sekaligus, jadi butuh
    // konfirmasi — tapi bukan dialog bawaan browser yang memutus alur.
    if (this._konfirmasi) {
      return `
        <div class="pita-kunci konfirmasi">
          <span class="pita-teks">
            <b>${terkunci ? 'Buka kunci' : 'Kunci'} roster ${esc(meta.label)}?</b>
            ${
              terkunci
                ? 'PIC bisa kembali mengunggah berkas dengan Kode Tim.'
                : `Seluruh ${num(this._data?.length || 0)} kode berhenti berlaku. Admin tetap bisa mengunggah.`
            }
          </span>
          <button type="button" data-act="batal-kunci">Batal</button>
          <button type="button" class="utama" data-act="ya-kunci" ${this._sibuk ? 'disabled' : ''}>
            ${this._sibuk ? 'Menyimpan…' : terkunci ? 'Ya, buka' : 'Ya, kunci'}
          </button>
        </div>`;
    }

    return `
      <div class="pita-kunci ${terkunci ? 'terkunci' : ''}">
        ${terkunci ? IKON_GEMBOK : IKON_GEMBOK_TERBUKA}
        <span class="pita-teks">
          <b>${terkunci ? `Roster ${esc(meta.label)} terkunci` : `Roster ${esc(meta.label)} terbuka`}</b>
          ${
            terkunci
              ? `Kode Tim tidak berlaku lagi${info.oleh ? ` · dikunci oleh ${esc(info.oleh)}` : ''}.`
              : 'PIC masih bisa mengunggah berkas dengan Kode Tim.'
          }
        </span>
        <button type="button" data-act="minta-kunci">${terkunci ? 'Buka kunci' : 'Kunci roster'}</button>
        ${
          /* Membuat sekaligus berdiri di sini, bukan di dalam tabel: yang
             dilakukannya adalah menerbitkan satu gelombang kode untuk SELURUH
             kontingen, dan tabel di bawahnya justru hasilnya. Tombolnya tetap
             ada saat daftar kosong — di situlah ia paling dibutuhkan. */
          this._pitaSibukSemua
            ? '<button type="button" disabled>Membuat…</button>'
            : `<button type="button" data-act="minta-semua">
                 Buat kode semua kontingen
               </button>`
        }
        ${
          /* Reset berdiri di samping kunci karena keduanya menutup akses
             peserta — bedanya, mengunci menghentikan SEMENTARA seluruh cabor
             ini, sedangkan reset membatalkan kode yang sudah terlanjur
             dibagikan (seluruh cabor) tanpa menutup apa pun. */
          this._data?.length
            ? `<button type="button" class="bahaya" data-act="minta-reset">
                 Reset kode
               </button>`
            : ''
        }
      </div>`;
  }

  /**
   * Berapa kontingen yang ada di data peserta — termasuk yang belum punya kode.
   *
   * Dihitung dari store, bukan dari daftar kode: daftar kode hanya memuat yang
   * SUDAH punya, sedangkan yang perlu diketahui sebelum menekan "buat semua"
   * justru berapa banyak yang akan menerima. Dibakukan lebih dulu supaya beda
   * penulisan antarbaris tidak menggelembungkan angkanya.
   */
  _jumlahKontingen() {
    const set = new Set();
    (store.state.teams || []).forEach((t) => {
      const k = normalKontingen(t.kontingen);
      if (k) set.add(k);
    });
    return set.size;
  }

  /**
   * Konfirmasi pembuatan kode untuk seluruh kontingen — sekaligus tempat
   * memilih wewenangnya.
   *
   * Dua keputusan digabung dalam satu pita karena keduanya satu tarikan napas:
   * memisahkannya jadi "yakin?" lalu "jenis apa?" menambah satu layar tanpa
   * menambah satu pun informasi baru. Yang perlu ditegaskan hanyalah bahwa kode
   * lama ikut tergantikan.
   */
  _pitaSemua() {
    const jumlah = this._jumlahKontingen();
    const adaLama = this._data?.length || 0;
    return `
      <div class="pita-kunci konfirmasi">
        <span class="pita-teks">
          <b>Buat kode baru untuk ${num(jumlah)} kontingen?</b>
          ${
            adaLama
              ? `${num(adaLama)} kode yang sekarang beredar ikut diganti dan langsung berhenti berlaku. `
              : ''
          }Semuanya berlaku ${UMUR_KODE} sejak dibuat. Wewenang <b>hapus tim</b> tidak
          dibagikan massal — buatkan per kontingen dari detail tim bila ada yang
          membatalkan tim. Pilih wewenangnya:
        </span>
        <button type="button" data-act="batal-semua">Batal</button>
        <button type="button" data-act="semua-unggah" ${this._sibuk ? 'disabled' : ''}>
          Unggah saja
        </button>
        <button type="button" class="utama" data-act="semua-penuh" ${this._sibuk ? 'disabled' : ''}>
          Ubah + unggah
        </button>
        ${
          /* "Ubah + hapus" TIDAK ditawarkan untuk pembuatan massal.
             Wewenang menghapus diberikan kepada kontingen yang memang sedang
             membatalkan tim — satu dua, bukan semuanya. Menyediakannya di sini
             berarti satu tekan tombol memasangkan tombol hapus yang tak bisa
             ditarik di dasar halaman setiap tim di seluruh turnamen. Yang
             membutuhkannya dibuatkan satu per satu dari detail tim atau menu ⋮. */
          ''
        }
      </div>`;
  }

  /** Terbitkan satu gelombang kode untuk seluruh kontingen. */
  async _buatSemua(jenis) {
    if (this._sibuk) return;
    this._sibuk = true;
    this._pitaSibukSemua = true;
    this._konfirmasiSemua = false;
    this._pesanAksi = '';
    this.render();
    try {
      const hasil = await buatKodeSemua(jenis);
      this._galat = '';
      // Daftarnya dibaca ulang, bukan dirakit dari jawaban: hanya daftarKode
      // yang tahu cakupan tiap kontingen (berapa tim, cabor apa) dan kontaknya.
      await this._muat();
      this._pesanAksi = `${hasil.dibuat} kode dibuat untuk seluruh kontingen, berlaku ${UMUR_KODE}.`;
    } catch (error) {
      this._galat = error.message || 'Gagal membuat kode.';
    }
    this._sibuk = false;
    this._pitaSibukSemua = false;
    this.render();
  }

  /** Konfirmasi reset seluruh kode aktif. */
  _pitaReset() {
    const jumlah = this._data?.length || 0;
    return `
      <div class="pita-kunci konfirmasi">
        <span class="pita-teks">
          <b>Batalkan ${num(jumlah)} kode kontingen yang aktif?</b>
          Berlaku untuk SELURUH cabor, bukan hanya yang sedang dibuka. PIC yang
          sedang memakainya langsung terputus, dan kode baru harus dibagikan ulang.
        </span>
        <button type="button" data-act="batal-reset">Batal</button>
        <button type="button" class="utama" data-act="ya-reset" ${this._sibuk ? 'disabled' : ''}>
          ${this._sibuk ? 'Mereset…' : 'Ya, reset'}
        </button>
      </div>`;
  }

  async _terapkanReset() {
    this._sibuk = true;
    this.render();
    try {
      const dihapus = await resetKodeTim();
      this._galat = '';
      // Daftarnya memang jadi kosong — itu seluruh isi halaman ini.
      this._data = [];
      this._pesanAksi = '';
      this._pesanReset = `${dihapus} kode dibatalkan.`;
    } catch (error) {
      this._galat = error.message || 'Gagal mereset Kode Tim.';
    }
    this._sibuk = false;
    this._konfirmasiReset = false;
    this.render();
  }

  _isi(baris) {
    if (this._galat) return `<div class="status">${esc(this._galat)}</div>`;
    if (!this._data) return '<div class="status">Mengambil kode tim…</div>';
    if (!this._data.length) {
      return `<div class="status">
                ${this._pesanReset ? `${esc(this._pesanReset)} ` : ''}Belum ada kode yang aktif.
                Kode dibuat dari halaman detail tim, menu ⋮ di daftar tim, atau tombol
                “Buat kode semua kontingen” di atas — dan berlaku ${UMUR_KODE}.
              </div>`;
    }
    if (!baris.length) {
      return `<div class="status">Tidak ada kontingen yang cocok dengan “${esc(this._cari)}”.</div>`;
    }

    return `
      <table>
        <thead>
          <tr>
            <th class="idx">#</th>
            <th>Kontingen</th>
            <th>PIC</th>
            <th>No HP</th>
            <th>Cakupan</th>
            <th>Kode</th>
            <th>Berlaku</th>
            <th><span class="sr-only">Salin</span></th>
          </tr>
        </thead>
        <tbody>
          ${baris
            .map(
              (b, i) => `
            <tr>
              <td class="idx">${num(i + 1)}</td>
              <td data-label="Kontingen"><span class="kontingen">${esc(b.kontingen || '—')}</span></td>
              <td data-label="PIC" class="pic">
                ${esc(b.pic || '—')}
                <small>PIC kontingen</small>
              </td>
              <td data-label="No HP"><span class="hp">${esc(b.hp || '—')}</span></td>
              <td data-label="Cakupan" class="pic">
                ${/* Berapa tim yang ikut terbuka oleh kode ini — angka inilah yang
                     membedakan kode yang ringan akibatnya dari yang berat. */ ''}
                <span class="tim">${num(b.tim || 0)} tim</span>
                <small>${esc((b.cabor || []).join(' · ') || '—')}</small>
              </td>
              <td data-label="Kode" class="pic">
                <span class="kode">${esc(b.kode || '—')}</span>
                <small class="${b.jenis === JENIS_KODE.HAPUS ? 'jenis-bahaya' : ''}">
                  ${esc(namaJenis(b.jenis))}
                </small>
              </td>
              <td data-label="Berlaku">
                ${
                  /* Sisa waktu dulu, jam berakhirnya kemudian: yang menentukan
                     apakah kode ini masih pantas dibagikan adalah "berapa lama
                     lagi", bukan "pukul berapa". */
                  b.sampai
                    ? `<span class="berlaku">
                         <span class="sisa ${sisaWaktu(b.sampai) ? '' : 'habis'}">
                           ${esc(sisaWaktu(b.sampai) || 'habis')}
                         </span>
                         <small class="sampai">${esc(jamMenit(b.sampai))}</small>
                       </span>`
                    : '—'
                }
              </td>
              <td class="aksi">
                <button class="salin ${this._tersalin === b.kontingen ? 'selesai' : ''}" type="button"
                        data-salin="${esc(b.kode || '')}" data-kontingen="${esc(b.kontingen || '')}"
                        title="Salin kode ${esc(b.kontingen || '')}"
                        aria-label="Salin kode kontingen ${esc(b.kontingen || '')}">
                  ${this._tersalin === b.kontingen ? IKON_CEKLIS : IKON_SALIN}
                </button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  _tersaring() {
    if (!this._data) return [];
    const q = normalize(this._cari.trim());
    if (!q) return this._data;
    return this._data.filter((b) =>
      normalize([b.kontingen, b.pic, b.kode, b.hp, (b.cabor || []).join(' ')].join(' ')).includes(q)
    );
  }

  onMount() {
    this.track(store.subscribe(() => this.requestRender(), true));

    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('[data-act="kembali"]')) {
        setShowCodes(false);
        return;
      }
      if (event.target.closest('[data-act="minta-reset"]')) {
        this._konfirmasiReset = true;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="batal-reset"]')) {
        this._konfirmasiReset = false;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="ya-reset"]')) {
        this._terapkanReset();
        return;
      }

      if (event.target.closest('[data-act="minta-semua"]')) {
        this._konfirmasiSemua = true;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="batal-semua"]')) {
        this._konfirmasiSemua = false;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="semua-penuh"]')) {
        this._buatSemua(JENIS_KODE.PENUH);
        return;
      }
      if (event.target.closest('[data-act="semua-unggah"]')) {
        this._buatSemua(JENIS_KODE.UNGGAH);
        return;
      }

      if (event.target.closest('[data-act="minta-kunci"]')) {
        this._konfirmasi = true;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="batal-kunci"]')) {
        this._konfirmasi = false;
        this.render();
        return;
      }
      if (event.target.closest('[data-act="ya-kunci"]')) {
        this._terapkanKunci();
        return;
      }

      const salin = event.target.closest('[data-salin]');
      if (salin) this._salin(salin.dataset.salin, salin.dataset.kontingen);
    });

    this.listen(this.shadowRoot, 'input', (event) => {
      if (!event.target.classList.contains('cari')) return;
      this._cari = event.target.value;
      // Render ulang mengganti seluruh isi, termasuk kotak cari — fokus dan
      // posisi kursor dikembalikan supaya mengetik tidak terputus.
      const posisi = event.target.selectionStart;
      this.render();
      const kotak = this.$('.cari');
      kotak?.focus();
      kotak?.setSelectionRange(posisi, posisi);
    });

    this._muat();
  }

  async _muat() {
    try {
      this._data = await ambilKodeTim();
      this._galat = '';
    } catch (error) {
      this._galat = error.message || 'Gagal mengambil kode tim.';
    }
    this.requestRender();
  }

  async _terapkanKunci() {
    const game = store.state.filters.game;
    const jadiTerkunci = !caborTerkunci();
    this._sibuk = true;
    this.render();
    try {
      setTerkunci(await aturKunciRoster(game, jadiTerkunci));
      this._galat = '';
    } catch (error) {
      this._galat = error.message || 'Gagal mengubah kunci.';
    }
    this._sibuk = false;
    this._konfirmasi = false;
    this.render();
  }

  async _salin(kode, kontingen) {
    if (!kode) return;
    try {
      await navigator.clipboard.writeText(kode);
      this._tersalin = kontingen;
      this.render();
      clearTimeout(this._timerSalin);
      this._timerSalin = setTimeout(() => {
        this._tersalin = '';
        this.requestRender();
      }, 1600);
    } catch (error) {
      // Clipboard bisa ditolak (izin, konteks tidak aman). Diamkan — kodenya
      // tetap terlihat dan bisa disalin manual.
    }
  }
}

define('code-list', CodeList);
