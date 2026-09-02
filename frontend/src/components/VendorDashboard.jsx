import React, { useState, useEffect } from 'react';

export default function VendorDashboard({ user, onBackToMarketplace }) {
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' | 'bookings'

  // Portfolio State
  const [portfolio, setPortfolio] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [updatingBookingId, setUpdatingBookingId] = useState(null);

  // Vendor Profile State
  const [vendorProfile, setVendorProfile] = useState(null);

  // Feedback State
  const [notification, setNotification] = useState(null);

  const token = localStorage.getItem('token');

  // Load Vendor Profile
  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setVendorProfile(data.data);
      }
    } catch (err) {
      console.error('Failed to load vendor profile:', err);
    }
  };

  // Load Portfolio Works
  const fetchPortfolio = async () => {
    if (!token) return;
    setLoadingPortfolio(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/portfolios/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio(data.data);
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  // Load Vendor Bookings
  const fetchBookings = async () => {
    if (!token) return;
    setLoadingBookings(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/vendor', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (err) {
      console.error('Failed to load vendor bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPortfolio();
    fetchBookings();
  }, [token]);

  // Handle Delete Portfolio Item
  const handleDeletePortfolio = async (id) => {
    if (!window.confirm('Are you sure you want to remove this work from your gallery?')) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/portfolios/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete work');

      setPortfolio((prev) => prev.filter((item) => item.id !== id));
      setNotification({ type: 'success', message: 'Work removed from gallery.' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Handle Booking Status Update
  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    setUpdatingBookingId(bookingId);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update booking status');

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      setNotification({
        type: 'success',
        message: `Booking request updated to "${newStatus.replace('_', ' ').toUpperCase()}".`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  // Metrics
  const pendingRequestsCount = bookings.filter((b) => b.status === 'under_review' || b.status === 'pending').length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'approved').length;
  const totalValue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'requests') return b.status === 'under_review' || b.status === 'pending';
    if (bookingFilter === 'confirmed') return b.status === 'confirmed' || b.status === 'approved';
    if (bookingFilter === 'completed') return b.status === 'completed';
    if (bookingFilter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Studio Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Vendor Studio & Portfolio
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                vendorProfile?.verification_status === 'verified'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {vendorProfile?.verification_status || 'Pending Review'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
            {vendorProfile?.business_name || user?.name || 'Creator Studio'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {vendorProfile?.bio || 'Manage your creative showcase, upload portfolio works, and track client bookings.'}
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
            <span>📍 {vendorProfile?.location || 'Base Location Not Set'}</span>
            <span>👤 Lead: {user?.name || user?.mobile}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Upload New Work</span>
          </button>
          <button
            onClick={onBackToMarketplace}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            &larr; Marketplace
          </button>
        </div>
      </div>

      {/* Verification Notice Banner if Pending */}
      {vendorProfile?.verification_status !== 'verified' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <span className="text-base">⏳</span>
          <div>
            <strong className="block mb-0.5">Profile Under Admin Verification</strong>
            Your profile application is currently under review by our curation team. You can continue uploading works to your gallery and configuring your studio in the meantime!
          </div>
        </div>
      )}

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

      {/* Studio Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div
          onClick={() => setActiveTab('gallery')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'gallery'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Gallery Works</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{portfolio.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">Live showcase items</span>
        </div>

        <div
          onClick={() => {
            setActiveTab('bookings');
            setBookingFilter('requests');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'bookings' && bookingFilter === 'requests'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Booking Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                Action Required
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{pendingRequestsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting your response</span>
        </div>

        <div
          onClick={() => {
            setActiveTab('bookings');
            setBookingFilter('confirmed');
          }}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'bookings' && bookingFilter === 'confirmed'
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Confirmed Shoots</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{confirmedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Active production dates</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Confirmed Value</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">₹{totalValue.toLocaleString()}</p>
          <span className="text-xs text-slate-500 mt-1 block">Gross booking total</span>
        </div>
      </div>

      {/* Main Studio Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2">
        <button
          onClick={() => setActiveTab('gallery')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'gallery'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Creative Gallery</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
            activeTab === 'gallery' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {portfolio.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'bookings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Booking Requests & History</span>
          {pendingRequestsCount > 0 && (
            <span className="text-[10px] px-2 py-0.2 bg-amber-500 text-white rounded-full font-bold">
              {pendingRequestsCount} new
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: GALLERY MANAGEMENT */}
      {activeTab === 'gallery' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Portfolio Gallery</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showcase previous client shoots, equipment setups, cinematography reels, and production stills.
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>+</span>
              <span>Upload Work</span>
            </button>
          </div>

          {loadingPortfolio ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading your gallery works...
            </div>
          ) : portfolio.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-3">
                📷
              </div>
              <h3 className="text-sm font-bold text-slate-800">Your Gallery is Empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Clients choose talent and gear based on verified work samples. Upload your first cinematography still or photo shoot!
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                + Upload First Work
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolio.map((work) => (
                <div
                  key={work.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="relative aspect-video bg-slate-100 overflow-hidden">
                    <img
                      src={work.media_url}
                      alt={work.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&auto=format&fit=crop&q=60';
                      }}
                    />
                    <span className="absolute top-2.5 right-2.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                      {work.media_type || 'image'}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {work.title}
                      </h3>
                      {work.description && (
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                          {work.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Added {new Date(work.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDeletePortfolio(work.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOOKING REQUESTS & HISTORY */}
      {activeTab === 'bookings' && (
        <div>
          {/* Booking Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Client Booking Requests & History</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Respond to incoming production holds and track completed studio rentals.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'requests', label: 'Pending Requests' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setBookingFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    bookingFilter === f.id
                      ? 'bg-white text-blue-700 shadow-xs'
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
              Loading booking history...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mx-auto mb-3">
                📅
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Bookings in This View</h3>
              <p className="text-xs text-slate-500 mt-1">
                When clients book your listed talent or rental gear, their requests will appear here for your confirmation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border ${
                          b.status === 'confirmed' || b.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : b.status === 'completed'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : b.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {b.category_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        • Received {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{b.resource_title}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Customer</span>
                        <strong className="text-slate-800">{b.customer_name || 'Creative Client'}</strong>
                        {b.customer_mobile && <span className="block text-slate-500">{b.customer_mobile}</span>}
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Production Dates</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(b.start_date).toLocaleDateString()} &rarr; {new Date(b.end_date).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Total Price</span>
                        <span className="text-sm font-bold text-slate-900">
                          ₹{Number(b.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {(b.status === 'under_review' || b.status === 'pending') && (
                      <>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                          disabled={updatingBookingId === b.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {updatingBookingId === b.id ? 'Updating...' : '✓ Accept Booking'}
                        </button>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {b.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                          disabled={updatingBookingId === b.id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          Mark as Completed
                        </button>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {b.status === 'completed' && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        Shoot Completed
                      </span>
                    )}

                    {b.status === 'cancelled' && (
                      <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD WORK MODAL */}
      {isUploadModalOpen && (
        <UploadWorkModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={(newWork) => {
            setPortfolio((prev) => [newWork, ...prev]);
            setIsUploadModalOpen(false);
            setNotification({ type: 'success', message: `"${newWork.title}" added to your gallery!` });
          }}
          token={token}
        />
      )}
    </main>
  );
}

// Sub-component: Upload Work Modal
function UploadWorkModal({ isOpen, onClose, onSuccess, token }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Sample Presets for quick test uploads
  const presets = [
    {
      label: 'Cinema Camera Rig',
      url: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&auto=format&fit=crop&q=80',
      title: 'Sony FX3 Cinema Kit Rigged on Gimbal',
      desc: 'Full documentary camera build with wireless focus, matte box, and V-mount battery system.',
    },
    {
      label: 'Fashion Shoot',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      title: 'Editorial High-Fashion Lookbook',
      desc: 'Studio editorial portrait shot with Profoto softboxes and prime 85mm lens.',
    },
    {
      label: 'Anamorphic Cine Still',
      url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
      title: 'Narrative Short Film Still',
      desc: 'Cinematography frame captured with anamorphic glass in low-light night exterior.',
    },
    {
      label: 'Color Grading Suite',
      url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80',
      title: 'DaVinci Resolve HDR Color Grade',
      desc: 'Commercial beauty pass and cinematic curve manipulation on broadcast monitors.',
    },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/portfolios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          media_url: mediaUrl,
          media_type: mediaType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to upload work');

      onSuccess(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (p) => {
    setTitle(p.title);
    setDescription(p.desc);
    setMediaUrl(p.url);
    setMediaType('image');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        <div className="mb-5">
          <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Showcase Work
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            Upload Work to Gallery
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Showcase your best cinematography, commercial photography, or rental gear to prospective clients.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Presets Row */}
        <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="text-[11px] font-semibold text-slate-700 block mb-2">
            ✨ Quick Showcase Presets:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-700 text-[11px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Commercial Car Ad / Music Video Stills"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Media Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  mediaType === 'image'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Photograph / Frame
              </button>
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  mediaType === 'video'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Video / Showreel
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Media Image / Thumbnail URL
            </label>
            <input
              type="url"
              required
              placeholder="https://images.unsplash.com/..."
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description / Gear / Production Notes
            </label>
            <textarea
              rows="3"
              placeholder="Detail the cameras, lenses, lighting used, or project scope..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          {mediaUrl && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Live Preview:</span>
              <img
                src={mediaUrl}
                alt="Preview"
                className="w-full h-36 object-cover rounded-lg"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&auto=format&fit=crop&q=60';
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {submitting ? 'Publishing Work...' : 'Publish to Gallery'}
          </button>
        </form>
      </div>
    </div>
  );
}
