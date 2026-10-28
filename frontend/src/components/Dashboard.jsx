import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Film,
  Layers,
  MessageSquare,
  Mic,
  Package,
  ShieldCheck,
  UserCheck,
  Video,
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
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [bookingItem, setBookingItem] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [shootDates, setShootDates] = useState({ start: '', end: '' });

  const token = propToken || sessionStorage.getItem('token');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Load Approved / Verified Active Vendors for Landing Page
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await fetch('/api/v1/vendors/list?status=verified');
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
      const res = await fetch('/api/v1/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategoriesList(data.data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchCategories();
  }, []);

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
    if (n.includes('sound') || n.includes('audio') || n.includes('music')) {
      return <Mic className="w-5 h-5" />;
    }
    if (n.includes('gear') || n.includes('rental') || n.includes('equipment')) {
      return <Package className="w-5 h-5" />;
    }
    return <Layers className="w-5 h-5" />;
  };

  // Helper to get category thumbnail image
  const getCategoryThumbnail = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('cinemat') || n.includes('camera') || n.includes('dp')) {
      return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80';
    }
    if (n.includes('photo')) {
      return 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1200&q=80';
    }
    if (n.includes('edit') || n.includes('post') || n.includes('color')) {
      return 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80';
    }
    return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80';
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
    const inCity = cityFilter
      ? vendorList.filter((v) => (v.location || '').trim().toLowerCase() === cityFilter.toLowerCase())
      : vendorList;
    if (!vendorSearch.trim()) return inCity;
    const q = vendorSearch.toLowerCase();
    return inCity.filter((v) =>
      (v.business_name || '').toLowerCase().includes(q) ||
      (v.owner_name || '').toLowerCase().includes(q) ||
      (v.skills || '').toLowerCase().includes(q) ||
      (v.location || '').toLowerCase().includes(q)
    );
  };

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const shootStart = shootDates.start || tomorrow;
  const shootEnd = shootDates.end && shootDates.end >= shootStart ? shootDates.end : shootStart;

  const cityOptions = [...new Set(vendors.map((v) => (v.location || '').trim()).filter(Boolean))];

  const vendorCategory = (vendor) => categoriesList.find((c) => matchesCategory(vendor.skills, c.name));

  const categoryCount = (catName) => vendors.filter((v) => matchesCategory(v.skills, catName)).length;

  // Departments ranked by how many verified studios they have
  const rankedCategories = [...categoriesList].sort((a, b) => categoryCount(b.name) - categoryCount(a.name));
  const leadCategory = rankedCategories[0];
  const sideCategories = rankedCategories.slice(1, 5);

  // Top-rated studio is the one spotlighted in the hero
  const featuredVendor = [...vendors].sort((a, b) => Number(b.avg_rating || 0) - Number(a.avg_rating || 0))[0];

  const directoryVendors = searchFilter(
    selectedCategory === 'all' ? vendors : vendors.filter((v) => matchesCategory(v.skills, selectedCategory))
  );

  const toProfessional = (vendor) => ({
    ...vendor,
    title: vendor.business_name,
    resource_type: 'talent',
    vendor_id: vendor.id,
    base_price: vendor.pricing || 15000,
    pricing_unit: vendor.pricing_unit || 'day',
    provider_name: vendor.owner_name,
    start_date: shootStart,
    end_date: shootEnd,
  });

  const formatShortDate = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const formatRateK = (amount) => {
    const n = Number(amount || 0);
    return n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`;
  };

  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const howItWorks = [
    { step: '01', title: 'Brief', left: 30, items: [['Post your requirement', 110], ['Match with verified crews', 40], ['Compare quotes', 150]] },
    { step: '02', title: 'Book', left: 400, items: [['Chat directly with the studio', 470], ['Pay advance into escrow', 440, true], ['Lock shoot dates', 530]] },
    { step: '03', title: 'Wrap', left: 770, items: [['Shoot day check-in', 860], ['Receive files in the vault', 810], ['Release payment', 880]] },
  ];

  return (
    <div id="ch-top" className="w-full min-h-screen bg-ch-bg text-ch-text font-sans text-[15px] antialiased">
      <div className="ch-grain" />

      {/* ================= 1. HERO ================= */}
      <section
        className="relative overflow-hidden pt-[150px] sm:pt-[176px]"
        style={{ background: 'radial-gradient(120% 60% at 50% 0%, #0b1a33 0%, #04070d 60%)' }}
      >
        <div className="ch-glow w-[900px] h-[500px] left-1/2 -bottom-[200px] -translate-x-1/2 bg-[#1f6fff] opacity-55" />
        <div className="ch-glow w-[500px] h-[260px] left-1/2 -bottom-[60px] -translate-x-1/2 bg-[#a9cbff] opacity-35" />

        <div className="relative max-w-[1200px] mx-auto px-5 sm:px-10 text-center">
          <div className="ch-glass ch-pill !py-2 !pl-2.5 !pr-[18px] !text-[13px] !text-ch-muted !whitespace-normal">
            <span className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_10px_#4ade80] shrink-0" />
            {vendors.length > 0
              ? `${vendors.length} verified ${vendors.length === 1 ? 'crew' : 'crews'}${cityOptions.length ? ` across ${cityOptions.slice(0, 3).join(', ')}` : ''}`
              : 'Verified crews & rental gear across India'}
          </div>

          <h1 className="ch-display text-[52px] sm:text-[84px] lg:text-[112px] mt-8">
            <span className="ch-silver">Book the crew.</span>
            <br />
            <span className="ch-dim">Roll the camera.</span>
          </h1>

          <p className="text-ch-muted text-base sm:text-lg leading-relaxed max-w-[560px] mx-auto mt-7">
            Verified cinematographers, editors and rental gear — booked in one place, with your advance held safely in escrow until wrap.
          </p>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scrollToId('ch-studios');
            }}
            className="ch-glass mt-11 mx-auto max-w-[820px] rounded-[28px] sm:rounded-full p-2 flex flex-col sm:flex-row sm:items-center text-left"
          >
            <label className="flex-[1.3] px-6 py-2 sm:border-r border-ch-line">
              <span className="block text-[11px] text-ch-faint uppercase tracking-[0.12em]">Role or gear</span>
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Cinematographer"
                className="ch-field-input mt-[3px]"
              />
            </label>
            <label className="flex-1 px-6 py-2 sm:border-r border-ch-line">
              <span className="block text-[11px] text-ch-faint uppercase tracking-[0.12em]">City</span>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="ch-field-input mt-[3px] cursor-pointer appearance-none"
              >
                <option value="" className="bg-[#08111f]">All cities</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city} className="bg-[#08111f]">{city}</option>
                ))}
              </select>
            </label>
            <div className="flex-1 px-6 py-2">
              <span className="block text-[11px] text-ch-faint uppercase tracking-[0.12em]">Shoot dates</span>
              <div className="flex items-center gap-1.5 mt-[3px] text-[15px]">
                <label className="relative cursor-pointer">
                  <span>{formatShortDate(shootStart)}</span>
                  <input
                    type="date"
                    min={tomorrow}
                    value={shootStart}
                    onChange={(e) => setShootDates((d) => ({ ...d, start: e.target.value }))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <span className="text-ch-faint">–</span>
                <label className="relative cursor-pointer">
                  <span>{formatShortDate(shootEnd)}</span>
                  <input
                    type="date"
                    min={shootStart}
                    value={shootEnd}
                    onChange={(e) => setShootDates((d) => ({ ...d, end: e.target.value }))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
            <button type="submit" className="ch-btn ch-btn-blue !h-14 !px-[30px] mt-2 sm:mt-0">
              Find crew
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Stage */}
        <div className="relative max-w-[1200px] mx-auto px-5 sm:px-10 h-[420px] sm:h-[560px] mt-[72px]">
          <div
            className="ch-display hidden sm:block absolute -left-10 -right-10 bottom-[120px] text-center text-[150px] lg:text-[228px] font-semibold tracking-[-0.06em] whitespace-nowrap select-none"
            style={{
              color: 'transparent',
              background: 'linear-gradient(180deg, rgba(59,139,255,0.35), rgba(59,139,255,0.02))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            PRODUCTION
          </div>

          <div className="ch-duo absolute left-1/2 -translate-x-1/2 bottom-0 w-[300px] sm:w-[440px] h-[400px] sm:h-[540px] rounded-t-[32px]">
            <img src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=900&q=80" alt="Cinematographer on set" />
          </div>

          {featuredVendor && (
            <button
              type="button"
              onClick={() => setSelectedProfessional(toProfessional(featuredVendor))}
              className="ch-glass hidden lg:block absolute left-10 top-[90px] w-[280px] rounded-3xl p-[18px] text-left cursor-pointer hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="ch-duo w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-ch-ice text-sm font-medium">
                  {featuredVendor.profile_image ? (
                    <img src={featuredVendor.profile_image} alt="" />
                  ) : (
                    (featuredVendor.owner_name || featuredVendor.business_name || 'C').charAt(0)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">{featuredVendor.owner_name || featuredVendor.business_name}</div>
                  <div className="text-xs text-ch-muted truncate">
                    {formatCategoryName(vendorCategory(featuredVendor)?.name || featuredVendor.skills || 'Creative')} · {featuredVendor.location || 'India'}
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-4 pt-3.5 border-t border-ch-line text-[13px]">
                <span className="text-ch-muted">
                  ★ <span className="text-ch-text">{featuredVendor.avg_rating || '5.0'}</span> · {featuredVendor.review_count || 0} reviews
                </span>
                <span>
                  ₹{Number(featuredVendor.pricing || 15000).toLocaleString('en-IN')}
                  <span className="text-ch-faint">/{featuredVendor.pricing_unit || 'day'}</span>
                </span>
              </div>
            </button>
          )}

          <div className="ch-glass ch-pill hidden lg:inline-flex absolute left-[110px] bottom-[120px] !text-base !py-3.5 !pl-4 !pr-[26px]">
            <span className="ch-dot" /> Booking confirmed
          </div>

          <div className="ch-glass hidden lg:block absolute right-10 top-[60px] w-[220px] rounded-3xl p-[22px] text-center">
            <div className="text-base font-medium">Escrow</div>
            <div className="text-xs text-ch-muted leading-normal mt-1.5">Advance held safely until the shoot wraps.</div>
            <div className="ch-ring mx-auto mt-[18px]">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="36" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
                <circle cx="44" cy="44" r="36" stroke="#8fc0ff" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="226" strokeDashoffset="56" />
              </svg>
              <span className="ch-display text-xl">₹45k</span>
            </div>
          </div>

          <div className="ch-glass ch-pill hidden lg:inline-flex absolute right-[90px] bottom-[150px]">
            <span className="ch-dot" /> ARRI Alexa Mini LF · Available
          </div>
        </div>
      </section>

      {/* ================= 2. GEAR STRIP ================= */}
      <section className="border-y border-ch-line bg-ch-bg overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-10 flex items-center justify-between gap-8 h-24 overflow-x-auto no-scrollbar">
          <span className="ch-eyebrow whitespace-nowrap">Gear on the platform</span>
          <div className="flex gap-10 lg:gap-14 ch-display !font-medium !tracking-[-0.02em] text-[22px] text-[#4a5668] whitespace-nowrap">
            <span>ARRI</span><span>RED</span><span>Sony Cinema</span><span>Blackmagic</span><span>DJI</span><span>Aputure</span>
          </div>
        </div>
      </section>

      {/* ================= 3. HOW IT WORKS ================= */}
      <section id="ch-how" className="relative overflow-hidden pt-[140px] pb-[150px]" style={{ background: 'linear-gradient(180deg, #04070d 0%, #071222 100%)' }}>
        <div className="ch-glow w-[1100px] h-[300px] left-1/2 -bottom-[180px] -translate-x-1/2 bg-[#2a7bff] opacity-50" />
        <div className="relative max-w-[1200px] mx-auto px-5 sm:px-10">
          <div className="text-center max-w-[720px] mx-auto">
            <div className="ch-eyebrow">How a booking works</div>
            <h2 className="ch-display ch-silver text-5xl sm:text-[64px] mt-[18px]">From brief to wrap.</h2>
            <p className="text-ch-muted text-base leading-relaxed mt-5">
              One flow for every shoot — whether you need a single colorist for a day or a full camera department for a week.
            </p>
          </div>

          {/* Desktop: overlapping roadmap circles */}
          <div className="hidden lg:block relative h-[420px] mt-20">
            {howItWorks.map((col) => (
              <React.Fragment key={col.step}>
                <div className="absolute top-0 w-[400px] h-[400px] rounded-full border border-dashed border-white/15" style={{ left: col.left }} />
                <div className="absolute top-12 w-[400px] text-center" style={{ left: col.left }}>
                  <div className="ch-eyebrow !text-ch-faint">Step {col.step}</div>
                  <div className="ch-display text-[28px] mt-1.5">{col.title}</div>
                </div>
                {col.items.map(([label, left, accent], i) => (
                  <div
                    key={label}
                    className={`ch-glass ch-pill absolute ${accent ? '!border-[rgba(143,192,255,0.35)]' : ''}`}
                    style={{ left, top: 160 + i * 66 }}
                  >
                    <span className="ch-dot" style={accent ? { background: '#8fc0ff' } : undefined} />
                    {label}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Mobile / tablet: stacked steps */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14">
            {howItWorks.map((col) => (
              <div key={col.step} className="rounded-[28px] border border-dashed border-white/15 p-6">
                <div className="ch-eyebrow !text-ch-faint">Step {col.step}</div>
                <div className="ch-display text-[28px] mt-1.5 mb-4">{col.title}</div>
                <div className="flex flex-col items-start gap-2.5">
                  {col.items.map(([label]) => (
                    <div key={label} className="ch-glass ch-pill !text-[13px] !whitespace-normal">
                      <span className="ch-dot" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 4. DEPARTMENTS ================= */}
      <section id="featured-categories" className="bg-ch-bg pt-[140px] pb-[140px]">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div>
              <div className="ch-eyebrow">Departments</div>
              <h2 className="ch-display text-5xl sm:text-[64px] mt-[18px]">
                <span className="ch-silver">Every department.</span>
                <br />
                <span className="ch-dim">One call sheet.</span>
              </h2>
            </div>
            <p className="text-ch-muted max-w-[320px] leading-relaxed">
              Benchmark day rates are shown up front, so you know the budget before you message anyone.
            </p>
          </div>

          {leadCategory ? (
            <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr_1fr] md:grid-rows-[280px_280px] gap-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(leadCategory.name);
                  scrollToId('ch-studios');
                }}
                className="ch-duo group h-[420px] md:h-auto md:row-span-2 rounded-[28px] border border-ch-line text-left cursor-pointer"
              >
                <img src={getCategoryThumbnail(leadCategory.name)} alt={leadCategory.name} className="group-hover:scale-105" />
                <div className="absolute left-7 right-7 bottom-7 z-10">
                  <span className="ch-glass ch-pill !py-1.5 !px-3.5 !text-xs !text-ch-ice">Most booked</span>
                  <div className="ch-display text-[40px] mt-4">{formatCategoryName(leadCategory.name)}</div>
                  <div className="flex justify-between mt-3 text-sm text-ch-muted">
                    <span>
                      {categoryCount(leadCategory.name)} verified {categoryCount(leadCategory.name) === 1 ? 'studio' : 'studios'}
                    </span>
                    <span className="text-ch-text">from {formatRateK(leadCategory.min_daily_rate || 5000)}/day</span>
                  </div>
                </div>
              </button>

              {sideCategories.map((cat) => (
                <button
                  key={cat.id || cat.name}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    scrollToId('ch-studios');
                  }}
                  className="ch-glass h-[220px] md:h-auto rounded-[28px] p-7 flex flex-col justify-between text-left cursor-pointer hover:border-white/20 transition-colors"
                >
                  <span className="ch-icon-chip">{getCategoryIcon(cat.name)}</span>
                  <div className="w-full">
                    <div className="text-xl font-medium">{formatCategoryName(cat.name)}</div>
                    <div className="flex justify-between mt-2 text-[13px] text-ch-muted">
                      <span>
                        {categoryCount(cat.name)} {categoryCount(cat.name) === 1 ? 'studio' : 'studios'}
                      </span>
                      <span className="text-ch-text">from {formatRateK(cat.min_daily_rate || 5000)}/day</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="ch-glass rounded-[28px] p-12 text-center text-sm text-ch-muted">
              {loadingCategories ? 'Loading departments...' : 'Departments will appear here once they are set up.'}
            </div>
          )}
        </div>
      </section>

      {/* ================= 5. STUDIOS ================= */}
      <section id="ch-studios" className="bg-ch-bg pt-5 pb-20 scroll-mt-28">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-9">
            <h3 className="ch-display ch-silver text-[40px] whitespace-nowrap shrink-0">
              {selectedCategory === 'all' ? 'Booking fast this week' : formatCategoryName(selectedCategory)}
            </h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar min-w-0">
              {[{ name: 'all' }, ...rankedCategories].map((cat) => {
                const isActive = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`ch-pill !py-2.5 !px-[18px] cursor-pointer transition-colors ${
                      isActive ? 'ch-glass !text-ch-text' : '!text-ch-muted border border-ch-line hover:!text-ch-text'
                    }`}
                  >
                    {cat.name === 'all' ? 'All' : formatCategoryName(cat.name)}
                  </button>
                );
              })}
            </div>
          </div>

          {loadingVendors ? (
            <div className="ch-glass rounded-[28px] py-20 text-center text-sm text-ch-muted">Loading verified talent and studios...</div>
          ) : directoryVendors.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 p-12 text-center space-y-3">
              <h4 className="text-lg font-medium">No studios match yet</h4>
              <p className="text-[13px] text-ch-muted max-w-sm mx-auto">
                {vendorSearch || cityFilter
                  ? 'Try another role or city, or clear the search.'
                  : `No approved partners are listed under ${formatCategoryName(selectedCategory)} yet.`}
              </p>
              <div className="flex justify-center gap-2 pt-2">
                {(vendorSearch || cityFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setVendorSearch('');
                      setCityFilter('');
                    }}
                    className="ch-btn ch-btn-white !h-10 !text-[13px]"
                  >
                    Clear search
                  </button>
                )}
                <button type="button" onClick={() => onOpenAuth('register', 'vendor')} className="ch-btn ch-btn-ghost !h-10 !text-[13px]">
                  List your studio
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {directoryVendors.map((vendor) => {
                const cat = vendorCategory(vendor);
                return (
                  <div key={vendor.id} className="ch-glass rounded-[28px] p-2.5 group">
                    <button
                      type="button"
                      onClick={() => setSelectedProfessional(toProfessional(vendor))}
                      className="ch-duo block w-full h-[300px] rounded-[20px] cursor-pointer"
                      title="View profile"
                    >
                      {vendor.profile_image ? (
                        <img src={vendor.profile_image} alt={vendor.business_name} className="group-hover:scale-105" />
                      ) : (
                        <span
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'radial-gradient(80% 70% at 50% 100%, #2a6fe0 0%, #0b2a57 55%, #08111f 100%)' }}
                        >
                          <span className="ch-display ch-silver text-[96px] group-hover:scale-105 transition-transform duration-700">
                            {(vendor.business_name || 'S')
                              .split(' ')
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                        </span>
                      )}
                      <span className="ch-glass ch-pill absolute top-3 left-3 z-10 !py-1.5 !px-3 !text-xs">
                        ★ {vendor.avg_rating || '5.0'} · {vendor.review_count || 0}
                      </span>
                      {vendor.verification_status === 'verified' && (
                        <span className="ch-glass absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center" title="Verified">
                          <Check className="w-3.5 h-3.5 text-ch-ice" />
                        </span>
                      )}
                    </button>
                    <div className="px-3 pt-[18px] pb-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedProfessional(toProfessional(vendor))}
                        className="text-[17px] font-medium truncate block max-w-full text-left cursor-pointer hover:text-white"
                      >
                        {vendor.business_name}
                      </button>
                      <div className="text-[13px] text-ch-muted mt-1 truncate">
                        {formatCategoryName(cat?.name || vendor.skills || 'Creative')} · {vendor.location || 'India'}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-[18px]">
                        <span className="ch-display !tracking-[-0.02em] text-xl whitespace-nowrap">
                          ₹{Number(vendor.pricing || 15000).toLocaleString('en-IN')}
                          <span className="text-[13px] text-ch-faint">/{vendor.pricing_unit || 'day'}</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenChat?.({ vendorId: vendor.id })}
                            className="w-[38px] h-[38px] rounded-full border border-ch-line text-ch-muted hover:text-ch-text hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
                            title="Message studio"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddToCart?.(toProfessional(vendor))}
                            className="ch-btn ch-btn-white !h-[38px] !px-4 !text-[13px]"
                          >
                            Book hold
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ================= 6. TRUST ================= */}
      <section className="relative overflow-hidden pt-[60px]" style={{ background: 'linear-gradient(180deg, #04070d 0%, #06101f 100%)' }}>
        <div className="ch-glow w-[900px] h-[360px] left-1/2 -bottom-[220px] -translate-x-1/2 bg-[#2a7bff] opacity-55" />

        {/* Desktop composition */}
        <div className="hidden lg:block relative max-w-[1200px] mx-auto px-10 h-[720px]">
          <div className="absolute left-[90px] top-10 w-[520px] h-[520px] rounded-full border border-white/[0.06]" />
          <h2 className="ch-display absolute left-[120px] top-[150px] text-[128px] z-[1]">
            <span className="ch-silver">Every rupee</span>
          </h2>
          <h2 className="ch-display ch-dim absolute left-[420px] top-[278px] text-[128px] z-0">is protected</h2>

          <div className="ch-duo absolute left-[440px] top-[300px] w-[300px] h-[420px] rounded-t-3xl z-[2]">
            <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=700&q=80" alt="Clapperboard on set" />
          </div>

          <div className="ch-glass absolute left-[100px] top-[360px] w-[280px] rounded-[28px] p-7 z-[3]">
            <span className="ch-icon-chip"><ShieldCheck className="w-5 h-5" /></span>
            <div className="text-xl font-medium mt-6 leading-snug">Escrow advance guard</div>
            <div className="text-[13px] text-ch-muted leading-relaxed mt-2.5">Your advance is released only after the deliverables land in your vault.</div>
          </div>

          <div className="ch-glass absolute right-10 top-10 w-[280px] rounded-[28px] p-7 z-[3]">
            <span className="ch-icon-chip"><UserCheck className="w-5 h-5" /></span>
            <div className="text-xl font-medium mt-6 leading-snug">Identity vetted crews</div>
            <div className="text-[13px] text-ch-muted leading-relaxed mt-2.5">Every studio's ID, portfolio and gear is checked before it goes live.</div>
          </div>

          <div className="ch-glass absolute right-20 top-[380px] w-[240px] rounded-[28px] p-6 text-center z-[3]">
            <div className="text-base font-medium">On-time delivery</div>
            <div className="text-xs text-ch-muted leading-normal mt-1.5">Projects delivered within the agreed window.</div>
            <div className="ch-ring mx-auto mt-[18px]">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="36" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
                <circle cx="44" cy="44" r="36" stroke="#8fc0ff" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="226" strokeDashoffset="9" />
              </svg>
              <span className="ch-display text-xl">96%</span>
            </div>
          </div>
        </div>

        {/* Mobile / tablet */}
        <div className="lg:hidden relative max-w-[1200px] mx-auto px-5 sm:px-10 pb-20">
          <h2 className="ch-display text-[56px] sm:text-[80px]">
            <span className="ch-silver">Every rupee</span>
            <br />
            <span className="ch-dim">is protected</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
            <div className="ch-glass rounded-[28px] p-7">
              <span className="ch-icon-chip"><ShieldCheck className="w-5 h-5" /></span>
              <div className="text-xl font-medium mt-6">Escrow advance guard</div>
              <div className="text-[13px] text-ch-muted leading-relaxed mt-2.5">Your advance is released only after the deliverables land in your vault.</div>
            </div>
            <div className="ch-glass rounded-[28px] p-7">
              <span className="ch-icon-chip"><UserCheck className="w-5 h-5" /></span>
              <div className="text-xl font-medium mt-6">Identity vetted crews</div>
              <div className="text-[13px] text-ch-muted leading-relaxed mt-2.5">Every studio's ID, portfolio and gear is checked before it goes live.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 7. CTA + FOOTER ================= */}
      <footer className="bg-ch-navy border-t border-ch-line pt-[140px] pb-14">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-10 text-center">
          <h2 className="ch-display ch-silver text-[52px] sm:text-[80px]">
            Your next shoot
            <br />
            starts here.
          </h2>
          <div className="flex flex-wrap gap-3 justify-center mt-10">
            {isAdmin ? (
              <button onClick={onNavigateToAdmin} className="ch-btn ch-btn-white">Open Admin Console</button>
            ) : user?.role === 'vendor' ? (
              <button onClick={onNavigateToStudio} className="ch-btn ch-btn-white">Go to Studio Dashboard</button>
            ) : (
              <>
                <button onClick={() => scrollToId('ch-top')} className="ch-btn ch-btn-white">Find crew</button>
                <button onClick={() => onOpenAuth('register', 'vendor')} className="ch-btn ch-btn-ghost">List your studio</button>
              </>
            )}
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-[140px] pt-7 border-t border-ch-line text-[13px] text-ch-faint">
            <span>© {new Date().getFullYear()} Creative Hub</span>
            <div className="flex gap-8">
              <button type="button" onClick={() => scrollToId('ch-studios')} className="hover:text-ch-text cursor-pointer">Talent</button>
              <button type="button" onClick={() => scrollToId('featured-categories')} className="hover:text-ch-text cursor-pointer">Gear</button>
              <button type="button" onClick={() => onOpenAuth('register', 'vendor')} className="hover:text-ch-text cursor-pointer">For studios</button>
              <button type="button" onClick={() => onOpenChat?.()} className="hover:text-ch-text cursor-pointer">Support</button>
            </div>
            <span>Made for Indian production crews</span>
          </div>
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
