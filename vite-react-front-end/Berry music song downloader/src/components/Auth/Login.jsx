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
  
  // Need supabase instance directly for password reset
  const { signIn, signUp, supabase } = useAuth() 

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

  // Helper to switch mode and clear messages
  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setError(null);
    setNotification(null);
    // Optionally clear fields (especially password when switching TO forgotPassword)
    if (newMode === 'forgotPassword') {
      setPassword('');
    } else if (newMode === 'login' || newMode === 'signup') {
      // Clear notification when switching back from forgotPassword success
      setNotification(null); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotification(null);
    setLoading(true)

    // Clear previous timeout just in case
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a 3-second timeout to check if still processing
    timeoutRef.current = setTimeout(() => {
      console.log('Login timeout check triggered...');
      if (loadingRef.current) {
        console.warn('Modal appears stuck in processing state. Attempting to close modal via onClose().');
        if (onClose) onClose();
        setLoading(false); 
      } else {
        console.log('Login timeout check: Loading is false, no action needed.');
      }
    }, 3000);

    try {
      let response
      
      if (mode === 'login') {
        response = await signIn({ email, password });
        console.log("Login component: Received response from signIn:", response);
        if (response.error) throw response.error;
        console.log("Login successful, calling onClose");
        if (onClose) onClose();

      } else if (mode === 'signup') {
        response = await signUp({ email, password }); // Removed options as Supabase handles defaults
        console.log("Login component: Received response from signUp:", response);
        if (response.error) throw response.error;
        console.log("Signup successful, showing notification.");
        setNotification("Account created! Please check your email for a confirmation link to activate your account and log in.");
        setEmail(''); 
        setPassword('');
        setLoading(false); // Explicitly stop loading indicator for signup success message
        if (timeoutRef.current) clearTimeout(timeoutRef.current); // Clear timeout early for signup success

      } else if (mode === 'forgotPassword') {
        if (!supabase) throw new Error('Supabase client not available'); // Guard clause
        console.log(`Attempting password reset for email: ${email}`);
        // Redirect URL should point to where users can set a new password in your app
        // For now, just redirecting to the base URL after confirmation.
        // You'll need to set up a password reset page/route later.
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin, // Or your specific reset password page URL
        });
        console.log("Password reset response:", { resetError });
        if (resetError) throw resetError;
        setNotification("Password reset link sent! Please check your email (including spam folder).");
        setEmail(''); // Clear email field after sending
        setLoading(false); // Stop loading indicator
        if (timeoutRef.current) clearTimeout(timeoutRef.current); // Clear timeout early
      }
      
    } catch (error) {
      console.error(`Error during ${mode}:`, error);
      setError(error.message || 'An error occurred. Please try again.')
    } finally {
      // Clear timeout if it hasn't been cleared already (e.g., on error)
      if (timeoutRef.current) {
        console.log('Clearing timeout in finally block (if still active).');
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Ensure loading is false if an error occurred or on login success (already handled for signup/reset)
      if (mode === 'login' || error) {
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