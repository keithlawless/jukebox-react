import { useEffect, useMemo, useState } from 'react';
import {
  getCurrentSong,
  getCurrentSongProgress,
  getQueueState,
  getSongArtworkUrl,
} from '../api/jubeboxApi';

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
  const [progressSnapshotAt, setProgressSnapshotAt] = useState(0);
  const [displayTick, setDisplayTick] = useState(0);
  const [loading, setLoading] = useState(false);
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

    const elapsedSeconds = Math.max(0, (displayTick - progressSnapshotAt) / 1000);
    const liveCurrentSeconds = Math.min(
      currentProgress.currentSeconds + elapsedSeconds,
      currentProgress.durationSeconds,
    );

    return Math.min(100, (liveCurrentSeconds / currentProgress.durationSeconds) * 100);
  }, [currentProgress, displayTick, progressSnapshotAt]);

  const progressCurrentSeconds = useMemo(() => {
    if (!currentProgress) {
      return 0;
    }

    const elapsedSeconds = Math.max(0, (displayTick - progressSnapshotAt) / 1000);
    return Math.min(currentProgress.currentSeconds + elapsedSeconds, currentProgress.durationSeconds);
  }, [currentProgress, displayTick, progressSnapshotAt]);
  const progressDurationSeconds = currentProgress?.durationSeconds ?? 0;

  const loadProgressData = async () => {
    try {
      const progress = await getCurrentSongProgress(currentSong);
      setCurrentProgress(progress);
      setProgressSnapshotAt(Date.now());
      setDisplayTick(Date.now());
    } catch {
      setCurrentProgress(null);
      setProgressSnapshotAt(0);
    }
  };

  const loadQueueData = async () => {
    setLoading(true);
    setError('');

    try {
      const [playing, queue] = await Promise.all([getCurrentSong(), getQueueState()]);
      setCurrentSong(playing);
      setQueueSongs(queue);
      if (!playing) {
        setCurrentProgress(null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
  }, []);

  useEffect(() => {
    if (!currentSong) {
      setCurrentProgress(null);
      setProgressSnapshotAt(0);
      return;
    }

    loadProgressData();

    const intervalId = window.setInterval(() => {
      loadProgressData();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentSong]);

  useEffect(() => {
    if (!currentSong || !currentProgress) {
      return;
    }

    const tickId = window.setInterval(() => {
      setDisplayTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(tickId);
    };
  }, [currentSong, currentProgress]);

  return (
    <div className="queue-page">
      <div className="queue-header-row">
        <h2>Play Queue</h2>
        <div className="queue-actions">
          <button type="button" onClick={loadQueueData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
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
