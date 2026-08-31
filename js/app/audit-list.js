/**
 * <audit-list> — layar notifikasi pelanggaran aturan. HANYA admin.
 *
 * Disusun SATU BARIS PER KONTINGEN, bukan satu baris per temuan.
 *
 * Versi pertama menampilkan seluruh temuan berderet dalam lima bagian panjang.
 * Pada data sungguhan itu berarti 98 blok, sebagian besar berisi daftar nama
 * pemain — benar, tapi tidak bisa dibaca. Sekarang temuan dikelompokkan ke
 * kontingennya: sekitar dua puluh baris yang bisa dipindai sekali lihat, dan
 * rinciannya baru terbuka saat satu baris ditekan.
 *
 * Bentuk ini juga cocok dengan cara panitia menindaklanjutinya: menghubungi
 * satu PIC kontingen sekaligus untuk seluruh masalah kontingennya, bukan
 * menyisir temuan satu per satu.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, num } from '../core/format.js';
import { selectTeam, setShowAudit, store } from '../data/app-state.js';
import { ambilKontak } from '../data/auth.js';
import { JENIS, JUDUL, KETERANGAN, periksaSemua } from '../data/audit.js';
import { GAME_META } from '../data/source.js';

/* Label pendek untuk lencana di baris kontingen. Judul panjangnya dipakai di
   rincian, tempat ruangnya ada. */
const SINGKAT = {
  [JENIS.MANAGER]: 'PIC ganda',
  [JENIS.JUMLAH]: 'Tim berlebih',
  [JENIS.KEMBAR]: 'Nama kembar',
  [JENIS.TAD]: 'TAD',
  [JENIS.NICK]: 'Nick',
  [JENIS.RANGKAP]: 'Rangkap PIC',
  [JENIS.LOGO]: 'Logo',
  [JENIS.IDCARD]: 'ID card',
};

/** Urutan mengikuti sebab-akibat: PIC ganda biasanya sumber dua yang berikutnya. */
const URUTAN = [
  JENIS.MANAGER,
  JENIS.JUMLAH,
  JENIS.KEMBAR,
  JENIS.TAD,
  JENIS.NICK,
  JENIS.RANGKAP,
  JENIS.LOGO,
  JENIS.IDCARD,
];

const styles = css`
  :host {
    display: block;
    --tepi: max(var(--sp-6), calc((100% - var(--maxw)) / 2));
  }
  header {
    position: sticky;
    top: var(--header-h);
    z-index: 5;
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
    height: 36px;
    padding: 0 var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
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
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 800;
  }
  .tumbuh {
    flex: 1;
  }
  .total {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .total b {
    color: var(--peringatan);
  }

  .isi {
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-4) var(--tepi) var(--sp-7);
  }

  /* --- satu baris per kontingen --- */
  .baris {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    padding: var(--sp-3) var(--sp-4);
    text-align: left;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    transition: border-color var(--dur) var(--ease);
  }
  .baris:hover {
    border-color: var(--border-strong);
  }
  .baris[aria-expanded='true'] {
    border-color: var(--peringatan);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .cabor {
    padding: 3px 9px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--tone, var(--accent));
    background: color-mix(in srgb, var(--tone, var(--accent)) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--tone, var(--accent)) 36%, transparent);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .nama-kont {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .nama-kont b {
    font-size: var(--fs-md);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .tanda {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tanda span {
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: var(--peringatan);
    background: color-mix(in srgb, var(--peringatan) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--peringatan) 32%, transparent);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .panah {
    width: 14px;
    height: 14px;
    color: var(--text-faint);
    transition: transform var(--dur) var(--ease);
  }
  .baris[aria-expanded='true'] .panah {
    transform: rotate(180deg);
  }

  /* --- rincian, hanya saat dibuka --- */
  .rinci {
    display: grid;
    gap: var(--sp-3);
    margin-top: -1px;
    padding: var(--sp-4);
    background: var(--surface-2);
    border: 1px solid var(--peringatan);
    border-top: 0;
    border-radius: 0 0 var(--r-md) var(--r-md);
  }
  .item {
    display: grid;
    gap: 4px;
  }
  .item h4 {
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: 800;
    color: var(--peringatan);
  }
  .item p {
    margin: 0;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text-muted);
  }
  .item .daftar {
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .tim {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 2px;
  }
  .tim button {
    padding: 5px 11px;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--accent);
    background: none;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: var(--r-pill);
  }
  .tim button:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  /* Kontak dipisahkan garis: ia bukan temuan, melainkan jalan keluarnya. */
  .item.kontak {
    gap: 6px;
    padding-top: var(--sp-3);
    border-top: 1px solid var(--border);
  }
  .orang {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-2) var(--sp-3);
    font-size: var(--fs-sm);
  }
  .orang-nama {
    font-weight: 700;
  }
  /* Peran didorong ke kanan, bukan nomornya: peran hanya keterangan, sedangkan
     nama dan nomor adalah satu pasangan yang dibaca bersamaan. */
  .orang-peran {
    margin-left: auto;
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .hp {
    padding: 3px 11px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: #45c47a;
    text-decoration: none;
    background: rgba(69, 196, 122, 0.12);
    border: 1px solid rgba(69, 196, 122, 0.34);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .hp:hover {
    background: rgba(69, 196, 122, 0.2);
  }
  .hp.selesai {
    color: var(--accent-contrast, #08121f);
    background: #45c47a;
    border-color: #45c47a;
  }
  .hp.mati {
    color: var(--text-faint);
    background: none;
    border-color: var(--border);
  }

  .bersih {
    display: grid;
    place-items: center;
    gap: var(--sp-2);
    padding: var(--sp-7) var(--sp-4);
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .bersih b {
    font-size: var(--fs-lg);
    color: #45c47a;
  }
  .bersih p {
    margin: 0;
    max-width: 46ch;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  @media (max-width: 900px) {
    :host {
      --tepi: var(--sp-3);
    }
    header {
      padding: var(--sp-2) var(--sp-3);
    }
    .kembali span {
      display: none;
    }
    /* Cabor pindah ke atas nama supaya nama kontingen dapat lebar penuh. */
    .baris {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .cabor {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
`;

const IKON_KEMBALI = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const IKON_PANAH = `<svg class="panah" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

export class AuditList extends BaseElement {
  constructor() {
    super();
    // Kunci kontingen yang rinciannya sedang terbuka.
    this._buka = new Set();
    // teamId -> { picKontingen, picTim } dari GAS. Nomor telepon tidak pernah
    // ikut payload publik, jadi ia diminta terpisah lewat jalur ber-token.
    this._kontak = null;
    this._kontakMemuat = false;
    // Nomor yang baru saja disalin, untuk umpan balik sesaat di tombolnya.
    this._salin = '';
  }

  async _salinNomor(hp) {
    try {
      await navigator.clipboard.writeText(hp);
      this._salin = hp;
      this.render();
      clearTimeout(this._timerSalin);
      this._timerSalin = setTimeout(() => {
        this._salin = '';
        this.requestRender();
      }, 1600);
    } catch (error) {
      // Clipboard bisa ditolak (izin, konteks tidak aman). Nomornya tetap
      // terbaca di layar dan bisa disalin manual, jadi tidak ada yang perlu
      // dilaporkan.
    }
  }

  /**
   * Ambil kontak sekali saat layar dibuka.
   *
   * Gagal mengambilnya TIDAK menggagalkan layar ini: seluruh temuan tetap
   * terbaca, hanya barisan "hubungi" yang absen. Notifikasi yang hilang gara-
   * gara nomor telepon tidak bisa diambil akan jauh lebih merugikan.
   */
  async _muatKontak() {
    if (this._kontak || this._kontakMemuat) return;
    this._kontakMemuat = true;
    try {
      const daftar = await ambilKontak();
      this._kontak = new Map(daftar.map((k) => [k.teamId, k]));
    } catch (error) {
      this._kontak = new Map();
    }
    this._kontakMemuat = false;
    this.render();
  }

  static styles = [styles];

  /** Kelompokkan temuan ke kontingennya, terberat di atas. */
  _perKontingen() {
    // SELURUH tim, bukan hanya cabor yang sedang dipilih: pelanggaran di cabor
    // lain tidak boleh tersembunyi karena penyaring kebetulan menunjuk ke satu.
    const peta = new Map();
    for (const t of periksaSemua(store.state.teams)) {
      const kunci = `${t.game} ${t.kontingen}`;
      if (!peta.has(kunci)) {
        peta.set(kunci, { kunci, game: t.game, kontingen: t.kontingen, temuan: [] });
      }
      peta.get(kunci).temuan.push(t);
    }
    return [...peta.values()].sort(
      (a, b) => b.temuan.length - a.temuan.length || a.kontingen.localeCompare(b.kontingen, 'id')
    );
  }

  render() {
    this._muatKontak();
    const grup = this._perKontingen();
    const total = grup.reduce((n, g) => n + g.temuan.length, 0);

    this.shadowRoot.innerHTML = `
      <header>
        <button class="kembali" type="button" data-act="kembali">
          ${IKON_KEMBALI}<span>Kembali</span>
        </button>
        <h2>Notifikasi</h2>
        <span class="tumbuh"></span>
        ${
          total
            ? `<span class="total"><b>${num(total)} temuan</b> · ${num(grup.length)} kontingen</span>`
            : ''
        }
      </header>

      <div class="isi">
        ${
          grup.length
            ? grup.map((g) => this._baris(g)).join('')
            : `<div class="bersih">
                 <b>Tidak ada pelanggaran</b>
                 <p>Seluruh kontingen dan tim memenuhi aturan yang diperiksa halaman ini.</p>
               </div>`
        }
      </div>`;
  }

  _baris(g) {
    const meta = GAME_META[g.game];
    const terbuka = this._buka.has(g.kunci);

    // Lencana diringkas per jenis: "Nick ×3", bukan tiga baris terpisah.
    const perJenis = URUTAN.map((jenis) => ({
      jenis,
      daftar: g.temuan.filter((t) => t.jenis === jenis),
    })).filter((x) => x.daftar.length);

    return `
      <div>
        <button class="baris" type="button" data-buka="${esc(g.kunci)}"
                aria-expanded="${terbuka}">
          <span class="cabor" style="--tone:${meta?.color || 'var(--accent)'}">${esc(g.game)}</span>
          <span class="nama-kont">
            <b>${esc(g.kontingen)}</b>
            <span class="tanda">
              ${perJenis
                .map(
                  (x) =>
                    `<span>${esc(SINGKAT[x.jenis])}${x.daftar.length > 1 ? ` ×${x.daftar.length}` : ''}</span>`
                )
                .join('')}
            </span>
          </span>
          ${IKON_PANAH}
        </button>
        ${terbuka ? this._rinci(perJenis) : ''}
      </div>`;
  }

  /**
   * Barisan "hubungi": PIC kontingen sekali, lalu PIC tiap tim.
   *
   * PIC kontingen ditampilkan sekali di atas karena satu kontingen memang satu
   * orang — kecuali justru itulah temuannya, dan dalam kasus itu keduanya
   * memang perlu terlihat berdampingan.
   */
  _kontakBlok(temuan) {
    if (!this._kontak) return '';

    const timUnik = [...new Map(temuan.flatMap((t) => t.tim).map((t) => [t.team_id, t])).values()];
    const dataTim = timUnik.map((t) => this._kontak.get(t.team_id)).filter(Boolean);
    if (!dataTim.length) return '';

    // PIC kontingen: dikumpulkan unik menurut nama+nomor.
    const kont = new Map();
    for (const d of dataTim) {
      const p = d.picKontingen || {};
      if (p.nama || p.hp) kont.set(`${p.nama}|${p.hp}`, p);
    }

    return `
      <div class="item kontak">
        <h4>Hubungi</h4>
        ${[...kont.values()].map((p) => this._orang(p.nama, p.hp, 'PIC kontingen')).join('')}
        ${dataTim
          .map((d) =>
            (d.picTim || [])
              .map((p) => this._orang(p.nama, p.hp, `${p.peran} · ${d.teamName}`))
              .join('')
          )
          .join('')}
      </div>`;
  }

  /**
   * Satu baris orang: nama, lalu nomornya, lalu perannya.
   *
   * Nomor diletakkan TEPAT DI SEBELAH nama, bukan dirapatkan ke tepi kanan.
   * Versi sebelumnya memakai margin-left:auto, dan pada baris yang namanya
   * pendek jaraknya jadi jauh — mata harus melompat menyeberangi ruang kosong
   * untuk memasangkan nama dengan nomornya.
   *
   * Ditekan untuk MENYALIN, bukan membuka WhatsApp: panitia menghubungi lewat
   * aplikasi yang mereka pilih sendiri, dan menyalin selalu berhasil sementara
   * tautan wa.me bergantung pada bentuk nomor yang ditebak benar.
   */
  _orang(nama, hp, peran) {
    if (!nama && !hp) return '';
    const tersalin = hp && this._salin === hp;
    return `
      <div class="orang">
        <span class="orang-nama">${esc(nama || '—')}</span>
        ${
          hp
            ? `<button class="hp ${tersalin ? 'selesai' : ''}" type="button" data-hp="${esc(hp)}"
                       title="Salin nomor">${tersalin ? 'Tersalin' : esc(hp)}</button>`
            : '<span class="hp mati">tanpa nomor</span>'
        }
        <span class="orang-peran">${esc(peran)}</span>
      </div>`;
  }

  _rinci(perJenis) {
    return `
      <div class="rinci">
        ${perJenis
          .map(
            (x) => `
          <div class="item">
            <h4>${esc(JUDUL[x.jenis])}</h4>
            <p>${esc(KETERANGAN[x.jenis])}</p>
            ${x.daftar
              .map(
                (t) => `
              <div class="daftar">
                ${esc(t.ringkas)}${t.rinci?.length ? ` — ${esc(t.rinci.join(', '))}` : ''}
              </div>`
              )
              .join('')}
            <div class="tim">
              ${[...new Map(x.daftar.flatMap((t) => t.tim).map((t) => [t.team_id, t])).values()]
                .map(
                  (tim) =>
                    `<button type="button" data-tim="${esc(tim.team_id)}">${esc(tim.team_name)}</button>`
                )
                .join('')}
            </div>
          </div>`
          )
          .join('')}
        ${this._kontakBlok(perJenis.flatMap((x) => x.daftar))}
      </div>`;
  }

  onMount() {
    this.track(store.subscribe(() => this.requestRender()));

    this.listen(this.shadowRoot, 'click', (event) => {
      if (event.target.closest('[data-act="kembali"]')) {
        setShowAudit(false);
        return;
      }

      const hp = event.target.closest('[data-hp]');
      if (hp) {
        this._salinNomor(hp.dataset.hp);
        return;
      }

      const tim = event.target.closest('[data-tim]');
      // Diperiksa sebelum baris kontingen: tombol tim berada DI DALAM rincian,
      // dan tanpa urutan ini kliknya akan ikut menutup rinciannya.
      if (tim) {
        selectTeam(tim.dataset.tim);
        return;
      }

      const baris = event.target.closest('[data-buka]');
      if (baris) {
        const k = baris.dataset.buka;
        if (this._buka.has(k)) this._buka.delete(k);
        else this._buka.add(k);
        this.render();
      }
    });
  }
}

define('audit-list', AuditList);
