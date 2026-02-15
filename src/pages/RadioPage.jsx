import { useEffect, useState } from 'react';
import { getRadioStations, playRadioStation, stopRadioStation } from '../api/jubeboxApi';

function RadioPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingStationMrl, setPlayingStationMrl] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadStations = async () => {
      setLoading(true);
      setError('');

      try {
        const stationList = await getRadioStations();
        if (isMounted) {
          setStations(stationList);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Unable to load radio stations');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStations();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStationAction = async (station) => {
    const isStationPlaying = playingStationMrl === station.mrl;
    setActionLoading(true);
    setError('');

    try {
      if (isStationPlaying) {
        await stopRadioStation();
        setPlayingStationMrl('');
      } else {
        await playRadioStation(station);
        setPlayingStationMrl(station.mrl);
      }
    } catch (actionError) {
      setError(actionError.message || 'Unable to run radio action');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="radio-page">
      <h2>Radio</h2>
      <p className="helper-text">Browse internet radio stations and start playback.</p>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="radio-stations-section">
        {loading ? (
          <p className="empty-text">Loading stations...</p>
        ) : stations.length === 0 ? (
          <p className="empty-text">No radio stations found.</p>
        ) : (
          <ul className="radio-stations-list">
            {stations.map((station) => {
              const isStationPlaying = playingStationMrl === station.mrl;

              return (
                <li key={station.id} className="radio-station-row">
                  <span>{station.name}</span>
                  <button
                    type="button"
                    onClick={() => handleStationAction(station)}
                    disabled={actionLoading}
                  >
                    {isStationPlaying ? 'Stop' : 'Play'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default RadioPage;
