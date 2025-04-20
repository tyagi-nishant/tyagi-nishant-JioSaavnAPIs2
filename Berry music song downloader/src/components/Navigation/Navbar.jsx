import { useState, useEffect } from 'react'
import { useAuth } from '../../AuthContext'
import './Navbar.css'

export function Navbar({ showLoginModal, showSubscriptionModal }) {
  const { user, session, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  
  useEffect(() => {
    // Log auth state changes for debugging
    // console.log("Navbar: Auth state changed:", {
    //   user: user ? user.email : 'null',
    //   sessionExists: !!session,
    //   // Avoid logging the full token here
    // });
  }, [user, session])
  
  const handleSignOut = async () => {
    // console.log("Navbar: Sign out button clicked")
    try {
      // console.log("Navbar: Calling signOut function from AuthContext")
      const result = await signOut()
      // console.log("Navbar: signOut function returned:", result)
      // Optionally handle result, though AuthContext now handles internal state clearing

      // Force a page refresh after 1 second to ensure clean state (optional)
      // console.log("Navbar: Sign out successful. Refreshing page in 1 second...");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Navbar: Error during sign out:", error);
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