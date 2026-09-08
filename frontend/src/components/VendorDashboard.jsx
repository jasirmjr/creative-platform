import React, { useState, useEffect, useCallback } from 'react';
import VendorDepositModal from './VendorDepositModal';
import PortfolioMediaViewer from './PortfolioMediaViewer';
import ReceiptModal from './ReceiptModal';
import AdminSupportDeskModal from './AdminSupportDeskModal';
import DeliverablesVaultModal from './DeliverablesVaultModal';
import { getSocket } from '../utils/socket';

export default function VendorDashboard({ user, token: propToken, onBackToMarketplace, onOpenChat, onVendorUpdated }) {
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' | 'bookings' | 'profile'
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
  });
  const [categoriesList, setCategoriesList] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

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
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${selectedDisputeModal.id}/accept-client-offer`, {
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
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${selectedDisputeModal.id}/counter-offer`, {
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/complaints/vendor', {
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/chat/unread-count', {
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/profile', {
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
        });
      }
    } catch (err) {
      console.error('Failed to load vendor profile:', err);
    }
  };

  // Load Platform Categories & Rate Guardrails
  const fetchCategories = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/categories');
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

  // Load Studio Reviews
  const fetchStudioReviews = async () => {
    if (!token) return;
    setLoadingReviews(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/reviews/studio', {
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/schedule/my', {
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
      const res = await fetch(`http://127.0.0.1:5000/api/v1/schedule/block/${blackoutId}`, {
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/availability', {
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/profile', {
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

  // Handle Booking Status Update (Accept or Decline with reason)
  const handleUpdateBookingStatus = async (bookingId, newStatus, rejectionReason = '') => {
    setUpdatingBookingId(bookingId);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/${bookingId}/status`, {
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
      const res = await fetch(`http://127.0.0.1:5000/api/v1/bookings/${booking.id}/remind-balance`, {
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
  const pendingRequestsCount = bookings.filter((b) => b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request').length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress').length;
  const totalValue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const currentAvailability = vendorProfile?.availability_status || 'available';

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'requests') return b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request';
    if (bookingFilter === 'confirmed') return b.status === 'confirmed' || b.status === 'in_progress';
    if (bookingFilter === 'completed') return b.status === 'completed';
    if (bookingFilter === 'cancelled') return b.status === 'cancelled' || b.status === 'rejected';
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Studio Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Service Provider Portal &bull; Section 16
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

            {vendorProfile?.deposit_status === 'paid' ? (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  Listing Deposit Paid
                </span>
                <button
                  type="button"
                  onClick={() => setIsVendorDepositReceiptOpen(true)}
                  className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-colors"
                  title="View official studio listing deposit receipt"
                >
                  Deposit Receipt
                </button>
              </div>
            ) : vendorProfile?.deposit_status === 'waived' ? (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                Deposit Waived
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                Deposit Pending
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {vendorProfile?.business_name || user?.name || 'Creator Studio'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            {vendorProfile?.bio || 'Manage your creative showcase, upload portfolio works, set live availability, and track assigned client projects.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3">
            <span>{vendorProfile?.location || 'Location Not Set'}</span>
            <span>Experience: {vendorProfile?.experience || '2+ years'}</span>
            {vendorProfile?.pricing && (
              <span className="font-mono font-bold text-slate-800">
                ₹{Number(vendorProfile.pricing).toLocaleString()}/{vendorProfile.pricing_unit || 'day'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAdminSupportOpen(true)}
            className="relative px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            title="Open official Platform Support Desk (Escalations, KYC, Payouts)"
          >
            <span>🛡️</span>
            <span>Platform Support Desk</span>
            {adminUnread > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full animate-pulse shadow-xs">
                {adminUnread}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Upload Work</span>
          </button>

          <button
            onClick={onBackToMarketplace}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            &larr; Marketplace
          </button>
        </div>
      </div>

      {/* Onboarding Listing Deposit Banner (When Inactive / Pending Deposit) */}
      {vendorProfile && vendorProfile.deposit_status !== 'paid' && vendorProfile.deposit_status !== 'waived' && (
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Profile Inactive &bull; Listing Deposit Required (₹{Number(vendorProfile.deposit_amount || 2000).toLocaleString()})
                </h3>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Hidden From Marketplace
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Your studio is registered, but not listed on the public landing page. Complete your one-time onboarding deposit of ₹{Number(vendorProfile.deposit_amount || 2000).toLocaleString()} to make your profile live, appear in search, and start receiving client bookings.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDepositModalOpen(true)}
            className="self-start md:self-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 hover:scale-[1.02]"
          >
            <span>Pay Listing Deposit (₹{Number(vendorProfile.deposit_amount || 2000).toLocaleString()})</span>
          </button>
        </div>
      )}

      {/* Availability Switcher Bar (Section 12 Availability Management) */}
      <div className="mb-6 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-900 block">Section 12: Availability Management</span>
          <span className="text-xs text-slate-500">Set your live booking status to prevent conflicting client holds.</span>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'available', label: 'Available for Hire', color: 'emerald' },
            { id: 'booked', label: 'Currently Booked', color: 'rose' },
            { id: 'unavailable', label: 'Unavailable', color: 'slate' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleUpdateAvailability(item.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                currentAvailability === item.id
                  ? item.id === 'available'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : item.id === 'booked'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentAvailability === item.id ? 'bg-white' : 'bg-slate-400'}`}></span>
              <span>{item.label}</span>
            </button>
          ))}
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

      {/* Studio Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
          <span className="text-xs text-slate-500 mt-1 block">Live showcase samples</span>
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
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                Needs Response
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{pendingRequestsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting provider confirmation</span>
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
          <span className="text-xs text-slate-500 mt-1 block">Assigned active productions</span>
        </div>

        <div
          onClick={() => setActiveTab('reviews')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'reviews'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Client Rating</span>
          <p className="text-3xl font-bold text-slate-900 mt-2 flex items-center gap-1.5">
            <span className="text-amber-500">★</span>
            <span>{studioAvgRating}</span>
          </p>
          <span className="text-xs text-slate-500 mt-1 block">
            {studioReviews.length} {studioReviews.length === 1 ? 'Verified Review' : 'Verified Reviews'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross Production Total</span>
          <p className="text-3xl font-bold text-slate-900 mt-2 font-mono">₹{totalValue.toLocaleString()}</p>
          <span className="text-xs text-slate-500 mt-1 block">Confirmed bookings value</span>
        </div>
      </div>

      {/* Main Studio Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gallery')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
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
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'bookings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Assigned Projects & Bookings</span>
          {pendingRequestsCount > 0 && (
            <span className="text-[10px] px-2 py-0.2 bg-amber-500 text-white rounded-full font-bold">
              {pendingRequestsCount} new
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'reviews'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Client Reviews</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
            activeTab === 'reviews' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {studioReviews.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'schedule'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Schedule & Calendar</span>
          {scheduleData.blackouts.length > 0 && (
            <span className="text-[10px] px-2 py-0.2 bg-amber-500 text-white rounded-full font-bold">
              {scheduleData.blackouts.length} off-duty
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Profile & Skills
        </button>

        <button
          onClick={() => setActiveTab('disputes')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'disputes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Disputes Desk</span>
          {vendorComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length > 0 && (
            <span className="text-[10px] px-2 py-0.2 bg-rose-600 text-white rounded-full font-bold animate-pulse">
              {vendorComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'dismissed').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsAdminSupportOpen(true)}
          className="relative px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 flex items-center gap-1.5 shadow-2xs"
          title="Open official Platform Support Desk (Escalations, KYC, Payouts)"
        >
          <span>🛡️</span>
          <span>Platform Support</span>
          {adminUnread > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-bold rounded-full animate-pulse">
              {adminUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpenChat?.({ scope: 'client' })}
          className="relative px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 shadow-2xs"
          title="Open direct client booking conversations"
        >
          <span>💬</span>
          <span>Client Messages</span>
          {clientUnread > 0 && (
            <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] font-bold rounded-full">
              {clientUnread}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: GALLERY MANAGEMENT */}
      {activeTab === 'gallery' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Portfolio Showcase</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Section 6 Portfolio: Upload client shoots, equipment packages, and color grading reels.
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
              <h3 className="text-sm font-bold text-slate-800">Your Gallery is Empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload your cinematography frames, fashion shoots, or gear kits so clients can discover and book you.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                + Upload First Work
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

      {/* TAB 2: BOOKING REQUESTS & HISTORY */}
      {activeTab === 'bookings' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Assigned Client Projects & History</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Respond to managed booking requests and manage shoot execution dates.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto">
              {[
                { id: 'all', label: 'All Projects' },
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
              <h3 className="text-sm font-bold text-slate-800">No Bookings in This View</h3>
              <p className="text-xs text-slate-500 mt-1">
                When customers submit project requirements for your talent, they will appear here.
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
                          b.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : b.status === 'deliverables_submitted'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                            : b.status === 'completed'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : b.status === 'rejected' || b.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 font-black'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {b.status === 'deliverables_submitted'
                          ? 'Deliverables Under Review'
                          : b.status === 'rejected'
                          ? 'Declined / Rejected'
                          : b.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {b.category_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        • Received {new Date(b.created_at).toLocaleDateString()}
                      </span>
                      {b.crew_bundle_id && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full inline-flex items-center">
                          Crew Production
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{b.project_name || b.resource_title}</h3>

                    {b.crew_bundle_id && (
                      <div className="mt-2.5 p-3 bg-purple-50/70 border border-purple-200/90 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-purple-900">
                            Multi-Talent Project: <span className="font-bold">{b.crew_bundle_name || b.project_name || 'Production Crew'}</span>
                          </span>
                          <span className="text-purple-300">•</span>
                          <span className="text-purple-800">
                            Your Role: <strong className="font-bold text-purple-950">{b.crew_role || b.category_name}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-purple-600 bg-white px-2 py-0.5 rounded border border-purple-200">
                          {b.crew_bundle_id}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Customer Details</span>
                        <strong className="text-slate-800">{b.customer_name || 'Creative Client'}</strong>
                        {b.customer_mobile && <span className="block text-slate-500">{b.customer_mobile}</span>}
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Production Dates</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(b.start_date).toLocaleDateString()} &rarr; {new Date(b.end_date).toLocaleDateString()}
                        </span>
                        {b.duration && <span className="block text-slate-500">Duration: {b.duration}</span>}
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Payment & Deposit</span>
                        {(() => {
                          const bTotal = Number(b.total_amount || 0);
                          const bPaid = Number(b.paid_amount || 0);
                          const bBalance = Math.max(0, bTotal - bPaid);
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-sm font-bold text-slate-900 font-mono">
                                ₹{bTotal.toLocaleString()}
                              </span>
                              {b.payment_status === 'paid' || bBalance <= 0 ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  ✓ Paid
                                </span>
                              ) : b.payment_status === 'advance_paid' || bPaid > 0 ? (
                                <>
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                    ✓ Advance (₹{bPaid.toLocaleString()})
                                  </span>
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                                    ⚠️ Due: ₹{bBalance.toLocaleString()}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  Advance: ₹{Number(b.advance_amount || Math.round(bTotal * 0.3)).toLocaleString()}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Rejection Note Display */}
                    {b.rejection_reason && (
                      <div className="mt-3 p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-950">
                        <strong className="font-semibold text-rose-800 block text-[11px] uppercase tracking-wider mb-0.5">
                          Decline Note Shared with Client & Admin:
                        </strong>
                        <p className="italic font-medium">"{b.rejection_reason}"</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {(b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request') && (
                      <>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'approved')}
                          disabled={updatingBookingId === b.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>{updatingBookingId === b.id ? 'Accepting...' : 'Accept Booking'}</span>
                        </button>
                        <button
                          onClick={() => setDeclineModal({ isOpen: true, booking: b })}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <span>Decline Request</span>
                        </button>
                      </>
                    )}

                    {b.status === 'approved' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>Awaiting Client Advance Deposit (₹{Number(b.advance_amount || Math.round(Number(b.total_amount) * 0.3)).toLocaleString()})</span>
                        </span>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                          disabled={updatingBookingId === b.id}
                          title="Manually confirm if advance was paid directly/offline"
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer"
                        >
                          Confirm Offline
                        </button>
                      </div>
                    )}

                    {(b.status === 'confirmed' || b.status === 'deliverables_submitted' || b.status === 'completed') && (
                      <button
                        type="button"
                        onClick={() => setDeliverablesModalBooking(b)}
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                          b.status === 'deliverables_submitted'
                            ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                        }`}
                        title="Manage Project Deliverables & Client Media Vault"
                      >
                        <span>📦</span>
                        <span>{b.status === 'deliverables_submitted' ? 'Deliverables Under Review' : 'Media Vault'}</span>
                      </button>
                    )}

                    {b.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                          disabled={updatingBookingId === b.id}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          Mark as Completed
                        </button>
                        <button
                          onClick={() => setDeclineModal({ isOpen: true, booking: b })}
                          disabled={updatingBookingId === b.id}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {b.status === 'deliverables_submitted' && (
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                        Awaiting Client Sign-off
                      </span>
                    )}

                    {b.status === 'completed' && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        Production Completed
                      </span>
                    )}

                    {/* Balance Payment Reminder Action for Vendor */}
                    {(() => {
                      const bTotal = Number(b.total_amount || 0);
                      const bPaid = Number(b.paid_amount || 0);
                      const bBalance = Math.max(0, bTotal - bPaid);
                      const hasPendingBalance = bBalance > 0 && (b.status === 'completed' || b.status === 'deliverables_submitted' || b.status === 'confirmed');
                      const isRecentlyReminded = Boolean(b.last_balance_reminder_at || reminderStatusMap[b.id]?.sent);

                      if (!hasPendingBalance) return null;

                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendBalanceReminder(b)}
                            disabled={remindingBookingId === b.id}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                              isRecentlyReminded
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold border-transparent shadow-amber-500/20'
                            }`}
                            title={`Send balance payment reminder to ${b.customer_name || 'client'} for ₹${bBalance.toLocaleString()}`}
                          >
                            <span>🔔</span>
                            <span>
                              {remindingBookingId === b.id
                                ? 'Sending Reminder...'
                                : isRecentlyReminded
                                ? `Reminded (₹${bBalance.toLocaleString()})`
                                : `Remind Balance (₹${bBalance.toLocaleString()})`}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemindBalanceInChat(b)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                            title="Open chat with pre-filled balance reminder message"
                          >
                            <span>💬</span>
                          </button>
                        </div>
                      );
                    })()}

                    {(b.status === 'cancelled' || b.status === 'rejected') && (
                      <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                        {b.status === 'rejected' ? 'Declined / Rejected' : 'Cancelled'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenChat?.({ bookingId: b.id, customerId: b.customer_id })}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      title="Chat directly with client about this booking"
                    >
                      <span>Chat with Client</span>
                    </button>

                    {Number(b.paid_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setReceiptModalBooking(b)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                        title="View client payment slip and escrow status"
                      >
                        Payment Slip
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILE & SKILLS MANAGEMENT */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-w-3xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Profile & Experience Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Section 6: Update your commercial skills, experience, and pricing details shown to clients.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Studio / Artist Name</label>
              <input
                type="text"
                required
                value={editProfileData.business_name}
                onChange={(e) => setEditProfileData({ ...editProfileData, business_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base Location</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Maharashtra"
                  value={editProfileData.location}
                  onChange={(e) => setEditProfileData({ ...editProfileData, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="text"
                  placeholder="e.g. 8+ years"
                  value={editProfileData.experience}
                  onChange={(e) => setEditProfileData({ ...editProfileData, experience: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Discipline / Specialty</label>
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all font-medium"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              )}
            </div>

            {/* Category Market Standard & Experience Tiers */}
            {(() => {
              const matchedCategory = categoriesList.find(
                (c) =>
                  (editProfileData.skills || vendorProfile?.skills || '').toLowerCase() === c.name.toLowerCase() ||
                  (editProfileData.skills || vendorProfile?.skills || '').toLowerCase().includes(c.name.toLowerCase()) ||
                  c.name.toLowerCase().includes((editProfileData.skills || vendorProfile?.skills || '').toLowerCase())
              );
              const minRate = matchedCategory ? Number(matchedCategory.min_daily_rate) : 1000;
              const recRate = matchedCategory ? Number(matchedCategory.recommended_daily_rate) : 10000;
              const maxRate = matchedCategory ? Number(matchedCategory.max_daily_rate) : 50000;
              const currentRate = Number(editProfileData.pricing || 0);

              const isTooLow = currentRate > 0 && currentRate < minRate;
              const isTooHigh = currentRate > maxRate;
              const isValid = currentRate >= minRate && currentRate <= maxRate;

              return (
                <div className="space-y-4 pt-1">
                  {matchedCategory && (
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-indigo-950">
                          Market Wage Standards for {matchedCategory.name}
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                          Admin Governed
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white/90 rounded-lg border border-indigo-100 mb-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Floor</span>
                          <span className="font-mono font-bold text-slate-800">₹{minRate.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-indigo-600 block">Benchmark</span>
                          <span className="font-mono font-bold text-indigo-700">₹{recRate.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Affordability Cap</span>
                          <span className="font-mono font-bold text-slate-800">₹{maxRate.toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-indigo-800">
                        Platform rate guardrails prevent price gouging while guaranteeing fair minimum earnings.
                      </p>
                    </div>
                  )}

                  {/* Experience Tier Chips */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Seniority & Experience Level
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'entry', label: 'Rising Talent', sub: 'Early Career', mult: 0.6 },
                        { id: 'mid', label: 'Established Pro', sub: 'Standard', mult: 1.0 },
                        { id: 'senior', label: 'Studio Master', sub: 'Elite Director', mult: 1.7 },
                      ].map((tier) => {
                        const isSelected = editProfileData.experience_level === tier.id;
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
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-900">{tier.label}</div>
                            <div className="text-[10px] text-slate-500">{tier.sub}</div>
                            <div className="text-[11px] font-mono font-semibold text-indigo-700 mt-1">
                              ~₹{suggestedPrice.toLocaleString()}/day
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Inputs & Guardrail Feedback */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">Daily Base Rate (₹)</label>
                        {matchedCategory && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Limit: ₹{minRate.toLocaleString()} - ₹{maxRate.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        placeholder={`e.g. ${recRate}`}
                        value={editProfileData.pricing}
                        onChange={(e) => setEditProfileData({ ...editProfileData, pricing: e.target.value })}
                        className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition-all ${
                          isTooLow || isTooHigh
                            ? 'bg-rose-50 border-rose-400 text-rose-900 focus:bg-white'
                            : isValid
                            ? 'bg-emerald-50/40 border-emerald-300 text-slate-900 focus:bg-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'
                        }`}
                      />
                      {isTooLow && (
                        <span className="text-[11px] text-rose-600 font-semibold block mt-1">
                          Below platform minimum floor of ₹{minRate.toLocaleString()}/day.
                        </span>
                      )}
                      {isTooHigh && (
                        <span className="text-[11px] text-rose-600 font-semibold block mt-1">
                          Exceeds platform affordability cap of ₹{maxRate.toLocaleString()}/day.
                        </span>
                      )}
                      {isValid && (
                        <span className="text-[11px] text-emerald-700 font-semibold block mt-1">
                          ✓ Standard compliant rate for {matchedCategory?.name || 'discipline'}.
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing Unit</label>
                      <select
                        value={editProfileData.pricing_unit}
                        onChange={(e) => setEditProfileData({ ...editProfileData, pricing_unit: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                      >
                        <option value="day">Per Day (Standard Daily Wage)</option>
                        <option value="hour">Per Hour</option>
                        <option value="project">Per Project</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Professional Bio</label>
              <textarea
                rows="4"
                value={editProfileData.bio}
                onChange={(e) => setEditProfileData({ ...editProfileData, bio: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Studio Schedule & Availability Calendar</h2>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase">
                  Live Calendar
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Confirmed shoots are automatically booked in red. Mark personal time off, gear maintenance, or outside client shoots as unavailable so platform customers cannot book those dates.
              </p>
            </div>

            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
            >
              <span>+ Block Off Dates</span>
            </button>
          </div>

          {/* Calendar Navigation & Legend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
              {/* Month Navigator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(currentCalendarDate);
                    d.setMonth(d.getMonth() - 1);
                    setCurrentCalendarDate(d);
                  }}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-xs font-bold border border-slate-200 cursor-pointer"
                  title="Previous Month"
                >
                  &larr; Prev
                </button>

                <h3 className="text-base font-black text-slate-900 min-w-[160px] text-center">
                  {currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(currentCalendarDate);
                    d.setMonth(d.getMonth() + 1);
                    setCurrentCalendarDate(d);
                  }}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-xs font-bold border border-slate-200 cursor-pointer"
                  title="Next Month"
                >
                  Next &rarr;
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentCalendarDate(new Date())}
                  className="ml-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Today
                </button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-rose-500 inline-block"></span>
                  <span className="text-slate-700 font-medium">Confirmed Shoot</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-amber-500 inline-block"></span>
                  <span className="text-slate-700 font-medium">Off-Duty / Blocked</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block"></span>
                  <span className="text-slate-700 font-medium">Open / Available</span>
                </span>
              </div>
            </div>

            {/* Calendar Days Grid */}
            {(() => {
              const year = currentCalendarDate.getFullYear();
              const month = currentCalendarDate.getMonth();
              const firstDayOfWeek = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const todayStr = new Date().toISOString().split('T')[0];

              const days = [];
              for (let i = 0; i < firstDayOfWeek; i++) {
                days.push(null);
              }
              for (let d = 1; d <= daysInMonth; d++) {
                days.push(d);
              }

              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

              return (
                <div>
                  <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
                    {dayNames.map((n) => (
                      <div key={n} className="text-[11px] font-bold text-slate-400 uppercase py-1">
                        {n}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {days.map((d, index) => {
                      if (d === null) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-[85px] bg-slate-50/50 rounded-xl border border-transparent"
                          />
                        );
                      }

                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const isToday = dateStr === todayStr;

                      // Check bookings
                      const activeBooking = scheduleData.bookings.find((b) => {
                        if (b.status === 'cancelled' || b.status === 'rejected') return false;
                        const s = b.start_date.split('T')[0];
                        const e = b.end_date.split('T')[0];
                        return dateStr >= s && dateStr <= e;
                      });

                      // Check blackouts
                      const activeBlackout = scheduleData.blackouts.find((bl) => {
                        const s = bl.start_date.split('T')[0];
                        const e = bl.end_date.split('T')[0];
                        return dateStr >= s && dateStr <= e;
                      });

                      return (
                        <div
                          key={dateStr}
                          className={`min-h-[90px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                            activeBooking
                              ? 'bg-rose-50/70 border-rose-200 ring-1 ring-rose-300/40'
                              : activeBlackout
                              ? 'bg-amber-50/70 border-amber-200 ring-1 ring-amber-300/40'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                                isToday
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-800'
                              }`}
                            >
                              {d}
                            </span>
                            {activeBooking && (
                              <span className="text-[9px] font-bold text-rose-700 uppercase tracking-tight bg-rose-100/80 px-1.5 py-0.5 rounded">
                                Booked
                              </span>
                            )}
                            {activeBlackout && (
                              <button
                                type="button"
                                onClick={() => handleUnblockDate(activeBlackout.id)}
                                title="Click to unblock this date"
                                className="text-[10px] text-amber-800 hover:text-rose-700 bg-amber-100 hover:bg-amber-200 px-1 rounded cursor-pointer transition-colors"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div className="mt-1 flex-1 flex flex-col justify-end">
                            {activeBooking ? (
                              <div className="text-[10px] text-rose-900 font-semibold truncate leading-tight">
                                <span className="block truncate">{activeBooking.project_name || 'Shoot'}</span>
                                <span className="text-[9px] text-rose-600 font-normal block truncate">
                                  {activeBooking.customer_name}
                                </span>
                              </div>
                            ) : activeBlackout ? (
                              <div className="text-[10px] text-amber-900 font-semibold truncate leading-tight">
                                <span className="block truncate">{activeBlackout.reason || 'Off-Duty'}</span>
                                <span className="text-[9px] text-amber-700 font-normal block">Unavailable</span>
                              </div>
                            ) : (
                              <span className="text-[9px] text-emerald-600 font-medium">✓ Available</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Schedule Breakdown: Active Blackouts & Upcoming Shoots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Blackouts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Off-Duty & Blocked Ranges</span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full font-bold">
                    {scheduleData.blackouts.length}
                  </span>
                </h3>
                <button
                  onClick={() => setIsBlockModalOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  + Add Block
                </button>
              </div>

              {scheduleData.blackouts.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium">No blocked dates.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Your studio is available to accept bookings on all open days.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {scheduleData.blackouts.map((bl) => (
                    <div
                      key={bl.id}
                      className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-slate-900 block font-bold">{bl.reason || 'Off-Duty'}</strong>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          {new Date(bl.start_date).toLocaleDateString()} &rarr; {new Date(bl.end_date).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnblockDate(bl.id)}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmed Platform Shoots */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Scheduled Client Shoots</span>
                  <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full font-bold">
                    {scheduleData.bookings.length}
                  </span>
                </h3>
              </div>

              {scheduleData.bookings.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium">No confirmed shoots scheduled yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {scheduleData.bookings.map((bk) => (
                    <div
                      key={bk.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
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
                          Client: {bk.customer_name || 'Client'} &bull; {new Date(bk.start_date).toLocaleDateString()} &rarr; {new Date(bk.end_date).toLocaleDateString()}
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
                      ? `http://127.0.0.1:5000${selectedPreviewWork.media_url}`
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
                    const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${selectedDisputeModal.id}/vendor-response`, {
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
    </main>
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
      const res = await fetch('http://127.0.0.1:5000/api/v1/schedule/block', {
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

        res = await fetch('http://127.0.0.1:5000/api/v1/portfolios', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        // Submit via media URL
        res = await fetch('http://127.0.0.1:5000/api/v1/portfolios', {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto">
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
            Upload photos, showreel videos, or PDF treatment lookbooks directly from your device.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Upload Source Switcher: Device vs URL */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-5 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setUploadSource('device');
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              uploadSource === 'device'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Upload from Device</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadSource('url');
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              uploadSource === 'url'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Web URL / Presets</span>
          </button>
        </div>

        {/* Presets Row (Only if URL selected) */}
        {uploadSource === 'url' && (
          <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-700 block mb-2">
              Quick Showcase Presets:
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Work Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Commercial Car Ad / Fashion Lookbook / Cine Reel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          {/* Media Type Switcher: 3 Options */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Media Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  mediaType === 'image'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Photo / Image</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  mediaType === 'video'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Video / Reel</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaType('document')}
                className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  mediaType === 'document'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>PDF Lookbook</span>
              </button>
            </div>
          </div>

          {/* ================= OPTION 1: DEVICE UPLOAD ZONE ================= */}
          {uploadSource === 'device' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select File from Your Device (Images, Videos, or PDFs up to 150MB) *
              </label>

              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/40">
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
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to change file
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg mb-2">
                      ↑
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      Click to choose image, video, or PDF from device
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Supports JPG, PNG, MP4, MOV, WEBM, PDF (up to 150MB)
                    </span>
                  </>
                )}
              </label>

              {/* Live Preview for Device File */}
              {filePreview && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1.5">
                    File Preview:
                  </span>
                  {mediaType === 'video' ? (
                    <video
                      src={filePreview}
                      controls
                      className="w-full max-h-48 object-cover rounded-lg bg-black"
                    />
                  ) : (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full max-h-44 object-cover rounded-lg"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ================= OPTION 2: URL INPUT ================= */
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Media File / Online Video URL *
              </label>
              <input
                type="url"
                required
                placeholder={
                  mediaType === 'video'
                    ? 'Paste Instagram Reel, YouTube, Vimeo, or MP4 link...'
                    : 'https://images.unsplash.com/... or image link'
                }
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {mediaType === 'video'
                  ? 'Supports Instagram Reels & Posts, YouTube videos & shorts, Vimeo, and direct MP4/WebM URLs.'
                  : 'Supports Unsplash, CDN images, or direct image file links.'}
              </p>

              {mediaUrl && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1.5">
                    Live URL Preview:
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

          {/* Description */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>{submitting ? 'Uploading to Gallery...' : 'Publish to Gallery'}</span>
            <span>&rarr;</span>
          </button>
        </form>
      </div>
    </div>
  );
}
