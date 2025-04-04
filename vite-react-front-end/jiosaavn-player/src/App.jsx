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
  
  // New state variables for queue management
  const [songQueue, setSongQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

  // New state variables for progress bar
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef(null);
  
  // State for showing queue sidebar
  const [showQueue, setShowQueue] = useState(true);

  const handleSearch = async () => {
    if (!searchQuery) {
      setSearchResults(null); // Clear results if query is empty
      return;
    }
    setSearchResults(null); // Clear previous results and indicate loading (optional)
    try {
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      
      // Make the global search request
      const response = await fetch(`${baseUrl}api/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.success) {
        console.error("Search failed:", data.message);
        setSearchResults({ error: data.message || 'Search failed' });
        return;
      }
      
      // Create a merged result set starting with the global search results
      const mergedResults = { ...data.data };
      
      // Array of additional search requests to make
      const additionalSearches = [
        {
          type: 'songs',
          url: `${baseUrl}api/search/songs?query=${encodeURIComponent(searchQuery)}&limit=20`
        },
        {
          type: 'albums',
          url: `${baseUrl}api/search/albums?query=${encodeURIComponent(searchQuery)}&limit=20`
        },
        {
          type: 'artists',
          url: `${baseUrl}api/search/artists?query=${encodeURIComponent(searchQuery)}&limit=20`
        },
        {
          type: 'playlists',
          url: `${baseUrl}api/search/playlists?query=${encodeURIComponent(searchQuery)}&limit=20`
        }
      ];
      
      // Make all additional search requests in parallel
      const additionalSearchPromises = additionalSearches.map(search => 
        fetch(search.url)
          .then(res => res.ok ? res.json() : null)
          .catch(err => {
            console.error(`Error fetching additional ${search.type}:`, err);
            return null; // Return null on error so Promise.all doesn't fail
          })
      );
      
      // Wait for all additional searches to complete
      const additionalResults = await Promise.all(additionalSearchPromises);
      
      // Process each set of additional results
      additionalSearches.forEach((search, index) => {
        const result = additionalResults[index];
        
        if (result && result.success && result.data && result.data.results && 
            mergedResults[search.type] && mergedResults[search.type].results) {
          
          // Create a Set of existing IDs for fast lookup
          const existingIds = new Set(mergedResults[search.type].results.map(item => item.id));
          
          // Filter out duplicates and add new items
          const additionalItems = result.data.results.filter(item => !existingIds.has(item.id));
          
          // Append additional items to the results
          if (additionalItems.length > 0) {
            mergedResults[search.type] = {
              ...mergedResults[search.type],
              results: [...mergedResults[search.type].results, ...additionalItems]
            };
          }
        }
      });
      
      setSearchResults(mergedResults);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setSearchResults({ error: error.message || 'An error occurred' }); // Store error state
    }
  };

  const playSong = async (song, contextSongs = []) => {
    // First check if this is a toggle action (clicking on the current song)
    if (currentlyPlaying?.id === song.id) {
      // Just toggle play/pause for the same song
      setIsPlaying(!isPlaying);
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
      }
      return; // Exit early as we're just toggling play state
    }
    
    // If we get here, we're playing a new song
    
    // If contextSongs is provided, set them as the queue
    if (contextSongs && contextSongs.length > 0) {
      const songIndex = contextSongs.findIndex(s => s.id === song.id);
      if (songIndex !== -1) {
        setSongQueue(contextSongs);
        setCurrentQueueIndex(songIndex);
      } else {
        // If the song isn't in the context songs (shouldn't happen normally)
        setSongQueue([song]);
        setCurrentQueueIndex(0);
      }
    } else {
      // Single song selected without context, make it a queue of one
      setSongQueue([song]);
      setCurrentQueueIndex(0);
    }
    
    // Play the selected song
    loadAndPlaySong(song);
  };
  
  // Function to load and play a song
  const loadAndPlaySong = async (song) => {
    try {
      setCurrentlyPlaying(song);
      setIsPlaying(true); // Set to playing state
      
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
          // Update the audio directly to ensure immediate playback
          if (audioRef.current) {
            // Directly set audio properties
            audioRef.current.src = selectedUrl;
            
            // Force play after source is set
            const playPromise = audioRef.current.play();
            
            if (playPromise !== undefined) {
              playPromise.catch(err => {
                console.error('Error playing audio:', err);
                setIsPlaying(false);
              });
            }
          }
          
          // Also update state for consistency
          setAudioUrl(selectedUrl);
        } else {
          console.error('No playable URL found for this song');
          setAudioUrl(null);
          setIsPlaying(false);
        }
      } else {
        console.error('Failed to get song details');
        setAudioUrl(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error fetching song details:', error);
      setAudioUrl(null);
      setIsPlaying(false);
    }
  };
  
  // Modified effect to handle audioUrl changes more carefully
  useEffect(() => {
    if (audioUrl && audioRef.current && isPlaying) {
      // Only set source if it has changed
      if (audioRef.current.src !== audioUrl) {
        audioRef.current.src = audioUrl;
      }
      
      // Always attempt to play when this effect runs
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Error playing audio:', err);
          setIsPlaying(false);
        });
      }
    }
  }, [audioUrl, isPlaying]);

  // Function to play the next song in queue
  const playNextSong = () => {
    if (songQueue.length === 0 || currentQueueIndex === -1) return;
    
    const nextIndex = (currentQueueIndex + 1) % songQueue.length;
    setCurrentQueueIndex(nextIndex);
    setIsPlaying(true); // Set to playing state immediately
    loadAndPlaySong(songQueue[nextIndex]);
  };
  
  // Function to play the previous song in queue
  const playPreviousSong = () => {
    if (songQueue.length === 0 || currentQueueIndex === -1) return;
    
    // If we're less than 3 seconds into the song, go to previous song
    // Otherwise restart the current song
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    
    const prevIndex = (currentQueueIndex - 1 + songQueue.length) % songQueue.length;
    setCurrentQueueIndex(prevIndex);
    loadAndPlaySong(songQueue[prevIndex]);
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

  // Handle track ending - play next song
  const handleTrackEnded = () => {
    playNextSong(); // Don't set isPlaying to false here, let the next song start playing
  };

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

  // New function to format time (converts seconds to mm:ss format)
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '0:00';
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // New function to handle time update from audio player
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  // New function to handle duration change
  const handleDurationChange = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };
  
  // New function to handle seeking when clicking on progress bar
  const handleProgressBarClick = (e) => {
    if (!audioRef.current || !progressBarRef.current) return;
    
    const progressBar = progressBarRef.current;
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / progressBar.offsetWidth;
    
    // Set the current time based on click position (percentage of duration)
    audioRef.current.currentTime = pos * audioRef.current.duration;
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
                        onClick={() => playSong(song, detailSongs)}
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
                          onClick={() => playSong(song, searchResults.songs.results)}
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
                        <p>{album.artists?.primary?.map(a => a.name).join(', ') || album.artists?.all?.map(a => a.name).join(', ') || ''}</p>
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
          {/* Progress bar */}
          <div 
            className="progress-container" 
            ref={progressBarRef}
            onClick={handleProgressBarClick}
          >
            <div className="progress-bar-bg"></div>
            <div 
              className="progress-bar" 
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            >
              <div className="progress-bar-knob"></div>
            </div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
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
            <div className="player-controls">
              <button className="player-control" onClick={playPreviousSong}>
                ⏮
              </button>
              <button 
                className={`player-control ${isPlaying ? 'playing' : 'paused'}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button className="player-control" onClick={playNextSong}>
                ⏭
              </button>
              <button 
                className={`player-control ${showQueue ? 'active' : ''}`}
                onClick={() => setShowQueue(!showQueue)}
                title="Show/hide queue"
              >
                ♫
              </button>
            </div>
            
            {/* Next up display */}
            {songQueue.length > 0 && currentQueueIndex !== -1 && currentQueueIndex < songQueue.length - 1 && (
              <div className="next-up">
                <div className="next-up-label">Next:</div>
                <div className="next-up-song">
                  <img 
                    src={songQueue[currentQueueIndex + 1].image?.[0]?.url} 
                    alt={songQueue[currentQueueIndex + 1].name} 
                    className="next-thumbnail"
                  />
                  <div className="next-song-info">
                    <div className="next-song-name">{songQueue[currentQueueIndex + 1].name}</div>
                    <div className="next-song-artist">
                      {songQueue[currentQueueIndex + 1].artists?.primary?.map(a => a.name).join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Queue Sidebar */}
      {currentlyPlaying && showQueue && songQueue.length > 0 && (
        <div className="queue-sidebar">
          <div className="queue-header">
            <h3>Queue</h3>
            <button className="queue-close" onClick={() => setShowQueue(false)}>×</button>
          </div>
          
          <div className="queue-list">
            {songQueue.map((song, index) => (
              <div 
                key={song.id + index}
                className={`queue-item ${index === currentQueueIndex ? 'current' : ''}`}
                onClick={() => {
                  if (index !== currentQueueIndex) {
                    setCurrentQueueIndex(index);
                    loadAndPlaySong(song);
                  }
                }}
              >
                <div className="queue-number">{index + 1}</div>
                <img 
                  src={song.image?.[0]?.url} 
                  alt={song.name} 
                  className="queue-thumbnail"
                />
                <div className="queue-item-info">
                  <div className="queue-item-name">{song.name}</div>
                  <div className="queue-item-artist">
                    {song.artists?.primary?.map(a => a.name).join(', ')}
                  </div>
                </div>
                {index === currentQueueIndex && (
                  <div className="playing-indicator">
                    {isPlaying ? '▶️' : '⏸️'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden audio element - with added event listeners */}
      <audio 
        ref={audioRef} 
        onEnded={handleTrackEnded}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
      />
    </div>
  );
}

export default App
