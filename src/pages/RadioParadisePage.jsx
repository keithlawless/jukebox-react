import { useEffect, useState } from 'react';
import { getCurrentSong, getRadioParadiseNowPlaying, playRadioStation, stopRadioStation } from '../api/jukeboxApi';

const RADIO_PARADISE_CHANNELS = [
  { id: 0, name: 'The Main Mix', url: 'http://stream.radioparadise.com/flacm', description: 'Eclectic mix of rock, world, electronica & more' },
  { id: 1, name: 'Mellow Mix', url: 'http://stream.radioparadise.com/mellow-flacm', description: 'Mellower, chilled-out channel' },
  { id: 2, name: 'Rock Mix', url: 'http://stream.radioparadise.com/rock-flacm', description: 'Heavier, more rock-oriented' },
  { id: 3, name: 'Globalized', url: 'http://stream.radioparadise.com/global-flacm', description: 'Global sounds from around the world' },
  { id: 4, name: 'Beyond', url: 'http://stream.radioparadise.com/beyond-flacm', description: 'Beyond the boundaries of genre' },
  { id: 5, name: 'KFAT', url: 'http://stream.radioparadise.com/kfat-flacm', description: 'KFAT revival stream' },
  { id: 6, name: 'Radio 2025', url: 'http://stream.radioparadise.com/radio2050-flacm', description: 'Music of the future' },
];

const METADATA_REFRESH_MS = 10000;

function RadioParadisePage() {
  const [playingChannel, setPlayingChannel] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getCurrentSong()
      .then((currentSong) => {
        if (!isMounted || !currentSong?.mrl) {
          return;
        }

        const activeChannel = RADIO_PARADISE_CHANNELS.find(
          (channel) => currentSong.mrl === channel.url
        );

        if (activeChannel) {
          setPlayingChannel(activeChannel.id);
        }
      })
      .catch((err) => {
        console.error('Failed to detect active Radio Paradise stream:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (playingChannel === null) {
      setMetadata(null);
      return;
    }

    let isMounted = true;
    let timeoutId = null;

    const fetchMetadata = async () => {
      try {
        const data = await getRadioParadiseNowPlaying(playingChannel);
        
        if (isMounted) {
          setMetadata(data);
        }
      } catch (err) {
        console.error('Metadata fetch error:', err);
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(fetchMetadata, METADATA_REFRESH_MS);
        }
      }
    };

    fetchMetadata();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [playingChannel]);

  const handlePlay = async (channel) => {
    setError('');
    setLoading(true);

    try {
      await playRadioStation({ mrl: channel.url, name: `Radio Paradise - ${channel.name}` });
      setPlayingChannel(channel.id);
    } catch (err) {
      setError(err.message || 'Unable to play channel');
      setPlayingChannel(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setError('');
    setLoading(true);

    try {
      await stopRadioStation();
      setPlayingChannel(null);
      setMetadata(null);
    } catch (err) {
      setError(err.message || 'Unable to stop playback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="radio-paradise-page">
      <div className="page-header">
        <h1>Radio Paradise</h1>
        <p className="helper-text">
          Commercial-free, eclectic internet radio with FLAC quality streams.
          Choose a channel below to start listening.
        </p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {metadata && playingChannel !== null ? (
        <div className="now-playing-card">
          <div className="now-playing-header">
            <h2>Now Playing</h2>
            <button
              type="button"
              className="stop-button"
              onClick={handleStop}
              disabled={loading}
            >
              Stop
            </button>
          </div>
          <div className="now-playing-content">
            {metadata.cover ? (
              <img
                src={metadata.cover_med || metadata.cover}
                alt={`${metadata.album} cover`}
                className="album-art"
              />
            ) : null}
            <div className="song-info">
              <div className="song-title">{metadata.title || 'Unknown Title'}</div>
              <div className="song-artist">{metadata.artist || 'Unknown Artist'}</div>
              <div className="song-album">
                {metadata.album || 'Unknown Album'}
                {metadata.year ? ` (${metadata.year})` : ''}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="channels-grid">
        {RADIO_PARADISE_CHANNELS.map((channel) => (
          <div key={channel.id} className="channel-card">
            <div className="channel-info">
              <h3>{channel.name}</h3>
              <p>{channel.description}</p>
            </div>
            <button
              type="button"
              className={`channel-button ${playingChannel === channel.id ? 'playing' : ''}`}
              onClick={() => playingChannel === channel.id ? handleStop() : handlePlay(channel)}
              disabled={loading}
            >
              {playingChannel === channel.id ? 'Stop' : 'Play'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RadioParadisePage;
