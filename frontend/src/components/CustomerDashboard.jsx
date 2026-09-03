import React, { useState, useEffect } from 'react';

export default function CustomerDashboard({ user, onOpenAuth, onBackToMarketplace }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [payingId, setPayingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const token = localStorage.getItem('token');

  const fetchCustomerBookings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (err) {
      console.error('Failed to load customer bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerBookings();
  }, [token]);

  // Handle Online Payment (Razorpay simulation / payment gateway)
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
        message: `Payment of ₹${Number(amount).toLocaleString()} successfully verified! Booking confirmed. (Transaction ID: ${data.transaction?.payment_id})`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setPayingId(null);
    }
  };

  // Metrics
  const underReviewCount = bookings.filter((b) => b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request').length;
  const paymentPendingCount = bookings.filter((b) => b.status === 'approved' || b.status === 'payment_pending').length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;

  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'review') return b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request';
    if (activeFilter === 'payment') return b.status === 'approved' || b.status === 'payment_pending';
    if (activeFilter === 'confirmed') return b.status === 'confirmed' || b.status === 'in_progress';
    if (activeFilter === 'completed') return b.status === 'completed';
    return true;
  });

  // Helper for Stepper Stages
  const getStageNumber = (status) => {
    switch (status) {
      case 'new_request':
      case 'under_review':
        return 1;
      case 'availability_check':
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Customer Dashboard &bull; Section 15
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
            My Creative Projects & Bookings
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track submitted requirements through our managed marketplace review pipeline and complete payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMarketplace}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Browse More Talent & Gear</span>
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div
          onClick={() => setActiveFilter('review')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'review'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Under Curation Review</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{underReviewCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Checking provider availability</span>
        </div>

        <div
          onClick={() => setActiveFilter('payment')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'payment'
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
          onClick={() => setActiveFilter('confirmed')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'confirmed'
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Confirmed / Active</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{confirmedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Production locked & scheduled</span>
        </div>

        <div
          onClick={() => setActiveFilter('completed')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'completed'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Completed Projects</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{completedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Delivered work history</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 mb-6 overflow-x-auto">
        {[
          { id: 'all', label: 'All Projects', count: bookings.length },
          { id: 'review', label: 'Under Review', count: underReviewCount },
          { id: 'payment', label: 'Payment Pending', count: paymentPendingCount },
          { id: 'confirmed', label: 'Confirmed Shoots', count: confirmedCount },
          { id: 'completed', label: 'Completed', count: completedCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeFilter === tab.id
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeFilter === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
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
            Browse our verified cinematographers, models, editors, and camera kits to submit your first booking request!
          </p>
          <button
            onClick={onBackToMarketplace}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Browse Marketplace Disciplines &rarr;
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
                            : b.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
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
                      <strong className="text-slate-800">{b.business_name || b.provider_name || 'Creative Studio'}</strong>
                      {b.vendor_location && ` &bull; ${b.vendor_location}`}
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

                {/* Visual Milestone Stepper (Section 10 Managed Workflow) */}
                <div className="py-5 border-b border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-3">
                    Managed Workflow Pipeline Progress
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                    {[
                      { step: 1, label: 'Requirement Submitted' },
                      { step: 2, label: 'Availability Check' },
                      { step: 3, label: 'Terms Approved' },
                      { step: 4, label: 'Payment Verified' },
                      { step: 5, label: 'Shoot In Progress' },
                      { step: 6, label: 'Project Completed' },
                    ].map((st) => (
                      <div
                        key={st.step}
                        className={`p-2.5 rounded-xl border transition-all ${
                          stage >= st.step
                            ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center text-[10px] font-bold ${
                            stage >= st.step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {stage > st.step ? '✓' : st.step}
                        </div>
                        <span className="text-[11px] block leading-tight">{st.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Production Dates & Duration</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(b.start_date).toLocaleDateString()} &rarr; {new Date(b.end_date).toLocaleDateString()}
                    </span>
                    {b.duration && <span className="block text-slate-500">Duration: {b.duration}</span>}
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Location</span>
                    <span className="font-semibold text-slate-800">{b.project_location || 'Not Specified'}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Estimated Budget</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      ₹{Number(b.estimated_budget || b.total_amount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {b.project_description && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-800 block mb-0.5">Project Notes & Scope:</strong>
                    {b.project_description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
