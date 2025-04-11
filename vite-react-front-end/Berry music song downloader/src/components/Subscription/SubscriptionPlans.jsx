import { useState } from 'react'
import { useAuth } from '../../AuthContext'
import './Subscription.css'

export function SubscriptionPlans() {
  const { user, subscription, updateSubscription } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [couponCode, setCouponCode] = useState('')
  const [showCouponInput, setShowCouponInput] = useState(false)
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  })

  const handleTrialSubscription = async () => {
    if (!user) return
    
    setError(null)
    setSuccess(null)
    setLoading(true)
    
    try {
      // In a real app, you would validate card details and process the payment
      // Here we're just simulating the subscription process
      
      const trialEnd = new Date()
      trialEnd.setMonth(trialEnd.getMonth() + 1) // 1 month from now
      
      const { error } = await updateSubscription({
        status: 'trial',
        tier: 'basic',
        trial_ends_at: trialEnd.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      if (error) throw error
      
      setSuccess('Your 1-month trial has been activated! Enjoy listening to Berry Music.')
    } catch (err) {
      setError(err.message || 'Failed to activate trial. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const handlePremiumSubscription = async () => {
    if (!user) return
    
    setError(null)
    setSuccess(null)
    setLoading(true)
    
    try {
      // In a real app, you would validate card details and process the payment
      // Here we're just simulating the subscription process
      
      const { error } = await updateSubscription({
        status: 'premium',
        tier: 'premium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      if (error) throw error
      
      setSuccess('Premium subscription activated! You now have full access to Berry Music, including downloads.')
    } catch (err) {
      setError(err.message || 'Failed to activate premium subscription. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCouponApply = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code')
      return
    }
    
    setError(null)
    setSuccess(null)
    setLoading(true)
    
    try {
      // In a real app, you would validate the coupon code against a database
      // Here we're just simulating a valid coupon code "BERRY50"
      
      if (couponCode.toUpperCase() === 'BERRY50') {
        const { error } = await updateSubscription({
          status: 'premium',
          tier: 'premium',
          coupon_applied: 'BERRY50',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        
        if (error) throw error
        
        setSuccess('Coupon applied successfully! You now have premium access with a 50% discount.')
      } else {
        setError('Invalid coupon code. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Failed to apply coupon. Please try again.')
    } finally {
      setLoading(false)
      setCouponCode('')
    }
  }
  
  if (!user) {
    return (
      <div className="subscription-container">
        <div className="subscription-message">
          <h2>Sign in to Subscribe</h2>
          <p>Please sign in to access subscription options.</p>
        </div>
      </div>
    )
  }
  
  // User has an active subscription
  if (subscription && (subscription.status === 'premium' || 
      (subscription.status === 'trial' && new Date(subscription.trial_ends_at) > new Date()))) {
    
    const isTrialActive = subscription.status === 'trial' && new Date(subscription.trial_ends_at) > new Date()
    
    return (
      <div className="subscription-container">
        <div className="subscription-card active">
          <div className="subscription-header">
            <h2>Active Subscription</h2>
            <div className="subscription-badge">
              {subscription.status === 'premium' ? 'PREMIUM' : 'TRIAL'}
            </div>
          </div>
          
          <div className="subscription-details">
            <p>Status: <span className="highlight">{subscription.status}</span></p>
            {isTrialActive && (
              <p>
                Trial ends: <span className="highlight">
                  {new Date(subscription.trial_ends_at).toLocaleDateString()}
                </span>
              </p>
            )}
            {subscription.coupon_applied && (
              <p>Coupon applied: <span className="highlight">{subscription.coupon_applied}</span></p>
            )}
          </div>
          
          {isTrialActive && (
            <div className="upgrade-section">
              <h3>Upgrade to Premium</h3>
              <p>Get full access including downloads for $10/year</p>
              <button 
                className="subscription-button"
                onClick={() => setShowCouponInput(false)}
              >
                Upgrade Now
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
  
  // User needs to subscribe
  return (
    <div className="subscription-container">
      {error && <div className="subscription-error">{error}</div>}
      {success && <div className="subscription-success">{success}</div>}
      
      <div className="subscription-plans">
        <div className="subscription-card">
          <div className="subscription-header">
            <h2>Free Trial</h2>
            <div className="plan-price">$0</div>
          </div>
          
          <ul className="plan-features">
            <li>1 month of streaming access</li>
            <li>Full catalog of songs</li>
            <li>Ad-free listening</li>
            <li>No download capability</li>
          </ul>
          
          <div className="card-details">
            <h3>Enter Your Card Details</h3>
            <p className="card-subtitle">No charges during trial period</p>
            
            <div className="card-form">
              <div className="form-group">
                <label>Card Number</label>
                <input 
                  type="text" 
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.number}
                  onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Expiry</label>
                  <input 
                    type="text" 
                    placeholder="MM/YY"
                    value={cardDetails.expiry}
                    onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>CVC</label>
                  <input 
                    type="text" 
                    placeholder="123"
                    value={cardDetails.cvc}
                    onChange={(e) => setCardDetails({...cardDetails, cvc: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Cardholder Name</label>
                <input 
                  type="text" 
                  placeholder="John Doe"
                  value={cardDetails.name}
                  onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                />
              </div>
            </div>
          </div>
          
          <button 
            className="subscription-button"
            onClick={handleTrialSubscription}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Start Free Trial'}
          </button>
        </div>
        
        <div className="subscription-card premium">
          <div className="subscription-header">
            <h2>Premium</h2>
            <div className="plan-price">$10<span>/year</span></div>
          </div>
          
          <ul className="plan-features">
            <li>Unlimited streaming access</li>
            <li>Full catalog of songs</li>
            <li>Ad-free listening</li>
            <li>Download songs to your device</li>
            <li>Premium support</li>
          </ul>
          
          {!showCouponInput ? (
            <>
              <div className="card-details">
                <h3>Enter Your Card Details</h3>
                
                <div className="card-form">
                  <div className="form-group">
                    <label>Card Number</label>
                    <input 
                      type="text" 
                      placeholder="1234 5678 9012 3456"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Expiry</label>
                      <input 
                        type="text" 
                        placeholder="MM/YY"
                        value={cardDetails.expiry}
                        onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>CVC</label>
                      <input 
                        type="text" 
                        placeholder="123"
                        value={cardDetails.cvc}
                        onChange={(e) => setCardDetails({...cardDetails, cvc: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Cardholder Name</label>
                    <input 
                      type="text" 
                      placeholder="John Doe"
                      value={cardDetails.name}
                      onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <button 
                className="subscription-button"
                onClick={handlePremiumSubscription}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe Now'}
              </button>
              
              <button 
                className="coupon-button"
                onClick={() => setShowCouponInput(true)}
              >
                Have a coupon code?
              </button>
            </>
          ) : (
            <div className="coupon-section">
              <h3>Enter Coupon Code</h3>
              <div className="coupon-form">
                <input 
                  type="text" 
                  placeholder="Enter your coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
                <button 
                  className="apply-coupon"
                  onClick={handleCouponApply}
                  disabled={loading}
                >
                  {loading ? 'Applying...' : 'Apply'}
                </button>
              </div>
              <button 
                className="back-to-payment"
                onClick={() => setShowCouponInput(false)}
              >
                Back to payment options
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 