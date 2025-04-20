import { useState } from 'react'
import { useAuth } from '../../AuthContext'
import './Download.css'

export function DownloadButton({ song }) {
  const { user, hasPremiumAccess } = useAuth()
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState(null)
  
  const handleDownload = async () => {
    if (!hasPremiumAccess) return
    
    setIsDownloading(true)
    setError(null)
    
    try {
      // Fetch detailed song info to get the best quality download link
      const baseUrl = 'https://berry2.vercel.app/'
      const detailsResponse = await fetch(`${baseUrl}api/songs?ids=${song.id}`)
      if (!detailsResponse.ok) {
        throw new Error(`Failed to fetch song details: ${detailsResponse.status} ${detailsResponse.statusText}`)
      }

      const detailsData = await detailsResponse.json()
      const detailedSong = detailsData.data[0]

      if (!detailedSong.downloadUrl || !Array.isArray(detailedSong.downloadUrl) || detailedSong.downloadUrl.length === 0) {
        console.error('DownloadButton: Invalid or missing downloadUrl array in detailed song data', detailedSong)
        throw new Error('Could not find a valid download link/url property')
      }

      const actualDownloadLink = detailedSong.downloadUrl[detailedSong.downloadUrl.length - 1].link || detailedSong.downloadUrl[detailedSong.downloadUrl.length - 1].url

      if (!actualDownloadLink || typeof actualDownloadLink !== 'string') {
        console.error('DownloadButton: Could not find a valid download link/url property', detailedSong.downloadUrl[detailedSong.downloadUrl.length - 1])
        throw new Error('Could not extract a valid download URL string from the song data')
      }
      
      // Ensure URL is HTTPS (important for browsers)
      const httpsUrl = actualDownloadLink.replace(/^http:\/\//i, 'https://')

      // Fetch the actual file data
      const response = await fetch(httpsUrl)
      if (!response.ok) {
        throw new Error(`HTTP error fetching file! status: ${response.status}`)
      }

      const blob = await response.blob()

      // Determine the correct filename extension based on blob type if possible, otherwise default to mp3
      let fileExtension = 'mp3'
      if (blob.type.startsWith('audio/mpeg')) {
        fileExtension = 'mp3'
      } else if (blob.type.startsWith('audio/mp4') || blob.type.startsWith('video/mp4')) {
        // If the server correctly identifies it as mp4, use that extension
        // NOTE: This means the source file might actually be MP4!
        console.warn("DownloadButton: Detected blob type is MP4, not MP3.")
        fileExtension = 'mp4' 
      } // Add more types if needed (e.g., audio/aac -> aac)
      
      const filename = `${song.name || 'song'}.${fileExtension}`

      // Create an object URL for the blob
      const objectUrl = URL.createObjectURL(blob)
      
      // Create a temporary anchor element
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename // Use the determined filename
      // No target needed now
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Revoke the object URL after a short delay to allow the download to start
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
      }, 100)
    } catch (err) {
      console.error('Download error:', err)
      setError('Failed to download. Please try again.')
    } finally {
      setIsDownloading(false)
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
        className={`download-button ${isDownloading ? 'downloading' : ''}`}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? 'Downloading...' : 'Download MP3'}
      </button>
    </div>
  )
} 