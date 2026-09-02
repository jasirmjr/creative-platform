import React, { useState, useEffect } from 'react';

export default function AuthModal({ isOpen, onClose, onSuccess, defaultMode = 'member' }) {
  const [authTab, setAuthTab] = useState(defaultMode); // 'member' | 'admin'

  // Member / Vendor OTP State
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState('customer'); // 'customer' | 'vendor'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

  // Admin Credentials State
  const [adminEmail, setAdminEmail] = useState('admin@creativehub.com');
  const [adminPassword, setAdminPassword] = useState('admin@hub2026');
  const [showPassword, setShowPassword] = useState(false);

  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAuthTab(defaultMode);
      setError('');
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  // 1. Send OTP (Customers & Registered Vendors)
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      if (data.otp) setDevOtpHint(data.otp);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp, role, name, email }),
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

  // 3. Admin Login (Email & Password)
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Admin authentication failed');

      onSuccess(data.user, data.token);
      resetModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setMobile('');
    setOtp('');
    setName('');
    setEmail('');
    setError('');
    setDevOtpHint('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-xl relative">
        <button
          onClick={resetModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Portal Switcher Tabs */}
        <div className="flex items-center gap-2 mb-6 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setAuthTab('member');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              authTab === 'member'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User / Vendor (OTP)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('admin');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              authTab === 'admin'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Console (Password)
          </button>
        </div>

        {/* Modal Header */}
        <div className="mb-5">
          <span
            className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
              authTab === 'admin'
                ? 'text-purple-700 bg-purple-50 border-purple-200'
                : 'text-blue-700 bg-blue-50 border-blue-200'
            }`}
          >
            {authTab === 'admin' ? 'Security Gateway' : 'Passwordless Access'}
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            {authTab === 'admin'
              ? 'Administrator Login'
              : step === 1
              ? 'Sign in to Creative Hub'
              : 'Verify One-Time Password'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {authTab === 'admin'
              ? 'Enter platform admin credentials to manage vendors & listings.'
              : step === 1
              ? 'Authenticate securely using your mobile number and SMS verification.'
              : `Enter the code sent to ${mobile}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium leading-relaxed">
            {error}
          </div>
        )}

        {devOtpHint && authTab === 'member' && (
          <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center font-medium">
            Development OTP: <strong className="font-mono text-sm tracking-wider text-amber-900">{devOtpHint}</strong>
          </div>
        )}

        {/* ADMIN LOGIN FORM */}
        {authTab === 'admin' ? (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@creativehub.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Admin Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-purple-600 hover:text-purple-700 cursor-pointer font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-all"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700 block mb-0.5">Admin Demo Credentials:</span>
              <span>Email: <code className="font-mono font-bold text-slate-800">admin@creativehub.com</code></span>
              <br />
              <span>Password: <code className="font-mono font-bold text-slate-800">admin@hub2026</code></span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? 'Authenticating...' : 'Sign In to Admin Console'}
            </button>
          </form>
        ) : (
          /* MEMBER / VENDOR OTP LOGIN */
          step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">I am signing in as:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('customer');
                      setError('');
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      role === 'customer'
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('vendor');
                      setError('');
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      role === 'vendor'
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Registered Vendor
                  </button>
                </div>

                {role === 'vendor' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 mt-2 leading-relaxed">
                    🔒 <strong>Vendor Policy:</strong> Only existing, registered vendors can sign in here. New creators must submit an application via <em>"+ Register as Vendor"</em> on the home dashboard.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mobile Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {loading ? 'Sending code...' : 'Continue with OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">One-Time Password</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder="4-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full text-center tracking-[0.5em] font-mono bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              {role === 'customer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {loading ? 'Verifying...' : 'Verify & Enter Workspace'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Change phone number
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}