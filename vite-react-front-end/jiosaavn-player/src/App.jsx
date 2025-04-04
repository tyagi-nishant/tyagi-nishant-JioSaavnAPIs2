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
  const [originalQuery, setOriginalQuery] = useState(''); // Track the original search query
  const [currentPage, setCurrentPage] = useState(1); // Track the current page of results

  // New state variables for progress bar
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef(null);
  
  // State for showing queue sidebar
  const [showQueue, setShowQueue] = useState(true);
  const [isLoadingMoreSongs, setIsLoadingMoreSongs] = useState(false);
  const [currentAutoSearchTerm, setCurrentAutoSearchTerm] = useState('');

  // Utility function to ensure URLs use HTTPS
  const ensureHttps = (url) => {
    if (!url) return url;
    return url.replace(/^http:\/\//i, 'https://');
  };

  // Function to fetch next page of songs and append to queue
  const fetchAndAppendSimilarSongs = async () => {
    console.log(`📋 fetchAndAppendSimilarSongs called, originalQuery: "${originalQuery}", isLoadingMoreSongs: ${isLoadingMoreSongs}`);
    
    if (!originalQuery || isLoadingMoreSongs) {
      console.log("⚠️ Cannot fetch more songs: originalQuery is empty or already loading");
      return false;
    }
    
    try {
      setIsLoadingMoreSongs(true);
      
      // Instead of generating a similar search term, we'll use pagination
      const nextPage = currentPage + 1;
      setCurrentAutoSearchTerm(`${originalQuery} (page ${nextPage})`);
      
      console.log(`🔄 Extending queue: Fetching page ${nextPage} for "${originalQuery}"`);
      console.log(`📊 Current queue length before fetch: ${songQueue.length}`);
      
      // Display the loading indicator for at least 1 second to ensure user sees it
      const fetchStartTime = Date.now();
      
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      
      // Make the search request for songs with pagination
      const url = `${baseUrl}api/search/songs?query=${encodeURIComponent(originalQuery)}&page=${nextPage}`;
      console.log(`🌐 Fetching from URL: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ API response received, success: ${data.success}`);
      
      let songsAdded = false;
      
      if (data.success && data.data && data.data.results && data.data.results.length > 0) {
        const newSongs = data.data.results;
        
        // Since we're paginating the same search, we'll add all songs from next page
        // even if they have the same IDs (the API might return duplicates across pages)
        console.log(`✅ Found ${newSongs.length} songs on page ${nextPage}`);
        
        // Add all songs from the new page
        setSongQueue(prevQueue => {
          const updatedQueue = [...prevQueue, ...newSongs];
          console.log(`📊 Updated queue length: ${updatedQueue.length} (added ${newSongs.length} songs)`);
          return updatedQueue;
        });
        
        console.log(`✅ Added ${newSongs.length} songs from page ${nextPage} to the queue`);
        songsAdded = true;
        
        // Update the current page
        setCurrentPage(nextPage);
        console.log(`📄 Current page updated to ${nextPage}`);
      } else {
        console.log(`⚠️ No results found on page ${nextPage} for "${originalQuery}"`);
      }
      
      // Ensure loading indicator displays for at least 1 second
      const fetchEndTime = Date.now();
      const fetchDuration = fetchEndTime - fetchStartTime;
      if (fetchDuration < 1000) {
        const waitTime = 1000 - fetchDuration;
        console.log(`⏱️ Waiting ${waitTime}ms to ensure loading indicator is visible`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      console.log(`📋 fetchAndAppendSimilarSongs completed, songsAdded: ${songsAdded}`);
      return songsAdded; // Return whether songs were added
    } catch (error) {
      console.error('🐞 Error fetching next page of songs:', error);
      return false;
    } finally {
      setIsLoadingMoreSongs(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) {
      setSearchResults(null); // Clear results if query is empty
      return;
    }
    setSearchResults(null); // Clear previous results and indicate loading (optional)
    try {
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      
      // Store the original query when performing a search and reset page counter
      setOriginalQuery(searchQuery);
      setCurrentPage(1);
      
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
        
        // When playing from search results, make sure we capture the original query
        if (!selectedDetail && searchQuery) {
          setOriginalQuery(searchQuery);
          setCurrentPage(1); // Reset pagination when starting a new queue
        }
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
    console.log(`🎵 Loading song: "${song.name}" (ID: ${song.id})`);
    try {
      setCurrentlyPlaying(song);
      setIsPlaying(true); // Set to playing state
      console.log("⏳ Set isPlaying to true");
      
      // First, we need to get detailed song info which includes the download URLs
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      console.log(`🔄 Fetching song details from API for ID: ${song.id}`);
      const response = await fetch(`${baseUrl}api/songs?ids=${song.id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Song details received from API, success: ${data.success}`);
      
      if (data.success && data.data && data.data.length > 0) {
        const songDetails = data.data[0];
        
        // Find the best quality URL available
        const qualities = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
        let selectedUrl = null;
        
        for (const quality of qualities) {
          const found = songDetails.downloadUrl.find(link => link.quality === quality);
          if (found && found.url) {
            selectedUrl = ensureHttps(found.url); // Ensure HTTPS URL
            console.log(`✅ Found audio URL with quality: ${quality}`);
            break;
          }
        }
        
        if (selectedUrl) {
          console.log(`🔊 Setting audio source to ${selectedUrl.substring(0, 50)}...`);
          // Update the audio directly to ensure immediate playback
          if (audioRef.current) {
            // Directly set audio properties
            audioRef.current.src = selectedUrl;
            
            // Force play after source is set with a small delay to ensure it works after loading
            console.log("⏱️ Setting timeout to play audio after 100ms");
            setTimeout(() => {
              if (audioRef.current) {
                console.log("▶️ Attempting to play audio...");
                const playPromise = audioRef.current.play();
                
                if (playPromise !== undefined) {
                  playPromise.catch(err => {
                    console.error('❌ Error playing audio:', err);
                    // Try once more after a short delay
                    console.log("⏱️ First play attempt failed, retrying after 300ms");
                    setTimeout(() => {
                      if (audioRef.current) {
                        console.log("▶️ Second attempt to play audio...");
                        audioRef.current.play().catch(e => {
                          console.error('❌ Second attempt to play failed:', e);
                          setIsPlaying(false);
                        });
                      }
                    }, 300);
                  });
                }
              }
            }, 100);
          }
          
          // Also update state for consistency
          setAudioUrl(selectedUrl);
        } else {
          console.error('❌ No playable URL found for this song');
          setAudioUrl(null);
          setIsPlaying(false);
        }
      } else {
        console.error('❌ Failed to get song details');
        setAudioUrl(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('🐞 Error fetching song details:', error);
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
  const playNextSong = async () => {
    if (songQueue.length === 0 || currentQueueIndex === -1) return;
    
    const nextIndex = currentQueueIndex + 1;
    
    // Check if we're at the last song or about to play the last song
    if (nextIndex >= songQueue.length - 1) {
      // We're on the last song or about to play it, fetch more similar songs
      // Wait for the fetch to complete before proceeding
      await fetchAndAppendSimilarSongs();
    }
    
    // After potentially adding songs, check if there's a next song to play
    const updatedNextIndex = currentQueueIndex + 1;
    
    // Only play the next song if it exists
    if (updatedNextIndex < songQueue.length) {
      setCurrentQueueIndex(updatedNextIndex);
      setIsPlaying(true);
      loadAndPlaySong(songQueue[updatedNextIndex]);
    } else {
      // If we're at the end of the queue, stop playback
      console.log("Reached end of queue, stopping playback");
      setIsPlaying(false);
      // Keep the current song selected but paused
    }
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
    console.log("🔄 Track ended event fired!");
    console.log(`Current queue index: ${currentQueueIndex}, Queue length: ${songQueue.length}`);
    
    // We need special handling since we can't make this an async function directly
    // First check if we're at the end of the queue
    const nextIndex = currentQueueIndex + 1;
    
    if (nextIndex >= songQueue.length) {
      console.log("📢 End of queue reached, fetching more songs...");
      // Using a separate function to handle the async operations
      handleEndOfQueueAutoplay();
    } else {
      console.log(`▶️ Playing next song in queue (index ${nextIndex})`);
      setCurrentQueueIndex(nextIndex);
      loadAndPlaySong(songQueue[nextIndex]);
    }
  };
  
  // Helper function to handle autoplay when reaching end of queue
  const handleEndOfQueueAutoplay = async () => {
    console.log("🔄 handleEndOfQueueAutoplay started");
    try {
      // Set a loading state to prevent multiple calls
      setIsLoadingMoreSongs(true);
      console.log("⏳ Loading state set to true");
      
      // Try to fetch more songs
      console.log("🔍 Attempting to fetch more songs...");
      
      // Instead of using the return value, we'll directly modify the queue and track if we added songs
      let newSongsAdded = false;
      let nextSongToPlay = null;
      
      // Fetch and process new songs
      if (originalQuery && !isLoadingMoreSongs) {
        try {
          // Instead of generating a similar search term, we'll use pagination
          const nextPage = currentPage + 1;
          setCurrentAutoSearchTerm(`${originalQuery} (page ${nextPage})`);
          
          console.log(`🔄 Extending queue: Fetching page ${nextPage} for "${originalQuery}"`);
          console.log(`📊 Current queue index: ${currentQueueIndex}, Current queue length: ${songQueue.length}`);
          
          // Display the loading indicator for at least 1 second to ensure user sees it
          const fetchStartTime = Date.now();
          
          const baseUrl = 'https://jio-saavn2.vercel.app/';
          
          // Make the search request for songs with pagination
          const url = `${baseUrl}api/search/songs?query=${encodeURIComponent(originalQuery)}&page=${nextPage}`;
          console.log(`🌐 Fetching from URL: ${url}`);
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`✅ API response received, success: ${data.success}`);
          
          if (data.success && data.data && data.data.results && data.data.results.length > 0) {
            const newSongs = data.data.results;
            console.log(`✅ Found ${newSongs.length} songs on page ${nextPage}`);
            
            // Get the song that will be next
            nextSongToPlay = newSongs[0];
            newSongsAdded = true;
            
            // Update the queue and store the updated queue
            setSongQueue(prevQueue => {
              const updatedQueue = [...prevQueue, ...newSongs];
              console.log(`📊 Updated queue length: ${updatedQueue.length} (added ${newSongs.length} songs)`);
              return updatedQueue;
            });
            
            // Update the current page
            setCurrentPage(nextPage);
            console.log(`📄 Current page updated to ${nextPage}`);
          } else {
            console.log(`⚠️ No results found on page ${nextPage} for "${originalQuery}"`);
          }
          
          // Ensure loading indicator displays for at least 1 second
          const fetchEndTime = Date.now();
          const fetchDuration = fetchEndTime - fetchStartTime;
          if (fetchDuration < 1000) {
            const waitTime = 1000 - fetchDuration;
            console.log(`⏱️ Waiting ${waitTime}ms to ensure loading indicator is visible`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } catch (error) {
          console.error('🐞 Error fetching next page of songs:', error);
        }
      }
      
      // After all updates, decide what to do next
      if (newSongsAdded && nextSongToPlay) {
        console.log("🎵 Playing the first song from the newly added songs");
        // Increment current queue index - the new song will be right after current index
        const newNextIndex = currentQueueIndex + 1;
        setCurrentQueueIndex(newNextIndex);
        loadAndPlaySong(nextSongToPlay);
      } else {
        // No more songs were added, stop playback
        console.log("⛔ No more songs could be added to the queue, stopping playback");
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("🐞 Error handling end of queue autoplay:", error);
      setIsPlaying(false);
    } finally {
      console.log("⏳ Loading state set to false");
      setIsLoadingMoreSongs(false);
    }
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
    
    // Set original query to album name for future auto-queue
    setOriginalQuery(album.name);
    setCurrentPage(1); // Reset pagination counter
    
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
    
    // Set original query to artist name for future auto-queue
    setOriginalQuery(artist.name);
    setCurrentPage(1); // Reset pagination counter
    
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
    
    // Set original query to playlist name for future auto-queue
    setOriginalQuery(playlist.name);
    setCurrentPage(1); // Reset pagination counter
    
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
        <h1>Solace Music Player</h1>
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
                  src={ensureHttps(selectedDetail.image?.[2]?.url || selectedDetail.image?.[1]?.url || selectedDetail.image?.[0]?.url)} 
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
                          src={ensureHttps(song.image?.[0]?.url)} 
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
                          src={ensureHttps(song.image?.[2]?.url || song.image?.[1]?.url || song.image?.[0]?.url)} 
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
                          src={ensureHttps(album.image?.[2]?.url || album.image?.[1]?.url || album.image?.[0]?.url)} 
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
                          src={ensureHttps(artist.image?.[2]?.url || artist.image?.[1]?.url || artist.image?.[0]?.url)} 
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
                          src={ensureHttps(playlist.image?.[2]?.url || playlist.image?.[1]?.url || playlist.image?.[0]?.url)} 
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
            <h2>Experience unlimited high quality music streaming</h2>
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
              src={ensureHttps(currentlyPlaying.image?.[0]?.url)} 
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
                    src={ensureHttps(songQueue[currentQueueIndex + 1].image?.[0]?.url)} 
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
                  src={ensureHttps(song.image?.[0]?.url)} 
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
            
            {isLoadingMoreSongs && (
              <div className="queue-loading-indicator">
                <div className="loading-spinner"></div>
                <div>Adding more songs to queue using "{currentAutoSearchTerm}"</div>
              </div>
            )}
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
