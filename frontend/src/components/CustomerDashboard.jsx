import React, { useState, useEffect } from 'react';
import ProfessionalDetailModal from './ProfessionalDetailModal';
import ReviewModal from './ReviewModal';

export default function CustomerDashboard({
  user,
  onOpenAuth,
  onBackToMarketplace,
  onAddToCart,
  onOpenCart,
}) {
  // Navigation & Tabs
  const [mainTab, setMainTab] = useState('vendors'); // 'vendors' | 'projects'
  const [activeFilter, setActiveFilter] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');

  // Data States
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [myReviews, setMyReviews] = useState([]);

  // Interaction States
  const [payingId, setPayingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedReviewBooking, setSelectedReviewBooking] = useState(null);

  const token = localStorage.getItem('token');

  // Load Customer's Bookings
  const fetchCustomerBookings = async () => {
    if (!token) return;
    setLoadingBookings(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data || []);
        // If customer already has active projects, default to projects tab
        if (data.data && data.data.length > 0) {
          setMainTab('projects');
        }
      }
    } catch (err) {
      console.error('Failed to load customer bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Load All Approved / Verified Vendors
  const fetchApprovedVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list?status=verified');
      const data = await res.json();
      if (data.success) {
        setVendors(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load approved vendors:', err);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Load Customer's Submitted Reviews
  const fetchMyReviews = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/reviews/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMyReviews(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  };

  useEffect(() => {
    fetchCustomerBookings();
    fetchApprovedVendors();
    fetchMyReviews();
  }, [token]);

  // Handle Razorpay Payment
  const handlePay = async (bookingId, amount) => {
    setPayingId(bookingId);
    setNotification(null);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/${bookingId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amount,
          payment_type: 'full',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment processing failed');

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: 'confirmed', payment_status: 'paid', paid_amount: amount }
            : b
        )
      );

      setNotification({
        type: 'success',
        message: `Payment of ₹${Number(amount).toLocaleString()} verified! Booking confirmed. (Ref: ${data.transaction?.payment_id})`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setPayingId(null);
    }
  };

  // Metrics Calculations
  const underReviewCount = bookings.filter(
    (b) => b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request'
  ).length;
  const paymentPendingCount = bookings.filter(
    (b) => b.status === 'approved' || b.status === 'payment_pending'
  ).length;
  const confirmedCount = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'in_progress'
  ).length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const rejectedCount = bookings.filter((b) => b.status === 'rejected').length;

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'review')
      return b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request';
    if (activeFilter === 'payment')
      return b.status === 'approved' || b.status === 'payment_pending';
    if (activeFilter === 'confirmed')
      return b.status === 'confirmed' || b.status === 'in_progress';
    if (activeFilter === 'completed')
      return b.status === 'completed';
    if (activeFilter === 'declined')
      return b.status === 'rejected' || b.status === 'cancelled';
    return true;
  });

  // Filter Vendors
  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearch.trim()) return true;
    const query = vendorSearch.toLowerCase();
    return (
      (v.business_name && v.business_name.toLowerCase().includes(query)) ||
      (v.owner_name && v.owner_name.toLowerCase().includes(query)) ||
      (v.category_name && v.category_name.toLowerCase().includes(query)) ||
      (v.location && v.location.toLowerCase().includes(query)) ||
      (v.bio && v.bio.toLowerCase().includes(query)) ||
      (v.skills && v.skills.toLowerCase().includes(query))
    );
  });

  // Helper for Stepper Stages
  const getStageNumber = (status) => {
    switch (status) {
      case 'new_request':
        return 1;
      case 'under_review':
      case 'availability_check':
      case 'rejected':
        return 2;
      case 'approved':
      case 'payment_pending':
        return 3;
      case 'confirmed':
        return 4;
      case 'in_progress':
        return 5;
      case 'completed':
        return 6;
      default:
        return 1;
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Client Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
            Welcome, {user?.name || 'Client'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Browse and book approved creative partners, reserve production holds, and track your active shoot milestones.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {onOpenCart && (
            <button
              onClick={onOpenCart}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>🛒</span>
              <span>Hold Cart</span>
            </button>
          )}

          {onBackToMarketplace && (
            <button
              onClick={onBackToMarketplace}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Explore Public Marketplace
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-4 font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div
          onClick={() => setMainTab('vendors')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            mainTab === 'vendors'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Approved Talent & Studios
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{vendors.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">Vetted & ready for booking</span>
        </div>

        <div
          onClick={() => {
            setMainTab('projects');
            setActiveFilter('review');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            mainTab === 'projects' && activeFilter === 'review'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Under Curation Review
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{underReviewCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Checking provider availability</span>
        </div>

        <div
          onClick={() => {
            setMainTab('projects');
            setActiveFilter('payment');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            mainTab === 'projects' && activeFilter === 'payment'
              ? 'bg-purple-50/60 border-purple-300 ring-2 ring-purple-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Payment Ready</span>
            {paymentPendingCount > 0 && (
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                Action Needed
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{paymentPendingCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Terms approved by curation team</span>
        </div>

        <div
          onClick={() => {
            setMainTab('projects');
            setActiveFilter('confirmed');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            mainTab === 'projects' && activeFilter === 'confirmed'
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Confirmed / Active</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{confirmedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Production locked & scheduled</span>
        </div>
      </div>

      {/* Main Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2">
        <button
          onClick={() => setMainTab('vendors')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            mainTab === 'vendors'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>🎨 Approved Creative Talent & Studios</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              mainTab === 'vendors' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {vendors.length}
          </span>
        </button>

        <button
          onClick={() => setMainTab('projects')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            mainTab === 'projects'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>📋 My Projects & Bookings</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              mainTab === 'projects' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {bookings.length}
          </span>
          {paymentPendingCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
          )}
        </button>
      </div>

      {/* ================= TAB 1: APPROVED TALENT & STUDIOS ================= */}
      {mainTab === 'vendors' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Approved Creative Partners Ready for Booking</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All vendors listed below have passed our identity and quality verification. Select a partner to view portfolio works or book a hold.
              </p>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search vendor, specialty, city..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {loadingVendors ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading approved creative partners...
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No approved vendors match your search.</p>
              <p className="text-xs text-slate-500 mt-1">Try clearing your search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span>✓</span>
                        <span>Approved Vendor</span>
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

                    {/* Business & Owner Info */}
                    <h3 className="text-lg font-bold text-slate-900">{vendor.business_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lead: <strong className="text-slate-700">{vendor.owner_name}</strong>
                      {vendor.category_name && ` • ${vendor.category_name}`}
                    </p>

                    <p className="text-xs text-slate-600 mt-3 leading-relaxed line-clamp-3">
                      {vendor.bio || 'Verified creative vendor providing production services and gear.'}
                    </p>

                    {/* Skills pills */}
                    {vendor.skills && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(Array.isArray(vendor.skills)
                          ? vendor.skills
                          : vendor.skills.split(',')
                        )
                          .slice(0, 3)
                          .map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                            >
                              {skill.trim()}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Pricing and Action Buttons */}
                  <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Standard Rate</span>
                      <span className="text-base font-bold text-slate-900 font-mono">
                        ₹{Number(vendor.pricing || 15000).toLocaleString()}
                        <span className="text-xs text-slate-500 font-normal">/{vendor.pricing_unit || 'day'}</span>
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
      )}

      {/* ================= TAB 2: MY PROJECTS & BOOKINGS ================= */}
      {mainTab === 'projects' && (
        <div className="space-y-6">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Projects', count: bookings.length },
              { id: 'review', label: 'Under Review', count: underReviewCount },
              { id: 'payment', label: 'Payment Pending', count: paymentPendingCount },
              { id: 'confirmed', label: 'Confirmed Shoots', count: confirmedCount },
              { id: 'completed', label: 'Completed', count: completedCount },
              { id: 'declined', label: 'Declined', count: rejectedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeFilter === tab.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {loadingBookings ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading your project bookings...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-3">
                🎬
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Projects Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                You have no active projects under this status. Choose an approved vendor to place a hold!
              </p>
              <button
                onClick={() => setMainTab('vendors')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                View Approved Vendors &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredBookings.map((b) => {
                const stage = getStageNumber(b.status);
                const isPayable = b.status === 'approved' || b.status === 'payment_pending';

                return (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all"
                  >
                    {/* Project Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                            {b.category_name || 'Creative Service'}
                          </span>

                          <span
                            className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border ${
                              b.status === 'confirmed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : b.status === 'approved' || b.status === 'payment_pending'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse'
                                : b.status === 'completed'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : b.status === 'rejected' || b.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 font-black'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {b.status === 'rejected' ? 'Declined by Partner' : b.status.replace('_', ' ')}
                          </span>

                          {b.payment_status === 'paid' && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ Paid (Razorpay)
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-slate-900">{b.project_name || b.resource_title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Service Provider:{' '}
                          <strong className="text-slate-800">
                            {b.business_name || b.provider_name || 'Creative Studio'}
                          </strong>
                          {b.vendor_location && ` • ${b.vendor_location}`}
                        </p>
                      </div>

                      {/* Pricing and Action */}
                      <div className="flex items-center gap-4 self-start lg:self-auto">
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Amount</span>
                          <span className="text-lg font-bold text-slate-900 font-mono">
                            ₹{Number(b.total_amount).toLocaleString()}
                          </span>
                        </div>

                        {isPayable && (
                          <button
                            onClick={() => handlePay(b.id, b.total_amount)}
                            disabled={payingId === b.id}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <span>💳</span>
                            <span>{payingId === b.id ? 'Processing...' : 'Pay with Razorpay'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Alert Banners */}
                    {b.status === 'rejected' && (
                      <div className="my-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs shadow-2xs animate-fadeIn">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-rose-900">
                            <span className="text-base leading-none">❌</span>
                            <span>Booking Request Declined by {b.business_name || b.provider_name || 'Creative Partner'}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
                            Not Confirmed
                          </span>
                        </div>

                        <div className="mt-2.5 p-3 bg-white border border-rose-100 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                            Reason Provided by Creative Partner:
                          </span>
                          <p className="text-xs text-rose-950 font-medium italic">
                            "{b.rejection_reason || 'The creative partner is unavailable on your requested shoot schedule.'}"
                          </p>
                        </div>

                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-rose-100/80">
                          <span className="text-[11px] text-rose-700">
                            No payment was deducted. You can explore other approved creative partners in our directory.
                          </span>
                          <button
                            onClick={() => setMainTab('vendors')}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer shadow-2xs whitespace-nowrap self-start sm:self-auto"
                          >
                            Browse Other Creative Partners &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {(b.status === 'under_review' || b.status === 'new_request') && (
                      <div className="my-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">⏳</span>
                          <div>
                            <strong className="font-bold text-amber-900 block">Awaiting Creative Partner Acceptance:</strong>
                            <p className="text-amber-800 text-[11px] mt-0.5">
                              Your shoot request has been sent to <strong>{b.business_name || b.provider_name}</strong>. The partner will review and accept or decline.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                          Pending Partner Review
                        </span>
                      </div>
                    )}

                    {/* Visual Milestone Stepper */}
                    <div className="py-5 border-b border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-3">
                        Managed Workflow Pipeline Progress
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                        {[
                          { step: 1, label: 'Requirement Submitted' },
                          { step: 2, label: b.status === 'rejected' ? 'Declined by Partner' : 'Availability Check' },
                          { step: 3, label: 'Terms Approved' },
                          { step: 4, label: 'Payment Verified' },
                          { step: 5, label: 'In Progress' },
                          { step: 6, label: 'Completed' },
                        ].map((m) => {
                          const isRejected = b.status === 'rejected';
                          const isDone = isRejected ? m.step === 1 : stage > m.step;
                          const isCurrent = !isRejected && stage === m.step;
                          const isDeclinedStep = isRejected && m.step === 2;

                          return (
                            <div
                              key={m.step}
                              className={`p-2.5 rounded-xl border transition-all ${
                                isDeclinedStep
                                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                                  : isCurrent
                                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/10'
                                  : isDone
                                  ? 'bg-slate-50 border-slate-200 text-slate-400'
                                  : 'bg-white border-slate-100 text-slate-300'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mx-auto mb-1 ${
                                  isDeclinedStep
                                    ? 'bg-rose-600 text-white'
                                    : isCurrent
                                    ? 'bg-blue-600 text-white'
                                    : isDone
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {isDeclinedStep ? '✕' : isDone ? '✓' : m.step}
                              </div>
                              <span
                                className={`text-[11px] font-semibold leading-tight block ${
                                  isDeclinedStep
                                    ? 'text-rose-900 font-bold'
                                    : isCurrent
                                    ? 'text-blue-900 font-bold'
                                    : isDone
                                    ? 'text-slate-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {m.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Details Footer */}
                    <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-4">
                        <span>
                          Dates: <strong>{new Date(b.start_date).toLocaleDateString()}</strong> &rarr;{' '}
                          <strong>{new Date(b.end_date).toLocaleDateString()}</strong>
                        </span>
                        {b.duration && <span>Duration: {b.duration}</span>}
                      </div>

                      <div className="flex items-center gap-4">
                        <span>
                          Advance:{' '}
                          <strong className="text-slate-700">₹{Number(b.advance_amount || 0).toLocaleString()}</strong>
                        </span>
                        <span>
                          Paid:{' '}
                          <strong className="text-slate-700">₹{Number(b.paid_amount || 0).toLocaleString()}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Review Section for Completed Bookings */}
                    {b.status === 'completed' && (() => {
                      const existingReview = myReviews.find((r) => r.booking_id === b.id);

                      return (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                          <div>
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                              <span>✓</span>
                              <span>Production Completed & Delivered</span>
                            </span>

                            {existingReview ? (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-1 text-amber-500 text-sm">
                                  {'★'.repeat(existingReview.rating)}
                                  {'☆'.repeat(5 - existingReview.rating)}
                                  <span className="text-xs font-bold text-slate-800 ml-1.5">
                                    {existingReview.rating}/5 Stars
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 mt-0.5 italic">
                                  &ldquo;{existingReview.comment}&rdquo;
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600 mt-1">
                                Share your verified feedback to help other creators and highlight this provider&apos;s work.
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => setSelectedReviewBooking(b)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                          >
                            <span>⭐</span>
                            <span>{existingReview ? 'Update Review' : 'Upload Review'}</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Professional Profile Detail Modal */}
      <ProfessionalDetailModal
        professional={selectedProfessional}
        isOpen={Boolean(selectedProfessional)}
        onClose={() => setSelectedProfessional(null)}
        onRequestBooking={(prof) => {
          setSelectedProfessional(null);
          onAddToCart?.(prof);
        }}
      />

      {/* Review Submission Modal */}
      <ReviewModal
        isOpen={Boolean(selectedReviewBooking)}
        booking={selectedReviewBooking}
        onClose={() => setSelectedReviewBooking(null)}
        onSuccess={() => {
          fetchMyReviews();
          fetchApprovedVendors();
          setNotification({
            type: 'success',
            message: 'Thank you! Your verified review has been published.',
          });
        }}
      />
    </main>
  );
}
