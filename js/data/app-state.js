/**
 * State aplikasi + pipeline turunan: filter -> sort -> paginate.
 * Baris tabel adalah TIM. Komponen tidak menyaring sendiri; mereka membaca
 * hasil derive().
 */
import { createStore } from '../core/store.js';
import { compare, normalize } from '../core/format.js';
import { summarize } from './source.js';
import { timLengkap } from './rules.js';

/*
 * Kolom tabel tim. `width` ditulis sebagai NILAI CSS YANG SAH untuk properti
 * `width` — dulu isinya `minmax(220px, 1.3fr)`, yang hanya berlaku di grid dan
 * DIABAIKAN peramban saat dipasang lewat style="width:...". Akibatnya lebar
 * kolom sepenuhnya ditentukan isi sel; dengan `white-space: nowrap` di tiap sel,
 * tabelnya melebar melewati panel dan terpotong tanpa jalan untuk melihatnya.
 *
 * Sekarang persen, dipasangkan dengan `table-layout: fixed` di team-table.js —
 * itulah yang membuat tabel MUSTAHIL melebihi lebar panelnya: kolom menyusut dan
 * teksnya berakhir dengan elipsis, bukan hilang di balik tepi layar.
 *
 * Kolom sempit (#, Pemain, aksi) tetap px karena isinya berlebar tetap; persen
 * hanya membuatnya melebar tanpa guna di layar besar.
 *
 * Persennya berjumlah 77%, BUKAN 100%, dan itu perhitungan bukan kelalaian:
 * keempat kolom px berjumlah 250px (46 + 72 + 88 + 44 aksi), yang pada lebar
 * tabel tersempit yang mungkin (1101px — di bawah itu tampilannya jadi kartu)
 * adalah ±23%. Jadi 77% + 23% genap. Kalau persennya ditulis 100%, jumlah
 * seluruh kolom melebihi lebar tabel dan peramban menyusutkan semuanya secara
 * proporsional — hasilnya tetap tidak terpotong, tapi angka di sini berhenti
 * berarti apa pun. Di layar yang lebih lebar, porsi px mengecil dan sisanya
 * dibagikan ke kolom persen.
 *
 * Angkanya turun dari 85% saat kolom "Kunjungan" (88px) ditambahkan. Menambah
 * kolom px TANPA mengurangi yang persen adalah cara paling mudah membuat
 * perhitungan ini diam-diam berhenti benar.
 */
export const COLUMNS = [
  { key: 'index', label: '#', sortable: false, align: 'right', width: '46px' },
  { key: 'team_name', label: 'Tim', sortable: true, width: '22%' },
  { key: 'kontingen', label: 'Kontingen', sortable: true, width: '16%' },
  { key: 'unit_kerja', label: 'Unit Kerja', sortable: true, width: '15%' },
  { key: 'pic_name', label: 'PIC / Manager', sortable: true, width: '13%' },
  { key: 'member_count', label: 'Pemain', sortable: true, align: 'right', width: '72px' },
  // Bersebelahan dengan "Pemain": keduanya kolom angka sempit, dan
  // mengelompokkannya membuat mata tidak melompati kolom teks di antaranya.
  // Bisa diurutkan — "tim mana yang paling banyak dilihat" adalah pertanyaan
  // yang wajar, dan tanpa pengurutan ia harus dicari baris per baris.
  { key: 'kunjungan', label: 'Kunjungan', sortable: true, align: 'right', width: '88px' },
  { key: 'submission_date', label: 'Didaftarkan', sortable: true, width: '11%' },
];

/** Lebar kolom aksi (menu ⋮). Dipakai team-table.js untuk kepala tabelnya. */
export const LEBAR_AKSI = '44px';

/* Ukuran halaman dikunci di 7 baris — tidak ada pemilih jumlah baris lagi. */
export const PAGE_SIZE = 7;

/* Cabor selalu terpilih — tidak ada opsi "semua". Nilai awalnya kosong sampai
   dataset dimuat, lalu diisi cabor pertama. */
const DEFAULT_FILTERS = {
  q: '',
  game: '',
  kontingen: '',
};

export const store = createStore({
  phase: 'loading', // loading | ready | error
  error: '',
  meta: null,
  facets: { games: [], kontingen: [] },
  teams: [],
  players: [],
  filters: { ...DEFAULT_FILTERS },
  // Urutan awal menurut kontingen, lalu tanggal daftar MENURUN (lihat
  // PEMECAH_SERI): verifikasi dikerjakan per kontingen, jadi tim satu kontingen
  // harus berdampingan — dan di dalamnya yang paling baru mendaftar di atas.
  sort: { key: 'kontingen', dir: 'asc' },
  page: 1,
  pageSize: PAGE_SIZE,
  selectedTeamId: null,
  selectedFocus: null, // null | 'berkas' | 'foto' — layar yang dituju saat tim dibuka
  // Halaman khusus admin: daftar kode aktif, satu baris per kontingen.
  showCodes: false,
  showAudit: false,
  showJejak: false,
  // Cerminan sesi dari data/auth.js, supaya komponen cukup berlangganan store.
  // Ini hanya untuk TAMPILAN — wewenang sesungguhnya ditegakkan GAS.
  auth: null, // null | { nama, peran }
});

/* ----------------------------- aksi ----------------------------------- */

/**
 * Cabor sengaja TIDAK dipilih otomatis: selama `filters.game` kosong, aplikasi
 * menampilkan layar pilihan cabor (<sport-gate>) lebih dulu.
 */
export function setDataset(dataset) {
  store.set({
    phase: 'ready',
    meta: dataset.meta,
    facets: dataset.facets,
    teams: dataset.teams,
    players: dataset.players,
    page: 1,
  });
}

/**
 * Pasang hitungan kunjungan ke tiap tim. Dipanggil setelah dataset siap.
 *
 * Ditempelkan KE OBJEK TIM, bukan disimpan sebagai peta tersendiri di state.
 * Dua alasan, dan keduanya menentukan:
 *
 *   1. sortTeams() membandingkan `baris[key]` — properti pada objek timnya.
 *      Kolom yang bisa diurutkan HARUS punya nilainya di sana; peta terpisah
 *      menuntut seluruh jalur pengurutan diubah untuk satu kolom.
 *   2. Satu sumber kebenaran. Peta di state + nilai di baris berarti dua
 *      tempat yang bisa berbeda, dan yang berbeda diam-diam.
 *
 * Ini mengikuti pola yang sudah ada: `member_count`, `idcard_count`, dan
 * `foto_count` juga nilai turunan yang menempel di objek tim.
 *
 * Tim tanpa entri diberi 0, bukan dibiarkan kosong: kalau daftarnya sudah
 * datang, "tidak ada entri" memang berarti nol kunjungan. Sebelum daftarnya
 * datang, propertinya belum ada sama sekali — dan itulah yang membedakan
 * "belum tahu" (tampil "—") dari "nol" (tampil 0).
 *
 * TIDAK menyentuh `phase`: tabel sudah tampil sebelum angka ini datang, dan
 * kegagalan mengambilnya tidak boleh mengubah keadaan halaman.
 */
export function setKunjungan(jumlah) {
  const peta = jumlah && typeof jumlah === 'object' ? jumlah : {};
  store.set((state) => ({
    teams: state.teams.map((team) => ({ ...team, kunjungan: Number(peta[team.team_id]) || 0 })),
  }));
}

export function setError(message) {
  store.set({ phase: 'error', error: message });
}

/** Setiap perubahan filter mengembalikan pagination ke halaman 1. */
export function setFilter(patch) {
  store.set((state) => ({ filters: { ...state.filters, ...patch }, page: 1 }));
}

/** Cabor yang sedang dipilih dipertahankan — ia navigasi, bukan filter. */
export function resetFilters() {
  store.set((state) => ({ filters: { ...DEFAULT_FILTERS, game: state.filters.game }, page: 1 }));
}

/** Kembali ke layar pilihan cabor; seluruh filter ikut dibersihkan. */
export function clearGame() {
  store.set({
    filters: { ...DEFAULT_FILTERS }, page: 1,
    selectedTeamId: null, selectedFocus: null, showCodes: false, showAudit: false,
    showJejak: false,
  });
}

/** Klik header: kolom sama -> balik arah, kolom lain -> mulai dari menaik. */
export function setSort(key) {
  store.set((state) => {
    const dir = state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc';
    return { sort: { key, dir }, page: 1 };
  });
}

export function setPage(page) {
  store.set({ page });
}


/**
 * Perbarui satu tim setelah unggahan berhasil, tanpa memuat ulang seluruh data.
 * Array `teams` diganti barunya (bukan dimutasi) supaya store mendeteksi
 * perubahan — pembanding store bersifat dangkal.
 */
export function applyUpload(teamId, patch) {
  store.set((state) => ({
    teams: state.teams.map((team) => (team.team_id === teamId ? { ...team, ...patch } : team)),
  }));
}

/**
 * Apakah roster satu cabor sudah dikunci panitia?
 *
 * Kunci berlaku PER CABOR — MLBB bisa terkunci sementara PUBG masih terbuka —
 * jadi cabornya disebut, bukan disimpulkan. Bawaannya cabor yang sedang dipilih
 * karena itulah yang benar untuk header dan daftar tim; halaman tim mengirim
 * cabor TIMNYA sendiri, supaya jawabannya tidak bergantung pada penyaring yang
 * kebetulan aktif.
 */
export function caborTerkunci(game = store.state.filters.game, state = store.state) {
  return Boolean(game && state.meta?.terkunci?.[game]);
}

/** Perbarui status kunci setelah admin mengubahnya, tanpa memuat ulang data. */
export function setTerkunci(terkunci) {
  store.set((state) => ({ meta: { ...state.meta, terkunci: terkunci || {} } }));
}

/**
 * Kembali ke daftar tim: tutup halaman tim, Kode Tim, dan notifikasi sekaligus.
 *
 * Cabor yang sedang dibuka TIDAK ikut dibersihkan — itu konteks, bukan halaman,
 * dan melemparkan orang kembali ke layar pilihan cabor adalah satu langkah
 * mundur lebih jauh daripada yang dimintanya.
 */
export function kembaliKeDaftar() {
  store.set({
    selectedTeamId: null, selectedFocus: null,
    showCodes: false, showAudit: false, showJejak: false,
  });
}

export function setAuth(sesi) {
  // kontingen ikut disimpan supaya komponen yang membaca store (bukan modul
  // auth) tahu tim mana yang boleh disunting oleh sesi peran 'tim'.
  store.set({
    auth: sesi
      ? { nama: sesi.nama, peran: sesi.peran, kontingen: sesi.kontingen || '', jenis: sesi.jenis || '' }
      : null,
  });
}

/**
 * Terapkan perubahan satu PEMAIN ke store, tanpa memuat ulang seluruh data.
 * Dipakai setelah unggah ID card per orang dan setelah admin menyunting.
 *
 * Array teams dan members diganti barunya (bukan dimutasi) karena pembanding
 * store bersifat dangkal — mutasi di tempat tidak akan terdeteksi.
 */
export function applyPlayerPatch(playerId, patch) {
  if (!playerId) return;
  store.set((state) => ({
    teams: state.teams.map((team) => {
      if (!team.members.some((m) => m.player_id === playerId)) return team;
      const members = team.members.map((m) => (m.player_id === playerId ? { ...m, ...patch } : m));
      return { ...team, members, idcard_count: members.filter((m) => m.has_idcard).length };
    }),
  }));
}

/**
 * Buang satu tim dari store setelah dihapus di server.
 *
 * Halaman tidak dimuat ulang: daftar tim, hitungan kartu ringkasan, dan facet
 * kontingen semuanya diturunkan dari state ini, jadi membuang satu baris di
 * sini sudah cukup untuk membuat seluruh layar sepakat.
 */
export function buangTim(teamId) {
  store.set((state) => {
    const teams = state.teams.filter((team) => team.team_id !== teamId);
    // Facet kontingen ikut dihitung ulang. Kalau tidak, kontingen yang timnya
    // baru saja habis tetap tersisa di penyaring dan selalu menghasilkan nol.
    const kontingen = [...new Set(teams.map((t) => t.kontingen).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'id')
    );
    return {
      teams,
      players: state.players.filter((p) => p.team?.team_id !== teamId),
      facets: { ...state.facets, kontingen },
      selectedTeamId: state.selectedTeamId === teamId ? null : state.selectedTeamId,
      page: 1,
    };
  });
}

/**
 * Ganti seluruh roster satu tim, dan — kalau disertakan — nama timnya.
 *
 * Dipakai setelah menyimpan suntingan: pemain bisa bertambah, berkurang, atau
 * berubah urutan, sehingga menambal per pemain (applyPlayerPatch) tidak cukup.
 *
 * Nama tim ikut di sini, bukan lewat aksi tersendiri, karena keduanya berubah
 * dalam SATU penyimpanan. Dua aksi terpisah berarti store bisa sempat memuat
 * nama baru dengan roster lama — keadaan yang tidak pernah ada di server.
 *
 * `teamName` kosong berarti "jangan sentuh", bukan "kosongkan": pemanggil yang
 * hanya mengubah roster tidak boleh menghapus nama timnya.
 */
export function gantiRoster(teamId, members, teamName) {
  const nama = String(teamName || '').trim();
  store.set((state) => ({
    teams: state.teams.map((team) =>
      team.team_id === teamId
        ? {
            ...team,
            ...(nama ? { team_name: nama } : {}),
            members,
            member_count: members.length,
            idcard_count: members.filter((m) => m.has_idcard).length,
          }
        : team
    ),
  }));
}

/**
 * Buka panel detail satu tim.
 *
 * `focus` menentukan layar mana yang dibuka: 'berkas' (logo & ID card), 'foto'
 * (foto bersama & foto pemain), atau null untuk layar verifikasi. Dipakai menu
 * baris supaya tiap pilihan mendarat tepat di tempatnya.
 */
export function selectTeam(teamId, focus = null) {
  store.set({
    selectedTeamId: teamId,
    selectedFocus: teamId ? focus : null,
    showCodes: false,
    showAudit: false,
    showJejak: false,
  });
}

/** Buka/tutup halaman daftar kode. Saling meniadakan dengan halaman tim. */
export function setShowAudit(tampil) {
  store.set({
    showAudit: Boolean(tampil),
    showCodes: false,
    showJejak: false,
    selectedTeamId: null,
    selectedFocus: null,
  });
}

/** Buka/tutup layar jejak perubahan. Saling meniadakan dengan layar lain. */
export function setShowJejak(tampil) {
  store.set({
    showJejak: Boolean(tampil),
    showCodes: false,
    showAudit: false,
    selectedTeamId: null,
    selectedFocus: null,
  });
}

export function setShowCodes(tampil) {
  store.set({
    showCodes: Boolean(tampil),
    showAudit: false,
    showJejak: false,
    selectedTeamId: null,
    selectedFocus: null,
  });
}

export function activeFilterCount(filters = store.state.filters) {
  return (filters.q ? 1 : 0) + (filters.kontingen ? 1 : 0);
}

/* --------------------------- turunan ---------------------------------- */

/** Filter murni atas daftar tim; murah untuk 63 baris. */
export function filterTeams(state = store.state) {
  const { q, game, kontingen } = state.filters;
  const needle = normalize(q.trim());

  return state.teams.filter((team) => {
    if (game && team.game !== game) return false;
    if (kontingen && team.kontingen !== kontingen) return false;
    if (needle && !team._haystack.includes(needle)) return false;
    return true;
  });
}

/**
 * Pemecah seri per kolom: kolom mana yang menentukan urutan DI DALAM satu nilai
 * yang sama, dan ke arah mana.
 *
 * Kontingen adalah kolom yang serinya paling panjang — satu kontingen bisa
 * mengirim beberapa tim, dan tanpa pemecah seri urutannya jatuh ke urutan baris
 * spreadsheet, yang bagi pembaca tidak berarti apa-apa.
 *
 * Tanggal daftar dibaca MENURUN: yang paling baru mendaftar di atas. Itu yang
 * paling mungkin belum diperiksa panitia, sedangkan tim yang mendaftar sejak
 * awal umumnya sudah beres — daftar yang menaruh pekerjaan terbaru di atas
 * menghemat satu gulir setiap kali dibuka.
 */
const PEMECAH_SERI = {
  kontingen: { kolom: 'submission_date', arah: 'desc' },
};

/**
 * Bandingkan pemecah seri. Nilai kosong SELALU jatuh ke bawah, apa pun arahnya.
 *
 * compare() sudah menaruh yang kosong di belakang, tapi mengalikannya dengan -1
 * untuk arah menurun akan melemparkannya ke depan — dan baris tanpa tanggal
 * memimpin daftar adalah kebalikan dari yang dimaksud "yang terbaru di atas".
 */
function bandingSusulan(a, b, arah) {
  const aKosong = a === null || a === undefined || a === '';
  const bKosong = b === null || b === undefined || b === '';
  if (aKosong || bKosong) return compare(a, b);
  return compare(a, b) * (arah === 'desc' ? -1 : 1);
}

export function sortTeams(rows, sort = store.state.sort) {
  const { key, dir } = sort;
  const factor = dir === 'desc' ? -1 : 1;
  const kedua = PEMECAH_SERI[key];

  // Sort stabil: indeks asli sebagai tie-breaker TERAKHIR.
  return rows
    .map((row, i) => [row, i])
    .sort((a, b) => {
      const utama = compare(a[0][key], b[0][key]);
      if (utama !== 0) return utama * factor;
      if (kedua) {
        // Arah kolom pertama TIDAK diteruskan ke sini: kolom kedua punya arahnya
        // sendiri. Membalik urutan kontingen adalah soal urutan kontingennya,
        // dan tidak boleh sekalian mengacak arti kolom tanggal.
        const susulan = bandingSusulan(a[0][kedua.kolom], b[0][kedua.kolom], kedua.arah);
        if (susulan !== 0) return susulan;
      }
      return a[1] - b[1];
    })
    .map(([row]) => row);
}

/**
 * Anggota tim yang cocok dengan kata kunci — dipakai tabel untuk menunjukkan
 * "kenapa tim ini muncul" saat pengguna mencari nama pemain.
 */
export function matchedMembers(team, query) {
  const needle = normalize((query || '').trim());
  if (!needle || team._teamText.includes(needle)) return [];
  return team.members.filter((member) => member._haystack.includes(needle));
}

/** Satu panggilan menghasilkan semua yang dibutuhkan tabel + statistik. */
export function derive(state = store.state) {
  const filtered = sortTeams(filterTeams(state), state.sort);
  const size = state.pageSize || PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(state.page, pageCount);
  const start = (page - 1) * size;

  return {
    filtered,
    rows: filtered.slice(start, start + size),
    offset: start,
    page,
    pageCount,
    stats: {
      ...summarize(filtered),
      // Berapa tim yang TIDAK kena satu pun aturan validasi (logo, ID card
      // lengkap, batas TAD, format nick) — lihat rules.js.
      //
      // Dihitung DI SINI, bukan di dalam summarize(). summarize() milik
      // source.js yang tugasnya membentuk data; aturan kelayakan milik
      // rules.js. Menaruhnya di summarize() berarti source.js ikut bergantung
      // pada aturan turnamen, dan sport-gate — yang cuma butuh jumlah tim per
      // cabor — ikut menjalankan pemeriksaan yang tidak dipakainya.
      //
      // Mengikuti FILTER aktif, sama seperti angka kartu lainnya: kalau panitia
      // sedang menyaring satu kontingen, yang ingin ia ketahui adalah
      // kelengkapan kontingen itu.
      lengkap: filtered.filter(timLengkap).length,
    },
    // Pembanding "dari total" dihitung dalam cabor yang sedang dibuka,
    // bukan seluruh dataset — cabor lain bukan konteks yang relevan.
    totalTeams: state.teams.filter((team) => !state.filters.game || team.game === state.filters.game).length,
  };
}
