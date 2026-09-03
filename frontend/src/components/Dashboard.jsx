import React, { useState, useEffect } from 'react';
import BookingModal from './BookingModal';
import VendorModal from './VendorModal';
import ProfessionalDetailModal from './ProfessionalDetailModal';

export default function Dashboard({
  user,
  onOpenAuth,
  onNavigateToAdmin,
  onNavigateToStudio,
  onNavigateToCustomerProjects,
  onAddToCart,
  onOpenCart,
}) {
  // Approved Vendors State
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [bookingItem, setBookingItem] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Load Approved / Verified Vendors for Landing Page
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list?status=verified');
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
    { label: 'Approved Talent & Studios', value: vendors.length.toString(), change: 'Verified Production Partners' },
    { label: 'Marketplace Trust', value: vendors.length > 0 ? '100% VETTED' : 'READY', change: 'Identity & Portfolios Verified' },
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
          {isAdmin ? (
            <button
              onClick={onNavigateToAdmin}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>🛡️ Open Admin Console</span>
              <span>&rarr;</span>
            </button>
          ) : user?.role === 'vendor' ? (
            <button
              onClick={onNavigateToStudio}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>🎨 Open My Studio Dashboard</span>
              <span>&rarr;</span>
            </button>
          ) : user?.role === 'customer' ? (
            <>
              {onNavigateToCustomerProjects && (
                <button
                  onClick={onNavigateToCustomerProjects}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>🎬 My Projects & Bookings</span>
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
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Register as Client
              </button>
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={handleOpenVendorModal}
                className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
              >
                + Register as Vendor
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
      {/* Approved Creative Talent & Studios */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Approved Creative Talent & Studios</h2>
            <p className="text-xs text-slate-500 mt-0.5">Vetted and approved production partners, creators, and rental providers.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {vendors.length} Approved & Verified
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

        {loadingVendors ? (
          <div className="py-12 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
            Loading approved vendors...
          </div>
        ) : vendors.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No approved vendors listed yet.</p>
            <p className="text-xs text-slate-500 mt-1">Vendor registrations are currently under admin review.</p>
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
                      {vendor.verification_status === 'verified' ? '✓ Verified' : vendor.verification_status}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
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
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Profile & Works
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
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
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