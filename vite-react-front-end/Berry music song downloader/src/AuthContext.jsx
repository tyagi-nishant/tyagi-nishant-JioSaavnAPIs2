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
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    // Get initial session
    const setInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user || null)

        if (session?.user) {
          // Fetch subscription details
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single()

          if (data && !error) {
            setSubscription(data)
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
        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false)

        if (newSession?.user) {
          // Fetch subscription details on auth change
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', newSession.user.id)
            .single()

          if (data && !error) {
            setSubscription(data)
          } else {
            setSubscription(null)
          }
        } else {
          setSubscription(null)
        }
      }
    )

    return () => {
      authSubscription?.unsubscribe()
    }
  }, [])

  // Determine if the user has premium access
  const hasPremiumAccess = !!subscription && 
    (subscription.status === 'premium' || 
     (subscription.status === 'trial' && new Date(subscription.trial_ends_at) > new Date()))

  // Memoize the context value
  const value = useMemo(() => ({
    user,
    session,
    loading,
    subscription,
    hasPremiumAccess,
    // Auth functions - updated to match current Supabase API
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut: () => supabase.auth.signOut(),
    // Subscription functions
    updateSubscription: async (newSubscriptionData) => {
      if (!user) return { error: { message: 'User not authenticated' } }
      
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({ 
          user_id: user.id,
          ...newSubscriptionData
        })

      if (!error && data) {
        setSubscription(data[0] || newSubscriptionData)
      } else if (error) {
        console.error("Error updating subscription:", error);
      }
      
      return { data, error }
    }
  }), [user, session, loading, subscription, hasPremiumAccess]);

  console.log("AuthProvider rendering, loading:", loading);

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