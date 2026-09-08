import React, { useState, useEffect } from 'react';
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
  const [vendorSearch, setVendorSearch] = useState('');
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [bookingItem, setBookingItem] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

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

  // Load Categories for Filter Pills & Standards
  const fetchCategories = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategoriesList(data.data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchCategories();
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
    fetchVendors(); // Refresh vendor cards immediately
    alert(`Application submitted for "${profile.business_name}"! Status: Under Review.`);
  };

  const stats = [
    { label: 'Active Talent & Studios', value: vendors.length.toString(), change: 'Verified Production Partners' },
    { label: 'Marketplace Trust', value: vendors.length > 0 ? '100% VETTED' : 'READY', change: 'Identity & Portfolios Verified' },
    { label: 'Active Bookings', value: activeBookingsCount.toString(), change: user ? 'Tracked in DB' : 'Sign in to track' },
    { label: 'Account Role', value: user?.role ? user.role.toUpperCase() : 'GUEST', change: user ? 'Authenticated' : 'Sign in required' },
  ];

  // Calculate vendor count for a specific category
  const getCategoryVendorCount = (catName) => {
    return vendors.filter(
      (v) =>
        v.skills &&
        (v.skills.toLowerCase() === catName.toLowerCase() ||
          v.skills.toLowerCase().includes(catName.toLowerCase()) ||
          catName.toLowerCase().includes(v.skills.toLowerCase()))
    ).length;
  };

  // Catalog categories for marketplace tabs
  const displayedCategories = categoriesList;

  // Filter vendors based on category and search
  const filteredVendors = vendors.filter((v) => {
    if (selectedCategory !== 'all') {
      const match =
        v.skills &&
        (v.skills.toLowerCase() === selectedCategory.toLowerCase() ||
          v.skills.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          selectedCategory.toLowerCase().includes(v.skills.toLowerCase()));
      if (!match) return false;
    }
    if (vendorSearch.trim()) {
      const q = vendorSearch.toLowerCase();
      const match =
        (v.business_name || '').toLowerCase().includes(q) ||
        (v.owner_name || '').toLowerCase().includes(q) ||
        (v.skills || '').toLowerCase().includes(q) ||
        (v.location || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const activeCategoryObj = categoriesList.find((c) => c.name === selectedCategory);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Managed Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
            Welcome{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Discover verified creative professionals, equipment rentals, and registered service providers.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {isAdmin ? (
            <button
              onClick={onNavigateToAdmin}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>Open Admin Console</span>
              <span>&rarr;</span>
            </button>
          ) : user?.role === 'vendor' ? (
            <button
              onClick={onNavigateToStudio}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>Open My Studio Dashboard</span>
              <span>&rarr;</span>
            </button>
          ) : user?.role === 'customer' ? (
            <>
              {onNavigateToCustomerProjects && (
                <button
                  onClick={onNavigateToCustomerProjects}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>My Projects & Bookings</span>
                  <span>&rarr;</span>
                </button>
              )}
              <button
                onClick={handleOpenVendorModal}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                + Register as Vendor
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  const elem = document.getElementById('marketplace-listings');
                  if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <span>Explore Talent & Studios</span>
                <span>↓</span>
              </button>
              <button
                onClick={() => onOpenAuth('register', 'vendor')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Join as Vendor</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
            <span className="text-xs text-slate-500 mt-1 block">{stat.change}</span>
          </div>
        ))}
      </div>
      {/* Active Creative Talent & Studios */}
      <div id="marketplace-listings" className="mb-12 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Active Creative Talent & Studios</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vetted and active production partners, creators, and rental providers categorized by discipline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {filteredVendors.length} Listed ({vendors.length} Total Verified)
            </span>
            {isAdmin && onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Admin Review</span>
                <span>&rarr;</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Toolbar & Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Browse Creative Disciplines ({categoriesList.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verified creative professionals equipped with production-grade equipment
              </p>
            </div>

            {/* Keyword Search */}
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search by studio, talent, location..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {/* Horizontally Scrollable Category Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              All Specialties ({vendors.length})
            </button>

            {displayedCategories.map((cat) => {
              const isSelected = selectedCategory === cat.name;
              const count = getCategoryVendorCount(cat.name);
              return (
                <button
                  key={cat.id || cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat.name)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : count > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200/80 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Category Market Guidance Banner */}
        {selectedCategory !== 'all' && activeCategoryObj && (
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div>
              <h3 className="text-sm font-bold text-indigo-950">{activeCategoryObj.name}</h3>
              {activeCategoryObj.description && (
                <p className="text-xs text-indigo-800/80 mt-0.5">{activeCategoryObj.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2 font-mono">
                <span>
                  Floor: <strong className="text-slate-900">₹{Number(activeCategoryObj.min_daily_rate).toLocaleString()}</strong>
                </span>
                <span>•</span>
                <span>
                  Market Benchmark: <strong className="text-indigo-900 font-bold">₹{Number(activeCategoryObj.recommended_daily_rate).toLocaleString()}/day</strong>
                </span>
                <span>•</span>
                <span>
                  Cap: <strong className="text-slate-900">₹{Number(activeCategoryObj.max_daily_rate).toLocaleString()}</strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 self-start sm:self-center"
            >
              Show All Specialties
            </button>
          </div>
        )}

        {loadingVendors ? (
          <div className="py-12 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
            Loading approved vendors...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 text-xl font-bold mx-auto flex items-center justify-center">
              Catalog
            </div>
            <h3 className="text-base font-bold text-slate-900">No Approved Vendors Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {selectedCategory !== 'all' || vendorSearch
                ? 'No approved vendors match the selected specialty or search term. Try resetting your search filters.'
                : 'No approved vendors are currently listed in the marketplace.'}
            </p>
            {(selectedCategory !== 'all' || vendorSearch) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setVendorSearch('');
                }}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-xl hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        vendor.verification_status === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {vendor.verification_status === 'verified' ? 'Verified' : vendor.verification_status}
                      </span>

                      {vendor.skills && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {vendor.skills}
                        </span>
                      )}

                      {vendor.experience_level && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {vendor.experience_level === 'senior' ? 'Master' : vendor.experience_level === 'mid' ? 'Pro' : 'Rising'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                      <span className="text-amber-500 font-bold flex items-center gap-0.5">
                        ★ {vendor.avg_rating || '5.0'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ({vendor.review_count || 0})
                      </span>
                      <span>•</span>
                      <span>{vendor.location || 'India'}</span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">{vendor.business_name}</h3>
                  <p className="text-xs text-slate-500 mb-3 font-medium">Lead: {vendor.owner_name || 'Creative Pro'}</p>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {vendor.bio || 'Verified creative vendor profile providing production services and gear.'}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Standard Rate</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      ₹{Number(vendor.pricing || 15000).toLocaleString()}
                      <span className="text-xs font-normal text-slate-500">/{vendor.pricing_unit || 'day'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
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
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Profile
                    </button>

                    <button
                      onClick={() => onOpenChat?.({ vendorId: vendor.id })}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                      title="Direct chat with Studio"
                    >
                      <span>Message</span>
                    </button>

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
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🛒</span>
                      <span>Book Hold</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Professional Profile Detail Modal (Section 6) */}
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

      {/* Project Requirement Booking Form Modal (Section 11) */}
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
    </main>
  );
}