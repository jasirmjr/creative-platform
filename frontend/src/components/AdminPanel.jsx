import React, { useState, useEffect } from 'react';
import AdminComplaintDeskModal from './AdminComplaintDeskModal';
import ReceiptModal from './ReceiptModal';

export default function AdminPanel({ user, token: propToken, onBackToMarketplace, onVendorStatusChanged, onOpenChat }) {
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'vendors' | 'users' | 'complaints' | 'pricing'
  const [receiptModalBookingId, setReceiptModalBookingId] = useState(null);
  const [receiptModalVendorId, setReceiptModalVendorId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [complaintsList, setComplaintsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    min_daily_rate: 3000,
    recommended_daily_rate: 12000,
    max_daily_rate: 35000,
  });
  const [addingCategory, setAddingCategory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [complaintFilter, setComplaintFilter] = useState('all');
  const [complaintSearch, setComplaintSearch] = useState('');
  const [activeComplaintId, setActiveComplaintId] = useState(null);

  // All Users Directory - Windows & Search States
  const [usersSubView, setUsersSubView] = useState('both'); // 'both' | 'customers' | 'vendors'
  const [customerSearch, setCustomerSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  // Status separation state: 'active' | 'deactivated' | 'all'
  const [customerStatusFilter, setCustomerStatusFilter] = useState('active');
  const [vendorStatusFilter, setVendorStatusFilter] = useState('active');

  // Delete User Confirmation State
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification Toast
  const [notification, setNotification] = useState(null);

  const token = propToken || sessionStorage.getItem('token');
  const currentAdminId = user?.id;

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Bookings
      const bookingsRes = await fetch('/api/v1/bookings/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bookingsData = await bookingsRes.json();
      if (bookingsData.success) setBookings(bookingsData.data);

      // 2. Fetch Vendors (include all for admin management, including unpaid)
      const vendorsRes = await fetch('/api/v1/vendors/list?include_deleted=true&include_unavailable=true&include_unpaid=true');
      const vendorsData = await vendorsRes.json();
      if (vendorsData.success) setVendors(vendorsData.data);

      // 3. Fetch All Users
      const usersRes = await fetch('/api/v1/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) setUsersList(usersData.data);

      // 4. Fetch All Complaints & Disputes
      const complaintsRes = await fetch('/api/v1/complaints/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const complaintsData = await complaintsRes.json();
      if (complaintsData.success) setComplaintsList(complaintsData.data);

      // 5. Fetch Creative Disciplines & Pricing Guardrails
      const catRes = await fetch('/api/v1/categories');
      const catData = await catRes.json();
      if (catData.success) setCategoriesList(catData.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCategoryPricing = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    const min = parseFloat(editingCategory.min_daily_rate);
    const rec = parseFloat(editingCategory.recommended_daily_rate);
    const max = parseFloat(editingCategory.max_daily_rate);

    if (min <= 0 || rec <= 0 || max <= 0) {
      alert('All daily rates must be greater than zero.');
      return;
    }
    if (min > rec || rec > max) {
      alert('Pricing logic error: Minimum rate must be ≤ Recommended benchmark ≤ Maximum ceiling.');
      return;
    }

    setSavingCategory(true);
    try {
      const res = await fetch(`/api/v1/categories/${editingCategory.id}/pricing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          min_daily_rate: min,
          recommended_daily_rate: rec,
          max_daily_rate: max,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCategoriesList((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? data.data : c))
        );
        setEditingCategory(null);
        setNotification({ type: 'success', message: `Updated rate policy for ${data.data.name}` });
      } else {
        alert(data.message || 'Failed to update category pricing.');
      }
    } catch (err) {
      console.error('Save category error:', err);
      alert('Network error while saving category pricing.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const name = newCategoryData.name.trim();
    if (!name) {
      alert('Please enter a discipline / category name.');
      return;
    }
    const min = parseFloat(newCategoryData.min_daily_rate);
    const rec = parseFloat(newCategoryData.recommended_daily_rate);
    const max = parseFloat(newCategoryData.max_daily_rate);

    if (isNaN(min) || isNaN(rec) || isNaN(max) || min <= 0 || rec <= 0 || max <= 0) {
      alert('All daily rates must be positive numbers.');
      return;
    }
    if (min > rec || rec > max) {
      alert('Pricing logic error: Minimum floor must be ≤ Recommended benchmark ≤ Maximum ceiling.');
      return;
    }

    setAddingCategory(true);
    try {
      const res = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          description: newCategoryData.description,
          min_daily_rate: min,
          recommended_daily_rate: rec,
          max_daily_rate: max,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCategoriesList((prev) => [...prev, data.data].sort((a, b) => a.name.localeCompare(b.name)));
        setIsAddCategoryModalOpen(false);
        setNewCategoryData({
          name: '',
          description: '',
          min_daily_rate: 3000,
          recommended_daily_rate: 12000,
          max_daily_rate: 35000,
        });
        setNotification({
          type: 'success',
          message: `Creative discipline "${data.data.name}" successfully registered with wage policies!`,
        });
      } else {
        alert(data.message || 'Failed to create category.');
      }
    } catch (err) {
      console.error('Create category error:', err);
      alert('Network error while creating category.');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    setIsDeletingCategory(true);
    try {
      const res = await fetch(`/api/v1/categories/${catId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCategoriesList((prev) => prev.filter((c) => c.id !== catId));
        setDeleteConfirmCategory(null);
        setNotification({
          type: 'success',
          message: data.message || 'Category deleted successfully.',
        });
      } else {
        alert(data.message || 'Failed to delete category.');
      }
    } catch (err) {
      console.error('Delete category error:', err);
      alert('Network error while deleting category.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleUpdateVendorStatus = async (vendorId, status) => {
    try {
      const res = await fetch(`/api/v1/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Action failed');
      setNotification({
        type: 'success',
        message: `Vendor verification status updated to "${status}".`,
      });
      loadData();
      onVendorStatusChanged?.();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleUpdateDepositStatus = async (vendorId, deposit_status) => {
    try {
      const res = await fetch(`/api/v1/vendors/${vendorId}/deposit-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deposit_status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update deposit status');
      setNotification({
        type: 'success',
        message: `Vendor deposit status updated to "${deposit_status}".`,
      });
      loadData();
      onVendorStatusChanged?.();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleDeleteUser = async (userId) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete user.');

      setNotification({
        type: 'success',
        message: data.message || 'User account successfully deleted.',
      });
      setDeleteConfirmUser(null);
      loadData();
      onVendorStatusChanged?.();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreUser = async (userId) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/auth/users/${userId}/restore`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reactivate user.');

      setNotification({
        type: 'success',
        message: data.message || 'User account reactivated successfully.',
      });
      loadData();
      onVendorStatusChanged?.();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    return b.status.toLowerCase() === bookingFilter.toLowerCase();
  });

  // 1. Vendor Listing Deposits Collected (e.g. ₹2,000 onboarding deposit per active studio)
  const vendorListingDeposits = vendors.reduce(
    (sum, v) => (v.deposit_status === 'paid' ? sum + Number(v.deposit_amount || 2000) : sum),
    0
  );

  // 2. Client Project Booking Advance / Settled Deposits
  const bookingDeposits = bookings.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);

  // 3. Combined Platform Deposits Collected (Vendor Listing Deposits + Client Booking Advances)
  const totalDeposits = vendorListingDeposits + bookingDeposits;

  // 4. Project Booking GMV (Pipeline Volume)
  const totalGMV = bookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const pendingVendors = vendors.filter((v) => v.verification_status === 'pending').length;

  // Segregate Users into Customers, Vendors, and Admins
  const customerUsers = usersList.filter((u) => u.role === 'customer');
  const vendorUsers = usersList.filter((u) => u.role === 'vendor');
  const adminUsers = usersList.filter((u) => u.role === 'admin' || u.role === 'super_admin');

  // Active vs Deactivated breakdown
  const activeCustomers = customerUsers.filter((c) => !c.is_deleted);
  const deactivatedCustomers = customerUsers.filter((c) => c.is_deleted);

  const activeVendors = vendorUsers.filter((v) => !v.is_deleted);
  const deactivatedVendors = vendorUsers.filter((v) => v.is_deleted);

  const totalActiveUsers = activeCustomers.length + activeVendors.length;
  const totalDeactivatedUsers = deactivatedCustomers.length + deactivatedVendors.length;

  // Filter Customers
  const matchCustomerSearch = (c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      c.id.toLowerCase().includes(q)
    );
  };

  const filteredCustomerUsers = customerUsers.filter(matchCustomerSearch);
  const filteredActiveCustomers = activeCustomers.filter(matchCustomerSearch);
  const filteredDeactivatedCustomers = deactivatedCustomers.filter(matchCustomerSearch);

  // Filter Vendors
  const matchVendorSearch = (v) => {
    if (!vendorSearch.trim()) return true;
    const q = vendorSearch.toLowerCase();
    return (
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.business_name && v.business_name.toLowerCase().includes(q)) ||
      (v.mobile && v.mobile.includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      v.id.toLowerCase().includes(q)
    );
  };

  const filteredVendorUsers = vendorUsers.filter(matchVendorSearch);
  const filteredActiveVendors = activeVendors.filter(matchVendorSearch);
  const filteredDeactivatedVendors = deactivatedVendors.filter(matchVendorSearch);

  // Complaints & Disputes Metrics & Filter
  const activeDisputesCount = complaintsList.filter(
    (c) => c.status !== 'resolved' && c.status !== 'dismissed'
  ).length;

  const filteredComplaints = complaintsList.filter((c) => {
    if (complaintFilter !== 'all' && c.status !== complaintFilter) return false;
    if (!complaintSearch.trim()) return true;
    const q = complaintSearch.toLowerCase();
    return (
      (c.complaint_number && c.complaint_number.toLowerCase().includes(q)) ||
      (c.subject && c.subject.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.business_name && c.business_name.toLowerCase().includes(q)) ||
      (c.project_name && c.project_name.toLowerCase().includes(q))
    );
  });

  const renderCustomerTable = (list, isArchive = false) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
          <tr>
            <th className="py-3 px-4 font-semibold">User ID</th>
            <th className="py-3 px-4 font-semibold">Customer Name</th>
            <th className="py-3 px-4 font-semibold">Mobile Number</th>
            <th className="py-3 px-4 font-semibold">Email</th>
            <th className="py-3 px-4 font-semibold">Bookings</th>
            <th className="py-3 px-4 font-semibold">{isArchive ? 'Deactivated Date' : 'Registered Date'}</th>
            <th className="py-3 px-4 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.length === 0 ? (
            <tr>
              <td colSpan="7" className="py-10 text-center text-slate-400">
                {isArchive ? 'No deactivated customer accounts.' : 'No active customer accounts found.'}
              </td>
            </tr>
          ) : (
            list.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">
                  #{String(c.id).slice(0, 8)}
                </td>
                <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                  {c.name || 'Unnamed Client'}
                  {c.is_deleted && (
                    <span className="ml-2 text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                      Deactivated
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                  {c.mobile}
                </td>
                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                  {c.email || '—'}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="text-slate-700 font-medium">
                    {c.customer_bookings_count || 0}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                  {isArchive && c.deleted_at
                    ? new Date(c.deleted_at).toLocaleDateString()
                    : new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-right">
                  {c.is_deleted ? (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleRestoreUser(c.id)}
                      className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setDeleteConfirmUser(c)}
                      className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ml-auto inline-flex items-center gap-1"
                    >
                      <span>Delete</span>
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderVendorTable = (list, isArchive = false) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
          <tr>
            <th className="py-3 px-4 font-semibold">User ID</th>
            <th className="py-3 px-4 font-semibold">Studio / Business</th>
            <th className="py-3 px-4 font-semibold">Owner</th>
            <th className="py-3 px-4 font-semibold">Mobile</th>
            <th className="py-3 px-4 font-semibold">Verification</th>
            <th className="py-3 px-4 font-semibold">Orders</th>
            <th className="py-3 px-4 font-semibold">{isArchive ? 'Deactivated Date' : 'Registered Date'}</th>
            <th className="py-3 px-4 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.length === 0 ? (
            <tr>
              <td colSpan="8" className="py-10 text-center text-slate-400">
                {isArchive ? 'No deactivated creative vendors.' : 'No active creative vendors found.'}
              </td>
            </tr>
          ) : (
            list.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">
                  #{String(v.id).slice(0, 8)}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="font-medium text-slate-900 block">
                    {v.business_name || 'Studio Profile Pending'}
                  </span>
                  {v.vendor_location && (
                    <span className="text-[10px] text-slate-400 block">{v.vendor_location}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                  {v.name || 'Vendor User'}
                  {v.is_deleted && (
                    <span className="ml-2 text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                      Deactivated
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                  {v.mobile}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-start">
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                        v.is_deleted
                          ? 'bg-slate-100 text-slate-500'
                          : v.verification_status === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : v.verification_status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {v.is_deleted ? 'Inactive' : v.verification_status || 'Unverified'}
                    </span>
                    {!v.is_deleted && v.deposit_status && (
                      <span
                        className={`text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded border ${
                          v.deposit_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : v.deposit_status === 'waived'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {v.deposit_status === 'paid' ? 'Deposit Paid' : v.deposit_status === 'waived' ? 'Waived' : 'Deposit Pending'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                  {v.vendor_bookings_count || 0}
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                  {isArchive && v.deleted_at
                    ? new Date(v.deleted_at).toLocaleDateString()
                    : new Date(v.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {!v.is_deleted && (
                      <button
                        type="button"
                        onClick={() => onOpenChat?.({ vendorId: v.vendor_profile_id || v.id, type: 'admin_vendor' })}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Chat with Vendor"
                      >
                        <span>💬</span>
                        <span>Chat</span>
                      </button>
                    )}
                    {v.is_deleted ? (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleRestoreUser(v.id)}
                        className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setDeleteConfirmUser(v)}
                        className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

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

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onOpenChat?.({ type: 'admin_vendor' })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            title="Open Vendor Platform Support Messages"
          >
            <span>🛡️</span>
            <span>Vendor Support Desk</span>
          </button>

          <button
            onClick={onBackToMarketplace}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            &larr; Marketplace View
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-2xs border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Users</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{usersList.length}</p>
          <span className="text-xs text-slate-500 mt-1 block font-medium">
            {customerUsers.length} Clients &bull; {vendorUsers.length} Vendors
          </span>
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Deposits / GMV</p>
            {vendorListingDeposits > 0 && (
              <span
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                title={`₹${vendorListingDeposits.toLocaleString()} Vendor Listing Deposits Collected`}
              >
                ₹{vendorListingDeposits.toLocaleString()} Listing
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">₹{totalDeposits.toLocaleString()}</p>
          <span className="text-xs text-slate-500 mt-1 block">
            ₹{totalGMV.toLocaleString()} pipeline
          </span>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Active Disputes</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{activeDisputesCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">
            {complaintsList.length} total tickets filed
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'bookings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Managed Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vendors'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Registered Vendors ({vendors.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Users Directory ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('complaints')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'complaints'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Complaints & Disputes Desk</span>
          {activeDisputesCount > 0 ? (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              {activeDisputesCount} Active
            </span>
          ) : (
            <span className="text-slate-400 text-[10px]">({complaintsList.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'pricing'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Rate Policies & Guardrails</span>
          <span className="text-slate-400 text-[10px]">({categoriesList.length})</span>
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
                  <th className="py-3.5 px-4 font-semibold">Shoot Dates</th>
                  <th className="py-3.5 px-4 font-semibold">Payment & Deposit</th>
                  <th className="py-3.5 px-4 font-semibold">Workflow Status</th>
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
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 font-mono">
                          ₹{Number(b.total_amount).toLocaleString()}
                        </div>
                        <div className="text-[11px] mt-0.5 flex items-center gap-1">
                          {b.payment_status === 'paid' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Paid in Full
                            </span>
                          ) : b.payment_status === 'advance_paid' ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Advance: ₹{Number(b.paid_amount || 0).toLocaleString()} (Due: ₹{Math.max(0, Number(b.total_amount) - Number(b.paid_amount || 0)).toLocaleString()})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Advance: ₹{Number(b.advance_amount || Math.round(Number(b.total_amount) * 0.3)).toLocaleString()}
                            </span>
                          )}
                          {Number(b.paid_amount || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => setReceiptModalBookingId(b.id)}
                              className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-colors cursor-pointer shadow-2xs ml-1"
                              title="View official transaction receipt"
                            >
                              Receipt
                            </button>
                          )}
                        </div>
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
                  <th className="py-3.5 px-4 font-semibold text-center w-12">#</th>
                  <th className="py-3.5 px-4 font-semibold">Vendor / Studio Name</th>
                  <th className="py-3.5 px-4 font-semibold">Account Owner</th>
                  <th className="py-3.5 px-4 font-semibold">Specialty & Daily Wage</th>
                  <th className="py-3.5 px-4 font-semibold">Experience</th>
                  <th className="py-3.5 px-4 font-semibold">Location</th>
                  <th className="py-3.5 px-4 font-semibold">Listing Deposit</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-slate-400">
                      No registered vendors found.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v, index) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-semibold text-xs whitespace-nowrap">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {v.business_name}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{v.owner_name || 'Creator'}</div>
                        <div className="text-[11px] text-slate-400">{v.email || 'No email provided'}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{v.skills || 'Creative Discipline'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            ₹{Number(v.pricing || 0).toLocaleString()}
                            <span className="text-[10px] font-normal text-slate-400">/{v.pricing_unit || 'day'}</span>
                          </span>
                          {v.category_rec_rate ? (
                            Number(v.pricing) > Number(v.category_rec_rate) * 1.25 ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 rounded" title={`Market Avg: ₹${Number(v.category_rec_rate).toLocaleString()}`}>
                                Premium
                              </span>
                            ) : Number(v.pricing) < Number(v.category_rec_rate) * 0.85 ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 rounded" title={`Market Avg: ₹${Number(v.category_rec_rate).toLocaleString()}`}>
                                Affordable
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 rounded" title={`Market Avg: ₹${Number(v.category_rec_rate).toLocaleString()}`}>
                                Market Avg
                              </span>
                            )
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">
                          {v.experience || (v.experience_level === 'senior' ? '6+ Years' : v.experience_level === 'entry' ? '1 – 2 Years' : '3 – 5 Years')}
                        </div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          {v.experience_level === 'senior' ? 'Master' : v.experience_level === 'entry' ? 'Rising' : 'Mid-Level'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {v.location}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${
                            v.deposit_status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : v.deposit_status === 'waived'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {v.deposit_status === 'paid'
                            ? 'Paid (₹2,000)'
                            : v.deposit_status === 'waived'
                            ? 'Waived'
                            : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider w-fit ${
                              v.verification_status === 'verified'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : v.verification_status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {v.verification_status}
                          </span>
                          {Number(v.warning_strikes || 0) > 0 ? (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-wider w-fit flex items-center gap-1 ${
                                Number(v.warning_strikes) >= 3
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                              title={Number(v.warning_strikes) >= 3 ? 'Critical: 3 strikes reached!' : `${v.warning_strikes} warning strike(s)`}
                            >
                              {v.warning_strikes} {Number(v.warning_strikes) === 1 ? 'Strike' : 'Strikes'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">0 Strikes</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Deposit override button */}
                          {v.deposit_status !== 'paid' && v.deposit_status !== 'waived' ? (
                            <button
                              onClick={() => handleUpdateDepositStatus(v.id, 'paid')}
                              title="Mark deposit as received"
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          ) : v.deposit_status === 'paid' ? (
                            <>
                              <button
                                onClick={() => setReceiptModalVendorId(v.id)}
                                title="View official deposit receipt"
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                Receipt
                              </button>
                              <button
                                onClick={() => handleUpdateDepositStatus(v.id, 'waived')}
                                title="Mark as promotional waived deposit"
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                              >
                                Waive
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleUpdateDepositStatus(v.id, 'pending')}
                              title="Reset deposit to pending"
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              Reset
                            </button>
                          )}

                          {/* Verification action */}
                          {v.verification_status === 'pending' ? (
                            <div className="flex items-center gap-1">
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

                          {/* Message Vendor Button */}
                          <button
                            type="button"
                            onClick={() => onOpenChat?.({ vendorId: v.id, type: 'admin_vendor' })}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            title={`Chat with ${v.business_name}`}
                          >
                            <span>💬</span>
                            <span>Message</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'complaints' ? (
        /* ================= 4. COMPLAINTS & DISPUTES DESK ================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Complaints & Dispute Resolution Desk</h2>
                <span className="text-xs bg-rose-50 text-rose-700 font-mono px-2 py-0.5 rounded-full font-bold border border-rose-200">
                  {filteredComplaints.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Investigate client grievances, evaluate vendor counter-evidence, mediate discussions, and enforce verdicts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'open', label: 'Open' },
                  { id: 'under_vendor_review', label: 'Vendor Review' },
                  { id: 'vendor_responded', label: 'Vendor Replied' },
                  { id: 'resolved', label: 'Resolved' },
                  { id: 'dismissed', label: 'Dismissed' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setComplaintFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      complaintFilter === f.id
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="w-full sm:w-52">
                <input
                  type="text"
                  placeholder="Search disputes & tickets..."
                  value={complaintSearch}
                  onChange={(e) => setComplaintSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Ticket & Date</th>
                  <th className="py-3.5 px-4 font-semibold">Booking & Subject</th>
                  <th className="py-3.5 px-4 font-semibold">Client (Complainant)</th>
                  <th className="py-3.5 px-4 font-semibold">Creative Studio (Accused)</th>
                  <th className="py-3.5 px-4 font-semibold">Priority & Claim</th>
                  <th className="py-3.5 px-4 font-semibold">Resolution Stage</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No disputes found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {complaintFilter !== 'all' || complaintSearch
                          ? 'Try adjusting your filter or search query.'
                          : 'No customers or vendors have filed complaints.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((c) => {
                    const statusConfig = {
                      open: {
                        label: 'Open / New',
                        bg: 'bg-amber-50 text-amber-800 border-amber-200',
                        dot: 'bg-amber-500',
                      },
                      under_vendor_review: {
                        label: 'Vendor Review',
                        bg: 'bg-orange-50 text-orange-800 border-orange-200',
                        dot: 'bg-orange-500',
                      },
                      vendor_responded: {
                        label: 'Vendor Responded',
                        bg: 'bg-blue-50 text-blue-800 border-blue-200',
                        dot: 'bg-blue-500',
                      },
                      resolved: {
                        label: 'Resolved',
                        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        dot: 'bg-emerald-500',
                      },
                      dismissed: {
                        label: 'Dismissed',
                        bg: 'bg-slate-100 text-slate-700 border-slate-200',
                        dot: 'bg-slate-400',
                      },
                    }[c.status] || {
                      label: c.status,
                      bg: 'bg-slate-100 text-slate-700 border-slate-200',
                      dot: 'bg-slate-400',
                    };

                    const priorityConfig = {
                      urgent: 'text-rose-700 bg-rose-50 border-rose-200 font-bold',
                      high: 'text-rose-600 bg-rose-50 border-rose-100 font-semibold',
                      medium: 'text-amber-700 bg-amber-50 border-amber-200 font-medium',
                      low: 'text-slate-600 bg-slate-100 border-slate-200 font-normal',
                    }[c.priority] || 'text-slate-600 bg-slate-100 border-slate-200';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Ticket & Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-rose-700">
                            {c.complaint_number || `#CMP-${String(c.id).slice(0, 8)}`}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Booking & Subject */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={c.subject}>
                            {c.subject}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {c.category?.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{String(c.booking_id).slice(0, 8)}
                            </span>
                          </div>
                        </td>

                        {/* Client */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{c.customer_name || 'Client'}</div>
                          <div className="text-[11px] font-mono text-slate-400">{c.customer_mobile || '—'}</div>
                        </td>

                        {/* Creative Studio */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-purple-700">{c.business_name || 'Vendor Studio'}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-400">{c.vendor_owner_name || 'Provider'}</span>
                            {Number(c.vendor_warning_strikes || 0) > 0 && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 rounded">
                                {c.vendor_warning_strikes} Strike{Number(c.vendor_warning_strikes) > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Priority & Claim */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded border inline-block ${priorityConfig}`}>
                            {c.priority}
                          </span>
                          {(Number(c.desired_resolution_amount || 0) > 0 || Number(c.claimed_amount || 0) > 0) && (
                            <div className="text-xs font-bold text-slate-900 font-mono mt-1">
                              ₹{Number(c.desired_resolution_amount || c.claimed_amount).toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Resolution Stage & Option 1 / 4 Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusConfig.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                              {statusConfig.label}
                            </span>
                            {c.settlement_agreed && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
                                Mutual Settlement
                              </span>
                            )}
                            {c.refund_id && (
                              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full w-fit">
                                Refunded ₹{Number(c.refund_amount).toLocaleString()}
                              </span>
                            )}
                            {c.vendor_offer_type && !c.settlement_agreed && c.status !== 'resolved' && (
                              <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full w-fit">
                                Counter-Offer
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setActiveComplaintId(c.id)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Evaluate & Mediate</span>
                            <span>&rarr;</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'pricing' ? (
        /* ================= 5. CATEGORY PRICE GUARDRAILS & POLICIES ================= */
        <div className="flex flex-col gap-10 sm:gap-12 pb-8">
          {/* SECTION 1: HEADER & ACTION CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Creative Disciplines & Price Guardrail Policies</h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure platform minimum wages (floors), market benchmarks, and customer affordability ceilings per specialty.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                {categoriesList.length} Disciplines Configured
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryData({
                    name: '',
                    description: '',
                    min_daily_rate: 3000,
                    recommended_daily_rate: 12000,
                    max_daily_rate: 35000,
                  });
                  setIsAddCategoryModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Add Discipline / Category
              </button>
            </div>
          </div>

          {/* SECTION 2: MARKET METRICS OVERVIEW */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Market Rate Overview</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Platform-wide wage benchmarks and guaranteed rate guardrails</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Disciplines</span>
                <span className="text-xl font-bold text-slate-900 font-mono">{categoriesList.length}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Active catalog specialties</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Avg Benchmark Wage</span>
                <span className="text-xl font-bold text-indigo-700 font-mono">
                  ₹{Math.round(categoriesList.reduce((acc, c) => acc + Number(c.recommended_daily_rate || 0), 0) / (categoriesList.length || 1)).toLocaleString()}/day
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Across all specialties</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Lowest Minimum Floor</span>
                <span className="text-xl font-bold text-emerald-700 font-mono">
                  ₹{categoriesList.length ? Math.min(...categoriesList.map((c) => Number(c.min_daily_rate || 1000))).toLocaleString() : '1,000'}/day
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Guaranteed floor rate</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Affordability Cap</span>
                <span className="text-xl font-bold text-purple-700 font-mono">
                  ₹{categoriesList.length ? Math.max(...categoriesList.map((c) => Number(c.max_daily_rate || 50000))).toLocaleString() : '60,000'}/day
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Ceiling for studio directors</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: ACTIVE DISCIPLINES CATALOG TABLE */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-1">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Disciplines & Rate Policies Catalog</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enforced wage boundaries per discipline. Vendors cannot set rates outside these limits.</p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                {categoriesList.length} Disciplines
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Specialty / Discipline</th>
                    <th className="py-3.5 px-4 font-semibold">Platform Floor (Min ₹)</th>
                    <th className="py-3.5 px-4 font-semibold">Market Benchmark (Avg ₹)</th>
                    <th className="py-3.5 px-4 font-semibold">Affordability Ceiling (Max ₹)</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoriesList.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">{cat.name}</div>
                        {cat.description && (
                          <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">{cat.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold text-emerald-700">
                        ₹{Number(cat.min_daily_rate).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-indigo-900">
                        ₹{Number(cat.recommended_daily_rate).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold text-slate-700">
                        ₹{Number(cat.max_daily_rate).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCategory({
                              id: cat.id,
                              name: cat.name,
                              min_daily_rate: cat.min_daily_rate,
                              recommended_daily_rate: cat.recommended_daily_rate,
                              max_daily_rate: cat.max_daily_rate,
                            })}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            Edit Rates
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmCategory(cat)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 text-rose-700 border border-rose-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    ) : (
        /* ================= 3. ALL USERS DIRECTORY: MINIMAL & CLEAN ================= */
        <div className="space-y-8">
          {/* Windows View Controls Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">All Users Directory</h2>
                <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full font-medium">
                  {customerUsers.length + vendorUsers.length + adminUsers.length} Users
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registered customers, creative vendor studios, and platform administrators
              </p>
            </div>

            {/* Sub-view Switcher for 3 Categories with Explicit Padding/Gap */}
            <div className="inline-flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setUsersSubView('both')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  usersSubView === 'both'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Both Windows
              </button>
              <button
                type="button"
                onClick={() => setUsersSubView('customers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  usersSubView === 'customers'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Customers ({customerUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setUsersSubView('vendors')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  usersSubView === 'vendors'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vendors ({vendorUsers.length})
              </button>
            </div>
          </div>

          {/* WINDOW 1: REGISTERED CUSTOMERS */}
          {(usersSubView === 'both' || usersSubView === 'customers') && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Window 1: Registered Customers</h3>
                  <span className="text-xs text-slate-400 font-normal">
                    ({customerUsers.length} total)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Minimal Status Tabs: Active vs Deactivated */}
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter('active')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        customerStatusFilter === 'active'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({activeCustomers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter('deactivated')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        customerStatusFilter === 'deactivated'
                          ? 'bg-white text-rose-700 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Deactivated ({deactivatedCustomers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        customerStatusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      All
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="w-full sm:w-52">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Single Clean Table */}
              {customerStatusFilter === 'active' && renderCustomerTable(filteredActiveCustomers, false)}
              {customerStatusFilter === 'deactivated' && renderCustomerTable(filteredDeactivatedCustomers, true)}
              {customerStatusFilter === 'all' && renderCustomerTable(filteredCustomerUsers, false)}
            </div>
          )}

          {/* WINDOW 2: REGISTERED CREATIVE VENDORS */}
          {(usersSubView === 'both' || usersSubView === 'vendors') && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Window 2: Creative Vendors</h3>
                  <span className="text-xs text-slate-400 font-normal">
                    ({vendorUsers.length} total)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Minimal Status Tabs: Active vs Deactivated */}
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setVendorStatusFilter('active')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        vendorStatusFilter === 'active'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({activeVendors.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorStatusFilter('deactivated')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        vendorStatusFilter === 'deactivated'
                          ? 'bg-white text-rose-700 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Deactivated ({deactivatedVendors.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        vendorStatusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      All
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="w-full sm:w-52">
                    <input
                      type="text"
                      placeholder="Search vendors..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Single Clean Table */}
              {vendorStatusFilter === 'active' && renderVendorTable(filteredActiveVendors, false)}
              {vendorStatusFilter === 'deactivated' && renderVendorTable(filteredDeactivatedVendors, true)}
              {vendorStatusFilter === 'all' && renderVendorTable(filteredVendorUsers, false)}
            </div>
          )}

          {/* WINDOW 3: ADMIN ACCOUNTS INFO SECTION */}
          {adminUsers.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-slate-700 font-bold text-xs uppercase tracking-wider">Window 3: Platform Administrators</span>
                <span className="text-xs text-slate-400 font-normal">({adminUsers.length} total)</span>
                <div className="flex flex-wrap items-center gap-1.5 ml-1">
                  {adminUsers.map((a) => (
                    <span key={a.id} className="font-semibold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs shadow-2xs">
                      {a.name || a.email || a.mobile} {currentAdminId === a.id && '(Your Active Session)'}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 italic">Admin accounts are system-protected from accidental deletion.</span>
            </div>
          )}
        </div>
      )}

      {/* ================= DELETE USER CONFIRMATION MODAL ================= */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setDeleteConfirmUser(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold uppercase tracking-wider">
                Deact
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deactivate / Delete User Account</h3>
                <p className="text-xs text-slate-500">Revoke account access while preserving all platform records</p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 mb-4 space-y-1.5">
              <p className="font-semibold text-amber-900">
                Are you sure you want to deactivate and remove this user's account?
              </p>
              <div className="pt-2 border-t border-amber-200 text-xs text-slate-700 space-y-1">
                <div>
                  Name: <strong className="text-slate-900">{deleteConfirmUser.name || 'Unnamed'}</strong>
                </div>
                <div>
                  Role:{' '}
                  <span className="uppercase font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                    {deleteConfirmUser.role}
                  </span>
                </div>
                <div>
                  Mobile: <strong className="font-mono text-slate-900">{deleteConfirmUser.mobile}</strong>
                </div>
                {deleteConfirmUser.email && (
                  <div>
                    Email: <span className="text-slate-800">{deleteConfirmUser.email}</span>
                  </div>
                )}
                {deleteConfirmUser.business_name && (
                  <div>
                    Studio: <strong className="text-purple-700">{deleteConfirmUser.business_name}</strong>
                  </div>
                )}
              </div>
              
              <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 font-medium">
                <span>
                  <strong>All Records Kept:</strong> All past bookings, invoices, payments, reviews, and transaction records will remain safely saved in the database.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>{isDeleting ? 'Deactivating...' : 'Confirm Deactivate / Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADMIN COMPLAINTS & DISPUTES EVALUATION MODAL ================= */}
      {activeComplaintId && (
        <AdminComplaintDeskModal
          isOpen={Boolean(activeComplaintId)}
          complaintId={activeComplaintId}
          token={token}
          onClose={() => setActiveComplaintId(null)}
          onStatusUpdated={() => {
            loadData();
          }}
        />
      )}

      {/* ================= EDIT CATEGORY RATE POLICIES MODAL (MINIMAL DESIGN) ================= */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl relative">
            <button
              onClick={() => setEditingCategory(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-5 pr-6">
              <h3 className="text-base font-bold text-slate-900">
                Edit Rate Policy
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure wage boundaries for <strong className="text-slate-800 font-semibold">{editingCategory.name}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveCategoryPricing} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Daily Rate Policy (₹) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Floor</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={editingCategory.min_daily_rate}
                        onChange={(e) =>
                          setEditingCategory({
                            ...editingCategory,
                            min_daily_rate: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Benchmark</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={editingCategory.recommended_daily_rate}
                        onChange={(e) =>
                          setEditingCategory({
                            ...editingCategory,
                            recommended_daily_rate: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Ceiling</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={editingCategory.max_daily_rate}
                        onChange={(e) =>
                          setEditingCategory({
                            ...editingCategory,
                            max_daily_rate: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Validation hint */}
                {Number(editingCategory.min_daily_rate) > Number(editingCategory.recommended_daily_rate) ? (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-medium">
                    Floor cannot exceed benchmark rate.
                  </p>
                ) : Number(editingCategory.recommended_daily_rate) > Number(editingCategory.max_daily_rate) ? (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-medium">
                    Benchmark cannot exceed ceiling rate.
                  </p>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
                    <span>Range: ₹{Number(editingCategory.min_daily_rate || 0).toLocaleString()} – ₹{Number(editingCategory.max_daily_rate || 0).toLocaleString()}</span>
                    <span>Avg: ₹{Number(editingCategory.recommended_daily_rate || 0).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savingCategory ||
                    Number(editingCategory.min_daily_rate) <= 0 ||
                    Number(editingCategory.min_daily_rate) > Number(editingCategory.recommended_daily_rate) ||
                    Number(editingCategory.recommended_daily_rate) > Number(editingCategory.max_daily_rate)
                  }
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {savingCategory ? 'Saving...' : 'Save Rate Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD NEW CATEGORY / DISCIPLINE MODAL (MINIMAL DESIGN) ================= */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl relative">
            <button
              onClick={() => setIsAddCategoryModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-5 pr-6">
              <h3 className="text-base font-bold text-slate-900">
                Register Creative Discipline
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add a new specialty to the marketplace catalog and configure its wage policies
              </p>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Discipline / Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Colorist, Drone Pilot, Wardrobe Stylist"
                  value={newCategoryData.name}
                  onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Short Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Brief scope of work or deliverables"
                  value={newCategoryData.description}
                  onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Daily Rate Policy (₹) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Floor</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={newCategoryData.min_daily_rate}
                        onChange={(e) => setNewCategoryData({ ...newCategoryData, min_daily_rate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Benchmark</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={newCategoryData.recommended_daily_rate}
                        onChange={(e) => setNewCategoryData({ ...newCategoryData, recommended_daily_rate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Ceiling</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={newCategoryData.max_daily_rate}
                        onChange={(e) => setNewCategoryData({ ...newCategoryData, max_daily_rate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Validation hint */}
                {Number(newCategoryData.min_daily_rate) > Number(newCategoryData.recommended_daily_rate) ? (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-medium">
                    Floor cannot exceed benchmark rate.
                  </p>
                ) : Number(newCategoryData.recommended_daily_rate) > Number(newCategoryData.max_daily_rate) ? (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-medium">
                    Benchmark cannot exceed ceiling rate.
                  </p>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
                    <span>Range: ₹{Number(newCategoryData.min_daily_rate || 0).toLocaleString()} – ₹{Number(newCategoryData.max_daily_rate || 0).toLocaleString()}</span>
                    <span>Avg: ₹{Number(newCategoryData.recommended_daily_rate || 0).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    addingCategory ||
                    !newCategoryData.name.trim() ||
                    Number(newCategoryData.min_daily_rate) <= 0 ||
                    Number(newCategoryData.min_daily_rate) > Number(newCategoryData.recommended_daily_rate) ||
                    Number(newCategoryData.recommended_daily_rate) > Number(newCategoryData.max_daily_rate)
                  }
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {addingCategory ? 'Registering...' : 'Register Discipline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CATEGORY CONFIRMATION MODAL ================= */}
      {deleteConfirmCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setDeleteConfirmCategory(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold uppercase tracking-wider">
                Delete
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Creative Discipline</h3>
                <p className="text-xs text-slate-500">Remove category from platform catalog</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 mb-4 space-y-2">
              <p className="font-semibold text-rose-900">
                Are you sure you want to permanently delete this discipline?
              </p>
              <div className="pt-2 border-t border-rose-200 text-xs text-slate-700 space-y-1">
                <div>
                  Discipline Name: <strong className="text-slate-900">{deleteConfirmCategory.name}</strong>
                </div>
                <div>
                  Daily Wage Floor: <strong className="font-mono text-slate-900">₹{Number(deleteConfirmCategory.min_daily_rate).toLocaleString()}</strong>
                </div>
                <div>
                  Market Benchmark: <strong className="font-mono text-indigo-900">₹{Number(deleteConfirmCategory.recommended_daily_rate).toLocaleString()}</strong>
                </div>
                <div>
                  Affordability Cap: <strong className="font-mono text-slate-900">₹{Number(deleteConfirmCategory.max_daily_rate).toLocaleString()}</strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Note: Vendors registered under this specialty will retain their profile records, but this category will no longer appear in public filters or registration forms.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCategory(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCategory}
                onClick={() => handleDeleteCategory(deleteConfirmCategory.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeletingCategory ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Transaction Receipt Modal for Bookings */}
      <ReceiptModal
        isOpen={Boolean(receiptModalBookingId)}
        bookingId={receiptModalBookingId}
        token={token}
        onClose={() => setReceiptModalBookingId(null)}
      />

      {/* Official Listing Deposit Receipt Modal for Vendors */}
      <ReceiptModal
        isOpen={Boolean(receiptModalVendorId)}
        vendorId={receiptModalVendorId}
        token={token}
        onClose={() => setReceiptModalVendorId(null)}
      />
    </main>
  );
}