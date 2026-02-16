import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCurrentSongAndProgress,
  getQueueState,
  parseCurrentSongAndProgressPayload,
  getRadioStations,
  getSongArtworkUrl,
  mediaEmptyQueue,
  mediaNextSong,
  mediaPause,
  mediaResume,
  mediaStop,
} from '../api/jubeboxApi';

const AUTO_REFRESH_SECONDS = 5;

function getCurrentSongWsUrl() {
  const overrideWsUrl = import.meta.env.VITE_CURRENT_SONG_WS_URL;
  if (overrideWsUrl) {
    return overrideWsUrl;
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://192.168.4.199:8080/api/ws/current-song';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ws/current-song`;
}

async function parseSocketEventData(eventData) {
  if (typeof eventData === 'string') {
    return JSON.parse(eventData);
  }

  if (eventData instanceof Blob) {
    const text = await eventData.text();
    return JSON.parse(text);
  }

  if (eventData instanceof ArrayBuffer) {
    const text = new TextDecoder().decode(eventData);
    return JSON.parse(text);
  }

  if (eventData && typeof eventData === 'object') {
    return eventData;
  }

  throw new Error('Unsupported websocket payload type');
}

function formatClockTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }

  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function normalizeMrlForCompare(mrl) {
  if (typeof mrl !== 'string') {
    return '';
  }

  try {
    return decodeURIComponent(mrl).trim();
  } catch {
    return mrl.trim();
  }
}

function QueuePage() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queueSongs, setQueueSongs] = useState([]);
  const [currentProgress, setCurrentProgress] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [artworkUnavailable, setArtworkUnavailable] = useState(false);
  const [internetRadioDescription, setInternetRadioDescription] = useState('');
  const lastWsMessageAtRef = useRef(0);
  const hasConnectedWsRef = useRef(false);

  const upcomingSongs = useMemo(() => {
    if (!currentSong) {
      return queueSongs;
    }

    const currentIndex = queueSongs.findIndex((song) => song.mrl === currentSong.mrl);
    if (currentIndex === -1) {
      return queueSongs;
    }

    return queueSongs.slice(currentIndex + 1);
  }, [currentSong, queueSongs]);

  const artworkUrl = useMemo(() => getSongArtworkUrl(currentSong), [currentSong]);

  useEffect(() => {
    setArtworkUnavailable(false);
  }, [artworkUrl]);

  const progressPercent = useMemo(() => {
    if (!currentProgress?.durationSeconds) {
      return 0;
    }

    return Math.min(100, (currentProgress.currentSeconds / currentProgress.durationSeconds) * 100);
  }, [currentProgress]);

  const progressCurrentSeconds = currentProgress?.currentSeconds ?? 0;
  const progressDurationSeconds = currentProgress?.durationSeconds ?? 0;
  const playState = currentSong?.playState ?? 'STOPPED';
  const isInternetRadio = (currentSong?.artistName ?? '').trim().toLowerCase() === 'internet radio';
  const isPlaying = playState === 'PLAYING';
  const isPaused = playState === 'PAUSED';
  const isStopped = !currentSong || playState === 'STOPPED';
  const currentSongDisplayName = isInternetRadio && internetRadioDescription
    ? internetRadioDescription
    : currentSong?.name;
  const wsStatusText = {
    connecting: 'WS connecting',
    connected: 'WS connected',
    reconnecting: 'WS reconnecting',
    fallback: 'WS fallback polling',
  }[wsStatus] ?? 'WS unknown';

  const loadQueueSongs = async () => {
    setError('');

    try {
      const queue = await getQueueState();
      setQueueSongs(queue);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load queue');
    }
  };

  const handleMediaAction = async (action) => {
    setActionLoading(true);
    setError('');

    try {
      await action();
      await loadQueueSongs();
    } catch (actionError) {
      setError(actionError.message || 'Unable to run media action');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadQueueSongs();

    const refreshIntervalId = window.setInterval(() => {
      loadQueueSongs();
    }, AUTO_REFRESH_SECONDS * 1000);

    return () => {
      window.clearInterval(refreshIntervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialNowPlaying = async () => {
      try {
        const snapshot = await getCurrentSongAndProgress();
        if (!isMounted) {
          return;
        }

        setCurrentSong(snapshot.song);
        setCurrentProgress(snapshot.song ? snapshot.progress : null);
        lastWsMessageAtRef.current = Date.now();
      } catch {
        // Websocket remains the source of truth; ignore initial seed failures.
      }
    };

    loadInitialNowPlaying();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeoutId = null;
    let socket = null;

    const connect = () => {
      setWsStatus('connecting');
      socket = new WebSocket(getCurrentSongWsUrl());

      socket.addEventListener('open', () => {
        lastWsMessageAtRef.current = Date.now();
        hasConnectedWsRef.current = true;
        setWsStatus('connected');
      });

      socket.addEventListener('message', async (event) => {
        try {
          const payload = await parseSocketEventData(event.data);
          const normalizedPayload = payload?.data ?? payload;
          const snapshot = parseCurrentSongAndProgressPayload(normalizedPayload);
          setCurrentSong(snapshot.song);
          setCurrentProgress(snapshot.song ? snapshot.progress : null);
          lastWsMessageAtRef.current = Date.now();
          setWsStatus('connected');
        } catch {
          // Ignore malformed websocket payloads and wait for the next message.
        }
      });

      socket.addEventListener('error', (event) => {
        const readyStateNames = {
          [WebSocket.CONNECTING]: 'CONNECTING',
          [WebSocket.OPEN]: 'OPEN',
          [WebSocket.CLOSING]: 'CLOSING',
          [WebSocket.CLOSED]: 'CLOSED',
        };
        const stateName = readyStateNames[socket?.readyState] ?? `UNKNOWN(${socket?.readyState})`;
        const lastMessageAgeMs = lastWsMessageAtRef.current ? Date.now() - lastWsMessageAtRef.current : null;

        console.error('Current song websocket error', {
          url: socket?.url,
          readyState: stateName,
          bufferedAmount: socket?.bufferedAmount,
          lastMessageAgeMs,
          eventType: event?.type,
          isTrusted: event?.isTrusted,
          timestamp: new Date().toISOString(),
        });

        if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      });

      socket.addEventListener('close', () => {
        if (!isMounted) {
          return;
        }

        setWsStatus(hasConnectedWsRef.current ? 'reconnecting' : 'connecting');
        reconnectTimeoutId = window.setTimeout(() => {
          connect();
        }, 3000);
      });
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutId) {
        window.clearTimeout(reconnectTimeoutId);
      }
      if (socket) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      const lastMessageAt = lastWsMessageAtRef.current;
      const isWsStale = !lastMessageAt || (Date.now() - lastMessageAt > AUTO_REFRESH_SECONDS * 3000);
      if (!isWsStale) {
        return;
      }

      try {
        const snapshot = await getCurrentSongAndProgress();
        setCurrentSong(snapshot.song);
        setCurrentProgress(snapshot.song ? snapshot.progress : null);
        setWsStatus('fallback');
      } catch {
        // Keep waiting for websocket or next fallback tick.
      }
    }, AUTO_REFRESH_SECONDS * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!currentSong || !isInternetRadio) {
      setInternetRadioDescription('');
      return () => {
        isMounted = false;
      };
    }

    const loadInternetRadioDescription = async () => {
      try {
        const stations = await getRadioStations();
        if (!isMounted) {
          return;
        }

        const currentMrl = normalizeMrlForCompare(currentSong.mrl);
        const matchedStation = stations.find((station) => (
          normalizeMrlForCompare(station.mrl) === currentMrl
        ));

        setInternetRadioDescription(matchedStation?.name ?? currentSong.name ?? '');
      } catch {
        if (isMounted) {
          setInternetRadioDescription(currentSong.name ?? '');
        }
      }
    };

    loadInternetRadioDescription();

    return () => {
      isMounted = false;
    };
  }, [currentSong, isInternetRadio]);

  return (
    <div className="queue-page">
      <div className="queue-header-row">
        <div className="queue-title-meta">
          <h2>Play Queue</h2>
          <span className={`ws-status-badge ws-status-${wsStatus}`}>{wsStatusText}</span>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="current-song-card">
        <h3>Now Playing</h3>
        {currentSong ? (
          <div className="now-playing-layout">
            {artworkUrl && !artworkUnavailable ? (
              <img
                className="now-playing-artwork"
                src={artworkUrl}
                alt={`Album artwork for ${currentSong.name}`}
                onError={() => setArtworkUnavailable(true)}
              />
            ) : (
              <div className="now-playing-artwork-fallback" aria-label="Album artwork unavailable">
                ♪
              </div>
            )}
            <div>
              <p className="song-name">{currentSongDisplayName}</p>
              <p className="song-meta">
                {currentSong.artistName || 'Unknown Artist'} · {currentSong.albumName || 'Unknown Album'}
              </p>
              {isInternetRadio ? null : (
                <div className="song-progress" aria-label="Song progress">
                  <div className="song-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
                    <div className="song-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="song-progress-times">
                    <span>{formatClockTime(progressCurrentSeconds)}</span>
                    <span>{progressDurationSeconds > 0 ? formatClockTime(progressDurationSeconds) : '--:--'}</span>
                  </div>
                </div>
              )}
              <div className="now-playing-actions">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={() => handleMediaAction(mediaResume)}
                    disabled={actionLoading || !currentSong}
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMediaAction(mediaPause)}
                    disabled={actionLoading || isStopped}
                  >
                    Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleMediaAction(mediaStop)}
                  disabled={actionLoading || isStopped}
                >
                  {isStopped ? 'Stopped' : 'Stop'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMediaAction(mediaNextSong)}
                  disabled={actionLoading || queueSongs.length === 0}
                >
                  Next Song
                </button>
                <button
                  type="button"
                  onClick={() => handleMediaAction(mediaEmptyQueue)}
                  disabled={actionLoading || (!currentSong && queueSongs.length === 0)}
                >
                  Empty Queue
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-text">No song in the queue.</p>
        )}
      </section>

      <section className="upcoming-songs-section">
        <h3>Upcoming Songs</h3>
        <ul className="upcoming-songs-list" title="Scrollable upcoming song list">
          {upcomingSongs.length === 0 ? (
            <li className="empty-row">No upcoming songs.</li>
          ) : (
            upcomingSongs.map((song, index) => (
              <li key={`${song.id}-${index}`} className="upcoming-song-row">
                <span>{song.name}</span>
                <small>
                  {song.artistName || 'Unknown Artist'} · {song.albumName || 'Unknown Album'}
                </small>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

export default QueuePage;
