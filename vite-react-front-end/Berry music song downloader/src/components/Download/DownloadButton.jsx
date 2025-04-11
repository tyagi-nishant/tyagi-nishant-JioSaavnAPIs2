import { useState } from 'react'
import { useAuth } from '../../AuthContext'
import './Download.css'

export function DownloadButton({ song }) {
  const { hasPremiumAccess, user } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)
  
  const handleDownload = async () => {
    if (!hasPremiumAccess) return
    
    setDownloading(true)
    setError(null)
    
    try {
      // Get the song URL from the song object
      const downloadUrl = song.downloadUrl || song.url || song.media_url
      
      if (!downloadUrl) {
        throw new Error('Download URL not available')
      }
      
      // Create a temporary anchor element
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${song.name || 'song'}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
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