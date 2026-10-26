import React, { useState, useEffect, useCallback } from 'react';
import ProfessionalDetailModal from './ProfessionalDetailModal';
import ReviewModal from './ReviewModal';
import PaymentModal from './PaymentModal';
import ComplaintModal from './ComplaintModal';
import ReceiptModal from './ReceiptModal';
import ReplacementModal from './ReplacementModal';
import DeliverablesVaultModal from './DeliverablesVaultModal';
import { getSocket } from '../utils/socket';
import {
  LayoutDashboard,
  MessageSquare,
  Video,
  Sparkles,
  ShoppingCart,
  FolderCheck,
  Scale,
  Headphones,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Users,
  MapPin,
  Star,
  Receipt,
  RotateCcw,
  User,
  Phone,
  Mail,
  Camera,
  Layers,
  FileText,
  Download,
} from 'lucide-react';

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
  onOpenVendorModal,
  onAddToCart,
  onOpenCart,
  onOpenChat,
  cartCount = 0,
  onLogout,
}) {
  // Navigation & Tabs
  const [mainTab, setMainTab] = useState('projects'); // 'projects' | 'vendors' | 'vault' | 'disputes' | 'profile' | 'dashboard'
  const [activeFilter, setActiveFilter] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [expandedBookingId, setExpandedBookingId] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

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
      const res = await fetch('/api/v1/complaints/my', {
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
      const res = await fetch('/api/v1/bookings/my', {
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
      const res = await fetch('/api/v1/vendors/list?status=verified');
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
      const res = await fetch('/api/v1/reviews/my', {
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

  // Fetch Unread Messages
  const fetchUnreadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/chat/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUnreadChatCount(data.client_count || data.unread_count || 0);
      }
    } catch (err) {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    fetchCustomerBookings();
    fetchApprovedVendors();
    fetchMyReviews();
    fetchCustomerComplaints();
    fetchUnreadStats();
  }, [token, fetchUnreadStats]);

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
      const res = await fetch(`/api/v1/bookings/${bookingId}/pay`, {
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
      const res = await fetch(`/api/v1/bookings/${bookingId}/status`, {
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
      const res = await fetch(`/api/v1/bookings/crew-bundle/${bundleId}/create-razorpay-order`, {
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
            const verifyRes = await fetch(`/api/v1/bookings/crew-bundle/${bundleId}/verify-razorpay-payment`, {
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

  const totalInvested = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed' || b.payment_status === 'paid' || b.payment_status === 'advance_paid')
    .reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);

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
    <div className="w-full min-h-[calc(100vh-4rem)] bg-slate-100/60 flex flex-col md:flex-row font-sans">
      {/* 1. Left Sticky Desktop Sidebar Navigation (Vendor Dashboard Style) */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200/90 shrink-0 flex flex-col justify-between sticky top-16 md:h-[calc(100vh-4rem)] md:overflow-y-auto">
        <div className="p-4 space-y-6">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2.5 block">
              Navigation
            </span>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setMainTab('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className={`w-4 h-4 ${mainTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Dashboard</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onOpenChat?.({ scope: 'client' })}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span>Messages & Inbox</span>
                </div>
                {unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                    {unreadChatCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMainTab('projects')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'projects'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Video className={`w-4 h-4 ${mainTab === 'projects' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>My Bookings & Shoots</span>
                </div>
                {bookings.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-white text-[10px] font-bold rounded-full ${
                      paymentPendingCount > 0 ? 'bg-purple-600' : 'bg-blue-600'
                    }`}
                  >
                    {bookings.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMainTab('vendors')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'vendors'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className={`w-4 h-4 ${mainTab === 'vendors' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Explore Talent & Studios</span>
                </div>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                  {vendors.length}
                </span>
              </button>

              {onOpenCart && (
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4 text-slate-400" />
                    <span>Production Hold Cart</span>
                  </div>
                  {cartCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setMainTab('vault')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'vault'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderCheck className={`w-4 h-4 ${mainTab === 'vault' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Deliverables Vault</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('disputes')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'disputes'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scale className={`w-4 h-4 ${mainTab === 'disputes' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Disputes Desk</span>
                </div>
                {customerComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length > 0 && (
                  <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full">
                    {customerComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenChat?.({ scope: 'admin' })}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Headphones className="w-4 h-4 text-slate-400" />
                  <span>Platform Support Desk</span>
                </div>
              </button>
            </nav>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2.5 block">
              Settings & Account
            </span>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setMainTab('profile')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'profile'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className={`w-4 h-4 ${mainTab === 'profile' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Client Settings</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  alert(
                    'Client Guide:\n• Explore talent & add to Hold Cart.\n• Submit dates to request shoot hold.\n• Once approved, pay 30% advance deposit via Razorpay.\n• Chat with creative partners in real-time.\n• Download master shoot files from your Deliverables Vault.'
                  )
                }
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Help & FAQ</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* User Card at bottom of Sidebar */}
        <div className="p-3 m-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs overflow-hidden">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.name || 'C')[0].toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {user?.name || 'Client'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-600">Client Active</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => (onLogout ? onLogout() : (sessionStorage.clear(), window.location.reload()))}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main Client Workspace Area - Edge-to-Edge Full Width */}
      <main className="flex-1 min-w-0 bg-slate-100/60 overflow-y-auto pb-16">
        <div className="px-6 sm:px-10 py-8">
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

          {/* Section 1: Top Performance Overview Cards (Vendor Dashboard Style) */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  CLIENT WORKSPACE OVERVIEW
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Welcome, {user?.name || 'Client'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Browse and book approved creative partners, reserve production holds, and track your active shoot milestones.
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {onOpenCart && (
                  <button
                    type="button"
                    onClick={onOpenCart}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Hold Cart</span>
                    {cartCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-white/25 text-white text-[10px] font-bold rounded-full">
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}

                {onBackToMarketplace && (
                  <button
                    type="button"
                    onClick={onBackToMarketplace}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/90 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Explore Public Marketplace</span>
                  </button>
                )}
              </div>
            </div>

            {/* 5 Clean Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div
                onClick={() => setMainTab('vendors')}
                className="p-4 bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl shadow-xs transition-all cursor-pointer group"
              >
                <span className="text-xs font-semibold text-slate-500 block group-hover:text-blue-600 transition-colors">
                  Approved Talent
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{vendors.length}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Vetted ready for booking</span>
              </div>

              <div
                onClick={() => {
                  setMainTab('projects');
                  setActiveFilter('review');
                }}
                className="p-4 bg-white border border-slate-200/90 hover:border-amber-300 rounded-2xl shadow-xs transition-all cursor-pointer group"
              >
                <span className="text-xs font-semibold text-slate-500 block group-hover:text-amber-600 transition-colors">
                  Booking Requests
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{underReviewCount}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Awaiting curation check</span>
              </div>

              <div
                onClick={() => {
                  setMainTab('projects');
                  setActiveFilter('payment');
                }}
                className="p-4 bg-white border border-slate-200/90 hover:border-purple-300 rounded-2xl shadow-xs transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 block group-hover:text-purple-600 transition-colors">
                    Payment Ready
                  </span>
                  {paymentPendingCount > 0 && (
                    <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 animate-pulse">
                      Action
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-1">{paymentPendingCount}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Terms approved</span>
              </div>

              <div
                onClick={() => {
                  setMainTab('projects');
                  setActiveFilter('confirmed');
                }}
                className="p-4 bg-white border border-slate-200/90 hover:border-emerald-300 rounded-2xl shadow-xs transition-all cursor-pointer group"
              >
                <span className="text-xs font-semibold text-slate-500 block group-hover:text-emerald-600 transition-colors">
                  Confirmed Shoots
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{confirmedCount}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Locked productions</span>
              </div>

              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">Gross Invested</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">₹{totalInvested.toLocaleString()}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Secured escrow value</span>
              </div>
            </div>
          </div>

          {/* Section 2: Workspace Horizontal Sub-Navigation Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-200 mb-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMainTab('projects')}
              className={`pb-3 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                mainTab === 'projects' || mainTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600 font-semibold -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <span>Assigned Projects & Bookings</span>
              {bookings.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    paymentPendingCount > 0
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {bookings.length} {paymentPendingCount > 0 ? '• Action' : ''}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMainTab('vendors')}
              className={`pb-3 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                mainTab === 'vendors'
                  ? 'border-blue-600 text-blue-600 font-semibold -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <span>Approved Creative Talent & Studios</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold">
                {vendors.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('vault')}
              className={`pb-3 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                mainTab === 'vault'
                  ? 'border-blue-600 text-blue-600 font-semibold -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <span>Deliverables Vault</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('disputes')}
              className={`pb-3 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                mainTab === 'disputes'
                  ? 'border-blue-600 text-blue-600 font-semibold -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <span>Disputes Desk</span>
              {customerComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full font-bold">
                  {customerComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMainTab('profile')}
              className={`pb-3 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                mainTab === 'profile'
                  ? 'border-blue-600 text-blue-600 font-semibold -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <span>Client Settings</span>
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
      {(mainTab === 'projects' || mainTab === 'dashboard') && (
        <div className="space-y-6">
          {/* Real-time Studio Balance Payment Reminder Alert */}
          {balanceReminderAlert && (
            <div className="px-4 py-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <span className="font-semibold text-amber-950">
                    Balance Payment Requested: {balanceReminderAlert.vendor_name || 'Creative Studio'}
                  </span>
                  <span className="text-amber-800 ml-2">
                    Pending balance of ₹{Number(balanceReminderAlert.balance_due || 0).toLocaleString()} requested for completion.
                  </span>
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
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Settle Balance &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceReminderAlert(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

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
              <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-800">
                    Project Bookings
                  </span>
                  <div className="relative">
                    <select
                      value={activeFilter}
                      onChange={(e) => setActiveFilter(e.target.value)}
                      className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
                    >
                      <option value="all">All Projects ({groupedProjects.length})</option>
                      <option value="review">Under Review ({underReviewCount})</option>
                      <option value="payment">Payment Pending ({paymentPendingCount})</option>
                      <option value="confirmed">Confirmed ({confirmedCount})</option>
                      <option value="completed">Completed ({completedCount})</option>
                      <option value="declined">Declined ({rejectedCount})</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search project, studio..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Bookings Table */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50/40">
                      <th className="py-3 px-4 font-semibold w-[26%] min-w-[180px]">Project</th>
                      <th className="py-3 px-4 font-semibold w-[18%] min-w-[140px]">Creative Partner</th>
                      <th className="py-3 px-4 font-semibold w-[16%] min-w-[120px]">Shoot Dates</th>
                      <th className="py-3 px-4 font-semibold w-[15%] min-w-[120px]">Amount</th>
                      <th className="py-3 px-4 font-semibold w-[13%] min-w-[110px]">Status</th>
                      <th className="py-3 px-4 font-semibold text-right w-[12%] min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProjects.map((item) => {
                      if (item.isBundle) {
                        const isExpanded = expandedBookingId === item.bundleId;
                        return (
                          <React.Fragment key={item.bundleId}>
                            <tr className={`transition-colors ${isExpanded ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'}`}>
                              {/* 1. Project & Service */}
                              <td className="py-3.5 px-4 align-middle">
                                <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                                  {item.bundleName}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                  <span>Crew ({item.members.length} Specialists)</span>
                                  <span>&bull;</span>
                                  <span className="font-mono">#{item.bundleId.slice(0, 8)}</span>
                                  {item.projectLocation && (
                                    <>
                                      <span>&bull;</span>
                                      <span>{item.projectLocation}</span>
                                    </>
                                  )}
                                </div>
                                {item.hasDeclined && (
                                  <div className="text-[11px] text-rose-600 font-medium mt-1">
                                    Action required: Partner declined
                                  </div>
                                )}
                              </td>

                              {/* 2. Creative Partner */}
                              <td className="py-3.5 px-4 align-middle">
                                <div className="space-y-1 text-xs">
                                  {item.members.map((m) => {
                                    const isDeclined = m.status === 'rejected' || m.status === 'cancelled';
                                    const isApproved = m.status === 'approved' || m.status === 'payment_pending';
                                    const isConfirmed = m.status === 'confirmed' || m.status === 'in_progress';
                                    return (
                                      <div key={m.id} className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-slate-500">{m.crew_role || m.category_name || 'Specialist'}:</span>
                                        <span className="font-medium text-slate-900 truncate max-w-[120px]" title={m.business_name || m.provider_name}>
                                          {m.business_name || m.provider_name || 'Studio'}
                                        </span>
                                        <span className={`text-[10px] font-medium ${
                                          isDeclined ? 'text-rose-600' : isConfirmed ? 'text-emerald-600' : isApproved ? 'text-blue-600' : 'text-amber-600'
                                        }`}>
                                          ({isDeclined ? 'Declined' : isConfirmed ? 'Locked' : isApproved ? 'Approved' : 'Review'})
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* 3. Shoot Dates */}
                              <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                <div className="text-xs font-medium text-slate-800">
                                  {item.startDate && item.endDate ? (
                                    <span>
                                      {new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                      {' → '}
                                      {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  ) : (
                                    'Synchronized'
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {item.duration || 'Multi-day Shoot'}
                                </div>
                              </td>

                              {/* 4. Budget & Payments */}
                              <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                <div className="font-semibold text-slate-900 font-mono text-xs">
                                  ₹{item.totalAmount.toLocaleString()}
                                </div>
                                <div className="text-[11px] mt-1 space-y-0.5">
                                  {item.paidAmount >= item.totalAmount && item.totalAmount > 0 ? (
                                    <div className="text-emerald-600 font-medium">Fully Paid</div>
                                  ) : item.paidAmount > 0 ? (
                                    <>
                                      <div className="text-slate-500">Paid: <span className="font-mono text-slate-700 font-medium">₹{item.paidAmount.toLocaleString()}</span></div>
                                      <div className="text-slate-500">Due: <span className="font-mono font-medium text-amber-600">₹{(item.totalAmount - item.paidAmount).toLocaleString()}</span></div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-slate-500">Adv: <span className="font-mono text-slate-700 font-medium">₹{item.advanceAmount.toLocaleString()}</span></div>
                                      <div className="text-amber-600 font-medium">Advance Due</div>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* 5. Workflow Status */}
                              <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      item.hasDeclined
                                        ? 'bg-rose-500'
                                        : item.allConfirmed
                                        ? 'bg-emerald-500'
                                        : item.allCompleted
                                        ? 'bg-blue-500'
                                        : item.isReadyForCrewAdvance
                                        ? 'bg-purple-500'
                                        : 'bg-amber-500'
                                    }`}
                                  />
                                  <span
                                    className={`text-xs font-medium ${
                                      item.hasDeclined
                                        ? 'text-rose-700'
                                        : item.allConfirmed
                                        ? 'text-emerald-700'
                                        : item.allCompleted
                                        ? 'text-blue-700'
                                        : item.isReadyForCrewAdvance
                                        ? 'text-purple-700'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {item.hasDeclined
                                      ? 'Role Declined'
                                      : item.allConfirmed
                                      ? 'Confirmed & Locked'
                                      : item.allCompleted
                                      ? 'Completed'
                                      : item.isReadyForCrewAdvance
                                      ? 'Advance Due'
                                      : 'In Review'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {item.hasDeclined
                                    ? 'Re-arrange role'
                                    : item.allConfirmed
                                    ? 'All confirmed'
                                    : item.allCompleted
                                    ? 'Production done'
                                    : item.isReadyForCrewAdvance
                                    ? 'Terms approved'
                                    : item.hasUnderReview
                                    ? `${item.underReviewMembers.length} reviewing`
                                    : 'Reviewing'}
                                </div>
                              </td>

                              {/* 6. Actions */}
                              <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {item.hasDeclined && item.declinedMembers.length > 0 && (
                                    <button
                                      onClick={() => setReplacementModalBooking(item.declinedMembers[0])}
                                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
                                    >
                                      Re-arrange
                                    </button>
                                  )}

                                  {!item.hasDeclined && item.hasUnderReview && (
                                    <span className="text-[11px] font-medium text-amber-700">
                                      Awaiting Review
                                    </span>
                                  )}

                                  {!item.hasDeclined && item.isReadyForCrewAdvance && item.payableAdvanceAmount > 0 && (
                                    <button
                                      onClick={() => handleCrewBundlePayment(item.bundleId, 'advance')}
                                      disabled={payingId === item.bundleId}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                                    >
                                      {payingId === item.bundleId ? 'Paying...' : `Pay Adv. (₹${item.payableAdvanceAmount.toLocaleString()})`}
                                    </button>
                                  )}

                                  {item.allConfirmed && item.payableBalanceAmount > 0 && (
                                    <button
                                      onClick={() => handleCrewBundlePayment(item.bundleId, 'balance')}
                                      disabled={payingId === item.bundleId}
                                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                                    >
                                      {payingId === item.bundleId ? 'Processing...' : `Settle (₹${item.payableBalanceAmount.toLocaleString()})`}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setExpandedBookingId(isExpanded ? null : item.bundleId)}
                                    className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <span>Roster ({item.members.length})</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
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
                          <tr className={`transition-colors ${isExpanded ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'}`}>
                            {/* 1. Project */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                                {b.project_name || b.resource_title}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                <span>{b.category_name || 'Creative Service'}</span>
                                <span>&bull;</span>
                                <span className="font-mono">#{b.id.slice(0, 8)}</span>
                              </div>
                            </td>

                            {/* 2. Creative Partner */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="text-xs font-semibold text-slate-900">
                                {b.business_name || b.provider_name || 'Creative Studio'}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {b.vendor_location || b.project_location || 'India'}
                              </div>
                            </td>

                            {/* 3. Shoot Dates */}
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="text-xs font-medium text-slate-800">
                                <span>
                                  {new Date(b.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  {' → '}
                                  {new Date(b.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {b.duration || '1 Day'}
                              </div>
                            </td>

                            {/* 4. Amount */}
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="font-semibold text-slate-900 font-mono text-xs">
                                ₹{Number(b.total_amount || 0).toLocaleString()}
                              </div>
                              <div className="text-[11px] mt-1 space-y-0.5">
                                {b.payment_status === 'paid' || (Number(b.total_amount || 0) - Number(b.paid_amount || 0)) <= 0 ? (
                                  <div className="text-emerald-600 font-medium">Fully Paid</div>
                                ) : b.payment_status === 'advance_paid' || Number(b.paid_amount || 0) > 0 ? (
                                  <>
                                    <div className="text-slate-500">Paid: <span className="font-mono text-slate-700 font-medium">₹{Number(b.paid_amount || 0).toLocaleString()}</span></div>
                                    <div className="text-slate-500">Due: <span className="font-mono font-medium text-amber-600">₹{(Number(b.total_amount || 0) - Number(b.paid_amount || 0)).toLocaleString()}</span></div>
                                  </>
                                ) : (
                                  <>
                                    <div className="text-slate-500">Adv: <span className="font-mono text-slate-700 font-medium">₹{Number(b.advance_amount || Math.round(Number(b.total_amount || 0) * 0.3)).toLocaleString()}</span></div>
                                    <div className="text-amber-600 font-medium">Deposit Due</div>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* 5. Status (Minimal clean dot + text) */}
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    b.status === 'confirmed'
                                      ? 'bg-emerald-500'
                                      : b.status === 'completed'
                                      ? 'bg-blue-500'
                                      : b.status === 'deliverables_submitted'
                                      ? 'bg-purple-500'
                                      : b.status === 'approved' || b.status === 'payment_pending'
                                      ? 'bg-amber-500'
                                      : b.status === 'rejected' || b.status === 'cancelled'
                                      ? 'bg-rose-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span
                                  className={`text-xs font-medium ${
                                    b.status === 'confirmed'
                                      ? 'text-emerald-700'
                                      : b.status === 'completed'
                                      ? 'text-blue-700'
                                      : b.status === 'deliverables_submitted'
                                      ? 'text-purple-700'
                                      : b.status === 'approved' || b.status === 'payment_pending'
                                      ? 'text-amber-700'
                                      : b.status === 'rejected' || b.status === 'cancelled'
                                      ? 'text-rose-600'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {b.status === 'confirmed'
                                    ? 'Confirmed'
                                    : b.status === 'completed'
                                    ? 'Completed'
                                    : b.status === 'deliverables_submitted'
                                    ? 'Deliverables'
                                    : b.status === 'approved' || b.status === 'payment_pending'
                                    ? 'Terms Approved'
                                    : b.status === 'rejected' || b.status === 'cancelled'
                                    ? 'Declined'
                                    : 'In Review'}
                                </span>
                              </div>
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {b.status === 'rejected' && (
                                  <button
                                    onClick={() => setReplacementModalBooking(b)}
                                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Replace
                                  </button>
                                )}

                                {isPayable && (
                                  <button
                                    onClick={() => {
                                      setPaymentModalBooking(b);
                                      setPaymentModalType('advance');
                                    }}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Pay Adv. (₹{Number(b.advance_amount || Math.round(Number(b.total_amount || 0) * 0.3)).toLocaleString()})
                                  </button>
                                )}

                                {(b.status === 'confirmed' || b.status === 'deliverables_submitted' || b.status === 'completed') && (
                                  <button
                                    type="button"
                                    onClick={() => setDeliverablesModalBooking(b)}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-all cursor-pointer"
                                  >
                                    Vault
                                  </button>
                                )}

                                {b.status === 'confirmed' && (
                                  <button
                                    onClick={() => handleMarkCompleted(b.id)}
                                    disabled={updatingStatusId === b.id}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                                  >
                                    {updatingStatusId === b.id ? 'Completing...' : 'Completed'}
                                  </button>
                                )}

                                {b.status === 'completed' && (Number(b.total_amount || 0) - Number(b.paid_amount || 0)) > 0 && (
                                  <button
                                    onClick={() => {
                                      setPaymentModalBooking(b);
                                      setPaymentModalType('balance');
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Settle (₹{(Number(b.total_amount || 0) - Number(b.paid_amount || 0)).toLocaleString()})
                                  </button>
                                )}

                                {b.status === 'completed' && (
                                  <button
                                    onClick={() => setSelectedReviewBooking(b)}
                                    className="px-2 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 text-xs font-medium rounded-lg transition-all cursor-pointer"
                                  >
                                    {existingReview ? 'Reviewed' : 'Review'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onOpenChat?.({ vendorId: b.vendor_id, bookingId: b.id })}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                  title="Chat"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
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

      {/* ================= TAB 3: DELIVERABLES VAULT ================= */}
      {mainTab === 'vault' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Shoot Deliverables & Media Vault
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Browse final high-resolution files, video cuts, raw footage links, and proof albums uploaded by your creative partners.
              </p>
            </div>
          </div>

          {bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed' || b.payment_status === 'paid').length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <FolderCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Vault Empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Deliverables will be published directly here once your confirmed shoots are completed by your creative team.
              </p>
              <button
                type="button"
                onClick={() => setMainTab('projects')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                View Active Shoots &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bookings
                .filter((b) => b.status === 'confirmed' || b.status === 'completed' || b.payment_status === 'paid')
                .map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {b.category_name || 'Production'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          #{b.id.slice(0, 8)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                        {b.project_name || b.resource_title || 'Creative Production Shoot'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Partner: <strong className="text-slate-700">{b.business_name || b.provider_name}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Shoot Date: {b.start_date ? new Date(b.start_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Deliverables Vault</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeliverablesModalBooking(b)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <FolderCheck className="w-3.5 h-3.5" />
                        <span>Open Vault</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: DISPUTES & RESOLUTION DESK ================= */}
      {mainTab === 'disputes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Disputes & Grievance Resolution Desk
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track issues raised with creative partners, review partner statements, and access platform administration mediation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChat?.({ scope: 'admin' })}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Contact Platform Mediator</span>
            </button>
          </div>

          {customerComplaints.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <Scale className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Active Disputes</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                All your creative bookings and shoot deliveries are in good standing without any grievances.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {customerComplaints.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          c.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'under_review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {c.reason || 'Service Quality Grievance'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Filed: {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {c.details || 'Grievance details under review.'}
                  </p>

                  {c.vendor_explanation && (
                    <div className="mt-3 p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide block mb-1">
                        Official Statement from Creative Partner:
                      </span>
                      <p className="text-xs text-blue-950 font-normal">
                        {c.vendor_explanation}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Booking #{c.booking_id?.slice(0, 8)}</span>
                    <button
                      type="button"
                      onClick={() => onOpenChat?.({ bookingId: c.booking_id, scope: 'client' })}
                      className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      Chat with Studio &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: CLIENT PROFILE & SETTINGS ================= */}
      {mainTab === 'profile' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Client Profile & Settings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your contact details, active booking preferences, and account credentials.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Profile Card */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md overflow-hidden">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user?.name || 'C')[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{user?.name || 'Client'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                      ✓ Verified Client Account
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ID: {user?.id?.slice(0, 8) || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Full Name
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{user?.name || 'Client'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Email Address
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{user?.email || 'client@example.com'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Mobile Number
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{user?.mobile || '+91 - Not Set'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Account Role
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1 capitalize">{user?.role || 'Customer'}</p>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Quick Actions & Overview */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Account Statistics
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Total Bookings</span>
                    <span className="font-bold text-slate-900">{bookings.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Confirmed Shoots</span>
                    <span className="font-bold text-emerald-600">{confirmedCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Gross Invested</span>
                    <span className="font-bold text-slate-900">₹{totalInvested.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2.5">
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Open Production Hold Cart</span>
                </button>

                <button
                  type="button"
                  onClick={() => (onLogout ? onLogout() : (sessionStorage.clear(), window.location.reload()))}
                  className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </div>
          </div>
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
        </div>
      </main>
    </div>
  );
}
