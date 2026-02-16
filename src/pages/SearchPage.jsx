import { useEffect, useMemo, useState } from 'react';
import { addSongToQueue, getSearchStatus, searchAllSongs } from '../api/jubeboxApi';

const INDEX_STATUS_REFRESH_MS = 10_000;
const SEARCH_DEBOUNCE_MS = 2_000;

function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [indexReady, setIndexReady] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [addingMrl, setAddingMrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;

    const checkSearchStatus = async () => {
      try {
        const status = await getSearchStatus();
        if (!isMounted) {
          return;
        }

        setIndexReady(status.indexReady);
        setIndexing(status.indexing);

        if (status.indexReady && intervalId) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } catch (statusError) {
        if (isMounted) {
          setError(statusError.message || 'Unable to check search index status');
        }
      }
    };

    checkSearchStatus();

    intervalId = window.setInterval(() => {
      checkSearchStatus();
    }, INDEX_STATUS_REFRESH_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!indexReady) {
      setResults([]);
      setLoadingSearch(false);
      return () => {
        isMounted = false;
      };
    }

    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm.length < 3) {
      setResults([]);
      setLoadingSearch(false);
      return () => {
        isMounted = false;
      };
    }

    setLoadingSearch(true);
    setError('');

    const timeoutId = window.setTimeout(async () => {
      try {
        const searchResults = await searchAllSongs(trimmedSearchTerm);
        if (isMounted) {
          setResults(searchResults);
        }
      } catch (searchError) {
        if (isMounted) {
          setResults([]);
          setError(searchError.message || 'Unable to search songs');
        }
      } finally {
        if (isMounted) {
          setLoadingSearch(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [indexReady, searchTerm]);

  const helperText = useMemo(() => {
    if (!indexReady) {
      return 'Indexing is in progress';
    }

    if (searchTerm.trim().length < 3) {
      return 'Type at least 3 characters to search.';
    }

    if (loadingSearch) {
      return 'Searching...';
    }

    return `${results.length} result${results.length === 1 ? '' : 's'} found.`;
  }, [indexReady, loadingSearch, results.length, searchTerm]);

  const handleAddToQueue = async (song) => {
    setAddingMrl(song.mrl);
    setError('');

    try {
      await addSongToQueue(song);
    } catch (actionError) {
      setError(actionError.message || 'Unable to add song to queue');
    } finally {
      setAddingMrl('');
    }
  };

  return (
    <div className="search-page">
      <h2>Search</h2>
      {!indexReady ? <p className="indexing-banner">Indexing is in progress</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="search-input-row">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search songs"
          disabled={!indexReady}
          aria-label="Search songs"
        />
      </div>

      <p className="helper-text">
        {helperText}
        {!indexReady && indexing ? ' Rechecking every 10 seconds.' : ''}
      </p>

      {indexReady ? (
        <section className="search-results-section">
          <ul className="search-results-list">
            {results.length === 0 ? (
              <li className="empty-row">No results.</li>
            ) : (
              results.map((song) => (
                <li key={song.id} className="search-result-row">
                  <div>
                    <p className="search-result-name">{song.name}</p>
                    <p className="search-result-meta">
                      {song.artistName || 'Unknown Artist'} · {song.albumName || 'Unknown Album'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToQueue(song)}
                    disabled={addingMrl === song.mrl}
                  >
                    {addingMrl === song.mrl ? 'Adding...' : 'Add to Queue'}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default SearchPage;
