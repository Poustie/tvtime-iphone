/* Mon TV Time - application logic (vanilla JS, no build step) */
'use strict';

//////////////////////// Constants ////////////////////////
const DATA = window.TVTIME_DATA || {};
const IMG = (p, size = 'w342') => p ? `https://image.tmdb.org/t/p/${size}${p}` : null;
const TMDB = 'https://api.themoviedb.org/3';
const APP_VERSION = '2'; // numéro de version affiché dans « À propos »
const DEFAULT_RUNTIME = 42; // minutes, fallback when unknown

// Notes de version (les plus récentes en premier), affichées dans #/changelog.
const CHANGELOG = [
  { id: 11, date: '25 août 2026', title: 'Partager sa liste', items: [
    'Partagez votre liste de séries et films à quelqu\'un, <b>sans votre historique</b> : rien n\'est marqué comme vu chez lui (Réglages → Partager ma liste).',
    'À la réception, la liste reçue s\'ajoute à la sienne sans écraser ni dupliquer ce qu\'il a déjà.',
  ] },
  { id: 10, date: '25 août 2026', title: 'Glissement entre catégories', items: [
    'Le changement de catégorie joue une petite animation de glissement.',
  ] },
  { id: 9, date: '25 août 2026', title: 'Navigation & confort', items: [
    'Changez de catégorie d\'un simple glissement (swipe) : Séries · Films · Explorer · Profil.',
    'Le glissement suit votre doigt en direct : la page bouge avec vous, et revient en place si vous ne glissez pas assez.',
    'Une fenêtre « Nouveautés » vous résume les changements à la première ouverture après une mise à jour.',
    'Sur iPhone : le double-appui ne zoome plus par accident.',
    'Sur iPhone : la barre des catégories reste fixée tout en bas, sans à-coups.',
  ] },
  { id: 8, date: '24 août 2026', title: 'Affichage iPhone', items: [
    'Correction de la marge en haut de l\'écran : le contenu ne passe plus sous l\'encoche (Dynamic Island).',
  ] },
  { id: 7, date: '20 août 2026', title: 'Noms en français', items: [
    'Les séries et les films affichent désormais leur titre français sous les affiches (plus les titres anglais importés).',
    'La recherche dans la bibliothèque reconnaît aussi bien le titre français que le nom d\'origine.',
  ] },
  { id: 6, date: '14 août 2026', title: 'Fin de série & sauvegardes', items: [
    'Une petite célébration animée (confettis) apparaît quand vous terminez une série, avec vos statistiques de visionnage.',
    'Import de sauvegarde plus robuste : une sauvegarde un peu abîmée ne bloque plus l\'application.',
    'Dans Explorer, les œuvres déjà dans votre bibliothèque sont signalées « Dans ma liste » et ouvrent directement leur vraie fiche.',
  ] },
  { id: 5, date: '14 août 2026', title: 'Épisodes d\'animes', items: [
    'Correction de l\'alignement des épisodes pour les animes à numérotation continue (Naruto, Bleach, One Piece…) : les épisodes cochés correspondent enfin à la bonne saison.',
    'À l\'ouverture d\'une série, on vous emmène juste après le dernier épisode vu (les épisodes sautés ne bloquent plus).',
  ] },
  { id: 4, date: '11 août 2026', title: 'Nouvelle navigation', items: [
    'Barre de navigation en bas : Séries · Films · Explorer · Profil.',
    'La page Séries a deux onglets : « À voir » (par catégories) et « À suivre » (le prochain épisode de chaque série).',
    'Explorer : cherchez de nouvelles séries et films, avec un aperçu complet avant de les ajouter.',
    'Tri simplifié (alphabétique / ajout récent) et réorganisation des catégories de l\'accueil.',
    'Statuts de séries en français (En cours, Terminée, Annulée…).',
    'Sur une saison : boutons « Tout vu » / « Tout non vu ».',
    'Suivi automatique des séries dont vous avez vu au moins un épisode.',
  ] },
  { id: 3, date: '6 août 2026', title: 'Installation & sauvegarde', items: [
    'Installation sur téléphone à une adresse fixe : vos données restent d\'une mise à jour à l\'autre, sans ré-importer.',
    'Possibilité de retirer une note donnée par erreur (bouton ✕ sur les étoiles).',
  ] },
  { id: 2, date: '4 août 2026', title: 'Notes, réactions & profil', items: [
    'Nom de profil personnalisable.',
    'Réagissez aux films comme aux épisodes de série.',
    'Noter une œuvre ne vous fait plus changer d\'onglet ; les étoiles se remplissent simplement.',
    'Récupération des dates de visionnage des films et de vos films favoris.',
    'Export / Import : sauvegarde complète de tout votre historique, transférable sur un autre appareil.',
  ] },
  { id: 1, date: '3 août 2026', title: 'Fiches enrichies', items: [
    'Fiches détaillées « À propos » : casting, bande-annonce, plateformes de streaming, note du public, dates.',
    'Fiche complète pour les films.',
    'Listes personnalisées modifiables, favoris, statistiques films.',
    'Adaptation à l\'écran des iPhone (encoche).',
  ] },
];

// TV Time "star-meter" reaction ids -> label/emoji. The 5 first ids are the
// confirmed reactions (great=1, good=8, wow=3, ok=6, bad=7); the rest are older
// best-effort labels.
const EMOTIONS = [
  { id: '1', emoji: '🤩', label: 'Génial' },
  { id: '8', emoji: '👍', label: 'Bien' },
  { id: '3', emoji: '😮', label: 'Waouh' },
  { id: '6', emoji: '😐', label: 'Bof' },
  { id: '7', emoji: '👎', label: 'Pas aimé' },
  { id: '2', emoji: '😂', label: 'MDR' },
  { id: '4', emoji: '😢', label: 'Triste' },
  { id: '5', emoji: '😱', label: 'Choqué' },
];
const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map(e => [e.id, e]));

//////////////////////// State ////////////////////////
// userState = durable user edits (persisted to userdata.json)
let userState = {
  tmdbKey: '',
  seenAdd: {},     // key -> {at}
  seenRemove: {},  // key -> true
  ratings: {},     // key -> rating(1-5)
  emotions: {},    // key -> emotionId
  showRatings: {}, // showId -> rating
  watchlist: {},   // showId -> true
  archived: {},    // showId -> true/false override
  customEpisodes: {}, // showKey -> [{s,n,name}] user-added episodes
  homeOrder: ['watching', 'notStarted', 'stale', 'finished'], // order of the Séries sections
  movieStatus: {}, // movieName -> 'watched' | 'towatch' (user override)
  movieWatchedAt: {}, // movieName -> date string (enregistrée quand tu marques un film vu dans l'app)
  movieRatings: {}, // movieName -> rating(1-5) (ma notation d'un film)
  movieEmotions: {}, // movieName -> emotionId (ma réaction à un film ; '' = effacée, override de l'import)
  rewatch: {},     // epKey -> number of rewatches (override of exported count)
  movieRewatch: {}, // movieName -> number of rewatches (override)
  showTmdb: {},    // showKey -> tmdbId (manual TMDB match / poster override)
  movieTmdb: {},   // movieName -> { id, poster } (manual TMDB match / poster override)
  customShows: [], // [{key,tmdbId,name,poster,addedAt}] shows added by the user (future watch)
  customMovies: [],// [{name,releaseDate,runtime,status,addedAt}] movies added by the user
  pinnedWatching: {}, // showKey -> true : force the show into « En cours » regardless of last-seen date
  favShows: {},    // showKey -> true/false : override the imported "favori" flag
  favMovies: {},   // movieName -> true : films favoris
  profileName: '', // nom affiché dans « Bonjour … » (paramétrable, override du nom importé)
  userLists: [],   // [{id,name,shows:[key],movies:[name]}] listes personnalisables
  lists: null,     // null = use baseline lists; else array
  seenChangelog: 0, // id de la dernière note de version vue (pop-up « nouveautés »)
};
// tmdbCache = metadata cache (persisted to tmdb-cache.json)
let tmdbCache = { map: {}, shows: {}, seasons: {}, movies: {}, movieMeta: {} };

let MODEL = null; // built show model

//////////////////////// Persistence ////////////////////////
// Works in two modes:
//  - PC mode: the PowerShell server answers /api/state & /api/cache -> saved to disk files.
//  - Standalone/PWA mode (phone, static hosting): no server -> saved to IndexedDB on the device.
let serverAvailable = false;

// --- tiny IndexedDB key/value store ---
let _dbPromise = null;
function idbOpen() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((res, rej) => {
    const r = indexedDB.open('montvtime', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _dbPromise;
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((res) => {
      const req = db.transaction('kv').objectStore('kv').get(key);
      req.onsuccess = () => res(req.result); req.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}
async function idbSet(key, val) {
  try {
    const db = await idbOpen();
    return await new Promise((res) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = () => res(true); tx.onerror = () => res(false);
    });
  } catch { return false; }
}

async function apiGet(path) {
  try {
    const r = await fetch(path, { cache: 'no-store' });
    if (!r.ok) throw new Error('bad');
    return await r.json();
  } catch { return null; }
}

let saveTimer = null, cacheTimer = null;
function scheduleSaveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (serverAvailable) {
      fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userState) }).catch(() => {});
    } else {
      idbSet('userState', userState);
      try { localStorage.setItem('montvtime_userState', JSON.stringify(userState)); } catch {}
    }
  }, 400);
}
function scheduleSaveCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    if (serverAvailable) {
      fetch('/api/cache', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tmdbCache) }).catch(() => {});
    } else {
      idbSet('tmdbCache', tmdbCache);
    }
  }, 800);
}

//////////////////////// Keys & helpers ////////////////////////
const showKey = (s) => s.tvdbId || ('n:' + s.name);
const epKey = (skey, season, number) => `${skey}|${season}|${number}`;
function keyFromRecord(r) {
  const sk = r.showId || ('n:' + r.showName);
  return epKey(sk, r.season, r.number);
}
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
}
const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

//////////////////////// Build model ////////////////////////
function buildModel() {
  const shows = new Map(); // showKey -> show object
  for (const s of DATA.shows || []) {
    const k = showKey(s);
    shows.set(k, {
      key: k,
      tvdbId: s.tvdbId,
      name: s.name,
      followed: !!s.followed,
      favorited: !!s.favorited,
      archived: (userState.archived[k] != null) ? userState.archived[k] : !!s.archived,
      specialStatus: s.specialStatus,
      showRating: userState.showRatings[k] != null ? userState.showRatings[k] : (s.showRating ? Math.round(parseFloat(s.showRating)) : null),
      createdAt: s.createdAt || '',
      seenKeys: new Set(),
    });
  }
  // User-added shows (planned for the future). Keyed by a synthetic tmdb key.
  for (const cs of userState.customShows || []) {
    const k = cs.key || ('tmdb:' + cs.tmdbId);
    if (shows.has(k)) continue;
    shows.set(k, {
      key: k, tvdbId: null, forcedTmdb: cs.tmdbId, name: cs.name, poster: cs.poster || null,
      followed: true, favorited: false,
      archived: (userState.archived[k] != null) ? userState.archived[k] : false,
      specialStatus: null,
      showRating: userState.showRatings[k] != null ? userState.showRatings[k] : null,
      createdAt: cs.addedAt || '',
      seenKeys: new Set(), custom: true,
    });
  }
  const ensure = (id, name) => {
    const k = id || ('n:' + name);
    if (!shows.has(k)) {
      shows.set(k, { key: k, tvdbId: id || null, name, followed: false, favorited: false, archived: false, specialStatus: null, showRating: null, seenKeys: new Set() });
    }
    return shows.get(k);
  };

  // baseline seen
  const baselineSeen = new Set();
  for (const r of DATA.seen || []) {
    if (r.showId == null || r.showId === '') continue; // lignes orphelines (série non identifiée) = artefacts, pas de vrais visionnages
    const sh = ensure(r.showId, r.showName);
    const kk = epKey(sh.key, r.season, r.number);
    baselineSeen.add(kk);
    sh.seenKeys.add(kk);
  }

  // Anime & co. : TV Time découpe souvent une série en « saisons »-arcs (chacune
  // renumérotée dès 1) alors que TMDB utilise un autre découpage. On réaligne les
  // épisodes vus importés (baseline) sur la numérotation TMDB par ordre absolu.
  for (const sh of shows.values()) {
    if (sh.seenKeys.size === 0) continue;
    const meta = metaFor(sh);
    if (meta && meta.seasons && meta.seasons.length) alignSeenToTmdb(sh, meta);
  }

  // apply user removals / additions
  for (const kk of Object.keys(userState.seenRemove)) baselineSeen.delete(kk);
  for (const kk of Object.keys(userState.seenAdd)) baselineSeen.add(kk);

  // recompute per-show seenKeys with overrides
  for (const sh of shows.values()) {
    for (const kk of Array.from(sh.seenKeys)) if (userState.seenRemove[kk]) sh.seenKeys.delete(kk);
  }
  for (const kk of Object.keys(userState.seenAdd)) {
    const sk = kk.split('|')[0];
    // find show by key prefix
    for (const sh of shows.values()) { if (sh.key === sk) { sh.seenKeys.add(kk); break; } }
  }

  // A show with any watched episode is automatically "followed".
  for (const sh of shows.values()) if (sh.seenKeys.size > 0) sh.followed = true;

  // seen timestamps map for activity
  const seenDates = [];
  for (const r of DATA.seen || []) {
    if (r.showId == null || r.showId === '') continue;
    const kk = epKey(r.showId, r.season, r.number);
    if (!userState.seenRemove[kk] && r.seenAt) seenDates.push(r.seenAt);
  }
  for (const kk of Object.keys(userState.seenAdd)) { if (userState.seenAdd[kk].at) seenDates.push(userState.seenAdd[kk].at); }

  // per-show last activity date (latest seenAt across baseline + user additions)
  const showLast = {};
  for (const r of DATA.seen || []) {
    if (r.showId == null || r.showId === '') continue;
    const sk = r.showId;
    const kk = epKey(sk, r.season, r.number);
    if (userState.seenRemove[kk]) continue;
    if (r.seenAt && (!showLast[sk] || r.seenAt > showLast[sk])) showLast[sk] = r.seenAt;
  }
  for (const [kk, v] of Object.entries(userState.seenAdd)) {
    const sk = kk.split('|')[0];
    const at = v && v.at;
    if (at && (!showLast[sk] || at > showLast[sk])) showLast[sk] = at;
  }
  for (const sh of shows.values()) sh.lastSeenAt = showLast[sh.key] || null;

  // emotions/reactions (baseline overlaid by user). TV Time's "star-meter"
  // votes (episodeRatings) are reactions too, so fold them into the reactions.
  const emotionMap = new Map();
  for (const r of DATA.emotions || []) emotionMap.set(keyFromRecord(r), String(r.emotionId));
  for (const r of DATA.episodeRatings || []) { const k = keyFromRecord(r); if (r.rating != null && r.rating !== '' && !emotionMap.has(k)) emotionMap.set(k, String(r.rating)); }
  for (const [k, v] of Object.entries(userState.emotions)) { if (v) emotionMap.set(k, v); else emotionMap.delete(k); }

  // manual episode star ratings (user-set only; TV Time stored no real star notes)
  const ratingMap = new Map();
  for (const [k, v] of Object.entries(userState.ratings)) { if (v) ratingMap.set(k, v); else ratingMap.delete(k); }

  // rewatch counts (baseline from DATA.rewatched, overlaid by user)
  const rewatchMap = new Map();
  for (const r of DATA.rewatched || []) {
    const c = parseInt(r.count, 10);
    if (c > 0) rewatchMap.set(epKey((r.showId || ('n:' + r.showName)), r.season, r.number), c);
  }
  for (const [k, v] of Object.entries(userState.rewatch || {})) {
    const c = parseInt(v, 10);
    if (c > 0) rewatchMap.set(k, c); else rewatchMap.delete(k);
  }

  MODEL = {
    shows,
    seenCount: baselineSeen.size,
    seenDates,
    emotionMap,
    ratingMap,
    rewatchMap,
  };
  return MODEL;
}

// Remap a show's imported seen episodes onto TMDB's season numbering by absolute
// order. Only when TV Time used more seasons than TMDB (arc-based anime splits).
// Non-destructive (in-memory) and idempotent: once keys are in TMDB coords the
// season structure matches and this becomes a no-op.
function alignSeenToTmdb(sh, meta) {
  const tmdbSeasons = (meta.seasons || []).filter(s => s.n > 0).sort((a, b) => a.n - b.n);
  if (!tmdbSeasons.length) return;
  // Flatten TMDB episodes in aired order. Use their REAL episode numbers when the
  // season lists are cached (anime often number continuously, e.g. season 2 = ep
  // 33..53); otherwise fall back to 1..count.
  const allCached = tmdbSeasons.every(se => (tmdbCache.seasons[meta.id + '|' + se.n] || []).length);
  const flat = []; const valid = new Set();
  for (const se of tmdbSeasons) {
    if (allCached) { for (const e of tmdbCache.seasons[meta.id + '|' + se.n]) { flat.push(se.n + '|' + e.n); valid.add(se.n + '|' + e.n); } }
    else { for (let n = 1; n <= se.count; n++) { flat.push(se.n + '|' + n); valid.add(se.n + '|' + n); } }
  }
  // Already (mostly) aligned with the displayed episodes? -> leave it (idempotent).
  let mapped = 0, total = 0;
  for (const k of sh.seenKeys) {
    const p = k.split('|'); const S = +p[p.length - 2], N = +p[p.length - 1];
    if (S <= 0) continue;
    total++;
    if (valid.has(S + '|' + N)) mapped++;
  }
  if (!total || mapped / total >= 0.85) return;
  // Absolute-order remap: the k-th watched episode (by TV Time season/number)
  // becomes the k-th TMDB episode.
  const tvSize = {};
  for (const k of sh.seenKeys) {
    const p = k.split('|'); const S = +p[p.length - 2], N = +p[p.length - 1];
    if (S <= 0) continue;
    tvSize[S] = Math.max(tvSize[S] || 0, N);
  }
  const tvSeasons = Object.keys(tvSize).map(Number).sort((a, b) => a - b);
  const tvOffset = {}; let acc = 0;
  for (const s of tvSeasons) { tvOffset[s] = acc; acc += tvSize[s]; }
  const out = new Set();
  for (const k of sh.seenKeys) {
    const p = k.split('|'); const S = +p[p.length - 2], N = +p[p.length - 1];
    if (S <= 0) { out.add(k); continue; }
    const t = flat[tvOffset[S] + N - 1];
    out.add(t ? (sh.key + '|' + t) : k);
  }
  sh.seenKeys = out;
}



//////////////////////// TMDB ////////////////////////
function hasKey() { return !!userState.tmdbKey; }

async function tmdbFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TMDB}${path}${sep}api_key=${encodeURIComponent(userState.tmdbKey)}&language=fr-FR`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}

async function resolveTmdbId(tvdbId) {
  if (!tvdbId) return null;
  if (tvdbId in tmdbCache.map) return tmdbCache.map[tvdbId];
  try {
    const res = await tmdbFetch(`/find/${tvdbId}?external_source=tvdb_id`);
    const hit = (res.tv_results && res.tv_results[0]) || null;
    tmdbCache.map[tvdbId] = hit ? hit.id : null;
  } catch { tmdbCache.map[tvdbId] = null; }
  scheduleSaveCache();
  return tmdbCache.map[tvdbId];
}

async function getSeasonEpisodes(tmdbId, seasonNumber) {
  const ck = tmdbId + '|' + seasonNumber;
  if (tmdbCache.seasons[ck]) return tmdbCache.seasons[ck];
  const d = await tmdbFetch(`/tv/${tmdbId}/season/${seasonNumber}`);
  const eps = (d.episodes || []).map(e => ({
    n: e.episode_number, name: e.name, air: e.air_date,
    runtime: e.runtime, still: e.still_path, overview: e.overview,
  }));
  tmdbCache.seasons[ck] = eps; scheduleSaveCache();
  return eps;
}

async function getShowMeta(tmdbId, force) {
  if (!force && tmdbCache.shows[tmdbId] && tmdbCache.shows[tmdbId].cast) return tmdbCache.shows[tmdbId];
  const d = await tmdbFetch(`/tv/${tmdbId}?append_to_response=credits,videos,watch/providers`);
  const meta = {
    id: tmdbId, name: d.name, poster: d.poster_path, backdrop: d.backdrop_path,
    overview: d.overview, firstAir: d.first_air_date, status: d.status,
    runtime: (d.episode_run_time && d.episode_run_time[0]) || null,
    genres: (d.genres || []).map(g => g.name),
    seasons: (d.seasons || []).filter(s => s.season_number > 0).map(s => ({ n: s.season_number, count: s.episode_count })),
    totalEpisodes: d.number_of_episodes,
    lastAir: (d.last_episode_to_air && d.last_episode_to_air.air_date) || null,
    nextAir: (d.next_episode_to_air && d.next_episode_to_air.air_date) || null,
    vote: d.vote_average || null, voteCount: d.vote_count || 0,
    cast: extractCast(d.credits),
    trailer: pickTrailer(d.videos),
    providers: extractProviders(d['watch/providers']),
  };
  if (!meta.trailer) meta.trailer = await trailerFallback('tv', tmdbId);
  tmdbCache.shows[tmdbId] = meta; scheduleSaveCache();
  return meta;
}

async function getMovieMeta(tmdbId, force) {
  if (!tmdbCache.movieMeta) tmdbCache.movieMeta = {};
  if (!force && tmdbCache.movieMeta[tmdbId] && tmdbCache.movieMeta[tmdbId].cast) return tmdbCache.movieMeta[tmdbId];
  const d = await tmdbFetch(`/movie/${tmdbId}?append_to_response=credits,videos,watch/providers`);
  const meta = {
    id: tmdbId, title: d.title, poster: d.poster_path, backdrop: d.backdrop_path,
    overview: d.overview, release: d.release_date, runtime: d.runtime,
    genres: (d.genres || []).map(g => g.name), vote: d.vote_average || null,
    voteCount: d.vote_count || 0, tagline: d.tagline,
    cast: extractCast(d.credits),
    trailer: pickTrailer(d.videos),
    providers: extractProviders(d['watch/providers']),
  };
  if (!meta.trailer) meta.trailer = await trailerFallback('movie', tmdbId);
  tmdbCache.movieMeta[tmdbId] = meta; scheduleSaveCache();
  return meta;
}

// --- extract enrichment sub-objects from a TMDB response ---
function extractCast(credits) {
  return ((credits && credits.cast) || []).slice(0, 18)
    .map(c => ({ name: c.name, character: c.character || '', profile: c.profile_path || null }));
}
function pickTrailer(videos) {
  const r = (videos && videos.results) || [];
  const yt = r.filter(v => v.site === 'YouTube');
  const best = yt.find(v => v.type === 'Trailer' && v.official)
    || yt.find(v => v.type === 'Trailer')
    || yt.find(v => v.type === 'Teaser') || yt[0];
  return best ? best.key : null;
}
async function trailerFallback(kind, id) {
  try { return pickTrailer(await tmdbFetch(`/${kind}/${id}/videos?language=en-US`)); }
  catch { return null; }
}
function extractProviders(wp) {
  const fr = wp && wp.results && wp.results.FR;
  if (!fr) return null;
  const uniq = (arr) => { const seen = {}, out = []; for (const p of arr || []) { if (!seen[p.provider_id]) { seen[p.provider_id] = 1; out.push({ name: p.provider_name, logo: p.logo_path }); } } return out; };
  const flat = uniq((fr.flatrate || []).concat(fr.free || [], fr.ads || []));
  const rent = uniq(fr.rent), buy = uniq(fr.buy);
  if (!flat.length && !rent.length && !buy.length) return null;
  return { link: fr.link || null, flatrate: flat, rent, buy };
}

function movieRatingOf(m) {
  // ma note manuelle uniquement ; les codes importés de TV Time sont des réactions, pas des étoiles
  const o = userState.movieRatings && userState.movieRatings[m.name];
  const n = parseInt(o, 10);
  return isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
}
function setMovieRating(name, rating) {
  if (!userState.movieRatings) userState.movieRatings = {};
  userState.movieRatings[name] = rating;
  scheduleSaveState();
}
function movieEmotionOf(m) {
  const o = userState.movieEmotions && userState.movieEmotions[m.name];
  if (o !== undefined) return o || null; // '' = réaction effacée
  return (m.rating != null && m.rating !== '') ? String(m.rating) : null; // import TV Time
}
function setMovieEmotion(m, emotionId) {
  if (!userState.movieEmotions) userState.movieEmotions = {};
  const cur = movieEmotionOf(m);
  userState.movieEmotions[m.name] = (cur === emotionId) ? '' : emotionId;
  scheduleSaveState();
}
function movieWatchedOf(m) {
  return (userState.movieWatchedAt && userState.movieWatchedAt[m.name]) || m.watchedAt || null;
}

//////////////////////// Favorites ////////////////////////
function isFavShow(sh) {
  const o = userState.favShows && userState.favShows[sh.key];
  return (o === undefined || o === null) ? !!sh.favorited : !!o;
}
function toggleFavShow(sh) {
  if (!userState.favShows) userState.favShows = {};
  userState.favShows[sh.key] = !isFavShow(sh);
  scheduleSaveState();
}
function isFavMovie(m) {
  const o = userState.favMovies && userState.favMovies[m.name];
  return (o === undefined || o === null) ? !!m.favorited : !!o;
}
function toggleFavMovie(m) {
  if (!userState.favMovies) userState.favMovies = {};
  userState.favMovies[m.name] = !isFavMovie(m);
  scheduleSaveState();
}

//////////////////////// User lists ////////////////////////
function getUserLists() {
  if (!Array.isArray(userState.userLists)) userState.userLists = [];
  return userState.userLists;
}
function createList(name) {
  const l = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: (name || 'Nouvelle liste').trim() || 'Nouvelle liste', shows: [], movies: [] };
  getUserLists().push(l); scheduleSaveState(); return l;
}
function renameList(id, name) { const l = getUserLists().find(x => x.id === id); if (l) { l.name = (name || '').trim() || l.name; scheduleSaveState(); } }
function deleteList(id) { userState.userLists = getUserLists().filter(x => x.id !== id); scheduleSaveState(); }
function listToggleShow(id, key) {
  const l = getUserLists().find(x => x.id === id); if (!l) return;
  if (!Array.isArray(l.shows)) l.shows = [];
  if (l.shows.includes(key)) l.shows = l.shows.filter(k => k !== key); else l.shows.push(key);
  scheduleSaveState();
}
function listToggleMovie(id, name) {
  const l = getUserLists().find(x => x.id === id); if (!l) return;
  if (!Array.isArray(l.movies)) l.movies = [];
  if (l.movies.includes(name)) l.movies = l.movies.filter(n => n !== name); else l.movies.push(name);
  scheduleSaveState();
}

// Modal to add a show or a movie to one or more user lists.
function openAddToListModal(kind, ref) {
  const isMovie = kind === 'movie';
  const id = isMovie ? ref.name : ref.key;
  const draw = () => {
    const lists = getUserLists();
    const rows = lists.length ? lists.map(l => {
      const has = isMovie ? (l.movies || []).includes(id) : (l.shows || []).includes(id);
      return `<label class="check-row"><input type="checkbox" data-list="${esc(l.id)}" ${has ? 'checked' : ''}> ${esc(l.name)} <span class="sub" style="margin-left:auto">${(l.shows || []).length + (l.movies || []).length}</span></label>`;
    }).join('') : `<p class="hint" style="color:var(--muted)">Aucune liste. Créez-en une ci-dessous.</p>`;
    showModal(`<h2>Ajouter à une liste</h2>
      <p class="sub">${esc(isMovie ? ref.name : displayName(ref))}</p>
      <div class="modal-fields" style="max-height:40vh;overflow:auto">${rows}</div>
      <label class="field"><span>Nouvelle liste</span><div style="display:flex;gap:8px"><input class="input" id="newListName" placeholder="Nom de la liste"><button class="btn" id="newListGo">Créer</button></div></label>
      <div class="row"><button class="btn primary" data-close>Terminé</button></div>`,
      (root) => {
        root.querySelectorAll('[data-list]').forEach(c => c.onchange = () => {
          if (isMovie) listToggleMovie(c.dataset.list, id); else listToggleShow(c.dataset.list, id);
        });
        root.querySelector('#newListGo').onclick = () => {
          const name = root.querySelector('#newListName').value.trim();
          if (!name) { toast('Nom requis'); return; }
          const l = createList(name);
          if (isMovie) listToggleMovie(l.id, id); else listToggleShow(l.id, id);
          draw();
        };
      });
  };
  draw();
}


// First / last personal watch dates for a series (from imported + user-added seen).
function showWatchDates(sh) {
  const dates = [];
  for (const r of DATA.seen || []) {
    const sk = r.showId || ('n:' + r.showName);
    if (sk !== sh.key) continue;
    const kk = epKey(sk, r.season, r.number);
    if (userState.seenRemove[kk]) continue;
    if (r.seenAt) dates.push(r.seenAt);
  }
  for (const [kk, v] of Object.entries(userState.seenAdd)) {
    if (kk.split('|')[0] === sh.key && v && v.at) dates.push(v.at);
  }
  dates.sort();
  return { first: dates[0] || null, last: dates[dates.length - 1] || null, count: dates.length };
}

// --- "À propos" section shared by the show & movie detail pages ---
function infoRow(label, value) {
  if (!value) return '';
  return `<div class="info-row"><span class="info-label">${esc(label)}</span><span class="info-value">${value}</span></div>`;
}
function providersHtml(p) {
  if (!p) return '';
  const grp = (title, arr) => arr && arr.length
    ? `<div class="prov-group"><span class="prov-title">${title}</span><div class="prov-logos">${arr.map(x => `<span class="prov-chip" title="${esc(x.name)}">${x.logo ? `<img src="${IMG(x.logo, 'w92')}" alt="${esc(x.name)}">` : ''}<span>${esc(x.name)}</span></span>`).join('')}</div></div>`
    : '';
  const body = grp('Streaming', p.flatrate) + grp('Location', p.rent) + grp('Achat', p.buy);
  if (!body) return '';
  return `<div class="about-block"><h3>Où regarder <span class="src">(FR)</span></h3>${body}${p.link ? `<a class="btn ghost sm" href="${esc(p.link)}" target="_blank" rel="noopener">Voir sur JustWatch ↗</a>` : ''}</div>`;
}
function castHtml(cast) {
  if (!cast || !cast.length) return '';
  return `<div class="about-block"><h3>Distribution</h3><div class="cast-list">${cast.map(c => `
    <div class="cast-item">
      <div class="cast-photo">${c.profile ? `<img loading="lazy" src="${IMG(c.profile, 'w185')}" alt="">` : `<span>${esc((c.name || '?').slice(0, 1))}</span>`}</div>
      <div class="cast-name">${esc(c.name)}</div>
      ${c.character ? `<div class="cast-char">${esc(c.character)}</div>` : ''}
    </div>`).join('')}</div></div>`;
}
function trailerHtml(key) {
  if (!key) return '';
  return `<div class="about-block"><h3>Bande-annonce</h3><div class="trailer" data-yt="${esc(key)}"><button class="trailer-play" type="button">▶ Lire la bande-annonce</button></div></div>`;
}
function wireTrailer(el) {
  el.querySelectorAll('.trailer').forEach(box => {
    const btn = box.querySelector('.trailer-play');
    if (!btn) return;
    btn.onclick = () => {
      const k = box.dataset.yt;
      box.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(k)}?autoplay=1" title="Bande-annonce" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
    };
  });
}
function wireTabs(el) {
  const tabs = el.querySelectorAll('.detail-tabs .tab');
  const panels = el.querySelectorAll('.tab-panel');
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => x.classList.toggle('active', x === t));
    panels.forEach(p => p.classList.toggle('active', p.dataset.panel === t.dataset.tab));
  });
}

function fmtFull(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return esc(s);
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}
function statusFr(s) {
  const map = { 'Returning Series': 'En cours', 'Ended': 'Terminée', 'Canceled': 'Annulée', 'Cancelled': 'Annulée', 'In Production': 'En production', 'Post Production': 'En post-production', 'Planned': 'Prévue', 'Pilot': 'Pilote' };
  return map[s] || s;
}
function infoBlock(rows) {
  return rows ? `<div class="about-block info-block">${rows}</div>` : '';
}
function showAboutHtml(sh, meta) {
  const wd = showWatchDates(sh);
  const seen = sh.seenKeys.size;
  const watchInfo = seen
    ? `${seen} épisode(s) vu(s)` + (wd.first ? ` · du ${fmtFull(wd.first)}` + (wd.last && wd.last !== wd.first ? ` au ${fmtFull(wd.last)}` : '') : '')
    : '';
  const rows = [
    infoRow('Genre', meta.genres.length ? esc(meta.genres.join(', ')) : ''),
    infoRow('Première diffusion', meta.firstAir ? fmtFull(meta.firstAir) : ''),
    infoRow('Statut', meta.status ? esc(statusFr(meta.status)) : ''),
    infoRow('Épisodes', meta.totalEpisodes ? `${sh.seenKeys.size} vus / ${meta.totalEpisodes}` : (sh.seenKeys.size ? `${sh.seenKeys.size} vus` : '')),
    infoRow('Note du public', meta.vote ? `⭐ ${meta.vote.toFixed(1)}/10 <span class="muted">(${meta.voteCount})</span>` : ''),
    infoRow('Ma note', starsHtml('aboutShowRate', sh.showRating || 0)),
    infoRow('Mes visionnages', watchInfo),
  ].join('');
  return `<div class="about">${infoBlock(rows)}${providersHtml(meta.providers)}${castHtml(meta.cast)}${trailerHtml(meta.trailer)}</div>`;
}
function movieAboutHtml(m, meta) {
  const rt = (meta && meta.runtime) || m.runtime;
  const watchedAt = movieWatchedOf(m);
  const watchInfo = movieStatus(m) === 'watched'
    ? (watchedAt ? `Vu le ${fmtFull(watchedAt)}` : 'Vu (date non enregistrée)')
    : '';
  const rows = [
    infoRow('Genre', meta && meta.genres.length ? esc(meta.genres.join(', ')) : ''),
    infoRow('Sortie', meta && meta.release ? fmtFull(meta.release) : (movieYear(m) ? esc(movieYear(m)) : '')),
    infoRow('Durée', rt ? `${Math.floor(rt / 60)}h${String(rt % 60).padStart(2, '0')}` : ''),
    infoRow('Note du public', meta && meta.vote ? `⭐ ${meta.vote.toFixed(1)}/10 <span class="muted">(${meta.voteCount})</span>` : ''),
    infoRow('Ma note', starsHtml('aboutMovieRate', movieRatingOf(m))),
    infoRow('Mon visionnage', watchInfo),
  ].join('');
  return `<div class="about">${infoBlock(rows)}${providersHtml(meta && meta.providers)}${castHtml(meta && meta.cast)}${trailerHtml(meta && meta.trailer)}</div>`;
}

//////////////////////// Toggle actions ////////////////////////
function isSeen(sh, season, number) { return sh.seenKeys.has(epKey(sh.key, season, number)); }

function toggleSeen(sh, season, number, seen) {
  const k = epKey(sh.key, season, number);
  const currentlySeen = sh.seenKeys.has(k);
  const target = seen != null ? seen : !currentlySeen;
  if (target) {
    sh.seenKeys.add(k);
    sh.followed = true; // marquer un épisode vu suit automatiquement la série
    if (userState.seenRemove[k]) delete userState.seenRemove[k];
    else userState.seenAdd[k] = { at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
  } else {
    sh.seenKeys.delete(k);
    if (userState.seenAdd[k]) delete userState.seenAdd[k];
    else userState.seenRemove[k] = true;
  }
  scheduleSaveState();
  MODEL.seenCount = computeSeenCount();
}
function computeSeenCount() {
  let c = 0; for (const sh of MODEL.shows.values()) c += sh.seenKeys.size; return c;
}
function setRating(sh, season, number, rating) {
  const k = epKey(sh.key, season, number);
  const cur = MODEL.ratingMap.get(k);
  if (cur === rating) { MODEL.ratingMap.delete(k); userState.ratings[k] = 0; }
  else { MODEL.ratingMap.set(k, rating); userState.ratings[k] = rating; }
  scheduleSaveState();
}
function setEmotion(sh, season, number, emotionId) {
  const k = epKey(sh.key, season, number);
  const cur = MODEL.emotionMap.get(k);
  if (cur === emotionId) { MODEL.emotionMap.delete(k); userState.emotions[k] = ''; }
  else { MODEL.emotionMap.set(k, emotionId); userState.emotions[k] = emotionId; }
  scheduleSaveState();
}
function setShowRating(sh, rating) {
  sh.showRating = (sh.showRating === rating) ? null : rating;
  userState.showRatings[sh.key] = sh.showRating || 0;
  scheduleSaveState();
}
// Rewatch counts (number of *extra* views beyond the first). Total views = count + 1.
function rewatchOf(sh, season, number) {
  return MODEL.rewatchMap.get(epKey(sh.key, season, number)) || 0;
}
function setRewatch(sh, season, number, count) {
  const k = epKey(sh.key, season, number);
  const c = Math.max(0, count | 0);
  if (c > 0) { MODEL.rewatchMap.set(k, c); userState.rewatch[k] = c; }
  else { MODEL.rewatchMap.delete(k); userState.rewatch[k] = 0; }
  // A rewatch implies the episode was seen at least once.
  if (c > 0 && !isSeen(sh, season, number)) toggleSeen(sh, season, number, true);
  scheduleSaveState();
}
function movieRewatchOf(m) {
  const o = userState.movieRewatch && userState.movieRewatch[m.name];
  const c = (o != null) ? parseInt(o, 10) : parseInt(m.rewatchCount, 10);
  return c > 0 ? c : 0;
}
function setMovieRewatch(name, count) {
  if (!userState.movieRewatch) userState.movieRewatch = {};
  userState.movieRewatch[name] = Math.max(0, count | 0);
  scheduleSaveState();
}function toggleWatchlist(sh) {
  if (userState.watchlist[sh.key]) delete userState.watchlist[sh.key];
  else userState.watchlist[sh.key] = true;
  scheduleSaveState();
}
function toggleArchived(sh) {
  sh.archived = !sh.archived;
  userState.archived[sh.key] = sh.archived;
  scheduleSaveState();
}
function isPinnedWatching(sh) {
  return !!(userState.pinnedWatching && userState.pinnedWatching[sh.key]);
}
function togglePinWatching(sh) {
  if (!userState.pinnedWatching) userState.pinnedWatching = {};
  if (userState.pinnedWatching[sh.key]) delete userState.pinnedWatching[sh.key];
  else userState.pinnedWatching[sh.key] = true;
  scheduleSaveState();
}

//////////////////////// Custom (user-added) episodes ////////////////////////
function customEpsForShow(sh) {
  return (userState.customEpisodes && userState.customEpisodes[sh.key]) || [];
}
function addCustomEpisode(sh, season, number, name) {
  if (!userState.customEpisodes) userState.customEpisodes = {};
  const arr = userState.customEpisodes[sh.key] || (userState.customEpisodes[sh.key] = []);
  if (arr.some(e => e.s === season && e.n === number)) return false;
  arr.push({ s: season, n: number, name: name || '' });
  scheduleSaveState();
  return true;
}
function removeCustomEpisode(sh, season, number) {
  const arr = userState.customEpisodes && userState.customEpisodes[sh.key];
  if (arr) {
    const i = arr.findIndex(e => e.s === season && e.n === number);
    if (i >= 0) { arr.splice(i, 1); scheduleSaveState(); }
  }
  if (isSeen(sh, season, number)) toggleSeen(sh, season, number, false);
}

//////////////////////// Router ////////////////////////
const routes = {};
function route(name, fn) { routes[name] = fn; }
function currentRoute() { return (location.hash || '#/library').slice(2); }
// Remember where the user came from so "retour" on a show goes back to that
// list (home / library / à suivre …) at the same scroll position.
let backTarget = '#/home';
let lastShowKey = null;   // last opened show key (to auto-scroll to first unseen only on a fresh open)
let homeEditOrder = false; // when true, the Séries section reorder arrows are shown
let seriesTab = 'avoir';   // Séries page sub-tab: 'avoir' (categorised) | 'asuivre' (next episodes)
let exploreQuery = '';     // texte de recherche Explorer mémorisé (restauré au retour d'un aperçu)
const scrollByHash = {};
function openShow(key) {
  scrollByHash[location.hash || '#/home'] = window.scrollY;
  location.hash = '#/show/' + encodeURIComponent(key);
}
function openMovie(name) {
  scrollByHash[location.hash || '#/movies'] = window.scrollY;
  location.hash = '#/movie/' + encodeURIComponent(name);
}
const BACK_LABELS = { home: 'Séries', library: 'Bibliothèque', upnext: 'À suivre', explore: 'Explorer', movies: 'Films', lists: 'Listes', stats: 'Statistiques', profile: 'Profil', settings: 'Réglages', changelog: 'Notes de version' };
function backLabel() { return BACK_LABELS[(backTarget || '').replace(/^#\//, '').split('/')[0]] || 'Retour'; }

// Basic slide transition when moving from one main category to another.
let _lastTopRoute = null;
function _makeSnapshot() {
  const el = document.getElementById('app');
  const sy = window.scrollY;
  const snap = el.cloneNode(true);
  snap.removeAttribute('id');
  snap.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  snap.classList.add('page-snap');
  snap.style.transform = `translate(0, ${-sy}px)`;
  document.body.appendChild(snap);
  return { snap, sy };
}
function _runSlide(el, snapObj, dir) {
  const { snap, sy } = snapObj;
  const from = dir > 0 ? '100%' : '-100%';   // new page enters from this side
  const to = dir > 0 ? '-100%' : '100%';     // old page leaves to this side
  const dur = 240;
  el.classList.add('page-anim');
  el.style.transition = 'none';
  el.style.transform = `translateX(${from})`;
  void el.offsetWidth;                        // flush the start position
  el.style.transition = `transform ${dur}ms ease`;
  el.style.transform = 'translateX(0)';
  snap.style.transition = `transform ${dur}ms ease`;
  snap.style.transform = `translate(${to}, ${-sy}px)`;
  setTimeout(() => {
    el.style.transition = ''; el.style.transform = ''; el.classList.remove('page-anim');
    snap.remove();
  }, dur + 40);
}
async function render() {
  document.querySelectorAll('.page-snap').forEach(n => n.remove()); // safety: never leave a frozen page behind
  const [name, ...rest] = currentRoute().split('/');
  if (name !== 'show' && name !== 'movie') backTarget = location.hash || '#/home';
  if (name !== 'show') lastShowKey = null; // re-opening a show counts as a fresh visit
  // Library / stats / lists / settings live under the "Profil" tab.
  const navName = ['library', 'stats', 'lists', 'settings', 'changelog'].includes(name) ? 'profile' : (name === 'preview' ? 'explore' : name);
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === navName));
  // Direction of the slide, only between the four main categories.
  const newTop = SWIPE_ROUTES.includes(name) ? name : null;
  let dir = 0;
  if (_lastTopRoute && newTop && _lastTopRoute !== newTop) {
    dir = SWIPE_ROUTES.indexOf(newTop) > SWIPE_ROUTES.indexOf(_lastTopRoute) ? 1 : -1;
  }
  _lastTopRoute = newTop;
  const el = document.getElementById('app');
  el.style.transition = ''; el.style.transform = ''; el.classList.remove('page-anim');
  const snapObj = dir !== 0 ? _makeSnapshot() : null;
  const fn = routes[name] || routes['library'];
  el.innerHTML = '<div class="loading">Chargement…</div>';
  try { await fn(el, rest); } catch (e) { el.innerHTML = `<div class="empty"><div class="big">⚠️</div>${esc(e.message)}</div>`; }
  const saved = scrollByHash[location.hash];
  window.scrollTo(0, name !== 'show' && name !== 'movie' && saved ? saved : 0);
  if (snapObj) _runSlide(el, snapObj, dir);
}
window.addEventListener('hashchange', render);

//////////////////////// Poster helper ////////////////////////
// Manual TMDB match override for a show (chosen via the "search poster" modal).
function overrideShowTmdb(sh) {
  if (sh && sh.forcedTmdb) return sh.forcedTmdb;
  const m = userState.showTmdb || {};
  const v = m[showKey(sh)];
  return (v != null && v !== '') ? v : null;
}
async function ensurePoster(sh) {
  // returns {poster, tmdbId, meta?} using cache; triggers resolve if key present
  if (!hasKey()) return { poster: null, tmdbId: null };
  let tmdbId = overrideShowTmdb(sh);
  if (!tmdbId) {
    if (!sh.tvdbId) return { poster: null, tmdbId: null };
    tmdbId = await resolveTmdbId(sh.tvdbId);
  }
  if (!tmdbId) return { poster: null, tmdbId: null };
  let meta = tmdbCache.shows[tmdbId];
  if (!meta) { try { meta = await getShowMeta(tmdbId); } catch {} }
  return { poster: meta ? meta.poster : null, tmdbId, meta };
}
function posterHtml(sh, posterPath) {
  if (posterPath) return `<img loading="lazy" src="${IMG(posterPath)}" alt="">`;
  return `<div class="fallback-title">${esc(displayName(sh))}</div>`;
}

// Some exported shows have an empty name; fall back to the cached TMDB name, then a placeholder.
function cachedTmdbName(sh) {
  if (sh.tvdbId != null && (sh.tvdbId in tmdbCache.map)) {
    const id = tmdbCache.map[sh.tvdbId];
    const meta = id && tmdbCache.shows[id];
    if (meta && meta.name) return meta.name;
  }
  return '';
}
function displayName(sh) {
  // Préfère le titre TMDB localisé (français) quand il est en cache, sinon le nom importé.
  return cachedTmdbName(sh) || (sh.name && sh.name.trim()) || 'Série sans titre';
}
// Titre français d'un film si connu (depuis le cache TMDB), sinon le nom importé.
function movieDisplayName(m) {
  const rec = tmdbCache.movies && tmdbCache.movies[m.name];
  if (rec && rec.title) return rec.title;
  const id = rec && rec.id;
  if (id && tmdbCache.movieMeta && tmdbCache.movieMeta[id] && tmdbCache.movieMeta[id].title) return tmdbCache.movieMeta[id].title;
  return m.name;
}
function userDisplayName() {
  return (userState.profileName && userState.profileName.trim()) || DATA.user?.name || '';
}
// Names a show can be found by: its stored (export) title AND the cached TMDB
// localized title (e.g. "Murder Mindfully" is also findable as "Les Meurtres zen").
function searchNames(sh) {
  const out = [];
  if (sh.name && sh.name.trim()) out.push(sh.name.toLowerCase());
  const t = cachedTmdbName(sh);
  if (t && t.toLowerCase() !== (sh.name || '').toLowerCase()) out.push(t.toLowerCase());
  return out.length ? out : ['série sans titre'];
}

//////////////////////// Poster search (manual TMDB match) ////////////////////////
// Persist a chosen TMDB match for a show and mirror it into the cache so every
// existing lookup (resolveTmdbId, cachedTmdbName, metaFor) picks it up.
function setShowTmdb(sh, tmdbId) {
  if (!userState.showTmdb) userState.showTmdb = {};
  userState.showTmdb[showKey(sh)] = tmdbId;
  if (sh.tvdbId != null) tmdbCache.map[sh.tvdbId] = tmdbId;
  scheduleSaveState(); scheduleSaveCache();
}
function setMovieTmdb(name, hit) {
  if (!userState.movieTmdb) userState.movieTmdb = {};
  const rec = { id: hit.id, poster: hit.poster_path || hit.poster || null };
  userState.movieTmdb[name] = rec;
  if (!tmdbCache.movies) tmdbCache.movies = {};
  tmdbCache.movies[name] = rec;
  scheduleSaveState(); scheduleSaveCache();
}
// Re-apply saved overrides into the metadata cache at boot (cache may be older).
function applyTmdbOverrides() {
  for (const [k, id] of Object.entries(userState.showTmdb || {})) {
    if (id != null && !String(k).startsWith('n:')) tmdbCache.map[k] = id;
  }
  if (!tmdbCache.movies) tmdbCache.movies = {};
  for (const [name, rec] of Object.entries(userState.movieTmdb || {})) {
    if (rec) tmdbCache.movies[name] = rec;
  }
}

// Shared TMDB search modal. Searches /search/tv or /search/movie and calls
// onPick(hit) when the user selects a result. Returns raw TMDB hit objects.
function tmdbSearchModal({ title, hint, kind, initial, onPick }) {
  if (!hasKey()) { toast('Ajoutez une clé TMDB (Réglages) pour rechercher.'); return; }
  showModal(`
    <h2>${esc(title)}</h2>
    <p class="hint" style="color:var(--muted)">${esc(hint)}</p>
    <div class="modal-fields" style="flex-direction:row;gap:8px">
      <input class="input" id="psQ" style="flex:1" value="${esc(initial || '')}" placeholder="Titre à rechercher…">
      <button class="btn primary" id="psGo">Rechercher</button>
    </div>
    <div id="psResults" class="poster-search"></div>
    <div class="row"><button class="btn ghost" data-close>Fermer</button></div>
  `, (root) => {
    const q = root.querySelector('#psQ');
    const results = root.querySelector('#psResults');
    let hits = [];
    const run = async () => {
      const term = q.value.trim();
      if (!term) return;
      results.innerHTML = `<div class="loading">Recherche…</div>`;
      try {
        const path = kind === 'tv'
          ? `/search/tv?query=${encodeURIComponent(term)}`
          : `/search/movie?query=${encodeURIComponent(term)}`;
        const res = await tmdbFetch(path);
        hits = (res.results || []).slice(0, 12);
        if (!hits.length) { results.innerHTML = `<div class="empty">Aucun résultat.</div>`; return; }
        results.innerHTML = hits.map((h, i) => {
          const t = esc(h.name || h.title || '');
          const date = (h.first_air_date || h.release_date || '').slice(0, 4);
          const img = h.poster_path
            ? `<img loading="lazy" src="${IMG(h.poster_path, 'w185')}" alt="">`
            : `<div class="fallback-title">${t}</div>`;
          return `<button class="ps-hit" data-idx="${i}">
            <div class="ps-poster">${img}</div>
            <div class="ps-name">${t}${date ? ` <span>(${date})</span>` : ''}</div>
          </button>`;
        }).join('');
        results.querySelectorAll('.ps-hit').forEach(b => {
          b.onclick = () => onPick(hits[parseInt(b.dataset.idx, 10)]);
        });
      } catch { results.innerHTML = `<div class="empty">Erreur de recherche.</div>`; }
    };
    root.querySelector('#psGo').onclick = run;
    q.onkeydown = (e) => { if (e.key === 'Enter') run(); };
    q.focus(); q.select();
    if (initial) run();
  });
}

// Search TMDB to fix / choose the poster (manual match) for an existing show/movie.
// kind: 'tv' (pass sh) or 'movie' (pass movie object).
function openPosterSearch(kind, ref) {
  tmdbSearchModal({
    title: 'Chercher une affiche',
    hint: `Sélectionnez le bon ${kind === 'tv' ? 'programme' : 'film'} : l'affiche et le nom seront enregistrés.`,
    kind,
    initial: kind === 'tv' ? displayName(ref) : ref.name,
    onPick: async (hit) => {
      if (kind === 'tv') {
        setShowTmdb(ref, hit.id);
        try { await getShowMeta(hit.id, true); } catch {}
      } else {
        setMovieTmdb(ref.name, hit);
      }
      toast('Affiche enregistrée');
      closeModal(); render();
    },
  });
}

// Add a brand-new show or movie (not in the export) to watch in the future.
function openAddCatalog(kind) {
  tmdbSearchModal({
    title: kind === 'tv' ? 'Ajouter une série' : 'Ajouter un film',
    hint: kind === 'tv'
      ? 'Recherchez une série à regarder plus tard : elle apparaîtra dans « Pas commencée ».'
      : 'Recherchez un film à regarder plus tard : il apparaîtra dans « À voir ».',
    kind,
    initial: '',
    onPick: async (hit) => {
      if (kind === 'tv') addCustomShow(hit); else addCustomMovie(hit);
      closeModal();
      location.hash = kind === 'tv' ? '#/home' : '#/movies';
      render();
    },
  });
}

function addCustomShow(hit) {
  if (!userState.customShows) userState.customShows = [];
  if (userState.customShows.some(c => c.tmdbId === hit.id)) { toast('Série déjà ajoutée'); return; }
  const cs = { key: 'tmdb:' + hit.id, tmdbId: hit.id, name: hit.name || hit.title || '', poster: hit.poster_path || null, addedAt: new Date().toISOString() };
  userState.customShows.push(cs);
  scheduleSaveState();
  getShowMeta(hit.id, true).catch(() => {}); // prefetch meta (poster, seasons, episodes)
  toast('Série ajoutée à « Pas commencée »');
}
function removeCustomShow(key) {
  if (!userState.customShows) return;
  const i = userState.customShows.findIndex(c => (c.key || ('tmdb:' + c.tmdbId)) === key);
  if (i >= 0) { userState.customShows.splice(i, 1); scheduleSaveState(); }
}
function addCustomMovie(hit) {
  if (!userState.customMovies) userState.customMovies = [];
  const name = hit.title || hit.name || '';
  const exists = (DATA.movies || []).some(m => m.name === name) || userState.customMovies.some(m => m.name === name);
  if (exists) { toast('Film déjà présent'); return; }
  userState.customMovies.push({ name, releaseDate: hit.release_date || '', runtime: null, status: 'towatch', custom: true, addedAt: new Date().toISOString() });
  setMovieTmdb(name, hit); // stores poster + id
  scheduleSaveState();
  toast('Film ajouté à « À voir »');
}
function removeCustomMovie(name) {
  if (!userState.customMovies) return;
  const i = userState.customMovies.findIndex(m => m.name === name);
  if (i >= 0) { userState.customMovies.splice(i, 1); scheduleSaveState(); }
}

// Unified search (button in Séries / Films): finds works already in the library
// AND new results on TMDB. kind: 'tv' | 'movie'.
function openUnifiedSearch(kind) {
  if (!hasKey()) { toast('Ajoutez une clé TMDB (Réglages) pour rechercher.'); return; }
  buildModel();
  const ownedShows = Array.from(MODEL.shows.values());
  const ownedMovies = (DATA.movies || []).concat(userState.customMovies || []);
  showModal(`
    <h2>${kind === 'tv' ? '🔍 Rechercher une série' : '🔍 Rechercher un film'}</h2>
    <p class="hint" style="color:var(--muted)">Retrouvez une œuvre déjà dans votre bibliothèque ou ajoutez-en une nouvelle.</p>
    <div class="modal-fields" style="flex-direction:row;gap:8px">
      <input class="input" id="uQ" style="flex:1" placeholder="Titre à rechercher…">
      <button class="btn primary" id="uGo">Rechercher</button>
    </div>
    <div id="uResults" class="unified-search"></div>
    <div class="row"><button class="btn ghost" data-close>Fermer</button></div>
  `, (root) => {
    const q = root.querySelector('#uQ');
    const results = root.querySelector('#uResults');

    const hitCard = (img, name, date, attrs) => {
      const t = esc(name);
      const im = img ? `<img loading="lazy" src="${IMG(img, 'w185')}" alt="">` : `<div class="fallback-title">${t}</div>`;
      return `<button class="ps-hit" ${attrs}>
        <div class="ps-poster">${im}</div>
        <div class="ps-name">${t}${date ? ` <span>(${date})</span>` : ''}</div>
      </button>`;
    };

    const localMatches = (t) => {
      if (kind === 'tv') return ownedShows.filter(s => searchNames(s).some(n => n.includes(t))).slice(0, 12);
      return ownedMovies.filter(m => (m.name || '').toLowerCase().includes(t)).slice(0, 12);
    };

    let hits = [];
    const draw = async (includeTmdb) => {
      const term = q.value.trim();
      if (!term) { results.innerHTML = ''; return; }
      const locals = localMatches(term.toLowerCase());
      let html = '';
      if (locals.length) {
        html += `<div class="ps-section">Déjà dans ma bibliothèque</div><div class="ps-grid">`;
        html += locals.map(it => {
          if (kind === 'tv') {
            const poster = (metaFor(it) || {}).poster || null;
            return hitCard(poster, displayName(it), '', `data-local-key="${esc(it.key)}"`);
          }
          const rec = (tmdbCache.movies || {})[it.name];
          return hitCard(rec && rec.poster, it.name, movieYear(it), `data-local-movie="${esc(it.name)}"`);
        }).join('') + `</div>`;
      }
      html += `<div class="ps-section">Ajouter une nouvelle œuvre</div>`;
      html += includeTmdb ? `<div id="uTmdb"><div class="loading">Recherche…</div></div>`
        : `<div class="hint" style="color:var(--muted);padding:2px">Appuyez sur <b>Entrée</b> pour chercher de nouveaux titres sur TMDB.</div>`;
      results.innerHTML = html;

      results.querySelectorAll('[data-local-key]').forEach(b => b.onclick = () => { closeModal(); openShow(b.getAttribute('data-local-key')); });
      results.querySelectorAll('[data-local-movie]').forEach(b => b.onclick = () => {
        closeModal(); libFilter.kind = 'movie'; libFilter.q = b.getAttribute('data-local-movie');
        location.hash = '#/library'; render();
      });

      if (!includeTmdb) return;
      try {
        const path = kind === 'tv' ? `/search/tv?query=${encodeURIComponent(term)}` : `/search/movie?query=${encodeURIComponent(term)}`;
        const res = await tmdbFetch(path);
        hits = (res.results || []).slice(0, 12);
        const box = results.querySelector('#uTmdb');
        if (!box) return;
        if (!hits.length) { box.innerHTML = `<div class="empty">Aucun résultat.</div>`; return; }
        box.innerHTML = `<div class="ps-grid">` + hits.map((h, i) =>
          hitCard(h.poster_path, h.name || h.title || '', (h.first_air_date || h.release_date || '').slice(0, 4), `data-add="${i}"`)
        ).join('') + `</div>`;
        box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
          const h = hits[parseInt(b.getAttribute('data-add'), 10)];
          if (kind === 'tv') addCustomShow(h); else addCustomMovie(h);
          closeModal();
          location.hash = kind === 'tv' ? '#/home' : '#/movies';
          render();
        });
      } catch { const box = results.querySelector('#uTmdb'); if (box) box.innerHTML = `<div class="empty">Erreur de recherche.</div>`; }
    };

    q.oninput = () => draw(false);
    q.onkeydown = (e) => { if (e.key === 'Enter') draw(true); };
    root.querySelector('#uGo').onclick = () => draw(true);
    q.focus();
  });
}

//////////////////////// Home view ////////////////////////
const MS_DAY = 86400000;
const RECENT_DAYS = 31; // fenêtre « nouvel épisode récent » (~1 mois)
const ACTIVE_DAYS = 92; // une série vue il y a moins de ~3 mois est encore « En cours »
const NEW_EPISODE_DAYS = 120; // new episodes aired within ~4 months count as "En cours"
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const t = Date.parse(String(dateStr).replace(' ', 'T'));
  if (isNaN(t)) return Infinity;
  return (Date.now() - t) / MS_DAY;
}
function fmtAgo(dateStr) {
  const d = daysSince(dateStr);
  if (!isFinite(d)) return 'jamais';
  const n = Math.round(d);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n < 7) return `il y a ${n} j`;
  if (n < 31) return `il y a ${Math.round(n / 7)} sem.`;
  if (n < 365) return `il y a ${Math.round(n / 30)} mois`;
  return `il y a ${Math.round(n / 365)} an(s)`;
}

route('home', async (el) => {
  buildModel();
  const shows = Array.from(MODEL.shows.values());
  const archivedCount = shows.filter(s => s.archived).length;
  el.innerHTML = `
    <div class="page-head"><h1>Séries</h1>
      <div class="spacer"></div>
      ${seriesTab === 'avoir' ? `<button class="btn sm ghost ${homeEditOrder ? 'primary' : ''}" id="btnReorder">${homeEditOrder ? '✓ Terminé' : '↕ Réorganiser'}</button>
      ${archivedCount ? `<button class="btn ghost sm" id="btnArchived">⏹ Arrêtées (${archivedCount})</button>` : ''}` : ''}
    </div>
    <div class="pill-tabs" id="seriesTabs">
      <span class="chip ${seriesTab === 'avoir' ? 'active' : ''}" data-stab="avoir">📺 À voir</span>
      <span class="chip ${seriesTab === 'asuivre' ? 'active' : ''}" data-stab="asuivre">🔜 À suivre</span>
    </div>
    <div id="seriesBody"></div>`;

  el.querySelectorAll('#seriesTabs .chip').forEach(c => c.onclick = () => { seriesTab = c.dataset.stab; render(); });
  const bArch = el.querySelector('#btnArchived');
  if (bArch) bArch.onclick = () => { libFilter.kind = 'series'; libFilter.tab = 'archived'; location.hash = '#/library'; };
  const bReorder = el.querySelector('#btnReorder');
  if (bReorder) bReorder.onclick = () => { homeEditOrder = !homeEditOrder; render(); };

  const body = el.querySelector('#seriesBody');
  if (seriesTab === 'asuivre') { await renderUpnext(body); return; }
  await renderSeriesAvoir(body, shows);
});

// Categorised "À voir" view of the Séries page (En cours / Pas vu / Pas commencée / Terminée).
async function renderSeriesAvoir(el, shows) {
  const watching = [], stale = [], notStarted = [], finished = [];
  for (const s of shows) {
    if (s.archived) continue;
    const started = s.seenKeys.size > 0;
    if (!started) { if (s.followed) notStarted.push(s); continue; }
    const m = metaFor(s);
    const total = m && m.totalEpisodes > 0 ? m.totalEpisodes : 0;
    const done = total > 0 && s.seenKeys.size >= total;
    const newEp = m && m.lastAir && daysSince(m.lastAir) <= RECENT_DAYS; // épisode sorti récemment
    // Nouveaux épisodes sortis APRÈS votre dernier visionnage (nouvelle saison récente).
    const lastAirT = m && m.lastAir ? Date.parse(String(m.lastAir).replace(' ', 'T')) : NaN;
    const lastSeenT = s.lastSeenAt ? Date.parse(String(s.lastSeenAt).replace(' ', 'T')) : NaN;
    const newSinceSeen = m && m.lastAir && daysSince(m.lastAir) <= NEW_EPISODE_DAYS
      && !done && (isNaN(lastSeenT) || lastAirT > lastSeenT);
    const pinned = isPinnedWatching(s);
    if (done && !newEp && !pinned) { finished.push(s); continue; }
    if (pinned || newEp || newSinceSeen || daysSince(s.lastSeenAt) <= ACTIVE_DAYS) watching.push(s);
    else if (s.followed) stale.push(s);
  }
  watching.sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));
  stale.sort((a, b) => (a.lastSeenAt || '').localeCompare(b.lastSeenAt || ''));
  notStarted.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  finished.sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));

  // Section definitions, rendered in the user-chosen order.
  const defs = {
    watching:   { id: 'homeWatching',   icon: '▶️', title: 'En cours',                sub: 'Vue récemment (< 3 mois) ou nouvel épisode récent', list: watching,   withAgo: true },
    stale:      { id: 'homeStale',      icon: '🕰️', title: 'Pas vu depuis longtemps', sub: 'Séries suivies mises en pause',          list: stale,      withAgo: true },
    notStarted: { id: 'homeNotStarted', icon: '🆕', title: 'Pas commencée',           sub: 'Dans votre liste mais jamais démarrée', list: notStarted, withAgo: false },
    finished:   { id: 'homeFinished',   icon: '✅', title: 'Terminée',                sub: 'Vues intégralement',                    list: finished,   withAgo: true },
  };
  const order = normalizeHomeOrder(userState.homeOrder);

  const sectionHtml = (secId, pos, total) => {
    const d = defs[secId];
    return `
    <section class="home-section" data-sec="${secId}">
      <div class="home-head">
        ${homeEditOrder ? `<div class="home-order">
          <button class="ord-btn" data-move="up" data-sec="${secId}" ${pos === 0 ? 'disabled' : ''} title="Monter">▲</button>
          <button class="ord-btn" data-move="down" data-sec="${secId}" ${pos === total - 1 ? 'disabled' : ''} title="Descendre">▼</button>
        </div>` : ''}
        <h2>${d.icon} ${d.title} <span class="sec-count">${d.list.length}</span></h2>
        <button class="sec-info" title="${esc(d.sub)}" aria-label="À propos de cette catégorie">ℹ️</button>
      </div>
      ${d.list.length ? `<div class="grid" id="${d.id}"></div>` : `<p class="home-empty">Rien ici pour le moment.</p>`}
    </section>`;
  };

  el.innerHTML = order.map((secId, i) => sectionHtml(secId, i, order.length)).join('');

  el.querySelectorAll('.sec-info').forEach(b => b.onclick = () => {
    const sec = b.closest('.home-section')?.dataset.sec;
    if (sec && defs[sec]) toast(defs[sec].sub);
  });

  const fill = (id, list, withAgo) => {
    const grid = el.querySelector('#' + id);
    if (!grid) return;
    grid.innerHTML = list.map(s => cardHtml(s)).join('');
    if (withAgo) {
      grid.querySelectorAll('.show-card').forEach(c => {
        const sh = MODEL.shows.get(c.dataset.key);
        const m = c.querySelector('.meta');
        if (sh && m) m.textContent = `${sh.seenKeys.size} vus · ${fmtAgo(sh.lastSeenAt)}`;
      });
    }
    grid.querySelectorAll('.show-card').forEach(c => c.onclick = () => openShow(c.dataset.key));
    wireCardArchive(grid);
    hydratePosters(grid, list);
  };
  for (const secId of order) fill(defs[secId].id, defs[secId].list, defs[secId].withAgo);

  // Reorder controls
  el.querySelectorAll('.ord-btn[data-move]').forEach(b => b.onclick = () => {
    moveHomeSection(b.dataset.sec, b.dataset.move);
    render();
  });

  // One-time: fetch airing dates for currently-running shows so the
  // "nouvel épisode récent -> À voir" rule can apply, then re-render.
  if (await refreshAiringDates(shows)) render();
}

// Cached TMDB meta for a show (no network).
function metaFor(sh) {
  if (!sh) return null;
  const id = sh.forcedTmdb || (sh.tvdbId != null ? tmdbCache.map[sh.tvdbId] : null);
  return id ? (tmdbCache.shows[id] || null) : null;
}

// Refetch meta (to get lastAir/nextAir) for running shows whose cache predates
// those fields. Bounded + cached to disk, so it runs at most once.
async function refreshAiringDates(shows) {
  if (!hasKey()) return false;
  const todo = [];
  for (const sh of shows) {
    const m = metaFor(sh);
    if (m && m.status === 'Returning Series' && !('lastAir' in m)) todo.push(sh);
  }
  if (!todo.length) return false;
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const sh = todo[i++];
      const id = tmdbCache.map[sh.tvdbId];
      if (!id) continue;
      try { await getShowMeta(id, true); } catch {}
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return true;
}

// Keep only known section ids, in a valid order, filling any missing ones.
function normalizeHomeOrder(order) {
  const known = ['watching', 'stale', 'notStarted', 'finished'];
  const out = [];
  for (const s of (Array.isArray(order) ? order : [])) if (known.includes(s) && !out.includes(s)) out.push(s);
  for (const s of known) if (!out.includes(s)) out.push(s);
  return out;
}
function moveHomeSection(secId, dir) {
  const order = normalizeHomeOrder(userState.homeOrder);
  const i = order.indexOf(secId);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  userState.homeOrder = order;
  scheduleSaveState();
}

//////////////////////// Movies view ////////////////////////
// Effective status of a movie (user override wins over the exported status).
function movieStatus(m) {
  const o = userState.movieStatus && userState.movieStatus[m.name];
  return (o === 'watched' || o === 'towatch') ? o : (m.status || 'towatch');
}
function setMovieStatus(name, status) {
  if (!userState.movieStatus) userState.movieStatus = {};
  userState.movieStatus[name] = status;
  if (!userState.movieWatchedAt) userState.movieWatchedAt = {};
  if (status === 'watched') {
    if (!userState.movieWatchedAt[name]) userState.movieWatchedAt[name] = new Date().toISOString().slice(0, 19).replace('T', ' ');
  } else {
    delete userState.movieWatchedAt[name];
  }
  scheduleSaveState();
}
function movieYear(m) {
  const d = m.releaseDate || '';
  const y = /^\d{4}/.exec(d);
  return y ? y[0] : '';
}
// Date used for the "recently added / oldest" library sort.
function showAddedAt(s) { return s.createdAt || ''; }
function movieAddedAt(m) { return movieWatchedOf(m) || m.releaseDate || ''; }
const LIB_SORTERS_SHOW = {
  az: (a, b) => displayName(a).localeCompare(displayName(b)),
  za: (a, b) => displayName(b).localeCompare(displayName(a)),
  recent: (a, b) => String(showAddedAt(b)).localeCompare(String(showAddedAt(a))) || displayName(a).localeCompare(displayName(b)),
  old: (a, b) => String(showAddedAt(a)).localeCompare(String(showAddedAt(b))) || displayName(a).localeCompare(displayName(b)),
};
const LIB_SORTERS_MOVIE = {
  az: (a, b) => a.name.localeCompare(b.name),
  za: (a, b) => b.name.localeCompare(a.name),
  recent: (a, b) => String(movieAddedAt(b)).localeCompare(String(movieAddedAt(a))) || a.name.localeCompare(b.name),
  old: (a, b) => String(movieAddedAt(a)).localeCompare(String(movieAddedAt(b))) || a.name.localeCompare(b.name),
};
// Two-toggle sort bar: "Alphabétique" and "Ajout récent" ; re-clicking the active one reverses it.
function sortChipsHtml(cur) {
  const alpha = (cur === 'az' || cur === 'za');
  const recent = (cur === 'recent' || cur === 'old');
  return `<span class="chip ${alpha ? 'active' : ''}" data-sort="alpha">Alphabétique${alpha ? (cur === 'za' ? ' ↑' : ' ↓') : ''}</span>` +
         `<span class="chip ${recent ? 'active' : ''}" data-sort="recent">Ajout récent${recent ? (cur === 'old' ? ' ↑' : ' ↓') : ''}</span>`;
}
function nextSort(cur, which) {
  if (which === 'alpha') return cur === 'az' ? 'za' : 'az';
  return cur === 'recent' ? 'old' : 'recent';
}

let moviesTab = 'towatch';
let moviesSort = 'az';
route('movies', async (el) => {
  const all = (DATA.movies || []).concat(userState.customMovies || []).slice();
  const toWatch = all.filter(m => movieStatus(m) === 'towatch');
  const watched = all.filter(m => movieStatus(m) === 'watched');
  const list = (moviesTab === 'watched' ? watched : toWatch).slice();
  list.sort(LIB_SORTERS_MOVIE[moviesSort] || LIB_SORTERS_MOVIE.az);

  el.innerHTML = `
    <div class="page-head">
      <h1>Films</h1>
      <span class="sub">${toWatch.length} à voir · ${watched.length} vus</span>
      <div class="spacer"></div>
      <div class="sort-chips" id="movSort"></div>
    </div>
    <div class="pill-tabs" id="movTabs">
      <span class="chip ${moviesTab === 'towatch' ? 'active' : ''}" data-mtab="towatch">🎬 À voir (${toWatch.length})</span>
      <span class="chip ${moviesTab === 'watched' ? 'active' : ''}" data-mtab="watched">✓ Déjà vus (${watched.length})</span>
    </div>
    <div class="grid" id="movGrid"></div>`;

  const movSort = el.querySelector('#movSort');
  movSort.innerHTML = sortChipsHtml(moviesSort);
  movSort.querySelectorAll('.chip').forEach(c => c.onclick = () => { moviesSort = nextSort(moviesSort, c.dataset.sort); render(); });

  el.querySelectorAll('#movTabs .chip').forEach(c => c.onclick = () => { moviesTab = c.dataset.mtab; render(); });

  const grid = el.querySelector('#movGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🍿</div>${moviesTab === 'watched' ? 'Aucun film vu.' : 'Aucun film à voir.'}</div>`;
    return;
  }
  grid.innerHTML = list.map(m => movieCardHtml(m)).join('');
  wireMovieButtons(grid);
  hydrateMoviePosters(grid, list);
});

//////////////////////// Movie detail ////////////////////////
route('movie', async (el, rest) => {
  const name = decodeURIComponent(rest.join('/'));
  const m = (DATA.movies || []).concat(userState.customMovies || []).find(x => x.name === name);
  if (!m) { el.innerHTML = `<div class="empty">Film introuvable.</div>`; return; }

  let meta = null;
  if (hasKey()) {
    try {
      let rec = (userState.movieTmdb && userState.movieTmdb[name]) || (tmdbCache.movies && tmdbCache.movies[name]);
      if (!rec) rec = await resolveMovie(name, movieYear(m));
      if (rec && rec.id) meta = await getMovieMeta(rec.id);
    } catch {}
  }

  const st = movieStatus(m);
  const rw = movieRewatchOf(m);
  const year = movieYear(m);
  const rt = (meta && meta.runtime) || m.runtime;
  const rtStr = rt ? `${Math.floor(rt / 60)}h${String(rt % 60).padStart(2, '0')}` : '';
  const genres = meta ? meta.genres.join(' · ') : '';
  const subBits = [year, rtStr, genres].filter(Boolean).map(esc).join(' · ');
  el.innerHTML = `
    <a class="btn ghost sm" href="${esc(backTarget || '#/movies')}">← ${esc(backLabel())}</a>
    <div class="detail-hero" style="margin-top:12px">
      <div class="bg" style="${meta && meta.backdrop ? `background-image:url(${IMG(meta.backdrop, 'w780')})` : ''}"></div>
      <div class="inner">
        <div class="poster">${meta && meta.poster ? `<img src="${IMG(meta.poster)}" alt="">` : `<div class="fallback-title">${esc(m.name)}</div>`}</div>
        <div>
          <h1>${esc(meta && meta.title ? meta.title : m.name)}</h1>
          <div class="sub">${subBits}${meta && meta.vote ? (subBits ? ' · ' : '') + '⭐ ' + meta.vote.toFixed(1) : ''}</div>
          ${meta && meta.tagline ? `<div class="sub" style="font-style:italic;margin-top:4px">${esc(meta.tagline)}</div>` : ''}
          <div class="tags">
            <span class="chip">${st === 'watched' ? '✓ Vu' : '🎬 À voir'}</span>
            ${st === 'watched' && rw > 0 ? `<span class="chip">🔁 ${rw + 1} visionnages</span>` : ''}
            ${movieRatingOf(m) ? `<span class="chip">${'★'.repeat(movieRatingOf(m))}</span>` : ''}
          </div>
          <div class="detail-actions">
            <button class="btn ${st === 'watched' ? 'primary' : ''}" id="mToggle">${st === 'watched' ? '↩ Remettre « à voir »' : '✓ Marquer comme vu'}</button>
            ${st === 'watched' ? `<button class="btn" id="mRw">🔁 +1 visionnage${rw > 0 ? ' (×' + (rw + 1) + ')' : ''}</button>` : ''}
            <button class="btn ${isFavMovie(m) ? 'primary' : ''}" id="mFav">${isFavMovie(m) ? '❤️ Favori' : '🤍 Favori'}</button>
            <button class="btn" id="mAddList">📃 Ajouter à une liste</button>
            <button class="btn" id="mFind">🔍 Chercher une affiche</button>
            ${m.custom ? `<button class="btn danger" id="mDel">🗑 Retirer</button>` : ''}
          </div>
          <div class="movie-react">
            <span class="react-label">Ma réaction</span>
            <div class="react" data-act="memo">${EMOTIONS.slice(0, 5).map(em => `<button data-e="${em.id}" title="${em.label}" class="${movieEmotionOf(m) === em.id ? 'on' : ''}">${em.emoji}</button>`).join('')}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="detail-tabs">
      <button class="tab active" data-tab="overview">Aperçu</button>
      <button class="tab" data-tab="about">À propos</button>
    </div>
    <div class="tab-panel active" data-panel="overview"><div class="synopsis">${esc(meta ? (meta.overview || 'Pas de résumé disponible.') : 'Ajoutez une clé TMDB (Réglages) pour voir les informations du film.')}</div></div>
    <div class="tab-panel" data-panel="about"><div id="about">${movieAboutHtml(m, meta)}</div></div>`;

  wireTabs(el);
  el.querySelector('#about')?.addEventListener('click', (ev) => {
    const clr = ev.target.closest('.stars[data-id="aboutMovieRate"] .star-clear');
    const s = ev.target.closest('.stars[data-id="aboutMovieRate"] .s');
    if (!clr && !s) return;
    setMovieRating(m.name, clr ? 0 : parseInt(s.dataset.v, 10));
    updateStarsUI((clr || s).closest('.stars'), movieRatingOf(m));
  });
  el.querySelector('.movie-react .react[data-act="memo"]')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    setMovieEmotion(m, b.dataset.e);
    const cur = movieEmotionOf(m);
    ev.currentTarget.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.e === cur));
  });
  wireTrailer(el);
  el.querySelector('#mToggle').onclick = () => { setMovieStatus(m.name, st === 'watched' ? 'towatch' : 'watched'); toast(st === 'watched' ? 'Remis dans « à voir »' : 'Marqué comme vu'); render(); };
  el.querySelector('#mFav').onclick = () => { toggleFavMovie(m); toast(isFavMovie(m) ? 'Ajouté aux favoris' : 'Retiré des favoris'); render(); };
  el.querySelector('#mAddList').onclick = () => openAddToListModal('movie', m);
  const rwBtn = el.querySelector('#mRw'); if (rwBtn) rwBtn.onclick = () => { setMovieRewatch(m.name, movieRewatchOf(m) + 1); render(); };
  el.querySelector('#mFind').onclick = () => openPosterSearch('movie', { name: m.name });
  const del = el.querySelector('#mDel'); if (del) del.onclick = () => { removeCustomMovie(m.name); toast('Film retiré'); location.hash = '#/movies'; render(); };
});

function movieCardHtml(m) {
  const st = movieStatus(m);
  const year = movieYear(m);
  const rt = m.runtime ? `${Math.floor(m.runtime / 60)}h${String(m.runtime % 60).padStart(2, '0')}` : '';
  const metaBits = [year, rt].filter(Boolean).join(' · ');
  const btn = st === 'watched'
    ? `<button class="card-arch" data-movie="${esc(m.name)}" data-to="towatch" title="Remettre dans « à voir »">↩</button>`
    : `<button class="card-arch" data-movie="${esc(m.name)}" data-to="watched" title="Marquer comme vu">✓</button>`;
  const rating = movieRatingOf(m) ? `<span class="badge-tag">${'★'.repeat(movieRatingOf(m))}</span>` : '';
  const rw = movieRewatchOf(m);
  const rwBadge = (st === 'watched' && rw > 0) ? `<span class="badge-count">×${rw + 1}</span>` : '';
  const rwBtn = st === 'watched'
    ? `<button class="card-rw ${rw > 0 ? 'on' : ''}" data-mrw="${esc(m.name)}" title="Visionnages — clic : +1, clic droit : −1">🔁${rw > 0 ? '×' + (rw + 1) : ''}</button>`
    : '';
  const delBtn = m.custom ? `<button class="card-del" data-mdel="${esc(m.name)}" title="Retirer ce film ajouté">🗑</button>` : '';
  return `<div class="show-card movie-card" data-mname="${esc(m.name)}">
    <div class="poster" data-mposter="${esc(m.name)}">
      <div class="fallback-title">${esc(movieDisplayName(m))}</div>
      ${rating}
      ${rwBadge}
      ${rwBtn}
      ${delBtn}
      <button class="find-poster" data-mfind="${esc(m.name)}" title="Chercher une affiche sur TMDB">🔍</button>
      ${btn}
    </div>
    <div class="title">${esc(movieDisplayName(m))}</div>
    <div class="meta">${esc(metaBits || (st === 'watched' ? 'Vu' : 'À voir'))}</div>
  </div>`;
}

function wireMovieButtons(container) {
  container.querySelectorAll('.movie-card').forEach(c => c.onclick = () => openMovie(c.dataset.mname));
  container.querySelectorAll('[data-movie]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      setMovieStatus(b.dataset.movie, b.dataset.to);
      toast(b.dataset.to === 'watched' ? 'Film marqué comme vu' : 'Film remis dans « à voir »');
      render();
    };
  });
  container.querySelectorAll('[data-mrw]').forEach(b => {
    const bump = (delta) => {
      const m = (DATA.movies || []).concat(userState.customMovies || []).find(x => x.name === b.dataset.mrw);
      if (!m) return;
      setMovieRewatch(b.dataset.mrw, movieRewatchOf(m) + delta);
      render();
    };
    b.onclick = (ev) => { ev.stopPropagation(); bump(1); };
    b.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); bump(-1); };
  });
  container.querySelectorAll('[data-mfind]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      openPosterSearch('movie', { name: b.dataset.mfind });
    };
  });
  container.querySelectorAll('[data-mdel]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      removeCustomMovie(b.dataset.mdel);
      toast('Film retiré');
      render();
    };
  });
}

// Resolve a movie poster from TMDB by name (+year), cached in tmdbCache.movies.
async function resolveMovie(name, year) {
  if (!tmdbCache.movies) tmdbCache.movies = {};
  const cached = tmdbCache.movies[name];
  // Déjà résolu (y compris le titre français) OU marqué introuvable -> on garde.
  if (cached === null || (cached && 'title' in cached)) return cached;
  try {
    const q = `/search/movie?query=${encodeURIComponent(name)}${year ? '&year=' + year : ''}`;
    const res = await tmdbFetch(q);
    const hit = (res.results && res.results[0]) || null;
    tmdbCache.movies[name] = hit ? { id: hit.id, poster: hit.poster_path || null, title: hit.title || null } : null;
  } catch { if (!cached) tmdbCache.movies[name] = null; }
  scheduleSaveCache();
  return tmdbCache.movies[name];
}

async function hydrateMoviePosters(container, list) {
  if (!hasKey()) return;
  const byName = Object.fromEntries(list.map(m => [m.name, m]));
  const slots = container.querySelectorAll('[data-mposter]');
  let i = 0;
  const worker = async () => {
    while (i < slots.length) {
      const slot = slots[i++];
      const m = byName[slot.getAttribute('data-mposter')];
      if (!m) continue;
      try {
        const hit = await resolveMovie(m.name, movieYear(m));
        if (hit && hit.poster) slot.insertAdjacentHTML('afterbegin', `<img loading="lazy" src="${IMG(hit.poster)}" alt="">`);
        if (hit && hit.title) {
          const card = slot.closest('.movie-card');
          if (card) { const t = card.querySelector('.title'); if (t) t.textContent = hit.title; }
          const fb = slot.querySelector('.fallback-title'); if (fb) fb.textContent = hit.title;
        }
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}


//////////////////////// Library view ////////////////////////
let libFilter = { q: '', kind: 'series', tab: 'following', movieTab: 'all', sort: 'az' };
route('library', async (el) => {
  buildModel();
  const shows = Array.from(MODEL.shows.values());
  const allMovies = (DATA.movies || []).concat(userState.customMovies || []);
  el.innerHTML = `
    <div class="page-head">
      <h1>Bibliothèque</h1>
      <span class="sub" id="libCount"></span>
      <div class="spacer"></div>
      <div class="sort-chips" id="libSort"></div>
      <input class="input" id="libSearch" placeholder="Rechercher…" value="${esc(libFilter.q)}" style="min-width:200px">
    </div>
    <div class="pill-tabs" id="libKind">
      <span class="chip ${libFilter.kind === 'series' ? 'active' : ''}" data-kind="series">📺 Séries</span>
      <span class="chip ${libFilter.kind === 'movie' ? 'active' : ''}" data-kind="movie">🎬 Films</span>
    </div>
    <div class="pill-tabs" id="libTabs"></div>
    <div class="grid" id="libGrid"></div>`;

  const seriesTabs = [
    ['following', 'Je suis', s => s.followed && !s.archived],
    ['watchlist', 'À voir plus tard', s => userState.watchlist[s.key] || s.specialStatus === 'for_later'],
    ['favorites', 'Favoris', s => isFavShow(s)],
    ['archived', 'Archivées', s => s.archived],
    ['all', 'Tout', () => true],
  ];
  const movieTabs = [
    ['all', 'Tout', () => true],
    ['towatch', 'À voir', m => movieStatus(m) === 'towatch'],
    ['watched', 'Vus', m => movieStatus(m) === 'watched'],
    ['favorites', 'Favoris', m => isFavMovie(m)],
  ];

  const tabsEl = el.querySelector('#libTabs');
  function drawTabs() {
    const tabs = libFilter.kind === 'movie' ? movieTabs : seriesTabs;
    const source = libFilter.kind === 'movie' ? allMovies : shows;
    const cur = libFilter.kind === 'movie' ? libFilter.movieTab : libFilter.tab;
    tabsEl.innerHTML = tabs.map(([id, label, pred]) => {
      const n = source.filter(pred).length;
      return `<span class="chip ${cur === id ? 'active' : ''}" data-tab="${id}">${label} <b class="chip-n">${n}</b></span>`;
    }).join('');
    tabsEl.querySelectorAll('.chip').forEach(c => c.onclick = () => {
      if (libFilter.kind === 'movie') libFilter.movieTab = c.dataset.tab; else libFilter.tab = c.dataset.tab;
      drawTabs(); drawLib();
    });
  }

  el.querySelectorAll('#libKind .chip').forEach(c => c.onclick = () => {
    libFilter.kind = c.dataset.kind;
    el.querySelectorAll('#libKind .chip').forEach(x => x.classList.toggle('active', x.dataset.kind === libFilter.kind));
    drawTabs(); drawLib();
  });
  el.querySelector('#libSearch').oninput = (e) => { libFilter.q = e.target.value; drawLib(); };
  const sortEl = el.querySelector('#libSort');
  function drawSort() {
    sortEl.innerHTML = sortChipsHtml(libFilter.sort);
    sortEl.querySelectorAll('.chip').forEach(c => c.onclick = () => { libFilter.sort = nextSort(libFilter.sort, c.dataset.sort); drawSort(); drawLib(); });
  }
  drawSort();

  function drawLib() {
    const grid = el.querySelector('#libGrid');
    const q = libFilter.q.trim().toLowerCase();
    if (libFilter.kind === 'movie') {
      const pred = movieTabs.find(t => t[0] === libFilter.movieTab)[2];
      let list = allMovies.filter(pred);
      if (q) list = list.filter(m => ((m.name || '') + ' ' + movieDisplayName(m)).toLowerCase().includes(q));
      list.sort(LIB_SORTERS_MOVIE[libFilter.sort] || LIB_SORTERS_MOVIE.az);
      el.querySelector('#libCount').textContent = `${list.length} film(s)`;
      if (!list.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🍿</div>Aucun film ici.</div>`; return; }
      grid.innerHTML = list.map(m => movieCardHtml(m)).join('');
      wireMovieButtons(grid);
      hydrateMoviePosters(grid, list);
    } else {
      const pred = seriesTabs.find(t => t[0] === libFilter.tab)[2];
      let list = shows.filter(pred);
      if (q) list = list.filter(s => searchNames(s).some(n => n.includes(q)));
      list.sort(LIB_SORTERS_SHOW[libFilter.sort] || LIB_SORTERS_SHOW.az);
      el.querySelector('#libCount').textContent = `${list.length} série(s)`;
      if (!list.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🍿</div>Aucune série ici.</div>`; return; }
      grid.innerHTML = list.map(s => cardHtml(s)).join('');
      grid.querySelectorAll('.show-card').forEach(c => c.onclick = () => openShow(c.dataset.key));
      wireCardArchive(grid);
      hydratePosters(grid, list);
    }
  }

  drawTabs();
  drawLib();
});

// Progress of a show: null (nothing to show), or { pct, cls }.
// orange = en cours ; green = tout vu mais suite prévue ; purple = tout vu et terminé.
function showProgress(s, m) {
  const total = m && m.totalEpisodes > 0 ? m.totalEpisodes : 0;
  const seen = s.seenKeys.size;
  if (!total || seen <= 0) return null;
  if (seen >= total) {
    const ended = m.status === 'Ended' || m.status === 'Canceled';
    return { pct: 100, cls: ended ? 'purple' : 'green' };
  }
  return { pct: Math.max(4, Math.min(99, Math.round(seen / total * 100))), cls: 'orange' };
}
function progressBarHtml(prog) {
  return prog ? `<span class="bar ${prog.cls}" style="width:${prog.pct}%"></span>` : '';
}

function cardHtml(s) {
  const seen = s.seenKeys.size;
  const tag = isFavShow(s) ? 'Favori' : (s.archived ? 'Arrêtée' : '');
  const name = displayName(s);
  const arch = s.archived
    ? `<button class="card-arch" data-arch="${esc(s.key)}" title="Reprendre cette série">↩</button>`
    : `<button class="card-arch" data-arch="${esc(s.key)}" title="Arrêter de suivre / archiver">⏹</button>`;
  const prog = showProgress(s, metaFor(s));
  return `<div class="show-card" data-key="${esc(s.key)}">
    <div class="poster" data-poster="${esc(s.key)}">
      <div class="fallback-title">${esc(name)}</div>
      ${tag ? `<span class="badge-tag">${tag}</span>` : ''}
      <button class="find-poster" data-find="${esc(s.key)}" title="Chercher une affiche sur TMDB">🔍</button>
      ${seen ? `<button class="card-pin${isPinnedWatching(s) ? ' on' : ''}" data-pin="${esc(s.key)}" title="${isPinnedWatching(s) ? 'Retirer de « À voir »' : 'Marquer « en cours » (À voir)'}">📌</button>` : ''}
      ${arch}
      ${seen ? `<div class="card-progress">${progressBarHtml(prog)}</div>` : ''}
    </div>
    <div class="title">${esc(name)}</div>
    ${seen ? '' : `<div class="meta">Pas encore commencé</div>`}
  </div>`;
}

// Wire the archive/resume button that overlays each show card.
function wireCardArchive(container) {
  container.querySelectorAll('[data-arch]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      const sh = MODEL.shows.get(b.dataset.arch);
      if (!sh) return;
      toggleArchived(sh);
      toast(sh.archived ? 'Série arrêtée / archivée' : 'Série reprise');
      render();
    };
  });
  container.querySelectorAll('[data-find]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      const sh = MODEL.shows.get(b.dataset.find);
      if (sh) openPosterSearch('tv', sh);
    };
  });
  container.querySelectorAll('[data-pin]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      const sh = MODEL.shows.get(b.dataset.pin);
      if (!sh) return;
      togglePinWatching(sh);
      toast(isPinnedWatching(sh) ? 'Ajoutée à « À voir »' : 'Retirée de « À voir »');
      render();
    };
  });
}

// ---- Touch: long-press a series card to reveal its action buttons ----
// (On desktop the buttons already appear on hover; on touch they stay hidden
//  so posters look clean, and a ~0.5s press reveals them.)
let _lpTimer = null, _lpFired = false;
function clearCardActions() {
  document.querySelectorAll('.show-card.show-actions').forEach(c => c.classList.remove('show-actions'));
}
function _lpCancel() { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }
document.addEventListener('touchstart', (e) => {
  const t = e.target;
  if (t.closest && t.closest('button')) return;          // let action buttons work
  const card = t.closest && t.closest('.show-card:not(.movie-card)');
  if (!card) { clearCardActions(); return; }              // tap outside -> hide actions
  _lpFired = false;
  _lpCancel();
  _lpTimer = setTimeout(() => {
    _lpTimer = null; _lpFired = true;
    clearCardActions();
    card.classList.add('show-actions');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
  }, 480);
}, { passive: true });
document.addEventListener('touchmove', _lpCancel, { passive: true });
document.addEventListener('touchend', _lpCancel, { passive: true });
document.addEventListener('touchcancel', _lpCancel, { passive: true });
// Suppress the navigation click that immediately follows a long-press.
document.addEventListener('click', (e) => {
  if (!_lpFired) return;
  _lpFired = false;
  const card = e.target.closest && e.target.closest('.show-card');
  if (card && !(e.target.closest && e.target.closest('button'))) { e.stopPropagation(); e.preventDefault(); }
}, true);

// ---- Swipe left/right to move between the main categories (basic version:
//      detected on release, the page change plays the standard slide). ----
const SWIPE_ROUTES = ['home', 'movies', 'explore', 'profile'];
let _swX = 0, _swY = 0, _swOn = false;
document.addEventListener('touchstart', (e) => {
  _swOn = false;
  if (e.touches.length !== 1) return;
  const t = e.target;
  if (t.closest && t.closest('.cast-list, .sort-chips, .pv-seasons, .react, input, textarea, select')) return;
  if (document.getElementById('modalRoot') && document.getElementById('modalRoot').children.length) return;
  if (!SWIPE_ROUTES.includes(currentRoute().split('/')[0])) return;
  _swOn = true; _swX = e.touches[0].clientX; _swY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!_swOn) return;
  _swOn = false;
  const dx = e.changedTouches[0].clientX - _swX;
  const dy = e.changedTouches[0].clientY - _swY;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return; // require a clear horizontal swipe
  let i = SWIPE_ROUTES.indexOf(currentRoute().split('/')[0]);
  if (i < 0) return;
  i += (dx < 0 ? 1 : -1); // swipe left = next category, swipe right = previous
  if (i < 0 || i >= SWIPE_ROUTES.length) return; // no wrap-around at the ends
  location.hash = '#/' + SWIPE_ROUTES[i];
}, { passive: true });

// progressively load posters for visible cards (only when a TMDB key is set)
async function hydratePosters(container, list) {
  if (!hasKey()) return; // fallback titles are already rendered
  const byKey = Object.fromEntries(list.map(s => [s.key, s]));
  const slots = container.querySelectorAll('[data-poster]');
  let i = 0;
  const worker = async () => {
    while (i < slots.length) {
      const slot = slots[i++];
      const sh = byKey[slot.getAttribute('data-poster')];
      if (!sh) continue;
      try {
        const { poster, meta } = await ensurePoster(sh);
        if (poster) slot.insertAdjacentHTML('afterbegin', `<img loading="lazy" src="${IMG(poster)}" alt="">`);
        if (meta && meta.name && !(sh.name && sh.name.trim())) {
          const card = slot.closest('.show-card');
          if (card) {
            const t = card.querySelector('.title'); if (t) t.textContent = meta.name;
            const fb = slot.querySelector('.fallback-title'); if (fb) fb.textContent = meta.name;
          }
        }
        const pc = slot.querySelector('.card-progress');
        if (pc) pc.innerHTML = progressBarHtml(showProgress(sh, meta));
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

//////////////////////// Show detail ////////////////////////
route('show', async (el, rest) => {
  buildModel();
  const key = decodeURIComponent(rest.join('/'));
  const sh = MODEL.shows.get(key);
  if (!sh) { el.innerHTML = `<div class="empty">Série introuvable.</div>`; return; }
  const fresh = (lastShowKey !== key); // true only when arriving on this show (not on an in-page re-render)
  lastShowKey = key;

  let meta = null, tmdbId = null;
  if (hasKey()) {
    tmdbId = overrideShowTmdb(sh) || (sh.tvdbId ? await resolveTmdbId(sh.tvdbId) : null);
    if (tmdbId) { try { meta = await getShowMeta(tmdbId); } catch {} }
  }

  const genres = meta ? meta.genres.join(' · ') : '';
  el.innerHTML = `
    <a class="btn ghost sm" href="${esc(backTarget || '#/home')}">← ${esc(backLabel())}</a>
    <div class="detail-hero" style="margin-top:12px">
      <div class="bg" style="${meta && meta.backdrop ? `background-image:url(${IMG(meta.backdrop, 'w780')})` : ''}"></div>
      <div class="inner">
        <div class="poster">${posterHtml(sh, meta && meta.poster)}</div>
        <div>
          <h1>${esc(meta && meta.name ? meta.name : displayName(sh))}</h1>
          <div class="sub">${meta ? esc((meta.firstAir || '').slice(0, 4)) + (meta.status ? ' · ' + esc(statusFr(meta.status)) : '') : ''} ${genres ? '· ' + esc(genres) : ''}</div>
          <div class="tags">
            <span class="chip">${sh.seenKeys.size} épisode(s) vu(s)${meta && meta.totalEpisodes ? ' / ' + meta.totalEpisodes : ''}</span>
            ${starsHtml('showrate', sh.showRating || 0)}
          </div>
          <div class="overview">${esc(meta ? meta.overview : '')}</div>
          <div class="detail-actions">
            <button class="btn ${userState.watchlist[sh.key] ? 'primary' : ''}" id="btnWatch">${userState.watchlist[sh.key] ? '✓ Dans « à voir »' : '+ À voir plus tard'}</button>
            <button class="btn ${isFavShow(sh) ? 'primary' : ''}" id="btnFav">${isFavShow(sh) ? '❤️ Favori' : '🤍 Favori'}</button>
            <button class="btn" id="btnAddList">📃 Ajouter à une liste</button>
            <button class="btn ${isPinnedWatching(sh) ? 'primary' : ''}" id="btnPin">${isPinnedWatching(sh) ? '📌 En cours ✓' : '📌 Marquer « en cours »'}</button>
            <button class="btn" id="btnArchive">${sh.archived ? 'Reprendre' : 'Arrêter / Archiver'}</button>
            <button class="btn" id="btnMarkSeason">Marquer une saison vue…</button>
            <button class="btn" id="btnAddEp">➕ Ajouter un épisode</button>
            <button class="btn" id="btnFindPoster">🔍 Chercher une affiche</button>
            ${sh.custom ? `<button class="btn danger" id="btnRemoveShow">🗑 Retirer</button>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="detail-tabs">
      <button class="tab active" data-tab="episodes">Épisodes</button>
      <button class="tab" data-tab="about">À propos</button>
    </div>
    <div class="tab-panel active" data-panel="episodes"><div id="seasons">${meta ? '<div class="loading">Chargement des épisodes…</div>' : offlineSeasons(sh)}</div></div>
    <div class="tab-panel" data-panel="about"><div id="about">${meta ? showAboutHtml(sh, meta) : ''}</div></div>`;

  wireTabs(el);
  // show rating stars
  el.querySelector('.detail-hero .stars')?.addEventListener('click', (ev) => {
    const clr = ev.target.closest('.star-clear');
    const s = ev.target.closest('.s');
    if (!clr && !s) return;
    setShowRating(sh, clr ? 0 : parseInt(s.dataset.v, 10));
    updateStarsUI(el.querySelectorAll('.stars'), sh.showRating || 0);
  });
  el.querySelector('#about')?.addEventListener('click', (ev) => {
    const clr = ev.target.closest('.stars[data-id="aboutShowRate"] .star-clear');
    const s = ev.target.closest('.stars[data-id="aboutShowRate"] .s');
    if (!clr && !s) return;
    setShowRating(sh, clr ? 0 : parseInt(s.dataset.v, 10));
    updateStarsUI(el.querySelectorAll('.stars'), sh.showRating || 0);
  });
  wireTrailer(el);
  el.querySelector('#btnWatch').onclick = () => { toggleWatchlist(sh); render(); };
  el.querySelector('#btnFav').onclick = () => { toggleFavShow(sh); toast(isFavShow(sh) ? 'Ajoutée aux favoris' : 'Retirée des favoris'); render(); };
  el.querySelector('#btnAddList').onclick = () => openAddToListModal('tv', sh);
  el.querySelector('#btnPin').onclick = () => { togglePinWatching(sh); toast(isPinnedWatching(sh) ? 'Ajoutée à « À voir »' : 'Retirée de « À voir »'); render(); };
  el.querySelector('#btnArchive').onclick = () => { toggleArchived(sh); render(); };
  el.querySelector('#btnMarkSeason').onclick = () => markSeasonPrompt(sh, meta, tmdbId);
  el.querySelector('#btnAddEp').onclick = () => addEpisodePrompt(sh, meta);
  el.querySelector('#btnFindPoster').onclick = () => openPosterSearch('tv', sh);
  const rmBtn = el.querySelector('#btnRemoveShow');
  if (rmBtn) rmBtn.onclick = () => { removeCustomShow(sh.key); toast('Série retirée'); location.hash = '#/home'; render(); };

  if (meta) await renderSeasons(el.querySelector('#seasons'), sh, tmdbId, meta, fresh);
});

function offlineSeasons(sh) {
  // Build seasons from the seen keys + user-added episodes (no TMDB)
  const bySeason = {};
  for (const k of sh.seenKeys) { const [, s, n] = k.split('|'); (bySeason[s] = bySeason[s] || new Set()).add(parseInt(n, 10)); }
  for (const e of customEpsForShow(sh)) { (bySeason[e.s] = bySeason[e.s] || new Set()).add(e.n); }
  const seasons = Object.keys(bySeason).sort((a, b) => a - b);
  if (!seasons.length) return `<div class="empty">Aucun épisode enregistré. Ajoutez une clé TMDB (Réglages) pour voir la liste complète des épisodes, ou utilisez « ➕ Ajouter un épisode ».</div>`;
  return `<div class="panel"><p class="hint" style="color:var(--muted)">Sans clé TMDB, seuls vos épisodes vus / ajoutés sont affichés.</p></div>` +
    seasons.map(s => `<div class="season-head"><h3>Saison ${s}</h3><span class="count">${bySeason[s].size} épisode(s)</span></div>`).join('');
}

async function renderSeasons(container, sh, tmdbId, meta, fresh) {
  container.innerHTML = '';
  // Merge TMDB seasons with any user-added (custom) seasons/episodes.
  const custom = customEpsForShow(sh);
  const customBySeason = {};
  for (const e of custom) (customBySeason[e.s] = customBySeason[e.s] || []).push(e);
  const tmdbCount = {};
  for (const s of (meta ? meta.seasons : [])) tmdbCount[s.n] = s.count;
  const seasonNums = new Set();
  for (const s of (meta ? meta.seasons : [])) seasonNums.add(s.n);
  for (const s of Object.keys(customBySeason)) seasonNums.add(Number(s));
  const sorted = Array.from(seasonNums).sort((a, b) => a - b);

  // Ordered episode lists per season, filled as seasons load (used to offer
  // "mark all previous episodes" when a mid-season episode is checked).
  const seasonEps = {};
  const getPrevUnseen = (season, n) => {
    if (season === 0) return []; // don't chain from specials
    const out = [];
    for (const sn2 of sorted) {
      if (sn2 === 0 || sn2 > season) continue;
      for (const e of (seasonEps[sn2] || [])) {
        const before = sn2 < season || (sn2 === season && e.n < n);
        if (!before) continue;
        const aired = !e.air || new Date(e.air) <= new Date();
        if (aired && !isSeen(sh, sn2, e.n)) out.push({ season: sn2, n: e.n });
      }
    }
    return out;
  };

  let expandedChosen = false;
  let firstUnseenEl = null; // first unwatched aired episode row (to auto-scroll a show in progress)
  // Resume point = just AFTER the last watched episode, so intentionally-skipped
  // fillers earlier on don't send you back to an old gap.
  let lastSeenS = -1, lastSeenN = -1;
  for (const k of sh.seenKeys) {
    const p = k.split('|'); const S = +p[p.length - 2], N = +p[p.length - 1];
    if (S > lastSeenS || (S === lastSeenS && N > lastSeenN)) { lastSeenS = S; lastSeenN = N; }
  }
  for (const sn of sorted) {
    const secId = 'sea_' + sn;
    const seenInSeason = () => Array.from(sh.seenKeys).filter(k => k.split('|')[1] == sn).length;

    let eps = [];
    if (tmdbId && tmdbCount[sn] != null) { try { eps = await getSeasonEpisodes(tmdbId, sn); } catch { eps = []; } }
    const present = new Set(eps.map(e => e.n));
    const customEps = (customBySeason[sn] || []).filter(e => !present.has(e.n))
      .map(e => ({ n: e.n, name: e.name, air: null, custom: true }));
    const all = eps.concat(customEps).sort((a, b) => a.n - b.n);
    const total = all.length;
    seasonEps[sn] = all;
    const airedEps = () => all.filter(e => !e.air || new Date(e.air) <= new Date());

    // Expand the season holding the resume point (first aired unseen episode that
    // comes after the last watched one).
    const firstUnseen = all.find(e => (!e.air || new Date(e.air) <= new Date()) && !isSeen(sh, sn, e.n)
      && (sn > lastSeenS || (sn === lastSeenS && e.n > lastSeenN)));
    const hasUnseen = !!firstUnseen;
    const expand = !expandedChosen && hasUnseen;
    if (expand) expandedChosen = true;

    const head = document.createElement('div');
    head.className = 'season-head' + (expand ? '' : ' collapsed');
    head.innerHTML = `<span class="caret">▸</span><h3>Saison ${sn}</h3><span class="count" id="${secId}_c">${seenInSeason()} / ${total}</span> <div class="markall-group"><button class="btn sm ghost markall-seen">Tout vu</button><button class="btn sm ghost markall-unseen">Tout non vu</button></div>`;
    container.appendChild(head);

    const body = document.createElement('div');
    body.id = secId; body.className = 'season-body' + (expand ? '' : ' collapsed'); container.appendChild(body);

    const updateCount = () => { const c = document.getElementById(secId + '_c'); if (c) c.textContent = `${seenInSeason()} / ${total}`; };
    const buildBody = () => {
      body.innerHTML = all.map(e => epHtml(sh, sn, e)).join('') +
        `<button class="btn sm ghost add-ep" data-season="${sn}">➕ Ajouter un épisode à la saison ${sn}</button>`;
      wireEpisodes(body, sh, sn, updateCount, { getPrevUnseen });
      body.querySelector('.add-ep').onclick = () => addEpisodePrompt(sh, meta, sn);
      updateCount();
    };
    buildBody();

    if (expand && firstUnseen) firstUnseenEl = body.querySelector('.ep[data-n="' + firstUnseen.n + '"]');

    head.onclick = (ev) => {
      if (ev.target.closest('.markall-group')) return;
      const collapsed = head.classList.toggle('collapsed');
      body.classList.toggle('collapsed', collapsed);
    };

    // "Tout vu": mark every aired episode seen; if they are ALL already seen,
    // it counts as a re-watch (+1 visionnage on each). Stays in place.
    head.querySelector('.markall-seen').onclick = (ev) => {
      ev.stopPropagation();
      const wasComplete = isShowComplete(sh);
      const aired = airedEps();
      if (!aired.length) return;
      const allSeen = aired.every(e => isSeen(sh, sn, e.n));
      if (allSeen) {
        aired.forEach(e => setRewatch(sh, sn, e.n, rewatchOf(sh, sn, e.n) + 1));
        toast('Saison marquée comme revue (+1 visionnage)');
      } else {
        aired.forEach(e => { if (!isSeen(sh, sn, e.n)) toggleSeen(sh, sn, e.n, true); });
        toast('Saison marquée comme vue');
      }
      buildBody(); updateSyncStatus();
      if (!wasComplete && isShowComplete(sh)) celebrateCompletion(sh);
    };
    // "Tout non vu": clear seen AND rewatch counts for the whole season. Stays in place.
    head.querySelector('.markall-unseen').onclick = (ev) => {
      ev.stopPropagation();
      all.forEach(e => {
        if (rewatchOf(sh, sn, e.n) > 0) setRewatch(sh, sn, e.n, 0);
        if (isSeen(sh, sn, e.n)) toggleSeen(sh, sn, e.n, false);
      });
      toast('Saison marquée comme non vue');
      buildBody(); updateSyncStatus();
    };
  }

  // On a fresh open of a show in progress, jump straight to the first unwatched
  // episode (after render() has done its scroll-to-top).
  if (fresh && firstUnseenEl && sh.seenKeys.size > 0) {
    setTimeout(() => { try { firstUnseenEl.scrollIntoView({ block: 'center' }); } catch {} }, 80);
  }
}

function epHtml(sh, season, e) {
  const k = epKey(sh.key, season, e.n);
  const seen = sh.seenKeys.has(k);
  const rating = MODEL.ratingMap.get(k) || 0;
  const emo = MODEL.emotionMap.get(k);
  const rw = MODEL.rewatchMap.get(k) || 0;
  const aired = e.air && new Date(e.air) <= new Date();
  return `<div class="ep ${seen ? 'seen' : ''} ${e.custom ? 'custom' : ''}" data-n="${e.n}">
    <div class="check ${seen ? 'on' : ''}" data-act="seen">✓</div>
    <div class="num">${season}×${String(e.n).padStart(2, '0')}</div>
    <div class="epname">${esc(e.name || 'Épisode ' + e.n)}${e.custom ? ' <span class="tag-custom">ajouté</span>' : ''}<small>${e.air ? esc(e.air) : ''}${!aired && e.air ? ' · à venir' : ''}</small></div>
    <div class="rw ${rw > 0 ? 'on' : ''}" data-act="rw" title="Visionnages — clic : +1, clic droit : −1">🔁<span class="rw-n">${rw > 0 ? '×' + (rw + 1) : ''}</span></div>
    <div class="stars" data-act="rate">${[1, 2, 3, 4, 5].map(v => `<span class="s ${v <= rating ? 'on' : ''}" data-v="${v}">★</span>`).join('')}<button type="button" class="star-clear" title="Retirer ma note"${rating > 0 ? '' : ' hidden'}>✕</button></div>
    <div class="react" data-act="emo">${EMOTIONS.slice(0, 5).map(em => `<button data-e="${em.id}" title="${em.label}" class="${emo === em.id ? 'on' : ''}">${em.emoji}</button>`).join('')}</div>
    ${e.custom ? `<button class="ep-del" data-act="delcustom" title="Supprimer cet épisode ajouté">🗑</button>` : ''}
  </div>`;
}

// ---- Fin de série : célébration + confettis ----
function isShowComplete(sh) {
  const m = metaFor(sh);
  return !!(m && m.totalEpisodes > 0 && sh.seenKeys.size >= m.totalEpisodes);
}
function fmtDur(mins) {
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), mm = Math.round(mins % 60);
  if (d > 0) return h > 0 ? `${d} j ${h} h` : `${d} j`;
  if (h > 0) return mm > 0 ? `${h} h ${mm}` : `${h} h`;
  return `${mm} min`;
}
function celebrateCompletion(sh) {
  const m = metaFor(sh);
  const episodes = sh.seenKeys.size;
  const watchTime = fmtDur(episodes * ((m && m.runtime) || DEFAULT_RUNTIME));
  const wd = showWatchDates(sh);
  let spanTxt = null;
  if (wd.first && wd.last) {
    const days = Math.max(1, Math.round((Date.parse(String(wd.last).replace(' ', 'T')) - Date.parse(String(wd.first).replace(' ', 'T'))) / 86400000));
    spanTxt = days >= 365 ? `${Math.round(days / 365 * 10) / 10} an(s)` : days >= 30 ? `${Math.round(days / 30)} mois` : `${days} j`;
  }
  const seasons = m ? m.seasons.length : 0;
  const rating = sh.showRating;
  showModal(`
    <div class="celebrate">
      <canvas class="confetti-cv"></canvas>
      <div class="cel-emoji">🎉</div>
      <h2>Série terminée !</h2>
      <p class="cel-name">${esc(displayName(sh))}</p>
      <div class="cel-stats">
        <div class="cel-stat"><b>${episodes}</b><span>épisodes vus</span></div>
        <div class="cel-stat"><b>${watchTime}</b><span>de visionnage</span></div>
        ${spanTxt ? `<div class="cel-stat"><b>${spanTxt}</b><span>pour la terminer</span></div>` : (seasons ? `<div class="cel-stat"><b>${seasons}</b><span>saison(s)</span></div>` : '')}
      </div>
      ${wd.first ? `<p class="cel-msg">Du ${fmtFull(wd.first)} au ${fmtFull(wd.last)}${rating ? ` · Ta note : ${'★'.repeat(rating)}` : ''}</p>` : ''}
      <button class="btn primary" data-close>🎊 Génial !</button>
    </div>`, (root) => { runConfetti(root.querySelector('.confetti-cv')); });
}
function runConfetti(canvas) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const box = canvas.parentElement;
  canvas.width = box.clientWidth; canvas.height = Math.max(300, box.clientHeight);
  const colors = ['#f5c518', '#ff5e5e', '#5ec8ff', '#7CFC00', '#ff9ff3', '#ffd34e', '#a78bfa'];
  const parts = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
    r: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
    vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3,
    rot: Math.random() * 6.28, vr: -0.25 + Math.random() * 0.5,
  }));
  let frames = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.rot += p.vr;
      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    }
    if (++frames < 260 && document.body.contains(canvas)) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  tick();
}

function wireEpisodes(container, sh, season, onChange, opts) {
  container.querySelectorAll('.ep').forEach(row => {
    const n = parseInt(row.dataset.n, 10);
    row.querySelector('[data-act="seen"]').onclick = () => {
      const wasSeen = isSeen(sh, season, n);
      const wasComplete = isShowComplete(sh);
      toggleSeen(sh, season, n);
      const seen = isSeen(sh, season, n);
      row.classList.toggle('seen', seen);
      row.querySelector('.check').classList.toggle('on', seen);
      updateSyncStatus(); onChange();
      // When checking (not unchecking) a mid-season episode, offer to also mark
      // every earlier aired episode as seen.
      if (seen && !wasSeen && opts && opts.getPrevUnseen) {
        const prev = opts.getPrevUnseen(season, n);
        if (prev.length) { offerMarkPrevious(sh, prev, season, n); return; }
      }
      if (seen && !wasComplete && isShowComplete(sh)) celebrateCompletion(sh);
    };
    const rwEl = row.querySelector('[data-act="rw"]');
    const paintRw = () => {
      const c = rewatchOf(sh, season, n);
      rwEl.classList.toggle('on', c > 0);
      rwEl.querySelector('.rw-n').textContent = c > 0 ? '×' + (c + 1) : '';
      const seen = isSeen(sh, season, n);
      row.classList.toggle('seen', seen);
      row.querySelector('.check').classList.toggle('on', seen);
    };
    rwEl.onclick = () => { setRewatch(sh, season, n, rewatchOf(sh, season, n) + 1); paintRw(); updateSyncStatus(); onChange(); };
    rwEl.oncontextmenu = (ev) => { ev.preventDefault(); setRewatch(sh, season, n, rewatchOf(sh, season, n) - 1); paintRw(); onChange(); };
    row.querySelector('[data-act="rate"]').onclick = (ev) => {
      const clr = ev.target.closest('.star-clear');
      const s = ev.target.closest('.s');
      if (!clr && !s) return;
      setRating(sh, season, n, clr ? 0 : parseInt(s.dataset.v, 10));
      const r = MODEL.ratingMap.get(epKey(sh.key, season, n)) || 0;
      const w = row.querySelector('.stars[data-act="rate"]');
      w.querySelectorAll('.s').forEach(x => x.classList.toggle('on', parseInt(x.dataset.v, 10) <= r));
      const cb = w.querySelector('.star-clear'); if (cb) cb.hidden = !(r > 0);
    };
    row.querySelector('[data-act="emo"]').onclick = (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      setEmotion(sh, season, n, b.dataset.e);
      const cur = MODEL.emotionMap.get(epKey(sh.key, season, n));
      row.querySelectorAll('.react button').forEach(x => x.classList.toggle('on', x.dataset.e === cur));
    };
    const del = row.querySelector('[data-act="delcustom"]');
    if (del) del.onclick = () => { removeCustomEpisode(sh, season, n); render(); };
  });
}

// Offer to mark every earlier aired episode as seen after checking a mid-run episode.
function offerMarkPrevious(sh, prevList, season, n) {
  const cnt = prevList.length;
  const label = `${season}×${String(n).padStart(2, '0')}`;
  showModal(`<h2>Marquer les épisodes précédents ?</h2>
    <p>Vous avez marqué l'épisode <strong>${label}</strong> comme vu. Voulez-vous aussi marquer les <strong>${cnt}</strong> épisode(s) précédent(s) comme vu(s) ?</p>
    <div class="row"><button class="btn ghost" data-close>Non, juste celui-ci</button><button class="btn primary" id="mpGo">Oui, tout marquer avant</button></div>`,
    (root) => {
      root.querySelector('#mpGo').onclick = () => {
        prevList.forEach(p => toggleSeen(sh, p.season, p.n, true));
        // Update the affected rows in place so the page doesn't jump back to the top.
        const seasons = new Set();
        prevList.forEach(p => {
          seasons.add(p.season);
          const body = document.getElementById('sea_' + p.season);
          const row = body && body.querySelector('.ep[data-n="' + p.n + '"]');
          if (row) { row.classList.add('seen'); const ck = row.querySelector('.check'); if (ck) ck.classList.add('on'); }
        });
        seasons.forEach(sn => {
          const body = document.getElementById('sea_' + sn);
          const c = document.getElementById('sea_' + sn + '_c');
          if (body && c) c.textContent = body.querySelectorAll('.ep.seen').length + ' / ' + body.querySelectorAll('.ep').length;
        });
        updateSyncStatus();
        closeModal();
        toast(`${cnt} épisode(s) marqué(s) comme vu(s)`);
        if (isShowComplete(sh)) celebrateCompletion(sh);
      };
    });
}

function addEpisodePrompt(sh, meta, presetSeason) {
  const custom = customEpsForShow(sh);
  const seasons = new Set();
  if (meta) for (const s of meta.seasons) seasons.add(s.n);
  for (const e of custom) seasons.add(e.s);
  const seasonList = Array.from(seasons).sort((a, b) => a - b);
  const defSeason = presetSeason != null ? presetSeason : (seasonList.length ? seasonList[seasonList.length - 1] : 1);
  const tmdbCnt = meta ? (meta.seasons.find(x => x.n === defSeason)?.count || 0) : 0;
  const custMax = Math.max(0, ...custom.filter(e => e.s === defSeason).map(e => e.n));
  const defN = Math.max(tmdbCnt, custMax) + 1;
  showModal(`<h2>Ajouter un épisode</h2>
    <p>Utile quand le nombre d'épisodes est incorrect (épisode manquant, spécial…).</p>
    <div class="modal-fields">
      <label class="field"><span>Saison</span><input class="input" id="aeS" type="number" min="1" value="${defSeason}"></label>
      <label class="field"><span>Épisode n°</span><input class="input" id="aeN" type="number" min="1" value="${defN}"></label>
    </div>
    <label class="field"><span>Titre (optionnel)</span><input class="input" id="aeT" placeholder="Titre de l'épisode"></label>
    <label class="check-row"><input type="checkbox" id="aeSeen" checked> Marquer comme vu tout de suite</label>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="aeGo">Ajouter</button></div>`,
    (root) => {
      root.querySelector('#aeGo').onclick = () => {
        const s = parseInt(root.querySelector('#aeS').value, 10);
        const n = parseInt(root.querySelector('#aeN').value, 10);
        if (!s || !n || s < 1 || n < 1) { toast('Saison / épisode invalide'); return; }
        const ok = addCustomEpisode(sh, s, n, root.querySelector('#aeT').value.trim());
        if (root.querySelector('#aeSeen').checked) toggleSeen(sh, s, n, true);
        closeModal(); render();
        toast(ok ? `Épisode ${s}×${String(n).padStart(2, '0')} ajouté` : 'Cet épisode existe déjà');
      };
    });
}

function markSeasonPrompt(sh, meta, tmdbId) {
  if (!meta) { toast('Clé TMDB requise'); return; }
  const seasons = meta.seasons.map(s => s.n);
  showModal(`<h2>Marquer une saison vue</h2>
    <p>Sélectionnez la saison à marquer entièrement comme vue.</p>
    <select class="input" id="mS">${seasons.map(s => `<option value="${s}">Saison ${s}</option>`).join('')}</select>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="mGo">Marquer vue</button></div>`,
    (root) => {
      root.querySelector('#mGo').onclick = async () => {
        const s = parseInt(root.querySelector('#mS').value, 10);
        const eps = await getSeasonEpisodes(tmdbId, s);
        eps.forEach(e => toggleSeen(sh, s, e.n, true));
        closeModal(); render(); toast(`Saison ${s} marquée vue`);
      };
    });
}

function starsHtml(id, val) {
  return `<span class="stars" data-id="${id}">${[1, 2, 3, 4, 5].map(v => `<span class="s ${v <= val ? 'on' : ''}" data-v="${v}">★</span>`).join('')}<button type="button" class="star-clear" title="Retirer ma note"${val > 0 ? '' : ' hidden'}>✕</button></span>`;
}
function updateStarsUI(target, val) {
  const list = (target && typeof target.forEach === 'function' && !(target instanceof Element)) ? target : [target];
  for (const c of list) { if (!c) continue; c.querySelectorAll('.s').forEach((s) => s.classList.toggle('on', parseInt(s.dataset.v, 10) <= val)); const clr = c.querySelector('.star-clear'); if (clr) clr.hidden = !(val > 0); }
}

//////////////////////// Up Next ////////////////////////
// Legacy #/upnext link -> now a tab inside the Séries page.
route('upnext', () => { seriesTab = 'asuivre'; location.hash = '#/home'; });

// "À suivre": next episode to watch for each followed series. Rendered inside the Séries page.
async function renderUpnext(el) {
  buildModel();
  if (!hasKey()) { el.innerHTML = needKeyHtml('« À suivre » a besoin des données TMDB pour connaître les épisodes disponibles.'); return; }
  el.innerHTML = `<div class="home-head" style="margin-bottom:14px"><span class="sub" id="upSub">Prochain épisode à regarder pour vos séries suivies</span>
    <div class="spacer"></div><button class="btn sm ghost" id="refreshUp">Actualiser</button></div>
    <div id="upList"><div class="loading">Analyse de vos séries…</div></div>`;
  el.querySelector('#refreshUp').onclick = () => render();

  const followed = Array.from(MODEL.shows.values()).filter(s => s.followed && !s.archived);
  const listEl = el.querySelector('#upList');
  const results = [];
  let done = 0;
  const queue = followed.slice();
  const setSub = (txt) => { const s = el.querySelector('#upSub'); if (s) s.textContent = txt; };
  const worker = async () => {
    while (queue.length) {
      const sh = queue.shift();
      done++;
      try {
        const next = await computeNextEpisode(sh);
        if (next) results.push({ sh, ...next });
      } catch {}
      setSub(`Analyse ${done}/${followed.length}…`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  setSub(`${results.length} série(s) à continuer`);

  results.sort((a, b) => (a.air || '9999').localeCompare(b.air || '9999'));
  if (!results.length) { listEl.innerHTML = `<div class="empty"><div class="big">🎉</div>Vous êtes à jour partout !</div>`; return; }
  listEl.innerHTML = results.map(r => `
    <div class="upnext-row" data-key="${esc(r.sh.key)}">
      <div class="poster">${posterHtml(r.sh, r.poster)}</div>
      <div class="info">
        <div class="sname">${esc(r.sh.name)}</div>
        <div class="ename">S${r.season}E${String(r.n).padStart(2, '0')} — ${esc(r.name || '')}</div>
        <div class="sub" style="font-size:12px">${r.air ? esc(r.air) : ''} · ${r.remaining} épisode(s) restant(s)</div>
      </div>
      <button class="btn primary" data-mark>✓ Vu</button>
      <button class="btn" data-open>Ouvrir</button>
    </div>`).join('');
  listEl.querySelectorAll('.upnext-row').forEach(row => {
    const r = results.find(x => x.sh.key === row.dataset.key);
    row.querySelector('[data-open]').onclick = () => openShow(r.sh.key);
    row.querySelector('[data-mark]').onclick = () => { toggleSeen(r.sh, r.season, r.n, true); toast('Marqué vu'); render(); };
  });
}

//////////////////////// Explorer (rechercher de nouvelles œuvres) ////////////////////////
route('explore', async (el) => {
  el.innerHTML = `
    <div class="page-head"><h1>🧭 Explorer</h1><span class="sub">Rechercher de nouvelles séries et films à ajouter</span></div>
    ${hasKey() ? `<div class="explore-search"><input class="input" id="expQ" placeholder="Rechercher une série ou un film…" autocomplete="off"></div>
    <div id="expResults" class="explore-results"><p class="home-empty">Tapez un titre ci-dessus pour trouver des séries et des films.</p></div>`
      : needKeyHtml("L'exploration a besoin d'une clé TMDB pour rechercher des séries et des films.")}`;
  if (!hasKey()) return;
  // Lookups to detect works already in the library (so search results aren't
  // shown as if brand new).
  buildModel();
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const showByTmdb = new Map(), showByName = new Map();
  for (const s of MODEL.shows.values()) {
    const tid = s.forcedTmdb || (s.tvdbId != null ? tmdbCache.map[s.tvdbId] : null);
    if (tid != null) showByTmdb.set(String(tid), s.key);
    showByName.set(norm(displayName(s)), s.key);
  }
  const allMovies = (DATA.movies || []).concat(userState.customMovies || []);
  const movieByTmdb = new Map(), movieByName = new Map();
  for (const m of allMovies) {
    const rec = userState.movieTmdb && userState.movieTmdb[m.name];
    if (rec && rec.id != null) movieByTmdb.set(String(rec.id), m.name);
    movieByName.set(norm(m.name), m.name);
  }
  const ownedKey = (h) => h.media_type === 'tv'
    ? (showByTmdb.get(String(h.id)) || showByName.get(norm(h.name || h.title || '')) || null)
    : (movieByTmdb.get(String(h.id)) || movieByName.get(norm(h.title || h.name || '')) || null);
  const input = el.querySelector('#expQ');
  const results = el.querySelector('#expResults');
  input.value = exploreQuery;
  let seq = 0, deb = null;
  const doSearch = async () => {
    const term = input.value.trim();
    if (term.length < 2) { results.innerHTML = `<p class="home-empty">Tapez un titre ci-dessus pour trouver des séries et des films.</p>`; return; }
    const my = ++seq;
    results.innerHTML = `<div class="loading">Recherche…</div>`;
    try {
      const res = await tmdbFetch(`/search/multi?query=${encodeURIComponent(term)}`);
      if (my !== seq) return;
      const hits = (res.results || []).filter(h => h.media_type === 'tv' || h.media_type === 'movie').slice(0, 24);
      if (!hits.length) { results.innerHTML = `<div class="empty">Aucun résultat.</div>`; return; }
      results.innerHTML = `<div class="ps-grid">` + hits.map((h, i) => {
        const name = h.name || h.title || '';
        const date = (h.first_air_date || h.release_date || '').slice(0, 4);
        const badge = h.media_type === 'tv' ? '📺 Série' : '🎬 Film';
        const im = h.poster_path ? `<img loading="lazy" src="${IMG(h.poster_path, 'w185')}" alt="">` : `<div class="fallback-title">${esc(name)}</div>`;
        const owned = !!ownedKey(h);
        return `<div class="exp-hit${owned ? ' owned' : ''}" data-open="${i}">
          <div class="ps-poster">${im}<span class="badge-tag">${badge}</span>
            ${owned ? `<span class="owned-badge">✓ Dans ma liste</span>` : `<button class="exp-add" data-add="${i}" title="Ajouter à mes suivies">＋</button>`}</div>
          <div class="ps-name">${esc(name)}${date ? ` <span>(${date})</span>` : ''}</div>
        </div>`;
      }).join('') + `</div>`;
      const addHit = (h) => { if (h.media_type === 'tv') addCustomShow(h); else addCustomMovie(h); };
      results.querySelectorAll('.exp-add').forEach(b => b.onclick = (ev) => {
        ev.stopPropagation();
        addHit(hits[parseInt(b.getAttribute('data-add'), 10)]);
        b.textContent = '✓';
      });
      results.querySelectorAll('.exp-hit').forEach(card => card.onclick = () => {
        const h = hits[parseInt(card.getAttribute('data-open'), 10)];
        const key = ownedKey(h);
        // Already in the library -> open the real tracked page, not a preview.
        if (key && h.media_type === 'tv') { openShow(key); return; }
        if (key && h.media_type === 'movie') { openMovie(key); return; }
        location.hash = '#/preview/' + (h.media_type === 'tv' ? 'tv' : 'movie') + '/' + h.id;
      });
    } catch { if (my === seq) results.innerHTML = `<div class="empty">Erreur de recherche.</div>`; }
  };
  input.oninput = () => { exploreQuery = input.value; clearTimeout(deb); deb = setTimeout(doSearch, 320); };
  if (exploreQuery.trim().length >= 2) doSearch(); else input.focus();
});

// Read-only preview of a TMDB work (from Explorer) — does NOT add it to the library.
route('preview', async (el, rest) => {
  const kind = rest[0];
  const id = parseInt(rest[1], 10);
  el.innerHTML = `<a class="btn ghost sm" href="#/explore">← Explorer</a><div id="pv"><div class="loading">Chargement de l'aperçu…</div></div>`;
  const pv = el.querySelector('#pv');
  if (!hasKey()) { pv.innerHTML = needKeyHtml("L'aperçu a besoin d'une clé TMDB."); return; }
  try {
    if (kind === 'tv') {
      const meta = await getShowMeta(id);
      const genres = meta.genres.join(' · ');
      pv.innerHTML = `
        <div class="detail-hero" style="margin-top:12px">
          <div class="bg" style="${meta.backdrop ? `background-image:url(${IMG(meta.backdrop, 'w780')})` : ''}"></div>
          <div class="inner">
            <div class="poster">${meta.poster ? `<img src="${IMG(meta.poster, 'w342')}" alt="">` : '<div class="ph">📺</div>'}</div>
            <div>
              <h1>${esc(meta.name)}</h1>
              <div class="sub">${esc((meta.firstAir || '').slice(0, 4))}${meta.status ? ' · ' + esc(statusFr(meta.status)) : ''} ${genres ? '· ' + esc(genres) : ''}</div>
              <div class="tags"><span class="chip">${meta.totalEpisodes || 0} épisode(s)</span>${meta.vote ? `<span class="chip">⭐ ${meta.vote.toFixed(1)}</span>` : ''}</div>
              <div class="overview">${esc(meta.overview || '')}</div>
              <div class="detail-actions"><button class="btn primary" id="pvAdd">➕ Ajouter à mes séries</button></div>
            </div>
          </div>
        </div>
        ${meta.seasons.length ? `<div class="pv-seasons">${meta.seasons.map(s => `<span class="chip">Saison ${s.n} · ${s.count} ép.</span>`).join('')}</div>` : ''}
        ${castHtml(meta.cast)}
        ${trailerHtml(meta.trailer)}`;
      wireTrailer(pv);
      pv.querySelector('#pvAdd').onclick = () => { addCustomShow({ id, name: meta.name, poster_path: meta.poster }); openShow('tmdb:' + id); };
    } else {
      const meta = await getMovieMeta(id);
      const genres = meta.genres.join(' · ');
      const rt = meta.runtime;
      pv.innerHTML = `
        <div class="detail-hero" style="margin-top:12px">
          <div class="bg" style="${meta.backdrop ? `background-image:url(${IMG(meta.backdrop, 'w780')})` : ''}"></div>
          <div class="inner">
            <div class="poster">${meta.poster ? `<img src="${IMG(meta.poster, 'w342')}" alt="">` : '<div class="ph">🎬</div>'}</div>
            <div>
              <h1>${esc(meta.title)}</h1>
              <div class="sub">${esc((meta.release || '').slice(0, 4))}${rt ? ' · ' + Math.floor(rt / 60) + 'h' + String(rt % 60).padStart(2, '0') : ''} ${genres ? '· ' + esc(genres) : ''}${meta.vote ? ' · ⭐ ' + meta.vote.toFixed(1) : ''}</div>
              ${meta.tagline ? `<div class="sub" style="font-style:italic;margin-top:4px">${esc(meta.tagline)}</div>` : ''}
              <div class="overview">${esc(meta.overview || '')}</div>
              <div class="detail-actions"><button class="btn primary" id="pvAdd">➕ Ajouter à mes films</button></div>
            </div>
          </div>
        </div>
        ${castHtml(meta.cast)}
        ${trailerHtml(meta.trailer)}`;
      wireTrailer(pv);
      pv.querySelector('#pvAdd').onclick = () => { addCustomMovie({ id, title: meta.title, release_date: meta.release, poster_path: meta.poster }); openMovie(meta.title); };
    }
  } catch { pv.innerHTML = `<div class="empty"><div class="big">⚠️</div>Impossible de charger l'aperçu.</div>`; }
});

async function computeNextEpisode(sh) {
  if (!sh.tvdbId) return null;
  const tmdbId = await resolveTmdbId(sh.tvdbId);
  if (!tmdbId) return null;
  const meta = await getShowMeta(tmdbId);
  const today = new Date();
  let remaining = 0, next = null;
  for (const s of meta.seasons) {
    const eps = await getSeasonEpisodes(tmdbId, s.n);
    for (const e of eps) {
      const aired = e.air ? new Date(e.air) <= today : false;
      if (!isSeen(sh, s.n, e.n) && aired) {
        remaining++;
        if (!next) next = { season: s.n, n: e.n, name: e.name, air: e.air, poster: meta.poster };
      }
    }
  }
  if (!next) return null;
  next.remaining = remaining;
  return next;
}

//////////////////////// Profil (hub) ////////////////////////
route('profile', async (el) => {
  buildModel();
  const shows = Array.from(MODEL.shows.values());
  const following = shows.filter(s => s.followed && !s.archived).length;
  const started = shows.filter(s => s.seenKeys.size > 0).length;
  const movies = (DATA.movies || []).concat(userState.customMovies || []);
  const moviesSeen = movies.filter(m => movieStatus(m) === 'watched').length;
  const seenCount = computeSeenCount();
  const favSeries = shows.filter(s => isFavShow(s)).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const favMovies = movies.filter(m => isFavMovie(m)).sort((a, b) => a.name.localeCompare(b.name));
  const favSection = (title, icon, count, gridId, inner) => `
    <div class="panel">
      <h3>${icon} ${title} <span class="count" style="color:var(--muted);font-weight:400">· ${count}</span></h3>
      ${count ? `<div class="grid" id="${gridId}">${inner}</div>` : `<p class="hint" style="color:var(--muted)">Aucun favori pour l'instant. Ouvrez une œuvre puis touchez « Favori ».</p>`}
    </div>`;
  el.innerHTML = `
    <div class="page-head"><h1>Profil</h1><span class="sub">Bonjour ${esc(userDisplayName())} 👋</span></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="k">Épisodes vus</div><div class="v">${seenCount}</div></div>
      <div class="stat-card"><div class="k">Séries suivies</div><div class="v">${following}</div></div>
      <div class="stat-card"><div class="k">Séries commencées</div><div class="v">${started}</div></div>
      <div class="stat-card"><div class="k">Films vus</div><div class="v">${moviesSeen}</div></div>
    </div>
    <div class="profile-menu" style="margin-bottom:22px">
      <a class="menu-card" href="#/library"><span class="ic">📚</span><b>Bibliothèque</b><small>Toutes vos œuvres — séries &amp; films</small></a>
      <a class="menu-card" href="#/stats"><span class="ic">📊</span><b>Statistiques</b><small>Séries &amp; films</small></a>
      <a class="menu-card" href="#/lists"><span class="ic">📃</span><b>Listes</b><small>Créez et modifiez vos listes</small></a>
      <a class="menu-card" href="#/settings"><span class="ic">⚙️</span><b>Réglages</b><small>Clé TMDB, synchronisation, sauvegarde</small></a>
      <a class="menu-card" href="#/changelog"><span class="ic">🆕</span><b>Notes de version</b><small>Les nouveautés de chaque mise à jour</small></a>
    </div>
    ${favSection('Séries favorites', '❤️', favSeries.length, 'favSeriesGrid', favSeries.map(s => cardHtml(s)).join(''))}
    ${favSection('Films favoris', '🎬', favMovies.length, 'favMoviesGrid', favMovies.map(m => movieCardHtml(m)).join(''))}`;

  const sg = el.querySelector('#favSeriesGrid');
  if (sg) {
    sg.querySelectorAll('.show-card').forEach(c => c.onclick = () => openShow(c.dataset.key));
    hydratePosters(sg, favSeries);
  }
  const mg = el.querySelector('#favMoviesGrid');
  if (mg) {
    wireMovieButtons(mg);
    hydrateMoviePosters(mg, favMovies);
  }
});

//////////////////////// Notes de version ////////////////////////
route('changelog', async (el) => {
  const entries = CHANGELOG.map(e => `
    <div class="panel cl-entry">
      <h3>${esc(e.title)} <span class="cl-date">${esc(e.date)}</span></h3>
      <ul class="cl-list">${e.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
    </div>`).join('');
  el.innerHTML = `
    <a class="btn ghost sm" href="#/profile">← Profil</a>
    <div class="page-head"><h1>🆕 Notes de version</h1><span class="sub">L'historique des nouveautés de l'application</span></div>
    ${entries}`;
});

//////////////////////// Stats ////////////////////////
route('stats', async (el) => {
  buildModel();
  const shows = Array.from(MODEL.shows.values());
  const seenCount = computeSeenCount();

  // time watched using cached runtimes where available
  let minutes = 0, withRuntime = 0;
  for (const sh of shows) {
    let rt = DEFAULT_RUNTIME;
    if (sh.tvdbId && tmdbCache.map[sh.tvdbId] && tmdbCache.shows[tmdbCache.map[sh.tvdbId]]) {
      const m = tmdbCache.shows[tmdbCache.map[sh.tvdbId]];
      if (m.runtime) { rt = m.runtime; withRuntime += sh.seenKeys.size; }
    }
    minutes += sh.seenKeys.size * rt;
  }
  const days = Math.floor(minutes / 1440), hrs = Math.floor((minutes % 1440) / 60);
  const followingN = shows.filter(s => s.followed && !s.archived).length;
  const startedN = shows.filter(s => s.seenKeys.size > 0).length;

  // emotions/reactions breakdown (star-meter reactions merged in)
  const emoCounts = {};
  for (const v of MODEL.emotionMap.values()) emoCounts[v] = (emoCounts[v] || 0) + 1;
  const emoTotal = Object.values(emoCounts).reduce((a, b) => a + b, 0) || 1;
  const knownEmoIds = new Set(EMOTIONS.map(e => e.id));
  let otherReactions = 0;
  for (const [id, c] of Object.entries(emoCounts)) if (!knownEmoIds.has(id)) otherReactions += c;

  // my personal star ratings for shows (1-5)
  const showRatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of shows) { const r = Math.round(s.showRating || 0); if (r >= 1 && r <= 5) showRatingCounts[r]++; }
  const ratedShows = Object.values(showRatingCounts).reduce((a, b) => a + b, 0);

  // activity by year
  const byYear = {};
  for (const d of MODEL.seenDates) { const y = (d || '').slice(0, 4); if (y) byYear[y] = (byYear[y] || 0) + 1; }
  const years = Object.keys(byYear).sort();

  // top shows
  const top = shows.filter(s => s.seenKeys.size).sort((a, b) => b.seenKeys.size - a.seenKeys.size).slice(0, 12);
  const maxTop = top.length ? top[0].seenKeys.size : 1;

  // ---- movie stats ----
  const allMovies = (DATA.movies || []).concat(userState.customMovies || []);
  const moviesWatched = allMovies.filter(m => movieStatus(m) === 'watched');
  const moviesToWatch = allMovies.filter(m => movieStatus(m) === 'towatch').length;
  const MOVIE_DEFAULT_RT = 115;
  let movMinutes = 0;
  for (const m of moviesWatched) { const rt = parseInt(m.runtime, 10); movMinutes += (isFinite(rt) && rt > 0) ? rt : MOVIE_DEFAULT_RT; }
  const movDays = Math.floor(movMinutes / 1440), movHrs = Math.floor((movMinutes % 1440) / 60);
  const movEmoCounts = {};
  for (const m of allMovies) { const e = movieEmotionOf(m); if (e) movEmoCounts[e] = (movEmoCounts[e] || 0) + 1; }
  const knownEmoIdsMov = new Set(EMOTIONS.map(e => e.id));
  let movOtherReactions = 0;
  for (const [id, c] of Object.entries(movEmoCounts)) if (!knownEmoIdsMov.has(id)) movOtherReactions += c;
  const movEmoTotal = Object.values(movEmoCounts).reduce((a, b) => a + b, 0);
  const movMyRatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const m of allMovies) { const r = movieRatingOf(m); if (r >= 1 && r <= 5) movMyRatingCounts[r]++; }
  const myRatedMovies = Object.values(movMyRatingCounts).reduce((a, b) => a + b, 0);
  const movByYear = {};
  for (const m of moviesWatched) { const y = (movieWatchedOf(m) || '').slice(0, 4); if (y) movByYear[y] = (movByYear[y] || 0) + 1; }
  const movYears = Object.keys(movByYear).sort();

  el.innerHTML = `
    <div class="page-head"><h1>Statistiques</h1><span class="sub">Bonjour ${esc(userDisplayName())} 👋</span></div>
    <div class="page-head" style="margin-top:6px"><h1>📺 Séries</h1><span class="sub">Vos statistiques séries</span></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="k">Épisodes vus</div><div class="v">${seenCount}</div></div>
      <div class="stat-card"><div class="k">Temps de visionnage</div><div class="v">${days}<small> j</small> ${hrs}<small> h</small></div></div>
      <div class="stat-card"><div class="k">Séries suivies</div><div class="v">${followingN}</div></div>
      <div class="stat-card"><div class="k">Séries commencées</div><div class="v">${startedN}</div></div>
      <div class="stat-card"><div class="k">Réactions</div><div class="v">${MODEL.emotionMap.size}</div></div>
    </div>
    ${!hasKey() ? `<div class="panel"><p style="color:var(--muted);margin:0">⏱️ Le temps de visionnage est estimé à ${DEFAULT_RUNTIME} min/épisode. Ajoutez une clé TMDB (Réglages) puis « Synchroniser » pour des durées exactes.</p></div>` : ''}

    <div class="panel"><h3>🏆 Top séries (épisodes vus)</h3>
      ${top.map(s => barRow(esc(s.name), s.seenKeys.size, maxTop)).join('') || '<p class="hint">—</p>'}
    </div>
    <div class="panel"><h3>😍 Réactions</h3>
      <p class="hint" style="color:var(--muted);margin:.2rem 0 .6rem">Vos réactions aux épisodes, importées de TV Time (le « star-meter » : Génial, Bien, Waouh, Bof…).</p>
      ${(() => {
        const rows = EMOTIONS.filter(e => emoCounts[e.id]).sort((a, b) => emoCounts[b.id] - emoCounts[a.id]).map(e => barRow(`${e.emoji} ${e.label}`, emoCounts[e.id], emoTotal)).join('');
        const other = otherReactions ? barRow('🎬 Autres réactions', otherReactions, emoTotal) : '';
        return (rows + other) || '<p class="hint">Aucune réaction.</p>';
      })()}
    </div>
    <div class="panel"><h3>⭐ Mes notes</h3>
      <p class="hint" style="color:var(--muted);margin:.2rem 0 .6rem">Vos notes personnelles (1 à 5 ★), différentes des réactions. Notez une série depuis sa fiche pour l'ajouter ici.</p>
      ${ratedShows ? [5, 4, 3, 2, 1].map(v => barRow('★'.repeat(v), showRatingCounts[v], Math.max(1, ...Object.values(showRatingCounts)))).join('') : '<p class="hint">Aucune note pour l\'instant.</p>'}
    </div>
    <div class="panel"><h3>📅 Activité par année</h3>
      ${years.map(y => barRow(y, byYear[y], Math.max(...years.map(z => byYear[z])))).join('') || '<p class="hint">—</p>'}
    </div>

    <div class="page-head" style="margin-top:22px"><h1>🎬 Films</h1><span class="sub">Vos statistiques cinéma</span></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="k">Films vus</div><div class="v">${moviesWatched.length}</div></div>
      <div class="stat-card"><div class="k">Temps de visionnage</div><div class="v">${movDays}<small> j</small> ${movHrs}<small> h</small></div></div>
      <div class="stat-card"><div class="k">Films à voir</div><div class="v">${moviesToWatch}</div></div>
      <div class="stat-card"><div class="k">Réactions</div><div class="v">${movEmoTotal}</div></div>
    </div>
    <div class="panel"><p style="color:var(--muted);margin:0">⏱️ Durée estimée à ${MOVIE_DEFAULT_RT} min/film lorsque la durée réelle est inconnue.</p></div>
    <div class="panel"><h3>😍 Réactions</h3>
      <p class="hint" style="color:var(--muted);margin:.2rem 0 .6rem">Vos réactions aux films, importées de TV Time (le « star-meter » : Génial, Bien, Waouh, Bof…).</p>
      ${(() => {
        const rows = EMOTIONS.filter(e => movEmoCounts[e.id]).sort((a, b) => movEmoCounts[b.id] - movEmoCounts[a.id]).map(e => barRow(`${e.emoji} ${e.label}`, movEmoCounts[e.id], movEmoTotal)).join('');
        const other = movOtherReactions ? barRow('🎬 Autres réactions', movOtherReactions, movEmoTotal) : '';
        return (rows + other) || '<p class="hint">Aucune réaction.</p>';
      })()}
    </div>
    <div class="panel"><h3>⭐ Mes notes</h3>
      <p class="hint" style="color:var(--muted);margin:.2rem 0 .6rem">Vos notes personnelles (1 à 5 ★), différentes des réactions. Notez un film depuis sa fiche (« Ma note ») pour l'ajouter ici.</p>
      ${myRatedMovies ? [5, 4, 3, 2, 1].map(v => barRow('★'.repeat(v), movMyRatingCounts[v], Math.max(1, ...Object.values(movMyRatingCounts)))).join('') : '<p class="hint">Aucune note pour l\'instant.</p>'}
    </div>
    <div class="panel"><h3>📅 Films vus par année</h3>
      ${movYears.length ? movYears.map(y => barRow(y, movByYear[y], Math.max(...movYears.map(z => movByYear[z])))).join('') : '<p class="hint">Les dates de visionnage sont enregistrées à partir de maintenant, quand vous marquez un film comme vu.</p>'}
    </div>`;
});
function barRow(label, val, max) {
  const pct = Math.round((val / (max || 1)) * 100);
  return `<div class="bar-row"><span class="lbl">${label}</span><span class="track"><i style="width:${pct}%"></i></span><span class="val">${val}</span></div>`;
}

//////////////////////// Lists ////////////////////////
route('lists', async (el) => {
  buildModel();
  const allMovies = (DATA.movies || []).concat(userState.customMovies || []);
  const movieByName = Object.fromEntries(allMovies.map(m => [m.name, m]));
  const imported = (DATA.lists || []).filter(l => (l.items || []).length);

  function draw() {
    const lists = getUserLists();
    el.innerHTML = `
      <div class="page-head"><h1>Listes</h1><span class="sub">${lists.length} liste(s)</span>
        <div class="spacer"></div><button class="btn primary" id="newList">＋ Nouvelle liste</button></div>
      ${lists.length ? '' : `<div class="empty"><div class="big">📃</div>Aucune liste. Créez-en une, puis ajoutez des séries et des films depuis leur fiche (« Ajouter à une liste »).</div>`}
      ${lists.map(l => {
        const shows = (l.shows || []).map(k => MODEL.shows.get(k)).filter(Boolean);
        const movies = (l.movies || []).map(n => movieByName[n]).filter(Boolean);
        const n = shows.length + movies.length;
        return `<div class="panel">
          <h3>${esc(l.name)} <span class="count" style="color:var(--muted);font-weight:400">· ${n} élément(s)</span>
            <span style="float:right;display:flex;gap:6px">
              <button class="btn sm" data-rename="${esc(l.id)}">✏️ Renommer</button>
              <button class="btn sm danger" data-dellist="${esc(l.id)}">🗑 Supprimer</button>
            </span></h3>
          ${n ? `<div class="grid">
            ${shows.map(s => `<div class="list-item" data-open-show="${esc(s.key)}">${cardHtml(s)}<button class="list-remove" data-rmshow="${esc(l.id)}|${esc(s.key)}" title="Retirer de la liste">✕</button></div>`).join('')}
            ${movies.map(m => `<div class="list-item" data-open-movie="${esc(m.name)}">${movieCardHtml(m)}<button class="list-remove" data-rmmovie="${esc(l.id)}|${esc(m.name)}" title="Retirer de la liste">✕</button></div>`).join('')}
          </div>` : `<p class="hint" style="color:var(--muted)">Liste vide — ajoutez des œuvres depuis leur fiche.</p>`}
        </div>`;
      }).join('')}
      ${imported.length ? `<div class="page-head" style="margin-top:22px"><h1>Listes importées</h1><span class="sub">Depuis TV Time · lecture seule</span></div>
        ${imported.map((l, i) => `<div class="panel"><h3>${esc(l.name || 'Liste ' + (i + 1))} <span class="count" style="color:var(--muted);font-weight:400">· ${(l.items || []).length} éléments</span></h3>
          <div class="grid" id="implist_${i}"></div></div>`).join('')}` : ''}`;

    el.querySelector('#newList').onclick = () => {
      showModal(`<h2>Nouvelle liste</h2>
        <label class="field"><span>Nom</span><input class="input" id="nlName" placeholder="Ex. À regarder ce week-end"></label>
        <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="nlGo">Créer</button></div>`,
        (root) => {
          const go = () => { const name = root.querySelector('#nlName').value.trim(); if (!name) { toast('Nom requis'); return; } createList(name); closeModal(); draw(); };
          root.querySelector('#nlGo').onclick = go;
          root.querySelector('#nlName').onkeydown = (e) => { if (e.key === 'Enter') go(); };
        });
    };
    el.querySelectorAll('[data-rename]').forEach(b => b.onclick = () => {
      const id = b.dataset.rename; const cur = getUserLists().find(x => x.id === id);
      showModal(`<h2>Renommer la liste</h2>
        <label class="field"><span>Nom</span><input class="input" id="rnName" value="${esc(cur ? cur.name : '')}"></label>
        <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="rnGo">Enregistrer</button></div>`,
        (root) => {
          const go = () => { renameList(id, root.querySelector('#rnName').value); closeModal(); draw(); };
          root.querySelector('#rnGo').onclick = go;
          root.querySelector('#rnName').onkeydown = (e) => { if (e.key === 'Enter') go(); };
        });
    });
    el.querySelectorAll('[data-dellist]').forEach(b => b.onclick = () => {
      const id = b.dataset.dellist; const cur = getUserLists().find(x => x.id === id);
      showModal(`<h2>Supprimer la liste ?</h2><p>« ${esc(cur ? cur.name : '')} » sera définitivement supprimée. Les séries et films ne sont pas affectés.</p>
        <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" id="dlGo">Supprimer</button></div>`,
        (root) => { root.querySelector('#dlGo').onclick = () => { deleteList(id); closeModal(); draw(); toast('Liste supprimée'); }; });
    });
    el.querySelectorAll('[data-rmshow]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const [id, key] = b.dataset.rmshow.split('|'); listToggleShow(id, key); draw(); });
    el.querySelectorAll('[data-rmmovie]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const [id, name] = b.dataset.rmmovie.split('|'); listToggleMovie(id, name); draw(); });
    el.querySelectorAll('[data-open-show]').forEach(c => c.onclick = (ev) => { if (ev.target.closest('.list-remove')) return; openShow(c.dataset.openShow); });
    el.querySelectorAll('[data-open-movie]').forEach(c => c.onclick = (ev) => { if (ev.target.closest('.list-remove')) return; openMovie(c.dataset.openMovie); });

    // hydrate posters for user-list items
    const sList = lists.flatMap(l => (l.shows || []).map(k => MODEL.shows.get(k)).filter(Boolean));
    if (sList.length) hydratePosters(el, sList);
    const mList = lists.flatMap(l => (l.movies || []).map(n => movieByName[n]).filter(Boolean));
    if (mList.length) hydrateMoviePosters(el, mList);

    // imported lists (read-only, resolved via TMDB)
    imported.forEach(async (l, i) => {
      const grid = el.querySelector('#implist_' + i);
      if (!grid) return;
      if (!hasKey()) { grid.innerHTML = `<p class="hint" style="grid-column:1/-1;color:var(--muted)">Ajoutez une clé TMDB pour afficher les affiches.</p>`; return; }
      grid.innerHTML = (l.items || []).map(it => `<div class="show-card"><div class="poster" data-lid="${esc(it.id)}" data-type="${esc(it.type)}"><div class="ph">🎬</div></div></div>`).join('');
      for (const slot of grid.querySelectorAll('[data-lid]')) {
        try {
          const type = slot.dataset.type === 'movie' ? 'movie' : 'tv';
          const res = await tmdbFetch(`/find/${slot.dataset.lid}?external_source=tvdb_id`);
          const hit = (type === 'movie' ? res.movie_results : res.tv_results)?.[0] || res.tv_results?.[0] || res.movie_results?.[0];
          if (hit && hit.poster_path) slot.innerHTML = `<img loading="lazy" src="${IMG(hit.poster_path)}">`;
          else if (hit) slot.innerHTML = `<div class="fallback-title">${esc(hit.name || hit.title)}</div>`;
        } catch {}
      }
    });
  }
  draw();
});

//////////////////////// Settings ////////////////////////
route('settings', async (el) => {
  el.innerHTML = `
    <div class="page-head"><h1>Réglages</h1></div>
    <div class="panel">
      <div class="settings-field">
        <label>Mon nom</label>
        <input class="input" id="profileName" placeholder="Votre nom" value="${esc(userState.profileName || '')}">
        <div class="hint">Le nom affiché dans « Bonjour … » (Profil et Statistiques). Pratique si vous partagez l'application.</div>
      </div>
      <div class="row" style="display:flex;gap:10px">
        <button class="btn primary" id="saveName">Enregistrer</button>
        <span id="nameStatus" class="sub" style="align-self:center"></span>
      </div>
    </div>
    <div class="panel">
      <div class="settings-field">
        <label>Clé API TMDB</label>
        <input class="input" id="tmdbKey" placeholder="Collez votre clé API TMDB (v3)" value="${esc(userState.tmdbKey)}">
        <div class="hint">Gratuit : créez un compte sur <b>themoviedb.org</b> → Paramètres → API → demandez une clé « Developer ». Copiez la <b>clé API (v3 auth)</b>. Elle permet d'afficher les affiches, la liste complète des épisodes, les dates de diffusion et « À suivre ».</div>
      </div>
      <div class="row" style="display:flex;gap:10px">
        <button class="btn primary" id="saveKey">Enregistrer</button>
        <button class="btn" id="testKey">Tester la clé</button>
        <span id="keyStatus" class="sub" style="align-self:center"></span>
      </div>
    </div>

    <div class="panel">
      <h3>Synchronisation</h3>
      <p class="hint" style="color:var(--muted)">Pré-charge les affiches et épisodes de vos séries et les affiches de vos films (recommandé pour « À suivre », le temps de visionnage exact et les affiches manquantes). ${Object.keys(tmdbCache.shows).length} série(s) et ${Object.keys(tmdbCache.movies || {}).length} film(s) en cache.</p>
      <div class="row" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="syncAll">Synchroniser toutes mes œuvres</button><span id="syncProg" class="sub" style="align-self:center"></span></div>
    </div>

    <div class="panel">
      <h3>Sauvegarde</h3>
      <p class="hint" style="color:var(--muted)">${serverAvailable
        ? 'Vos ajouts (épisodes vus, notes, réactions) sont enregistrés dans <b>userdata.json</b> à côté de l\'application.'
        : 'Mode autonome : vos ajouts sont enregistrés <b>sur cet appareil</b> (stockage du navigateur). Pensez à exporter une sauvegarde de temps en temps.'}<br>
      « Exporter » crée une <b>sauvegarde complète</b> (tout votre historique + vos ajouts). « Importer » la restaure entièrement, y compris sur un autre appareil.</p>
      <div class="row" style="display:flex;gap:10px">
        <button class="btn" id="exportBtn">Exporter mes données</button>
        <label class="btn" style="cursor:pointer">Importer<input type="file" id="importFile" accept="application/json" hidden></label>
      </div>
    </div>

    <div class="panel">
      <h3>Partager ma liste</h3>
      <p class="hint" style="color:var(--muted)">Crée un fichier avec vos séries et films <b>sans l'historique</b> (rien n'est marqué comme vu). La personne qui le reçoit clique sur <b>« Importer »</b> ci-dessus : ses propres œuvres sont <b>conservées</b>, les vôtres viennent s'ajouter (sans doublon).</p>
      <button class="btn" id="shareBtn">Partager ma liste (sans l'historique)</button>
    </div>

    <div class="panel">
      <h3>À propos</h3>
      <p class="hint" style="color:var(--muted)"><b>TV Time</b> · version ${APP_VERSION}<br>
      Données importées le ${esc((DATA.generatedAt || '').replace('T', ' '))}. Compte : ${esc(DATA.user?.mail || '')}.<br>
      ${(DATA.shows || []).length} séries · ${(DATA.seen || []).length} épisodes vus · ${((DATA.emotions || []).length + (DATA.episodeRatings || []).length)} réactions.</p>
      <p style="margin-top:10px"><a class="btn ghost sm" href="#/changelog">🆕 Notes de version</a></p>
    </div>`;

  el.querySelector('#saveName').onclick = () => { userState.profileName = el.querySelector('#profileName').value.trim(); scheduleSaveState(); el.querySelector('#nameStatus').textContent = '✅ Enregistré'; toast('Nom enregistré'); };
  el.querySelector('#saveKey').onclick = () => { userState.tmdbKey = el.querySelector('#tmdbKey').value.trim(); scheduleSaveState(); updateSyncStatus(); toast('Clé enregistrée'); };
  el.querySelector('#testKey').onclick = async () => {
    const st = el.querySelector('#keyStatus'); st.textContent = 'Test…';
    userState.tmdbKey = el.querySelector('#tmdbKey').value.trim();
    try { await tmdbFetch('/configuration'); st.textContent = '✅ Clé valide'; scheduleSaveState(); }
    catch { st.textContent = '❌ Clé invalide'; }
  };
  el.querySelector('#syncAll').onclick = () => syncEverything(el.querySelector('#syncProg'));
  el.querySelector('#exportBtn').onclick = exportData;
  el.querySelector('#shareBtn').onclick = exportSharedList;
  el.querySelector('#importFile').onchange = importData;
});

async function syncEverything(progEl) {
  if (!hasKey()) { toast('Ajoutez d\'abord une clé TMDB'); return; }
  await syncAllShows(progEl);
  await syncAllMovies(progEl);
  if (progEl) progEl.textContent = '✅ Terminé';
  toast('Synchronisation terminée');
}

async function syncAllShows(progEl) {
  buildModel();
  const shows = Array.from(MODEL.shows.values()).filter(s => (s.followed || s.seenKeys.size) && s.tvdbId);
  let done = 0;
  const queue = shows.slice();
  const worker = async () => {
    while (queue.length) {
      const sh = queue.shift();
      try {
        const id = await resolveTmdbId(sh.tvdbId);
        if (id) { const m = await getShowMeta(id); for (const s of m.seasons) await getSeasonEpisodes(id, s.n); }
      } catch {}
      done++; if (progEl) progEl.textContent = `Séries ${done}/${shows.length}…`;
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  scheduleSaveCache();
}

async function syncAllMovies(progEl) {
  const movies = (DATA.movies || []).concat(userState.customMovies || []);
  let done = 0;
  const queue = movies.slice();
  const worker = async () => {
    while (queue.length) {
      const m = queue.shift();
      try { await resolveMovie(m.name, movieYear(m)); } catch {}
      done++; if (progEl) progEl.textContent = `Films ${done}/${movies.length}…`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  scheduleSaveCache();
}

function exportData() {
  // Full backup: catalogue complet (historique) + éditions utilisateur.
  const backup = {
    format: 'tvtime-full',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: DATA,
    userState: userState,
  };
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'tvtime-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}
const _normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
// Export just the LIST of series & movies (no watch history at all), to share
// with a friend. When imported, nothing is marked as seen.
function exportSharedList() {
  const shows = [];
  for (const s of (DATA.shows || [])) shows.push({ tvdbId: s.tvdbId ?? null, name: s.name });
  for (const cs of (userState.customShows || [])) shows.push({ tmdbId: cs.tmdbId ?? null, name: cs.name, poster: cs.poster || null });
  const movies = [];
  for (const m of (DATA.movies || [])) movies.push({ name: m.name, releaseDate: m.releaseDate || '', runtime: m.runtime || 0 });
  for (const cm of (userState.customMovies || [])) movies.push({ name: cm.name, releaseDate: cm.releaseDate || '', runtime: cm.runtime || 0 });
  const payload = { format: 'tvtime-sharedlist', exportedAt: new Date().toISOString(), shows, movies };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'tvtime-liste-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  toast(`Liste exportée : ${shows.length} série(s), ${movies.length} film(s)`);
}
// Merge a shared list into MY data WITHOUT overwriting anything I already have,
// and WITHOUT marking anything as seen.
async function mergeSharedList(parsed) {
  DATA.shows = Array.isArray(DATA.shows) ? DATA.shows : [];
  DATA.movies = Array.isArray(DATA.movies) ? DATA.movies : [];
  userState.customShows = userState.customShows || [];
  userState.customMovies = userState.customMovies || [];
  const haveTvdb = new Set(DATA.shows.map(s => String(s.tvdbId)));
  const haveShowName = new Set(DATA.shows.map(s => _normName(s.name)).concat((userState.customShows).map(s => _normName(s.name))));
  const haveMovie = new Set(DATA.movies.map(m => _normName(m.name)).concat((userState.customMovies).map(m => _normName(m.name))));
  let addedShows = 0, addedMovies = 0;
  const now = new Date().toISOString();
  for (const s of (parsed.shows || [])) {
    const nm = _normName(s.name);
    if (!nm) continue;
    if ((s.tvdbId != null && haveTvdb.has(String(s.tvdbId))) || haveShowName.has(nm)) continue;
    if (s.tvdbId == null && s.tmdbId != null) {
      userState.customShows.push({ key: 'tmdb:' + s.tmdbId, tmdbId: s.tmdbId, name: s.name, poster: s.poster || null, addedAt: now });
    } else {
      DATA.shows.push({ tvdbId: s.tvdbId ?? null, name: s.name, followed: true, nbEpisodesSeen: 0, showRating: null, favorited: false, archived: false, createdAt: now });
      if (s.tvdbId != null) haveTvdb.add(String(s.tvdbId));
    }
    haveShowName.add(nm); addedShows++;
  }
  for (const m of (parsed.movies || [])) {
    const nm = _normName(m.name);
    if (!nm || haveMovie.has(nm)) continue;
    userState.customMovies.push({ name: m.name, releaseDate: m.releaseDate || '', runtime: m.runtime || 0, status: 'towatch', addedAt: now });
    haveMovie.add(nm); addedMovies++;
  }
  await persistDataOverride(DATA);
  scheduleSaveState();
  MODEL = null;
  render();
  toast(`Ajouté : ${addedShows} série(s), ${addedMovies} film(s)`);
}
// Replace the in-memory catalogue in place (DATA is a const reference).
function applyDataObject(obj) {
  for (const k of Object.keys(DATA)) delete DATA[k];
  Object.assign(DATA, obj);
  // Defensive : un import corrompu peut transformer des tableaux en objets ;
  // on les recoerce pour que l'app ne plante jamais sur une itération.
  for (const k of ['shows', 'seen', 'movies', 'emotions', 'episodeRatings', 'rewatched', 'lists', 'latest', 'movieRatings']) {
    if (DATA[k] != null && !Array.isArray(DATA[k])) DATA[k] = Object.values(DATA[k]);
  }
}
async function persistDataOverride(obj) {
  await idbSet('dataOverride', obj);
  try { localStorage.setItem('montvtime_dataOverride', JSON.stringify(obj)); } catch {}
}
function importData(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const parsed = JSON.parse(r.result);
      if (parsed && parsed.format === 'tvtime-sharedlist') {
        // Liste partagée par un ami : on fusionne sans rien écraser ni marquer vu.
        await mergeSharedList(parsed);
        return;
      }
      const cat = parsed && parsed.data && (parsed.data.shows || parsed.data.seen) ? parsed.data : null;
      if (cat) {
        // Sauvegarde complète : restaure le catalogue (historique) durablement.
        applyDataObject(cat);
        await persistDataOverride(cat);
        if (parsed.userState && typeof parsed.userState === 'object') userState = Object.assign(userState, parsed.userState);
        scheduleSaveState();
        MODEL = null;
        toast('Sauvegarde complète restaurée');
        render();
      } else {
        // Ancien format : uniquement les éditions utilisateur.
        userState = Object.assign(userState, parsed);
        scheduleSaveState();
        toast('Données importées');
        render();
      }
    } catch { toast('Fichier invalide'); }
  };
  r.readAsText(f);
}

//////////////////////// Modal ////////////////////////
function showModal(html, onReady) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="backdrop"><div class="modal">${html}</div></div>`;
  root.querySelector('.backdrop').onclick = (e) => { if (e.target.classList.contains('backdrop')) closeModal(); };
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  if (onReady) onReady(root);
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

// Pop-up « Nouveautés » : au premier lancement suivant une mise à jour, liste les
// notes de version ajoutées depuis la dernière visite. Fermée = marquée comme vue.
function maybeShowChangelogPopup() {
  const newest = CHANGELOG.length ? (CHANGELOG[0].id || 0) : 0;
  const seen = userState.seenChangelog || 0;
  const fresh = CHANGELOG.filter(e => (e.id || 0) > seen);
  if (!fresh.length || newest <= seen) return;
  // Marqué vu tout de suite : ne réapparaît pas, même fermé en touchant à côté.
  userState.seenChangelog = newest;
  scheduleSaveState();
  const body = fresh.map(e => `
    <div class="cl-modal-entry">
      <h4>${esc(e.title)} <span class="cl-date">${esc(e.date)}</span></h4>
      <ul class="cl-list">${e.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
    </div>`).join('');
  showModal(`
    <h2 style="margin:0 0 4px">🆕 Nouveautés</h2>
    <p class="hint" style="color:var(--muted);margin:0 0 12px">Ce qui a changé depuis votre dernière visite.</p>
    <div class="cl-modal-body">${body}</div>
    <div class="modal-actions" style="margin-top:14px;display:flex;justify-content:flex-end">
      <button class="btn primary" data-close>J'ai compris</button>
    </div>`);
}

function needKeyHtml(msg) {
  return `<div class="empty"><div class="big">🔑</div><p>${esc(msg)}</p><a class="btn primary" href="#/settings">Ajouter une clé TMDB</a></div>`;
}

//////////////////////// Sync status ////////////////////////
function updateSyncStatus() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = hasKey() ? 'TMDB ✓' : 'Hors-ligne';
}

//////////////////////// Boot ////////////////////////
(async function boot() {
  // Demande au navigateur de conserver nos données (pas d'éviction automatique) :
  // ainsi une réinstallation / mise à jour à la MÊME adresse récupère tout seule.
  try { if (navigator.storage?.persist) { if (!(await navigator.storage.persisted())) await navigator.storage.persist(); } } catch {}
  // Detect whether the local PowerShell server is present.
  const st = await apiGet('/api/state');
  serverAvailable = (st !== null);

  if (serverAvailable) {
    const cache = await apiGet('/api/cache');
    if (st && typeof st === 'object') userState = Object.assign(userState, st);
    if (cache && cache.map) tmdbCache = Object.assign(tmdbCache, cache);
  } else {
    // Standalone / PWA mode: load from IndexedDB on the device, with a
    // localStorage fallback (more reliable when opened from a local file://),
    // then seed from data bundled into the app on first run.
    let us = await idbGet('userState');
    let tc = await idbGet('tmdbCache');
    if (!us) { try { const ls = localStorage.getItem('montvtime_userState'); if (ls) us = JSON.parse(ls); } catch {} }
    if (!us && window.SEED_USERDATA) us = window.SEED_USERDATA;
    if ((!tc || !tc.map) && window.SEED_CACHE) tc = window.SEED_CACHE;
    if (us && typeof us === 'object') userState = Object.assign(userState, us);
    if (tc && tc.map) tmdbCache = Object.assign(tmdbCache, tc);
  }

  // Restore a full-backup catalogue (imported once) so history survives reloads,
  // even on a blank/hosted build. The richer dataset wins.
  try {
    let ov = await idbGet('dataOverride');
    if (!ov) { try { const ls = localStorage.getItem('montvtime_dataOverride'); if (ls) ov = JSON.parse(ls); } catch {} }
    if (ov && (ov.seen?.length || 0) > (DATA.seen?.length || 0)) applyDataObject(ov);
  } catch {}

  applyTmdbOverrides();
  updateSyncStatus();
  if (!location.hash) location.hash = '#/home';
  render();
  maybeShowChangelogPopup();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
