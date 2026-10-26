import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Star,
  MapPin,
  CheckCircle,
  MessageSquare,
  ShoppingCart,
  ArrowRight,
  X,
  Play,
  ShieldCheck,
  Zap,
  Award,
  Users,
  Camera,
  Film,
  Video,
  Layers,
  Sparkles,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import BookingModal from './BookingModal';
import VendorModal from './VendorModal';
import ProfessionalDetailModal from './ProfessionalDetailModal';

export default function Dashboard({
  user,
  token: propToken,
  onOpenAuth,
  onNavigateToAdmin,
  onNavigateToStudio,
  onNavigateToCustomerProjects,
  onAddToCart,
  onOpenCart,
  onOpenChat,
}) {
  // Approved Vendors State
  const [vendors, setVendors] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeDiscipline, setActiveDiscipline] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [bookingItem, setBookingItem] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const token = propToken || sessionStorage.getItem('token');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Load Approved / Verified Active Vendors for Landing Page
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list?status=verified');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        // Only list active ventures (non-deleted, available, and deposit paid/waived)
        const activeOnly = data.data.filter(
          (v) => !v.is_deleted && v.availability_status !== 'unavailable' && (v.deposit_status === 'paid' || v.deposit_status === 'waived')
        );
        setVendors(activeOnly);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Load Categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategoriesList(data.data);
        if (data.data.length > 0) {
          setActiveDiscipline((prev) => prev || data.data[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchCategories();
  }, []);

  // Handle clicking outside custom dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load User Bookings Count
  useEffect(() => {
    async function loadUserBookings() {
      if (!token) return;
      try {
        const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/my', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setActiveBookingsCount(data.count);
      } catch (err) {
        console.error('Failed to load bookings:', err);
      }
    }
    loadUserBookings();
  }, [token]);

  const handleBookClick = (item) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBookingItem(item);
  };

  const handleOpenVendorModal = () => {
    if (!user) {
      onOpenAuth('register', 'vendor');
      return;
    }
    setIsVendorModalOpen(true);
  };

  const handleVendorSuccess = (profile) => {
    setIsVendorModalOpen(false);
    fetchVendors();
    alert(`Application submitted for "${profile.business_name}"! Status: Under Review.`);
  };

  const stats = [
    { label: 'Active Talent & Studios', value: vendors.length.toString(), change: 'Verified Production Partners' },
    { label: 'Marketplace Trust', value: vendors.length > 0 ? '100% VETTED' : 'READY', change: 'Identity & Portfolios Verified' },
    { label: 'Active Bookings', value: activeBookingsCount.toString(), change: user ? 'Tracked in DB' : 'Sign in to track' },
    { label: 'Account Role', value: user?.role ? user.role.toUpperCase() : 'GUEST', change: user ? 'Authenticated' : 'Sign in required' },
  ];

  // Helper to format category names (e.g., "video editor" -> "Video Editor")
  const formatCategoryName = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper to get category icons
  const getCategoryIcon = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('cinemat') || n.includes('camera') || n.includes('dp')) {
      return <Video className="w-5 h-5" />;
    }
    if (n.includes('photo')) {
      return <Camera className="w-5 h-5" />;
    }
    if (n.includes('edit') || n.includes('post') || n.includes('color')) {
      return <Film className="w-5 h-5" />;
    }
    return <Layers className="w-5 h-5" />;
  };

  // Helper to get category thumbnail image
  const getCategoryThumbnail = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('cinemat') || n.includes('camera') || n.includes('dp')) {
      return 'https://images.unsplash.com/photo-1579632652768-6cb9dcf85912?auto=format&fit=crop&w=1200&q=80';
    }
    if (n.includes('photo')) {
      return 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1200&q=80';
    }
    if (n.includes('edit') || n.includes('post') || n.includes('color')) {
      return 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80';
    }
    return 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80';
  };

  // Helper to match vendor skills with category
  const matchesCategory = (vendorSkills, catName) => {
    if (!vendorSkills || !catName) return false;
    const s = vendorSkills.toLowerCase();
    const c = catName.toLowerCase();
    return s === c || s.includes(c) || c.includes(s);
  };

  // Filter vendors based on search query
  const searchFilter = (vendorList) => {
    if (!vendorSearch.trim()) return vendorList;
    const q = vendorSearch.toLowerCase();
    return vendorList.filter((v) =>
      (v.business_name || '').toLowerCase().includes(q) ||
      (v.owner_name || '').toLowerCase().includes(q) ||
      (v.skills || '').toLowerCase().includes(q) ||
      (v.location || '').toLowerCase().includes(q)
    );
  };

  // Group vendors by Category
  const categorySections = categoriesList
    .map((cat) => {
      const catVendors = searchFilter(vendors.filter((v) => matchesCategory(v.skills, cat.name)));
      return {
        ...cat,
        vendors: catVendors,
      };
    })
    .filter((sec) => sec.vendors.length > 0 || !vendorSearch);

  // Uncategorized or general vendors if any
  const uncategorizedVendors = searchFilter(
    vendors.filter((v) => !categoriesList.some((c) => matchesCategory(v.skills, c.name)))
  );

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* ================= 1. HERO SECTION (REFERENCE: VERIDIAN HERO LAYOUT) ================= */}
      <section className="relative w-full min-h-[92vh] flex flex-col justify-between overflow-hidden bg-slate-950">
        {/* Background Image with Dark Contrast Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=2600&q=85')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/50" />

       

        {/* Hero Content Left Aligned */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-16 max-w-4xl">
         

          {/* Heading - Clean & Standard Typography with Poppins */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-heading text-white tracking-tight leading-[1.08] mb-6">
            Hire Top Creators. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              Produce Seamlessly.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed mb-8 max-w-xl">
            Directly book verified cinematographers, video editors, high-end rental gear, and production specialists with escrow guarantees.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {isAdmin ? (
              <button
                onClick={onNavigateToAdmin}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer flex items-center gap-2"
              >
                <span>Open Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : user?.role === 'vendor' ? (
              <button
                onClick={onNavigateToStudio}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer flex items-center gap-2"
              >
                <span>Go to Studio Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    const elem = document.getElementById('featured-categories');
                    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer flex items-center gap-2 group"
                >
                  <span>Explore Talent & Studios</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => onOpenAuth('register', 'vendor')}
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-full border border-white/20 backdrop-blur-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Join as Vendor</span>
                </button>
              </>
            )}
          </div>
        </div>

      </section>

      {/* ================= 2. PARTNER / SPECIALTY BRAND TICKER BAR (REFERENCE TICKER) ================= */}
      <section className="w-full bg-white border-b border-slate-200 py-6 px-6 sm:px-12 lg:px-16 overflow-x-auto">
        <div className="flex items-center justify-between gap-8 min-w-max text-xs font-semibold text-slate-500 uppercase tracking-widest">
          <span className="text-slate-400">Production Standards:</span>
          <span className="flex items-center gap-2 hover:text-blue-600 transition-colors">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Identity Vetted
          </span>
          <span className="flex items-center gap-2 hover:text-blue-600 transition-colors">
            <Zap className="w-4 h-4 text-blue-600" /> Instant Hold Requests
          </span>
          <span className="flex items-center gap-2 hover:text-blue-600 transition-colors">
            <Award className="w-4 h-4 text-blue-600" /> Escrow Advance Guard
          </span>
          <span className="flex items-center gap-2 hover:text-blue-600 transition-colors">
            <Users className="w-4 h-4 text-blue-600" /> Direct Studio Chat
          </span>
        </div>
      </section>

      {/* ================= 2.5 PLATFORM METRICS COMMAND STRIP (JUST ABOVE PRODUCTION DISCIPLINES) ================= */}
      <section className="w-full px-6 sm:px-12 lg:px-16 py-10 bg-slate-950 text-white border-y border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-md">
           
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Verified Production at Scale
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              Empowering directors, agencies, and producers with reliable verified talent and rental equipment across India.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 lg:gap-8 flex-1 max-w-3xl">
            {stats.map((s, idx) => (
              <div key={idx} className="border-l-2 border-blue-500/30 pl-4 py-1">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-300 font-semibold mt-1">{s.label}</p>
                <span className="text-[10px] text-slate-500 block mt-0.5">{s.change}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 3. FEATURED DISCIPLINES OVERVIEW (REFERENCE IMAGE 2 LAYOUT) ================= */}
      <section id="featured-categories" className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-9 bg-white border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-100">
          <div>
            
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 tracking-tight">
              Curated Talent Departments
            </h2>
          
          </div>

          {/* Minimal Standard Custom Dropdown */}
          <div ref={dropdownRef} className="relative self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-800 cursor-pointer font-heading"
            >
              <span className="text-slate-400 font-normal">Department:</span>
              <span className="font-bold text-slate-900">{formatCategoryName(activeDiscipline || categoriesList[0]?.name)}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                {categoriesList.map((cat) => {
                  const isSelected = (activeDiscipline || categoriesList[0]?.name) === cat.name;
                  const count = vendors.filter((v) => matchesCategory(v.skills, cat.name)).length;

                  return (
                    <button
                      key={cat.id || cat.name}
                      type="button"
                      onClick={() => {
                        setActiveDiscipline(cat.name);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{formatCategoryName(cat.name)}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                        {count} {count === 1 ? 'Studio' : 'Studios'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reference Image Split Layout (Left: Numbered Category List, Right: Full-width Preview Thumbnail + Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Minimal Numbered List (Image 2 Left Side: 01, 02, 03... with Arrow Buttons) */}
          <div className="lg:col-span-6 flex flex-col justify-center divide-y divide-slate-100">
            {categoriesList.map((cat, idx) => {
              const isCurrent = (activeDiscipline || categoriesList[0]?.name) === cat.name;
              const count = vendors.filter((v) => matchesCategory(v.skills, cat.name)).length;
              const num = String(idx + 1).padStart(2, '0');

              return (
                <div
                  key={cat.id || idx}
                  onClick={() => setActiveDiscipline(cat.name)}
                  className={`group py-4 px-4 sm:px-6 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 rounded-2xl ${
                    isCurrent
                      ? 'bg-slate-100 shadow-2xs'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-5 sm:gap-8 min-w-0">
                    <span className={`text-sm sm:text-base font-mono font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                      {num}
                    </span>
                    <div>
                      <h3 className={`text-base sm:text-lg font-bold font-heading truncate transition-colors ${
                        isCurrent ? 'text-slate-900' : 'text-slate-700 group-hover:text-blue-600'
                      }`}>
                        {formatCategoryName(cat.name)}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Benchmark: ₹{Number(cat.recommended_daily_rate || 15000).toLocaleString()}/day
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs hidden sm:inline font-medium ${isCurrent ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                      {count} {count === 1 ? 'Studio' : 'Studios'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDiscipline(cat.name);
                        const el = document.getElementById(`section-${cat.name.replace(/\s+/g, '-').toLowerCase()}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-xs scale-105'
                          : 'bg-slate-900 text-white group-hover:bg-blue-600'
                      }`}
                      title={`Jump to ${formatCategoryName(cat.name)}`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Full-width Preview Thumbnail (No outer border card) */}
          <div className="lg:col-span-6 w-full flex flex-col justify-between">
            {/* Full-width Category Photo Thumbnail */}
            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden shadow-sm group">
              <img
                src={getCategoryThumbnail(activeDiscipline || categoriesList[0]?.name)}
                alt={activeDiscipline || 'Category'}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-black/10" />

              {/* Status Pill on Thumbnail */}
              <div className="absolute top-4 right-4">
                {vendors.filter((v) => matchesCategory(v.skills, activeDiscipline || categoriesList[0]?.name)).length > 0 ? (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {vendors.filter((v) => matchesCategory(v.skills, activeDiscipline || categoriesList[0]?.name)).length} Active Studios
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-700 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full shadow-xs">
                    Accepting Studios
                  </span>
                )}
              </div>

              {/* Title & Benchmark Overlay on Thumbnail */}
              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider block">
                    Specialized Department
                  </span>
                  <h4 className="text-xl sm:text-2xl font-bold font-heading text-white">
                    {formatCategoryName(activeDiscipline || categoriesList[0]?.name)}
                  </h4>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-300 block">
                    Benchmark Rate
                  </span>
                  <span className="text-lg font-bold font-mono text-white">
                    ₹{Number(
                      categoriesList.find((c) => c.name === (activeDiscipline || categoriesList[0]?.name))?.recommended_daily_rate || 15000
                    ).toLocaleString()}/day
                  </span>
                </div>
              </div>
            </div>

            {/* Content & Action Under Thumbnail (Clean, Borderless, Professional) */}
            <div className="mt-4 flex-1 flex flex-col justify-between">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                {categoriesList.find((c) => c.name === (activeDiscipline || categoriesList[0]?.name))?.description ||
                  'Our vetted creative professionals transform concepts into high-end commercial captures with industry-standard cameras, lenses, and lighting.'}
              </p>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-mono">
                  Bracket:{' '}
                  <span className="font-semibold text-slate-800">
                    ₹{Number(
                      categoriesList.find((c) => c.name === (activeDiscipline || categoriesList[0]?.name))?.min_daily_rate || 5000
                    ).toLocaleString()}{' '}
                    – ₹{Number(
                      categoriesList.find((c) => c.name === (activeDiscipline || categoriesList[0]?.name))?.max_daily_rate || 50000
                    ).toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const targetName = activeDiscipline || categoriesList[0]?.name || '';
                    const el = document.getElementById(`section-${targetName.replace(/\s+/g, '-').toLowerCase()}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto"
                >
                  <span>Explore {formatCategoryName(activeDiscipline || categoriesList[0]?.name)} Partners</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. DEDICATED CATEGORY SECTIONS (FOR APPROVED VENDORS) ================= */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-5 pb-12 bg-white">
        {/* Minimal Directory Header */}
        

        {loadingVendors ? (
          <div className="py-20 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
            Loading verified talent and studios...
          </div>
        ) : categorySections.length === 0 && uncategorizedVendors.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3">
            <h3 className="text-base font-bold text-slate-900">No Approved Vendors Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No approved vendors match your query. Try clearing your search term.
            </p>
            {vendorSearch && (
              <button
                type="button"
                onClick={() => setVendorSearch('')}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-all cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          /* Render dedicated sections for each category with minimal, low-height headings */
          <div className="space-y-8 sm:space-y-10">
            {categorySections.map((catSection) => {
              const secId = `section-${catSection.name.replace(/\s+/g, '-').toLowerCase()}`;

              return (
                <div key={catSection.id || catSection.name} id={secId} className="scroll-mt-24 pb-6 sm:pb-8">
                  {/* Minimal Category Section Header (No icons, no description, no price, minimal height) */}
                  <div className="flex items-center justify-between pb-3 mb-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 tracking-tight">
                        {formatCategoryName(catSection.name)}
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {catSection.vendors.length} {catSection.vendors.length === 1 ? 'Partner' : 'Partners'}
                      </span>
                    </div>
                  </div>

                  {catSection.vendors.length === 0 ? (
                    <div className="bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl p-8 sm:p-10 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                      <p className="text-slate-500 font-medium">No approved partners listed under {formatCategoryName(catSection.name)} yet.</p>
                      <button
                        type="button"
                        onClick={() => onOpenAuth('register', 'vendor')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Register as a verified {formatCategoryName(catSection.name)} &rarr;
                      </button>
                    </div>
                  ) : (
                    /* 4 Cards Per Row Grid (Inverted: bg-slate-50 cards on bg-white section) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {catSection.vendors.map((vendor) => {
                        const initials = (vendor.business_name || 'Studio')
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <div
                            key={vendor.id}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-blue-400 transition-all duration-200 flex flex-col justify-between group"
                          >
                            <div>
                              {/* Header: Avatar + Studio + Rating */}
                              <div className="flex items-start justify-between gap-2.5 mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0 overflow-hidden">
                                    {vendor.profile_image ? (
                                      <img src={vendor.profile_image} alt={vendor.business_name} className="w-full h-full object-cover" />
                                    ) : (
                                      initials
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="text-sm font-bold font-heading text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                        {vendor.business_name}
                                      </h4>
                                      {vendor.verification_status === 'verified' && (
                                        <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-normal truncate">
                                      Lead: {vendor.owner_name || 'Creative Lead'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  <span>{vendor.avg_rating || '5.0'}</span>
                                  <span className="text-[10px] text-amber-700 font-normal">({vendor.review_count || 0})</span>
                                </div>
                              </div>

                              {/* Badges: Level & Location */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                                {vendor.experience_level && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                                    {vendor.experience_level === 'senior' ? 'Master' : vendor.experience_level === 'mid' ? 'Pro' : 'Rising'}
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400 flex items-center gap-0.5 ml-auto">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[90px]">{vendor.location || 'India'}</span>
                                </span>
                              </div>

                              {/* Bio */}
                              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-4 font-normal">
                                {vendor.bio || 'Verified creative vendor profile providing production services and gear.'}
                              </p>
                            </div>

                            {/* Bottom: Pricing & Quick Actions */}
                            <div className="pt-3 border-t border-slate-200 mt-auto">
                              <div className="flex items-center justify-between mb-3 gap-2">
                                <div>
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Standard Rate</span>
                                  <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                                    ₹{Number(vendor.pricing || 15000).toLocaleString()}
                                    <span className="text-[11px] font-normal text-slate-500">/{vendor.pricing_unit || 'day'}</span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() =>
                                      setSelectedProfessional({
                                        ...vendor,
                                        title: vendor.business_name,
                                        resource_type: 'talent',
                                        vendor_id: vendor.id,
                                        base_price: vendor.pricing || 15000,
                                        pricing_unit: vendor.pricing_unit || 'day',
                                        provider_name: vendor.owner_name,
                                      })
                                    }
                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Profile
                                  </button>

                                  <button
                                    onClick={() => onOpenChat?.({ vendorId: vendor.id })}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                                    title="Message Studio"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>Message</span>
                                  </button>
                                </div>
                              </div>

                              <button
                                onClick={() =>
                                  onAddToCart?.({
                                    ...vendor,
                                    title: vendor.business_name,
                                    resource_type: 'talent',
                                    vendor_id: vendor.id,
                                    base_price: vendor.pricing || 15000,
                                    pricing_unit: vendor.pricing_unit || 'day',
                                    provider_name: vendor.owner_name,
                                  })
                                }
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Book Hold</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized / General Section if any */}
            {uncategorizedVendors.length > 0 && (
              <div className="pt-4 pb-8 sm:pb-10">
                <div className="flex items-center justify-between pb-3 mb-6 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 tracking-tight">
                      Additional Creative Studios
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {uncategorizedVendors.length} {uncategorizedVendors.length === 1 ? 'Partner' : 'Partners'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {uncategorizedVendors.map((vendor) => {
                    const initials = (vendor.business_name || 'Studio')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={vendor.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-blue-400 transition-all duration-200 flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2.5 mb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                    {vendor.business_name}
                                  </h4>
                                  {vendor.verification_status === 'verified' && (
                                    <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-normal truncate">
                                  Lead: {vendor.owner_name || 'Creative Lead'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                              <span>{vendor.avg_rating || '5.0'}</span>
                              <span className="text-[10px] text-amber-700 font-normal">({vendor.review_count || 0})</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-4 font-normal">
                            {vendor.bio || 'Verified creative vendor profile providing production services and gear.'}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-200 mt-auto">
                          <div className="flex items-center justify-between mb-3 gap-2">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Standard Rate</span>
                              <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                                ₹{Number(vendor.pricing || 15000).toLocaleString()}
                                <span className="text-[11px] font-normal text-slate-500">/{vendor.pricing_unit || 'day'}</span>
                              </span>
                            </div>

                            <button
                              onClick={() =>
                                setSelectedProfessional({
                                  ...vendor,
                                  title: vendor.business_name,
                                  resource_type: 'talent',
                                  vendor_id: vendor.id,
                                  base_price: vendor.pricing || 15000,
                                  pricing_unit: vendor.pricing_unit || 'day',
                                  provider_name: vendor.owner_name,
                                })
                              }
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            >
                              Profile
                            </button>
                          </div>

                          <button
                            onClick={() =>
                              onAddToCart?.({
                                ...vendor,
                                title: vendor.business_name,
                                resource_type: 'talent',
                                vendor_id: vendor.id,
                                base_price: vendor.pricing || 15000,
                                pricing_unit: vendor.pricing_unit || 'day',
                                provider_name: vendor.owner_name,
                              })
                            }
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Book Hold</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================= 5. PLATFORM FOOTER ================= */}
      <footer className="w-full bg-white border-t border-slate-200 px-6 sm:px-12 lg:px-16 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              C
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">CREATIVE HUB</p>
              <p className="text-xs text-slate-400">Talent & Gear Managed Hub across India</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-blue-600" /> Identity Vetted</span>
            <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-blue-600" /> Escrow Advance Guard</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-blue-600" /> Direct Studio Chat</span>
          </div>

          <div>
            {user?.role === 'vendor' ? (
              <button
                onClick={onNavigateToStudio}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Go to Studio Dashboard
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('register', 'vendor')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Join as Verified Vendor
              </button>
            )}
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Creative Hub. All rights reserved.</p>
          <p>Curated talent, transparent benchmark pricing, and guaranteed equipment holds.</p>
        </div>
      </footer>

      {/* Professional Profile Detail Modal */}
      <ProfessionalDetailModal
        professional={selectedProfessional}
        isOpen={Boolean(selectedProfessional)}
        onClose={() => setSelectedProfessional(null)}
        onOpenChat={onOpenChat}
        onRequestBooking={(prof) => {
          setSelectedProfessional(null);
          onAddToCart?.(prof);
        }}
      />

      {/* Project Requirement Booking Form Modal */}
      <BookingModal
        item={bookingItem}
        isOpen={Boolean(bookingItem)}
        onClose={() => setBookingItem(null)}
        onOpenAuth={onOpenAuth}
        onSuccess={(newBooking) => {
          setBookingItem(null);
          if (onNavigateToCustomerProjects) {
            onNavigateToCustomerProjects();
          } else {
            alert('Project requirement submitted successfully for admin review!');
          }
        }}
        token={token}
      />

      {/* Vendor Onboarding Modal */}
      <VendorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSuccess={handleVendorSuccess}
        token={token}
      />
    </div>
  );
}
