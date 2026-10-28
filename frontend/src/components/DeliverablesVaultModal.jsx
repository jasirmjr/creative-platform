import React, { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../utils/socket';

export default function DeliverablesVaultModal({
  isOpen,
  booking,
  user,
  token,
  onClose,
  onOpenChat,
  onDeliverableUpdated,
  onOpenPayment,
  onOpenReview,
}) {
  const [loading, setLoading] = useState(true);
  const [deliverables, setDeliverables] = useState([]);
  const [bookingMeta, setBookingMeta] = useState(null);

  // Vendor Upload Form States
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverableType, setDeliverableType] = useState('cloud_link'); // 'cloud_link' | 'file_upload'
  const [cloudUrl, setCloudUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Customer Review States
  const [reviewingDeliverableId, setReviewingDeliverableId] = useState(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState('');

  // Vendor Deliverable Reply States
  const [replyingDeliverableId, setReplyingDeliverableId] = useState(null);
  const [vendorReplyText, setVendorReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const bookingId = booking?.id;
  const isCustomer = user?.role === 'customer' || user?.id === booking?.customer_id;
  const isVendor = user?.role === 'vendor';

  const fetchDeliverables = useCallback(async () => {
    if (!bookingId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/bookings/${bookingId}/deliverables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDeliverables(data.data.deliverables || []);
        setBookingMeta(data.data.booking || null);
      }
    } catch (err) {
      console.error('Failed to fetch deliverables:', err);
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDeliverables();
      setShowUploadForm(false);
      setReviewingDeliverableId(null);
      setReplyingDeliverableId(null);
      setVendorReplyText('');
      setRevisionFeedback('');
      setUploadError('');
      setReviewSuccessMessage('');
    }
  }, [isOpen, bookingId, fetchDeliverables]);

  // Real-time socket listener
  useEffect(() => {
    if (!isOpen || !token) return;
    const socket = getSocket(token);
    if (!socket) return;

    const handleDeliverableNotification = (notif) => {
      if (notif?.booking_id === bookingId) {
        fetchDeliverables();
        onDeliverableUpdated?.();
      }
    };

    socket.on('deliverable_notification', handleDeliverableNotification);
    return () => {
      socket.off('deliverable_notification', handleDeliverableNotification);
    };
  }, [isOpen, bookingId, token, fetchDeliverables, onDeliverableUpdated]);

  const handleVendorSubmitDeliverable = async (e) => {
    e.preventDefault();
    setUploadError('');
    if (!title.trim()) {
      setUploadError('Please provide a title for this deliverable package.');
      return;
    }
    if (deliverableType === 'cloud_link' && !cloudUrl.trim()) {
      setUploadError('Please provide a secure cloud delivery link (Google Drive, Dropbox, WeTransfer, etc.).');
      return;
    }
    if (deliverableType === 'file_upload' && !selectedFile) {
      setUploadError('Please choose a file or archive to upload.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('deliverable_type', deliverableType);

      if (deliverableType === 'cloud_link') {
        formData.append('cloud_url', cloudUrl.trim());
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await fetch(`/api/v1/bookings/${bookingId}/deliverables`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setTitle('');
        setDescription('');
        setCloudUrl('');
        setSelectedFile(null);
        setShowUploadForm(false);
        fetchDeliverables();
        onDeliverableUpdated?.();
      } else {
        setUploadError(data.message || 'Failed to submit deliverables.');
      }
    } catch (err) {
      setUploadError('Network error while publishing deliverables.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClientReview = async (deliverableId, decision) => {
    if (decision === 'revision_requested' && !revisionFeedback.trim()) {
      alert('Please describe what adjustments or revisions are needed.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await fetch(
        `/api/v1/bookings/${bookingId}/deliverables/${deliverableId}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            feedback: revisionFeedback.trim(),
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setReviewingDeliverableId(null);
        setRevisionFeedback('');
        setReviewSuccessMessage(
          decision === 'approved'
            ? 'Deliverables officially approved! Project has been marked as completed.'
            : 'Revision request successfully delivered to your creative partner.'
        );
        fetchDeliverables();
        onDeliverableUpdated?.();
      } else {
        alert(data.message || 'Failed to submit review.');
      }
    } catch (err) {
      alert('Network error while submitting review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenRevisionChat = (deliverable) => {
    const feedbackSnippet = deliverable?.client_feedback
      ? deliverable.client_feedback.length > 50
        ? deliverable.client_feedback.slice(0, 50) + '...'
        : deliverable.client_feedback
      : 'deliverables';
    const initialText = `Re: Deliverables v${deliverable?.version || 1}.0 Revision ("${feedbackSnippet}") - `;

    const target = {
      bookingId: bookingMeta?.id || booking?.id,
      vendorId: bookingMeta?.vendor_id || booking?.vendor_id,
      customerId: bookingMeta?.customer_id || booking?.customer_id,
      scope: 'client',
    };
    onOpenChat?.(target, initialText);
  };

  const handleVendorSubmitReply = async (deliverableId) => {
    if (!vendorReplyText.trim()) {
      alert('Please enter your response or timeline note.');
      return;
    }

    setSubmittingReply(true);
    try {
      const res = await fetch(
        `/api/v1/bookings/${bookingId}/deliverables/${deliverableId}/vendor-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reply: vendorReplyText.trim(),
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setReplyingDeliverableId(null);
        setVendorReplyText('');
        fetchDeliverables();
        onDeliverableUpdated?.();
      } else {
        alert(data.message || 'Failed to submit response.');
      }
    } catch (err) {
      alert('Network error while submitting response.');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (!isOpen) return null;

  const currentStatus = bookingMeta?.status || booking?.status;
  const latestDeliverable = deliverables[0] || null;
  const hasRevisionsRequested = latestDeliverable?.status === 'revision_requested';
  const isApproved = latestDeliverable?.status === 'approved' || currentStatus === 'completed';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col relative">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                📦 Project Deliverables & Media Vault
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : hasRevisionsRequested
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : currentStatus === 'deliverables_submitted'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-400/40 animate-pulse'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                }`}
              >
                {isApproved
                  ? '✓ Production Completed & Approved'
                  : hasRevisionsRequested
                  ? '🔄 Revision In Progress'
                  : currentStatus === 'deliverables_submitted'
                  ? '📦 Deliverables Under Review'
                  : '🎬 In Production'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {bookingMeta?.project_name || booking?.project_name || 'Creative Production Shoot'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Studio: <span className="font-semibold text-white">{bookingMeta?.vendor_business_name || booking?.business_name || 'Creative Partner'}</span> &bull; Client: <span className="font-semibold text-white">{bookingMeta?.customer_name || booking?.customer_name || 'Client'}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Review Success Banner */}
          {reviewSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="text-base">🎉</span>
                <span className="font-semibold">{reviewSuccessMessage}</span>
              </div>
              <button
                onClick={() => setReviewSuccessMessage('')}
                className="text-emerald-700 hover:text-emerald-950 font-bold px-1.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Lifecycle Status Banner */}
          {isApproved ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-lg shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">Creative Project Officially Completed!</h4>
                  <p className="text-emerald-800">All deliverables have been inspected and approved. Final files are permanently archived below.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isCustomer && Number(booking?.paid_amount || 0) < Number(booking?.total_amount || 0) && (
                  <button
                    onClick={() => {
                      onClose?.();
                      onOpenPayment?.(booking, 'balance');
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    Settle Balance (₹{(Number(booking.total_amount) - Number(booking.paid_amount || 0)).toLocaleString()})
                  </button>
                )}
                {isCustomer && (
                  <button
                    onClick={() => {
                      onClose?.();
                      onOpenReview?.(booking);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    ⭐ Review Studio
                  </button>
                )}
              </div>
            </div>
          ) : hasRevisionsRequested ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">🔄</span>
                <div>
                  <h4 className="font-bold text-amber-900 text-sm mb-0.5">Revision In Progress</h4>
                  <p className="text-amber-800 leading-relaxed">
                    {isVendor
                      ? 'The client reviewed the last batch and requested adjustments. You can discuss details directly in project chat, post a studio ETA note, or upload a revised batch.'
                      : 'Your creative partner has received your revision feedback and is currently working on the adjustments.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {latestDeliverable && (
                  <button
                    type="button"
                    onClick={() => handleOpenRevisionChat(latestDeliverable)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💬</span>
                    <span>{isVendor ? 'Discuss in Chat' : 'Chat with Studio'}</span>
                  </button>
                )}
                {isVendor && latestDeliverable && !latestDeliverable.vendor_reply && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingDeliverableId(latestDeliverable.id);
                      setVendorReplyText('');
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>✍️</span>
                    <span>Post Note</span>
                  </button>
                )}
              </div>
            </div>
          ) : currentStatus === 'deliverables_submitted' ? (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3 text-xs text-purple-950">
              <span className="text-xl">📦</span>
              <div>
                <h4 className="font-bold text-purple-900 text-sm mb-0.5">Deliverables Ready for Review</h4>
                <p className="text-purple-800 leading-relaxed">
                  {isCustomer
                    ? 'Our creative studio has uploaded production deliverables for your shoot. Inspect the files below, then click "Approve Deliverables" or "Request Revision".'
                    : 'Deliverables successfully published. The client has been notified to review and sign off on the project.'}
                </p>
              </div>
            </div>
          ) : null}

          {/* Deliverables List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Deliverable Batches</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                  {deliverables.length}
                </span>
              </h3>

              {isVendor && !isApproved && (
                <button
                  type="button"
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>{showUploadForm ? '✕ Cancel' : '+ Publish New Batch'}</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
                Loading project media vault...
              </div>
            ) : deliverables.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                <span className="text-3xl block mb-2">📁</span>
                <h4 className="text-xs font-bold text-slate-800">No Deliverable Batches Published Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {isVendor
                    ? 'Export your edited photo lookbooks, 4K video cuts, or share your Google Drive / Dropbox link here once post-production is ready.'
                    : 'Your creative team will publish high-resolution downloads and cloud review links here once editing is finished.'}
                </p>
                {isVendor && !showUploadForm && (
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    + Publish First Deliverable
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {deliverables.map((item, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        item.status === 'approved'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : item.status === 'revision_requested'
                          ? 'bg-amber-50/40 border-amber-200'
                          : isLatest
                          ? 'bg-white border-indigo-200 shadow-xs ring-1 ring-indigo-500/10'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-indigo-100 text-indigo-800">
                              Batch v{item.version}.0
                            </span>
                            {isLatest && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-900 text-white">
                                Latest
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${
                                item.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : item.status === 'revision_requested'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-purple-100 text-purple-800 border-purple-300'
                              }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Published {new Date(item.created_at).toLocaleDateString()} at{' '}
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                          {item.description && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                              {item.description}
                            </p>
                          )}

                          {/* Client Feedback Box (If revision requested or approved) */}
                          {item.client_feedback && (
                            <div
                              className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${
                                item.status === 'approved'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                  : 'bg-rose-50 border-rose-200 text-rose-950'
                              }`}
                            >
                              <strong className="block text-[11px] uppercase tracking-wider mb-0.5 font-bold">
                                {item.status === 'approved' ? '✓ Client Approval Note:' : '⚠️ Client Revision Notes:'}
                              </strong>
                              <p className="italic font-medium">"{item.client_feedback}"</p>
                              {item.reviewed_at && (
                                <span className="text-[10px] text-slate-500 block mt-1">
                                  Reviewed {new Date(item.reviewed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Vendor Studio Reply Box */}
                          {item.vendor_reply && (
                            <div className="mt-2.5 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 text-xs text-indigo-950">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-900 flex items-center gap-1.5">
                                  <span>🎬</span> Studio Response & ETA:
                                </span>
                                {item.vendor_replied_at && (
                                  <span className="text-[10px] text-indigo-600">
                                    {new Date(item.vendor_replied_at).toLocaleDateString()} at{' '}
                                    {new Date(item.vendor_replied_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-indigo-900 leading-relaxed whitespace-pre-wrap">{item.vendor_reply}</p>
                            </div>
                          )}

                          {/* Revision Discussion & Studio Response Actions */}
                          {item.status === 'revision_requested' && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenRevisionChat(item)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <span>💬</span>
                                <span>{isVendor ? 'Discuss Revision in Project Chat' : 'Chat with Studio'}</span>
                              </button>

                              {isVendor && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingDeliverableId(replyingDeliverableId === item.id ? null : item.id);
                                    setVendorReplyText(item.vendor_reply || '');
                                  }}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>✍️</span>
                                  <span>{item.vendor_reply ? 'Edit Studio Response' : 'Post Studio Response'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Vendor Inline Studio Reply Drawer */}
                          {replyingDeliverableId === item.id && (
                            <div className="mt-3 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl animate-fadeIn text-xs">
                              <h5 className="font-bold text-indigo-950 mb-1 flex items-center gap-1.5">
                                <span>✍️</span> Respond to Client Revision
                              </h5>
                              <p className="text-indigo-800 text-[11px] mb-2 leading-relaxed">
                                Acknowledge the feedback, provide an ETA, or clarify changes with the client before uploading the new version.
                              </p>
                              <textarea
                                rows={3}
                                placeholder="e.g., We have reviewed your notes. We are color grading the outdoor segment and re-mixing audio stems. The revised cut will be uploaded by tomorrow 4 PM."
                                value={vendorReplyText}
                                onChange={(e) => setVendorReplyText(e.target.value)}
                                className="w-full bg-white border border-indigo-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500"
                              />
                              <div className="mt-2.5 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingDeliverableId(null);
                                    setVendorReplyText('');
                                  }}
                                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg text-xs hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVendorSubmitReply(item.id)}
                                  disabled={!vendorReplyText.trim() || submittingReply}
                                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                >
                                  {submittingReply ? 'Posting...' : 'Save Studio Response →'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Direct Action Link / Download */}
                        <div className="shrink-0 flex sm:flex-col items-center gap-2">
                          <a
                            href={
                              item.file_url.startsWith('http')
                                ? item.file_url
                                : `${item.file_url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <span>{item.deliverable_type === 'cloud_link' ? '🌐 Open Cloud Vault' : '⬇ Download Package'}</span>
                            <span>&rarr;</span>
                          </a>
                          {item.file_size && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {(Number(item.file_size) / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Customer Review Actions (For Latest unapproved deliverable) */}
                      {isCustomer && isLatest && item.status === 'submitted' && (
                        <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-slate-600 font-medium">
                            Have you reviewed the photos/video files? Sign off on the project or request adjustments:
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to approve this work? This marks the production as successfully completed.')) {
                                  handleClientReview(item.id, 'approved');
                                }
                              }}
                              disabled={isSubmittingReview}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <span>✓</span>
                              <span>Approve Deliverables</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setReviewingDeliverableId(reviewingDeliverableId === item.id ? null : item.id);
                              }}
                              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                              <span>🔄 Request Revision</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Revision Feedback Form Drawer */}
                      {reviewingDeliverableId === item.id && (
                        <div className="mt-3 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl animate-fadeIn text-xs">
                          <h5 className="font-bold text-amber-950 mb-1">
                            Specify Changes / Revisions Needed
                          </h5>
                          <p className="text-amber-800 text-[11px] mb-2">
                            Detail scenes, timestamps, color corrections, or specific frames you would like the creative partner to update:
                          </p>
                          <textarea
                            rows={3}
                            placeholder="e.g., Please brighten the outdoor ceremony segment, reduce background music volume at 0:45, and export in 16:9 vertical format for Reels..."
                            value={revisionFeedback}
                            onChange={(e) => setRevisionFeedback(e.target.value)}
                            className="w-full bg-white border border-amber-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                          />
                          <div className="mt-2.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewingDeliverableId(null);
                                setRevisionFeedback('');
                              }}
                              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClientReview(item.id, 'revision_requested')}
                              disabled={!revisionFeedback.trim() || isSubmittingReview}
                              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              {isSubmittingReview ? 'Sending Notes...' : 'Submit Revision Request →'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vendor Upload New Batch Form */}
          {isVendor && showUploadForm && (
            <div className="p-5 bg-slate-50 border border-indigo-200 rounded-3xl animate-fadeIn">
              <div className="flex items-center justify-between mb-3 border-b border-slate-200/80 pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Publish Deliverables (Batch v{deliverables.length + 1}.0)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Provide the client with download access to edited films, high-resolution photo archives, or lookbooks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                >
                  ✕ Close
                </button>
              </div>

              {uploadError && (
                <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {uploadError}
                </div>
              )}

              <form onSubmit={handleVendorSubmitDeliverable} className="space-y-3.5 text-xs">
                {/* Title */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Deliverable Package Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 4K Cinematic Master Teaser + 80 Retouched Stills"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                {/* Delivery Method Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Delivery Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliverableType('cloud_link')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        deliverableType === 'cloud_link'
                          ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold ring-1 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <span className="block text-xs font-bold">🌐 Cloud Storage Link</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Google Drive, Dropbox, WeTransfer, Frame.io</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliverableType('file_upload')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        deliverableType === 'file_upload'
                          ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold ring-1 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <span className="block text-xs font-bold">📁 Direct File Upload</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Photos, Teaser MP4, PDF Lookbook, ZIP Archive</span>
                    </button>
                  </div>
                </div>

                {/* Cloud URL */}
                {deliverableType === 'cloud_link' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cloud Delivery URL *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/drive/folders/... or https://we.tl/..."
                      value={cloudUrl}
                      onChange={(e) => setCloudUrl(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Ensure link permissions are set to "Anyone with the link can view/download" or shared with the client's email.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Select Local File (Up to 100MB) *
                    </label>
                    <input
                      type="file"
                      required
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 transition-colors file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Production & Color Grading Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Graded in Rec.709 color space. Audio stems mixed at standard web broadcast standards..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(false)}
                    className="px-4 py-2 bg-white text-slate-700 border border-slate-200 font-semibold rounded-xl text-xs hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>{submitting ? 'Publishing Deliverables...' : 'Publish to Client Media Vault →'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 flex items-center gap-2">
            <span>🛡️ CrewUp Media Escrow Protected</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
}
