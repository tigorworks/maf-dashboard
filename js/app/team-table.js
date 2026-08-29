/**
 * <team-table> — daftar TIM. Satu baris = satu tim; klik baris membuka panel
 * detail (PIC/Manager lalu roster). Kalau kata kunci pencarian mengenai nama
 * pemain, baris menunjukkan anggota mana yang cocok supaya jelas kenapa tim itu
 * muncul.
 * Di layar sempit tiap baris berubah menjadi kartu.
 */
import { BaseElement, define } from '../core/element.js';
import { css } from '../core/css.js';
import { esc, formatDate, highlight, hueOf, initials, jamMenit, num, sisaWaktu } from '../core/format.js';
import { buangTim, COLUMNS, matchedMembers, selectTeam, setSort, store } from '../data/app-state.js';
import { adalahAdmin, bolehUnggahTim, buatKodeTim, hapusTim, JENIS_KODE } from '../data/auth.js';
import { periksaTim } from '../data/rules.js';
import '../ui/ui-pagination.js';

const styles = css`
  :host {
    position: relative;
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
  }
  /* Watermark logo MAF DI DALAM panel tabel. Watermark di lapisan halaman nyaris
     tak terlihat karena konten menutupi hampir seluruh lebar layar; dilukis di
     permukaan panel begini ia benar-benar terbaca, sementara opasitasnya tetap
     cukup rendah untuk tidak mengganggu teks di atasnya. */
  :host::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: var(--logo-maf);
    background-repeat: no-repeat;
    background-position: right -70px center;
    background-size: auto min(470px, 60%);
    opacity: 0.055;
  }
  /* Isi panel harus berada di atas watermark. */
  .scroll,
  ui-pagination {
    position: relative;
    z-index: 1;
  }
  /* Area tabel discroll sendiri (bukan halaman) supaya thead sticky benar-benar
     menempel dan bar pagination tetap terlihat di bawah. */
  .scroll {
    max-height: clamp(380px, calc(100vh - 250px), 920px);
    overflow: auto;
    overscroll-behavior: contain;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--fs-sm);
  }
  th,
  td {
    padding: var(--sp-3);
    text-align: left;
    white-space: nowrap;
  }
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-faint);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    user-select: none;
  }
  thead th.sortable {
    cursor: pointer;
  }
  thead th.sortable:hover {
    color: var(--text);
  }
  thead th[aria-sort] {
    color: var(--accent);
  }
  .th-inner {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .arrow {
    width: 11px;
    height: 11px;
    opacity: 0;
    transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
  }
  th.sortable:hover .arrow {
    opacity: 0.4;
  }
  th[aria-sort] .arrow {
    opacity: 1;
  }
  th[aria-sort='descending'] .arrow {
    transform: rotate(180deg);
  }
  tbody tr {
    cursor: pointer;
    transition: background var(--dur) var(--ease);
  }
  tbody tr:nth-child(even) {
    background: var(--row-stripe);
  }
  tbody tr:hover {
    background: var(--row-hover);
  }
  tbody td {
    border-bottom: 1px solid var(--border);
  }
  .idx,
  .right {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .idx {
    color: var(--text-faint);
  }

  .team {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    max-width: 300px;
  }
  .crest {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    width: 34px;
    height: 34px;
    font-size: 12px;
    font-weight: 800;
    color: hsl(var(--hue) 85% 92%);
    background: linear-gradient(140deg, hsl(var(--hue) 70% 42%), hsl(var(--hue) 75% 28%));
    border-radius: var(--r-sm);
    overflow: hidden;
  }
  /* Logo yang sudah diunggah melapisi inisial, bukan menggantikannya di markup.
     Kalau Drive gagal memuat gambarnya, <img> membuang dirinya sendiri dan
     inisial di bawahnya langsung terlihat — bukan kotak kosong. */
  .crest img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--surface-inset);
  }
  .team-body {
    min-width: 0;
  }
  .team-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-md);
    font-weight: 700;
    min-width: 0;
  }
  /* Teks nama dibungkus sendiri: highlight pencarian menyisipkan <mark> di
     tengah kalimat, dan di flex container tiap potongan teks akan menjadi item
     terpisah — namanya jadi merenggang di sekitar kata yang cocok. */
  .nama-teks {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hit {
    font-size: var(--fs-xs);
    color: var(--gold);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* --- Penanda tim yang belum memenuhi syarat ---
     Dua lapis, dan itu disengaja: pita di tepi kiri terbaca saat memindai
     seluruh tabel dengan cepat, sedangkan lencananya menjawab "kurang apa"
     tanpa perlu membuka timnya. Warna saja tidak cukup — ikon segitiga
     memastikan penandanya tetap terbaca oleh mata yang sulit membedakan warna. */
  tbody tr.belum td:first-child {
    box-shadow: inset 3px 0 0 var(--peringatan);
  }
  tbody tr.belum {
    background: color-mix(in srgb, var(--peringatan) 5%, transparent);
  }
  tbody tr.belum:hover {
    background: color-mix(in srgb, var(--peringatan) 9%, var(--row-hover));
  }
  .tanda-belum {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 15px;
    height: 15px;
    color: var(--peringatan);
  }
  .tanda-belum svg {
    width: 15px;
    height: 15px;
  }
  .masalah {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }
  .lencana {
    padding: 1px 7px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--peringatan);
    background: color-mix(in srgb, var(--peringatan) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--peringatan) 34%, transparent);
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .truncate {
    display: block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Chip penanda kolom Kontingen: tanpa ini ia terbaca sama persis dengan
     kolom Unit Kerja di sebelahnya. Oranye dipilih karena sejak kolom cabor
     dihapus, ia satu-satunya warna palet yang belum terpakai di tabel — emas
     sudah jadi warna aksi (sort, tautan, highlight). */
  .chip {
    display: inline-block;
    max-width: 250px;
    padding: 3px 11px;
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.015em;
    color: var(--game-pubg);
    background: color-mix(in srgb, var(--game-pubg) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--game-pubg) 34%, transparent);
    border-radius: var(--r-pill);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }
  .pic {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-width: 220px;
  }
  .pic .nip {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .count {
    display: inline-block;
    min-width: 30px;
    padding: 3px 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--surface-inset);
    border-radius: var(--r-pill);
  }
  mark {
    padding: 0 1px;
    color: inherit;
    background: var(--gold-soft);
    border-radius: 3px;
  }
  /* --- Menu aksi per baris (titik tiga) --- */
  td.aksi {
    width: 56px;
    padding-left: 0;
    text-align: right;
  }
  .burger {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--text-faint);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    transition: color var(--dur) var(--ease), background var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .burger svg {
    width: 16px;
    height: 16px;
  }
  .burger:hover,
  .burger[aria-expanded='true'] {
    color: var(--text);
    background: var(--surface-inset);
    border-color: var(--border);
  }

  /* position:fixed, bukan absolute: .scroll adalah kontainer overflow, jadi menu
     yang diposisikan relatif terhadapnya akan terpotong di baris terakhir. */
  .menu {
    position: fixed;
    z-index: 40;
    min-width: 190px;
    /* Menunya tumbuh seiring peran: admin kini melihat lima butir. Di ponsel
       lanskap — atau layar pendek mana pun — daftar itu bisa lebih tinggi
       daripada ruang yang tersisa, dan penempatannya hanya bisa membalik ke
       atas, tidak bisa memendekkan diri. Batas ini yang membuat butir terakhir
       tetap terjangkau. */
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--sp-1);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--r-sm);
    box-shadow: var(--shadow-md);
  }
  .menu[hidden] {
    display: none;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    padding: 9px var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-align: left;
    color: var(--text);
    background: transparent;
    border: 0;
    border-radius: 6px;
    white-space: nowrap;
  }
  .menu button svg {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--text-faint);
  }
  .menu button:hover,
  .menu button:focus-visible {
    background: var(--row-hover);
  }
  .menu button:hover svg,
  .menu button:focus-visible svg {
    color: var(--gold);
  }

  .empty {
    display: grid;
    place-items: center;
    gap: var(--sp-3);
    padding: var(--sp-7) var(--sp-4);
    text-align: center;
  }
  .empty h3 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .empty p {
    margin: 0;
    max-width: 42ch;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .empty svg {
    width: 40px;
    height: 40px;
    color: var(--text-faint);
  }

  .menu button.bahaya {
    color: var(--peringatan);
    border-top: 1px solid var(--border);
  }

  /* --- Lapisan dialog (hapus tim & kode tim) ---
     Lapisan penuh, bukan baris di dalam menu: menu ⋮ ditutup begitu jari
     terangkat, sedangkan keduanya perlu dibaca dulu — yang satu menghapus
     rosters beserta berkasnya, yang satu menampilkan kredensial untuk dicatat. */
  .lapis {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: var(--sp-4);
    background: rgba(4, 8, 20, 0.72);
    backdrop-filter: blur(3px);
  }
  .kotak {
    width: min(440px, 100%);
    padding: var(--sp-5);
    background: var(--surface);
    border: 1px solid var(--border-strong, var(--border));
    border-radius: var(--r-md);
  }
  .kotak.bahaya {
    border-color: var(--peringatan);
  }
  .kotak h3 {
    color: var(--text);
  }
  .kotak.bahaya h3 {
    color: var(--peringatan);
  }
  .kotak h3 {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-lg);
  }
  .kotak p {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text-muted);
  }
  .kotak b {
    color: var(--text);
  }
  .lapis-aksi {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
  }
  .lapis-aksi button {
    height: 40px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .lapis-aksi button.bahaya {
    color: #fff;
    background: var(--peringatan);
    border-color: var(--peringatan);
  }
  .lapis-aksi button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* Dua pilihan wewenang: masing-masing menyebut akibatnya, bukan hanya
     namanya. Kode yang salah jenis baru ketahuan setelah dibagikan. */
  .pilih-jenis {
    display: grid;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .pilih-jenis button {
    display: grid;
    gap: 2px;
    padding: var(--sp-3);
    text-align: left;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: border-color var(--dur) var(--ease);
  }
  .pilih-jenis button:hover {
    border-color: var(--accent);
  }
  .pilih-jenis b {
    font-size: var(--fs-sm);
  }
  .pilih-jenis small {
    font-size: var(--fs-xs);
    font-weight: 500;
    line-height: 1.4;
    color: var(--text-muted);
  }

  /* Kode dicetak besar, monospasi, dan BERWARNA LAIN dari seluruh isi dialog:
     ia satu-satunya bagian yang perlu disalin atau dibacakan, sedangkan sisanya
     hanya penjelasan. Oranye dipilih karena emas sudah menjadi warna aksi di
     mana-mana (tombol, tautan, sorotan pencarian) — kode yang ikut memakainya
     akan terbaca seperti tombol lain.
     Pemilihnya ditulis dengan tipe (p.kode-besar), bukan kelas saja: aturan
     "kotak p" di atas punya kekhususan lebih tinggi (kelas + tipe), jadi versi
     tanpa tipe kalah dan kodenya tampil kecil serta kelabu seperti paragraf
     biasa. */
  .kotak p.kode-besar {
    margin: 0 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 0.16em;
    line-height: 1.15;
    color: var(--brand-orange);
    overflow-wrap: anywhere;
  }
  .lapis-aksi button.utama {
    color: var(--accent-contrast, #08121f);
    background: var(--accent);
    border-color: var(--accent);
  }
  /* Aturan "kotak p" di atas juga mengenai paragraf ini dan kekhususannya lebih
     tinggi, jadi tanpa tipe di sini pesan galatnya ikut kelabu — persis warna
     teks penjelasan biasa, padahal ia satu-satunya kalimat yang menuntut
     tindakan. */
  .kotak p.lapis-galat {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--peringatan);
  }

  /* Di mode kartu TIDAK ada pemilih urutan.
     Dulu ada toolbar "Urutkan" berisi dropdown + tombol arah, karena header
     tabel disembunyikan di layar sempit. Toolbar itu dibuang: panelnya tembus
     pandang di atas kartu dan sentuhan sering tembus ke baris di belakangnya,
     sehingga memilih urutan malah membuka detail tim. Di ponsel orang mencari
     satu tim lewat kotak pencarian, bukan mengurutkan 98 baris — jadi urutan
     bawaan sudah memadai dan pengurutan tetap utuh di layar lebar. */

  /* --- Mode kartu untuk layar sempit --- */
  @media (max-width: 900px) {
    .scroll {
      max-height: none;
      overflow: visible;
    }
    thead {
      display: none;
    }
    table,
    tbody,
    td {
      display: block;
      width: 100%;
    }
    /* Kartu: nama tim jadi judul, sisanya pasangan label/nilai. */
    tbody tr {
      position: relative;
      display: block;
      padding: var(--sp-3);
      margin: var(--sp-3) var(--sp-3) 0;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
    }
    tbody tr:last-child {
      margin-bottom: var(--sp-3);
    }
    tbody tr:nth-child(even) {
      background: var(--surface-2);
    }
    tbody td {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
      min-width: 0;
      padding: 2px 0;
      white-space: normal;
      overflow-wrap: anywhere;
      border: 0;
    }
    tbody td::before {
      content: attr(data-label);
      flex: none;
      font-size: var(--fs-xs);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-faint);
    }
    tbody td[data-label='Tim'] {
      display: block;
      padding-bottom: var(--sp-2);
    }
    tbody td[data-label='Tim']::before,
    tbody td[data-label='#'] {
      display: none;
    }
    .team,
    .truncate,
    .pic {
      min-width: 0;
      max-width: none;
      overflow: visible;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .chip {
      max-width: none;
      white-space: normal;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .pic,
    td:not([data-label='Tim']) .truncate {
      text-align: right;
    }
    .pic {
      align-items: flex-end;
    }
    /* Di mode kartu, tombol menu dipatok ke pojok kanan atas kartu; kalau
       dibiarkan mengalir ia jadi baris label/nilai sendiri di paling bawah. */
    tbody td.aksi {
      position: absolute;
      top: var(--sp-2);
      right: var(--sp-2);
      width: auto;
      padding: 0;
    }
    tbody td.aksi::before {
      display: none;
    }
    /* Beri ruang supaya nama tim tidak menyelip di bawah tombol. */
    tbody td[data-label='Tim'] {
      padding-right: 40px;
    }
  }

  @media (max-width: 420px) {
    tbody tr {
      margin-inline: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
    }
  }
`;

const IKON_KUNCI = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M9.4 6.6a2.9 2.9 0 1 0-2.8 2.9L5.2 10.9v1.6h1.6l1.4-1.4 1.2-1.2Z"
        stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
  <circle cx="10.6" cy="5.4" r="1" fill="currentColor" />
</svg>`;

const IKON_PERINGATAN = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M8 2.4 14.6 13.6H1.4L8 2.4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
  <path d="M8 6.4v3.1M8 11.6h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>`;

export class TeamTable extends BaseElement {
  static styles = [styles];

  constructor() {
    super();
    this._view = null;
    this._menuTeam = null;
    // { teamId, nama, sibuk, galat } saat konfirmasi hapus terbuka.
    this._hapus = null;
  }

  /** Hasil derive() dari app-state. */
  set view(view) {
    this._view = view;
    this.requestRender();
  }

  render() {
    const view = this._view;
    if (!view) return;
    const { sort, filters } = store.state;

    this.shadowRoot.innerHTML = `
      <div class="scroll">
        <table>
          <thead>
            <tr>
              ${COLUMNS.map((column) => {
                const active = sort.key === column.key;
                const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : null;
                return `
                <th scope="col" style="width:${column.width}"
                    class="${column.sortable ? 'sortable' : ''} ${column.align === 'right' ? 'right' : ''}"
                    ${column.sortable ? `data-sort="${column.key}" tabindex="0"` : ''}
                    ${ariaSort ? `aria-sort="${ariaSort}"` : ''}>
                  <span class="th-inner">${esc(column.label)}${
                  column.sortable
                    ? `<svg class="arrow" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                         <path d="M6 9V3m0 0L3.4 5.6M6 3l2.6 2.6" stroke="currentColor" stroke-width="1.6"
                               stroke-linecap="round" stroke-linejoin="round"/>
                       </svg>`
                    : ''
                }</span>
                </th>`;
              }).join('')}
              <th scope="col" style="width:56px"><span class="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            ${view.rows.map((team, i) => this._row(team, view.offset + i + 1, filters.q)).join('')}
          </tbody>
        </table>
        ${view.rows.length ? '' : emptyState(filters)}
      </div>
      <ui-pagination page="${view.page}" page-count="${view.pageCount}" total="${view.filtered.length}"
                     shown="${view.rows.length}" offset="${view.offset}"
                     unit="tim"></ui-pagination>

      <div class="menu" role="menu" hidden></div>
      ${this._kotakHapus()}
      ${this._kotakKode()}`;

    // render() mengganti seluruh innerHTML, jadi menu yang sedang terbuka ikut
    // terbuang — status internalnya harus ikut disetel ulang.
    this._menuTeam = null;
  }

  _row(team, index, query) {
    const masalah = periksaTim(team);
    const hits = matchedMembers(team, query);
    const hitLabel = hits.length
      ? `<span class="hit">↳ ${hits
          .slice(0, 2)
          .map((m) => highlight(m.full_name, query))
          .join(', ')}${hits.length > 2 ? ` +${hits.length - 2} lainnya` : ''}</span>`
      : '';

    return `
      <tr data-team="${esc(team.team_id)}" tabindex="0" ${masalah.length ? 'class="belum"' : ''}>
        <td class="idx" data-label="#">${num(index)}</td>
        <td data-label="Tim">
          <span class="team">
            <span class="crest" style="--hue:${hueOf(team.team_name)}" aria-hidden="true">${esc(
      initials(team.team_name)
    )}${
      team.logo_url
        ? `<img src="${esc(team.logo_url)}" alt="" loading="lazy" referrerpolicy="no-referrer"
                onerror="this.remove()" />`
        : ''
    }</span>
            <span class="team-body">
              <span class="team-name">
                ${
                  masalah.length
                    ? `<span class="tanda-belum" role="img"
                             aria-label="Belum memenuhi syarat: ${esc(masalah.map((m) => m.pesan).join('; '))}"
                             title="${esc(masalah.map((m) => m.pesan).join('\n'))}">${IKON_PERINGATAN}</span>`
                    : ''
                }<span class="nama-teks">${highlight(team.team_name, query)}</span>
              </span>
              ${hitLabel}
              ${
                masalah.length
                  ? `<span class="masalah">${masalah
                      .map((m) => `<span class="lencana ${esc(m.kode)}" title="${esc(m.pesan)}">${esc(m.label)}</span>`)
                      .join('')}</span>`
                  : ''
              }
            </span>
          </span>
        </td>
        <td data-label="Kontingen">
          <span class="chip" title="${esc(team.kontingen || '')}">${highlight(team.kontingen || '—', query)}</span>
        </td>
        <td data-label="Unit Kerja">
          <span class="truncate" title="${esc(team.unit_kerja || '')}">${highlight(team.unit_kerja || '—', query)}</span>
        </td>
        <td data-label="PIC / Manager">
          <span class="pic">
            <span class="truncate" title="${esc(team.pic_name || '')}">${highlight(team.pic_name || '—', query)}</span>
            ${team.pic?.nip ? `<span class="nip">${esc(team.pic.nip)}</span>` : ''}
          </span>
        </td>
        <td class="right" data-label="Pemain"><span class="count">${num(team.member_count)}</span></td>
        <td data-label="Didaftarkan">${esc(formatDate(team.submission_date) || '—')}</td>
        <td class="aksi" data-label="Aksi">
          <button class="burger" type="button" data-menu="${esc(team.team_id)}"
                  aria-haspopup="menu" aria-expanded="false"
                  aria-label="Menu untuk ${esc(team.team_name)}">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        </td>
      </tr>`;
  }

  /**
   * Isi menu ⋮ untuk SATU tim.
   *
   * Dibangun saat menunya dibuka, bukan sekali untuk seluruh tabel: butirnya
   * kini bergantung pada tim yang ditunjuk. PIC tim yang sudah masuk hanya
   * berwenang atas timnya sendiri, jadi menu di baris tim lain tidak boleh
   * menawarkan unggahan yang pasti ditolak GAS.
   */
  _isiMenu(teamId) {
    // Unggah: admin untuk semua tim, PIC tim hanya untuk timnya. Pengunjung yang
    // belum masuk tidak melihatnya sama sekali — sejak kode tidak lagi
    // ditempelkan per unggahan, layar itu tidak punya jalan masuk untuknya.
    const bolehUnggah = bolehUnggahTim(teamId);

    return `
        <button type="button" role="menuitem" data-act="lihat">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"
                  stroke="currentColor" stroke-width="1.5" />
            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
          </svg>
          Lihat tim
        </button>
        ${
          bolehUnggah
            ? `<button type="button" role="menuitem" data-act="unggah">
                 <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M8 10.5V2m0 0L5 5m3-3 3 3M2.5 11v1.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V11"
                         stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                 </svg>
                 Unggah berkas
               </button>
               <button type="button" role="menuitem" data-act="foto">
                 <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M2 5.6a1.6 1.6 0 0 1 1.6-1.6h1.1l.8-1.3h4.6l.8 1.3h1.5A1.6 1.6 0 0 1 14 5.6v6.2a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 11.8V5.6Z"
                         stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                   <circle cx="8" cy="8.6" r="2.4" stroke="currentColor" stroke-width="1.4" />
                 </svg>
                 Unggah foto
               </button>`
            : ''
        }
        ${
          /* Satu butir; pilihan jenisnya muncul di dialog berikutnya. Menu ⋮
             sudah memuat lima butir untuk admin — memecahnya jadi dua baris
             kode membuat daftar itu lebih panjang daripada yang bisa dibaca
             sekilas, padahal keduanya aksi yang sama dengan wewenang berbeda. */
          adalahAdmin()
            ? `<button type="button" role="menuitem" data-act="kode">
                 ${IKON_KUNCI}
                 Buat kode tim
               </button>`
            : ''
        }
        ${
          /* Hapus dipisah garis dan diberi warna peringatan: ia bertetangga
             dengan aksi sehari-hari di menu yang sama, dan satu-satunya di sini
             yang tidak bisa dibatalkan. */
          adalahAdmin()
            ? `<button type="button" role="menuitem" class="bahaya" data-act="hapus">
                 <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"
                         stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                 </svg>
                 Hapus tim
               </button>`
            : ''
        }`;
  }

  /**
   * Konfirmasi hapus tim: dialog ya/tidak.
   *
   * Nama tim sempat harus diketik ulang. Itu dilepas karena membebani panitia
   * di setiap penghapusan yang memang disengaja, sementara yang benar-benar
   * menahan kesalahan sudah ada: aksinya hanya muncul untuk sesi admin, nama
   * timnya tercetak besar di dialog ini, dan berkasnya masih bisa ditarik dari
   * sampah Drive selama 30 hari.
   */
  _kotakHapus() {
    const h = this._hapus;
    if (!h) return '';
    return `
      <div class="lapis" role="dialog" aria-modal="true" aria-label="Hapus tim ${esc(h.nama)}">
        <div class="kotak bahaya">
          <h3>Hapus ${esc(h.nama)}?</h3>
          <p>
            Timnya dibuang dari daftar beserta seluruh berkasnya — logo, ID card,
            dan foto. Berkasnya masuk sampah Drive (tertahan 30 hari); barisnya
            sendiri tidak bisa dikembalikan.
          </p>
          ${h.galat ? `<p class="lapis-galat">${esc(h.galat)}</p>` : ''}
          <div class="lapis-aksi">
            <button type="button" data-act="batal-hapus" ${h.sibuk ? 'disabled' : ''}>Batal</button>
            <button type="button" class="bahaya" data-act="ya-hapus" ${h.sibuk ? 'disabled' : ''}>
              ${h.sibuk ? 'Menghapus…' : 'Ya, hapus'}
            </button>
          </div>
        </div>
      </div>`;
  }

  /**
   * Kode tim yang baru dibuat, ditampilkan penuh untuk dicatat atau dibacakan.
   *
   * Sengaja tidak disembunyikan di balik tombol mata seperti di halaman detail:
   * kode ini baru saja diminta admin, umurnya 6 jam, dan satu-satunya gunanya
   * memang untuk diteruskan ke PIC.
   */
  _kotakKode() {
    const k = this._kode;
    if (!k) return '';
    const sisa = k.sampai ? sisaWaktu(k.sampai) : '';
    return `
      <div class="lapis" role="dialog" aria-modal="true" aria-label="Kode tim ${esc(k.nama)}">
        <div class="kotak">
          <h3>Kode tim ${esc(k.nama)}</h3>
          ${
            k.memilih
              ? `<p>Pilih wewenang yang diberikan kode ini. Keduanya berlaku 6 jam.</p>
                 <div class="pilih-jenis">
                   <button type="button" data-act="pilih-penuh">
                     <b>Ubah data + unggah berkas</b>
                     <small>Membetulkan nick, ID game, server; menambah pemain; mengunggah berkas.</small>
                   </button>
                   <button type="button" data-act="pilih-unggah">
                     <b>Unggah berkas saja</b>
                     <small>Hanya logo, ID card, dan foto. Data pemain tidak bisa disentuh.</small>
                   </button>
                 </div>`
              : k.sibuk
              ? '<p>Membuat kode…</p>'
              : k.galat
                ? `<p class="lapis-galat">${esc(k.galat)}</p>`
                : `<p class="kode-besar">${esc(k.kode)}</p>
                   <p>
                     <b>${k.jenis === JENIS_KODE.PENUH ? 'Ubah data + unggah berkas' : 'Unggah berkas saja'}</b><br />
                     Berlaku ${esc(sisa)} lagi · sampai ${esc(jamMenit(k.sampai))}.
                     Setelah itu kode ini tidak bisa dipakai lagi.
                   </p>`
          }
          <div class="lapis-aksi">
            ${
              k.kode
                ? `<button type="button" data-act="salin-kode">
                     ${k.tersalin ? 'Tersalin' : 'Salin kode'}
                   </button>`
                : ''
            }
            ${k.memilih ? '<button type="button" data-act="tutup-kode">Batal</button>' : ''}
            ${
              k.memilih
                ? ''
                : `<button type="button" class="utama" data-act="tutup-kode" ${k.sibuk ? 'disabled' : ''}>
                     Tutup
                   </button>`
            }
          </div>
        </div>
      </div>`;
  }

  /** Buat kode untuk satu tim, lalu tampilkan hasilnya. */
  async _buatKode(teamId, nama, jenis) {
    this._kode = { teamId, nama, jenis, memilih: false, sibuk: true, kode: '', sampai: 0, galat: '' };
    this.render();
    try {
      const hasil = await buatKodeTim(teamId, jenis);
      this._kode = { teamId, nama, jenis: hasil.jenis, sibuk: false,
                     kode: hasil.kode, sampai: hasil.sampai, galat: '' };
    } catch (error) {
      this._kode = { teamId, nama, jenis, sibuk: false, kode: '', sampai: 0,
                     galat: error.message || 'Gagal membuat kode tim.' };
    }
    this.render();
  }

  async _salinKode() {
    const kode = this._kode?.kode;
    if (!kode) return;
    try {
      await navigator.clipboard.writeText(kode);
      this._kode = { ...this._kode, tersalin: true };
      this.render();
    } catch (error) {
      // Clipboard bisa ditolak (izin, konteks tidak aman). Kodenya tetap
      // terbaca di layar, jadi tidak ada yang perlu dilaporkan.
    }
  }

  async _jalankanHapus() {
    const h = this._hapus;
    if (!h || h.sibuk) return;
    this._hapus = { ...h, sibuk: true, galat: '' };
    this.render();
    try {
      await hapusTim(h.teamId);
      // Dibuang dari store, bukan dengan memuat ulang seluruh data: satu baris
      // hilang tidak sepadan dengan pembacaan ulang seluruh spreadsheet.
      buangTim(h.teamId);
      this._hapus = null;
      this.render();
    } catch (error) {
      this._hapus = { ...h, sibuk: false, galat: error.message || 'Gagal menghapus tim.' };
      this.render();
    }
  }

  onMount() {
    this.listen(this.shadowRoot, 'click', (event) => {
      // Lapisan konfirmasi diperiksa PALING awal: ia menutupi tabel, dan
      // klik apa pun di dalamnya tidak boleh merembes jadi "buka tim".
      if (this._kode) {
        const pilih = event.target.closest('[data-act="pilih-penuh"], [data-act="pilih-unggah"]');
        if (pilih) {
          const jenis = pilih.dataset.act === 'pilih-penuh' ? JENIS_KODE.PENUH : JENIS_KODE.UNGGAH;
          this._buatKode(this._kode.teamId, this._kode.nama, jenis);
          return;
        }
        if (event.target.closest('[data-act="salin-kode"]')) {
          this._salinKode();
          return;
        }
        // Selagi kodenya sedang dibuat, menutup dialog hanya menyembunyikan
        // permintaan yang tetap berjalan — dan hasilnya tidak pernah terbaca.
        if (this._kode.sibuk) return;
        if (event.target.closest('[data-act="tutup-kode"]') || !event.target.closest('.kotak')) {
          this._kode = null;
          this.render();
        }
        return;
      }

      if (this._hapus) {
        if (event.target.closest('[data-act="batal-hapus"]')) {
          this._hapus = null;
          this.render();
          return;
        }
        if (event.target.closest('[data-act="ya-hapus"]')) {
          this._jalankanHapus();
          return;
        }
        if (event.target.closest('.kotak')) return;
        // Klik di luar kotak = batal.
        if (event.target.closest('.lapis')) {
          this._hapus = null;
          this.render();
          return;
        }
      }
      // Menu dan tombolnya diperiksa lebih dulu: keduanya berada di dalam baris,
      // jadi tanpa ini klik pada menu akan ikut membuka panel detail.
      const aksi = event.target.closest('.menu button[data-act]');
      if (aksi) {
        const teamId = this._menuTeam;
        this._tutupMenu();
        if (!teamId) return;

        if (aksi.dataset.act === 'kode') {
          const tim = store.state.teams.find((t) => t.team_id === teamId);
          // Belum membuat apa pun: dialognya bertanya dulu jenis wewenangnya.
          if (tim) {
            this._kode = { teamId, nama: tim.team_name, memilih: true,
                           jenis: '', sibuk: false, kode: '', sampai: 0, galat: '' };
            this.render();
          }
          return;
        }

        if (aksi.dataset.act === 'hapus') {
          const tim = store.state.teams.find((t) => t.team_id === teamId);
          if (tim) {
            this._hapus = { teamId, nama: tim.team_name, sibuk: false, galat: '' };
            this.render();
          }
          return;
        }

        const tujuan = { unggah: 'berkas', foto: 'foto' }[aksi.dataset.act] || null;
        selectTeam(teamId, tujuan);
        return;
      }
      const burger = event.target.closest('.burger');
      if (burger) {
        if (this._menuTeam === burger.dataset.menu) this._tutupMenu();
        else this._bukaMenu(burger);
        return;
      }
      this._tutupMenu();

      const header = event.target.closest('th[data-sort]');
      if (header) {
        setSort(header.dataset.sort);
        return;
      }
      const row = event.target.closest('tr[data-team]');
      if (row) selectTeam(row.dataset.team);
    });

    // Klik di luar shadow root (mana pun di halaman) juga menutup menu.
    this.listen(document, 'click', (event) => {
      if (event.composedPath().includes(this)) return;
      this._tutupMenu();
    });
    // Menu memakai koordinat layar, jadi ia harus ditutup begitu apa pun
    // bergeser — termasuk scroll di dalam .scroll, yang tidak sampai ke window
    // tanpa fase capture.
    this.listen(window, 'scroll', () => this._tutupMenu(), true);
    this.listen(window, 'resize', () => this._tutupMenu());

    this.listen(this.shadowRoot, 'keydown', (event) => {
      // Esc menutup dialog mana pun yang terbuka — kecuali selagi permintaannya
      // masih berjalan, karena menutup di tengah jalan hanya menyembunyikan
      // proses yang tetap berlanjut.
      if (this._kode) {
        if (event.key === 'Escape' && !this._kode.sibuk) {
          this._kode = null;
          this.render();
        }
        return;
      }
      if (this._hapus) {
        if (event.key === 'Escape' && !this._hapus.sibuk) {
          this._hapus = null;
          this.render();
        }
        return;
      }
      if (event.key === 'Escape' && this._menuTeam) {
        const tombol = this.$(`.burger[data-menu="${CSS.escape(this._menuTeam)}"]`);
        this._tutupMenu();
        tombol?.focus();
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;

      // Tombol menu dan isinya punya perilaku klik sendiri; membiarkannya jatuh
      // ke penanganan baris akan membuka panel detail sekaligus.
      if (event.target.closest?.('.burger, .menu')) return;

      const header = event.target.closest?.('th[data-sort]');
      const row = event.target.closest?.('tr[data-team]');
      if (!header && !row) return;
      event.preventDefault();
      if (header) setSort(header.dataset.sort);
      else selectTeam(row.dataset.team);
    });
  }

  /** Tempatkan menu tepat di bawah tombolnya, dalam koordinat viewport. */
  _bukaMenu(burger) {
    this._tutupMenu();
    const menu = this.$('.menu');
    if (!menu) return;

    this._menuTeam = burger.dataset.menu;
    burger.setAttribute('aria-expanded', 'true');
    // Isinya dibangun dulu: ukurannya menentukan penempatan, dan butirnya
    // berbeda-beda per tim.
    menu.innerHTML = this._isiMenu(this._menuTeam);
    menu.hidden = false;

    const kotak = burger.getBoundingClientRect();
    const ukuran = menu.getBoundingClientRect();
    const jarak = 6;

    // Rata kanan dengan tombol, lalu dijaga agar tidak keluar layar — penting di
    // ponsel, tempat tombolnya menempel di tepi kanan kartu.
    let kiri = kotak.right - ukuran.width;
    kiri = Math.min(Math.max(8, kiri), window.innerWidth - ukuran.width - 8);

    // Balik ke atas tombol kalau ruang di bawah tidak cukup.
    const muatDiBawah = kotak.bottom + jarak + ukuran.height <= window.innerHeight - 8;
    const atas = muatDiBawah ? kotak.bottom + jarak : kotak.top - jarak - ukuran.height;

    menu.style.left = `${Math.round(kiri)}px`;
    menu.style.top = `${Math.round(Math.max(8, atas))}px`;
    menu.querySelector('button')?.focus();
  }

  _tutupMenu() {
    if (!this._menuTeam) return;
    this._menuTeam = null;
    const menu = this.$('.menu');
    if (menu) menu.hidden = true;
    this.$$('.burger[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
}

function emptyState(filters) {
  const hint = filters.q
    ? `Tidak ada tim atau pemain yang cocok dengan “${esc(filters.q)}”.`
    : 'Kombinasi filter yang aktif tidak menyisakan tim.';
  return `
    <div class="empty">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6" />
        <path d="m16.5 16.5 4 4M8 11h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <h3>Tidak ada hasil</h3>
      <p>${hint} Coba longgarkan filter atau reset semuanya.</p>
    </div>`;
}

define('team-table', TeamTable);
