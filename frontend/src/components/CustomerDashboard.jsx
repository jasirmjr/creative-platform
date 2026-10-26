import React, { useState, useEffect } from 'react';
import ProfessionalDetailModal from './ProfessionalDetailModal';
import ReviewModal from './ReviewModal';
import PaymentModal from './PaymentModal';
import ComplaintModal from './ComplaintModal';
import ReceiptModal from './ReceiptModal';
import ReplacementModal from './ReplacementModal';
import DeliverablesVaultModal from './DeliverablesVaultModal';
import { getSocket } from '../utils/socket';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CustomerDashboard({
  user,
  token: propToken,
  onOpenAuth,
  onBackToMarketplace,
  onAddToCart,
  onOpenCart,
  onOpenChat,
}) {
  // Navigation & Tabs
  const [mainTab, setMainTab] = useState('vendors'); // 'vendors' | 'projects'
  const [activeFilter, setActiveFilter] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  // Data States
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [myReviews, setMyReviews] = useState([]);

  // Interaction States
  const [payingId, setPayingId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [paymentModalBooking, setPaymentModalBooking] = useState(null);
  const [paymentModalType, setPaymentModalType] = useState('advance');
  const [notification, setNotification] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedReviewBooking, setSelectedReviewBooking] = useState(null);
  const [complaintModalBooking, setComplaintModalBooking] = useState(null);
  const [customerComplaints, setCustomerComplaints] = useState([]);
  const [receiptModalBooking, setReceiptModalBooking] = useState(null);
  const [replacementModalBooking, setReplacementModalBooking] = useState(null);
  const [deliverablesModalBooking, setDeliverablesModalBooking] = useState(null);
  const [balanceReminderAlert, setBalanceReminderAlert] = useState(null);

  const token = propToken || sessionStorage.getItem('token');

  // Load Customer Complaints
  const fetchCustomerComplaints = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/complaints/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCustomerComplaints(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load customer complaints:', err);
    }
  };

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
      if (data.success && Array.isArray(data.data)) {
        const activeOnly = data.data.filter(
          (v) => !v.is_deleted && v.availability_status !== 'unavailable'
        );
        setVendors(activeOnly);
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
    fetchCustomerComplaints();
  }, [token]);

  // Real-time balance payment reminder listener
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    if (!socket) return;

    const handleBalanceReminder = (notif) => {
      setBalanceReminderAlert(notif);
      fetchCustomerBookings();
    };

    socket.on('balance_reminder_notification', handleBalanceReminder);
    return () => {
      socket.off('balance_reminder_notification', handleBalanceReminder);
    };
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

  // Mark Booking as Completed (Client confirms shoot / deliverables delivered)
  const handleMarkCompleted = async (bookingId) => {
    if (!window.confirm('Confirm that the creative partner has completed the shoot and delivered the work?')) return;
    setUpdatingStatusId(bookingId);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete project');

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed' } : b))
      );
      setNotification({
        type: 'success',
        message: 'Project successfully marked as completed! You can now share a verified review.',
      });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Handle Combined Crew Bundle Payment via Official Razorpay Checkout
  const handleCrewBundlePayment = async (bundleId, paymentType = 'advance') => {
    setPayingId(bundleId);
    setNotification(null);

    try {
      // 1. Create official Razorpay order on server
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/crew-bundle/${bundleId}/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_type: paymentType }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.message || 'Failed to initiate crew payment order.');

      // 2. Load Razorpay Checkout SDK
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        throw new Error('Failed to load Razorpay Checkout SDK. Please check your internet connection.');
      }

      // 3. Launch official live Razorpay checkout popup
      const options = {
        key: orderData.key_id,
        amount: orderData.amount_paise,
        currency: orderData.currency || 'INR',
        name: 'Creative Platform',
        description: `Crew Production: ${orderData.bundle_name || 'Production Shoot'} (${paymentType === 'advance' ? '30% Advance Deposit' : 'Balance Settlement'})`,
        order_id: orderData.order_id,
        prefill: {
          name: orderData.customer?.name || user?.name || '',
          email: orderData.customer?.email || user?.email || '',
          contact: orderData.customer?.mobile || user?.mobile || '',
        },
        theme: {
          color: '#2563eb',
        },
        handler: async function (response) {
          try {
            setPayingId(bundleId);
            const verifyRes = await fetch(`http://127.0.0.1:5000/api/v1/bookings/crew-bundle/${bundleId}/verify-razorpay-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_type: paymentType,
                is_mock: false,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.message || 'Payment signature verification failed.');

            if (verifyData.updated_bookings && verifyData.updated_bookings.length > 0) {
              setBookings((prev) =>
                prev.map((b) => {
                  const updated = verifyData.updated_bookings.find((u) => u.id === b.id);
                  return updated ? { ...b, ...updated } : b;
                })
              );
            } else {
              await fetchCustomerBookings();
            }

            setNotification({
              type: 'success',
              message: `Razorpay payment of ₹${Number(verifyData.total_amount_paid).toLocaleString()} verified! Credited separately to crew specialist accounts. (Ref: ${response.razorpay_payment_id})`,
            });
          } catch (verifyErr) {
            setNotification({ type: 'error', message: verifyErr.message });
          } finally {
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPayingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
      setPayingId(null);
    }
  };

  // Handle Replacement Success
  const handleReplacementSuccess = (updatedBooking, message) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b))
    );
    setNotification({
      type: 'success',
      message: message || 'Vendor successfully swapped into your crew!',
    });
    fetchCustomerBookings();
  };

  // Group bookings: multi-vendor crew bundles are combined into a single master project
  const groupedProjects = React.useMemo(() => {
    const bundlesMap = new Map();
    const result = [];

    bookings.forEach((b) => {
      if (b.crew_bundle_id) {
        if (!bundlesMap.has(b.crew_bundle_id)) {
          const bundleObj = {
            isBundle: true,
            id: b.crew_bundle_id,
            bundleId: b.crew_bundle_id,
            bundleName: b.crew_bundle_name || b.project_name || 'Production Crew Project',
            members: [],
          };
          bundlesMap.set(b.crew_bundle_id, bundleObj);
          result.push(bundleObj);
        }
        bundlesMap.get(b.crew_bundle_id).members.push(b);
      } else {
        result.push({
          isBundle: false,
          id: b.id,
          booking: b,
        });
      }
    });

    // Aggregate statistics and workflow flags for bundles
    bundlesMap.forEach((bundle) => {
      const members = bundle.members;
      bundle.totalAmount = members.reduce((sum, m) => sum + (Number(m.total_amount) || 0), 0);
      bundle.paidAmount = members.reduce((sum, m) => sum + (Number(m.paid_amount) || 0), 0);
      bundle.advanceAmount = members.reduce(
        (sum, m) => sum + (Number(m.advance_amount) || Math.round((Number(m.total_amount) || 0) * 0.3)),
        0
      );
      bundle.startDate = members[0]?.start_date;
      bundle.endDate = members[0]?.end_date;
      bundle.duration = members[0]?.duration || '1 Day';
      bundle.projectLocation = members[0]?.project_location || members[0]?.vendor_location || 'India';

      // Status aggregations
      bundle.hasDeclined = members.some((m) => m.status === 'rejected' || m.status === 'cancelled');
      bundle.declinedMembers = members.filter((m) => m.status === 'rejected' || m.status === 'cancelled');
      bundle.allConfirmed = members.every((m) => m.status === 'confirmed' || m.status === 'completed');
      bundle.allCompleted = members.every((m) => m.status === 'completed');
      bundle.underReviewMembers = members.filter(
        (m) => m.status === 'under_review' || m.status === 'availability_check' || m.status === 'new_request'
      );
      bundle.approvedMembers = members.filter(
        (m) => m.status === 'approved' || m.status === 'payment_pending'
      );
      bundle.hasUnderReview = bundle.underReviewMembers.length > 0;

      // Payable advance: ONLY approved members where paid < advance (strictly disallows under_review)
      bundle.payableAdvanceAmount = members.reduce((sum, m) => {
        const total = Number(m.total_amount) || 0;
        const paid = Number(m.paid_amount) || 0;
        const adv = Number(m.advance_amount) || Math.round(total * 0.3);
        if ((m.status === 'approved' || m.status === 'payment_pending') && paid < adv) {
          return sum + (adv - paid);
        }
        return sum;
      }, 0);

      bundle.isReadyForCrewAdvance = !bundle.hasDeclined && !bundle.hasUnderReview && bundle.payableAdvanceAmount > 0;

      // Payable balance: confirmed or completed members not yet paid full total
      bundle.payableBalanceAmount = members.reduce((sum, m) => {
        const total = Number(m.total_amount) || 0;
        const paid = Number(m.paid_amount) || 0;
        if ((m.status === 'confirmed' || m.status === 'completed') && paid < total) {
          return sum + (total - paid);
        }
        return sum;
      }, 0);
    });

    return result;
  }, [bookings]);

  // Project Metrics Calculations
  const underReviewCount = groupedProjects.filter((p) =>
    p.isBundle
      ? p.hasUnderReview
      : p.booking.status === 'under_review' ||
        p.booking.status === 'availability_check' ||
        p.booking.status === 'new_request'
  ).length;

  const paymentPendingCount = groupedProjects.filter((p) =>
    p.isBundle
      ? p.payableAdvanceAmount > 0 || p.payableBalanceAmount > 0
      : p.booking.status === 'approved' || p.booking.status === 'payment_pending'
  ).length;

  const confirmedCount = groupedProjects.filter((p) =>
    p.isBundle
      ? p.allConfirmed
      : p.booking.status === 'confirmed' || p.booking.status === 'in_progress'
  ).length;

  const completedCount = groupedProjects.filter((p) =>
    p.isBundle ? p.allCompleted : p.booking.status === 'completed'
  ).length;

  const rejectedCount = groupedProjects.filter((p) =>
    p.isBundle
      ? p.hasDeclined
      : p.booking.status === 'rejected' || p.booking.status === 'cancelled'
  ).length;

  // Filter Projects
  const filteredProjects = groupedProjects.filter((item) => {
    if (activeFilter === 'review') {
      if (item.isBundle) {
        if (!item.hasUnderReview) return false;
      } else {
        if (
          !(
            item.booking.status === 'under_review' ||
            item.booking.status === 'availability_check' ||
            item.booking.status === 'new_request'
          )
        )
          return false;
      }
    } else if (activeFilter === 'payment') {
      if (item.isBundle) {
        if (item.payableAdvanceAmount <= 0 && item.payableBalanceAmount <= 0) return false;
      } else {
        if (!(item.booking.status === 'approved' || item.booking.status === 'payment_pending')) return false;
      }
    } else if (activeFilter === 'confirmed') {
      if (item.isBundle) {
        if (!item.allConfirmed) return false;
      } else {
        if (!(item.booking.status === 'confirmed' || item.booking.status === 'in_progress')) return false;
      }
    } else if (activeFilter === 'completed') {
      if (item.isBundle) {
        if (!item.allCompleted) return false;
      } else {
        if (item.booking.status !== 'completed') return false;
      }
    } else if (activeFilter === 'declined') {
      if (item.isBundle) {
        if (!item.hasDeclined) return false;
      } else {
        if (!(item.booking.status === 'rejected' || item.booking.status === 'cancelled')) return false;
      }
    }

    if (projectSearch.trim()) {
      const q = projectSearch.toLowerCase();
      if (item.isBundle) {
        const matchBundleName = (item.bundleName || '').toLowerCase().includes(q);
        const matchId = (item.bundleId || '').toLowerCase().includes(q);
        const matchAnyMember = item.members.some((m) => {
          return (
            (m.project_name || '').toLowerCase().includes(q) ||
            (m.business_name || '').toLowerCase().includes(q) ||
            (m.provider_name || '').toLowerCase().includes(q) ||
            (m.crew_role || '').toLowerCase().includes(q) ||
            (m.category_name || '').toLowerCase().includes(q) ||
            (m.vendor_location || m.project_location || '').toLowerCase().includes(q) ||
            (m.id || '').toLowerCase().includes(q)
          );
        });
        if (!matchBundleName && !matchId && !matchAnyMember) return false;
      } else {
        const b = item.booking;
        const matchProject = (b.project_name || b.resource_title || '').toLowerCase().includes(q);
        const matchVendor = (b.business_name || b.provider_name || '').toLowerCase().includes(q);
        const matchCategory = (b.category_name || '').toLowerCase().includes(q);
        const matchLocation = (b.vendor_location || b.project_location || '').toLowerCase().includes(q);
        const matchId = (b.id || '').toLowerCase().includes(q);
        if (!matchProject && !matchVendor && !matchCategory && !matchLocation && !matchId) return false;
      }
    }

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
          <span>Approved Creative Talent & Studios</span>
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
          <span>My Projects & Bookings</span>
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
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Header: Studio Avatar, Name, Verified Badge & Location */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-bold text-base flex items-center justify-center shrink-0 overflow-hidden">
                          {vendor.profile_image ? (
                            <img src={vendor.profile_image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (vendor.business_name || 'V').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{vendor.business_name}</h3>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                              ✓ Approved
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Lead: <strong className="text-slate-700">{vendor.owner_name}</strong>
                            {vendor.category_name && <span className="text-slate-400"> &bull; {vendor.category_name}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-amber-500 font-bold text-xs flex items-center gap-0.5">
                          ★ {vendor.avg_rating || '5.0'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({vendor.review_count || 0}) &bull; {vendor.location || 'India'}
                        </span>
                      </div>
                    </div>

                    {/* Bio Snippet */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 min-h-[36px]">
                      {vendor.bio || 'Verified creative partner providing professional production services.'}
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
                              className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-medium border border-slate-200/60"
                            >
                              {skill.trim()}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Pricing and Action Buttons Footer */}
                  <div className="pt-4 mt-5 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Standard Rate</span>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          ₹{Number(vendor.pricing || 15000).toLocaleString()}
                          <span className="text-xs text-slate-500 font-normal">/{vendor.pricing_unit || 'day'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenChat?.({ vendorId: vendor.id })}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition-colors cursor-pointer"
                          title="Direct chat with Studio"
                        >
                          Message
                        </button>

                        <button
                          type="button"
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
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Profile
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
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
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>🛒</span>
                      <span>Book Production Hold</span>
                    </button>
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
          {/* Real-time Studio Balance Payment Reminder Alert */}
          {balanceReminderAlert && (
            <div className="p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔔</span>
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">
                    Balance Payment Requested by {balanceReminderAlert.vendor_name || 'Creative Studio'}
                  </h4>
                  <p className="text-amber-800 mt-0.5">
                    {balanceReminderAlert.message || `Production is completed. Please settle the remaining balance of ₹${Number(balanceReminderAlert.balance_due || 0).toLocaleString()} to release final escrow.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    const target = bookings.find((b) => b.id === balanceReminderAlert.booking_id);
                    if (target) {
                      setPaymentModalBooking(target);
                      setPaymentModalType('balance');
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Settle Balance (₹{Number(balanceReminderAlert.balance_due || 0).toLocaleString()}) &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceReminderAlert(null)}
                  className="w-8 h-8 rounded-xl bg-white/70 hover:bg-white text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center border border-amber-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Projects', count: groupedProjects.length },
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
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
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
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              {/* Table Sub-Header Controls */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Project Bookings
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    Showing {filteredProjects.length} of {groupedProjects.length}
                  </span>
                </div>
                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Search project, studio, location..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Bookings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="py-3.5 px-4">Project & Service</th>
                      <th className="py-3.5 px-4">Creative Partner</th>
                      <th className="py-3.5 px-4">Shoot Dates</th>
                      <th className="py-3.5 px-4">Budget & Payments</th>
                      <th className="py-3.5 px-4">Workflow Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProjects.map((item) => {
                      if (item.isBundle) {
                        const isExpanded = expandedBookingId === item.bundleId;
                        return (
                          <React.Fragment key={item.bundleId}>
                            <tr className={`transition-colors border-l-4 ${item.hasDeclined ? 'border-l-rose-500 bg-rose-50/15' : 'border-l-blue-500'} ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'}`}>
                              {/* Project & Service */}
                              <td className="py-4 px-4 align-top">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full border border-blue-200">
                                    Crew Production
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    {item.members.length} Specialists
                                  </span>
                                  {item.hasDeclined && (
                                    <span className="text-[9px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-200">
                                      Action Required
                                    </span>
                                  )}
                                </div>
                                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {item.bundleName}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    #{item.bundleId.slice(0, 12)}
                                  </span>
                                  <span className="text-slate-300">&bull;</span>
                                  <span className="text-[10px] text-slate-500">
                                    {item.projectLocation}
                                  </span>
                                </div>
                              </td>

                              {/* Creative Partner Roster Preview */}
                              <td className="py-4 px-4 align-top">
                                <div className="space-y-1.5">
                                  {item.members.map((m) => {
                                    const isDeclined = m.status === 'rejected' || m.status === 'cancelled';
                                    const isApproved = m.status === 'approved' || m.status === 'payment_pending';
                                    const isConfirmed = m.status === 'confirmed' || m.status === 'in_progress';
                                    return (
                                      <div key={m.id} className="flex items-center gap-1.5 text-[11px]">
                                        <span className="font-semibold text-slate-700">
                                          {m.crew_role || m.category_name || 'Specialist'}:
                                        </span>
                                        <span className="text-slate-800 font-medium truncate max-w-[120px]" title={m.business_name || m.provider_name}>
                                          {m.business_name || m.provider_name || 'Studio'}
                                        </span>
                                        {isDeclined ? (
                                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded whitespace-nowrap">
                                            Declined
                                          </span>
                                        ) : isConfirmed ? (
                                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded whitespace-nowrap">
                                            Locked
                                          </span>
                                        ) : isApproved ? (
                                          <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded whitespace-nowrap">
                                            Approved
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded whitespace-nowrap">
                                            Review
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* Dates & Duration */}
                              <td className="py-4 px-4 align-top">
                                <div className="text-xs font-semibold text-slate-800">
                                  {item.startDate && item.endDate ? (
                                    <span>
                                      {new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                      {' → '}
                                      {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  ) : (
                                    'Dates Synchronized'
                                  )}
                                </div>
                                <div className="mt-1">
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {item.duration || 'Multi-day Shoot'}
                                  </span>
                                </div>
                              </td>

                              {/* Budget & Payments */}
                              <td className="py-4 px-4 align-top">
                                <div className="font-bold font-mono text-sm text-slate-900">
                                  ₹{item.totalAmount.toLocaleString()}
                                </div>
                                {item.paidAmount >= item.totalAmount && item.totalAmount > 0 ? (
                                  <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                                    ✓ Fully Paid
                                  </span>
                                ) : item.paidAmount > 0 ? (
                                  <div className="mt-1 space-y-0.5">
                                    <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                      ✓ Paid: ₹{item.paidAmount.toLocaleString()}
                                    </span>
                                    <div className="text-[10px] text-slate-500">
                                      Due: <strong className="font-mono text-slate-700">₹{(item.totalAmount - item.paidAmount).toLocaleString()}</strong>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-1 space-y-0.5">
                                    <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      Combined Advance
                                    </span>
                                    <div className="text-[10px] text-slate-500">
                                      30%: <strong className="font-mono text-slate-700">₹{item.advanceAmount.toLocaleString()}</strong>
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Workflow Status */}
                              <td className="py-4 px-4 align-top">
                                <div>
                                  {item.hasDeclined ? (
                                    <div>
                                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 inline-block">
                                        Step 2/6: Role Declined ({item.declinedMembers.length})
                                      </span>
                                      <span className="text-[10px] text-rose-800 font-medium block mt-1">
                                        Re-arrange partner below
                                      </span>
                                    </div>
                                  ) : item.allConfirmed ? (
                                    <div>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-block">
                                        Step 4/6: Confirmed &amp; Locked
                                      </span>
                                      <span className="text-[10px] text-slate-500 block mt-1">
                                        All partners confirmed
                                      </span>
                                    </div>
                                  ) : item.allCompleted ? (
                                    <div>
                                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 inline-block">
                                        Step 6/6: Production Completed
                                      </span>
                                    </div>
                                  ) : item.isReadyForCrewAdvance ? (
                                    <div>
                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 inline-block animate-pulse">
                                        Step 3/6: Terms Approved
                                      </span>
                                      <span className="text-[10px] text-slate-500 block mt-1">
                                        Awaiting advance deposit
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 inline-block">
                                        Step 2/6: In Review
                                      </span>
                                      <span className="text-[10px] text-slate-500 block mt-1">
                                        {item.hasUnderReview ? `${item.underReviewMembers.length} partner(s) reviewing shoot` : 'Partners reviewing shoot'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-4 align-top text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                  {/* If any role is declined, show immediate 1-click Re-arrange Role button */}
                                  {item.hasDeclined && item.declinedMembers.length > 0 && (
                                    <button
                                      onClick={() => setReplacementModalBooking(item.declinedMembers[0])}
                                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all flex items-center gap-1"
                                    >
                                      <span>Re-arrange Declined Role ↗</span>
                                    </button>
                                  )}

                                  {/* If under review, show awaiting notice instead of pay button */}
                                  {!item.hasDeclined && item.hasUnderReview && (
                                    <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl inline-block">
                                      Awaiting Vendor Review
                                    </span>
                                  )}

                                  {/* Combined Advance Payment - Strictly unlocked only in Step 3 after all partners approve */}
                                  {!item.hasDeclined && item.isReadyForCrewAdvance && item.payableAdvanceAmount > 0 && (
                                    <button
                                      onClick={() => handleCrewBundlePayment(item.bundleId, 'advance')}
                                      disabled={payingId === item.bundleId}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all disabled:opacity-50"
                                    >
                                      {payingId === item.bundleId ? 'Processing...' : `Pay Crew Advance (₹${item.payableAdvanceAmount.toLocaleString()})`}
                                    </button>
                                  )}

                                  {/* Combined Balance Settlement */}
                                  {item.allConfirmed && item.payableBalanceAmount > 0 && (
                                    <button
                                      onClick={() => handleCrewBundlePayment(item.bundleId, 'balance')}
                                      disabled={payingId === item.bundleId}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all disabled:opacity-50"
                                    >
                                      {payingId === item.bundleId ? 'Processing...' : `Settle Crew Balance (₹${item.payableBalanceAmount.toLocaleString()})`}
                                    </button>
                                  )}

                                  <div className="flex flex-wrap items-center justify-end gap-1.5 mt-0.5">
                                    {/* Expand Crew Roster Toggle */}
                                    <button
                                      type="button"
                                      onClick={() => setExpandedBookingId(isExpanded ? null : item.bundleId)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <span>{isExpanded ? 'Hide Roster' : `Crew Roster (${item.members.length})`}</span>
                                      <span>{isExpanded ? '▲' : '▼'}</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Crew Sub-Roster Sub-Table */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90 border-b border-slate-200">
                                <td colSpan={6} className="p-4 sm:p-6">
                                  <div className="space-y-4">
                                    {/* Crew Production Header Info */}
                                    <div className="p-4 bg-white border border-blue-200 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full border border-blue-200">
                                            Multi-Talent Production Crew
                                          </span>
                                          <span className="font-mono text-xs text-slate-400">
                                            Bundle #{item.bundleId}
                                          </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-sm mt-1">
                                          {item.bundleName}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          Synchronized Shoot Schedule: <strong className="text-slate-800">{item.startDate} → {item.endDate}</strong> &bull; Total Budget: <strong className="text-slate-900 font-mono">₹{item.totalAmount.toLocaleString()}</strong>
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {!item.hasDeclined && item.isReadyForCrewAdvance && item.payableAdvanceAmount > 0 && (
                                          <button
                                            onClick={() => handleCrewBundlePayment(item.bundleId, 'advance')}
                                            disabled={payingId === item.bundleId}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                                          >
                                            {payingId === item.bundleId ? 'Processing...' : `Pay Combined Advance (₹${item.payableAdvanceAmount.toLocaleString()})`}
                                          </button>
                                        )}
                                        {!item.hasDeclined && item.hasUnderReview && (
                                          <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                                            Awaiting Creative Partner Review
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Conflict Alert Banner if any role was declined */}
                                    {item.hasDeclined && (
                                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                                        <div>
                                          <strong className="font-bold block text-rose-950">
                                            Work Conflict Alert: A Creative Partner Declined This Shoot Slot
                                          </strong>
                                          <p className="text-rose-800 text-[11px] mt-0.5">
                                            To keep your shoot dates synchronized and prevent production delays, click &ldquo;Find Replacement&rdquo; next to the declined role below to swap a vetted, available partner on the exact same dates.
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Crew Specialist Roster Mini-Table */}
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                          Crew Specialist Roster &amp; Payment Ledger
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          Each specialist receives independent ledger credits and receipts
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-500">
                                              <th className="py-2.5 px-3">Role &amp; Partner</th>
                                              <th className="py-2.5 px-3">Location</th>
                                              <th className="py-2.5 px-3">Fee &amp; Deposit</th>
                                              <th className="py-2.5 px-3">Status</th>
                                              <th className="py-2.5 px-3 text-right">Role Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {item.members.map((m) => {
                                              const isMemberDeclined = m.status === 'rejected' || m.status === 'cancelled';
                                              const isMemberPayable = m.status === 'approved' || m.status === 'payment_pending';
                                              const isMemberConfirmed = m.status === 'confirmed';
                                              const isMemberCompleted = m.status === 'completed';
                                              const mTotal = Number(m.total_amount) || 0;
                                              const mPaid = Number(m.paid_amount) || 0;
                                              const mAdvance = Number(m.advance_amount) || Math.round(mTotal * 0.3);

                                              return (
                                                <tr key={m.id} className={`hover:bg-slate-50/70 ${isMemberDeclined ? 'bg-rose-50/40' : ''}`}>
                                                  <td className="py-3 px-3">
                                                    <div className="font-bold text-slate-900 text-xs">
                                                      {m.crew_role || m.category_name || 'Creative Specialist'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-600 font-medium">
                                                      {m.business_name || m.provider_name || 'Creative Studio'}
                                                    </div>
                                                    <div className="text-[9px] font-mono text-slate-400">
                                                      #{m.id.slice(0, 8)}
                                                    </div>
                                                  </td>

                                                  <td className="py-3 px-3 text-slate-600 text-[11px]">
                                                    {m.vendor_location || m.project_location || 'Pan-India'}
                                                  </td>

                                                  <td className="py-3 px-3 font-mono">
                                                    <div className="font-bold text-slate-900">
                                                      ₹{mTotal.toLocaleString()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-sans">
                                                      {mPaid >= mTotal ? (
                                                        <span className="text-emerald-700 font-bold">Paid in full</span>
                                                      ) : mPaid > 0 ? (
                                                        <span className="text-blue-700 font-bold">Paid: ₹{mPaid.toLocaleString()}</span>
                                                      ) : (
                                                        <span>Advance: ₹{mAdvance.toLocaleString()}</span>
                                                      )}
                                                    </div>
                                                  </td>

                                                  <td className="py-3 px-3">
                                                    {isMemberDeclined ? (
                                                      <div>
                                                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full inline-block">
                                                          Step 2/6: Declined
                                                        </span>
                                                        {m.rejection_reason && (
                                                          <p className="text-[11px] text-rose-900 italic mt-1 max-w-xs">
                                                            &ldquo;{m.rejection_reason}&rdquo;
                                                          </p>
                                                        )}
                                                      </div>
                                                    ) : isMemberConfirmed ? (
                                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block">
                                                        Step 4/6: Confirmed &amp; Locked
                                                      </span>
                                                    ) : isMemberCompleted ? (
                                                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full inline-block">
                                                        Step 6/6: Completed
                                                      </span>
                                                    ) : isMemberPayable ? (
                                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full inline-block">
                                                        Step 3/6: Terms Approved
                                                      </span>
                                                    ) : (
                                                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block">
                                                        Step 2/6: In Review
                                                      </span>
                                                    )}
                                                  </td>

                                                  <td className="py-3 px-3 text-right">
                                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                      {/* Find Replacement Button for Declined Specialist */}
                                                      {isMemberDeclined && (
                                                        <button
                                                          onClick={() => setReplacementModalBooking(m)}
                                                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
                                                        >
                                                          Find Replacement ↗
                                                        </button>
                                                      )}

                                                      {/* Individual Advance Payment - Only unlocked in Step 3 after partner acceptance */}
                                                      {isMemberPayable && (
                                                        <button
                                                          onClick={() => {
                                                            setPaymentModalBooking(m);
                                                            setPaymentModalType('advance');
                                                          }}
                                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
                                                        >
                                                          Pay Advance
                                                        </button>
                                                      )}

                                                      {/* Under Review Notice */}
                                                      {!isMemberDeclined && !isMemberConfirmed && !isMemberCompleted && !isMemberPayable && (
                                                        <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                                          In Review
                                                        </span>
                                                      )}

                                                      {/* Chat Partner */}
                                                      <button
                                                        type="button"
                                                        onClick={() => onOpenChat?.({ vendorId: m.vendor_id, bookingId: m.id })}
                                                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                                        title="Chat with this specialist"
                                                      >
                                                        Chat
                                                      </button>

                                                      {/* Receipt Button */}
                                                      {mPaid > 0 && (
                                                        <button
                                                          type="button"
                                                          onClick={() => setReceiptModalBooking(m)}
                                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer"
                                                          title="View & print official receipt for this specialist"
                                                        >
                                                          Receipt
                                                        </button>
                                                      )}

                                                      {/* Media Vault & Deliverables Review */}
                                                      {(isMemberConfirmed || m.status === 'deliverables_submitted' || isMemberCompleted) && (
                                                        <button
                                                          type="button"
                                                          onClick={() => setDeliverablesModalBooking(m)}
                                                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                                                            m.status === 'deliverables_submitted'
                                                              ? 'bg-purple-600 text-white border-purple-700 animate-pulse'
                                                              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                                          }`}
                                                          title="Open Media & Deliverables Vault"
                                                        >
                                                          <span>📦 {m.status === 'deliverables_submitted' ? 'Review Vault' : 'Vault'}</span>
                                                        </button>
                                                      )}

                                                      {/* Mark Completed */}
                                                      {isMemberConfirmed && (
                                                        <button
                                                          onClick={() => handleMarkCompleted(m.id)}
                                                          disabled={updatingStatusId === m.id}
                                                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
                                                        >
                                                          Complete
                                                        </button>
                                                      )}

                                                      {/* Settle Balance for Completed Member */}
                                                      {isMemberCompleted && mPaid < mTotal && (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setPaymentModalBooking(m);
                                                            setPaymentModalType('balance');
                                                          }}
                                                          className={`px-2.5 py-1 text-white text-[10px] font-bold rounded-lg shadow-xs cursor-pointer whitespace-nowrap transition-all flex items-center gap-1 ${
                                                            m.last_balance_reminder_at
                                                              ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 animate-pulse'
                                                              : 'bg-blue-600 hover:bg-blue-700'
                                                          }`}
                                                          title={`Settle remaining balance of ₹${(mTotal - mPaid).toLocaleString()} for ${m.crew_role || 'this specialist'}`}
                                                        >
                                                          {m.last_balance_reminder_at && <span>🔔</span>}
                                                          <span>Settle Balance (₹{(mTotal - mPaid).toLocaleString()})</span>
                                                        </button>
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }

                      // Standalone Single-Booking Row
                      const b = item.booking;
                      const stage = getStageNumber(b.status);
                      const isPayable = b.status === 'approved' || b.status === 'payment_pending';
                      const isExpanded = expandedBookingId === b.id;
                      const existingReview = myReviews.find((r) => r.booking_id === b.id);

                      return (
                        <React.Fragment key={b.id}>
                          <tr className={`transition-colors ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'}`}>
                            {/* Project & Service */}
                            <td className="py-4 px-4 align-top">
                              {b.crew_bundle_id && (
                                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                                    Crew Production
                                  </span>
                                  {b.crew_role && (
                                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                      Role: {b.crew_role}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                {b.project_name || b.resource_title}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                                  {b.category_name || 'Creative Service'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{b.id.slice(0, 8)}
                                </span>
                              </div>
                            </td>

                            {/* Creative Partner */}
                            <td className="py-4 px-4 align-top">
                              <div className="font-semibold text-slate-800 text-xs">
                                {b.business_name || b.provider_name || 'Creative Studio'}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                <span>{b.vendor_location || b.project_location || 'India'}</span>
                              </div>
                              {b.provider_name && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Lead: {b.provider_name}
                                </div>
                              )}
                            </td>

                            {/* Dates & Duration */}
                            <td className="py-4 px-4 align-top">
                              <div className="text-xs font-semibold text-slate-800">
                                <span>
                                  {new Date(b.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  {' → '}
                                  {new Date(b.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <div className="mt-1">
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {b.duration || '1 Day'}
                                </span>
                              </div>
                            </td>

                            {/* Budget & Payments */}
                            <td className="py-4 px-4 align-top">
                              <div className="font-bold font-mono text-sm text-slate-900">
                                ₹{Number(b.total_amount).toLocaleString()}
                              </div>
                              {b.payment_status === 'paid' ? (
                                <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                                  ✓ Fully Paid
                                </span>
                              ) : b.payment_status === 'advance_paid' ? (
                                <div className="mt-1 space-y-0.5">
                                  <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    ✓ Advance (₹{Number(b.paid_amount || 0).toLocaleString()})
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    Due: <strong className="font-mono text-slate-700">₹{(Number(b.total_amount) - Number(b.paid_amount || 0)).toLocaleString()}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 space-y-0.5">
                                  <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Deposit Due
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    30%: <strong className="font-mono text-slate-700">₹{Number(b.advance_amount || Math.round(Number(b.total_amount) * 0.3)).toLocaleString()}</strong>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Workflow Status */}
                            <td className="py-4 px-4 align-top">
                              <div>
                                {stage === 1 && (
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                    Step 1/6: Submitted
                                  </span>
                                )}
                                {stage === 2 && (
                                  b.status === 'rejected' ? (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                      Step 2/6: Declined
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      Step 2/6: In Review
                                    </span>
                                  )
                                )}
                                {stage === 3 && (
                                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                                    Step 3/6: Terms Approved
                                  </span>
                                )}
                                {stage === 4 && (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                    Step 4/6: Payment Verified
                                  </span>
                                )}
                                {stage === 5 && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                    Step 5/6: In Progress
                                  </span>
                                )}
                                {stage === 6 && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Step 6/6: Completed
                                  </span>
                                )}
                              </div>

                              <span
                                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border inline-block mt-1.5 ${
                                  b.status === 'confirmed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : b.status === 'deliverables_submitted'
                                    ? 'bg-purple-100 text-purple-900 border-purple-300 animate-pulse font-black'
                                    : b.status === 'approved' || b.status === 'payment_pending'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-black'
                                    : b.status === 'completed'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : b.status === 'rejected' || b.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {b.status === 'deliverables_submitted'
                                  ? '📦 Deliverables Ready'
                                  : b.status === 'rejected'
                                  ? 'Declined'
                                  : b.status.replace('_', ' ')}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 align-top text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {b.status === 'rejected' && (
                                  <button
                                    onClick={() => setReplacementModalBooking(b)}
                                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all flex items-center gap-1"
                                  >
                                    <span>Find Replacement ↗</span>
                                  </button>
                                )}

                                {isPayable && (
                                  <button
                                    onClick={() => {
                                      setPaymentModalBooking(b);
                                      setPaymentModalType('advance');
                                    }}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all"
                                  >
                                    <span>Pay Advance (₹{Number(b.advance_amount || Math.round(Number(b.total_amount) * 0.3)).toLocaleString()})</span>
                                  </button>
                                )}

                                {/* Deliverables & Media Vault */}
                                {(b.status === 'confirmed' || b.status === 'deliverables_submitted' || b.status === 'completed') && (
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setDeliverablesModalBooking(b)}
                                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1.5 ${
                                        b.status === 'deliverables_submitted'
                                          ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700 animate-pulse'
                                          : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                      }`}
                                      title="Open Project Deliverables & Media Vault"
                                    >
                                      <span>📦</span>
                                      <span>{b.status === 'deliverables_submitted' ? 'Review Deliverables' : 'Media Vault'}</span>
                                    </button>
                                  </div>
                                )}

                                {b.status === 'confirmed' && (
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleMarkCompleted(b.id)}
                                      disabled={updatingStatusId === b.id}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50 transition-all"
                                    >
                                      <span>{updatingStatusId === b.id ? 'Completing...' : 'Mark Completed'}</span>
                                    </button>
                                    {Number(b.paid_amount || 0) < Number(b.total_amount) && (
                                      <button
                                        onClick={() => {
                                          setPaymentModalBooking(b);
                                          setPaymentModalType('balance');
                                        }}
                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                                      >
                                        <span>Settle (₹{(Number(b.total_amount) - Number(b.paid_amount || 0)).toLocaleString()})</span>
                                      </button>
                                    )}
                                  </div>
                                )}

                                {b.status === 'completed' && (
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    {Number(b.paid_amount || 0) < Number(b.total_amount) && (
                                      <button
                                        onClick={() => {
                                          setPaymentModalBooking(b);
                                          setPaymentModalType('balance');
                                        }}
                                        className={`px-3 py-1.5 text-white text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-all shadow-xs flex items-center gap-1.5 ${
                                          b.last_balance_reminder_at
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 animate-pulse font-bold'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                      >
                                        {b.last_balance_reminder_at && <span>🔔</span>}
                                        <span>Settle Balance (₹{(Number(b.total_amount) - Number(b.paid_amount || 0)).toLocaleString()})</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setSelectedReviewBooking(b)}
                                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all"
                                    >
                                      <span>{existingReview ? 'Update Review' : 'Add Review'}</span>
                                    </button>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-end gap-1.5 mt-0.5">
                                  {/* Dispute / Complaint Trigger */}
                                  {(() => {
                                    const activeComp = customerComplaints.find((c) => c.booking_id === b.id);
                                    if (activeComp) {
                                      const isSettled = activeComp.settlement_agreed || activeComp.status === 'resolved';
                                      const isExpired = activeComp.is_expired;
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => setComplaintModalBooking(b)}
                                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer shadow-2xs whitespace-nowrap ${
                                            isSettled
                                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : isExpired
                                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                          }`}
                                          title="View dispute resolution center and timeline"
                                        >
                                          <span>
                                            {isSettled
                                              ? 'Dispute: Settled'
                                              : isExpired
                                              ? 'Dispute: In Arbitration'
                                              : `Dispute: ${activeComp.days_remaining ?? 7}d SLA left`}
                                          </span>
                                        </button>
                                      );
                                    }
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setComplaintModalBooking(b)}
                                        className="px-2 py-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 text-[10px] font-semibold rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer whitespace-nowrap"
                                        title="Report issue or file dispute with platform admin"
                                      >
                                        <span>Report Issue</span>
                                      </button>
                                    );
                                  })()}

                                  <button
                                    type="button"
                                    onClick={() => onOpenChat?.({ vendorId: b.vendor_id, bookingId: b.id })}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                                    title="Chat with Creative Studio regarding this project"
                                  >
                                    <span>Chat Studio</span>
                                  </button>

                                  {Number(b.paid_amount || 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setReceiptModalBooking(b)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                      title="View & print official transaction receipt"
                                    >
                                      <span>Receipt</span>
                                    </button>
                                  )}

                                  {/* Expand Pipeline & Details Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Details'}</span>
                                    <span>{isExpanded ? '▲' : '▼'}</span>
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Sub-Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                              <td colSpan={6} className="p-4 sm:p-6">
                                <div className="space-y-4">
                                  {/* Multi-Talent Crew Bundle Callout */}
                                  {b.crew_bundle_id && (
                                    <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-blue-950">
                                          Crew Production: {b.crew_bundle_name || b.project_name}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                          ID: #{b.crew_bundle_id}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-blue-900 leading-relaxed">
                                        This booking is synchronized as part of your multi-talent production crew under designated role: <strong>{b.crew_role || 'Creative Specialist'}</strong>.
                                      </p>
                                    </div>
                                  )}

                                  {/* Status Callout Banners */}
                                  {b.status === 'confirmed' && (
                                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                      <div>
                                        <strong className="font-bold text-blue-950 block">
                                          Production Confirmed & Schedule Locked!
                                        </strong>
                                        <p className="text-blue-800 text-[11px] mt-0.5">
                                          {b.payment_status === 'advance_paid'
                                            ? `Advance deposit of ₹${Number(b.paid_amount || 0).toLocaleString()} verified. Once deliverables are finished, click "Mark Completed".`
                                            : `Payment received in full. Once shoot/deliverables are finished, click "Mark Completed".`}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleMarkCompleted(b.id)}
                                        disabled={updatingStatusId === b.id}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto disabled:opacity-50"
                                      >
                                        Mark Work Completed
                                      </button>
                                    </div>
                                  )}

                                  {(b.status === 'approved' || b.status === 'payment_pending') && (
                                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                      <div>
                                        <strong className="font-bold text-emerald-950 block">
                                          Creative Partner Accepted Your Project!
                                        </strong>
                                        <p className="text-emerald-800 text-[11px] mt-0.5">
                                          Pay the 30% advance deposit of <strong>₹{Number(b.advance_amount || Math.round(Number(b.total_amount) * 0.3)).toLocaleString()}</strong> via Razorpay to lock shoot dates.
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setPaymentModalBooking(b);
                                          setPaymentModalType('advance');
                                        }}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto"
                                      >
                                        Pay Advance Deposit &rarr;
                                      </button>
                                    </div>
                                  )}

                                  {b.status === 'rejected' && (
                                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs shadow-2xs">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="font-bold text-rose-900">
                                          <span>Booking Request Declined by Partner</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
                                          Not Confirmed
                                        </span>
                                      </div>
                                      <p className="text-xs text-rose-950 font-medium italic mt-2">
                                        &ldquo;{b.rejection_reason || 'The partner is unavailable on requested shoot schedule.'}&rdquo;
                                      </p>
                                      <div className="mt-3">
                                        <button
                                          onClick={() => setReplacementModalBooking(b)}
                                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-all"
                                        >
                                          Find Same-Date Replacement ↗
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {(b.status === 'under_review' || b.status === 'new_request') && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center justify-between gap-3">
                                      <div className="text-amber-900 font-medium">
                                        Shoot request sent to <strong>{b.business_name || b.provider_name}</strong>. Awaiting creative partner acceptance.
                                      </div>
                                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        Pending Review
                                      </span>
                                    </div>
                                  )}

                                  {/* Milestone Pipeline Stepper */}
                                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
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
                                            className={`p-2 rounded-xl border transition-all ${
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
                                              className={`text-[10px] sm:text-[11px] font-semibold leading-tight block ${
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

                                  {/* Specifications & Notes Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-xl p-4 text-xs">
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                        Project Description
                                      </span>
                                      <p className="text-slate-700 leading-relaxed font-medium">
                                        {b.project_description || 'Standard creative production service.'}
                                      </p>
                                    </div>

                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                        Additional Requirements
                                      </span>
                                      <p className="text-slate-700 leading-relaxed font-medium">
                                        {b.additional_requirements || 'None specified.'}
                                      </p>
                                    </div>

                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                        Location & Contact
                                      </span>
                                      <p className="text-slate-700 font-medium">
                                        {b.project_location || b.vendor_location || 'India'}
                                      </p>
                                      {b.provider_mobile && (
                                        <p className="text-slate-500 text-[11px] mt-0.5">
                                          Tel: {b.provider_mobile}
                                        </p>
                                      )}
                                      <p className="text-slate-500 text-[11px] mt-1">
                                        Estimated Budget: <strong className="font-mono text-slate-800">₹{Number(b.estimated_budget || b.total_amount).toLocaleString()}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Review Card for Completed Projects */}
                                  {b.status === 'completed' && (
                                    <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div>
                                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                                          Production Completed & Delivered
                                        </span>
                                        {existingReview ? (
                                          <div className="mt-1">
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
                                          <p className="text-xs text-slate-600 mt-0.5">
                                            Share your verified feedback to help other creators and highlight this provider&apos;s work.
                                          </p>
                                        )}
                                      </div>

                                      <button
                                        onClick={() => setSelectedReviewBooking(b)}
                                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1 whitespace-nowrap self-start sm:self-auto"
                                      >
                                        <span>{existingReview ? 'Update Review' : 'Upload Review'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Professional Profile Detail Modal */}
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

      {/* Review Submission Modal */}
      <ReviewModal
        isOpen={Boolean(selectedReviewBooking)}
        booking={selectedReviewBooking}
        token={token}
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

      {/* Razorpay Advance Booking & Balance Settlement Modal */}
      <PaymentModal
        isOpen={Boolean(paymentModalBooking)}
        booking={paymentModalBooking}
        defaultPaymentType={paymentModalType}
        token={token}
        onClose={() => setPaymentModalBooking(null)}
        onSuccess={(updatedBooking, transaction) => {
          setBookings((prev) =>
            prev.map((b) => (b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b))
          );
          setNotification({
            type: 'success',
            message:
              transaction.payment_status === 'paid'
                ? `Full payment of ₹${Number(transaction.amount).toLocaleString()} verified! Project confirmed.`
                : `Advance deposit of ₹${Number(transaction.amount).toLocaleString()} verified! Booking dates confirmed & locked. (Ref: ${transaction.payment_id})`,
          });
        }}
      />

      {/* Complaint & Dispute Resolution Modal */}
      <ComplaintModal
        isOpen={Boolean(complaintModalBooking)}
        booking={complaintModalBooking}
        token={token}
        user={user}
        onClose={() => setComplaintModalBooking(null)}
        onSuccess={() => {
          fetchCustomerComplaints();
          fetchCustomerBookings();
        }}
      />

      {/* Official Transaction Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(receiptModalBooking)}
        bookingId={receiptModalBooking?.id}
        token={token}
        onClose={() => setReceiptModalBooking(null)}
      />

      {/* Same-Date Replacement Modal */}
      <ReplacementModal
        isOpen={Boolean(replacementModalBooking)}
        booking={replacementModalBooking}
        token={token}
        onClose={() => setReplacementModalBooking(null)}
        onSuccess={handleReplacementSuccess}
      />

      {/* Project Deliverables & Media Vault Modal */}
      <DeliverablesVaultModal
        isOpen={Boolean(deliverablesModalBooking)}
        booking={deliverablesModalBooking}
        user={user}
        token={token}
        onClose={() => setDeliverablesModalBooking(null)}
        onDeliverableUpdated={() => fetchCustomerBookings()}
        onOpenPayment={(b, type) => {
          setPaymentModalBooking(b);
          setPaymentModalType(type || 'balance');
        }}
        onOpenReview={(b) => setSelectedReviewBooking(b)}
        onOpenChat={onOpenChat}
      />
    </main>
  );
}
