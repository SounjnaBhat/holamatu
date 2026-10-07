import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithPhone,
    verifyPhoneOtp,
    continueAsGuest
  } = useAuth();

  const [mode, setMode] = useState<'register' | 'login' | 'phone'>('register');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('Dharwad');
  const [lang, setLang] = useState<'kn' | 'en'>('kn');

  // Phone OTP State
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'send' | 'verify'>('send');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg(lang === 'kn' ? 'ದಯವಿಟ್ಟು ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ' : 'Please provide email and password');
      return;
    }
    if (password.length < 6) {
      setErrorMsg(lang === 'kn' ? 'ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳಾಗಿರಬೇಕು' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error, user } = await signUpWithEmail(email, password, {
      name: name.trim() || 'Karnataka Farmer',
      location,
      preferred_lang: lang
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Registration failed');
    } else {
      if (user?.identities?.length === 0) {
        setErrorMsg('An account with this email already exists. Try signing in.');
      } else {
        setSuccessMsg(lang === 'kn' ? 'ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!' : 'Account registered successfully!');
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 600);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg(lang === 'kn' ? 'ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ' : 'Please enter email and password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await signInWithEmail(email, password);
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Invalid login credentials');
    } else {
      if (onComplete) onComplete();
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setErrorMsg('Please enter a valid phone number with country code (+91...)');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    const { error } = await signInWithPhone(phone);
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Failed to send OTP. Try registering with email or continue as guest.');
    } else {
      setPhoneStep('verify');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setErrorMsg('Please enter the 6-digit code');
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
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #09171f 0%, #132f38 50%, #1e454f 100%)',
        color: '#ffffff',
        padding: '16px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '28px 20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        {/* Logo & Header */}
        <div style={{ fontSize: '42px', marginBottom: '8px' }}>🌾</div>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
          Maize Advisor • ಮೆಕ್ಕೆಜೋಳ ಸಲಹೆಗಾರ
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
          {lang === 'kn' ? 'ಕರ್ನಾಟಕದ ರೈತರಿಗಾಗಿ ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಲಹೆಗಾರ' : 'Smart Offline-First Advisory for Karnataka Farmers'}
        </p>

        {/* Feedback messages */}
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
              boxSizing: 'border-box',
              textAlign: 'left'
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div
            style={{
              width: '100%',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid #22c55e',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#86efac',
              marginBottom: '16px',
              boxSizing: 'border-box',
              textAlign: 'left'
            }}
          >
            ✅ {successMsg}
          </div>
        )}

        {/* Mode Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '14px',
            padding: '4px',
            marginBottom: '18px',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: mode === 'register' ? '#22c55e' : 'transparent',
              color: mode === 'register' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📝 Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: mode === 'login' ? '#22c55e' : 'transparent',
              color: mode === 'login' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🔑 Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('phone'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: mode === 'phone' ? '#22c55e' : 'transparent',
              color: mode === 'phone' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📱 Phone
          </button>
        </div>

        {/* 1. REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>
                {lang === 'kn' ? 'ರೈತರ ಹೆಸರು (Farmer Name)' : 'Full Name'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Patil"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  fontSize: '15px',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farmer@example.com"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  fontSize: '15px',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Password (min 6 characters)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  fontSize: '15px',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Location & Language side-by-side */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>
                  {lang === 'kn' ? 'ಜಿಲ್ಲೆ (District)' : 'District'}
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#132f38',
                    color: '#ffffff',
                    fontSize: '14px',
                    marginTop: '4px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Dharwad">Dharwad (ಧಾರವಾಡ)</option>
                  <option value="Belagavi">Belagavi (ಬೆಳಗಾವಿ)</option>
                  <option value="Haveri">Haveri (ಹಾವೇರಿ)</option>
                  <option value="Gadag">Gadag (ಗದಗ)</option>
                  <option value="Bagalkot">Bagalkot (ಬಾಗಲಕೋಟೆ)</option>
                  <option value="Davangere">Davangere (ದಾವಣಗೆರೆ)</option>
                </select>
              </div>

              <div style={{ flex: 1, textAlign: 'left' }}>
                <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Language</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as 'kn' | 'en')}
                  style={{
                    width: '100%',
                    padding: '11px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#132f38',
                    color: '#ffffff',
                    fontSize: '14px',
                    marginTop: '4px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                border: 'none',
                background: '#22c55e',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'wait' : 'pointer',
                marginTop: '6px',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
              }}
            >
              {loading ? 'Registering...' : (lang === 'kn' ? '🌾 ನೋಂದಾಯಿಸಿ (Register)' : '🌾 Register & Start')}
            </button>
          </form>
        )}

        {/* 2. SIGN IN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farmer@example.com"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  fontSize: '15px',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                  fontSize: '15px',
                  marginTop: '4px',
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
                marginTop: '4px',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={signInWithGoogle}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🌐</span> Continue with Google
            </button>
          </form>
        )}

        {/* 3. PHONE OTP FORM */}
        {mode === 'phone' && (
          phoneStep === 'send' ? (
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
                    marginTop: '4px',
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
                {loading ? 'Sending OTP...' : 'Send OTP Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '500' }}>Enter Verification Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code"
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
                    marginTop: '4px',
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
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => setPhoneStep('send')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back to Phone Number
              </button>
            </form>
          )
        )}

        {/* Offline Farmer Bypass Button */}
        <div style={{ width: '100%', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={handleGuest}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.06)',
              color: '#f1f5f9',
              fontSize: '13.5px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>⚡</span> {lang === 'kn' ? 'ಆಫ್‌ಲೈನ್ ರೈತರಾಗಿ ಮುಂದುವರಿಯಿರಿ' : 'Continue as Offline Farmer'}
          </button>
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '6px', textAlign: 'center' }}>
            No internet or sign up needed • Full advisory works 100% offline
          </span>
        </div>
      </div>
    </div>
  );
};
