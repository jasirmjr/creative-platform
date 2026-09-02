import React, { useState, useEffect } from 'react';

export default function AdminPanel({ user, onOpenAuth, onBackToMarketplace, onVendorStatusChanged }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const token = localStorage.getItem('token');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list');
      const data = await res.json();
      if (data.success) {
        setVendors(data.data);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
      setNotification({ type: 'error', message: 'Failed to load vendors list from server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleUpdateStatus = async (vendorId, newStatus) => {
    if (!token) {
      setNotification({ type: 'error', message: 'Authentication required. Please sign in as an Administrator.' });
      onOpenAuth();
      return;
    }

    if (!isAdmin) {
      setNotification({
        type: 'error',
        message: `Your current role is "${user?.role || 'guest'}". You need an "admin" account to approve vendors.`
      });
      return;
    }

    setUpdatingId(vendorId);
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
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update vendor status');
      }

      // Update in local state
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, verification_status: newStatus } : v))
      );

      setNotification({
        type: 'success',
        message: `Vendor status successfully updated to "${newStatus.toUpperCase()}".`
      });

      if (onVendorStatusChanged) {
        onVendorStatusChanged();
      }
    } catch (err) {
      console.error('Update status error:', err);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  // Metrics
  const pendingCount = vendors.filter((v) => v.verification_status === 'pending').length;
  const verifiedCount = vendors.filter((v) => v.verification_status === 'verified').length;
  const rejectedCount = vendors.filter((v) => v.verification_status === 'rejected').length;
  const totalCount = vendors.length;

  // Filtered List
  const filteredVendors = vendors.filter((v) => {
    const matchesFilter =
      activeFilter === 'all' ? true : v.verification_status === activeFilter;
    const matchesSearch =
      searchQuery.trim() === '' ||
      (v.business_name && v.business_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.owner_name && v.owner_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.location && v.location.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
              Admin Portal
            </span>
            {isAdmin ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Verified Admin Access
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                View Mode (Sign in as Admin to execute actions)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
            Vendor Applications & Approvals
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review creative talent and studio applications, verify credentials, and approve marketplace listings.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={onBackToMarketplace}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            &larr; Back to Marketplace
          </button>
          {!isAdmin && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Sign In as Admin
            </button>
          )}
        </div>
      </div>

      {/* Admin Notice Banner if not admin */}
      {!isAdmin && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div>
            <strong>Notice:</strong> You are currently signed in as{' '}
            <span className="font-semibold uppercase">{user?.role || 'Guest'}</span>. To approve or reject
            vendor profiles, you need to sign in with an <strong>Administrator</strong> account.
          </div>
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg self-start sm:self-auto cursor-pointer transition-colors shadow-xs"
          >
            Switch to Admin
          </button>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div
          onClick={() => setActiveFilter('pending')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'pending'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Review</span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
              Needs Action
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{pendingCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting admin verification</span>
        </div>

        <div
          onClick={() => setActiveFilter('verified')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'verified'
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Verified Partners</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{verifiedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Live on marketplace</span>
        </div>

        <div
          onClick={() => setActiveFilter('rejected')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'rejected'
              ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Rejected</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{rejectedCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Applications declined</span>
        </div>

        <div
          onClick={() => setActiveFilter('all')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Total Submissions</span>
          <p className="text-3xl font-bold text-slate-900 mt-2">{totalCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">All registered vendors</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'pending', label: 'Pending Review', count: pendingCount },
            { id: 'verified', label: 'Verified', count: verifiedCount },
            { id: 'rejected', label: 'Rejected', count: rejectedCount },
            { id: 'all', label: 'All Applications', count: totalCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeFilter === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by vendor, lead, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Vendor Cards List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-xs">
          Loading vendor applications...
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-700">No applications match your filter.</p>
          <p className="text-xs text-slate-500 mt-1">Select another tab or clear your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Info Column */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border ${
                        vendor.verification_status === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : vendor.verification_status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {vendor.verification_status}
                    </span>

                    <span className="text-xs font-medium text-slate-500">
                      📍 {vendor.location || 'Location Not Specified'}
                    </span>

                    <span className="text-xs text-slate-400">
                      • Applied {new Date(vendor.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{vendor.business_name}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                    <p>
                      <strong>Lead / Owner:</strong> {vendor.owner_name || 'Not provided'}
                    </p>
                    {vendor.mobile && (
                      <p>
                        <strong>Phone:</strong> {vendor.mobile}
                      </p>
                    )}
                    {vendor.email && (
                      <p>
                        <strong>Email:</strong> {vendor.email}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">
                    {vendor.bio || 'No detailed bio provided.'}
                  </p>
                </div>

                {/* Action Buttons Column */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                  {vendor.verification_status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(vendor.id, 'verified')}
                        disabled={updatingId === vendor.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {updatingId === vendor.id ? 'Processing...' : '✓ Approve & Verify'}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(vendor.id, 'rejected')}
                        disabled={updatingId === vendor.id}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}

                  {vendor.verification_status === 'verified' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(vendor.id, 'pending')}
                        disabled={updatingId === vendor.id}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Revert to Pending
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(vendor.id, 'rejected')}
                        disabled={updatingId === vendor.id}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {vendor.verification_status === 'rejected' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(vendor.id, 'verified')}
                        disabled={updatingId === vendor.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        ✓ Re-Approve
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(vendor.id, 'pending')}
                        disabled={updatingId === vendor.id}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Set to Pending
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
