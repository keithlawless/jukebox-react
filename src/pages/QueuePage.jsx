import { useEffect, useMemo, useState } from 'react';
import { getCurrentSong, getQueueState } from '../api/jubeboxApi';

function QueuePage() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queueSongs, setQueueSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const loadQueueData = async () => {
    setLoading(true);
    setError('');

    try {
      const [playing, queue] = await Promise.all([getCurrentSong(), getQueueState()]);
      setCurrentSong(playing);
      setQueueSongs(queue);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
  }, []);

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
          <div>
            <p className="song-name">{currentSong.name}</p>
            <p className="song-meta">
              {currentSong.artistName || 'Unknown Artist'} · {currentSong.albumName || 'Unknown Album'}
            </p>
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
