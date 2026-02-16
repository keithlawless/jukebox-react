const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function fetchJson(path, options = {}) {
  const response = await fetch(buildUrl(path), options);
  if (!response.ok) {
    throw new Error(`Request failed for ${path} (${response.status})`);
  }

  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }

  return JSON.parse(bodyText);
}

function sortByName(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function decodeMrlName(mrl) {
  if (!mrl || typeof mrl !== 'string') {
    return '';
  }

  const trimmed = mrl.endsWith('/') ? mrl.slice(0, -1) : mrl;
  const segment = trimmed.split('/').pop() ?? trimmed;
  return safeDecode(segment);
}

function normalizeFolderItem(mrl, index, fallbackLabel) {
  const name = decodeMrlName(mrl) || `${fallbackLabel} ${index + 1}`;

  return {
    id: mrl,
    name,
    mrl,
  };
}

function buildSongMrl(albumMrl, fileValue) {
  if (fileValue.startsWith('file://')) {
    return fileValue;
  }

  const cleanAlbumMrl = albumMrl.endsWith('/') ? albumMrl : `${albumMrl}/`;
  return `${cleanAlbumMrl}${safeDecode(fileValue)}`;
}

async function getFolderListing(entryPoint = '') {
  const normalizedEntryPoint = entryPoint ? safeDecode(entryPoint) : '';
  const query = normalizedEntryPoint ? `?entryPoint=${encodeURIComponent(normalizedEntryPoint)}` : '';
  return fetchJson(`/api/folder/list${query}`);
}

async function getTagForMrl(mrl) {
  const normalizedMrl = safeDecode(mrl);
  if (!normalizedMrl) {
    return null;
  }

  return fetchJson(`/api/tag/read?mrl=${encodeURIComponent(normalizedMrl)}`);
}

function getFriendlySongTitle(tagPayload, fallbackName) {
  if (!tagPayload || typeof tagPayload !== 'object') {
    return fallbackName;
  }

  const source = tagPayload.tag ?? tagPayload.data ?? tagPayload;
  const title = source?.title;
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }

  return fallbackName;
}

export async function getArtists() {
  const folder = await getFolderListing();
  const artists = (folder.folders ?? []).map((mrl, index) => normalizeFolderItem(mrl, index, 'Artist'));
  return sortByName(artists);
}

export async function getAlbumsByArtist(artist) {
  const folder = await getFolderListing(artist.mrl ?? artist.id);
  const albums = (folder.folders ?? []).map((mrl, index) => normalizeFolderItem(mrl, index, 'Album'));
  return sortByName(albums);
}

export async function getSongsByAlbum(album) {
  const albumMrl = album.mrl ?? album.id;
  const folder = await getFolderListing(albumMrl);

  const songs = await Promise.all((folder.files ?? []).map(async (fileValue, index) => {
    const id = buildSongMrl(albumMrl, fileValue);
    const baseName = decodeMrlName(fileValue) || decodeMrlName(id) || `Song ${index + 1}`;

    let friendlyName = baseName;
    try {
      const tagPayload = await getTagForMrl(id);
      friendlyName = getFriendlySongTitle(tagPayload, baseName);
    } catch {
      friendlyName = baseName;
    }

    return {
      id,
      name: friendlyName,
      mrl: id,
    };
  }));

  return sortByName(songs);
}

export async function addSongToQueue(song) {
  const normalizedMrl = safeDecode(song.mrl ?? song.id ?? '');
  await fetchJson(`/api/queue/add?mrl=${encodeURIComponent(normalizedMrl)}`, {
    method: 'POST',
  });
}

export async function getQueueState() {
  const payload = await fetchJson('/api/queue/list');
  const queue = Array.isArray(payload?.queue) ? payload.queue : [];

  return queue.map((item, index) => ({
    id: item.mrl ?? item.title ?? `queue-${index}`,
    mrl: item.mrl,
    name: item.title ?? decodeMrlName(item.mrl) ?? `Song ${index + 1}`,
    artistName: item.artist ?? 'Unknown Artist',
    albumName: item.album ?? 'Unknown Album',
  }));
}

export async function getRadioStations() {
  const payload = await fetchJson('/api/radio/list');
  const stationList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.stations)
      ? payload.stations
      : [];

  const normalizedStations = stationList
    .map((station, index) => {
      if (typeof station === 'string') {
        const mrl = safeDecode(station);
        return {
          id: mrl || `radio-${index}`,
          mrl,
          name: decodeMrlName(mrl) || `Station ${index + 1}`,
        };
      }

      const mrl = safeDecode(station?.mrl ?? station?.id ?? station?.url ?? '');
      if (!mrl) {
        return null;
      }

      return {
        id: mrl,
        mrl,
        name: station?.description ?? station?.title ?? station?.name ?? (decodeMrlName(mrl) || `Station ${index + 1}`),
      };
    })
    .filter(Boolean);

  return sortByName(normalizedStations);
}

export async function playRadioStation(station) {
  const normalizedMrl = safeDecode(station?.mrl ?? station?.id ?? '');
  if (!normalizedMrl) {
    throw new Error('Missing station MRL for radio play action');
  }

  await fetchJson('/api/radio/play', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mrl: normalizedMrl,
    }),
  });
}

export async function stopRadioStation() {
  await fetchJson('/api/radio/stop', {
    method: 'POST',
  });
}

export async function getCurrentSong() {
  const snapshot = await getCurrentSongAndProgress();
  return snapshot.song;
}

export async function getApiVersion() {
  const payload = await fetchJson('/api/about/version');

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload.version === 'string') {
    return payload.version;
  }

  return 'unknown';
}

export function getSongArtworkUrl(song) {
  const normalizedMrl = safeDecode(song?.mrl ?? song?.id ?? '');
  if (!normalizedMrl) {
    return null;
  }

  return buildUrl(`/api/image/fetch?mrl=${encodeURIComponent(normalizedMrl)}`);
}

function pickFiniteNumber(...values) {
  const parseClockString = (value) => {
    if (typeof value !== 'string' || !value.includes(':')) {
      return null;
    }

    const parts = value.split(':').map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
      return null;
    }

    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }

    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }

    return null;
  };

  for (const value of values) {
    const clockValue = parseClockString(value);
    if (Number.isFinite(clockValue) && clockValue >= 0) {
      return clockValue;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }

  return null;
}

function toSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric > 10000 ? numeric / 1000 : numeric;
}

function pickProgressSources(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return [
    payload,
    payload.playing,
    payload.tag,
    payload.data,
    payload.nowPlaying,
    payload.current,
  ].filter((item) => item && typeof item === 'object');
}

function normalizeCurrentSong(item) {
  if (!item || !item.mrl) {
    return null;
  }

  const rawPlayState = typeof item.playState === 'string' ? item.playState : '';
  const playState = rawPlayState.toUpperCase();

  return {
    id: item.mrl,
    mrl: item.mrl,
    name: item.title ?? decodeMrlName(item.mrl),
    artistName: item.artist ?? 'Unknown Artist',
    albumName: item.album ?? 'Unknown Album',
    playState,
  };
}

function normalizeCurrentSongProgress(payload) {
  const sources = pickProgressSources(payload);

  for (const source of sources) {
    const durationRaw = pickFiniteNumber(
      source.durationSeconds,
      source.duration,
      source.durationMs,
      source.lengthSeconds,
      source.length,
      source.lengthMs,
      source.totalSeconds,
      source.total,
      source.totalMs,
      source.trackLength,
      source.trackLengthMs,
      source.trackDuration,
      source.trackDurationMs,
    );

    const currentRaw = pickFiniteNumber(
      source.currentSeconds,
      source.current,
      source.currentMs,
      source.currentTime,
      source.elapsedTime,
      source.elapsedTimeMs,
      source.positionSeconds,
      source.positionMs,
      source.elapsedSeconds,
      source.elapsed,
      source.elapsedMs,
      source.progressSeconds,
      source.progressMs,
      source.time,
      source.timeMs,
    );

    const durationSeconds = toSeconds(durationRaw);
    let currentSeconds = toSeconds(currentRaw);

    if (!Number.isFinite(currentSeconds) && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      const ratioRaw = pickFiniteNumber(
        source.position,
        source.progress,
        source.positionRatio,
        source.progressRatio,
        source.positionPercent,
        source.progressPercent,
      );

      if (Number.isFinite(ratioRaw)) {
        const normalizedRatio = ratioRaw > 1 && ratioRaw <= 100 ? ratioRaw / 100 : ratioRaw;
        if (normalizedRatio >= 0 && normalizedRatio <= 1) {
          currentSeconds = normalizedRatio * durationSeconds;
        }
      }
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      continue;
    }

    return {
      currentSeconds: Math.min(Number.isFinite(currentSeconds) ? currentSeconds : 0, durationSeconds),
      durationSeconds,
    };
  }

  return null;
}

export async function getCurrentSongAndProgress() {
  const payload = await fetchJson('/api/queue/playing', {
    cache: 'no-store',
  });

  return parseCurrentSongAndProgressPayload(payload);
}

export function parseCurrentSongAndProgressPayload(payload) {
  return {
    song: normalizeCurrentSong(payload),
    progress: normalizeCurrentSongProgress(payload),
  };
}

export async function getCurrentSongProgress() {
  const snapshot = await getCurrentSongAndProgress();
  return snapshot.progress;
}

async function requestFirstAvailable(paths) {
  let lastError = null;

  for (const path of paths) {
    let response = await fetch(buildUrl(path), {
      method: 'POST',
    });

    if (response.status === 404 || response.status === 405) {
      response = await fetch(buildUrl(path), {
        method: 'GET',
      });
    }

    if (response.ok) {
      return;
    }

    if (response.status === 404 || response.status === 405) {
      continue;
    }

    lastError = new Error(`Request failed for ${path} (${response.status})`);
    break;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No compatible media endpoint found');
}

export async function mediaPlay(song) {
  const normalizedMrl = safeDecode(song?.mrl ?? song?.id ?? '');
  if (!normalizedMrl) {
    throw new Error('Missing song MRL for play action');
  }

  await fetchJson('/api/media/play', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mrl: normalizedMrl,
    }),
  });
}

export async function mediaPause() {
  await requestFirstAvailable(['/api/media/pause']);
}

export async function mediaResume() {
  await requestFirstAvailable(['/api/media/resume', '/api/media/play']);
}

export async function mediaStop() {
  await requestFirstAvailable(['/api/media/stop']);
}

export async function mediaNextSong() {
  await requestFirstAvailable(['/api/media/next', '/api/media/next-song', '/api/media/nextSong']);
}

export async function mediaEmptyQueue() {
  await fetchJson('/api/queue/empty', {
    method: 'POST',
  });
}
