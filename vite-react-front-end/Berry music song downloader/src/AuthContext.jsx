import { createContext, useState, useEffect, useContext, useMemo } from 'react'
import { supabase } from './supabase'

// Create context
const AuthContext = createContext()

console.log("!!!! AuthProvider STARTING !!!!");

// Authentication provider
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null) // Re-enabled

  useEffect(() => {
    // Get initial session
    const setInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user || null)

        // Re-enabled subscription fetch
        if (session?.user) {
          console.log("AuthContext: Initial session found, fetching subscription data");
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          if (data && !error) {
            console.log("AuthContext: Initial subscription data fetched:", data);
            setSubscription(data)
          } else if (error) {
            console.error("AuthContext: Error fetching initial subscription:", error); 
            setSubscription(null); // Ensure state is null on error
          } else {
            console.log("AuthContext: No initial subscription data found.");
            setSubscription(null); // Ensure state is null if no data
          }
        }
      } catch (error) {
        console.error('Error setting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    setInitialSession()

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`AuthContext: Auth state change event: "${event}"`, 
          "Session exists:", !!newSession, 
          "User ID:", newSession?.user?.id || "none");
        
        if (event === 'SIGNED_OUT') {
          console.log("AuthContext: User signed out event detected");
        } else if (event === 'SIGNED_IN') {
          console.log("AuthContext: User signed in event detected");
        }
        
        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false)

        // Re-enabled subscription fetch
        if (newSession?.user) {
          console.log("AuthContext: Session exists, fetching subscription data on auth change");
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', newSession.user.id)
            .single()
          if (data && !error) {
            console.log("AuthContext: Subscription data fetched on auth change:", data);
            setSubscription(data)
          } else if (error) {
             // Don't log error if it's just 'No rows found'
             if (error.code !== 'PGRST116') { 
               console.error("AuthContext: Error fetching subscription on auth change:", error);
             }
             setSubscription(null) // Ensure state is null on error
          } else {
            console.log("AuthContext: No subscription data found on auth change.");
            setSubscription(null) // Ensure state is null if no data
          }
        } else {
          console.log("AuthContext: No user session, clearing subscription data");
          setSubscription(null)
        }
      }
    )

    return () => {
      authSubscription?.unsubscribe()
    }
  }, [])

  // Re-enabled premium access calculation
  const hasPremiumAccess = !!subscription && 
    (subscription.status === 'premium' || 
     (subscription.status === 'trial' && new Date(subscription.trial_ends_at) > new Date()))

  // Memoize the context value
  const value = useMemo(() => ({
    user,
    session,
    loading,
    subscription, // Re-enabled
    hasPremiumAccess,
    // Auth functions - updated to match current Supabase API
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut: async () => {
      console.log("AuthContext: signOut function called");
      
      // Log the Supabase client and auth objects for inspection
      console.log("AuthContext: Inspecting Supabase client:", supabase);
      console.log("AuthContext: Inspecting Supabase auth object:", supabase?.auth);

      if (!supabase || !supabase.auth) {
        console.error("AuthContext: Supabase client or auth object is invalid!");
        // Attempt to clear state anyway
        setUser(null);
        setSession(null);
        setSubscription(null); // Re-enabled
        localStorage.removeItem('userSession');
        console.log("AuthContext: User state reset due to invalid Supabase client");
        throw new Error("Supabase client not initialized correctly.");
      }

      try {
        console.log("AuthContext: Attempting supabase.auth.signOut() with global scope");
        const { error } = await supabase.auth.signOut({ scope: 'global' }); 

        if (error) {
          console.error("AuthContext: Supabase signOut (global) returned an error:", error);
          // Attempt to clear state even on specific Supabase error
          setUser(null);
          setSession(null);
          setSubscription(null); // Re-enabled
          localStorage.removeItem('userSession');
          console.log("AuthContext: User state reset after Supabase signOut (global) error");
          throw error; // Re-throw the Supabase error
        }
        
        // If signOut resolved without error
        console.log("AuthContext: supabase.auth.signOut(global) completed successfully.");
        setUser(null);
        setSession(null);
        setSubscription(null); // Re-enabled
        localStorage.removeItem('userSession');
        console.log("AuthContext: User state reset after successful signOut (global)");
        
        return { success: true };

      } catch (error) {
        console.error("AuthContext: Exception caught during signOut (global) process:", error);

        // Attempt to clear state if an exception occurred
        setUser(null);
        setSession(null);
        setSubscription(null); // Re-enabled
        localStorage.removeItem('userSession');
        console.log("AuthContext: User state reset after exception during signOut (global)");
        
        if (error.message && error.message.includes("Supabase signOut (global) returned an error")) {
           throw error;
        } else {
           throw new Error(`SignOut(global) failed: ${error.message || error}`);
        }
      }
    },
    // Re-enabled subscription update function
    updateSubscription: async (newSubscriptionData) => { 
      if (!user) return { error: { message: 'User not authenticated' } }
      
      console.log("AuthContext: Updating subscription with data:", newSubscriptionData);
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({ 
          user_id: user.id,
          ...newSubscriptionData
        }, { onConflict: 'user_id' }) // Ensure upsert uses user_id as conflict target
        .select() // Ensure the updated/inserted row is returned

      if (!error && data && data.length > 0) {
        console.log("AuthContext: Subscription update successful, returned data:", data[0]);
        setSubscription(data[0])
        return { data: data[0], error: null };
      } else {
        console.error("AuthContext: Error updating subscription:", error);
        // Optionally keep old subscription state or set to null?
        // setSubscription(null); 
        return { data: null, error };
      }
    }
  }), [user, session, loading, subscription, hasPremiumAccess]); // Re-added subscription to deps

  console.log("AuthProvider rendering, loading:", loading, "Subscription:", subscription);

  return (
    <AuthContext.Provider value={value}>
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