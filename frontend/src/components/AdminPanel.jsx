import React, { useState, useEffect } from 'react';

export default function AdminPanel({
  user,
  onOpenAuth,
  onBackToMarketplace,
  onVendorStatusChanged,
}) {
  const [adminTab, setAdminTab] = useState('bookings'); // 'bookings' | 'providers' | 'payments'

  // Vendors state
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [vendorFilter, setVendorFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingVendorId, setUpdatingVendorId] = useState(null);

  // Bookings / Managed Pipeline state
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [editingBooking, setEditingBooking] = useState(null);
  const [updatingBookingId, setUpdatingBookingId] = useState(null);

  // Feedback State
  const [notification, setNotification] = useState(null);

  const token = localStorage.getItem('token');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Load Vendors
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list');
      const data = await res.json();
      if (data.success) {
        setVendors(data.data);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Load All Bookings (Admin Pipeline)
  const fetchAllBookings = async () => {
    if (!token) return;
    setLoadingBookings(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (err) {
      console.error('Failed to load all bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    if (token && isAdmin) {
      fetchAllBookings();
    }
  }, [token, isAdmin]);

  // Handle Vendor Status Update
  const handleUpdateVendorStatus = async (vendorId, newStatus) => {
    if (!isAdmin) {
      setNotification({
        type: 'error',
        message: 'Admin authorization required to verify or reject providers.',
      });
      return;
    }

    setUpdatingVendorId(vendorId);
    setNotification(null);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update vendor status');

      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, verification_status: newStatus } : v))
      );

      setNotification({
        type: 'success',
        message: `Provider status successfully updated to ${newStatus.toUpperCase()}.`,
      });

      onVendorStatusChanged?.();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUpdatingVendorId(null);
    }
  };

  // Handle Booking Pipeline Status & Terms Update
  const handleUpdateBookingPipeline = async (bookingId, updates) => {
    setUpdatingBookingId(bookingId);
    setNotification(null);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/${bookingId}/admin-pipeline`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update booking pipeline');

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...data.data } : b))
      );

      setNotification({
        type: 'success',
        message: `Booking #${bookingId.substring(0, 8)} updated to ${updates.status ? updates.status.replace('_', ' ').toUpperCase() : 'new terms'}.`,
      });
      setEditingBooking(null);
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  // Metrics (Section 17 Operational Overview)
  const pendingReviewsCount = bookings.filter((b) => b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request').length;
  const approvedTermsCount = bookings.filter((b) => b.status === 'approved' || b.status === 'payment_pending').length;
  const confirmedShootsCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress').length;
  const completedShootsCount = bookings.filter((b) => b.status === 'completed').length;
  const totalGrossRevenue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const pendingVendorsCount = vendors.filter((v) => v.verification_status === 'pending').length;
  const verifiedVendorsCount = vendors.filter((v) => v.verification_status === 'verified').length;

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'review') return b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request';
    if (bookingFilter === 'payment') return b.status === 'approved' || b.status === 'payment_pending';
    if (bookingFilter === 'active') return b.status === 'confirmed' || b.status === 'in_progress';
    if (bookingFilter === 'completed') return b.status === 'completed';
    return true;
  });

  // Filtered Vendors
  const filteredVendors = vendors.filter((v) => {
    const matchesFilter = vendorFilter === 'all' || v.verification_status === vendorFilter;
    const matchesSearch =
      searchQuery === '' ||
      v.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mobile?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Console Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
              Admin Console &bull; Sections 17–20
            </span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Managed Operations
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Platform Operations & Managed Pipeline
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Control provider verification, customer requirement reviews, availability holds, terms approval, and revenue tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isAdmin && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              Sign In as Admin
            </button>
          )}

          <button
            onClick={onBackToMarketplace}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            &larr; Marketplace
          </button>
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

      {/* Section 17 Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div
          onClick={() => {
            setAdminTab('bookings');
            setBookingFilter('review');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            adminTab === 'bookings' && bookingFilter === 'review'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Review</span>
            {pendingReviewsCount > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                Action
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{pendingReviewsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">New client requirements</span>
        </div>

        <div
          onClick={() => {
            setAdminTab('bookings');
            setBookingFilter('active');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            adminTab === 'bookings' && bookingFilter === 'active'
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Active Shoots</span>
          <p className="text-2xl font-bold text-slate-900 mt-2">{confirmedShootsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Confirmed productions</span>
        </div>

        <div
          onClick={() => {
            setAdminTab('providers');
            setVendorFilter('pending');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            adminTab === 'providers' && vendorFilter === 'pending'
              ? 'bg-purple-50/60 border-purple-300 ring-2 ring-purple-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Pending Providers</span>
            {pendingVendorsCount > 0 && (
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                {pendingVendorsCount}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{pendingVendorsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting credential approval</span>
        </div>

        <div
          onClick={() => {
            setAdminTab('providers');
            setVendorFilter('verified');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            adminTab === 'providers' && vendorFilter === 'verified'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Verified Talent</span>
          <p className="text-2xl font-bold text-slate-900 mt-2">{verifiedVendorsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Available for booking</span>
        </div>

        <div
          onClick={() => setAdminTab('payments')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            adminTab === 'payments'
              ? 'bg-slate-50/60 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Pipeline GMV</span>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">₹{totalGrossRevenue.toLocaleString()}</p>
          <span className="text-xs text-slate-500 mt-1 block">Total booked value</span>
        </div>
      </div>

      {/* Main Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2 overflow-x-auto">
        <button
          onClick={() => setAdminTab('bookings')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'bookings'
              ? 'bg-purple-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Managed Booking Pipeline</span>
          {pendingReviewsCount > 0 && (
            <span className="text-[10px] px-2 py-0.2 bg-amber-500 text-white rounded-full font-bold">
              {pendingReviewsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('providers')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            adminTab === 'providers'
              ? 'bg-purple-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Provider Management & Verification</span>
          {pendingVendorsCount > 0 && (
            <span className="text-[10px] px-2 py-0.2 bg-amber-500 text-white rounded-full font-bold">
              {pendingVendorsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('payments')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            adminTab === 'payments'
              ? 'bg-purple-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Payment & Transaction Tracking
        </button>
      </div>

      {/* TAB 1: MANAGED BOOKING PIPELINE (Section 19) */}
      {adminTab === 'bookings' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Section 19: Managed Marketplace Pipeline</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review requirements &bull; Check provider availability &bull; Confirm terms & price &bull; Issue payment hold
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'review', label: 'Under Review' },
                { id: 'payment', label: 'Payment Pending' },
                { id: 'active', label: 'Active Shoots' },
                { id: 'completed', label: 'Completed' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setBookingFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    bookingFilter === f.id
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingBookings ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading managed bookings pipeline...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl mx-auto mb-3">
                📋
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Bookings in This Pipeline State</h3>
              <p className="text-xs text-slate-500 mt-1">
                When customers submit project requirements from the marketplace, they will appear here for operational review.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                          {b.category_name || 'Creative Category'}
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : b.status === 'approved' || b.status === 'payment_pending'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : b.status === 'completed'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : b.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          ● {b.status.replace('_', ' ')}
                        </span>

                        {b.provider_availability && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              b.provider_availability === 'available'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            Provider: {b.provider_availability.replace('_', ' ')}
                          </span>
                        )}

                        {b.payment_status === 'paid' && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Payment Collected
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">{b.project_name || b.resource_title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Client: <strong className="text-slate-800">{b.customer_name}</strong> ({b.customer_mobile}) &bull; Provider:{' '}
                        <strong className="text-slate-800">{b.business_name || b.provider_name}</strong> ({b.provider_mobile})
                      </p>
                    </div>

                    <div className="flex items-center gap-4 self-start lg:self-auto">
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Confirmed Price</span>
                        <span className="text-lg font-bold text-slate-900 font-mono">
                          ₹{Number(b.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 py-4 border-b border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Dates & Schedule</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(b.start_date).toLocaleDateString()} &rarr; {new Date(b.end_date).toLocaleDateString()}
                      </span>
                      {b.duration && <span className="block text-slate-500">Duration: {b.duration}</span>}
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Shoot Location</span>
                      <span className="font-semibold text-slate-800">{b.project_location || 'Not Specified'}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Customer Budget</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        ₹{Number(b.estimated_budget || b.total_amount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Customer Requirement Description */}
                  {b.project_description && (
                    <div className="my-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
                      <strong className="text-slate-800 block mb-0.5">Project Scope & Customer Notes:</strong>
                      {b.project_description}
                    </div>
                  )}

                  {/* Managed Marketplace Step Actions */}
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Workflow Actions:
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Step 1: Check Availability */}
                      {(b.status === 'under_review' || b.status === 'new_request') && (
                        <button
                          onClick={() => handleUpdateBookingPipeline(b.id, { status: 'availability_check' })}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          1. Verify Provider Availability
                        </button>
                      )}

                      {/* Step 2: Approve Terms & Issue Payment Link */}
                      {(b.status === 'under_review' || b.status === 'availability_check') && (
                        <button
                          onClick={() => handleUpdateBookingPipeline(b.id, { status: 'approved' })}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          2. ✓ Approve Terms & Enable Payment
                        </button>
                      )}

                      {/* Step 3: Confirm Project */}
                      {b.status === 'approved' && (
                        <button
                          onClick={() => handleUpdateBookingPipeline(b.id, { status: 'confirmed' })}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          3. Confirm Project Booking
                        </button>
                      )}

                      {/* Step 4: In Progress */}
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateBookingPipeline(b.id, { status: 'in_progress' })}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          Set Shoot In Progress
                        </button>
                      )}

                      {/* Step 5: Completed */}
                      {b.status === 'in_progress' && (
                        <button
                          onClick={() => handleUpdateBookingPipeline(b.id, { status: 'completed' })}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          Mark Project Completed
                        </button>
                      )}

                      {/* Cancel */}
                      {b.status !== 'completed' && b.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateBookingPipeline(b.id, { status: 'cancelled' })}
                          disabled={updatingBookingId === b.id}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROVIDER MANAGEMENT (Section 18) */}
      {adminTab === 'providers' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Section 18: Provider Management & Verification</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify credentials &bull; Review equipment packages &bull; Approve or reject provider onboarding
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto">
              {[
                { id: 'pending', label: 'Pending Review' },
                { id: 'verified', label: 'Verified Active' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'all', label: 'All Providers' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setVendorFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    vendorFilter === tab.id
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search providers by studio name, owner, skills, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 shadow-xs"
            />
          </div>

          {loadingVendors ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading registered providers...
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <h3 className="text-sm font-bold text-slate-800">No Providers Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No service providers match the "{vendorFilter}" filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border ${
                          vendor.verification_status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : vendor.verification_status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {vendor.verification_status}
                      </span>

                      {vendor.availability_status && (
                        <span className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {vendor.availability_status.replace('_', ' ')}
                        </span>
                      )}

                      <span className="text-xs text-slate-400">
                        • Registered {new Date(vendor.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{vendor.business_name}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Owner / Contact</span>
                        <strong className="text-slate-800">{vendor.owner_name || 'Creative Lead'}</strong>
                        <span className="block text-slate-500 font-mono">{vendor.mobile}</span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Location & Experience</span>
                        <span className="font-semibold text-slate-800">{vendor.location || 'India'}</span>
                        {vendor.experience && <span className="block text-slate-500">Exp: {vendor.experience}</span>}
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Base Pricing</span>
                        <span className="font-semibold text-slate-800 font-mono">
                          {vendor.pricing ? `₹${Number(vendor.pricing).toLocaleString()} / ${vendor.pricing_unit || 'day'}` : 'Not Set'}
                        </span>
                      </div>
                    </div>

                    {vendor.bio && (
                      <p className="text-xs text-slate-500 mt-2.5 italic">"{vendor.bio}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {vendor.verification_status !== 'verified' && (
                      <button
                        onClick={() => handleUpdateVendorStatus(vendor.id, 'verified')}
                        disabled={updatingVendorId === vendor.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        ✓ Approve & Verify
                      </button>
                    )}

                    {vendor.verification_status !== 'rejected' && (
                      <button
                        onClick={() => handleUpdateVendorStatus(vendor.id, 'rejected')}
                        disabled={updatingVendorId === vendor.id}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        ✕ Reject
                      </button>
                    )}

                    {vendor.verification_status !== 'pending' && (
                      <button
                        onClick={() => handleUpdateVendorStatus(vendor.id, 'pending')}
                        disabled={updatingVendorId === vendor.id}
                        className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Reset to Pending
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS & REVENUE (Section 20) */}
      {adminTab === 'payments' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Section 20: Payment & Transaction Oversight</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Razorpay collections &bull; Advance payment tracking &bull; Outstanding customer balances
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Total Collections</span>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                ₹{bookings.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0).toLocaleString()}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">Verified Razorpay transactions</span>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Advance Holds</span>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                ₹{bookings.reduce((sum, b) => sum + Number(b.advance_amount || 0), 0).toLocaleString()}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">Scheduled production deposits</span>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Customer Balances</span>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                ₹{bookings
                  .filter((b) => b.payment_status === 'pending' || b.payment_status === 'partially_paid')
                  .reduce((sum, b) => sum + (Number(b.total_amount || 0) - Number(b.paid_amount || 0)), 0)
                  .toLocaleString()}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">Awaiting customer payment release</span>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Project</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Provider</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Paid</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{b.project_name || b.resource_title}</td>
                    <td className="p-4 text-slate-600">{b.customer_name}</td>
                    <td className="p-4 text-slate-600">{b.business_name || b.provider_name}</td>
                    <td className="p-4 font-mono font-semibold text-slate-900">₹{Number(b.total_amount).toLocaleString()}</td>
                    <td className="p-4 font-mono text-emerald-700 font-semibold">₹{Number(b.paid_amount || 0).toLocaleString()}</td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          b.payment_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {b.payment_status || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
