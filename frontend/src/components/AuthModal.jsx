import React, { useState, useEffect, useRef } from 'react';
import VendorDepositModal from './VendorDepositModal';

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
              const defaultRate =
                experienceLevel === 'entry'
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
    const newTierRate =
      experienceLevel === 'entry'
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
    setError('');
    setDevOtpHint('');
    setMobile('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setBusinessName('');
    setBio('');
    setLocation('');
    setPricing('');
    setLoginIdentifier('');
    setAdminEmail('');
    setAdminPassword('');
    setOtpDigits(['', '', '', '']);
    setStep(1);
    setRegisteredSession(null);
    setIsDepositModalOpen(false);
    onClose();
  };

  const handleMobileChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 10) setMobile(val);
  };

  const handleOtpDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    const char = clean.slice(-1);
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);
    if (char && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const next = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    const targetIdx = Math.min(pasted.length, 3);
    otpRefs[targetIdx].current?.focus();
  };

  // Step 1: Submit Form (Registration or OTP Request)
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
        setError(
          `Daily rate of ₹${numPrice.toLocaleString()} is below the platform minimum of ₹${catFloor.toLocaleString()} for ${categoryName}.`
        );
        return;
      }
      if (numPrice > catCeil) {
        setError(
          `Daily rate of ₹${numPrice.toLocaleString()} exceeds the platform affordability limit of ₹${catCeil.toLocaleString()} for ${categoryName}. Please adjust within the recommended range.`
        );
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
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      if (data.dev_otp) {
        setDevOtpHint(data.dev_otp);
      }

      setStep(2);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
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

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend code');

      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
      }
      setResendCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sign In with Password
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

  // Adaptive modal width: wider on desktop when vendor registration has 2 columns
  const isVendorRegister = authMode === 'register' && accountType === 'vendor' && step === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div
        className={`bg-white rounded-3xl w-full p-6 sm:p-8 shadow-2xl relative my-auto text-slate-900 border border-slate-100 max-h-[92vh] overflow-y-auto transition-all ${
          isVendorRegister ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        {/* Top-Right Close Button */}
        <button
          onClick={resetModal}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
          title="Close"
        >
          ✕
        </button>

        {/* Minimal Typography Header */}
        <div className="mb-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {step === 2
              ? 'Verify Code'
              : authMode === 'admin'
              ? 'Admin Login'
              : authMode === 'register'
              ? 'Create Account'
              : 'Welcome Back!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            {step === 2
              ? `Enter the 4-digit verification code sent to +91 ${mobile}`
              : authMode === 'admin'
              ? 'Log in to access your administrative dashboard'
              : authMode === 'register'
              ? accountType === 'vendor'
                ? 'Sign up to showcase your studio and receive bookings.'
                : 'Sign up to discover and book verified creative talent.'
              : 'Log in to start creating stunning productions with ease.'}
          </p>
        </div>

        {/* Alert / Error */}
        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Dev OTP Box */}
        {devOtpHint && (
          <div className="mb-4 text-xs text-blue-900 bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-center font-medium">
            Verification Code: <strong className="font-mono text-sm tracking-wider text-blue-700">{devOtpHint}</strong>
          </div>
        )}

        {step === 1 ? (
          authMode === 'register' ? (
            /* ================= REGISTER FORM (TWO FIELDS PER ROW + WHITE & BLUE THEME) ================= */
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              {/* Account Type Selector (Clean Pill: Client vs Vendor) */}
              {!isRoleLocked && (
                <div className="flex bg-slate-100 p-1 rounded-xl mb-1">
                  <button
                    type="button"
                    onClick={() => setAccountType('customer')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      accountType === 'customer'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('vendor')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      accountType === 'vendor'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vendor
                  </button>
                </div>
              )}

              {/* Vendor Specific Inputs: 2 Columns Per Row */}
              {accountType === 'vendor' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Studio / Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Primary Specialty *
                      </label>
                      <select
                        value={categoryName}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        disabled={categoriesList.length === 0}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium cursor-pointer"
                      >
                        {categoriesList.length === 0 ? (
                          <option value="" disabled>
                            No categories configured
                          </option>
                        ) : (
                          categoriesList.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        City / Location *
                      </label>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Experience *
                      </label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => handleSelectTier(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium cursor-pointer"
                      >
                        <option value="entry">1 – 2 Years</option>
                        <option value="mid">3 – 5 Years</option>
                        <option value="senior">6+ Years</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-800">
                          Daily Rate (₹) *
                        </label>
                        {currentCatObj && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ₹{catFloor.toLocaleString()}–{catCeil.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        required
                        min={catFloor}
                        max={catCeil}
                        step="any"
                        value={pricing}
                        onChange={(e) => setPricing(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Bio / Studio Overview
                    </label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                    />
                  </div>

                  {/* Owner details 2 in a row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Lead Artist / Owner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm Password in 2 Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-800">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Mobile Number *
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={mobile}
                        onChange={handleMobileChange}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Client Registration Form: Clean 2 columns layout */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-800">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Mobile Number *
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={mobile}
                        onChange={handleMobileChange}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Blue CTA Button */}
              <button
                type="submit"
                disabled={loading || (accountType === 'vendor' && (!categoryName || categoriesList.length === 0))}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-blue-500/20"
              >
                {loading
                  ? 'Please wait...'
                  : accountType === 'vendor'
                  ? 'Register as Vendor'
                  : 'Register as Client'}
              </button>

              {/* Bottom Switch Link */}
              <div className="text-center pt-2 text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }}
                  className="font-bold text-blue-600 hover:underline cursor-pointer ml-1"
                >
                  Log in here
                </button>
              </div>
            </form>
          ) : authMode === 'admin' ? (
            /* ================= ADMIN LOGIN ================= */
            <form onSubmit={handleAdminLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-blue-500/20"
              >
                {loading ? 'Authenticating...' : 'Sign In as Admin'}
              </button>

              <div className="text-center pt-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }}
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Back to User Login
                </button>
              </div>
            </form>
          ) : (
            /* ================= LOGIN FORM (WHITE AND BLUE THEME) ================= */
            <div className="space-y-4">
              {/* Method Switch: Mobile (OTP) vs Password */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginMethod === 'otp'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mobile Number (OTP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginMethod === 'password'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Password Login
                </button>
              </div>

              {loginMethod === 'otp' ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={mobile}
                        onChange={handleMobileChange}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {/* Blue Pill Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-blue-500/20"
                  >
                    {loading ? 'Sending Code...' : 'Login with OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Email or Mobile
                    </label>
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-800">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                    />
                  </div>

                  {/* Blue Pill Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-blue-500/20"
                  >
                    {loading ? 'Signing In...' : 'Login'}
                  </button>
                </form>
              )}

              {/* Bottom "Don't have an account? Sign up here" */}
              <div className="text-center pt-2 text-xs text-slate-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setError('');
                  }}
                  className="font-bold text-blue-600 hover:underline cursor-pointer ml-1"
                >
                  Sign up here
                </button>
              </div>

              {/* Subtle Admin Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('admin');
                    setError('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-blue-600 cursor-pointer"
                >
                  Administrator Portal
                </button>
              </div>
            </div>
          )
        ) : step === 2 ? (
          /* ================= STEP 2: VERIFY OTP (4-BOX SEGMENTED INPUT + RESEND TIMER) ================= */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-center text-xs font-semibold text-slate-700 mb-4">
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
                    className="w-12 h-12 text-center font-mono text-xl font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
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
                  className="font-semibold text-blue-600 hover:underline cursor-pointer disabled:opacity-50"
                >
                  Resend Verification Code
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 4}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-blue-500/20"
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
              className="w-full text-center text-xs text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Back to details
            </button>
          </form>
        ) : (
          /* ================= STEP 3: VENDOR ONBOARDING DEPOSIT CHOICE ================= */
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900">
                Registration Complete
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Welcome, <span className="font-semibold text-slate-800">{registeredSession?.user?.name}</span>. Pay the onboarding deposit to activate your studio profile.
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Listing Deposit:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">₹2,000.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Status:</span>
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] uppercase border border-blue-200">
                  Pending Deposit
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(true)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all shadow-md cursor-pointer hover:shadow-blue-500/20"
              >
                Pay Onboarding Deposit (₹2,000)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (registeredSession) {
                    onSuccess(registeredSession.user, registeredSession.token);
                    resetModal();
                  }
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition-all cursor-pointer"
              >
                Pay Later & Go to Dashboard
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
