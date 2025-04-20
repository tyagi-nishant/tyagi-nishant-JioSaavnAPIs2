import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../AuthContext'
import './Auth.css'

export function Login({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login') // 'login', 'signup', or 'forgotPassword'
  const [notification, setNotification] = useState(null);
  
  const { signIn, signUp, supabase } = useAuth()

  // Restore Refs and useEffects for timeout logic
  const loadingRef = useRef(false);
  const loginTimeoutRef = useRef(null);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => { 
    // Cleanup timeout on unmount
    return () => { if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current); };
  }, []);

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setError(null);
    setNotification(null);
    if (newMode === 'forgotPassword') {
      setPassword('');
    } else if (newMode === 'login' || newMode === 'signup') {
      setNotification(null); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotification(null);
    setLoading(true)

    // Clear previous timeout (if any)
    if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
    }

    // Start timeout ONLY for login mode
    if (mode === 'login') {
      loginTimeoutRef.current = setTimeout(() => {
        if (loadingRef.current) {
          console.warn('Login modal appears stuck in processing state. Attempting to close modal via onClose().');
          setError('Login timed out. Please try again.');
          setLoading(false);
        } else {
        }
      }, 3000); // 3 seconds for login timeout
    }

    try {
      let response
      
      if (mode === 'login') {
        response = await signIn({ email, password });
        if (!response.error) {
          onClose();
        } else {
          setError(response.error.message);
        }
      } else if (mode === 'signup') {
        response = await signUp({ email, password });
        if (!response.error) {
          setNotification('Signup successful! Please check your email to verify your account.');
          setLoading(false);
        } else {
          setLoading(false);
          setError(response.error.message);
        }
      } else if (mode === 'forgotPassword') {
        if (!supabase) throw new Error('Supabase client not available'); 
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (!resetError) {
          setNotification('Password reset email sent! Please check your inbox.');
        } else {
          setError(resetError.message);
        }
        setLoading(false);
      }
      
    } catch (error) {
      setError(error.message);
      setLoading(false);
    } finally {
      // Clear timeout if it exists (this handles login mode success/error)
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }
      if (mode === 'login') {
        setLoading(false);
      }
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card login-modal-card">
        <button onClick={onClose} className="auth-close-button" aria-label="Close">
          &times;
        </button>

        <div className="auth-header">
          {/* Dynamically change header based on mode */} 
          <h2>{
            mode === 'login' ? 'Sign In' : 
            mode === 'signup' ? 'Create Account' : 
            'Reset Password' 
          }</h2>
          <p>to Berry Music Downloader</p>
        </div>
        
        {notification && !error && <div className="auth-notification">{notification}</div>} 
        {error && <div className="auth-error">{error}</div>}
        
        {/* Don't show form if signup/reset notification is shown */} 
        {!(notification && (mode === 'signup' || mode === 'forgotPassword')) && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            {/* Only show password field in login/signup mode */} 
            {(mode === 'login' || mode === 'signup') && (
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}
            
            {/* Show forgot password link only in login mode */} 
            {mode === 'login' && (
              <div className="auth-extra-links">
                <button 
                  type="button" 
                  onClick={() => handleModeSwitch('forgotPassword')}
                  className="auth-link forgot-password-link"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button 
              type="submit" 
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Processing...' : 
               mode === 'login' ? 'Sign In' : 
               mode === 'signup' ? 'Sign Up' : 
               'Send Reset Link'}
            </button>
          </form>
        )}
        
        {/* Footer logic for switching modes */} 
        {!(notification && (mode === 'signup' || mode === 'forgotPassword')) && (
          <div className="auth-footer">
            {mode === 'login' && (
              <p>
                Don't have an account?{' '}
                <button 
                  onClick={() => handleModeSwitch('signup')}
                  className="auth-link"
                >
                  Sign Up
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button 
                  onClick={() => handleModeSwitch('login')}
                  className="auth-link"
                >
                  Sign In
                </button>
              </p>
            )}
            {mode === 'forgotPassword' && (
              <p>
                Remembered your password?{' '}
                <button 
                  onClick={() => handleModeSwitch('login')}
                  className="auth-link"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        )}
        {/* Show Back to Sign In link also if forgot password notification is shown */} 
        {(notification && mode === 'forgotPassword') && (
           <div className="auth-footer">
              <button 
                onClick={() => handleModeSwitch('login')}
                className="auth-link"
              >
                Back to Sign In
              </button>
            </div>
        )}
      </div>
    </div>
  )
} 