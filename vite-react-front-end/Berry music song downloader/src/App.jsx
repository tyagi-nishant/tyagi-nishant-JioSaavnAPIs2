import { useState, useRef, useEffect } from 'react'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import { Navbar } from './components/Navigation/Navbar'
import { Login } from './components/Auth/Login'
import { SubscriptionPlans } from './components/Subscription/SubscriptionPlans'
import { DownloadButton } from './components/Download/DownloadButton'
import './App.css'

function BerryMusicApp() {
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
  const [showQueue, setShowQueue] = useState(false); // Default to closed
  const [isLoadingMoreSongs, setIsLoadingMoreSongs] = useState(false);
  const [currentAutoSearchTerm, setCurrentAutoSearchTerm] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Ref to track if initial search has been triggered
  const initialSearchTriggered = useRef(false);

  // Auth context data
  const { user, hasPremiumAccess } = useAuth();

  // Add debug logging
  useEffect(() => {
    console.log("Auth state in App:", { user, hasPremiumAccess });
  }, [user, hasPremiumAccess]);

  // Effect to trigger initial search ONCE after user logs in
  useEffect(() => {
    // Only run if user exists AND initial search hasn't been triggered yet
    if (user && !initialSearchTriggered.current) {
      console.log("User logged in, triggering initial search for 'new songs english'...");
      initialSearchTriggered.current = true; // Mark as triggered
      setSearchQuery("new songs english"); // Set the query to trigger the search effect
    }
    // If user logs out, reset the trigger flag so initial search can happen on next login
    if (!user) {
      initialSearchTriggered.current = false;
    }
  }, [user]); // Dependency: run when user state changes

  // Effect to actually PERFORM the search when the query is set by the above effect
  useEffect(() => {
    // Check if the query is the specific initial one, trigger ref is true, 
    // and we aren't already loading or showing results
    if (
      searchQuery === "new songs english" && 
      initialSearchTriggered.current && 
      !isLoading && 
      !searchResults 
    ) {
      console.log("Search query matches initial trigger, calling handleSearch().");
      handleSearch(); // Perform the search
    }
    // Note: Don't reset initialSearchTriggered.current here, 
    // it should only reset on logout (handled in the user effect)
  }, [searchQuery, isLoading, searchResults]); // Dependencies: run when query, loading, or results change

  // Utility function to ensure URLs use HTTPS and handle different image data types
  const ensureHttps = (imageUrlData) => {
    let url = null; // Start with null

    // Check if it's an array and not empty
    if (Array.isArray(imageUrlData) && imageUrlData.length > 0) {
      // Try to get the 'url' property from the last item in the array (highest quality)
      const lastImage = imageUrlData[imageUrlData.length - 1];
      if (lastImage && typeof lastImage.url === 'string') {
        url = lastImage.url;
      }
    }
    // If it wasn't an array, check if it's already a string
    else if (typeof imageUrlData === 'string') {
      url = imageUrlData;
    }
    // Otherwise, imageUrlData is null, undefined, empty array, or unexpected format, so url remains null.

    // If we couldn't find a valid string URL, return null (or a placeholder)
    if (!url || typeof url !== 'string') {
      // console.warn("Could not determine valid image URL from:", imageUrlData);
      return null; // Or return a path to a default placeholder image like '/images/placeholder.png'
    }

    // Now we are sure url is a string, replace http with https
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
      
      // Automatically populate the queue with songs on search
      if (mergedResults.songs && mergedResults.songs.results && mergedResults.songs.results.length > 0) {
        setSongQueue(mergedResults.songs.results);
        setCurrentQueueIndex(-1); // Reset current queue position
      }
      
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults({ error: error.message || 'An error occurred during search' });
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
    console.log(">>> loadAndPlaySong START:", song?.name, "ID:", song?.id);
    if (!song || !song.id) {
      console.error('Error: Invalid song data passed to loadAndPlaySong', song);
      setIsPlaying(false);
      setAudioUrl(null);
      setCurrentlyPlaying(null);
      return;
    }

    try {
      // --- FETCH DETAILED SONG INFO --- 
      console.log(`>>> Fetching details for song ID: ${song.id}`);
      const baseUrl = 'https://jio-saavn2.vercel.app/';
      const detailsResponse = await fetch(`${baseUrl}api/songs?ids=${song.id}`);
      if (!detailsResponse.ok) {
        throw new Error(`HTTP error fetching song details! status: ${detailsResponse.status}`);
      }
      const detailsData = await detailsResponse.json();
      if (!detailsData.success || !detailsData.data || detailsData.data.length === 0) {
        throw new Error('Failed to get valid song details from API');
      }
      const detailedSong = detailsData.data[0];
      console.log(">>> Received detailed song data:", detailedSong);
      // --- END FETCH --- 

      // Now use detailedSong.downloadUrl
      if (!detailedSong.downloadUrl || !Array.isArray(detailedSong.downloadUrl) || detailedSong.downloadUrl.length === 0) {
        console.error('Error: Invalid or missing downloadUrl array in detailed song data', detailedSong);
        throw new Error('Download URL not found in detailed song data');
      }

      const lastDownloadObject = detailedSong.downloadUrl.slice(-1)[0];
      console.log(">>> Last download object structure:", lastDownloadObject);
      const bestQualityUrl = lastDownloadObject?.link || lastDownloadObject?.url;

      if (!bestQualityUrl || typeof bestQualityUrl !== 'string') {
        console.error('Error: Could not find a valid download link/url property', lastDownloadObject);
        throw new Error('Could not extract valid download URL');
      }

      const httpsUrl = ensureHttps(bestQualityUrl);
      console.log(`>>> Setting audioUrl to: ${httpsUrl}`);
      setAudioUrl(httpsUrl);

      console.log(">>> Setting currentlyPlaying:", detailedSong); // Use detailed song data
      setCurrentlyPlaying(detailedSong); // Use detailed song data

      console.log(">>> loadAndPlaySong END:", detailedSong?.name);
    } catch (error) {
      console.error('>>> loadAndPlaySong FAILED:', error);
      setIsPlaying(false);
      setAudioUrl(null);
      setCurrentlyPlaying(null);
    }
  };
  
  // Effect to handle AUDIO SOURCE changes and INITIATE PLAY
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      console.log(`>>> useEffect[audioUrl]: New URL detected: ${audioUrl}. Setting src and loading.`);
      audioRef.current.src = audioUrl;
      // We don't call play() here directly anymore.
      // We rely on the 'canplaythrough' event listener below.
    } else if (audioRef.current) {
      console.log(">>> useEffect[audioUrl]: audioUrl is null. Pausing and resetting src.");
      audioRef.current.pause();
      audioRef.current.removeAttribute('src'); // Reset src if URL is null
    }
  }, [audioUrl]); // Only depends on audioUrl changes

  // Effect to handle PLAY/PAUSE state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Function to attempt playing
    const attemptPlay = () => {
      console.log(">>> attemptPlay: Trying to play...");
      audio.play().then(() => {
        console.log(">>> attemptPlay: Play successful.");
        setIsPlaying(true); // Sync state ONLY after successful play
      }).catch(error => {
        console.error('>>> attemptPlay: Error playing audio:', error);
        setIsPlaying(false); // Sync state on error
        // Don't auto-retry here, could cause loops
      });
    };

    // Event listener for when the browser can play the whole file
    const handleCanPlayThrough = () => {
      console.log(">>> handleCanPlayThrough: Audio ready. Attempting play.");
      if (currentlyPlaying) { // Only play if a song is loaded
        attemptPlay();
      }
    };

    // Add event listener when component mounts or audio ref changes
    console.log(">>> useEffect[play/pause]: Adding 'canplaythrough' listener.");
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    // Initial check: If we are supposed to be playing and have a URL, try playing
    // (This handles cases where play was intended but interrupted before 'canplaythrough')
    if (isPlaying && audioUrl) {
      console.log(">>> useEffect[play/pause]: Initial state isPlaying=true, attempting play.");
      attemptPlay();
    } else if (!isPlaying) {
      console.log(">>> useEffect[play/pause]: Initial state isPlaying=false, pausing.");
      audio.pause();
    }

    // Cleanup function
    return () => {
      console.log(">>> useEffect[play/pause]: Removing 'canplaythrough' listener.");
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [isPlaying, currentlyPlaying]); // Depends on isPlaying intent and which song is loaded

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

  // Render handlers for our modals
  const renderLoginModal = () => {
    if (showLoginModal) {
      return (
        <div className="modal-overlay">
          <div className="auth-container">
            <Login onClose={() => setShowLoginModal(false)} />
          </div>
        </div>
      );
    }
    return null;
  };
  
  const renderSubscriptionModal = () => {
    if (!showSubscriptionModal) return null;
    
    return (
      <div className="modal-overlay" onClick={() => setShowSubscriptionModal(false)}>
        <div className="modal-content subscription-modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowSubscriptionModal(false)}>×</button>
          <SubscriptionPlans />
        </div>
      </div>
    );
  };

  // Render a song as a grid card (similar to album/artist cards)
  const renderSongCard = (song) => {
    const isCurrentSong = currentlyPlaying && currentlyPlaying.id === song.id;
    const isThisSongPlaying = isCurrentSong && isPlaying;

    return (
      <div 
        key={song.id} 
        className="music-card clickable" // Use music-card class
        onClick={() => playSong(song, searchResults.songs.results)} // Play song from search results context
      >
        <div className="card-image">
          <img src={ensureHttps(song.image)} alt={song.name} />
          {/* Play button overlay - adapt from music-card hover style */}
          <button 
             className={`play-button ${isThisSongPlaying ? 'playing' : ''}`}
             style={{ opacity: 1, transform: 'translateY(0)' }} // Make always visible for song cards
             onClick={(e) => {
                e.stopPropagation(); // Prevent card click from triggering as well
                playSong(song, searchResults.songs.results);
             }}
          >
            {isThisSongPlaying ? '❚❚' : '▶'}
          </button>
        </div>
        <div className="card-info">
          <h3>{song.name}</h3>
          <p>{song.primaryArtists || song.artist || 'Unknown Artist'}</p>
        </div>
      </div>
    );
  };

  // Function to render a single song item
  const renderSongItem = (song, index, context = 'search') => {
    if (!song || !song.id) {
      console.warn("Attempted to render invalid song item:", song);
      return null;
    }
    
    const isCurrent = currentlyPlaying && currentlyPlaying.id === song.id;
    const displayIndex = context === 'queue' ? index + 1 : index + 1; // Use 1-based index
    const uniqueKey = `${context}-${song.id}-${index}`;
    const imageUrl = ensureHttps(song.image) || '/placeholder.png'; // Use ensureHttps and provide a fallback

    return (
      <div 
        key={uniqueKey} // Use the more robust unique key
        className={`song-item ${isCurrent ? 'current' : ''}`}
      >
        <div className="song-info">
          <span className="song-number">{displayIndex}.</span>
          <div className="song-thumbnail">
            <img src={imageUrl} alt={song.name || 'Song thumbnail'} />
          </div>
          <div className="song-details">
            <span className="song-title">{song.name || 'Untitled Song'}</span>
            <span className="song-artist">{song.primaryArtists || 'Unknown Artist'}</span>
          </div>
        </div>
        <div className="song-controls">
          <button 
            className={`song-play ${isCurrent && isPlaying ? 'playing' : ''}`}
            onClick={() => {
              if (isCurrent && isPlaying) {
                setIsPlaying(false);
              } else {
                // Determine the correct song list context for playSong
                const songListContext = context === 'queue' 
                  ? songQueue 
                  : context === 'detail'
                    ? detailSongs
                    : (searchResults?.songs?.results || []);
                playSong(song, songListContext);
              }
            }}
          >
            {isCurrent && isPlaying ? '❚❚' : '▶'}
          </button>
          {/* Add Download Button - Conditionally Rendered */}
          {hasPremiumAccess && (
            <button 
              className="download-button"
              onClick={() => console.log('Download clicked for:', song.name, 'Premium:', hasPremiumAccess)}
              title="Download song (Premium required)"
            >
              ⬇️
            </button>
          )}
        </div>
      </div>
    );
  };

  // Add welcome screen with renaissance painting
  const renderWelcomeScreen = () => {
    return (
      <div className="welcome-screen">
        <div className="renaissance-artwork">
          {/* <div className="background-image"></div> */}
          <div className="welcome-text">
            <h2>Welcome to Berry Music Downloader</h2>
            <p>Search for your favorite songs, artists, albums, and playlists</p>
            
            {/* Search Bar Removed From Here */}
            {/* <div className="search-container"> ... </div> */}
            
          </div>
        </div>
        
        <div className="features-section">
          <div className="feature-card">
            <div className="feature-icon">🎵</div>
            <h3>Unlimited Music</h3>
            <p>Access millions of songs from around the world</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⬇️</div>
            <h3>Download Music</h3>
            <p>Premium members can download songs for offline listening</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎧</div>
            <h3>High Quality</h3>
            <p>Enjoy high-quality streaming with no interruptions</p>
          </div>
        </div>
      </div>
    );
  };

  // Finally, render the complete app
  return (
    <div className="music-app dark-theme">
      <Navbar 
        showLoginModal={() => {
          console.log("Opening login modal");
          setShowLoginModal(true);
        }} 
        showSubscriptionModal={() => {
          console.log("Opening subscription modal");
          setShowSubscriptionModal(true);
        }} 
      />
      
      {/* Header removed as search bar is moved to welcome screen */}
      {/* {user && (
        <header className="app-header">
           Search container was here 
        </header>
      )} */}
      
      <div className="main-container">
        <div className={`main-content ${showQueue ? 'with-queue' : ''}`}>
          
          {/* Search Bar - Conditionally render only if user is logged in */}
          {user && (
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search millions of songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className="search-button" onClick={handleSearch}>
                Search
              </button>
            </div>
          )}
          {/* End Search Bar */}
          
          {/* Detail view or search results */}
          {selectedDetail ? (
            <div className="detail-view">
              <div className="detail-header">
                <button className="back-button" onClick={goBackToSearch}>
                  ← Back to Search
                </button>
              </div>
              <div className="detail-info">
                <div className="detail-image">
                  <img src={ensureHttps(selectedDetail.image)} alt={selectedDetail.name || selectedDetail.title} />
                </div>
                <div>
                  <div className="detail-type">{detailType}</div>
                  <h2>{selectedDetail.name || selectedDetail.title}</h2>
                  {selectedDetail.primaryArtists && (
                    <div className="detail-artists">{selectedDetail.primaryArtists}</div>
                  )}
                </div>
              </div>
              
              <div className="detail-songs">
                <h3>Songs</h3>
                {detailSongs.length > 0 ? (
                  <div className="songs-list">
                    {detailSongs.map((song, index) => renderSongItem(song, index, 'detail'))}
                  </div>
                ) : (
                  <div className="no-songs">No songs available</div>
                )}
              </div>
            </div>
          ) : (
            <div className="search-results">
              {isLoading ? (
                <div className="loading">Searching...</div>
              ) : searchResults ? (
                searchResults.error ? (
                  <div className="error-message">{searchResults.error}</div>
                ) : (
                  <div>
                    {/* Songs Section - Use Cards */}
                    {searchResults.songs && searchResults.songs.results && searchResults.songs.results.length > 0 && (
                      <div className="results-section">
                        <h2>Songs</h2>
                        {/* Use cards-container and renderSongCard for main song results */}
                        <div className="cards-container">
                          {searchResults.songs.results.map((song) => renderSongCard(song))}
                        </div>
                      </div>
                    )}
                    
                    {/* Albums Section */}
                    {searchResults.albums && searchResults.albums.results && searchResults.albums.results.length > 0 && (
                      <div className="results-section">
                        <h2>Albums</h2>
                        <div className="cards-container">
                          {searchResults.albums.results.map((album) => (
                            <div 
                              key={album.id} 
                              className="music-card clickable"
                              onClick={() => viewAlbum(album)}
                            >
                              <div className="card-image">
                                <img src={ensureHttps(album.image)} alt={album.name} />
                              </div>
                              <div className="card-info">
                                <h3>{album.name}</h3>
                                <p>{album.primaryArtists || 'Various Artists'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Artists Section */}
                    {searchResults.artists && searchResults.artists.results && searchResults.artists.results.length > 0 && (
                      <div className="results-section">
                        <h2>Artists</h2>
                        <div className="cards-container">
                          {searchResults.artists.results.map((artist) => (
                            <div 
                              key={artist.id} 
                              className="music-card clickable"
                              onClick={() => viewArtist(artist)}
                            >
                              <div className="card-image">
                                <img src={ensureHttps(artist.image)} alt={artist.name} />
                              </div>
                              <div className="card-info">
                                <h3>{artist.name}</h3>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Playlists Section */}
                    {searchResults.playlists && searchResults.playlists.results && searchResults.playlists.results.length > 0 && (
                      <div className="results-section">
                        <h2>Playlists</h2>
                        <div className="cards-container">
                          {searchResults.playlists.results.map((playlist) => (
                            <div 
                              key={playlist.id} 
                              className="music-card clickable"
                              onClick={() => viewPlaylist(playlist)}
                            >
                              <div className="card-image">
                                <img src={ensureHttps(playlist.image)} alt={playlist.name} />
                              </div>
                              <div className="card-info">
                                <h3>{playlist.name}</h3>
                                <p>{playlist.songCount || 0} songs</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                renderWelcomeScreen()
              )}
            </div>
          )}
        </div>
        
        {/* Queue Sidebar - Show only on larger screens or when toggled */}
        {showQueue && (
          <div className="queue-sidebar">
            <div className="queue-header">
              <h3>Queue</h3>
              <button className="queue-close" onClick={() => setShowQueue(false)}>×</button>
            </div>
            {songQueue.length > 0 ? (
              <div className="queue-list">
                {songQueue.length === 0 ? (
                  <div className="empty-queue">Queue is empty</div>
                ) : (
                  songQueue.map((song, index) => renderSongItem(song, index, 'queue'))
                )}
                {isLoadingMoreSongs && <div className="queue-loading-indicator">Loading more...</div>}
              </div>
            ) : (
              <div className="no-songs">Queue is empty. Search for songs to add to the queue.</div>
            )}
          </div>
        )}
        
        {/* Audio Player */}
        {currentlyPlaying && (
          <div className="audio-player">
            <div className="progress-container" ref={progressBarRef} onClick={handleProgressBarClick}>
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            <div className="now-playing">
              <div className="mini-thumbnail">
                <img src={ensureHttps(currentlyPlaying.image)} alt={currentlyPlaying.name} />
              </div>
              <div className="track-info">
                <div className="track-name">{currentlyPlaying.name}</div>
                <div className="track-artist">{currentlyPlaying.primaryArtists || currentlyPlaying.artist || 'Unknown Artist'}</div>
              </div>
            </div>
            
            <div className="player-controls">
              <button className="player-control" onClick={playPreviousSong}>⏮</button>
              <button 
                className={`player-control play-pause ${isPlaying ? 'playing' : ''}`} 
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button className="player-control" onClick={playNextSong}>⏭</button>
              
              {/* Add Download Button here */}
              <DownloadButton 
                song={currentlyPlaying} 
                user={user} 
                hasPremiumAccess={hasPremiumAccess} 
              />
            </div>
            
            <div className="next-up">
              <div className="next-up-label">Next Up</div>
              {currentQueueIndex < songQueue.length - 1 ? (
                <div className="next-up-song">
                  <div className="next-thumbnail">
                    <img src={ensureHttps(songQueue[currentQueueIndex + 1].image)} alt={songQueue[currentQueueIndex + 1].name} />
                  </div>
                  <div className="next-song-info">
                    <div className="next-song-name">{songQueue[currentQueueIndex + 1].name}</div>
                    <div className="next-song-artist">
                      {songQueue[currentQueueIndex + 1].primaryArtists || songQueue[currentQueueIndex + 1].artist || 'Unknown Artist'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="next-up-song">
                  <div className="next-song-info">
                    <div className="next-song-name">End of Queue</div>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              className={`queue-toggle ${showQueue ? 'active' : ''}`}
              onClick={() => setShowQueue(!showQueue)}
            >
              {showQueue ? 'Hide Queue' : 'Show Queue'}
            </button>
            
            <audio
              ref={audioRef}
              src={audioUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleTrackEnded}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
            />
          </div>
        )}
      </div>
      
      {/* Modal Components */}
      {renderLoginModal()}
      {renderSubscriptionModal()}
    </div>
  );
}

// Wrap the app with the AuthProvider
function App() {
  return (
    <AuthProvider>
      <BerryMusicApp />
    </AuthProvider>
  );
}

export default App;
