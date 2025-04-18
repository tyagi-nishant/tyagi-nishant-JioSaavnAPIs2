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

  // Function to fetch subscription
  const fetchSubscription = async (userId) => {
    console.log(`AuthProvider: fetchSubscription called for User ID: ${userId}`);
    try {
      console.log("AuthProvider: fetchSubscription - Attempting: supabase.from('subscriptions').select...");
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        // .single(); // Temporarily remove .single()
        
      console.log("AuthProvider: fetchSubscription - Raw fetch result:", { data, error });

      // Adjust logic since data is now an array
      if (data && data.length > 0 && !error) {
        console.log("AuthProvider: fetchSubscription - Processing SUCCESS path (found data).");
        setSubscription(data[0]); // Use the first record if found
      } else if (error) {
        console.log("AuthProvider: fetchSubscription - Processing ERROR path.");
        // if (error.code !== 'PGRST116') { // Error code might differ without .single()
        console.error("AuthProvider: fetchSubscription - Subscription fetch ERROR:", error);
        // }
        setSubscription(null);
      } else {
        // This condition might be hit if data is an empty array []
        console.log("AuthProvider: fetchSubscription - Processing NO DATA path (empty array or null data).");
        setSubscription(null);
      }
    } catch (fetchError) {
      console.error("AuthProvider: fetchSubscription - EXCEPTION during fetch:", fetchError);
      setSubscription(null); // Ensure state is null on exception
    }
    console.log(`AuthProvider: fetchSubscription finished for User ID: ${userId}`);
  };

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
          console.log(`AuthProvider: Initial user found (ID: ${initialSession.user.id}), calling fetchSubscription...`);
          // Don't await here, let it run in background
          fetchSubscription(initialSession.user.id);
        } else {
          console.log("AuthProvider: No initial user, setting subscription to null.");
          setSubscription(null);
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
      (event, newSession) => { // Removed async here
        console.log(`AuthProvider: onAuthStateChange triggered. Event: "${event}"`, newSession ? 'New session exists' : 'No new session');
        
        // Setting session/user/loading immediately
        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false) // Ensure loading is false on auth change
        
        if (newSession?.user) {
          console.log(`AuthProvider: onAuthStateChange - User exists (ID: ${newSession.user.id}), calling fetchSubscription...`); 
          // Call the separate function, do NOT await it here
          fetchSubscription(newSession.user.id);
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
    
    // --- Start Access Calculations ---
    const isPremium = !!subscription && subscription.status === 'premium';
    const isTrial = !!subscription && subscription.status === 'trial' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date();
    const isBasic = !!subscription && subscription.status === 'basic';

    // Premium access (includes active trial)
    const calculatedHasPremiumAccess = isPremium || isTrial;

    // Basic access or higher (includes premium and active trial)
    const calculatedCanSearchAndStream = isBasic || isPremium || isTrial;
    // --- End Access Calculations ---

    console.log(`AuthProvider: (inside useMemo) Subscription: ${JSON.stringify(subscription)}, Premium: ${calculatedHasPremiumAccess}, Basic+: ${calculatedCanSearchAndStream}`);

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
          console.log("AuthContext: signOut function called");
          let signOutTimeoutId = null;

          try {
            console.log("AuthContext: Attempting supabase.auth.signOut() with timeout...");

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
            } else {
              console.log("AuthContext: supabase.auth.signOut() completed successfully via API (before timeout).");
            }

          } catch (error) {
            console.error("AuthContext: Exception caught during signOut process (could be timeout):", error);
            if (signOutTimeoutId) {
              clearTimeout(signOutTimeoutId);
            }
          } finally {
            console.log("AuthContext: Entering finally block for signOut. Clearing local state.");
            setUser(null);
            setSession(null);
            setSubscription(null);
            console.log("AuthContext: Local React state cleared.");
          }
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
  }, [user, session, loading, subscription]); // Removed supabase, added subscription dependency

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