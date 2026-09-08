import React, { useState, useEffect, useRef } from 'react';
import VendorDepositModal from './VendorDepositModal';

// Categories and benchmarks are fetched dynamically from admin-configured database records

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login', // 'login' | 'register'
  initialRole = 'customer', // 'customer' | 'vendor'
  lockRole = false,
}) {
  const isRoleLocked = lockRole || initialRole === 'vendor';
  const [authMode, setAuthMode] = useState(initialMode); // 'login' | 'register' | 'admin'
  const [accountType, setAccountType] = useState(initialRole); // 'customer' | 'vendor'
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' | 'password'
  const [step, setStep] = useState(1); // 1: Form, 2: OTP verification, 3: Vendor Deposit Choice

  // Common Fields
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password Login Identifier (Email or Mobile)
  const [loginIdentifier, setLoginIdentifier] = useState('');

  // 4-Box Segmented PIN State & Refs
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // 60-Second Cooldown Resend Timer
  const [resendCooldown, setResendCooldown] = useState(0);

  // Vendor-Specific Fields (Purely dynamic from Admin-added categories)
  const [businessName, setBusinessName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [location, setLocation] = useState('');
  const [pricing, setPricing] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('mid'); // 'entry' | 'mid' | 'senior'
  const [categoriesList, setCategoriesList] = useState([]);
  const [bio, setBio] = useState('');

  // Admin Dedicated Login Fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

  // Vendor Onboarding Deposit Flow
  const [registeredSession, setRegisteredSession] = useState(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Fetch active categories configured by Admin
  useEffect(() => {
    if (isOpen) {
      fetch('http://127.0.0.1:5000/api/v1/categories')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setCategoriesList(data.data);
            if (data.data.length > 0) {
              const defaultCat = data.data[0];
              setCategoryName(defaultCat.name);
              const floor = Number(defaultCat.min_daily_rate || 2000);
              const ceil = Number(defaultCat.max_daily_rate || 50000);
              const rec = Number(defaultCat.recommended_daily_rate || 15000);
              const defaultRate = experienceLevel === 'entry'
                ? Math.round((floor + (rec - floor) * 0.35) / 500) * 500
                : experienceLevel === 'senior'
                ? Math.round((rec + (ceil - rec) * 0.45) / 500) * 500
                : rec;
              setPricing(defaultRate.toString());
            } else {
              setCategoryName('');
              setPricing('');
            }
          }
        })
        .catch((err) => console.error('Failed to load categories in AuthModal:', err));
    }
  }, [isOpen]);

  // Current category price guardrails (strictly from admin-added category)
  const currentCatObj = categoriesList.find((c) => c.name === categoryName) || null;
  const catFloor = currentCatObj ? Number(currentCatObj.min_daily_rate || 2000) : 2000;
  const catCeil = currentCatObj ? Number(currentCatObj.max_daily_rate || 50000) : 50000;
  const catRec = currentCatObj ? Number(currentCatObj.recommended_daily_rate || 15000) : 15000;

  const tierRates = {
    entry: Math.round((catFloor + (catRec - catFloor) * 0.35) / 500) * 500,
    mid: catRec,
    senior: Math.round((catRec + (catCeil - catRec) * 0.45) / 500) * 500,
  };

  const handleSelectTier = (tier) => {
    setExperienceLevel(tier);
    if (currentCatObj) {
      setPricing(tierRates[tier].toString());
    }
  };

  const handleCategoryChange = (newCat) => {
    setCategoryName(newCat);
    const catData = categoriesList.find((c) => c.name === newCat);
    if (!catData) return;
    const floor = Number(catData.min_daily_rate || 2000);
    const ceil = Number(catData.max_daily_rate || 50000);
    const rec = Number(catData.recommended_daily_rate || 15000);
    const newTierRate = experienceLevel === 'entry'
      ? Math.round((floor + (rec - floor) * 0.35) / 500) * 500
      : experienceLevel === 'senior'
      ? Math.round((rec + (ceil - rec) * 0.45) / 500) * 500
      : rec;
    setPricing(newTierRate.toString());
  };

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode || 'login');
      setAccountType(initialRole || 'customer');
      setLoginMethod('otp');
      setStep(1);
      setError('');
      setDevOtpHint('');
      setOtpDigits(['', '', '', '']);
      setResendCooldown(0);
      setRegisteredSession(null);
      setIsDepositModalOpen(false);
    }
  }, [isOpen, initialMode, initialRole]);

  // Handle 60s Resend Countdown Timer
  useEffect(() => {
    let timer;
    if (step === 2 && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep(1);
    setMobile('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setLoginIdentifier('');
    setBusinessName('');
    setLocation('');
    setPricing('');
    setBio('');
    setOtpDigits(['', '', '', '']);
    setAdminEmail('');
    setAdminPassword('');
    setError('');
    setDevOtpHint('');
    setResendCooldown(0);
    setRegisteredSession(null);
    setIsDepositModalOpen(false);
    onClose();
  };

  // Helper to format clean 10-digit mobile
  const handleMobileChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
  };

  // Step 1: Send OTP for Login or Registration
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (authMode === 'register' && password && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (authMode === 'register' && password && password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (authMode === 'register' && accountType === 'vendor') {
      const numPrice = Number(pricing);
      if (!pricing || isNaN(numPrice)) {
        setError('Please enter a valid standard daily rate.');
        return;
      }
      if (numPrice < catFloor) {
        setError(`Daily rate of ₹${numPrice.toLocaleString()} is below the platform minimum of ₹${catFloor.toLocaleString()} for ${categoryName}.`);
        return;
      }
      if (numPrice > catCeil) {
        setError(`Daily rate of ₹${numPrice.toLocaleString()} exceeds the platform affordability limit of ₹${catCeil.toLocaleString()} for ${categoryName}. Please adjust within the recommended range.`);
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          mode: authMode, // 'login' or 'register'
          email: authMode === 'register' ? email : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send verification code');

      if (data.dev_otp) setDevOtpHint(data.dev_otp);
      setResendCooldown(data.cooldown || 60);
      setOtpDigits(['', '', '', '']);
      setStep(2);
      setTimeout(() => otpRefs[0]?.current?.focus(), 150);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          mode: authMode,
          email: authMode === 'register' ? email : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend verification code');

      if (data.dev_otp) setDevOtpHint(data.dev_otp);
      setResendCooldown(data.cooldown || 60);
      setOtpDigits(['', '', '', '']);
      setTimeout(() => otpRefs[0]?.current?.focus(), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4-Box PIN Handlers
  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance to next box
    if (digit && index < 3) {
      otpRefs[index + 1]?.current?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1]?.current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 3);
    otpRefs[nextIndex]?.current?.focus();
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 4) {
      setError('Please enter the full 4-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        mobile,
        otp: fullOtp,
        password: password || undefined,
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
            experience_level: experienceLevel,
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

      if (authMode === 'register' && accountType === 'vendor') {
        setRegisteredSession({ user: data.user, token: data.token });
        setStep(3);
      } else {
        onSuccess(data.user, data.token);
        resetModal();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dual Auth: Password Login (for Customers, Vendors, and Admin)
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/common-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier,
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

  // Dedicated Admin Portal Login
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
      if (!res.ok) throw new Error(data.message || 'Admin sign in failed');

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

        {/* Tab Switcher: Sign In vs Create Account vs Admin */}
        {step === 1 && authMode !== 'admin' && (
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

        {step === 1 && authMode === 'admin' && (
          <div className="flex items-center justify-between bg-slate-900 text-white px-3.5 py-2.5 rounded-xl mb-6 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Admin Security Portal</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
            >
              ← User Sign In
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <span
            className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
              authMode === 'admin'
                ? 'text-purple-700 bg-purple-50 border-purple-200'
                : authMode === 'register' && accountType === 'vendor'
                ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                : 'text-blue-700 bg-blue-50 border-blue-200'
            }`}
          >
            {authMode === 'admin'
              ? 'System Administration'
              : authMode === 'register'
              ? accountType === 'vendor'
                ? 'Creative Vendor Onboarding'
                : 'Client Registration'
              : 'Sign In Portal'}
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            {step === 2
              ? 'Verify Security Code'
              : authMode === 'admin'
              ? 'Admin Console Login'
              : authMode === 'register'
              ? accountType === 'vendor'
                ? 'Register Creative Studio & Vendor'
                : 'Register Client Account'
              : 'Sign In to Your Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {step === 2
              ? `Enter the 4-digit verification code sent to +91 ${mobile}`
              : authMode === 'admin'
              ? 'Restricted access: Authorize with system administrator credentials'
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
              {/* Account Type Selector: Client vs Vendor (Hidden when registering directly as a Vendor) */}
              {!isRoleLocked && (
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
              )}

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
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        disabled={categoriesList.length === 0}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {categoriesList.length === 0 ? (
                          <option value="" disabled>
                            No categories added yet (Admin must add categories)
                          </option>
                        ) : (
                          categoriesList.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))
                        )}
                      </select>
                      {categoriesList.length === 0 && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          No specialties registered by Admin yet. Please configure categories in the Admin Console first.
                        </p>
                      )}
                    </div>
                  </div>

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

                  {/* Experience as Single Section & Standard Daily Rate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Experience Level *
                      </label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => handleSelectTier(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all cursor-pointer"
                      >
                        <option value="entry">1 – 2 Years</option>
                        <option value="mid">3 – 5 Years</option>
                        <option value="senior">6+ Years</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Standard Daily Rate (₹) *
                        </label>
                        {currentCatObj && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ₹{catFloor.toLocaleString()} – ₹{catCeil.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          required
                          min={catFloor}
                          max={catCeil}
                          step="any"
                          placeholder={catRec.toString()}
                          value={pricing}
                          onChange={(e) => setPricing(e.target.value)}
                          className={`w-full bg-slate-50 border rounded-xl pl-8 pr-3.5 py-2 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all ${
                            pricing && (Number(pricing) < catFloor || Number(pricing) > catCeil)
                              ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/30'
                              : 'border-slate-300 focus:border-indigo-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean inline validation notices if entered rate is outside guardrails */}
                  {pricing && Number(pricing) < catFloor && (
                    <p className="text-[11px] text-rose-600 font-medium">
                      Daily rate is below platform minimum (₹{catFloor.toLocaleString()}/day) for {categoryName}.
                    </p>
                  )}
                  {pricing && Number(pricing) > catCeil && (
                    <p className="text-[11px] text-rose-600 font-medium">
                      Daily rate exceeds affordability ceiling (₹{catCeil.toLocaleString()}/day) for {categoryName}.
                    </p>
                  )}

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

              {/* Password for Dual Auth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Create Password <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 chars (for password login)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (for verification & OTP login) *
                </label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={mobile}
                    onChange={handleMobileChange}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (accountType === 'vendor' && (!categoryName || categoriesList.length === 0))}
                className={`w-full py-3 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm ${
                  accountType === 'vendor'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading
                  ? 'Sending Verification Code...'
                  : accountType === 'vendor'
                  ? categoriesList.length === 0
                    ? 'No Categories Configured (Admin Must Add)'
                    : 'Register Vendor & Verify (OTP)'
                  : 'Register as Client (OTP)'}
              </button>
            </form>
          ) : authMode === 'admin' ? (
            /* ================= DEDICATED ADMIN FORM ================= */
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                Enter administrator credentials to manage platform listings, review vendor deposits, and moderate system users.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@creativehub.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-600 transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Security Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-purple-600 hover:text-purple-800 font-medium cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-600 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {loading ? 'Authenticating Admin...' : 'Authenticate & Enter Admin Console'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  &larr; Back to Regular Sign In
                </button>
              </div>
            </form>
          ) : (
            /* ================= SIGN IN FORM (DUAL AUTH: OTP OR PASSWORD) ================= */
            <div className="space-y-4">
              <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError('');
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginMethod === 'otp'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📱 Mobile (OTP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setError('');
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginMethod === 'password'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔑 Password
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
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={mobile}
                        onChange={handleMobileChange}
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address or Mobile Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. user@example.com or 9876543210"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
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

              <div className="pt-2 border-t border-slate-200/60 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('admin');
                    setError('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
                >
                  🛡️ System Administrator? <span className="text-blue-600 underline">Access Admin Portal</span>
                </button>
              </div>
            </div>
          )
        ) : step === 2 ? (
          /* ================= STEP 2: VERIFY OTP (4-BOX SEGMENTED INPUT + RESEND TIMER) ================= */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-center text-xs font-semibold text-slate-700 mb-3">
                Enter 4-Digit Verification PIN
              </label>
              <div className="flex justify-center gap-3">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="w-13 h-13 text-center font-mono text-2xl font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            <div className="text-center text-xs text-slate-500">
              {resendCooldown > 0 ? (
                <p>
                  Resend code in{' '}
                  <span className="font-semibold text-slate-800 font-mono">
                    {resendCooldown}s
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline disabled:opacity-50"
                >
                  Resend Verification Code
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 4}
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
                  ? 'Verify & Continue'
                  : 'Verify & Create Account'
                : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError('');
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              &larr; Back to details
            </button>
          </form>
        ) : (
          /* ================= STEP 3: VENDOR ONBOARDING DEPOSIT CHOICE ================= */
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold mb-3">
                ✓
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Studio Registration Complete!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Welcome, <span className="font-semibold text-slate-800">{registeredSession?.user?.name}</span>! One final step to list your studio on the marketplace.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Listing Deposit:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">₹2,000.00</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Marketplace Status:</span>
                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] uppercase">
                  Pending Deposit
                </span>
              </div>
              <p className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 leading-relaxed">
                Only paid studios are showcased on the landing page and eligible to receive verified client bookings. You can pay now or pay anytime from your Studio Dashboard.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(true)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>💳 Pay Onboarding Deposit Now (₹2,000)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (registeredSession) {
                    onSuccess(registeredSession.user, registeredSession.token);
                    resetModal();
                  }
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-all cursor-pointer"
              >
                Pay Later & Go to Studio Dashboard &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Vendor Deposit Modal */}
        {registeredSession && (
          <VendorDepositModal
            isOpen={isDepositModalOpen}
            onClose={() => {
              setIsDepositModalOpen(false);
            }}
            token={registeredSession.token}
            vendorProfile={registeredSession.user?.vendor_profile}
            onSuccess={(updatedProfile) => {
              setIsDepositModalOpen(false);
              const updatedUser = {
                ...registeredSession.user,
                vendor_profile: updatedProfile,
              };
              onSuccess(updatedUser, registeredSession.token);
              resetModal();
            }}
          />
        )}
      </div>
    </div>
  );
}