import { createContext, useState, useEffect, useContext, useMemo } from 'react'
import { supabase } from './supabase'

// Create context
const AuthContext = createContext()

console.log("!!!! AuthProvider STARTING !!!!");

// Authentication provider
export function AuthProvider({ children }) {
  console.log("AuthProvider: Component rendering/re-rendering"); // Log component render
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    console.log("AuthProvider: useEffect[] running (Mount)");
    const setInitialSession = async () => {
      console.log("AuthProvider: setInitialSession started");
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        console.log("AuthProvider: getSession returned:", initialSession ? 'Session found' : 'No session');
        setSession(initialSession)
        setUser(initialSession?.user || null)

        if (initialSession?.user) {
          console.log("AuthProvider: Initial user found, attempting subscription fetch...");
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', initialSession.user.id)
            .single()
            
          if (data && !error) {
            console.log("AuthProvider: Initial subscription fetch SUCCESS. Data:", data);
            setSubscription(data) // *** State Update 1 ***
          } else if (error) {
            console.error("AuthProvider: Initial subscription fetch ERROR:", error); 
            setSubscription(null); // *** State Update 2 ***
          } else {
            console.log("AuthProvider: Initial subscription fetch returned NO DATA.");
            setSubscription(null); // *** State Update 3 ***
          }
        } else {
          console.log("AuthProvider: No initial user, skipping subscription fetch.");
          setSubscription(null); // *** State Update 4 ***
        }
      } catch (error) {
        console.error('AuthContext: Error in setInitialSession:', error)
        setSubscription(null); // Ensure null on error
      } finally {
        console.log("AuthProvider: setInitialSession finally block. Setting loading=false.");
        setLoading(false) // *** State Update 5 ***
      }
    }

    setInitialSession()

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`AuthProvider: onAuthStateChange triggered. Event: "${event}"`, newSession ? 'New session exists' : 'No new session');
        
        // Setting session/user/loading immediately
        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false) // Ensure loading is false on auth change
        
        if (newSession?.user) {
          console.log("AuthProvider: onAuthStateChange - User exists, attempting subscription fetch...");
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', newSession.user.id)
            .single()
            
          if (data && !error) {
             console.log("AuthProvider: onAuthStateChange - Subscription fetch SUCCESS. Data:", data);
             setSubscription(data) // *** State Update 6 ***
          } else if (error) {
             if (error.code !== 'PGRST116') { // Don't log error if it's just 'No rows found'
               console.error("AuthProvider: onAuthStateChange - Subscription fetch ERROR:", error);
             }
             setSubscription(null) // *** State Update 7 ***
          } else {
            console.log("AuthProvider: onAuthStateChange - Subscription fetch returned NO DATA.");
            setSubscription(null) // *** State Update 8 ***
          }
        } else {
          console.log("AuthProvider: onAuthStateChange - No user session, clearing subscription.");
          setSubscription(null) // *** State Update 9 ***
        }
      }
    )

    return () => {
      console.log("AuthProvider: useEffect[] cleanup (Unmount). Unsubscribing from auth changes.");
      authSubscription?.unsubscribe()
    }
  }, [])

  // Memoize the context value
  const value = useMemo(() => {
    console.log("AuthProvider: useMemo recalculating context value.");
    
    // Calculate hasPremiumAccess INSIDE useMemo
    const calculatedHasPremiumAccess = !!subscription && 
      (subscription.status === 'premium' || 
       (subscription.status === 'trial' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()));
    console.log(`AuthProvider: (inside useMemo) Calculated hasPremiumAccess = ${calculatedHasPremiumAccess} (Subscription state: ${JSON.stringify(subscription)})`);

    return {
        user,
        session,
        loading,
        subscription, 
        hasPremiumAccess: calculatedHasPremiumAccess, // Use the calculated value
        supabase, 
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: async () => {
          console.log("AuthContext: signOut function called");
          let signOutTimeoutId = null;

          try {
            console.log("AuthContext: Attempting supabase.auth.signOut() with timeout...");

            // Promise for the actual sign out call
            const signOutPromise = supabase.auth.signOut();

            // Promise for the timeout (e.g., 5 seconds)
            const timeoutPromise = new Promise((_, reject) => {
              signOutTimeoutId = setTimeout(() => {
                console.warn("AuthContext: supabase.auth.signOut() timed out after 5 seconds.");
                reject(new Error("Sign out timed out"));
              }, 1000); // 5 seconds
            });

            // Race the sign out against the timeout
            const { error: signOutError } = await Promise.race([signOutPromise, timeoutPromise]);

            // If we reached here, sign out finished (successfully or with error) before timeout
            clearTimeout(signOutTimeoutId);
            signOutTimeoutId = null;

            if (signOutError) {
              console.error("AuthContext: supabase.auth.signOut() returned an error:", signOutError);
              // Error occurred, but state will be cleared in finally block
            } else {
              console.log("AuthContext: supabase.auth.signOut() completed successfully via API (before timeout).");
              // Success, state will be cleared in finally block
            }

          } catch (error) {
            // This catches errors like the timeout or other exceptions
            console.error("AuthContext: Exception caught during signOut process (could be timeout):", error);
            // Ensure timeout is cleared if it exists and an error occurred
            if (signOutTimeoutId) {
              clearTimeout(signOutTimeoutId);
            }
            // State clearing will happen in finally block
          } finally {
            // ALWAYS clear React state regardless of success, failure, or timeout
            console.log("AuthContext: Entering finally block for signOut. Clearing local state.");
            setUser(null);
            setSession(null);
            setSubscription(null);
            // No need to interact with localStorage here, let Supabase manage its state
            console.log("AuthContext: Local React state cleared.");
            
            // Optional: Re-add page refresh here if needed for absolute UI consistency
            // console.log("Navbar: Refreshing page in 1 second...");
            // setTimeout(() => { window.location.reload(); }, 1000);
          }
          
          // No return value needed as state clearing is the primary goal here
        },
        updateSubscription: async (newSubscriptionData) => { 
          if (!user || !user.email) {
             console.error("AuthContext: Cannot update subscription, user or user email is missing.");
             return { error: { message: 'User not authenticated or email missing' } };
          }
          
          console.log("AuthContext: Updating subscription with data:", newSubscriptionData);
          const { data, error } = await supabase
            .from('subscriptions')
            .upsert({ 
              user_id: user.id,
              user_email: user.email,
              ...newSubscriptionData
            }, { onConflict: 'user_id' })
            .select()

          if (!error && data && data.length > 0) {
            console.log("AuthContext: Subscription update successful, returned data:", data[0]);
            setSubscription(data[0])
            return { data: data[0], error: null };
          } else {
            console.error("AuthContext: Error updating subscription:", error);
            return { data: null, error };
          }
        }
    };
  }, [user, session, loading, subscription, supabase]); // Remove hasPremiumAccess from dependencies, keep subscription

  console.log("AuthProvider: Rendering children. Loading:", loading);

  return (
    <AuthContext.Provider value={value}>
      {/* Conditionally render children based on loading state? Optional but can prevent issues. */}
      {/* {!loading ? children : <div>Loading Auth...</div>} */}
      {children} 
    </AuthContext.Provider>
  )
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 