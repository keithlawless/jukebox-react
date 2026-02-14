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

  const songs = (folder.files ?? []).map((fileValue, index) => {
    const id = buildSongMrl(albumMrl, fileValue);
    const baseName = decodeMrlName(fileValue) || decodeMrlName(id) || `Song ${index + 1}`;

    return {
      id,
      name: baseName,
      mrl: id,
    };
  });

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

export async function getCurrentSong() {
  const item = await fetchJson('/api/queue/playing');

  if (!item || !item.mrl) {
    return null;
  }

  return {
    id: item.mrl,
    mrl: item.mrl,
    name: item.title ?? decodeMrlName(item.mrl),
    artistName: item.artist ?? 'Unknown Artist',
    albumName: item.album ?? 'Unknown Album',
  };
}
