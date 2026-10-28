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
  Home,
  CalendarCheck,
  CalendarDays,
  Bell,
} from 'lucide-react';
import {
  DashboardShell,
  PageHeader,
  StatTile,
  Section,
  AttentionList,
  FilterTabs,
  StatusBadge,
  ProgressSteps,
  Button,
  DateChip,
  Toast,
  EmptyState,
  LoadingCard,
  Avatar,
} from './dashboard/ui';
import {
  isRequest,
  isPayable,
  isDeclined,
  isActiveShoot,
  hasDeliverablesAccess,
  isUpcoming,
  isPastShoot,
  getStatusMeta,
  getStepIndex,
  getAmounts,
  formatINR,
  formatDate,
  formatDateRange,
  greeting,
} from './dashboard/bookingStatus';
import { resolveMediaUrl, hideBrokenImage } from '../utils/media';

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
  const [mainTab, setMainTab] = useState('dashboard'); // 'dashboard' (home) | 'projects' | 'vendors' | 'vault' | 'disputes' | 'profile'
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
    p.isBundle ? p.hasUnderReview : isRequest(p.booking.status)
  ).length;

  const completedCount = groupedProjects.filter((p) =>
    p.isBundle ? p.allCompleted : p.booking.status === 'completed'
  ).length;

  const rejectedCount = groupedProjects.filter((p) =>
    p.isBundle ? p.hasDeclined : isDeclined(p.booking.status)
  ).length;

  const isConfirmedProject = (p) =>
    p.isBundle
      ? p.allConfirmed && !p.allCompleted
      : isActiveShoot(p.booking.status) || p.booking.status === 'deliverables_submitted';

  const confirmedCount = groupedProjects.filter(isConfirmedProject).length;

  const totalInvested = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed' || b.payment_status === 'paid' || b.payment_status === 'advance_paid')
    .reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);

  const openDisputesCount = customerComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length;

  const openPayment = (b, type) => {
    setPaymentModalBooking(b);
    setPaymentModalType(type);
  };

  // Everything the client should act on. projectId lets the bookings list filter to "Needs action".
  const attentionItems = [];
  groupedProjects.forEach((p) => {
    if (p.isBundle) {
      if (!p.hasDeclined && p.isReadyForCrewAdvance && p.payableAdvanceAmount > 0) {
        attentionItems.push({
          id: `adv-${p.bundleId}`,
          projectId: p.id,
          tone: 'blue',
          title: `Pay the advance for ${p.bundleName}`,
          detail: `Your whole crew accepted · ${formatINR(p.payableAdvanceAmount)} locks your dates`,
          actions: [
            {
              label: payingId === p.bundleId ? 'Opening…' : `Pay ${formatINR(p.payableAdvanceAmount)}`,
              variant: 'success',
              onClick: () => handleCrewBundlePayment(p.bundleId, 'advance'),
              disabled: payingId === p.bundleId,
            },
          ],
        });
      }
      p.declinedMembers.filter(isUpcoming).forEach((m) => {
        attentionItems.push({
          id: `rep-${m.id}`,
          projectId: p.id,
          tone: 'red',
          title: `${m.business_name || m.provider_name || 'A partner'} declined your ${m.crew_role || 'crew'} slot`,
          detail: `${p.bundleName} · find someone free on the same dates`,
          actions: [{ label: 'Find replacement', variant: 'warning', onClick: () => setReplacementModalBooking(m) }],
        });
      });
    } else {
      const b = p.booking;
      if (isPayable(b.status)) {
        const { advance } = getAmounts(b);
        attentionItems.push({
          id: `adv-${b.id}`,
          projectId: p.id,
          tone: 'blue',
          title: `${b.business_name || b.provider_name || 'Your partner'} accepted — pay the advance`,
          detail: `${b.project_name || b.resource_title || 'Your shoot'} · ${formatDateRange(b.start_date, b.end_date)}`,
          actions: [{ label: `Pay ${formatINR(advance)}`, variant: 'success', onClick: () => openPayment(b, 'advance') }],
        });
      }
      if (b.status === 'rejected' && isUpcoming(b)) {
        attentionItems.push({
          id: `rep-${b.id}`,
          projectId: p.id,
          tone: 'red',
          title: `${b.business_name || b.provider_name || 'Your partner'} declined your request`,
          detail: b.rejection_reason ? `“${b.rejection_reason}”` : 'Find someone free on the same dates',
          actions: [{ label: 'Find replacement', variant: 'warning', onClick: () => setReplacementModalBooking(b) }],
        });
      }
    }
  });

  const projectIdOf = (b) => b.crew_bundle_id || b.id;
  bookings.forEach((b) => {
    const partner = b.business_name || b.provider_name || 'Your partner';
    const project = b.project_name || b.resource_title || 'your shoot';
    const { balance } = getAmounts(b);
    if (b.status === 'deliverables_submitted') {
      attentionItems.push({
        id: `files-${b.id}`,
        projectId: projectIdOf(b),
        tone: 'violet',
        title: `${partner} delivered files for ${project}`,
        detail: 'Review them and approve or ask for changes',
        actions: [{ label: 'Review files', onClick: () => setDeliverablesModalBooking(b) }],
      });
    } else if (isActiveShoot(b.status) && isPastShoot(b)) {
      attentionItems.push({
        id: `done-${b.id}`,
        projectId: projectIdOf(b),
        tone: 'green',
        title: `Did ${partner} finish ${project}?`,
        detail: `Shoot ended ${formatDate(b.end_date)} · mark it completed when you're happy`,
        actions: [
          {
            label: updatingStatusId === b.id ? 'Saving…' : 'Mark completed',
            variant: 'secondary',
            onClick: () => handleMarkCompleted(b.id),
            disabled: updatingStatusId === b.id,
          },
        ],
      });
    } else if (b.status === 'completed' && balance > 0) {
      attentionItems.push({
        id: `bal-${b.id}`,
        projectId: projectIdOf(b),
        tone: 'amber',
        title: `${formatINR(balance)} balance due to ${partner}`,
        detail: `${project}${b.last_balance_reminder_at ? ` · reminder received ${formatDate(b.last_balance_reminder_at, false)}` : ''}`,
        actions: [{ label: `Pay ${formatINR(balance)}`, variant: 'primary', onClick: () => openPayment(b, 'balance') }],
      });
    } else if (b.status === 'completed' && !myReviews.some((r) => r.booking_id === b.id)) {
      attentionItems.push({
        id: `rate-${b.id}`,
        projectId: projectIdOf(b),
        tone: 'slate',
        title: `How was working with ${partner}?`,
        detail: `${project} · your review helps other clients`,
        actions: [{ label: 'Leave a review', variant: 'secondary', onClick: () => setSelectedReviewBooking(b) }],
      });
    }
  });

  // Reviews are nice-to-have, so keep them last
  attentionItems.sort((a, b) => (a.tone === 'slate') - (b.tone === 'slate'));
  const urgentCount = attentionItems.filter((i) => i.tone !== 'slate').length;
  const actionProjectIds = new Set(attentionItems.filter((i) => i.tone !== 'slate').map((i) => i.projectId));

  const upcomingProjects = groupedProjects
    .map((p) =>
      p.isBundle
        ? {
            id: p.bundleId,
            name: p.bundleName,
            start_date: p.startDate,
            end_date: p.endDate,
            who: `Crew of ${p.members.length}`,
            active: p.members.some((m) => isActiveShoot(m.status)),
          }
        : {
            id: p.booking.id,
            name: p.booking.project_name || p.booking.resource_title || 'Production shoot',
            start_date: p.booking.start_date,
            end_date: p.booking.end_date,
            who: p.booking.business_name || p.booking.provider_name || 'Creative partner',
            active: isActiveShoot(p.booking.status),
            chat: { vendorId: p.booking.vendor_id, bookingId: p.booking.id },
          }
    )
    .filter((x) => x.active && isUpcoming(x))
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // Filter Projects
  const filteredProjects = groupedProjects.filter((item) => {
    if (activeFilter === 'action') {
      if (!actionProjectIds.has(item.id)) return false;
    } else if (activeFilter === 'review') {
      if (item.isBundle ? !item.hasUnderReview : !isRequest(item.booking.status)) return false;
    } else if (activeFilter === 'confirmed') {
      if (!isConfirmedProject(item)) return false;
    } else if (activeFilter === 'completed') {
      if (item.isBundle ? !item.allCompleted : item.booking.status !== 'completed') return false;
    } else if (activeFilter === 'declined') {
      if (item.isBundle ? !item.hasDeclined : !isDeclined(item.booking.status)) return false;
    }

    if (projectSearch.trim()) {
      const q = projectSearch.toLowerCase();
      const matches = (b) =>
        [b.project_name, b.resource_title, b.business_name, b.provider_name, b.crew_role, b.category_name, b.vendor_location, b.project_location, b.id]
          .some((v) => (v || '').toLowerCase().includes(q));
      if (item.isBundle) {
        if (!(item.bundleName || '').toLowerCase().includes(q) && !item.members.some(matches)) return false;
      } else if (!matches(item.booking)) {
        return false;
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

  const navSections = [
    {
      title: 'Workspace',
      items: [
        { key: 'dashboard', label: 'Home', icon: Home },
        { key: 'projects', label: 'My bookings', icon: CalendarCheck, badge: urgentCount },
        { key: 'vendors', label: 'Find talent', icon: Sparkles },
        { key: 'vault', label: 'Files', icon: FolderCheck },
        { key: 'disputes', label: 'Disputes', icon: Scale, badge: openDisputesCount, badgeTone: 'red' },
      ],
    },
    {
      title: 'Communication',
      items: [
        { key: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadChatCount, onClick: () => onOpenChat?.({ scope: 'client' }) },
        ...(onOpenCart ? [{ key: 'cart', label: 'Booking cart', icon: ShoppingCart, badge: cartCount, onClick: onOpenCart }] : []),
        { key: 'support', label: 'Help & support', icon: Headphones, onClick: () => onOpenChat?.({ scope: 'admin' }) },
      ],
    },
    {
      title: 'Account',
      items: [{ key: 'profile', label: 'Settings', icon: Settings }],
    },
  ];

  const partnerName = (b) => b.business_name || b.provider_name || 'Creative partner';

  // Status shown for a whole crew project
  const getBundleMeta = (p) => {
    if (p.hasDeclined) return { label: 'Needs a replacement', tone: 'red', hint: 'A partner declined. Find a replacement to keep your dates.' };
    if (p.hasUnderReview)
      return {
        label: 'Waiting for partners',
        tone: 'amber',
        hint: `Waiting for ${p.underReviewMembers.length} of ${p.members.length} partners to accept.`,
      };
    if (p.isReadyForCrewAdvance) return { label: 'Accepted · pay advance', tone: 'blue', hint: 'Everyone accepted. Pay the advance to lock your dates.' };
    if (p.allCompleted) return { label: 'Completed', tone: 'slate', hint: p.payableBalanceAmount > 0 ? 'Shoot done — a balance is still due.' : 'All done and paid.' };
    if (p.allConfirmed) return { label: 'Confirmed', tone: 'green', hint: 'Your crew is booked and your dates are locked.' };
    return { label: 'In progress', tone: 'violet', hint: 'Your crew is working on it.' };
  };

  // Actions available on a single booking (used for standalone bookings and crew members).
  // Quiet links come first and the main call to action sits on the right.
  const bookingActions = (b, { compact = false } = {}) => {
    const { paid, advance, balance } = getAmounts(b);
    const quiet = [
      <Button key="chat" size="sm" variant="ghost" icon={MessageSquare} onClick={() => onOpenChat?.({ vendorId: b.vendor_id, bookingId: b.id })}>
        Message
      </Button>,
    ];
    const main = [];

    if (paid > 0) {
      quiet.push(
        <Button key="receipt" size="sm" variant="ghost" icon={Receipt} onClick={() => setReceiptModalBooking(b)}>
          Receipt
        </Button>
      );
    }
    if (hasDeliverablesAccess(b.status) && b.status !== 'deliverables_submitted') {
      quiet.push(
        <Button key="files" size="sm" variant="ghost" icon={FolderCheck} onClick={() => setDeliverablesModalBooking(b)}>
          Files
        </Button>
      );
    }
    if (b.status === 'completed' && !compact) {
      const reviewed = myReviews.some((r) => r.booking_id === b.id);
      main.push(
        <Button key="review" size="sm" variant="secondary" icon={Star} onClick={() => setSelectedReviewBooking(b)}>
          {reviewed ? 'Edit review' : 'Leave a review'}
        </Button>
      );
    }
    if (isActiveShoot(b.status)) {
      main.push(
        <Button
          key="done"
          size="sm"
          variant={isPastShoot(b) ? 'success' : 'secondary'}
          onClick={() => handleMarkCompleted(b.id)}
          disabled={updatingStatusId === b.id}
        >
          {updatingStatusId === b.id ? 'Saving…' : 'Mark completed'}
        </Button>
      );
    }
    if (b.status === 'rejected') {
      main.push(
        <Button key="replace" size="sm" variant="warning" onClick={() => setReplacementModalBooking(b)}>
          Find replacement
        </Button>
      );
    }
    if (isPayable(b.status)) {
      main.push(
        <Button key="adv" size="sm" variant="success" icon={CreditCard} onClick={() => openPayment(b, 'advance')}>
          Pay advance {formatINR(advance)}
        </Button>
      );
    }
    if (b.status === 'deliverables_submitted') {
      main.push(
        <Button key="files" size="sm" variant="primary" icon={FolderCheck} onClick={() => setDeliverablesModalBooking(b)}>
          Review files
        </Button>
      );
    }
    if (b.status === 'completed' && balance > 0) {
      main.push(
        <Button key="bal" size="sm" variant="primary" icon={CreditCard} onClick={() => openPayment(b, 'balance')}>
          Pay balance {formatINR(balance)}
        </Button>
      );
    }
    return [...quiet, ...main];
  };

  const clientHint = (b) => {
    const { balance } = getAmounts(b);
    if (isRequest(b.status)) return `Waiting for ${partnerName(b)} to accept your request.`;
    if (isPayable(b.status)) return 'Accepted! Pay the advance to lock your dates.';
    if (b.status === 'rejected') return 'Declined. You can book someone else for the same dates.';
    if (b.status === 'cancelled') return 'This booking was cancelled.';
    if (isActiveShoot(b.status)) return isPastShoot(b) ? 'Shoot is over — mark it completed when you are happy.' : 'Confirmed. Your dates are locked.';
    if (b.status === 'deliverables_submitted') return 'Your files are ready to review.';
    if (b.status === 'completed') return balance > 0 ? `${formatINR(balance)} balance is due.` : 'All done and paid.';
    return null;
  };

  const AmountSummary = ({ total, paid, advance, started }) => (
    <div className="sm:text-right shrink-0">
      <p className="text-lg font-bold text-slate-900">{formatINR(total)}</p>
      <p className="text-sm text-slate-500 mt-0.5">
        {total > 0 && paid >= total ? (
          <span className="text-emerald-600 font-medium">Paid in full</span>
        ) : paid > 0 ? (
          <>
            Paid {formatINR(paid)} · <span className="text-amber-600 font-medium">Due {formatINR(total - paid)}</span>
          </>
        ) : started ? (
          <>Advance {formatINR(advance)}</>
        ) : (
          <>Nothing paid yet</>
        )}
      </p>
    </div>
  );

  const renderStandaloneCard = (b) => {
    const status = getStatusMeta(b.status, 'client');
    const { total, paid, advance } = getAmounts(b);
    const declined = isDeclined(b.status);
    const isExpanded = expandedBookingId === b.id;
    const existingReview = myReviews.find((r) => r.booking_id === b.id);

    return (
      <article key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              <span className="text-xs text-slate-500">{b.category_name || 'Creative service'}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">{b.project_name || b.resource_title || 'Production shoot'}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                {partnerName(b)}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                {formatDateRange(b.start_date, b.end_date)}
                {b.duration ? ` · ${b.duration}` : ''}
              </span>
              {(b.project_location || b.vendor_location) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {b.project_location || b.vendor_location}
                </span>
              )}
            </div>
            {declined && b.rejection_reason && <p className="mt-2 text-sm text-rose-600">Reason given: “{b.rejection_reason}”</p>}
          </div>
          <AmountSummary total={total} paid={paid} advance={advance} started={!declined} />
        </div>

        {!declined && (
          <div className="px-5 pb-5">
            <ProgressSteps current={getStepIndex(b.status)} />
          </div>
        )}

        {isExpanded && (
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</p>
              <p className="text-slate-700 mt-1">{b.project_description || 'No description added.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Requirements</p>
              <p className="text-slate-700 mt-1">{b.additional_requirements || 'None specified.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contact</p>
              <p className="text-slate-700 mt-1">{b.provider_mobile ? `Phone: ${b.provider_mobile}` : 'Use Message to contact your partner.'}</p>
              <p className="text-slate-500 mt-1">Budget: {formatINR(b.estimated_budget || b.total_amount)}</p>
            </div>
            {existingReview && (
              <div className="sm:col-span-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-amber-500">
                  {'★'.repeat(existingReview.rating)}
                  <span className="text-amber-200">{'★'.repeat(5 - existingReview.rating)}</span>
                </p>
                {existingReview.comment && <p className="text-slate-700 mt-1">“{existingReview.comment}”</p>}
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <p className="text-sm text-slate-500">{clientHint(b)}</p>
            <button
              type="button"
              onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              {isExpanded ? 'Hide details' : 'Details'}
              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">{bookingActions(b)}</div>
        </div>
      </article>
    );
  };

  const renderBundleCard = (p) => {
    const meta = getBundleMeta(p);
    const activeMembers = p.members.filter((m) => !isDeclined(m.status));
    const step = activeMembers.length ? Math.min(...activeMembers.map((m) => getStepIndex(m.status))) : 1;

    return (
      <article key={p.bundleId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Crew of {p.members.length}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">{p.bundleName}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                {formatDateRange(p.startDate, p.endDate)}
                {p.duration ? ` · ${p.duration}` : ''}
              </span>
              {p.projectLocation && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {p.projectLocation}
                </span>
              )}
            </div>
          </div>
          <AmountSummary total={p.totalAmount} paid={p.paidAmount} advance={p.advanceAmount} started />
        </div>

        {!p.hasDeclined && (
          <div className="px-5 pb-5">
            <ProgressSteps current={step} />
          </div>
        )}

        <ul className="border-t border-slate-100 divide-y divide-slate-100">
          {p.members.map((m) => {
            const mStatus = getStatusMeta(m.status, 'client');
            const { total, paid } = getAmounts(m);
            return (
              <li key={m.id} className={`px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-3 ${isDeclined(m.status) ? 'bg-rose-50/40' : ''}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={partnerName(m)} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {partnerName(m)} <span className="font-normal text-slate-500">· {m.crew_role || m.category_name || 'Specialist'}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <StatusBadge tone={mStatus.tone}>{mStatus.label}</StatusBadge>
                      <span className="text-xs text-slate-500">
                        {formatINR(total)}
                        {paid > 0 && paid < total ? ` · ${formatINR(paid)} paid` : paid >= total && total > 0 ? ' · paid' : ''}
                      </span>
                    </div>
                    {isDeclined(m.status) && m.rejection_reason && (
                      <p className="text-xs text-rose-600 mt-1">“{m.rejection_reason}”</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">{bookingActions(m, { compact: true })}</div>
              </li>
            );
          })}
        </ul>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-slate-500 flex-1">{meta.hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            {p.allConfirmed && p.payableBalanceAmount > 0 && (
              <Button
                size="sm"
                variant={p.isReadyForCrewAdvance ? 'secondary' : 'primary'}
                icon={CreditCard}
                onClick={() => handleCrewBundlePayment(p.bundleId, 'balance')}
                disabled={payingId === p.bundleId}
              >
                {payingId === p.bundleId ? 'Opening…' : `Pay remaining ${formatINR(p.payableBalanceAmount)}`}
              </Button>
            )}
            {!p.hasDeclined && p.isReadyForCrewAdvance && p.payableAdvanceAmount > 0 && (
              <Button
                size="sm"
                variant="success"
                icon={CreditCard}
                onClick={() => handleCrewBundlePayment(p.bundleId, 'advance')}
                disabled={payingId === p.bundleId}
              >
                {payingId === p.bundleId ? 'Opening…' : `Pay advance ${formatINR(p.payableAdvanceAmount)}`}
              </Button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <DashboardShell
      sections={navSections}
      activeKey={mainTab}
      onSelect={setMainTab}
      profile={{ name: user?.name || 'Client', image: user?.profile_image, subtitle: 'Client account', statusTone: 'green' }}
    >
      <Toast notification={notification} onClose={() => setNotification(null)} />

      {balanceReminderAlert && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <Bell className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="flex-1 text-sm text-amber-900">
            <span className="font-semibold">{balanceReminderAlert.vendor_name || 'Your creative partner'}</span> asked you to pay the remaining{' '}
            {formatINR(balanceReminderAlert.balance_due)}.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBalanceReminderAlert(null)}>
              Later
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={() => {
                const target = bookings.find((b) => b.id === balanceReminderAlert.booking_id);
                if (target) openPayment(target, 'balance');
                setBalanceReminderAlert(null);
              }}
            >
              Pay now
            </Button>
          </div>
        </div>
      )}

      {/* HOME / DASHBOARD TAB */}
      {mainTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 1. Header Greeting & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Client Workspace
                </span>
                <span className="text-xs text-slate-300">&bull;</span>
                <span className="text-xs text-slate-500 font-medium">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {greeting()}, {(user?.name || 'there').split(' ')[0]}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {urgentCount > 0
                  ? `You have ${urgentCount} action item${urgentCount > 1 ? 's' : ''} requiring payment or review.`
                  : bookings.length === 0
                  ? 'Welcome to CrewUp! Search vetted creative talent or build a production crew.'
                  : `All productions are on track with ${upcomingProjects.length} upcoming shoot${upcomingProjects.length !== 1 ? 's' : ''}.`}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {onOpenCart && cartCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4 text-slate-500" />
                  <span>Cart ({cartCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMainTab('projects')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CalendarCheck className="w-4 h-4 text-slate-500" />
                <span>My Bookings ({groupedProjects.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMainTab('vendors')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>Find Talent</span>
              </button>
            </div>
          </div>

          {/* 2. Elevated 4-Metric KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Needs Action */}
            <div
              onClick={() => {
                setMainTab('projects');
                setActiveFilter('action');
              }}
              className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4.5 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">Needs Action</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 font-mono">
                {urgentCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Pending payments &amp; reviews</p>
            </div>

            {/* 2. Waiting for Reply */}
            <div
              onClick={() => {
                setMainTab('projects');
                setActiveFilter('review');
              }}
              className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4.5 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">In Review</span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 font-mono">
                {underReviewCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Partners reviewing terms</p>
            </div>

            {/* 3. Upcoming Shoots */}
            <div
              onClick={() => {
                setMainTab('projects');
                setActiveFilter('confirmed');
              }}
              className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4.5 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">Upcoming Shoots</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 font-mono">
                {upcomingProjects.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Confirmed &amp; locked</p>
            </div>

            {/* 4. Total Invested */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Total Invested</span>
                <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 font-mono">
                {formatINR(totalInvested)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">100% Escrow protected</p>
            </div>
          </div>

          {/* 3. Action Desk & Upcoming Schedule Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Cols: Needs Your Attention */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Needs Your Attention
                  </h2>
                  {urgentCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {urgentCount} Action Required
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('projects')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>All Bookings</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingBookings ? (
                <p className="px-5 py-10 text-xs text-slate-500 text-center">Loading action items…</p>
              ) : attentionItems.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800 mt-2">You're all caught up!</p>
                  <p className="text-xs text-slate-500 mt-1">No pending payments, file reviews, or partner disputes.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attentionItems.map((item) => (
                    <li key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {item.actions?.map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            onClick={a.onClick}
                            disabled={a.disabled}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Right 1 Col: Upcoming Shoots */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Upcoming Shoots
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {upcomingProjects.length} Confirmed
                </span>
              </div>

              {upcomingProjects.length === 0 ? (
                <div className="p-8 text-center">
                  <CalendarCheck className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 mt-2">No upcoming shoots</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">When dates are confirmed, they show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingProjects.slice(0, 4).map((x) => (
                    <li key={x.id} className="p-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                      <DateChip date={x.start_date} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{x.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{x.who}</p>
                      </div>
                      {x.chat && (
                        <button
                          type="button"
                          onClick={() => onOpenChat?.(x.chat)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                          title="Message partner"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 4. Active Client Projects Overview Table (Resolves empty void on the screen!) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Recent &amp; Active Client Projects
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Live production schedule and current status milestones.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMainTab('projects')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <span>View Full Project Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingBookings ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading projects...</div>
            ) : groupedProjects.length === 0 ? (
              <div className="p-10 text-center">
                <Sparkles className="w-8 h-8 text-blue-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 mt-2">No projects booked yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Browse our curated directory of photographers, cinematographers, and studios to book your first project.
                </p>
                <button
                  type="button"
                  onClick={() => setMainTab('vendors')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Browse Creative Talent &rarr;
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50/40">
                      <th className="py-3 px-4 font-semibold w-[30%] min-w-[180px]">Project</th>
                      <th className="py-3 px-4 font-semibold w-[20%] min-w-[140px]">Creative Partner</th>
                      <th className="py-3 px-4 font-semibold w-[18%] min-w-[130px]">Shoot Dates</th>
                      <th className="py-3 px-4 font-semibold w-[16%] min-w-[120px]">Budget &amp; Escrow</th>
                      <th className="py-3 px-4 font-semibold w-[16%] min-w-[120px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {groupedProjects.slice(0, 5).map((p) => {
                      if (p.isBundle) {
                        return (
                          <tr
                            key={p.bundleId}
                            onClick={() => setMainTab('projects')}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-4 align-middle">
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                                {p.bundleName}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                <span>Crew ({p.members.length} Specialists)</span>
                                <span>&bull;</span>
                                <span className="font-mono">#{p.bundleId.slice(0, 8)}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <div className="text-xs font-medium text-slate-900">
                                {p.members[0]?.business_name || p.members[0]?.provider_name || 'Creative Crew'}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {p.members.length} partners booked
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="text-xs font-medium text-slate-800">
                                {p.startDate && p.endDate
                                  ? `${new Date(p.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → ${new Date(p.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                                  : 'Dates synchronized'}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{p.duration || 'Multi-day Shoot'}</div>
                            </td>
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="font-semibold text-slate-900 font-mono text-xs">
                                ₹{p.totalAmount.toLocaleString()}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {p.paidAmount >= p.totalAmount && p.totalAmount > 0 ? (
                                  <span className="text-emerald-600 font-medium">Fully Paid</span>
                                ) : p.paidAmount > 0 ? (
                                  <span>Paid: ₹{p.paidAmount.toLocaleString()}</span>
                                ) : (
                                  <span>Advance Req.</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    p.hasDeclined
                                      ? 'bg-rose-500'
                                      : p.allConfirmed
                                      ? 'bg-emerald-500'
                                      : p.allCompleted
                                      ? 'bg-blue-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span className="text-xs font-medium text-slate-800">
                                  {p.hasDeclined
                                    ? 'Role Declined'
                                    : p.allConfirmed
                                    ? 'Confirmed & Locked'
                                    : p.allCompleted
                                    ? 'Completed'
                                    : 'In Review'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const b = p.booking;
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setMainTab('projects')}
                          className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                              {b.project_name || b.resource_title}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <span>{b.category_name || 'Creative Service'}</span>
                              <span>&bull;</span>
                              <span className="font-mono">#{b.id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-middle">
                            <div className="text-xs font-medium text-slate-900">
                              {b.business_name || b.provider_name || 'Creative Studio'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {b.vendor_location || b.project_location || 'India'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            <div className="text-xs font-medium text-slate-800">
                              {new Date(b.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} &rarr; {new Date(b.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{b.duration || '1 Day'}</div>
                          </td>
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            <div className="font-semibold text-slate-900 font-mono text-xs">
                              ₹{Number(b.total_amount || 0).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {b.payment_status === 'paid' ? (
                                <span className="text-emerald-600 font-medium">Fully Paid</span>
                              ) : Number(b.paid_amount || 0) > 0 ? (
                                <span>Paid: ₹{Number(b.paid_amount || 0).toLocaleString()}</span>
                              ) : (
                                <span>Advance Req.</span>
                              )}
                            </div>
                          </td>
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
                                    : 'bg-amber-500'
                                }`}
                              />
                              <span className="text-xs font-medium text-slate-800 capitalize">
                                {b.status === 'confirmed'
                                  ? 'Confirmed'
                                  : b.status === 'completed'
                                  ? 'Completed'
                                  : b.status.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5. Quick Creative Category Explorer */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Explore Talent by Discipline
              </h3>
              <button
                type="button"
                onClick={() => setMainTab('vendors')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Browse All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {[
                { title: 'Cinematographers', desc: 'Feature films, ads & music videos', icon: Video, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                { title: 'Photographers', desc: 'Fashion, commercial & events', icon: Camera, color: 'text-purple-600 bg-purple-50 border-purple-200' },
                { title: 'Drone Specialists', desc: 'Certified 4K aerial cinematography', icon: Sparkles, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                { title: 'Post-Production', desc: 'Editing, color grading & VFX', icon: Layers, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              ].map((cat) => (
                <div
                  key={cat.title}
                  onClick={() => {
                    setMainTab('vendors');
                    setVendorSearch(cat.title.slice(0, 5));
                  }}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${cat.color}`}>
                    <cat.icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-3 group-hover:text-blue-600 transition-colors">
                    {cat.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {cat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
                            <img src={resolveMediaUrl(vendor.profile_image)} onError={hideBrokenImage} alt="" className="w-full h-full object-cover" />
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

      {/* MY BOOKINGS */}
      {mainTab === 'projects' && (
        <div>
          <PageHeader
            title="My bookings"
            description="Every shoot you've requested, with the next step for each one."
            actions={
              <Button variant="primary" icon={Search} onClick={() => setMainTab('vendors')}>
                Book more talent
              </Button>
            }
          />

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <FilterTabs
              value={activeFilter}
              onChange={setActiveFilter}
              options={[
                { key: 'all', label: 'All', count: groupedProjects.length },
                { key: 'action', label: 'Needs action', count: actionProjectIds.size, highlight: true },
                { key: 'review', label: 'Waiting for reply', count: underReviewCount },
                { key: 'confirmed', label: 'Upcoming', count: confirmedCount },
                { key: 'completed', label: 'Completed', count: completedCount },
                { key: 'declined', label: 'Declined', count: rejectedCount },
              ]}
            />
            <div className="relative lg:ml-auto lg:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search bookings"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {loadingBookings ? (
            <LoadingCard text="Loading your bookings…" />
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={groupedProjects.length === 0 ? 'No bookings yet' : 'Nothing matches this view'}
              text={
                groupedProjects.length === 0
                  ? 'Browse verified creatives, add them to your cart and request your dates.'
                  : 'Try another filter or clear your search.'
              }
              action={
                groupedProjects.length === 0 && (
                  <Button variant="primary" onClick={() => setMainTab('vendors')}>
                    Browse talent
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((item) => (item.isBundle ? renderBundleCard(item) : renderStandaloneCard(item.booking)))}
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
                    <img src={resolveMediaUrl(user.profile_image)} onError={hideBrokenImage} alt="" className="w-full h-full object-cover" />
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
    </DashboardShell>
  );
}
