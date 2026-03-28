import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { APP_BRAND_POS_LINE } from '../constants/branding';
import { colors, fonts } from '../styles/tokens';

const BLUE          = colors.brand;
const BLUE_GLOW     = 'rgba(53, 130, 226, 0.18)';
const BLUE_GLOW_OUT = 'rgba(53, 130, 226, 0.07)';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { login, setLoading } = useAuthStore();
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused]           = useState<string | null>(null);
  const [appVersion, setAppVersion]     = useState('4.0.0');

  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(setAppVersion).catch(console.error);
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setLoading(true);
    try {
      const response = await authService.login({ username, password });
      if (response.success) {
        login(response.data.user, response.data.token);
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      let msg = 'Login failed. Please check your credentials.';
      if (err.isTimeout || err.message?.includes('timeout'))  msg = 'Connection timed out. Please try again.';
      else if (err.response?.data?.error?.message)            msg = err.response.data.error.message;
      else if (err.message)                                   msg = err.message;
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '13px 14px 13px 44px',
    fontSize: '14px',
    fontWeight: 450,
    color: '#0f172a',
    background: focused === field ? '#ffffff' : '#f0f5ff',
    border: '1.5px solid transparent',
    borderRadius: '10px',
    outline: 'none',
    transition: 'background 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box' as const,
    boxShadow: error
      ? '0 0 0 3px rgba(239,68,68,0.15)'
      : focused === field
        ? `0 0 0 3px ${BLUE_GLOW}, 0 0 18px ${BLUE_GLOW_OUT}`
        : 'none',
    ...(error ? { background: '#fff5f5' } : {}),
  });

  return (
    <>
      {/* Root — full viewport, side-by-side */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: fonts.sans,
      }}>

        {/* ── LEFT — POS image panel ── */}
        <div style={{
          display: 'none',          /* hidden on small screens via media query override */
          position: 'relative',
          overflow: 'hidden',
          height: '100vh',
          aspectRatio: '9 / 16',
          flexShrink: 0,
          background: '#0a1432',
        }} className="login-left-panel">

          {/* Full-cover POS photo */}
          <img
            src="pos-promo.jpg"
            alt="Chapter One POS"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
            onError={e => {
              /* If image is missing, show a blue gradient fallback */
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) parent.style.background = 'linear-gradient(145deg, #1a3a6b 0%, #1e50a2 50%, #3582e2 100%)';
            }}
          />

          {/* Gradient overlays — darken edges for legibility */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(10,20,50,0.55) 0%, transparent 35%, transparent 55%, rgba(5,15,40,0.70) 100%)',
            pointerEvents: 'none',
          }} />
          {/* Subtle blue tint to tie the image to the brand */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(30, 70, 160, 0.08)',
            pointerEvents: 'none',
          }} />

          {/* Logo badge — top left */}
          <div style={{
            position: 'absolute',
            top: '28px', left: '28px',
            display: 'flex', alignItems: 'center', gap: '10px',
            zIndex: 2,
          }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img
                src="icon.png" alt="Logo"
                style={{ width: '26px', height: '26px', objectFit: 'contain' }}
                onError={e => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <span style={{
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              {APP_BRAND_POS_LINE}
            </span>
          </div>

          {/* Bottom caption — lower left */}
          <div style={{
            position: 'absolute',
            bottom: '32px', left: '32px', right: '32px',
            zIndex: 2,
          }}>
            <p style={{
              margin: '0 0 12px',
              color: 'rgba(255,255,255,0.95)',
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: '-0.02em',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              Retail, made effortless.
            </p>
            <p style={{
              margin: 0,
              color: 'rgba(255,255,255,0.55)',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.5,
            }}>
              Fast, reliable point-of-sale built for modern retail businesses.
            </p>

            {/* Version badge */}
            <div style={{
              marginTop: '20px',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px',
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '20px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontWeight: 500 }}>
                Version {appVersion} · Enterprise POS
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Login form panel ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 32px',
          background: colors.surfaceDim,
          position: 'relative',
          overflowY: 'auto',
        }}>

          {/* Very subtle radial highlight */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(53,130,226,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ width: '100%', maxWidth: '380px', position: 'relative' }}>

            {/* Mobile-only logo (hidden on large screens) */}
            <div className="login-mobile-logo" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '36px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', boxShadow: '0 4px 12px rgba(53,130,226,0.30)',
              }}>
                <img src="icon.png" alt="Logo" style={{ width: '26px', height: '26px', objectFit: 'contain' }} onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {APP_BRAND_POS_LINE}
              </span>
            </div>

            {/* Heading */}
            <div style={{ marginBottom: '28px' }}>
              <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Welcome back
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', fontWeight: 400 }}>
                Sign in to continue to your account
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px 14px', marginBottom: '20px',
                background: colors.errorLight, border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px', fontSize: '13px', color: '#dc2626', fontWeight: 500,
              }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>

              {/* Username */}
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="username" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '7px' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: focused === 'username' ? BLUE : '#9ca3af', transition: 'color 0.2s' }}>
                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    onFocus={() => setFocused('username')}
                    onBlur={() => setFocused(null)}
                    placeholder="Enter your username"
                    required
                    autoFocus
                    disabled={isLoading}
                    style={{ ...inputStyle('username'), opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'text' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="password" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '7px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: focused === 'password' ? BLUE : '#9ca3af', transition: 'color 0.2s' }}>
                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    style={{ ...inputStyle('password'), paddingRight: '44px', opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'text' }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#6b7280')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                  >
                    {showPassword ? (
                      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !username || !password}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: isLoading || !username || !password ? colors.brandDisabled : BLUE,
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  cursor: isLoading || !username || !password ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
                  boxShadow: isLoading || !username || !password
                    ? 'none'
                    : '0 1px 2px rgba(53,130,226,0.25), 0 4px 12px rgba(53,130,226,0.22)',
                }}
                onMouseEnter={e => {
                  if (!isLoading && username && password) {
                    e.currentTarget.style.background = colors.brandDark;
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(53,130,226,0.3), 0 6px 16px rgba(53,130,226,0.28)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isLoading && username && password) {
                    e.currentTarget.style.background = BLUE;
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(53,130,226,0.25), 0 4px 12px rgba(53,130,226,0.22)';
                  }
                }}
                onMouseDown={e => { if (!isLoading && username && password) e.currentTarget.style.transform = 'scale(0.99)'; }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {isLoading ? (
                  <>
                    <svg style={{ animation: 'spin 0.8s linear infinite' }} width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                      <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', fontWeight: 400 }}>
                Version {appVersion} &nbsp;·&nbsp; Secure &amp; Professional
              </p>
              <img
                src="cubiq-logo.jpg" alt="Cubiq"
                style={{ height: '18px', objectFit: 'contain', opacity: 0.4 }}
                onError={e => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        input::placeholder { color: #b0b8c8; }
        input:disabled     { opacity: 0.6; cursor: not-allowed; }

        /* Show left panel on large screens */
        @media (min-width: 1024px) {
          .login-left-panel { display: flex !important; }
        }

        /* Show mobile logo on small screens */
        @media (max-width: 1023px) {
          .login-mobile-logo { display: flex !important; }
        }
      `}</style>
    </>
  );
}
