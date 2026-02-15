import { useEffect, useMemo, useState } from 'react';
import {
  getCurrentSongAndProgress,
  getQueueState,
  getSongArtworkUrl,
  mediaEmptyQueue,
  mediaNextSong,
  mediaPause,
  mediaResume,
  mediaStop,
} from '../api/jubeboxApi';

const AUTO_REFRESH_SECONDS = 5;

function formatClockTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }

  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function QueuePage() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queueSongs, setQueueSongs] = useState([]);
  const [currentProgress, setCurrentProgress] = useState(null);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [artworkUnavailable, setArtworkUnavailable] = useState(false);

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
  const isPlaying = playState === 'PLAYING';
  const isPaused = playState === 'PAUSED';
  const isStopped = !currentSong || playState === 'STOPPED';

  const loadQueueData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError('');

    try {
      const [snapshot, queue] = await Promise.all([getCurrentSongAndProgress(), getQueueState()]);
      setCurrentSong(snapshot.song);
      setCurrentProgress(snapshot.progress);
      setQueueSongs(queue);
      if (!snapshot.song) {
        setCurrentProgress(null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load queue');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleMediaAction = async (action) => {
    setActionLoading(true);
    setError('');

    try {
      await action();
      setAutoRefreshCountdown(AUTO_REFRESH_SECONDS);
      await loadQueueData(false);
    } catch (actionError) {
      setError(actionError.message || 'Unable to run media action');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
    setAutoRefreshCountdown(AUTO_REFRESH_SECONDS);

    const refreshIntervalId = window.setInterval(() => {
      loadQueueData(false);
      setAutoRefreshCountdown(AUTO_REFRESH_SECONDS);
    }, AUTO_REFRESH_SECONDS * 1000);

    const countdownIntervalId = window.setInterval(() => {
      setAutoRefreshCountdown((previousSeconds) => (
        previousSeconds <= 1 ? AUTO_REFRESH_SECONDS : previousSeconds - 1
      ));
    }, 1000);

    return () => {
      window.clearInterval(refreshIntervalId);
      window.clearInterval(countdownIntervalId);
    };
  }, []);

  return (
    <div className="queue-page">
      <div className="queue-header-row">
        <h2>Play Queue</h2>
        <div className="queue-actions">
          <button
            type="button"
            onClick={() => {
              setAutoRefreshCountdown(AUTO_REFRESH_SECONDS);
              loadQueueData();
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : `Refresh (${autoRefreshCountdown}s)`}
          </button>
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
              <p className="song-name">{currentSong.name}</p>
              <p className="song-meta">
                {currentSong.artistName || 'Unknown Artist'} · {currentSong.albumName || 'Unknown Album'}
              </p>
              <div className="song-progress" aria-label="Song progress">
                <div className="song-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
                  <div className="song-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="song-progress-times">
                  <span>{formatClockTime(progressCurrentSeconds)}</span>
                  <span>{progressDurationSeconds > 0 ? formatClockTime(progressDurationSeconds) : '--:--'}</span>
                </div>
              </div>
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
