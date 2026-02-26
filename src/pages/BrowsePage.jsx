import { useEffect, useMemo, useState } from 'react';
import ScrollableLetterList from '../components/ScrollableLetterList';
import { addSongToQueue, getAlbumsByArtist, getArtists, getSongsByAlbum } from '../api/jukeboxApi';

function BrowsePage() {
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [songs, setSongs] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadArtists = async () => {
      setLoadingArtists(true);
      setError('');

      try {
        const data = await getArtists();
        if (isMounted) {
          setArtists(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Unable to load artists');
        }
      } finally {
        if (isMounted) {
          setLoadingArtists(false);
        }
      }
    };

    loadArtists();

    return () => {
      isMounted = false;
    };
  }, []);

  const artistTitle = useMemo(() => {
    if (loadingArtists) {
      return 'Loading artists...';
    }
    return 'Artists';
  }, [loadingArtists]);

  const albumTitle = useMemo(() => {
    if (loadingAlbums) {
      return 'Loading albums...';
    }
    return selectedArtist ? `Albums · ${selectedArtist.name}` : 'Albums';
  }, [loadingAlbums, selectedArtist]);

  const songTitle = useMemo(() => {
    if (loadingSongs) {
      return 'Loading songs...';
    }
    return selectedAlbum ? `Songs · ${selectedAlbum.name}` : 'Songs';
  }, [loadingSongs, selectedAlbum]);

  const handleArtistSelect = async (artist) => {
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setSongs([]);
    setLoadingAlbums(true);
    setError('');

    try {
      const data = await getAlbumsByArtist(artist);
      setAlbums(data);
    } catch (loadError) {
      setAlbums([]);
      setError(loadError.message || 'Unable to load albums');
    } finally {
      setLoadingAlbums(false);
    }
  };

  const handleAlbumSelect = async (album) => {
    setSelectedAlbum(album);
    setLoadingSongs(true);
    setError('');

    try {
      const data = await getSongsByAlbum(album);
      setSongs(data);
    } catch (loadError) {
      setSongs([]);
      setError(loadError.message || 'Unable to load songs');
    } finally {
      setLoadingSongs(false);
    }
  };

  const handleSongSelect = async (song) => {
    setError('');

    try {
      await addSongToQueue(song);
    } catch (loadError) {
      setError(loadError.message || 'Unable to add song to queue');
    }
  };

  return (
    <div className="browse-page">
      <p className="helper-text">Select an artist, then an album, then click a song to add it to the queue.</p>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="columns-layout">
        <ScrollableLetterList
          title={artistTitle}
          items={artists}
          selectedId={selectedArtist?.id}
          onSelect={handleArtistSelect}
          emptyMessage="No artists found"
          getItemLabel={(artist) => artist.name}
          ariaLabel="Artist list"
        />

        <ScrollableLetterList
          title={albumTitle}
          items={albums}
          selectedId={selectedAlbum?.id}
          onSelect={handleAlbumSelect}
          emptyMessage={selectedArtist ? 'No albums found' : 'Select an artist first'}
          getItemLabel={(album) => album.name}
          ariaLabel="Album list"
        />

        <ScrollableLetterList
          title={songTitle}
          items={songs}
          selectedId={null}
          onSelect={handleSongSelect}
          emptyMessage={selectedAlbum ? 'No songs found' : 'Select an album first'}
          emptyContent={loadingSongs ? (
            <span className="lookup-status" role="status" aria-live="polite">
              <span className="lookup-spinner" aria-hidden="true" />
              Loading songs from disk...
            </span>
          ) : null}
          getItemLabel={(song) => song.trackNumber != null ? `${song.trackNumber}. ${song.name}` : song.name}
          ariaLabel="Song list"
        />
      </div>
    </div>
  );
}

export default BrowsePage;
