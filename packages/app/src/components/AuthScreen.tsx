import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { signInWithGoogle, signInWithPhone, verifyPhoneOtp, continueAsGuest } = useAuth();

  const [method, setMethod] = useState<'phone' | 'google'>('phone');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setErrorMsg('Please enter a valid phone number with country code (e.g. +91...)');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    const { error } = await signInWithPhone(phone);
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Failed to send OTP. Try continuing as guest.');
    } else {
      setStep('verify');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setErrorMsg('Please enter the verification code sent to your phone');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    const { error } = await verifyPhoneOtp(phone, otp);
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Invalid OTP code');
    } else {
      if (onComplete) onComplete();
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    if (onComplete) onComplete();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justify: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
        color: '#ffffff',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '32px 24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌾</div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700' }}>Maize Advisor</h1>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#a0aec0' }}>
          Smart Offline-First Advisory for Karnataka Farmers
        </p>

        {errorMsg && (
          <div
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#fca5a5',
              marginBottom: '16px',
              textAlign: 'left'
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Method Toggle */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '20px'
          }}
        >
          <button
            onClick={() => { setMethod('phone'); setStep('send'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: method === 'phone' ? '#22c55e' : 'transparent',
              color: method === 'phone' ? '#ffffff' : '#a0aec0',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📱 Phone OTP
          </button>
          <button
            onClick={() => { setMethod('google'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: method === 'google' ? '#22c55e' : 'transparent',
              color: method === 'google' ? '#ffffff' : '#a0aec0',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🌐 Google
          </button>
        </div>

        {method === 'phone' ? (
          step === 'send' ? (
            <form onSubmit={handleSendOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#ffffff',
                    fontSize: '16px',
                    marginTop: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#22c55e',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'wait' : 'pointer',
                  marginTop: '6px'
                }}
              >
                {loading ? 'Sending OTP...' : 'Get OTP Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Enter Code sent to {phone}</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit OTP"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#ffffff',
                    fontSize: '18px',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    marginTop: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#22c55e',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'wait' : 'pointer'
                }}
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                type="button"
                onClick={() => setStep('send')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
              >
                Change Phone Number
              </button>
            </form>
          )
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '14px', color: '#cbd5e1' }}>Sign in using your Google account to sync your field history across devices.</p>
            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span>🌐</span> Continue with Google
            </button>
          </div>
        )}

        {/* Guest / Offline Mode Option */}
        <div style={{ width: '100%', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={handleGuest}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.05)',
              color: '#e2e8f0',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>⚡</span> Continue as Offline Farmer (No Login Required)
          </button>
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '6px' }}>
            Full agronomic rule engine works offline with zero internet
          </span>
        </div>
      </div>
    </div>
  );
};
