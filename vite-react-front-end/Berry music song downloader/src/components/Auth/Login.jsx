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
  const timeoutRef = useRef(null);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => { 
    // Cleanup timeout on unmount
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
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
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }

    // Start timeout ONLY for login mode
    if (mode === 'login') {
      timeoutRef.current = setTimeout(() => {
        console.log('Login mode timeout check triggered...');
        if (loadingRef.current) {
          console.warn('Login modal appears stuck in processing state. Attempting to close modal via onClose().');
          if (onClose) onClose();
          setLoading(false); // Also set loading false if timeout closes it
        } else {
          console.log('Login mode timeout check: Loading is false, no action needed.');
        }
      }, 1000); // 3 seconds for login timeout
    }

    try {
      let response
      
      if (mode === 'login') {
        response = await signIn({ email, password });
        console.log("Login component: Received response from signIn:", response);
        if (response.error) throw response.error;
        console.log("Login successful, calling onClose");
        if (onClose) onClose();
        // setLoading(false) will be handled in finally for login

      } else if (mode === 'signup') {
        response = await signUp({ email, password });
        console.log("Login component: Received response from signUp:", response);
        if (response.error) throw response.error;
        console.log("Signup successful, showing notification.");
        setNotification("Account created! Please check your email for a confirmation link to activate your account and log in.");
        setEmail(''); 
        setPassword('');
        setLoading(false); // Set loading false immediately for signup success
        // No timeout was started for signup, so no need to clear here

      } else if (mode === 'forgotPassword') {
        if (!supabase) throw new Error('Supabase client not available'); 
        console.log(`Attempting password reset for email: ${email}`);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin, 
        });
        console.log("Password reset response:", { resetError });
        if (resetError) throw resetError;
        setNotification("Password reset link sent! Please check your email (including spam folder).");
        setEmail('');
        setLoading(false); // Set loading false immediately for reset success
        // No timeout was started for forgotPassword, so no need to clear here
      }
      
    } catch (error) {
      console.error(`Error during ${mode}:`, error);
      setError(error.message || 'An error occurred. Please try again.')
      setLoading(false); // Ensure loading is false on ANY error
    } finally {
      // Clear timeout if it exists (this handles login mode success/error)
      if (timeoutRef.current) {
        console.log('Clearing login timeout in finally block.');
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
       // Ensure loading is false (might be redundant but safe)
      setLoading(false); 
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