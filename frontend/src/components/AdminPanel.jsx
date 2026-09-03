import React, { useState, useEffect } from 'react';

export default function AdminPanel({ onBackToMarketplace }) {
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'vendors' | 'users'
  const [bookings, setBookings] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState('all');

  const token = localStorage.getItem('token');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Bookings
      const bookingsRes = await fetch('http://127.0.0.1:5000/api/v1/bookings/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bookingsData = await bookingsRes.json();
      if (bookingsData.success) setBookings(bookingsData.data);

      // 2. Fetch Vendors
      const vendorsRes = await fetch('http://127.0.0.1:5000/api/v1/vendors/list');
      const vendorsData = await vendorsRes.json();
      if (vendorsData.success) setVendors(vendorsData.data);

      // 3. Fetch All Users
      const usersRes = await fetch('http://127.0.0.1:5000/api/v1/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) setUsersList(usersData.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateVendorStatus = async (vendorId, status) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Action failed');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    return b.status.toLowerCase() === bookingFilter.toLowerCase();
  });

  const totalGMV = bookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const pendingVendors = vendors.filter((v) => v.verification_status === 'pending').length;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Console Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            Admin Console &bull; Operations Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
            Platform Operations & Managed Pipeline
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review pipeline bookings, audit accounts, and manage creator and gear verifications.
          </p>
        </div>

        <button
          onClick={onBackToMarketplace}
          className="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          &larr; Marketplace View
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Users</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{usersList.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">Registered accounts</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending Providers</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">{pendingVendors}</p>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting approval</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Bookings</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{bookings.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">Pipeline reservations</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pipeline GMV</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">₹{totalGMV.toLocaleString()}</p>
          <span className="text-xs text-slate-500 mt-1 block">Gross merchandise value</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'bookings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Managed Bookings Table ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'vendors'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Registered Vendors Table ({vendors.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Users Directory ({usersList.length})
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
          Loading platform data...
        </div>
      ) : activeTab === 'bookings' ? (
        /* ================= 1. BOOKINGS TABLE ================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">All Pipeline Bookings</h2>
              <p className="text-xs text-slate-500">Monitor client requests, confirmed shoots, and schedules.</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-xl">
              {['all', 'under_review', 'confirmed', 'completed', 'cancelled'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setBookingFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer capitalize ${
                    bookingFilter === filter ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Booking ID</th>
                  <th className="py-3.5 px-4 font-semibold">Service / Equipment</th>
                  <th className="py-3.5 px-4 font-semibold">Client</th>
                  <th className="py-3.5 px-4 font-semibold">Provider</th>
                  <th className="py-3.5 px-4 font-semibold">Dates</th>
                  <th className="py-3.5 px-4 font-semibold">Amount</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400">
                      No bookings matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-500">
                        #{String(b.id).slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{b.resource_title}</div>
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {b.category_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{b.client_name || 'Client'}</div>
                        <div className="text-[11px] text-slate-400">{b.client_mobile}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{b.provider_name}</div>
                        <div className="text-[11px] text-slate-400">{b.provider_mobile}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>{new Date(b.start_date).toLocaleDateString()}</div>
                        <div className="text-[11px] text-slate-400">to {new Date(b.end_date).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        ₹{Number(b.total_amount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider inline-block ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : b.status === 'under_review'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : b.status === 'rejected' || b.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 font-black'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {b.status === 'rejected' ? 'Declined by Partner' : b.status.replace('_', ' ')}
                        </span>
                        {b.rejection_reason && (
                          <div
                            className="text-[11px] text-rose-700 mt-1 italic font-medium max-w-xs line-clamp-2"
                            title={b.rejection_reason}
                          >
                            Reason: "{b.rejection_reason}"
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'vendors' ? (
        /* ================= 2. REGISTERED VENDORS TABLE ================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">Vendor Management & Verification</h2>
            <p className="text-xs text-slate-500">Audit submitted creative studio details and update listing verification states.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Vendor / Studio Name</th>
                  <th className="py-3.5 px-4 font-semibold">Account Owner</th>
                  <th className="py-3.5 px-4 font-semibold">Location</th>
                  <th className="py-3.5 px-4 font-semibold">Bio / Overview</th>
                  <th className="py-3.5 px-4 font-semibold">Joined Date</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400">
                      No registered vendors found.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {v.business_name}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{v.owner_name || 'Creator'}</div>
                        <div className="text-[11px] text-slate-400">{v.email || 'No email provided'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {v.location}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500">
                        {v.bio || 'No bio provided.'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${
                            v.verification_status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : v.verification_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {v.verification_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {v.verification_status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateVendorStatus(v.id, 'verified')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateVendorStatus(v.id, 'rejected')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-semibold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : v.verification_status === 'verified' ? (
                          <button
                            onClick={() => handleUpdateVendorStatus(v.id, 'rejected')}
                            className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateVendorStatus(v.id, 'verified')}
                            className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                          >
                            Re-Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= 3. ALL USERS TABLE ================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">All Registered Platform Users</h2>
            <p className="text-xs text-slate-500">Directory of all client and creator accounts registered in PostgreSQL.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User ID</th>
                  <th className="py-3.5 px-4 font-semibold">Name</th>
                  <th className="py-3.5 px-4 font-semibold">Mobile Number</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Vendor Link</th>
                  <th className="py-3.5 px-4 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-500">
                        #{String(u.id).slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {u.name || 'Unnamed User'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {u.mobile}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {u.email || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${
                            u.role === 'admin' || u.role === 'super_admin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : u.role === 'vendor'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {u.business_name ? (
                          <div>
                            <span className="font-semibold text-slate-800">{u.business_name}</span>
                            <span className="text-[10px] text-slate-400 block capitalize">
                              {u.verification_status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Regular Customer</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}