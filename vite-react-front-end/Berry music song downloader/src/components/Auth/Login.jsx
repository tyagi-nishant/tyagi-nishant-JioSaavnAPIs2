import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../AuthContext'
import './Auth.css'

export function Login({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  
  const { signIn, signUp } = useAuth()

  // Refs for timeout logic
  const loadingRef = useRef(false);
  const timeoutRef = useRef(null);

  // Keep loadingRef synced with loading state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Clear previous timeout just in case
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a 3-second timeout to check if still processing
    timeoutRef.current = setTimeout(() => {
      console.log('Login timeout check triggered...');
      if (loadingRef.current) {
        console.warn('Login modal appears stuck in processing state. Attempting to close modal via onClose().');
        if (onClose) { 
          onClose();
        }
        setLoading(false);
      } else {
        console.log('Login timeout check: Loading is false, no action needed.');
      }
    }, 1000); // 3 seconds

    try {
      let response
      
      if (mode === 'login') {
        response = await signIn({ email, password })
      } else {
        response = await signUp({ 
          email, 
          password,
          options: {
            data: {
              email_confirmed: true
            }
          }
        })
      }

      // Log the response before checking for error
      console.log("Login component: Received response from signIn/signUp:", response);

      if (response.error) {
        throw response.error
      }
      
      // If no error, close the modal
      console.log("Login/Signup successful, calling onClose");
      if (onClose) { // Check if onClose prop exists
        onClose();
      }
      // Success state update is handled by the auth state change listener in AuthContext
      
    } catch (error) {
      setError(error.message || 'An error occurred. Please try again.')
    } finally {
      // Always clear the timeout when done (success or error)
      if (timeoutRef.current) {
        console.log('Clearing login timeout in finally block.');
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card login-modal-card">
        <button onClick={onClose} className="auth-close-button" aria-label="Close">
          &times;
        </button>

        <div className="auth-header">
          <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <p>to Berry Music Downloader</p>
        </div>
        
        {error && <div className="auth-error">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        <div className="auth-footer">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button 
                onClick={() => setMode('signup')}
                className="auth-link"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button 
                onClick={() => setMode('login')}
                className="auth-link"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
} 