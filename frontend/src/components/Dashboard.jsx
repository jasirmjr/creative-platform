import React, { useState, useEffect } from 'react';
import BookingModal from './BookingModal';
import VendorModal from './VendorModal';

export default function Dashboard({ user, onOpenAuth, onNavigateToAdmin, onNavigateToStudio }) {
  const [categories, setCategories] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Registered Vendors State
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  // Category drill-down state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  const [bookingItem, setBookingItem] = useState(null);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const token = localStorage.getItem('token');

  // Load Categories
  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      try {
        const query = activeFilter === 'all' ? '' : `?type=${activeFilter}`;
        const res = await fetch(`http://127.0.0.1:5000/api/v1/categories${query}`);
        const data = await res.json();
        if (data.success) setCategories(data.data);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, [activeFilter]);

  // Load Registered Vendors
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list');
      const data = await res.json();
      if (data.success) setVendors(data.data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoadingVendors(false);
    }
  };

  useEffect(() => {
    fetchVendors();
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

  const handleSelectCategory = async (cat) => {
    setSelectedCategory(cat);
    setLoadingResources(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/resources?category_id=${cat.id}`);
      const data = await res.json();
      if (data.success) setResources(data.data);
    } catch (err) {
      console.error('Failed to load category listings:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleBookClick = (item) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBookingItem(item);
  };

  const handleOpenVendorModal = () => {
    if (!user) {
      onOpenAuth();
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
    { label: 'Registered Vendors', value: vendors.length.toString(), change: 'Creators & Studios' },
    { label: 'Available Disciplines', value: categories.length.toString(), change: 'Live from Supabase' },
    { label: 'Active Bookings', value: activeBookingsCount.toString(), change: user ? 'Tracked in DB' : 'Sign in to track' },
    { label: 'Account Role', value: user?.role ? user.role.toUpperCase() : 'GUEST', change: user ? 'Authenticated' : 'Sign in required' },
  ];

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
          {user?.role === 'vendor' ? (
            <button
              onClick={onNavigateToStudio}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>🎨 Open My Studio & Gallery</span>
              <span>&rarr;</span>
            </button>
          ) : (
            <button
              onClick={handleOpenVendorModal}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              + Register as Vendor
            </button>
          )}
          {!user && (
            <button
              onClick={onOpenAuth}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Sign In / Get Started
            </button>
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

      {/* Categories / Disciplines */}
      {selectedCategory ? (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              &larr; Back to Disciplines
            </button>
            <span className="text-xs text-slate-500">
              Showing verified listings for <strong className="text-slate-800">{selectedCategory.name}</strong>
            </span>
          </div>

          {loadingResources ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading verified listings...
            </div>
          ) : resources.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No listings found in this category.</p>
              <p className="text-xs text-slate-500 mt-1">Be the first verified professional to list here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        Verified {item.resource_type === 'gear' ? 'Gear' : 'Talent'}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{item.location}</span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-xs text-blue-600 font-semibold mb-3">{item.business_name || item.provider_name}</p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-6">{item.description}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 block">Rate</span>
                      <span className="text-base font-bold text-slate-900">
                        ₹{Number(item.base_price).toLocaleString()}
                        <span className="text-xs text-slate-500 font-normal">/{item.pricing_unit}</span>
                      </span>
                    </div>

                    <button
                      onClick={() => handleBookClick(item)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Explore Marketplace Disciplines</h2>
              <p className="text-xs text-slate-500 mt-0.5">Filter by category to view verified equipment and talent.</p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 p-1 rounded-xl self-start">
              {['all', 'talent', 'gear_rental'].map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeFilter === type ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'all' ? 'All' : type === 'talent' ? 'Talent' : 'Gear Rentals'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading catalog from database...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className="group bg-white border border-slate-200 hover:border-blue-400 p-5 rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        cat.type === 'talent'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {cat.type === 'talent' ? 'Talent' : 'Gear Rental'}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                        View Listings &rarr;
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                      {cat.description || 'Verified professionals and equipment available.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registered Vendors Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Registered Creative Vendors & Studios</h2>
            <p className="text-xs text-slate-500 mt-0.5">Vetted production partners, creators, and rental providers.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">{vendors.length} Registered</span>
            {onNavigateToAdmin && (
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

        {loadingVendors ? (
          <div className="py-12 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
            Loading vendors...
          </div>
        ) : vendors.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No registered vendors yet.</p>
            <p className="text-xs text-slate-500 mt-1">Be the first to join as a creative partner.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                      vendor.verification_status === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : vendor.verification_status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {vendor.verification_status}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{vendor.location}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">{vendor.business_name}</h3>
                  <p className="text-xs text-slate-500 mb-3 font-medium">Lead: {vendor.owner_name || 'Creative Pro'}</p>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {vendor.bio || 'Verified creative vendor profile providing production services and gear.'}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Joined {new Date(vendor.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                    Profile Details &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      <BookingModal
        item={bookingItem}
        isOpen={Boolean(bookingItem)}
        onClose={() => setBookingItem(null)}
        onSuccess={() => alert('Booking reserved successfully!')}
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