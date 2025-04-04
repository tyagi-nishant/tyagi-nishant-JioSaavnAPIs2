import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  
  // New state variables for detail views
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [detailSongs, setDetailSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery) {
      setSearchResults(null); // Clear results if query is empty
      return;
    }
    setSearchResults(null); // Clear previous results and indicate loading (optional)
    try {
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      const response = await fetch(`${baseUrl}api/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Now also fetch additional song results
      const songsResponse = await fetch(`${baseUrl}api/search/songs?query=${encodeURIComponent(searchQuery)}&limit=20`);
      if (!songsResponse.ok) {
        // If the songs request fails, we'll still continue with the global results
        console.error("Error fetching additional songs:", songsResponse.status);
        if (data.success) {
          setSearchResults(data.data);
        } else {
          console.error("Search failed:", data.message);
          setSearchResults({ error: data.message || 'Search failed' }); // Store error state
        }
        return;
      }
      
      const songsData = await songsResponse.json();
      
      if (data.success) {
        // Create a merged result set
        const mergedResults = { ...data.data };
        
        // If both responses have song results, merge them while avoiding duplicates
        if (songsData.success && songsData.data && songsData.data.results && mergedResults.songs) {
          // Create a Set of existing song IDs for fast lookup
          const existingIds = new Set(mergedResults.songs.results.map(song => song.id));
          
          // Filter out duplicates and add new songs
          const additionalSongs = songsData.data.results.filter(song => !existingIds.has(song.id));
          
          // Append additional songs to the results
          if (additionalSongs.length > 0) {
            mergedResults.songs = {
              ...mergedResults.songs,
              results: [...mergedResults.songs.results, ...additionalSongs]
            };
          }
        }
        
        setSearchResults(mergedResults);
      } else {
        console.error("Search failed:", data.message);
        setSearchResults({ error: data.message || 'Search failed' }); // Store error state
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
      setSearchResults({ error: error.message || 'An error occurred' }); // Store error state
    }
  };

  const playSong = async (song) => {
    // If user clicks on the same song that's already selected
    if (currentlyPlaying?.id === song.id) {
      // Just toggle play/pause
      setIsPlaying(!isPlaying);
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
      }
    } else {
      // Otherwise, let's fetch the song details to get the audio URL
      setCurrentlyPlaying(song);
      setIsPlaying(true);
      
      try {
        // First, we need to get detailed song info which includes the download URLs
        const baseUrl = 'https://jio-saavn2.vercel.app/';
        const response = await fetch(`${baseUrl}api/songs?ids=${song.id}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
          const songDetails = data.data[0];
          
          // Find the best quality URL available
          const qualities = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
          let selectedUrl = null;
          
          for (const quality of qualities) {
            const found = songDetails.downloadUrl.find(link => link.quality === quality);
            if (found && found.url) {
              selectedUrl = found.url;
              break;
            }
          }
          
          if (selectedUrl) {
            setAudioUrl(selectedUrl);
          } else {
            console.error('No playable URL found for this song');
            setAudioUrl(null);
          }
        } else {
          console.error('Failed to get song details');
          setAudioUrl(null);
        }
      } catch (error) {
        console.error('Error fetching song details:', error);
        setAudioUrl(null);
      }
    }
  };

  // Effect to handle audio element play/pause based on isPlaying state
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl]);

  // Effect to set up audio element when URL changes
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setIsPlaying(false);
      });
    }
  }, [audioUrl]);

  // Handle pressing Enter key in search field
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // View album details
  const viewAlbum = async (album) => {
    setIsLoading(true);
    setSelectedDetail(album);
    setDetailType('album');
    setDetailSongs([]);
    
    try {
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      const response = await fetch(`${baseUrl}api/albums?id=${album.id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setDetailSongs(data.data.songs || []);
      } else {
        console.error('Failed to fetch album details');
      }
    } catch (error) {
      console.error('Error fetching album details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // View artist details
  const viewArtist = async (artist) => {
    setIsLoading(true);
    setSelectedDetail(artist);
    setDetailType('artist');
    setDetailSongs([]);
    
    try {
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      const response = await fetch(`${baseUrl}api/artists?id=${artist.id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.songs) {
        setDetailSongs(data.data.songs || []);
      } else {
        console.error('Failed to fetch artist details');
      }
    } catch (error) {
      console.error('Error fetching artist details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // View playlist details
  const viewPlaylist = async (playlist) => {
    setIsLoading(true);
    setSelectedDetail(playlist);
    setDetailType('playlist');
    setDetailSongs([]);
    
    try {
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      const response = await fetch(`${baseUrl}api/playlists?id=${playlist.id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.songs) {
        setDetailSongs(data.data.songs || []);
      } else {
        console.error('Failed to fetch playlist details');
      }
    } catch (error) {
      console.error('Error fetching playlist details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Go back to search results
  const goBackToSearch = () => {
    setSelectedDetail(null);
    setDetailType(null);
    setDetailSongs([]);
  };

  return (
    <div className="music-app">
      {/* Header with Search */}
      <header className="app-header">
        <h1>JioSaavn Music Player</h1>
        <div className="search-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for songs, artists, playlists..."
            className="search-input"
          />
          <button onClick={handleSearch} className="search-button">Search</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Loading Indicator */}
        {(searchQuery && !searchResults) || isLoading ? (
          <div className="loading">Searching...</div>
        ) : null}

        {/* Error Message */}
        {searchResults?.error && (
          <div className="error-message">
            <p>Error: {searchResults.error}</p>
          </div>
        )}

        {/* Detail View - Albums, Artists, Playlists */}
        {selectedDetail && (
          <div className="detail-view">
            <div className="detail-header">
              <button onClick={goBackToSearch} className="back-button">
                &larr; Back to Search
              </button>
              <div className="detail-info">
                <img 
                  src={selectedDetail.image?.[2]?.url || selectedDetail.image?.[1]?.url || selectedDetail.image?.[0]?.url} 
                  alt={selectedDetail.name || selectedDetail.title} 
                  className="detail-image"
                />
                <div>
                  <h2>{selectedDetail.name || selectedDetail.title}</h2>
                  <p className="detail-type">{detailType.charAt(0).toUpperCase() + detailType.slice(1)}</p>
                  {detailType === 'album' && selectedDetail.artists && (
                    <p className="detail-artists">By {selectedDetail.artists?.primary?.map(a => a.name).join(', ')}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="detail-songs">
              <h3>Songs</h3>
              {detailSongs.length > 0 ? (
                <div className="songs-list">
                  {detailSongs.map((song, index) => (
                    <div className="song-item" key={song.id || index}>
                      <div className="song-info">
                        <span className="song-number">{index + 1}</span>
                        <img 
                          src={song.image?.[0]?.url} 
                          alt={song.name} 
                          className="song-thumbnail"
                        />
                        <div>
                          <div className="song-title">{song.name}</div>
                          <div className="song-artist">{song.artists?.primary?.map(a => a.name).join(', ')}</div>
                        </div>
                      </div>
                      <button 
                        className={`song-play ${currentlyPlaying?.id === song.id ? (isPlaying ? 'playing' : 'paused') : ''}`}
                        onClick={() => playSong(song)}
                      >
                        {currentlyPlaying?.id === song.id && isPlaying ? '❚❚' : '▶'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-songs">No songs found</p>
              )}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults && !searchResults.error && !selectedDetail && (
          <div className="search-results">
            {/* Songs Section */}
            {searchResults.songs?.results?.length > 0 && (
              <section className="results-section">
                <h2>Songs</h2>
                <div className="cards-container">
                  {searchResults.songs.results.map((song) => (
                    <div className="music-card" key={song.id}>
                      <div className="card-image">
                        <img 
                          src={song.image?.[2]?.url || song.image?.[1]?.url || song.image?.[0]?.url} 
                          alt={song.name} 
                        />
                        <button 
                          className={`play-button ${currentlyPlaying?.id === song.id ? (isPlaying ? 'playing' : 'paused') : ''}`}
                          onClick={() => playSong(song)}
                        >
                          {currentlyPlaying?.id === song.id && isPlaying ? '❚❚' : '▶'}
                        </button>
                      </div>
                      <div className="card-info">
                        <h3>{song.name}</h3>
                        <p>{song.artists?.primary?.map(a => a.name).join(', ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Albums Section */}
            {searchResults.albums?.results?.length > 0 && (
              <section className="results-section">
                <h2>Albums</h2>
                <div className="cards-container">
                  {searchResults.albums.results.map((album) => (
                    <div className="music-card clickable" key={album.id} onClick={() => viewAlbum(album)}>
                      <div className="card-image">
                        <img 
                          src={album.image?.[2]?.url || album.image?.[1]?.url || album.image?.[0]?.url} 
                          alt={album.name} 
                        />
                      </div>
                      <div className="card-info">
                        <h3>{album.name}</h3>
                        <p>{album.artists?.map(a => a.name).join(', ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Artists Section */}
            {searchResults.artists?.results?.length > 0 && (
              <section className="results-section">
                <h2>Artists</h2>
                <div className="cards-container">
                  {searchResults.artists.results.map((artist) => (
                    <div className="music-card clickable" key={artist.id} onClick={() => viewArtist(artist)}>
                      <div className="card-image">
                        <img 
                          src={artist.image?.[2]?.url || artist.image?.[1]?.url || artist.image?.[0]?.url} 
                          alt={artist.name} 
                        />
                      </div>
                      <div className="card-info">
                        <h3>{artist.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Playlists Section */}
            {searchResults.playlists?.results?.length > 0 && (
              <section className="results-section">
                <h2>Playlists</h2>
                <div className="cards-container">
                  {searchResults.playlists.results.map((playlist) => (
                    <div className="music-card clickable" key={playlist.id} onClick={() => viewPlaylist(playlist)}>
                      <div className="card-image">
                        <img 
                          src={playlist.image?.[2]?.url || playlist.image?.[1]?.url || playlist.image?.[0]?.url} 
                          alt={playlist.name} 
                        />
                      </div>
                      <div className="card-info">
                        <h3>{playlist.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* No Results Message */}
            {!searchResults.songs?.results?.length &&
             !searchResults.albums?.results?.length &&
             !searchResults.artists?.results?.length &&
             !searchResults.playlists?.results?.length && (
              <div className="no-results">No results found for "{searchQuery}"</div>
            )}
          </div>
        )}

        {/* Welcome Screen (when no search has been performed) */}
        {!searchQuery && !searchResults && !selectedDetail && (
          <div className="welcome-screen">
            <h2>Welcome to JioSaavn Music Player</h2>
            <p>Search for your favorite songs, artists, albums, or playlists using the search bar above.</p>
          </div>
        )}
      </main>

      {/* Audio Player (bottom of page) */}
      {currentlyPlaying && (
        <div className="audio-player">
          <div className="now-playing">
            <img 
              src={currentlyPlaying.image?.[0]?.url} 
              alt={currentlyPlaying.name} 
              className="mini-thumbnail"
            />
            <div className="track-info">
              <div className="track-name">{currentlyPlaying.name}</div>
              <div className="track-artist">
                {currentlyPlaying.artists?.primary?.map(a => a.name).join(', ')}
              </div>
            </div>
            <button 
              className={`player-control ${isPlaying ? 'playing' : 'paused'}`}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}

export default App
