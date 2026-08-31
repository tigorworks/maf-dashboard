/**
 * Muat esport.json. Entitas utama dashboard adalah TIM; pemain hidup di dalam
 * tim (team -> PIC/Manager -> members). Daftar pemain datar tetap dibuat untuk
 * keperluan statistik, pencarian, dan ekspor.
 */
import { normalize, year } from '../core/format.js';

const FETCH_TIMEOUT = 20000;

/**
 * Endpoint Web App Google Apps Script (URL /exec dari Deploy > Web app).
 * Bisa ditimpa lewat atribut `data-src` di index.html.
 *
 * GAS yang menyajikan data, bukan spreadsheet langsung. Konsekuensinya:
 * spreadsheet tidak perlu dibagikan ke publik, dan kolom sensitif (NIP, nomor
 * telepon, email, Kode Tim) disaring di server — tidak pernah sampai ke browser.
 */
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbwhDFEMN0Pb8mp9dW8488oC6TJHuNjgPwbkP4phmLINTv40PNr8UZ-5AfAkCDvqpfQf8A/exec';

export const GAME_META = {
  MLBB: {
    label: 'MLBB',
    full: 'Mobile Legends: Bang Bang',
    logo: './assets/web/game-mlbb.png',
    color: 'var(--game-mlbb)',
  },
  PUBG: {
    label: 'PUBG',
    full: 'PUBG Mobile',
    logo: './assets/web/game-pubg.png',
    color: 'var(--game-pubg)',
  },
};

export async function loadDataset(url) {
  const endpoint = url && url !== 'ISI_URL_WEB_APP_GAS' ? url : GAS_URL;
  if (!endpoint || endpoint === 'ISI_URL_WEB_APP_GAS') {
    throw new Error('URL Web App GAS belum diisi di js/data/source.js (GAS_URL).');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} saat memuat data`);
    const payload = await response.json();
    if (payload && payload.ok === false) throw new Error(payload.error || 'Gagal memuat data.');
    return buildDataset(fromGas(payload), endpoint);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Waktu muat data habis (20 detik).');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Terjemahkan bentuk JSON dari GAS ke bentuk internal yang dipakai
 * buildDataset(). Dipisah supaya buildDataset tetap bisa diuji dengan data
 * biasa tanpa perlu memanggil jaringan.
 */
export function fromGas(payload) {
  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  return {
    lastupdate: payload?.lastUpdate || '',
    max_upload_bytes: payload?.maxUploadBytes || 0,
    max_players: Number(payload?.maxPlayers) || 0,
    status_pemain: Array.isArray(payload?.statusPemain) ? payload.statusPemain : [],
    terkunci: payload?.terkunci && typeof payload.terkunci === 'object' ? payload.terkunci : {},
    teams: teams.map((t) => ({
      team_id: t.teamId,
      game: t.game,
      team_name: t.teamName,
      team_slot: t.slot,
      kontingen: t.kontingen,
      unit_kerja: t.unitKerja,
      submission_date: t.submissionDate,
      terms: t.terms,
      pic: { name: t.picKontingen || '' },
      contacts: Array.isArray(t.contacts) ? t.contacts : [],
      logo_url: t.logoUrl || '',
      // ID card kini per ORANG. Angka ini hanya ringkasan "berapa yang sudah
      // masuk" untuk ditampilkan di kepala panel tim.
      idcard_count: Number(t.idCardCount) || 0,
      has_foto_tim: Boolean(t.hasFotoTim),
      foto_count: Number(t.fotoCount) || 0,
      members: (t.members || []).map((m) => ({
        player_id: m.playerId || '',
        has_idcard: Boolean(m.hasIdCard),
        has_foto: Boolean(m.hasFoto),
        full_name: m.name,
        game_nick: m.nick,
        game_id: m.gameId,
        game_server: m.server,
        status: m.status,
        join_date: m.joinDate,
      })),
    })),
  };
}

export function buildDataset(raw, endpoint = '') {
  const source = Array.isArray(raw?.teams) ? raw.teams : [];
  const teams = [];
  const players = [];

  for (const item of source) {
    const members = (item.members || []).map((member, index) => {
      const player = {
        id: `${item.team_id}#${index}`,
        // Identitas stabil dari converter; dipakai untuk ID card per orang dan
        // untuk menyunting pemain. `id` di atas hanya kunci render lokal.
        player_id: member.player_id || '',
        has_idcard: Boolean(member.has_idcard),
        has_foto: Boolean(member.has_foto),
        full_name: member.full_name || '—',
        game_nick: member.game_nick || '',
        game_id: member.game_id || '',
        game_server: member.game_server || '',
        status: member.status || '',
        join_date: member.join_date || '',
        join_year: year(member.join_date),
      };
      // NIP sengaja tidak ada di sini: GAS tidak mengirimkannya sama sekali.
      player._haystack = normalize([player.full_name, player.game_nick, player.game_id].join(' '));
      return player;
    });

    const pic = item.pic || {};
    const team = {
      team_id: item.team_id,
      game: item.game,
      team_name: item.team_name || '—',
      kontingen: item.kontingen || '',
      unit_kerja: item.unit_kerja || '',
      submission_date: item.submission_date || '',
      terms: item.terms || '',
      pic_name: pic.name || '',
      pic,
      contacts: item.contacts || [],
      logo_url: item.logo_url || '',
      idcard_count: members.filter((m) => m.has_idcard).length,
      has_foto_tim: Boolean(item.has_foto_tim),
      foto_count: members.filter((m) => m.has_foto).length,
      members,
      member_count: members.length,
    };

    // Pencarian tim ikut menjangkau nama/nick/NIP anggotanya, supaya mencari
    // seorang pemain tetap menemukan timnya.
    team._teamText = normalize([team.team_name, team.kontingen, team.unit_kerja, team.pic_name].join(' '));
    team._haystack = `${team._teamText} ${members.map((m) => m._haystack).join(' ')}`;

    teams.push(team);
    for (const member of members) players.push({ ...member, team });
  }

  return {
    meta: {
      lastupdate: raw?.lastupdate || '',
      endpoint,
      maxUploadBytes: raw?.max_upload_bytes || 0,
      // Batas slot pemain per tim dan pilihan status — keduanya berasal dari
      // GAS supaya tidak perlu disalin ulang di sini kalau berubah.
      maxPlayers: raw?.max_players || 0,
      statusPemain: raw?.status_pemain || [],
      // Cabor yang rosternya dikunci: { MLBB: { oleh, waktu } }.
      terkunci: raw?.terkunci || {},
    },
    teams,
    players,
    facets: buildFacets(teams),
  };
}

function buildFacets(teams) {
  const uniqueSorted = (key) =>
    [...new Set(teams.map((t) => t[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));

  return {
    games: uniqueSorted('game'),
    kontingen: uniqueSorted('kontingen'),
  };
}

/** Ringkasan atas sekumpulan tim (dipakai untuk kartu statistik & switcher). */
export function summarize(teams) {
  const kontingen = new Set();
  const units = new Set();
  const perGame = {};
  let players = 0;

  for (const team of teams) {
    if (team.kontingen) kontingen.add(team.kontingen);
    if (team.unit_kerja) units.add(team.unit_kerja);
    players += team.member_count;
    const bucket = (perGame[team.game] ||= { teams: 0, players: 0 });
    bucket.teams += 1;
    bucket.players += team.member_count;
  }

  return {
    teams: teams.length,
    players,
    kontingen: kontingen.size,
    units: units.size,
    perGame,
  };
}
