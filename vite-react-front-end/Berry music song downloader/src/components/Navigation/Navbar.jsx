import { useState, useEffect } from 'react'
import { useAuth } from '../../AuthContext'
import './Navbar.css'

export function Navbar({ showLoginModal, showSubscriptionModal }) {
  const { user, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  
  useEffect(() => {
    // Debug logging
    console.log("Navbar: Auth state changed:", { 
      isLoggedIn: !!user, 
      userEmail: user?.email,
      userId: user?.id 
    })
  }, [user])
  
  const handleSignOut = async () => {
    console.log("Navbar: Sign out button clicked")
    try {
      console.log("Navbar: Calling signOut function from AuthContext")
      const result = await signOut()
      console.log("Navbar: signOut function returned:", result)
      setShowDropdown(false)

      // Add a 1-second delay before refreshing
      console.log("Navbar: Sign out successful. Refreshing page in 1 second...");
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1000 milliseconds = 1 second

    } catch (error) {
      console.error("Navbar: Error during sign out:", error)
      alert("Sign out failed. Please try again.")
    }
  }
  
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="logo">
          <img src="/renaissance-logo.svg" alt="Berry Music" className="app-logo" />
          <h1>Berry Music</h1>
        </div>
      </div>
      
      <div className="navbar-right">
        {user ? (
          <div className="user-menu">
            <button 
              className="profile-button"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="avatar">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="username">{user.email || 'User'}</span>
            </button>
            
            {showDropdown && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={showSubscriptionModal}>
                  Subscription
                </button>
                <button className="dropdown-item" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="search-button signin-standalone" onClick={showLoginModal}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  )
} 