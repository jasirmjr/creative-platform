import React, { useState } from 'react';
import { X, Smartphone, KeyRound, User, Mail, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [step, setStep] = useState('mobile'); // 'mobile' | 'otp'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('customer');
  const [devOtpHint, setDevOtpHint] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }

      setSuccessMsg('OTP sent successfully!');
      if (data.otp) {
        setDevOtpHint(data.otp);
        setOtp(data.otp); // Pre-fill in dev mode for testing convenience
      }
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Error connecting to backend API.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError('Please enter the 4-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          otp,
          role,
          name: name || undefined,
          email: email || undefined
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'OTP verification failed.');
      }

      // Save token and pass user
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <ShieldCheck size={24} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: '22px', fontWeight: 700 }}>
            {step === 'mobile' ? 'Sign In / Register' : 'Verify One-Time Password'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {step === 'mobile' 
              ? 'Enter your mobile number to get a login OTP code' 
              : `Enter the 4-digit code sent to +91 ${mobile}`}
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {devOtpHint && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '12px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            ⚡ Dev Mode Auto-Generated OTP: <strong>{devOtpHint}</strong>
          </div>
        )}

        {/* Step 1: Mobile Input Form */}
        {step === 'mobile' ? (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Mobile Number
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px'
              }}>
                <Smartphone size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', marginRight: '6px' }}>+91</span>
                <input
                  type="tel"
                  required
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '15px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : (
                <>
                  <span>Send Login Code</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: OTP Verification Form */
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Enter 4-Digit OTP
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px'
              }}>
                <KeyRound size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
                <input
                  type="text"
                  maxLength={4}
                  required
                  placeholder="1234"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '18px',
                    letterSpacing: '4px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Full Name (Optional for first-time)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px'
              }}>
                <User size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                I am joining as:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${role === 'customer' ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: role === 'customer' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    color: role === 'customer' ? '#818cf8' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Client / Producer
                </button>
                <button
                  type="button"
                  onClick={() => setRole('vendor')}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${role === 'vendor' ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                    background: role === 'vendor' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    color: role === 'vendor' ? '#22d3ee' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Creator / Vendor
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '6px' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm & Log In'}
            </button>

            <button
              type="button"
              onClick={() => setStep('mobile')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              ← Change mobile number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
