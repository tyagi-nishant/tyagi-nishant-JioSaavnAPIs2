import { createContext, useState, useEffect, useContext, useMemo } from 'react'
import { supabase } from './supabase'

// Create context
const AuthContext = createContext()

// Authentication provider
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)

  // Function to fetch subscription
  const fetchSubscription = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        // .single(); // Temporarily remove .single()
        
      if (data && data.length > 0 && !error) {
        setSubscription(data[0]); // Use the first record if found
      } else if (error) {
        console.error("AuthProvider: fetchSubscription - Subscription fetch ERROR:", error);
        setSubscription(null);
      } else {
        setSubscription(null);
      }
    } catch (fetchError) {
      console.error("AuthProvider: fetchSubscription - EXCEPTION during fetch:", fetchError);
      setSubscription(null); // Ensure state is null on exception
    }
  };

  useEffect(() => {
    const setInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        setSession(initialSession)
        setUser(initialSession?.user || null)

        if (initialSession?.user) {
          fetchSubscription(initialSession.user.id);
        } else {
          setSubscription(null);
        }
      } catch (error) {
        console.error('AuthContext: Error in setInitialSession:', error)
        setSubscription(null); // Ensure null on error
      } finally {
        setLoading(false) // *** State Update 5 ***
      }
    }

    setInitialSession()

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => { // Removed async here
        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false) // Ensure loading is false on auth change
        
        if (newSession?.user) {
          fetchSubscription(newSession.user.id);
        } else {
          setSubscription(null) // *** State Update 9 ***
        }
      }
    )

    return () => {
      authSubscription?.unsubscribe()
    }
  }, [])

  // Memoize the context value
  const value = useMemo(() => {
    const isPremium = !!subscription && subscription.status === 'premium';
    const isTrial = !!subscription && subscription.status === 'trial' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date();
    const isBasic = !!subscription && subscription.status === 'basic';

    // Premium access (includes active trial)
    const calculatedHasPremiumAccess = isPremium || isTrial;

    // Basic access or higher (includes premium and active trial)
    const calculatedCanSearchAndStream = isBasic || isPremium || isTrial;

    return {
        user,
        session,
        loading,
        subscription, 
        hasPremiumAccess: calculatedHasPremiumAccess, // For downloads
        canSearchAndStream: calculatedCanSearchAndStream, // For search & streaming
        supabase, 
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: async () => {
          let signOutTimeoutId = null;

          try {
            const signOutPromise = supabase.auth.signOut();
            const timeoutPromise = new Promise((_, reject) => {
              signOutTimeoutId = setTimeout(() => {
                console.warn("AuthContext: supabase.auth.signOut() timed out after 5 seconds.");
                reject(new Error("Sign out timed out"));
              }, 5000);
            });

            const { error: signOutError } = await Promise.race([signOutPromise, timeoutPromise]);

            clearTimeout(signOutTimeoutId);
            signOutTimeoutId = null;

            if (signOutError) {
              console.error("AuthContext: supabase.auth.signOut() returned an error:", signOutError);
            }

          } catch (error) {
            console.error("AuthContext: Exception caught during signOut process (could be timeout):", error);
            if (signOutTimeoutId) {
              clearTimeout(signOutTimeoutId);
            }
          }
        },
        updateSubscription: async (newSubscriptionData) => {
          if (!user || !user.email) {
            console.error("AuthContext: Cannot update subscription, user or user email is missing.");
            return { error: { message: 'User not authenticated or email missing' } };
          }
          
          const { data, error } = await supabase
            .from('subscriptions')
            .upsert({ 
              user_id: user.id,
              user_email: user.email,
              ...newSubscriptionData
            }, { onConflict: 'user_id' })
            .select()

          if (!error && data && data.length > 0) {
            setSubscription(data[0])
            return { data: data[0], error: null };
          } else {
            console.error("AuthContext: Error updating subscription:", error);
            return { data: null, error };
          }
        }
    };
  }, [user, session, loading, subscription]); // Removed supabase, added subscription dependency

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