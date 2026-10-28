import React, { useState, useEffect, useCallback, useRef } from 'react';
import VendorDepositModal from './VendorDepositModal';
import PortfolioMediaViewer from './PortfolioMediaViewer';
import ReceiptModal from './ReceiptModal';
import AdminSupportDeskModal from './AdminSupportDeskModal';
import DeliverablesVaultModal from './DeliverablesVaultModal';
import { getSocket } from '../utils/socket';
import {
  LayoutDashboard,
  MessageSquare,
  Video,
  Calendar,
  Scale,
  Headphones,
  Settings,
  HelpCircle,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  ChevronDown,
  UploadCloud,
  Home,
  CalendarCheck,
  CalendarDays,
  Images,
  Star,
  Inbox,
  Wallet,
  User,
  Phone,
  Receipt,
  FolderOpen,
  Bell,
  Check,
  AlertTriangle,
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
  Switch,
  DateChip,
  Toast,
  EmptyState,
  LoadingCard,
} from './dashboard/ui';
import {
  isRequest,
  isPayable,
  isDeclined,
  isActiveShoot,
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

export default function VendorDashboard({ user, token: propToken, onBackToMarketplace, onOpenChat, onVendorUpdated, onLogout }) {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'bookings' | 'schedule' | 'gallery' | 'reviews' | 'disputes' | 'profile'
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [receiptModalBooking, setReceiptModalBooking] = useState(null);
  const [isVendorDepositReceiptOpen, setIsVendorDepositReceiptOpen] = useState(false);
  const [isAdminSupportOpen, setIsAdminSupportOpen] = useState(false);
  const [deliverablesModalBooking, setDeliverablesModalBooking] = useState(null);
  const [clientUnread, setClientUnread] = useState(0);
  const [adminUnread, setAdminUnread] = useState(0);

  // Portfolio State
  const [portfolio, setPortfolio] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedPreviewWork, setSelectedPreviewWork] = useState(null);

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [updatingBookingId, setUpdatingBookingId] = useState(null);
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  // Reviews State
  const [studioReviews, setStudioReviews] = useState([]);
  const [studioAvgRating, setStudioAvgRating] = useState(5.0);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Schedule & Calendar State
  const [scheduleData, setScheduleData] = useState({ bookings: [], blackouts: [] });
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Decline Booking Modal State
  const [declineModal, setDeclineModal] = useState({
    isOpen: false,
    booking: null,
  });

  // Vendor Profile State
  const [vendorProfile, setVendorProfile] = useState(null);
  const [editProfileData, setEditProfileData] = useState({
    business_name: '',
    location: '',
    experience: '',
    skills: '',
    pricing: '',
    pricing_unit: 'day',
    bio: '',
    experience_level: 'mid',
    profile_image: '',
  });
  const [categoriesList, setCategoriesList] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // Feedback State
  const [notification, setNotification] = useState(null);

  // Complaints & Dispute State
  const [vendorComplaints, setVendorComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [selectedDisputeModal, setSelectedDisputeModal] = useState(null);
  const [vendorExplanationText, setVendorExplanationText] = useState('');
  const [submittingExplanation, setSubmittingExplanation] = useState(false);

  // Settlement Offer States
  const [disputeActionTab, setDisputeActionTab] = useState('settle'); // 'settle' | 'counter' | 'statement'
  const [counterOfferType, setCounterOfferType] = useState('partial_refund');
  const [counterOfferAmount, setCounterOfferAmount] = useState('');
  const [counterOfferDetails, setCounterOfferDetails] = useState('');
  const [acceptingClientOffer, setAcceptingClientOffer] = useState(false);
  const [submittingCounterOffer, setSubmittingCounterOffer] = useState(false);

  const token = propToken || sessionStorage.getItem('token');

  const handleAcceptClientOffer = async () => {
    if (!selectedDisputeModal || acceptingClientOffer) return;
    setAcceptingClientOffer(true);
    try {
      const res = await fetch(`/api/v1/complaints/${selectedDisputeModal.id}/accept-client-offer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDisputeModal(null);
        fetchVendorComplaints();
        setNotification({
          type: 'success',
          message: 'Client resolution proposal accepted. Dispute amicably settled!',
        });
      } else {
        alert(data.message || 'Failed to accept proposal.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setAcceptingClientOffer(false);
    }
  };

  const handleSubmitCounterOffer = async (e) => {
    e.preventDefault();
    if (!selectedDisputeModal || submittingCounterOffer || !counterOfferDetails.trim()) return;
    setSubmittingCounterOffer(true);
    try {
      const res = await fetch(`/api/v1/complaints/${selectedDisputeModal.id}/counter-offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offer_type: counterOfferType,
          offer_amount: Number(counterOfferAmount) || 0,
          offer_details: counterOfferDetails.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDisputeModal(null);
        setCounterOfferDetails('');
        setCounterOfferAmount('');
        fetchVendorComplaints();
        setNotification({
          type: 'success',
          message: 'Your counter-offer has been delivered to the client.',
        });
      } else {
        alert(data.message || 'Failed to submit counter-offer.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setSubmittingCounterOffer(false);
    }
  };

  // Load Vendor Disputes & Complaints
  const fetchVendorComplaints = async () => {
    if (!token) return;
    setLoadingComplaints(true);
    try {
      const res = await fetch('/api/v1/complaints/vendor', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setVendorComplaints(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load vendor complaints:', err);
    } finally {
      setLoadingComplaints(false);
    }
  };

  // Load Vendor Profile
  const fetchUnreadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/chat/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setClientUnread(data.client_count || 0);
        setAdminUnread(data.admin_count || 0);
      }
    } catch (err) {
      console.error('Failed to load unread stats:', err);
    }
  }, [token]);

  // Load Vendor Profile
  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/vendors/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setVendorProfile(data.data);
        setEditProfileData({
          business_name: data.data.business_name || '',
          location: data.data.location || '',
          experience: data.data.experience || '',
          skills: data.data.skills || '',
          pricing: data.data.pricing || '',
          pricing_unit: data.data.pricing_unit || 'day',
          bio: data.data.bio || '',
          experience_level: data.data.experience_level || 'mid',
          profile_image: data.data.profile_image || '',
        });

        if (user && data.data.profile_image && user.profile_image !== data.data.profile_image) {
          const updatedUser = { ...user, profile_image: data.data.profile_image };
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          window.dispatchEvent(new CustomEvent('user_profile_updated'));
        }
      }
    } catch (err) {
      console.error('Failed to load vendor profile:', err);
    }
  };

  // Load Platform Categories & Rate Guardrails
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/v1/categories');
      const data = await res.json();
      if (data.success) {
        setCategoriesList(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // Load Portfolio Works
  const fetchPortfolio = async () => {
    if (!token) return;
    setLoadingPortfolio(true);
    try {
      const res = await fetch('/api/v1/portfolios/my', {
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
      const res = await fetch('/api/v1/bookings/vendor', {
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

  // Load Studio Reviews
  const fetchStudioReviews = async () => {
    if (!token) return;
    setLoadingReviews(true);
    try {
      const res = await fetch('/api/v1/reviews/studio', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStudioReviews(data.data || []);
        setStudioAvgRating(data.average_rating || 5.0);
      }
    } catch (err) {
      console.error('Failed to load studio reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Load Vendor Schedule & Availability Calendar
  const fetchSchedule = async () => {
    if (!token) return;
    setLoadingSchedule(true);
    try {
      const res = await fetch('/api/v1/schedule/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setScheduleData({
          bookings: data.bookings || [],
          blackouts: data.blackouts || [],
        });
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Unblock a blackout date
  const handleUnblockDate = async (blackoutId) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/schedule/block/${blackoutId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to unblock dates');
      setNotification({ type: 'success', message: 'Dates unblocked and opened for client bookings!' });
      fetchSchedule();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    setPortfolio([]);
    setVendorProfile(null);
    setBookings([]);
    setStudioReviews([]);
    setScheduleData({ bookings: [], blackouts: [] });

    fetchCategories();
    if (token && user?.id) {
      fetchProfile();
      fetchPortfolio();
      fetchBookings();
      fetchStudioReviews();
      fetchSchedule();
      fetchVendorComplaints();
      fetchUnreadStats();

      const socket = getSocket();
      const handleNotification = () => {
        fetchUnreadStats();
      };
      if (socket) {
        socket.on('chat_notification', handleNotification);
        socket.on('new_message', handleNotification);
        socket.on('messages_read', handleNotification);
      }

      return () => {
        if (socket) {
          socket.off('chat_notification', handleNotification);
          socket.off('new_message', handleNotification);
          socket.off('messages_read', handleNotification);
        }
      };
    }
  }, [user?.id, token, fetchUnreadStats]);

  // Handle Availability Toggle (Section 12 of Blueprint)
  const handleUpdateAvailability = async (newStatus) => {
    try {
      const res = await fetch('/api/v1/vendors/availability', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ availability_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update availability');

      setVendorProfile((prev) => ({ ...prev, availability_status: newStatus }));
      setNotification({
        type: 'success',
        message: `Availability status set to ${newStatus.replace('_', ' ').toUpperCase()}`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/v1/vendors/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editProfileData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      setVendorProfile(data.data);
      setNotification({ type: 'success', message: 'Studio profile updated successfully!' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Avatar Upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotification({ type: 'error', message: 'Please select a valid image file (PNG, JPG, WEBP).' });
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/vendors/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to upload profile photo');

      const newImageUrl = data.profile_image || data.data?.profile_image;
      setEditProfileData((prev) => ({ ...prev, profile_image: newImageUrl }));
      setVendorProfile((prev) => ({ ...prev, profile_image: newImageUrl }));
      if (user) {
        const updatedUser = { ...user, profile_image: newImageUrl };
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent('user_profile_updated'));
      }
      setNotification({ type: 'success', message: 'Profile photo updated successfully!' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Handle Remove Avatar
  const handleRemoveAvatar = async () => {
    try {
      setUploadingAvatar(true);
      const res = await fetch('/api/v1/vendors/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_image: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove photo');

      setEditProfileData((prev) => ({ ...prev, profile_image: '' }));
      setVendorProfile((prev) => ({ ...prev, profile_image: '' }));
      if (user) {
        const updatedUser = { ...user, profile_image: '' };
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent('user_profile_updated'));
      }
      setNotification({ type: 'success', message: 'Profile photo removed.' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Delete Portfolio Item
  const handleDeletePortfolio = async (id) => {
    if (!window.confirm('Are you sure you want to remove this work from your gallery?')) return;
    try {
      const res = await fetch(`/api/v1/portfolios/${id}`, {
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

  // Handle Booking Status Update (Accept or Decline with reason)
  const handleUpdateBookingStatus = async (bookingId, newStatus, rejectionReason = '') => {
    setUpdatingBookingId(bookingId);
    try {
      const res = await fetch(`/api/v1/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          rejection_reason: rejectionReason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update booking status');

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus, rejection_reason: rejectionReason } : b))
      );
      setNotification({
        type: 'success',
        message: newStatus === 'approved'
          ? 'You accepted the booking! The client has been notified to pay the advance deposit to confirm.'
          : newStatus === 'confirmed'
          ? 'You accepted the booking! The shoot is officially confirmed.'
          : 'You declined the booking request. The client and platform admin have been notified with your explanation.',
      });
      fetchSchedule();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  // Balance Payment Reminder States & Handlers
  const [remindingBookingId, setRemindingBookingId] = useState(null);
  const [reminderStatusMap, setReminderStatusMap] = useState({});

  const handleSendBalanceReminder = async (booking) => {
    const total = Number(booking.total_amount || 0);
    const paid = Number(booking.paid_amount || 0);
    const pendingBalance = Math.max(0, total - paid);

    if (pendingBalance <= 0) {
      alert('No pending balance due for this project.');
      return;
    }

    setRemindingBookingId(booking.id);
    try {
      const res = await fetch(`/api/v1/bookings/${booking.id}/remind-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setReminderStatusMap((prev) => ({
          ...prev,
          [booking.id]: {
            sent: true,
            timestamp: new Date().toISOString(),
          },
        }));
        setNotification({
          type: 'success',
          message: `🔔 Balance payment reminder sent to ${booking.customer_name || 'client'} for ₹${pendingBalance.toLocaleString()}!`,
        });
        fetchBookings();
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Failed to send balance reminder.',
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Network error while sending balance payment reminder.',
      });
    } finally {
      setRemindingBookingId(null);
    }
  };

  const handleRemindBalanceInChat = (booking) => {
    const total = Number(booking.total_amount || 0);
    const paid = Number(booking.paid_amount || 0);
    const pendingBalance = Math.max(0, total - paid);
    const prefilled = `Hi ${booking.customer_name || 'Client'}, the production deliverables for "${booking.project_name || 'Creative Production Shoot'}" are officially completed! Please settle the remaining balance amount of ₹${pendingBalance.toLocaleString()} on your dashboard. Thank you!`;
    onOpenChat?.({ bookingId: booking.id, customerId: booking.customer_id, scope: 'client' }, prefilled);
  };

  // Metrics
  const pendingRequestsCount = bookings.filter((b) => isRequest(b.status)).length;
  const confirmedCount = bookings.filter((b) => isActiveShoot(b.status) || b.status === 'deliverables_submitted').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const declinedCount = bookings.filter((b) => isDeclined(b.status)).length;
  const awaitingAdvanceCount = bookings.filter((b) => isPayable(b.status)).length;
  const totalValue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const currentAvailability = vendorProfile?.availability_status || 'available';
  const isAvailable = currentAvailability !== 'unavailable';
  const openDisputes = vendorComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed');

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'requests') return isRequest(b.status);
    if (bookingFilter === 'awaiting') return isPayable(b.status);
    if (bookingFilter === 'confirmed') return isActiveShoot(b.status) || b.status === 'deliverables_submitted';
    if (bookingFilter === 'completed') return b.status === 'completed';
    if (bookingFilter === 'cancelled') return isDeclined(b.status);
    return true;
  });

  const upcomingShoots = bookings
    .filter((b) => isActiveShoot(b.status) && isUpcoming(b))
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // Everything the vendor should act on, most urgent first
  const attentionItems = [
    ...bookings
      .filter((b) => isRequest(b.status))
      .map((b) => ({
        id: `req-${b.id}`,
        tone: 'amber',
        title: `New booking request from ${b.customer_name || 'a client'}`,
        detail: `${b.project_name || 'Production shoot'} · ${formatDateRange(b.start_date, b.end_date)} · ${formatINR(b.total_amount)}`,
        actions: [
          {
            label: 'Decline',
            variant: 'secondary',
            onClick: () => setDeclineModal({ isOpen: true, booking: b }),
            disabled: updatingBookingId === b.id,
          },
          {
            label: updatingBookingId === b.id ? 'Accepting…' : 'Accept',
            variant: 'success',
            onClick: () => handleUpdateBookingStatus(b.id, 'approved'),
            disabled: updatingBookingId === b.id,
          },
        ],
      })),
    ...openDisputes.map((c) => ({
      id: `dispute-${c.id}`,
      tone: 'red',
      title: `Open dispute${c.complaint_number ? ` #${c.complaint_number}` : ''}`,
      detail: c.subject || 'A client raised an issue with a booking',
      actions: [{ label: 'View dispute', variant: 'secondary', onClick: () => setActiveTab('disputes') }],
    })),
    ...bookings
      .filter((b) => isActiveShoot(b.status) && isPastShoot(b))
      .map((b) => ({
        id: `deliver-${b.id}`,
        tone: 'violet',
        title: `Deliver files for ${b.project_name || 'your shoot'}`,
        detail: `Shoot ended ${formatDate(b.end_date)} · ${b.customer_name || 'The client'} is waiting for the files`,
        actions: [{ label: 'Upload files', onClick: () => setDeliverablesModalBooking(b) }],
      })),
    ...bookings
      .filter((b) => b.status === 'completed' && getAmounts(b).balance > 0)
      .map((b) => ({
        id: `balance-${b.id}`,
        tone: 'blue',
        title: `${formatINR(getAmounts(b).balance)} balance due from ${b.customer_name || 'client'}`,
        detail: `${b.project_name || 'Production shoot'} · completed${b.last_balance_reminder_at ? ` · reminded ${formatDate(b.last_balance_reminder_at, false)}` : ''}`,
        actions: [
          {
            label: remindingBookingId === b.id ? 'Sending…' : 'Send reminder',
            variant: 'secondary',
            onClick: () => handleSendBalanceReminder(b),
            disabled: remindingBookingId === b.id,
          },
        ],
      })),
  ];

  const navSections = [
    {
      title: 'Workspace',
      items: [
        { key: 'home', label: 'Home', icon: Home },
        { key: 'bookings', label: 'Bookings', icon: CalendarCheck, badge: pendingRequestsCount },
        { key: 'schedule', label: 'Calendar', icon: Calendar },
        { key: 'gallery', label: 'Portfolio', icon: Images },
        { key: 'reviews', label: 'Reviews', icon: Star },
      ],
    },
    {
      title: 'Communication',
      items: [
        { key: 'messages', label: 'Messages', icon: MessageSquare, badge: clientUnread, onClick: () => onOpenChat?.({ scope: 'client' }) },
        { key: 'disputes', label: 'Disputes', icon: Scale, badge: openDisputes.length, badgeTone: 'red' },
        {
          key: 'support',
          label: 'Help & support',
          icon: Headphones,
          badge: adminUnread,
          badgeTone: 'red',
          onClick: () => setIsAdminSupportOpen(true),
        },
      ],
    },
    {
      title: 'Account',
      items: [{ key: 'profile', label: 'Studio profile', icon: Settings }],
    },
  ];

  // One booking, rendered as a card with a single clear next step
  const renderBookingCard = (b) => {
    const { total, paid, balance } = getAmounts(b);
    const status = getStatusMeta(b.status, 'vendor');
    const busy = updatingBookingId === b.id;
    const declined = isDeclined(b.status);
    const reminderSent = reminderStatusMap[b.id]?.timestamp || b.last_balance_reminder_at;

    let hint = null;
    let primary = null;
    let secondary = null;

    if (isRequest(b.status)) {
      hint = 'The client is waiting for your reply.';
      secondary = (
        <Button size="sm" variant="danger" onClick={() => setDeclineModal({ isOpen: true, booking: b })} disabled={busy}>
          Decline
        </Button>
      );
      primary = (
        <Button size="sm" variant="success" icon={Check} onClick={() => handleUpdateBookingStatus(b.id, 'approved')} disabled={busy}>
          {busy ? 'Accepting…' : 'Accept request'}
        </Button>
      );
    } else if (isPayable(b.status)) {
      hint = 'Waiting for the client to pay the advance.';
      secondary = (
        <Button size="sm" variant="secondary" onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')} disabled={busy}>
          Mark paid offline
        </Button>
      );
    } else if (isActiveShoot(b.status)) {
      hint = isPastShoot(b) ? 'Shoot is done — upload the files for your client.' : 'Shoot confirmed. Upload files once you are done.';
      secondary = (
        <Button size="sm" variant="secondary" onClick={() => handleUpdateBookingStatus(b.id, 'completed')} disabled={busy}>
          Mark completed
        </Button>
      );
      primary = (
        <Button size="sm" variant="primary" icon={UploadCloud} onClick={() => setDeliverablesModalBooking(b)}>
          Upload files
        </Button>
      );
    } else if (b.status === 'deliverables_submitted') {
      hint = 'Files delivered — waiting for the client to review.';
      secondary = (
        <Button size="sm" variant="secondary" icon={FolderOpen} onClick={() => setDeliverablesModalBooking(b)}>
          View files
        </Button>
      );
    } else if (b.status === 'completed') {
      hint = balance > 0
        ? reminderSent
          ? `Reminder sent ${formatDate(reminderSent, false)}.`
          : `${formatINR(balance)} is still due from the client.`
        : 'All done and paid.';
      secondary = (
        <Button size="sm" variant="secondary" icon={FolderOpen} onClick={() => setDeliverablesModalBooking(b)}>
          Files
        </Button>
      );
      if (balance > 0) {
        primary = (
          <Button size="sm" variant="warning" icon={Bell} onClick={() => handleSendBalanceReminder(b)} disabled={remindingBookingId === b.id}>
            {remindingBookingId === b.id ? 'Sending…' : 'Remind client'}
          </Button>
        );
      }
    }

    return (
      <article key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              {b.crew_bundle_id && (
                <span className="text-xs text-slate-500">
                  Crew booking · {b.crew_role || b.category_name || 'Specialist'}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">
              {b.project_name || b.resource_title || 'Production shoot'}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                {b.customer_name || 'Client'}
              </span>
              {b.customer_mobile && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {b.customer_mobile}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                {formatDateRange(b.start_date, b.end_date)}
                {b.duration ? ` · ${b.duration}` : ''}
              </span>
              {b.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {b.location}
                </span>
              )}
            </div>
            {declined && b.rejection_reason && (
              <p className="mt-2 text-sm text-rose-600">Reason given: “{b.rejection_reason}”</p>
            )}
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-lg font-bold text-slate-900">{formatINR(total)}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {total > 0 && balance <= 0 ? (
                <span className="text-emerald-600 font-medium">Paid in full</span>
              ) : (
                <>
                  Paid {formatINR(paid)} · <span className="text-amber-600 font-medium">Due {formatINR(balance)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {!declined && (
          <div className="px-5 pb-5">
            <ProgressSteps current={getStepIndex(b.status)} />
          </div>
        )}

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center gap-3">
          <p className="text-sm text-slate-500 flex-1">{hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onOpenChat?.({ bookingId: b.id, customerId: b.customer_id })}>
              Message
            </Button>
            {paid > 0 && (
              <Button size="sm" variant="ghost" icon={Receipt} onClick={() => setReceiptModalBooking(b)}>
                Receipt
              </Button>
            )}
            {secondary}
            {primary}
          </div>
        </div>
      </article>
    );
  };

  return (
    <DashboardShell
      sections={navSections}
      activeKey={activeTab}
      onSelect={setActiveTab}
      profile={{
        name: vendorProfile?.business_name || user?.name || 'Your studio',
        image: vendorProfile?.profile_image,
        subtitle: isAvailable ? 'Taking bookings' : 'Not taking bookings',
        statusTone: isAvailable ? 'green' : 'slate',
      }}
    >
      <Toast notification={notification} onClose={() => setNotification(null)} />

      {vendorProfile && vendorProfile.deposit_status !== 'paid' && vendorProfile.deposit_status !== 'waived' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Your studio is hidden from the marketplace</p>
            <p className="text-sm text-amber-800 mt-0.5">
              Pay the one-time listing deposit of {formatINR(vendorProfile.deposit_amount || 2000)} so clients can find and book you.
            </p>
          </div>
          <Button variant="warning" onClick={() => setIsDepositModalOpen(true)}>
            Pay deposit
          </Button>
        </div>
      )}

      {/* HOME: what needs attention today */}
      {activeTab === 'home' && (
        <div className="space-y-6">
          <PageHeader
            title={`${greeting()}, ${(user?.name || vendorProfile?.business_name || 'there').split(' ')[0]}`}
            description={
              attentionItems.length > 0
                ? `You have ${attentionItems.length} ${attentionItems.length === 1 ? 'thing' : 'things'} to take care of.`
                : "You're all caught up. Here's how your studio is doing."
            }
            actions={
              <>
                <Switch
                  checked={isAvailable}
                  onChange={(on) => handleUpdateAvailability(on ? 'available' : 'unavailable')}
                  label={isAvailable ? 'Taking bookings' : 'Not taking bookings'}
                />
                {vendorProfile?.deposit_status === 'paid' && (
                  <Button variant="secondary" icon={Receipt} onClick={() => setIsVendorDepositReceiptOpen(true)}>
                    Deposit receipt
                  </Button>
                )}
                <Button variant="primary" icon={Plus} onClick={() => setIsUploadModalOpen(true)}>
                  Upload work
                </Button>
              </>
            }
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="New requests"
              value={pendingRequestsCount}
              hint="Waiting for your reply"
              icon={Inbox}
              onClick={() => {
                setActiveTab('bookings');
                setBookingFilter('requests');
              }}
            />
            <StatTile
              label="Upcoming shoots"
              value={upcomingShoots.length}
              hint="Confirmed with clients"
              icon={CalendarCheck}
              onClick={() => {
                setActiveTab('bookings');
                setBookingFilter('confirmed');
              }}
            />
            <StatTile label="Earnings" value={formatINR(totalValue)} hint="Confirmed & completed work" icon={Wallet} />
            <StatTile
              label="Rating"
              value={`${studioAvgRating} / 5`}
              hint={`${studioReviews.length} ${studioReviews.length === 1 ? 'review' : 'reviews'}`}
              icon={Star}
              onClick={() => setActiveTab('reviews')}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <Section
              className="xl:col-span-2"
              title="Needs your attention"
              action={
                <Button size="sm" variant="ghost" onClick={() => setActiveTab('bookings')}>
                  All bookings
                  <ChevronRight className="w-4 h-4" />
                </Button>
              }
            >
              <AttentionList items={attentionItems} emptyText="New requests and follow-ups will show up here." />
            </Section>

            <Section
              title="Upcoming shoots"
              action={
                <Button size="sm" variant="ghost" onClick={() => setActiveTab('schedule')}>
                  Calendar
                </Button>
              }
            >
              {upcomingShoots.length === 0 ? (
                <p className="px-5 py-10 text-sm text-slate-500 text-center">No upcoming shoots yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingShoots.slice(0, 5).map((b) => (
                    <li key={b.id} className="px-5 py-3 flex items-center gap-3">
                      <DateChip date={b.start_date} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{b.project_name || 'Production shoot'}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {b.customer_name || 'Client'} · {b.location || b.duration || '1 day'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenChat?.({ bookingId: b.id, customerId: b.customer_id })}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Message client"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
      {/* TAB 1: GALLERY MANAGEMENT */}
      {activeTab === 'gallery' && (
        <div>
          <PageHeader
            title="Portfolio"
            description="Show clients your best work. Photos, videos and PDFs all appear on your public profile."
            actions={
              <Button variant="primary" icon={Plus} onClick={() => setIsUploadModalOpen(true)}>
                Upload work
              </Button>
            }
          />

          {loadingPortfolio ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading your gallery works...
            </div>
          ) : portfolio.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <h3 className="text-sm font-bold text-slate-800">Your Gallery is Empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload your photography, film reels, or gear kits so clients can discover and book you.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Upload First Work</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {portfolio.map((work) => {
                const isExternal =
                  work.media_url &&
                  !work.media_url.startsWith('/uploads') &&
                  !work.media_url.includes('127.0.0.1:5000/uploads') &&
                  !work.media_url.includes('localhost:5000/uploads');
                const isInstagram = work.media_url && /(?:instagram\.com|instagr\.am)/i.test(work.media_url);
                const isYouTube = work.media_url && /(?:youtube\.com|youtu\.be)/i.test(work.media_url);

                const handleCardAction = () => {
                  if (isExternal) {
                    window.open(work.media_url, '_blank', 'noopener,noreferrer');
                  } else {
                    setSelectedPreviewWork(work);
                  }
                };

                return (
                  <div
                    key={work.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div
                      onClick={handleCardAction}
                      className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      <PortfolioMediaViewer
                        mediaUrl={work.media_url}
                        thumbnailUrl={work.thumbnail_url}
                        mediaType={work.media_type}
                        title={work.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2.5 right-2.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs pointer-events-none z-10">
                        {work.media_type === 'document' ? 'PDF Document' : work.media_type === 'video' ? 'Video' : 'Photograph'}
                      </span>
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                        <span className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-xs font-semibold rounded-xl shadow-md flex items-center gap-1.5">
                          {isInstagram ? (
                            <><span>↗</span> Open on Instagram</>
                          ) : isYouTube ? (
                            <><span>↗</span> Watch on YouTube</>
                          ) : isExternal ? (
                            <><span>↗</span> Open Link</>
                          ) : (
                            <>Click to Preview</>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            onClick={handleCardAction}
                            className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            {work.title}
                          </h3>
                          <button
                            type="button"
                            onClick={handleCardAction}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            {isInstagram ? 'Open Reel ↗' : isYouTube ? 'Watch Video ↗' : isExternal ? 'Open Link ↗' : 'Preview ↗'}
                          </button>
                        </div>
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
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePortfolio(work.id);
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* BOOKINGS: requests, upcoming shoots and history */}
      {activeTab === 'bookings' && (
        <div>
          <PageHeader title="Bookings" description="Reply to requests, keep track of confirmed shoots and get paid." />

          <div className="mb-4">
            <FilterTabs
              value={bookingFilter}
              onChange={setBookingFilter}
              options={[
                { key: 'all', label: 'All', count: bookings.length },
                { key: 'requests', label: 'New requests', count: pendingRequestsCount, highlight: true },
                { key: 'awaiting', label: 'Waiting for advance', count: awaitingAdvanceCount },
                { key: 'confirmed', label: 'Upcoming', count: confirmedCount },
                { key: 'completed', label: 'Completed', count: completedCount },
                { key: 'cancelled', label: 'Declined', count: declinedCount },
              ]}
            />
          </div>

          {loadingBookings ? (
            <LoadingCard text="Loading your bookings…" />
          ) : filteredBookings.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={bookingFilter === 'all' ? 'No bookings yet' : 'Nothing in this view'}
              text="When clients book you, their requests will show up here so you can accept or decline them."
            />
          ) : (
            <div className="space-y-3">{filteredBookings.map(renderBookingCard)}</div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILE & SKILLS MANAGEMENT (MATCHING REFERENCE DESIGN) */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Top Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
            <h2 className="text-2xl font-bold text-slate-700">Profile & Skills</h2>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Listing Active</span>
              </span>

              <button
                type="button"
                onClick={() => window.open('/creatives', '_blank')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                Preview Public Profile
              </button>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 3 Structured Cards (8 Cols) */}
              <div className="lg:col-span-8 space-y-6">
                {/* Card 1: Studio & Discipline Identity */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Studio & Discipline Identity</h3>

                  {/* Profile Photo / Avatar Upload Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 mb-4 border-b border-slate-100">
                    <div className="relative group shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-xs">
                        {editProfileData.profile_image ? (
                          <img
                            src={resolveMediaUrl(editProfileData.profile_image)} onError={hideBrokenImage}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl sm:text-2xl font-bold text-slate-400">
                            {(editProfileData.business_name || 'S').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-slate-900/60 rounded-2xl flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                          className="hidden"
                          id="profile-avatar-input"
                        />
                        <button
                          type="button"
                          disabled={uploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>{editProfileData.profile_image ? 'Change Photo' : 'Upload Profile Photo'}</span>
                        </button>

                        {editProfileData.profile_image && (
                          <button
                            type="button"
                            disabled={uploadingAvatar}
                            onClick={handleRemoveAvatar}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        JPG, PNG, GIF or WEBP. Max 10MB. Recommended square 400×400px.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        STUDIO / ARTIST NAME
                      </label>
                      <input
                        type="text"
                        required
                        value={editProfileData.business_name}
                        onChange={(e) => setEditProfileData({ ...editProfileData, business_name: e.target.value })}
                        className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          PRIMARY DISCIPLINE / SPECIALTY
                        </label>
                        {categoriesList.length > 0 ? (
                          <select
                            value={editProfileData.skills}
                            onChange={(e) => {
                              const newSkill = e.target.value;
                              const cat = categoriesList.find((c) => c.name === newSkill);
                              const newPrice = cat ? cat.recommended_daily_rate : editProfileData.pricing;
                              setEditProfileData({
                                ...editProfileData,
                                skills: newSkill,
                                pricing: newPrice,
                              });
                            }}
                            className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                          >
                            <option value="">-- Select Creative Specialty --</option>
                            {categoriesList.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. Cinematographers"
                            value={editProfileData.skills}
                            onChange={(e) => setEditProfileData({ ...editProfileData, skills: e.target.value })}
                            className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          BASE LOCATION
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Kochi, Kerala"
                          value={editProfileData.location}
                          onChange={(e) => setEditProfileData({ ...editProfileData, location: e.target.value })}
                          className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        YEARS OF COMMERCIAL EXPERIENCE
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 3 – 5 Years"
                        value={editProfileData.experience}
                        onChange={(e) => setEditProfileData({ ...editProfileData, experience: e.target.value })}
                        className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
                <br />

                {/* Card 2: Commercial Pricing & Market Standards */}
                {(() => {
                  const matchedCategory = categoriesList.find(
                    (c) =>
                      (editProfileData.skills || vendorProfile?.skills || '').toLowerCase() === c.name.toLowerCase() ||
                      (editProfileData.skills || vendorProfile?.skills || '').toLowerCase().includes(c.name.toLowerCase()) ||
                      c.name.toLowerCase().includes((editProfileData.skills || vendorProfile?.skills || '').toLowerCase())
                  );
                  const minRate = matchedCategory ? Number(matchedCategory.min_daily_rate) : 5000;
                  const recRate = matchedCategory ? Number(matchedCategory.recommended_daily_rate) : 18000;
                  const maxRate = matchedCategory ? Number(matchedCategory.max_daily_rate) : 50000;
                  const currentRate = Number(editProfileData.pricing || 0);

                  const isTooLow = currentRate > 0 && currentRate < minRate;
                  const isTooHigh = currentRate > maxRate;
                  const isValid = currentRate >= minRate && currentRate <= maxRate;

                  return (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Commercial Pricing & Market Standards</h3>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          Admin Governed
                        </span>
                      </div>

                      {/* Official Market Wage Standards Metric Box */}
                      <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Floor</span>
                            <span className="font-mono font-bold text-slate-800 text-sm">₹{minRate.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-600 block mb-1">Benchmark</span>
                            <span className="font-mono font-bold text-indigo-600 text-sm">₹{recRate.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cap</span>
                            <span className="font-mono font-bold text-slate-800 text-sm">₹{maxRate.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Seniority & Experience Level */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                          SENIORITY & EXPERIENCE LEVEL
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'entry', label: 'Rising Talent', sub: 'Early Career', mult: 0.6 },
                            { id: 'mid', label: 'Established Pro', sub: 'Standard', mult: 1.0 },
                            { id: 'senior', label: 'Studio Master', sub: 'Elite Director', mult: 1.7 },
                          ].map((tier) => {
                            const isSelected = editProfileData.experience_level === tier.id || (!editProfileData.experience_level && tier.id === 'mid');
                            const suggestedPrice = Math.min(
                              Math.max(Math.round((recRate * tier.mult) / 500) * 500, minRate),
                              maxRate
                            );
                            return (
                              <button
                                key={tier.id}
                                type="button"
                                onClick={() => {
                                  setEditProfileData({
                                    ...editProfileData,
                                    experience_level: tier.id,
                                    pricing: suggestedPrice,
                                  });
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                                  isSelected
                                    ? 'bg-white border-2 border-indigo-500 shadow-xs ring-0'
                                    : 'bg-white border-slate-200/80 hover:bg-slate-50/70 text-slate-700'
                                }`}
                              >
                                {isSelected && (
                                  <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    ✓
                                  </span>
                                )}
                                <div className="text-xs font-bold text-slate-900">{tier.label}</div>
                                <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-600 font-medium' : 'text-slate-400'}`}>
                                  {tier.sub}
                                </div>
                                <div className="text-[11px] font-mono font-semibold text-indigo-600 mt-2">
                                  ~₹{suggestedPrice.toLocaleString()}/day
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Pricing Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            DAILY BASE RATE (₹)
                          </label>
                          <input
                            type="number"
                            placeholder={`e.g. ${recRate}`}
                            value={editProfileData.pricing}
                            onChange={(e) => setEditProfileData({ ...editProfileData, pricing: e.target.value })}
                            className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            PRICING UNIT
                          </label>
                          <select
                            value={editProfileData.pricing_unit}
                            onChange={(e) => setEditProfileData({ ...editProfileData, pricing_unit: e.target.value })}
                            className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                          >
                            <option value="day">Per Day (Standard Daily Wage)</option>
                            <option value="hour">Per Hour</option>
                            <option value="project">Per Project</option>
                          </select>
                        </div>
                      </div>

                      {/* Compliance Banner */}
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-700 text-xs font-medium flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>Standard compliant rate for {matchedCategory?.name || editProfileData.skills || 'Cinematographers'}</span>
                      </div>
                    </div>
                  );
                })()}
                <br />

                {/* Card 3: Professional Bio & Artist Statement */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Professional Bio & Artist Statement</h3>

                  <textarea
                    rows="4"
                    value={editProfileData.bio}
                    onChange={(e) => setEditProfileData({ ...editProfileData, bio: e.target.value })}
                    className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-normal leading-relaxed"
                  />

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Last updated today
                    </span>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 bg-[#4f46e5] hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Marketplace Profile Preview & Verification Card (4 Cols) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Live Client Preview Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      LIVE MARKETPLACE CARD
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      Client Preview
                    </span>
                  </div>

                  {/* Card mockup */}
                  <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs overflow-hidden shrink-0">
                        {editProfileData.profile_image ? (
                          <img src={resolveMediaUrl(editProfileData.profile_image)} onError={hideBrokenImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (editProfileData.business_name || 'S').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {editProfileData.business_name || 'SNGCE'}
                          </h4>
                          <span className="text-blue-500 text-xs font-bold">✓</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {editProfileData.skills || 'Cinematographers'}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1.5 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Location</span>
                        <span className="font-semibold text-slate-900">{editProfileData.location || 'Kochi, Kerala'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Experience</span>
                        <span className="font-semibold text-slate-900">{editProfileData.experience || '3 – 5 Years'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Standard Rate</span>
                        <span className="font-bold text-slate-900 font-mono">
                          ₹{Number(editProfileData.pricing || 18000).toLocaleString()} / {editProfileData.pricing_unit || 'day'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200/60 leading-relaxed font-serif">
                      "{editProfileData.bio || 'proffesional video editor & colorist specializing in commercial cinematography'}"
                    </p>
                  </div>
                </div>
                <br />

                {/* Studio Status & Standing */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3.5">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                    STUDIO STATUS & STANDING
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Verification</span>
                      <span className="font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-[11px]">
                        Verified Studio
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Wage Compliance</span>
                      <span className="font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full text-[11px]">
                        Standard Compliant
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Marketplace Search</span>
                      <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Active & Indexed</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= TAB: DISPUTES & COMPLAINTS DESK ================= */}
      {activeTab === 'disputes' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Project Disputes & Client Grievances</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review complaints raised by clients and provide your official statement to platform administration.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
              Total Disputes: {vendorComplaints.length}
            </span>
          </div>

          {loadingComplaints ? (
            <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading dispute records...
            </div>
          ) : vendorComplaints.length === 0 ? (
            <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded-2xl space-y-2">
              <h4 className="text-sm font-bold text-slate-800">Clean Dispute Record</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No complaints or grievances reported for your studio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {vendorComplaints.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-600">
                        #{c.complaint_number}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {c.project_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({new Date(c.created_at).toLocaleDateString()})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.status !== 'resolved' && c.status !== 'dismissed' && !c.settlement_agreed && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          c.is_expired ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}>
                          {c.is_expired ? 'SLA Expired (Arbitration)' : `1-Wk SLA: ${c.days_remaining ?? 7}d left (${c.hours_remaining ?? 168}h)`}
                        </span>
                      )}
                      {c.settlement_agreed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                          Escrow Adjusted: ₹{Number(c.settlement_amount || 0).toLocaleString()}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                          c.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.status === 'dismissed'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>Client: <strong className="text-slate-900">{c.customer_name}</strong></span>
                      <span>&bull;</span>
                      <span>Category: <strong className="text-rose-700 capitalize">{c.category.replace('_', ' ')}</strong></span>
                      <span>&bull;</span>
                      <span>Subject: <strong className="text-slate-900">{c.subject}</strong></span>
                    </div>

                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-950 font-medium leading-relaxed">
                      &ldquo;{c.description}&rdquo;
                    </div>

                    {c.vendor_response ? (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 text-xs">
                        <span className="font-bold block mb-1">Your Submitted Statement:</span>
                        <p className="italic">&ldquo;{c.vendor_response}&rdquo;</p>
                      </div>
                    ) : (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            setSelectedDisputeModal(c);
                            setVendorExplanationText('');
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Submit Official Explanation &rarr;</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB: CLIENT REVIEWS ================= */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Verified Client Reviews & Ratings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Client feedback and ratings submitted after completed productions.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl self-start sm:self-auto">
              <span className="text-2xl text-amber-500">★</span>
              <div>
                <span className="text-base font-black text-slate-900 leading-none block">
                  {studioAvgRating} / 5.0
                </span>
                <span className="text-[10px] text-amber-800 font-semibold block">
                  Based on {studioReviews.length} verified {studioReviews.length === 1 ? 'shoot' : 'shoots'}
                </span>
              </div>
            </div>
          </div>

          {loadingReviews ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
              Loading client reviews...
            </div>
          ) : studioReviews.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-xs">
              <h3 className="text-sm font-bold text-slate-800">No Client Reviews Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once your clients mark assigned shoots as completed and submit their feedback, their verified reviews will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studioReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 text-sm">{'★'.repeat(rev.rating)}</span>
                        <span className="text-xs font-bold text-slate-800">({rev.rating}/5)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(rev.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed italic bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium uppercase">Client</span>
                      <strong className="text-slate-800">{rev.customer_name}</strong>
                    </div>
                    {rev.project_name && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium uppercase">Production</span>
                        <span className="text-slate-600 font-medium">{rev.project_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB: SCHEDULE & CALENDAR ================= */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-heading">Studio Schedule & Calendar</h2>
            </div>

            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Block Dates</span>
            </button>
          </div>

          {/* Balanced Split Layout: Calendar on Left, Schedule Breakdown on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Compact Rich Calendar (7 Cols) */}
            <div className="lg:col-span-7 xl:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              {/* Calendar Controls & Legend */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                {/* Month Navigator */}
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900 font-heading min-w-[130px]">
                    {currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>

                  <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(currentCalendarDate);
                        d.setMonth(d.getMonth() - 1);
                        setCurrentCalendarDate(d);
                      }}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentCalendarDate(new Date())}
                      className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-md transition-all cursor-pointer"
                    >
                      Today
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(currentCalendarDate);
                        d.setMonth(d.getMonth() + 1);
                        setCurrentCalendarDate(d);
                      }}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Shoot</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Off-Duty</span>
                  </span>
                </div>
              </div>

              {/* Calendar Days Grid */}
              {(() => {
                const year = currentCalendarDate.getFullYear();
                const month = currentCalendarDate.getMonth();
                const firstDayOfWeek = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const daysInPrevMonth = new Date(year, month, 0).getDate();
                const todayStr = new Date().toISOString().split('T')[0];

                // Previous month trailing days to eliminate empty blank holes
                const prevDays = [];
                for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                  prevDays.push({
                    day: daysInPrevMonth - i,
                    isCurrentMonth: false,
                    dateStr: null,
                  });
                }

                // Current month days
                const currentDays = [];
                let currentMonthBookedDays = 0;
                let currentMonthBlockedDays = 0;

                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                  const activeBooking = scheduleData.bookings.find((b) => {
                    if (b.status === 'cancelled' || b.status === 'rejected') return false;
                    const s = b.start_date.split('T')[0];
                    const e = b.end_date.split('T')[0];
                    return dateStr >= s && dateStr <= e;
                  });

                  const activeBlackout = scheduleData.blackouts.find((bl) => {
                    const s = bl.start_date.split('T')[0];
                    const e = bl.end_date.split('T')[0];
                    return dateStr >= s && dateStr <= e;
                  });

                  if (activeBooking) currentMonthBookedDays++;
                  if (activeBlackout) currentMonthBlockedDays++;

                  currentDays.push({
                    day: d,
                    isCurrentMonth: true,
                    dateStr,
                    isToday: dateStr === todayStr,
                    activeBooking,
                    activeBlackout,
                  });
                }

                // Next month leading days to complete grid
                const totalCellsSoFar = prevDays.length + currentDays.length;
                const nextDaysCount = (7 - (totalCellsSoFar % 7)) % 7;
                const nextDays = [];
                for (let d = 1; d <= nextDaysCount; d++) {
                  nextDays.push({
                    day: d,
                    isCurrentMonth: false,
                    dateStr: null,
                  });
                }

                const allCells = [...prevDays, ...currentDays, ...nextDays];
                const availableDays = Math.max(0, daysInMonth - currentMonthBookedDays - currentMonthBlockedDays);
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                return (
                  <div>
                    <div className="grid grid-cols-7 text-center mb-1.5">
                      {dayNames.map((n) => (
                        <div key={n} className="text-[10px] font-semibold text-slate-400 uppercase py-1">
                          {n}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {allCells.map((cell, index) => {
                        if (!cell.isCurrentMonth) {
                          return (
                            <div
                              key={`other-${index}`}
                              className="min-h-[54px] sm:min-h-[62px] p-1.5 rounded-lg bg-slate-50/50 border border-slate-100 text-slate-300 select-none flex flex-col justify-start"
                            >
                              <span className="text-[10px] font-medium text-slate-300">{cell.day}</span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={cell.dateStr}
                            className={`min-h-[54px] sm:min-h-[62px] p-1.5 rounded-lg border transition-all flex flex-col justify-between ${
                              cell.activeBooking
                                ? 'bg-rose-50/70 border-rose-200'
                                : cell.activeBlackout
                                ? 'bg-amber-50/70 border-amber-200'
                                : 'bg-white border-slate-200/80 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                                  cell.isToday
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'text-slate-800'
                                }`}
                              >
                                {cell.day}
                              </span>
                              {cell.activeBooking && (
                                <span className="text-[8px] font-bold text-rose-700 bg-rose-100/90 px-1 py-0.2 rounded">
                                  Shoot
                                </span>
                              )}
                              {cell.activeBlackout && (
                                <button
                                  type="button"
                                  onClick={() => handleUnblockDate(cell.activeBlackout.id)}
                                  title="Unblock date"
                                  className="text-[10px] text-amber-800 hover:text-rose-700 p-0.5 rounded cursor-pointer transition-colors"
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            <div className="mt-0.5 flex-1 flex flex-col justify-end">
                              {cell.activeBooking ? (
                                <div className="text-[9px] text-rose-900 font-medium truncate leading-tight">
                                  <span className="block truncate font-bold">{cell.activeBooking.project_name || 'Shoot'}</span>
                                  <span className="text-[8px] text-rose-600 block truncate">
                                    {cell.activeBooking.customer_name}
                                  </span>
                                </div>
                              ) : cell.activeBlackout ? (
                                <div className="text-[9px] text-amber-900 font-medium truncate leading-tight">
                                  <span className="block truncate font-bold">{cell.activeBlackout.reason || 'Off-Duty'}</span>
                                  <span className="text-[8px] text-amber-600 block">Unavailable</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Rich Month Availability Summary Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3.5">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-slate-800">{availableDays}</span>
                          <span className="text-slate-500 text-[11px]">Available</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="font-bold text-slate-800">{currentMonthBookedDays}</span>
                          <span className="text-slate-500 text-[11px]">Booked</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="font-bold text-slate-800">{currentMonthBlockedDays}</span>
                          <span className="text-slate-500 text-[11px]">Off-Duty</span>
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {Math.round((availableDays / daysInMonth) * 100)}% Open
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Schedule Breakdown (5 Cols) */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6">
              {/* Active Blackouts */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Off-Duty & Blocked Ranges
                  </h3>
                  <button
                    onClick={() => setIsBlockModalOpen(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    + Add Block
                  </button>
                </div>

                {scheduleData.blackouts.length === 0 ? (
                  <div className="py-7 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium">No blocked dates.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Your studio is available to accept bookings on all open days.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto no-scrollbar max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                          <th className="pb-2.5 pr-2 font-semibold">Reason</th>
                          <th className="pb-2.5 px-2 font-semibold">Start</th>
                          <th className="pb-2.5 px-2 font-semibold">End</th>
                          <th className="pb-2.5 pl-2 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scheduleData.blackouts.map((bl) => {
                          const startDate = new Date(bl.start_date);
                          const endDate = new Date(bl.end_date);
                          return (
                            <tr key={bl.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 pr-2 font-semibold text-slate-900">
                                <span className="block truncate max-w-[110px] sm:max-w-[140px]" title={bl.reason || 'Off-Duty'}>
                                  {bl.reason || 'Off-Duty'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap text-[11px]">
                                {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap text-[11px]">
                                {endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleUnblockDate(bl.id)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline transition-colors cursor-pointer"
                                >
                                  Unblock
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <br />
          

              {/* Confirmed Platform Shoots */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Scheduled Client Shoots
                  </h3>
                </div>

                {scheduleData.bookings.length === 0 ? (
                  <div className="py-7 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium">No confirmed shoots scheduled yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                    {scheduleData.bookings.map((bk) => (
                      <div
                        key={bk.id}
                        className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-300 transition-colors"
                      >
                        <div>
                          <strong className="text-slate-900 block font-bold">
                            {bk.project_name}
                            {bk.crew_bundle_id && (
                              <span className="ml-2 text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                                Crew: {bk.crew_role || bk.crew_bundle_name}
                              </span>
                            )}
                          </strong>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            Client: {bk.customer_name || 'Client'} &bull; {new Date(bk.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &rarr; {new Date(bk.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-800 font-mono block">
                            ₹{Number(bk.total_amount || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                            {bk.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK DATES MODAL */}
      {isBlockModalOpen && (
        <BlockDatesModal
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          onSuccess={() => {
            setIsBlockModalOpen(false);
            setNotification({ type: 'success', message: 'Dates successfully marked as unavailable!' });
            fetchSchedule();
          }}
          token={token}
        />
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

      {/* FULL WORK PREVIEW MODAL / LIGHTBOX */}
      {selectedPreviewWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {selectedPreviewWork.media_type === 'document'
                    ? 'PDF Lookbook'
                    : selectedPreviewWork.media_type === 'video'
                    ? 'Video / Reel'
                    : 'Photograph'}
                </span>
                <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                  {selectedPreviewWork.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewWork(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Media Container */}
            <div className="relative bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[55vh] overflow-hidden">
              <PortfolioMediaViewer
                mediaUrl={selectedPreviewWork.media_url}
                thumbnailUrl={selectedPreviewWork.thumbnail_url}
                mediaType={selectedPreviewWork.media_type}
                title={selectedPreviewWork.title}
                className="max-h-[55vh] w-full object-contain"
              />
            </div>

            {/* Details Footer */}
            <div className="p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                {selectedPreviewWork.description ? (
                  <p className="text-xs text-slate-700 leading-relaxed max-w-md">
                    {selectedPreviewWork.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No additional gear or production notes.</p>
                )}
                <span className="text-[11px] text-slate-400 mt-1 block font-mono">
                  Uploaded on {new Date(selectedPreviewWork.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <a
                  href={
                    selectedPreviewWork.media_url?.startsWith('/uploads')
                      ? `${selectedPreviewWork.media_url}`
                      : selectedPreviewWork.media_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open Full Link</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE / REJECT BOOKING MODAL */}
      {declineModal.isOpen && (
        <DeclineBookingModal
          isOpen={declineModal.isOpen}
          booking={declineModal.booking}
          onClose={() => setDeclineModal({ isOpen: false, booking: null })}
          onConfirm={async (bookingId, reason) => {
            await handleUpdateBookingStatus(bookingId, 'rejected', reason);
            setDeclineModal({ isOpen: false, booking: null });
          }}
        />
      )}

      {/* VENDOR ONBOARDING LISTING DEPOSIT MODAL */}
      {vendorProfile && (
        <VendorDepositModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          token={token}
          vendorProfile={vendorProfile}
          onSuccess={(updatedProfile) => {
            setIsDepositModalOpen(false);
            setVendorProfile(updatedProfile);
            setNotification({
              type: 'success',
              message: 'Listing deposit confirmed! Your studio is now live on the marketplace.',
            });
          }}
        />
      )}

      {/* VENDOR DISPUTE EXPLANATION MODAL */}
      {selectedDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Dispute Resolution: #{selectedDisputeModal.complaint_number}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Project: {selectedDisputeModal.project_name} &bull; Client: {selectedDisputeModal.customer_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDisputeModal(null)}
                className="text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 1-Week Resolution SLA Timer Banner */}
            {selectedDisputeModal.status !== 'resolved' && selectedDisputeModal.status !== 'dismissed' && !selectedDisputeModal.settlement_agreed && (
              <div className={`p-3.5 rounded-xl border text-xs shadow-xs ${
                selectedDisputeModal.is_expired ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-amber-50/80 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{selectedDisputeModal.is_expired ? 'Mutual Settlement SLA Expired' : '1-Week Mutual Settlement SLA Active'}</span>
                  <span className="font-mono text-[11px]">
                    {selectedDisputeModal.is_expired ? 'In Platform Arbitration' : `${selectedDisputeModal.days_remaining ?? 7} days remaining (${selectedDisputeModal.hours_remaining ?? 168}h)`}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700">
                  {selectedDisputeModal.is_expired
                    ? 'The 1-week mutual settlement window has expired. Platform administration is conducting binding arbitration.'
                    : 'You have 1 week from dispute filing to accept the client’s terms or propose an alternate counter-offer. Amicable settlements adjust booking escrow automatically.'}
                </p>
              </div>
            )}

            {/* Customer's Claim Card */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <span className="font-bold text-amber-950 block">Customer's Claim:</span>
              <p className="text-amber-900 leading-relaxed italic">
                &ldquo;{selectedDisputeModal.description}&rdquo;
              </p>
            </div>

            {/* Client's Proposed Resolution Callout */}
            {(selectedDisputeModal.desired_resolution_type || selectedDisputeModal.desired_resolution || selectedDisputeModal.desired_resolution_amount > 0) && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-1.5 text-emerald-950">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>Client's Proposed Settlement Terms:</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    Direct Settlement
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs pt-0.5">
                  <span className="font-medium text-emerald-900">
                    Desired Outcome: <strong className="capitalize">{(selectedDisputeModal.desired_resolution_type || selectedDisputeModal.desired_resolution)?.replace(/_/g, ' ')}</strong>
                  </span>
                  {Number(selectedDisputeModal.desired_resolution_amount || selectedDisputeModal.claimed_amount) > 0 && (
                    <span className="font-mono font-bold text-sm text-slate-900">
                      ₹{Number(selectedDisputeModal.desired_resolution_amount || selectedDisputeModal.claimed_amount).toLocaleString()}
                    </span>
                  )}
                </div>
                {selectedDisputeModal.desired_resolution_details && (
                  <p className="text-emerald-800 italic text-[11px] pt-1 border-t border-emerald-200">
                    &ldquo;{selectedDisputeModal.desired_resolution_details}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Navigation Tabs for Actions */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDisputeActionTab('settle')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  disputeActionTab === 'settle'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Accept Client Offer
              </button>
              <button
                type="button"
                onClick={() => setDisputeActionTab('counter')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  disputeActionTab === 'counter'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Submit Counter-Offer
              </button>
              <button
                type="button"
                onClick={() => setDisputeActionTab('statement')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  disputeActionTab === 'statement'
                    ? 'bg-white text-purple-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Defense
              </button>
            </div>

            {/* TAB 1: ACCEPT CLIENT OFFER */}
            {disputeActionTab === 'settle' && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-slate-800 space-y-3">
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">Amicable Direct Settlement</h4>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Accepting the client's proposal will immediately mark this dispute as resolved without negative platform strikes or waiting for administrator intervention.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Proposed Settlement:</span>
                    <strong className="text-emerald-800 uppercase">
                      {(selectedDisputeModal.desired_resolution_type || selectedDisputeModal.desired_resolution)?.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  {Number(selectedDisputeModal.desired_resolution_amount || selectedDisputeModal.claimed_amount) > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Agreed Refund Value:</span>
                      <strong className="font-mono text-slate-900">
                        ₹{Number(selectedDisputeModal.desired_resolution_amount || selectedDisputeModal.claimed_amount).toLocaleString()}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeModal(null)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={acceptingClientOffer}
                    onClick={handleAcceptClientOffer}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{acceptingClientOffer ? 'Accepting & Resolving...' : 'Confirm & Settle Dispute Now'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PROPOSE COUNTER-OFFER */}
            {disputeActionTab === 'counter' && (
              <form onSubmit={handleSubmitCounterOffer} className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  Propose alternative terms if you cannot accept the client's original proposal. The client can accept your terms to settle immediately.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Counter Settlement Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={counterOfferType}
                      onChange={(e) => setCounterOfferType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
                    >
                      <option value="partial_refund">Partial Goodwill Refund (₹)</option>
                      <option value="reshoot_reedit">Free Reshoot / Edit Revision</option>
                      <option value="raw_assets">Delivery of Raw Footage / Assets</option>
                      <option value="other">Alternative Settlement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Offered Amount (₹) {counterOfferType === 'partial_refund' ? '*' : '(Optional)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 1000"
                        value={counterOfferAmount}
                        onChange={(e) => setCounterOfferAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Specific Counter-Terms / Explanation <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Can provide ₹1,000 refund + deliver 5 free retouched stills by tomorrow evening..."
                    value={counterOfferDetails}
                    onChange={(e) => setCounterOfferDetails(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!counterOfferDetails.trim() || submittingCounterOffer}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingCounterOffer ? 'Sending...' : 'Deliver Counter-Offer to Client &rarr;'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: ADMIN STATEMENT / DEFENSE */}
            {disputeActionTab === 'statement' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!vendorExplanationText.trim() || submittingExplanation) return;
                  setSubmittingExplanation(true);
                  try {
                    const res = await fetch(`/api/v1/complaints/${selectedDisputeModal.id}/vendor-response`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ explanation: vendorExplanationText.trim() }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setSelectedDisputeModal(null);
                      setVendorExplanationText('');
                      fetchVendorComplaints();
                      setNotification({
                        type: 'success',
                        message: 'Your official explanation was submitted to platform administration.',
                      });
                    } else {
                      alert(data.message || 'Failed to submit explanation.');
                    }
                  } catch (err) {
                    alert('Network error. Please try again.');
                  } finally {
                    setSubmittingExplanation(false);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Official Statement & Defense <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Explain production circumstances, timeline compliance, shoot delivery proof, or reasons for disagreement..."
                    value={vendorExplanationText}
                    onChange={(e) => setVendorExplanationText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!vendorExplanationText.trim() || submittingExplanation}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingExplanation ? 'Submitting...' : 'Submit to Admin Desk &rarr;'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Official Transaction Receipt Modal for Bookings */}
      <ReceiptModal
        isOpen={Boolean(receiptModalBooking)}
        bookingId={receiptModalBooking?.id}
        token={token}
        onClose={() => setReceiptModalBooking(null)}
      />

      {/* Official Listing Deposit Receipt Modal */}
      <ReceiptModal
        isOpen={isVendorDepositReceiptOpen}
        vendorId={vendorProfile?.id}
        token={token}
        onClose={() => setIsVendorDepositReceiptOpen(false)}
      />

      {/* Dedicated Platform Administration Support Desk Modal */}
      <AdminSupportDeskModal
        isOpen={isAdminSupportOpen}
        onClose={() => {
          setIsAdminSupportOpen(false);
          fetchUnreadStats();
        }}
        user={user}
        token={token}
      />

      {/* Project Deliverables & Media Vault Modal */}
      <DeliverablesVaultModal
        isOpen={Boolean(deliverablesModalBooking)}
        booking={deliverablesModalBooking}
        user={user}
        token={token}
        onClose={() => setDeliverablesModalBooking(null)}
        onDeliverableUpdated={() => fetchBookings()}
        onOpenChat={onOpenChat}
      />
    </DashboardShell>
  );
}

// Sub-component: Block Dates Modal
function BlockDatesModal({ isOpen, onClose, onSuccess, token }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const presets = [
    { label: 'External Client Shoot', text: 'External Client Shoot' },
    { label: 'Personal Vacation / Off-Duty', text: 'Personal Vacation / Off-Duty' },
    { label: 'Equipment Maintenance', text: 'Camera & Lighting Servicing' },
    { label: 'Traveling / On Location', text: 'Traveling for Outstation Production' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate) {
      setError('Please select both a start date and an end date.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/schedule/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim() || 'Unavailable / Off-Duty',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to block dates');

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        <div className="mb-5">
          <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Availability Control
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-2">
            Block Off Dates on Calendar
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Customers will not be able to book these dates. Use this when you have outside projects or time off.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                min={todayStr}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                required
                min={startDate || todayStr}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason Presets</label>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(p.text)}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 text-[11px] font-medium rounded-lg text-left transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Commercial Shoot Outside Platform / Holiday"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs mt-2"
          >
            {submitting ? 'Marking Dates...' : 'Mark Dates as Unavailable'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Sub-component: Decline Booking Modal
function DeclineBookingModal({ isOpen, onClose, onConfirm, booking }) {
  const [reasonPreset, setReasonPreset] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !booking) return null;

  const presets = [
    { label: 'Equipment / Crew already committed to another shoot', text: 'Equipment & crew already committed to another commercial production' },
    { label: 'Insufficient prep or lead time for project scale', text: 'Insufficient preparation and lead time required for this project scale' },
    { label: 'Shoot location outside our service coverage', text: 'Shoot location is outside our primary service coverage area' },
    { label: 'Personal schedule / Crew off-duty holiday', text: 'Personal schedule / crew holiday unavailability' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalReason = [reasonPreset, customNote.trim()].filter(Boolean).join(' — ');
    if (!finalReason) {
      setError('Please select a reason or provide an explanation for the client.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(booking.id, finalReason);
    } catch (err) {
      setError(err.message || 'Failed to decline booking request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm font-bold">
              ✕
            </span>
            <h2 className="text-base font-bold text-slate-900">Decline Booking Request</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Provide an explanation for declining this shoot request. This reason will be displayed in the <strong>Client Dashboard</strong> and <strong>Admin Panel</strong>.
          </p>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
          <div className="flex justify-between items-center mb-1">
            <strong className="text-slate-800">{booking.project_name || booking.resource_title}</strong>
            <span className="font-mono font-bold text-slate-900">₹{Number(booking.total_amount).toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Client: <strong>{booking.customer_name || 'Client'}</strong> &bull; Dates:{' '}
            <strong>
              {new Date(booking.start_date).toLocaleDateString()} &rarr; {new Date(booking.end_date).toLocaleDateString()}
            </strong>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Preset Reason:
            </label>
            <div className="space-y-1.5">
              {presets.map((p) => (
                <button
                  key={p.text}
                  type="button"
                  onClick={() => {
                    setReasonPreset(p.text);
                    setError('');
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                    reasonPreset === p.text
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold ring-1 ring-rose-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{p.label}</span>
                  {reasonPreset === p.text && <span className="text-rose-600 font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Message / Details for Client (Optional):
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => {
                setCustomNote(e.target.value);
                setError('');
              }}
              placeholder="e.g. We are shooting an outstation commercial on those dates. We would love to collaborate on future projects!"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Keep Request
            </button>
            <button
              type="submit"
              disabled={submitting || (!reasonPreset && !customNote.trim())}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{submitting ? 'Declining...' : 'Confirm & Decline Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Sub-component: Upload Work Modal
function UploadWorkModal({ isOpen, onClose, onSuccess, token }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadSource, setUploadSource] = useState('device'); // 'device' | 'url'
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video' | 'document'
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const presets = [
    {
      label: 'Cinema Camera Rig',
      url: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&auto=format&fit=crop&q=80',
      title: 'Sony FX3 Cinema Kit Rigged on Gimbal',
      desc: 'Full documentary camera build with wireless focus, matte box, and V-mount battery system.',
      type: 'image',
    },
    {
      label: 'Fashion Shoot',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      title: 'Editorial High-Fashion Lookbook',
      desc: 'Studio editorial portrait shot with Profoto softboxes and prime 85mm lens.',
      type: 'image',
    },
    {
      label: 'Anamorphic Cine Still',
      url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
      title: 'Narrative Short Film Still',
      desc: 'Cinematography frame captured with anamorphic glass in low-light night exterior.',
      type: 'image',
    },
    {
      label: 'Color Grading Suite',
      url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80',
      title: 'DaVinci Resolve HDR Color Grade',
      desc: 'Commercial beauty pass and cinematic curve manipulation on broadcast monitors.',
      type: 'image',
    },
  ];

  if (!isOpen) return null;

  // Handle local device file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');

    // Auto-detect type
    const mime = file.type;
    const fname = file.name.toLowerCase();

    if (mime.startsWith('video/') || fname.endsWith('.mp4') || fname.endsWith('.mov') || fname.endsWith('.webm')) {
      setMediaType('video');
    } else if (mime === 'application/pdf' || fname.endsWith('.pdf')) {
      setMediaType('document');
    } else if (mime.startsWith('image/')) {
      setMediaType('image');
    }

    // Generate local preview URL
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview('');
    }

    // Auto-fill title if empty
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (uploadSource === 'device' && !selectedFile) {
      setError('Please select an image, video, or PDF file from your device.');
      return;
    }

    if (uploadSource === 'url' && !mediaUrl.trim()) {
      setError('Please enter a valid media URL.');
      return;
    }

    setSubmitting(true);

    try {
      let res;

      if (uploadSource === 'device' && selectedFile) {
        // Upload device file via multipart/form-data
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('media_type', mediaType);

        res = await fetch('/api/v1/portfolios', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        // Submit via media URL
        res = await fetch('/api/v1/portfolios', {
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
      }

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
    setUploadSource('url');
    setTitle(p.title);
    setDescription(p.desc);
    setMediaUrl(p.url);
    setMediaType(p.type || 'image');
    setSelectedFile(null);
    setFilePreview('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md sm:max-w-lg p-6 sm:p-8 shadow-2xl relative my-auto text-slate-900 border border-slate-100 max-h-[92vh] overflow-y-auto transition-all">
        {/* Top-Right Circular Close Button matching Login Page */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
          title="Close"
        >
          ✕
        </button>

        {/* Minimal Typography Header */}
        <div className="mb-5">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">
            Upload Work
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Add photos, videos, or PDF lookbooks to your studio gallery.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Source Switcher: Minimal Pill */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setUploadSource('device');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              uploadSource === 'device'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upload from Device
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadSource('url');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              uploadSource === 'url'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Web URL / Link
          </button>
        </div>

        {/* Presets Row (Only if URL selected) */}
        {uploadSource === 'url' && (
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-700 block mb-2">
              Quick Presets:
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
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Work Title - NO PLACEHOLDER */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Work Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
            />
          </div>

          {/* Media Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Media Format
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mediaType === 'image'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Photo / Image
              </button>
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mediaType === 'video'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Video / Reel
              </button>
              <button
                type="button"
                onClick={() => setMediaType('document')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mediaType === 'document'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PDF Lookbook
              </button>
            </div>
          </div>

          {/* Device Upload Zone vs URL input */}
          {uploadSource === 'device' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Select File *
              </label>
              <label className="border border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept={
                    mediaType === 'video'
                      ? 'video/*'
                      : mediaType === 'document'
                      ? 'application/pdf'
                      : 'image/*,video/*,application/pdf'
                  }
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-900 max-w-xs truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to change
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 py-1">
                    <UploadCloud className="w-4 h-4 text-blue-600" />
                    <span>Click to choose file from device</span>
                  </div>
                )}
              </label>

              {filePreview && (
                <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Preview:
                  </span>
                  {mediaType === 'video' ? (
                    <video
                      src={filePreview}
                      controls
                      className="w-full max-h-40 object-cover rounded-lg bg-black"
                    />
                  ) : (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full max-h-40 object-cover rounded-lg"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Media URL *
              </label>
              <input
                type="url"
                required
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
              />

              {mediaUrl && (
                <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Preview:
                  </span>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950">
                    <PortfolioMediaViewer
                      mediaUrl={mediaUrl}
                      mediaType={mediaType}
                      title={title || 'Preview'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description - NO PLACEHOLDER */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Description / Gear Notes
            </label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all resize-none"
            />
          </div>

          {/* Submit Button matching AuthModal */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>{submitting ? 'Publishing...' : 'Publish to Gallery'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
