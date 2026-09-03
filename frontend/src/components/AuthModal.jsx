import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  'Cinematographers',
  'Photographers',
  'Script Writers',
  'Models',
  'Video Editors',
  'Graphic Designers',
  'Creative Directors',
  'Social Media Creators',
  'Makeup Artists',
  'Voice Artists',
  'Music and Sound Professionals',
  'Digital Marketing Specialists',
  'Cinema Cameras',
  'Lenses & Optics',
  'Lighting & Grip',
  'Audio Gear',
];

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login', // 'login' | 'register'
  initialRole = 'customer', // 'customer' | 'vendor'
}) {
  const [authMode, setAuthMode] = useState(initialMode); // 'login' | 'register'
  const [accountType, setAccountType] = useState(initialRole); // 'customer' | 'vendor'
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' | 'password'
  const [step, setStep] = useState(1); // 1: Form, 2: OTP verification

  // Customer / Common Fields
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  // Vendor Specific Fields
  const [businessName, setBusinessName] = useState('');
  const [categoryName, setCategoryName] = useState('Cinematographers');
  const [location, setLocation] = useState('');
  const [pricing, setPricing] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode || 'login');
      setAccountType(initialRole || 'customer');
      setStep(1);
      setError('');
      setDevOtpHint('');
    }
  }, [isOpen, initialMode, initialRole]);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep(1);
    setMobile('');
    setName('');
    setEmail('');
    setPassword('');
    setBusinessName('');
    setLocation('');
    setPricing('');
    setBio('');
    setOtp('');
    setError('');
    setDevOtpHint('');
    onClose();
  };

  // Step 1: Send OTP for Login or Registration
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          mode: authMode, // 'login' or 'register'
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send verification code');

      if (data.otp) setDevOtpHint(data.otp);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        mobile,
        otp,
        role: authMode === 'register' ? accountType : 'customer',
        ...(authMode === 'register' && {
          name,
          email,
          ...(accountType === 'vendor' && {
            business_name: businessName || name,
            category_name: categoryName,
            location: location || 'India',
            pricing: pricing ? Number(pricing) : 15000,
            pricing_unit: 'day',
            bio,
          }),
        }),
      };

      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');

      onSuccess(data.user, data.token);
      resetModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Password Login (for Admin or accounts with email/password)
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/common-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sign in failed');

      onSuccess(data.user, data.token);
      resetModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-xl relative my-8">
        <button
          onClick={resetModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Tab Switcher: Sign In vs Create Account */}
        {step === 1 && (
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <span
            className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
              authMode === 'register' && accountType === 'vendor'
                ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                : 'text-blue-700 bg-blue-50 border-blue-200'
            }`}
          >
            {authMode === 'register'
              ? accountType === 'vendor'
                ? 'Creative Vendor Onboarding'
                : 'Client Registration'
              : 'Sign In Portal'}
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            {step === 2
              ? 'Verify Security Code'
              : authMode === 'register'
              ? accountType === 'vendor'
                ? 'Register Creative Studio & Vendor'
                : 'Register Client Account'
              : 'Sign In to Your Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {step === 2
              ? `Enter the 4-digit code sent to +91 ${mobile}`
              : authMode === 'register'
              ? accountType === 'vendor'
                ? 'Create your studio profile to showcase works and receive client bookings'
                : 'Create your account to book verified talent and reserve production holds'
              : 'Access your active bookings, production holds, and studio workspace'}
          </p>
        </div>

        {/* Alert / Error */}
        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Dev OTP Box */}
        {devOtpHint && (
          <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center font-medium">
            Verification Code: <strong className="font-mono text-sm tracking-wider text-amber-900">{devOtpHint}</strong>
          </div>
        )}

        {step === 1 ? (
          authMode === 'register' ? (
            /* ================= REGISTER FORM ================= */
            <form onSubmit={handleSendOtp} className="space-y-4">
              {/* Account Type Selector: Client vs Vendor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  What type of account are you registering?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountType('customer')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      accountType === 'customer'
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm block">👤</span>
                    <span className="text-xs font-bold text-slate-900 block mt-1">Client / End User</span>
                    <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                      Book talent & reserve gear
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType('vendor')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      accountType === 'vendor'
                        ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm block">🎨</span>
                    <span className="text-xs font-bold text-slate-900 block mt-1">Creative Vendor</span>
                    <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                      Showcase studio & receive bookings
                    </span>
                  </button>
                </div>
              </div>

              {/* Vendor-Specific Fields */}
              {accountType === 'vendor' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Studio / Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Neon Lens Films"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Specialty *
                      </label>
                      <select
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Location / City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bangalore, Mumbai"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Standard Daily Rate (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1000}
                        placeholder="e.g. 20000"
                        value={pricing}
                        onChange={(e) => setPricing(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bio / Studio Overview
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Brief description of your expertise, gear, and past productions..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                    />
                  </div>
                </>
              )}

              {/* Owner Info (Both Client & Vendor) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {accountType === 'vendor' ? 'Lead Artist / Owner Name *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mohammed Jasir"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jasir@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (for verification & login) *
                </label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm ${
                  accountType === 'vendor'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading
                  ? 'Sending Verification Code...'
                  : accountType === 'vendor'
                  ? 'Register Vendor & Verify (OTP)'
                  : 'Register as Client (OTP)'}
              </button>
            </form>
          ) : (
            /* ================= SIGN IN FORM ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-end gap-2 text-xs mb-2">
                <span className="text-slate-400">Sign in with:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError('');
                  }}
                  className={`font-semibold cursor-pointer ${
                    loginMethod === 'otp' ? 'text-blue-600 underline' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mobile (OTP)
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setError('');
                  }}
                  className={`font-semibold cursor-pointer ${
                    loginMethod === 'password' ? 'text-blue-600 underline' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Email & Password
                </button>
              </div>

              {loginMethod === 'otp' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Registered Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit mobile"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loading ? 'Sending Code...' : 'Send One-Time Password'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@example.com or admin@creativehub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loading ? 'Signing In...' : 'Sign In with Password'}
                  </button>
                </form>
              )}
            </div>
          )
        ) : (
          /* ================= STEP 2: VERIFY OTP ================= */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Enter 4-Digit Code</label>
              <input
                type="text"
                required
                maxLength={4}
                placeholder="• • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-center tracking-[0.5em] font-mono text-lg bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm ${
                accountType === 'vendor'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading
                ? 'Verifying...'
                : authMode === 'register'
                ? accountType === 'vendor'
                  ? 'Verify & Open Studio'
                  : 'Verify & Create Account'
                : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              &larr; Back to details
            </button>
          </form>
        )}
      </div>
    </div>
  );
}