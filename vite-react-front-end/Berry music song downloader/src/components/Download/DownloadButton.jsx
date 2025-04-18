import { useState } from 'react'
import { useAuth } from '../../AuthContext'
import './Download.css'

export function DownloadButton({ song }) {
  const { hasPremiumAccess, user } = useAuth()
  // Log the received hasPremiumAccess value
  console.log("DownloadButton: Received hasPremiumAccess:", hasPremiumAccess, "User:", user?.email);
  
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)
  
  const handleDownload = async () => {
    if (!hasPremiumAccess) return
    
    setDownloading(true)
    setError(null)
    
    try {
      // Get the song URL from the song object
      // The downloadUrl is an array, find the best quality link (usually the last one)
      let actualDownloadLink = null;
      if (song.downloadUrl && Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
        // Prefer the last object in the array (often highest quality)
        const lastDownloadObject = song.downloadUrl.slice(-1)[0];
        actualDownloadLink = lastDownloadObject?.link || lastDownloadObject?.url;
      } else if (song.url) { // Fallback to song.url if downloadUrl is missing/invalid
        actualDownloadLink = song.url;
      } else if (song.media_url) { // Further fallback
         actualDownloadLink = song.media_url;
      }
      
      console.log("DownloadButton: Extracted URL:", actualDownloadLink); // Log the extracted URL

      if (!actualDownloadLink || typeof actualDownloadLink !== 'string') {
        throw new Error('Could not extract a valid download URL string from the song data');
      }
      
      // Ensure URL is HTTPS (important for browsers)
      const httpsUrl = actualDownloadLink.startsWith('http://') 
                       ? 'https://' + actualDownloadLink.substring(7) 
                       : actualDownloadLink;

      console.log("DownloadButton: Using HTTPS URL for download:", httpsUrl);

      // --- Fetch-based download approach --- 
      try {
        console.log("DownloadButton: Fetching file data from URL...");
        const response = await fetch(httpsUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        console.log("DownloadButton: File fetch successful, creating blob...");
        const blob = await response.blob();
        
        // Determine the correct filename extension based on blob type if possible, otherwise default to mp3
        let fileExtension = 'mp3';
        if (blob.type.startsWith('audio/mpeg')) {
          fileExtension = 'mp3';
        } else if (blob.type.startsWith('audio/mp4') || blob.type.startsWith('video/mp4')) {
           // If the server correctly identifies it as mp4, use that extension
           // NOTE: This means the source file might actually be MP4!
           console.warn("DownloadButton: Detected blob type is MP4, not MP3.");
           fileExtension = 'mp4'; 
        } // Add more types if needed (e.g., audio/aac -> aac)
        
        const filename = `${song.name || 'song'}.${fileExtension}`;
        console.log(`DownloadButton: Creating object URL for blob (type: ${blob.type}, size: ${blob.size}), suggested filename: ${filename}`);
        
        // Create an object URL for the blob
        const objectUrl = URL.createObjectURL(blob);

        // Create a temporary anchor element
        const a = document.createElement('a');
        a.href = objectUrl; 
        a.download = filename; // Use the determined filename
        // No target needed now
        document.body.appendChild(a);
        console.log("DownloadButton: Triggering download click...");
        a.click();
        document.body.removeChild(a);

        // Revoke the object URL after a short delay to allow the download to start
        setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
        console.log("DownloadButton: Download initiated, object URL revoked (or will be soon).");

      } catch (fetchError) {
        console.error('DownloadButton: Error during fetch or blob creation:', fetchError);
        throw fetchError; // Re-throw to be caught by the outer catch block
      }
      // --- End Fetch-based download approach ---
      
    } catch (err) {
      console.error('Download error:', err)
      setError('Failed to download. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  
  // User not logged in
  if (!user) {
    return (
      <div className="download-button-container">
        <button 
          className="download-button locked"
          onClick={() => alert('Please sign in to download songs')}
        >
          <span className="lock-icon">🔒</span>
          Download
        </button>
      </div>
    )
  }
  
  // User logged in but no premium access
  if (!hasPremiumAccess) {
    return (
      <div className="download-button-container">
        <button 
          className="download-button locked"
          onClick={() => alert('Please upgrade to Premium to download songs')}
        >
          <span className="lock-icon">🔒</span>
          Premium Only
        </button>
      </div>
    )
  }
  
  // User with premium access
  return (
    <div className="download-button-container">
      {error && <div className="download-error">{error}</div>}
      <button 
        className={`download-button ${downloading ? 'downloading' : ''}`}
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? 'Downloading...' : 'Download MP3'}
      </button>
    </div>
  )
} 