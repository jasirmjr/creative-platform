import React, { useState, useEffect } from 'react';

export default function AdminComplaintDeskModal({
  isOpen,
  onClose,
  complaintId,
  token,
  onStatusUpdated,
}) {
  const [complaint, setComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  // Actions states
  const [adminReply, setAdminReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Verdict Modal state
  const [verdictModal, setVerdictModal] = useState({
    isOpen: false,
    status: 'resolved', // 'resolved' | 'dismissed'
    notes: '',
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Option 4: Admin Enforcement Modals & Action States
  const [refundModal, setRefundModal] = useState({
    isOpen: false,
    amount: '',
    reason: '',
    processing: false,
  });

  const [strikeModal, setStrikeModal] = useState({
    isOpen: false,
    reason: '',
    processing: false,
  });

  const [splitModal, setSplitModal] = useState({
    isOpen: false,
    refundAmount: '',
    payoutAmount: '',
    notes: '',
    processing: false,
  });

  const fetchDetails = async () => {
    if (!complaintId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setComplaint(data.data.complaint);
        setTimeline(data.data.timeline || []);
      }
    } catch (err) {
      console.error('Failed to load complaint details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && complaintId) {
      fetchDetails();
    }
  }, [isOpen, complaintId]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!adminReply.trim() || sendingReply) return;

    setSendingReply(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: adminReply.trim(),
          is_internal: isInternalNote,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTimeline((prev) => [...prev, data.data]);
        setAdminReply('');
        setIsInternalNote(false);
      } else {
        alert(data.message || 'Failed to post reply.');
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (newStatus, notes = '') => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setComplaint(data.data);
        setVerdictModal({ isOpen: false, status: 'resolved', notes: '' });
        fetchDetails();
        onStatusUpdated?.();
      } else {
        alert(data.message || 'Failed to update status.');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTriggerRefund = async (e) => {
    e.preventDefault();
    if (!refundModal.amount || isNaN(refundModal.amount) || Number(refundModal.amount) <= 0) {
      alert('Please specify a valid refund amount.');
      return;
    }
    setRefundModal((prev) => ({ ...prev, processing: true }));
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(refundModal.amount),
          reason: refundModal.reason.trim() || 'Admin dispute refund',
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Refund of ₹${data.data.refund_amount} processed successfully! (ID: ${data.data.refund_id})`);
        setRefundModal({ isOpen: false, amount: '', reason: '', processing: false });
        fetchDetails();
        onStatusUpdated?.();
      } else {
        alert(data.message || 'Refund failed.');
      }
    } catch (err) {
      console.error('Refund error:', err);
      alert('Network error while processing refund.');
    } finally {
      setRefundModal((prev) => ({ ...prev, processing: false }));
    }
  };

  const handleIssueStrike = async (e) => {
    e.preventDefault();
    if (!strikeModal.reason.trim()) {
      alert('Please specify a reason for this strike.');
      return;
    }
    setStrikeModal((prev) => ({ ...prev, processing: true }));
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/strike`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: strikeModal.reason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Warning strike issued! Vendor now has ${data.data.vendor_warning_strikes} warning strike(s).`);
        setStrikeModal({ isOpen: false, reason: '', processing: false });
        fetchDetails();
        onStatusUpdated?.();
      } else {
        alert(data.message || 'Failed to issue strike.');
      }
    } catch (err) {
      console.error('Strike error:', err);
      alert('Network error while issuing strike.');
    } finally {
      setStrikeModal((prev) => ({ ...prev, processing: false }));
    }
  };

  const handleRevokeStrike = async () => {
    if (!window.confirm('Are you sure you want to revoke 1 warning strike from this vendor?')) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/strike/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: 'Admin reviewed and rescinded strike penalty.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Strike revoked! Vendor now has ${data.data.vendor_warning_strikes} warning strike(s).`);
        fetchDetails();
        onStatusUpdated?.();
      } else {
        alert(data.message || 'Failed to revoke strike.');
      }
    } catch (err) {
      console.error('Revoke strike error:', err);
      alert('Network error while revoking strike.');
    }
  };

  const handleSplitSettlement = async (e) => {
    e.preventDefault();
    const refundAmt = Number(splitModal.refundAmount || 0);
    const payoutAmt = Number(splitModal.payoutAmount || 0);
    if (!splitModal.notes.trim()) {
      alert('Please provide settlement notes explaining the split verdict.');
      return;
    }
    setSplitModal((prev) => ({ ...prev, processing: true }));
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/complaints/${complaintId}/split-settlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          refund_amount: refundAmt,
          vendor_payout_amount: payoutAmt,
          notes: splitModal.notes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Split settlement verdict enforced! Complaint marked resolved.`);
        setSplitModal({ isOpen: false, refundAmount: '', payoutAmount: '', notes: '', processing: false });
        fetchDetails();
        onStatusUpdated?.();
      } else {
        alert(data.message || 'Failed to execute split settlement.');
      }
    } catch (err) {
      console.error('Split settlement error:', err);
      alert('Network error while executing split settlement.');
    } finally {
      setSplitModal((prev) => ({ ...prev, processing: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold uppercase tracking-wider">
              Desk
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Dispute Desk: #{complaint?.complaint_number || 'Ticket'}
                </h3>
                {complaint && (
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      complaint.priority === 'critical'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : complaint.priority === 'high'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {complaint.priority} Priority
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Admin Mediation & Dispute Resolution Workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Loading dispute case file...
            </div>
          ) : complaint ? (
            <>
              {/* Financial & Booking Reference Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Booking & Shoot Context
                  </span>
                  <p className="font-bold text-slate-900 text-sm">{complaint.project_name}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5 font-mono">
                    ID: #{complaint.booking_id?.slice(0, 8)}
                  </p>
                  <p className="text-slate-600 text-[11px] mt-1">
                    {new Date(complaint.booking_start_date).toLocaleDateString()} &rarr; {new Date(complaint.booking_end_date).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Financial Snapshot
                  </span>
                  <p className="text-slate-700 font-medium">
                    Total Budget: <strong className="font-mono text-slate-900">₹{Number(complaint.total_amount).toLocaleString()}</strong>
                  </p>
                  <p className="text-slate-700 font-medium mt-0.5">
                    Paid to Date: <strong className="font-mono text-emerald-700">₹{Number(complaint.paid_amount || 0).toLocaleString()}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 capitalize">
                    Payment Status: <strong className="text-blue-700">{complaint.booking_payment_status}</strong>
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Parties Involved
                  </span>
                  <p className="text-slate-800 font-medium">
                    Client: <strong className="text-slate-950">{complaint.customer_name}</strong>
                  </p>
                  <p className="text-slate-500 text-[11px]">{complaint.customer_mobile}</p>
                  <p className="text-slate-800 font-medium mt-1">
                    Vendor: <strong className="text-slate-950">{complaint.business_name}</strong>
                  </p>
                  <p className="text-slate-500 text-[11px]">Lead: {complaint.vendor_owner_name}</p>
                </div>
              </div>

              {/* Option 4: Admin Quick Enforcement & Trust Safety Control Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3.5 border border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-2">
                        <span>Admin Quick Enforcement Toolset</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">Dispute Controls Active</span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Instantly execute live Razorpay refunds, penalize non-compliance strikes, or enforce escrow split settlements.
                      </p>
                    </div>
                  </div>

                  {/* Trust Strike Status Pill */}
                  <div className="flex items-center gap-2.5 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Vendor Strikes</div>
                      <div className={`text-xs font-bold ${
                        Number(complaint.vendor_warning_strikes || 0) >= 3
                          ? 'text-rose-400'
                          : Number(complaint.vendor_warning_strikes || 0) > 0
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}>
                        {complaint.vendor_warning_strikes || 0} / 3 Strikes
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  {/* Financial / Refund Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundModal({
                        isOpen: true,
                        amount: complaint.desired_resolution_amount || complaint.claimed_amount || complaint.paid_amount || '',
                        reason: `Dispute Resolution for Complaint #${complaint.complaint_number}`,
                        processing: false,
                      })}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Trigger Razorpay Refund
                    </button>

                    {complaint.status !== 'resolved' && complaint.status !== 'dismissed' && (
                      <button
                        type="button"
                        onClick={() => setSplitModal({
                          isOpen: true,
                          refundAmount: Math.round((Number(complaint.paid_amount || 0)) / 2).toString(),
                          payoutAmount: (Number(complaint.paid_amount || 0) - Math.round((Number(complaint.paid_amount || 0)) / 2)).toString(),
                          notes: 'Admin mediated 50/50 split settlement based on partial deliverable completion.',
                          processing: false,
                        })}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        Split Escrow Verdict
                      </button>
                    )}

                    {complaint.refund_id && (
                      <span className="px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold rounded-xl text-xs">
                        Refunded: ₹{Number(complaint.refund_amount).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Strike Penalties */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStrikeModal({
                        isOpen: true,
                        reason: `Policy violation & non-cooperation on dispute #${complaint.complaint_number}`,
                        processing: false,
                      })}
                      className="px-3 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Issue Warning Strike
                    </button>

                    {Number(complaint.vendor_warning_strikes || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleRevokeStrike}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl transition-colors cursor-pointer"
                        title="Revoke 1 Strike"
                      >
                        Revoke Strike
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Claims & Statements Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Claim */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-200 pb-2">
                    <span className="font-bold text-amber-950">
                      Customer Grievance
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800 capitalize bg-white px-2 py-0.5 rounded border border-amber-200">
                      {complaint.category.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs">
                    {complaint.subject}
                  </h4>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {complaint.description}
                  </p>

                  <div className="pt-2 border-t border-amber-200 flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">
                        Proposed Resolution: <strong className="text-amber-900 capitalize font-semibold">{(complaint.desired_resolution_type || complaint.desired_resolution || 'investigation').replace(/_/g, ' ')}</strong>
                      </span>
                      {complaint.desired_resolution_amount && Number(complaint.desired_resolution_amount) > 0 && (
                        <span className="font-bold text-amber-900 font-mono bg-white px-2 py-0.5 rounded border border-amber-200">
                          Claim: ₹{Number(complaint.desired_resolution_amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {complaint.desired_resolution_details && (
                      <p className="text-slate-600 italic bg-white/80 p-2 rounded border border-amber-200 text-[11px]">
                        &ldquo;{complaint.desired_resolution_details}&rdquo;
                      </p>
                    )}
                    {complaint.attachment_url && (
                      <a
                        href={`http://127.0.0.1:5000${complaint.attachment_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1 mt-0.5"
                      >
                        View Customer Evidence
                      </a>
                    )}
                  </div>
                </div>

                {/* Vendor Statement */}
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-purple-200 pb-2">
                    <span className="font-bold text-purple-950">
                      Vendor Official Statement
                    </span>
                    <span className="text-[10px] font-semibold text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200">
                      {complaint.vendor_response ? 'Responded' : 'Awaiting Explanation'}
                    </span>
                  </div>

                  {complaint.settlement_agreed && (
                    <div className="p-3 bg-emerald-100/80 border border-emerald-300 rounded-xl space-y-1">
                      <span className="font-bold text-emerald-950 text-xs">
                        Mutual Settlement Concluded
                      </span>
                      <p className="text-emerald-900 text-[11px]">
                        Both parties agreed to <strong className="capitalize">{complaint.settlement_type?.replace(/_/g, ' ')}</strong>
                        {complaint.settlement_amount > 0 && ` (₹${Number(complaint.settlement_amount).toLocaleString()})`}.
                      </p>
                      {complaint.settlement_notes && (
                        <p className="text-emerald-800 text-[10px] italic">&ldquo;{complaint.settlement_notes}&rdquo;</p>
                      )}
                      <span className="text-[10px] text-emerald-700 block font-mono">
                        Settled at: {new Date(complaint.settlement_agreed_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {complaint.vendor_offer_type && !complaint.settlement_agreed && (
                    <div className="p-3 bg-purple-100/80 border border-purple-300 rounded-xl space-y-1">
                      <span className="font-bold text-purple-950 text-xs">
                        Active Vendor Counter-Offer
                      </span>
                      <p className="text-purple-900 text-[11px]">
                        Studio proposed: <strong className="capitalize">{complaint.vendor_offer_type.replace(/_/g, ' ')}</strong>
                        {Number(complaint.vendor_offer_amount || 0) > 0 && ` of ₹${Number(complaint.vendor_offer_amount).toLocaleString()}`}.
                      </p>
                      {complaint.vendor_offer_details && (
                        <p className="text-purple-800 text-[10px] italic">&ldquo;{complaint.vendor_offer_details}&rdquo;</p>
                      )}
                    </div>
                  )}

                  {complaint.vendor_response ? (
                    <>
                      <p className="text-purple-950 leading-relaxed italic">
                        &ldquo;{complaint.vendor_response}&rdquo;
                      </p>
                      {complaint.vendor_attachment_url && (
                        <a
                          href={`http://127.0.0.1:5000${complaint.vendor_attachment_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-700 font-bold hover:underline block pt-2 text-[11px]"
                        >
                          View Vendor Counter-Proof
                        </a>
                      )}
                      <span className="text-[10px] text-purple-600 block mt-2">
                        Submitted on {new Date(complaint.vendor_responded_at).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <div className="py-6 text-center space-y-2">
                      <p className="text-slate-500 italic">
                        No response submitted by vendor yet.
                      </p>
                      <button
                        onClick={() => handleUpdateStatus('under_vendor_review', 'Admin notified vendor to submit formal explanation.')}
                        disabled={updatingStatus}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs"
                      >
                        Request Vendor Explanation
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Verdict Banner (If Resolved) */}
              {(complaint.status === 'resolved' || complaint.status === 'dismissed') && (
                <div
                  className={`p-4 rounded-xl border text-xs shadow-xs ${
                    complaint.status === 'resolved'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-sm">
                      Dispute Closed: {complaint.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {new Date(complaint.resolved_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {complaint.resolution_notes}
                  </p>
                </div>
              )}

              {/* Threaded Dispute Timeline */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-900 block">
                  Dispute Case Timeline & Public/Internal Logs ({timeline.length})
                </span>

                <div className="space-y-2.5 max-h-56 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {timeline.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl text-xs ${
                        item.is_internal
                          ? 'bg-amber-100/70 border border-amber-300 text-amber-950'
                          : item.sender_role === 'admin'
                          ? 'bg-blue-50 border border-blue-200 text-blue-950'
                          : item.sender_role === 'vendor'
                          ? 'bg-purple-50 border border-purple-200 text-purple-950'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold flex items-center gap-1.5">
                          <span>{item.is_internal ? 'Internal Admin Note' : item.sender_name}</span>
                          <span className="text-[10px] font-normal opacity-70 uppercase">
                            ({item.sender_role})
                          </span>
                        </span>
                        <span className="text-[10px] opacity-60">
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="leading-relaxed">{item.message}</p>
                    </div>
                  ))}
                </div>

                {/* Admin Reply & Internal Note Form */}
                <form onSubmit={handleSendReply} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Send Update or Mediation Note</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Private Note (Only Admins See)</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={
                        isInternalNote
                          ? 'Write internal case investigation note...'
                          : 'Send public mediation reply to customer and vendor...'
                      }
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={!adminReply.trim() || sendingReply}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
                    >
                      {sendingReply ? 'Sending...' : 'Post Message'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : null}
        </div>

        {/* Action Resolution Bar */}
        {complaint && complaint.status !== 'resolved' && complaint.status !== 'dismissed' && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Case Actions:</span>
              <button
                onClick={() => handleUpdateStatus('under_vendor_review', 'Platform requested vendor explanation.')}
                disabled={updatingStatus || complaint.status === 'under_vendor_review'}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
              >
                Request Vendor Statement
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setVerdictModal({ isOpen: true, status: 'dismissed', notes: '' })}
                disabled={updatingStatus}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Dismiss Complaint
              </button>

              <button
                onClick={() => setVerdictModal({ isOpen: true, status: 'resolved', notes: '' })}
                disabled={updatingStatus}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Resolve Dispute
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Final Verdict Input Modal */}
      {verdictModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              {verdictModal.status === 'resolved' ? 'Mark Dispute as Resolved' : 'Dismiss Complaint'}
            </h4>
            <p className="text-xs text-slate-500">
              Enter official verdict and settlement terms. This will be permanently recorded and displayed to both the client and vendor.
            </p>

            <textarea
              rows={3}
              required
              placeholder={
                verdictModal.status === 'resolved'
                  ? 'e.g. Vendor provided complimentary reshoot. Partial refund of ₹5,000 processed.'
                  : 'e.g. Complaint unsubstantiated based on agreed project deliverables.'
              }
              value={verdictModal.notes}
              onChange={(e) => setVerdictModal((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVerdictModal({ isOpen: false, status: 'resolved', notes: '' })}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!verdictModal.notes.trim() || updatingStatus}
                onClick={() => handleUpdateStatus(verdictModal.status, verdictModal.notes)}
                className={`px-4 py-1.5 text-white font-bold text-xs rounded-xl shadow-xs ${
                  verdictModal.status === 'resolved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {updatingStatus ? 'Recording...' : 'Confirm Verdict'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Option 4: Razorpay Refund Execution Modal */}
      {refundModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Trigger Razorpay Refund</h4>
              </div>
              <button
                type="button"
                onClick={() => setRefundModal({ isOpen: false, amount: '', reason: '', processing: false })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Paid by Customer:</span>
                <strong className="text-slate-900 font-mono">₹{Number(complaint?.paid_amount || 0).toLocaleString()}</strong>
              </div>
              {Number(complaint?.refund_amount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Already Refunded:</span>
                  <strong className="font-mono">₹{Number(complaint?.refund_amount).toLocaleString()}</strong>
                </div>
              )}
              <div className="flex justify-between text-blue-700 font-semibold border-t border-slate-200 pt-1">
                <span>Max Available to Refund:</span>
                <strong className="font-mono">₹{Math.max(0, Number(complaint?.paid_amount || 0) - Number(complaint?.refund_amount || 0)).toLocaleString()}</strong>
              </div>
            </div>

            <form onSubmit={handleTriggerRefund} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Refund Amount (₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(0, Number(complaint?.paid_amount || 0) - Number(complaint?.refund_amount || 0))}
                    required
                    value={refundModal.amount}
                    onChange={(e) => setRefundModal((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="Enter amount"
                  />
                </div>
                {/* Quick select pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setRefundModal((prev) => ({ ...prev, amount: (Math.max(0, Number(complaint?.paid_amount || 0) - Number(complaint?.refund_amount || 0))).toString() }))}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer font-medium"
                  >
                    Full Balance (₹{Math.max(0, Number(complaint?.paid_amount || 0) - Number(complaint?.refund_amount || 0))})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundModal((prev) => ({ ...prev, amount: Math.round((Number(complaint?.paid_amount || 0)) / 2).toString() }))}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer font-medium"
                  >
                    50% Split
                  </button>
                  {complaint?.desired_resolution_amount && Number(complaint.desired_resolution_amount) > 0 && (
                    <button
                      type="button"
                      onClick={() => setRefundModal((prev) => ({ ...prev, amount: complaint.desired_resolution_amount.toString() }))}
                      className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded cursor-pointer font-medium"
                    >
                      Client Desired (₹{Number(complaint.desired_resolution_amount).toLocaleString()})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Refund Reason / Audit Note
                </label>
                <input
                  type="text"
                  value={refundModal.reason}
                  onChange={(e) => setRefundModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="e.g. Approved partial refund for defective video deliverable"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefundModal({ isOpen: false, amount: '', reason: '', processing: false })}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundModal.processing || !refundModal.amount || Number(refundModal.amount) <= 0}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {refundModal.processing ? 'Processing Razorpay...' : 'Execute Instant Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Option 4: Issue Vendor Warning Strike Modal */}
      {strikeModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Issue Vendor Warning Strike</h4>
              </div>
              <button
                type="button"
                onClick={() => setStrikeModal({ isOpen: false, reason: '', processing: false })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Trust & Safety Enforcement Policy:</p>
              <p className="text-[11px] text-amber-800">
                Vendor currently has <strong className="font-bold">{complaint?.vendor_warning_strikes || 0} / 3</strong> strikes.
                3 strikes automatically flags the studio for restriction or suspension.
              </p>
            </div>

            <form onSubmit={handleIssueStrike} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Violation Reason / Misconduct *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Unresponsive to grievance inquiry',
                    'Late delivery beyond agreed deadline',
                    'Unprofessional conduct on shoot',
                    'Failure to provide raw deliverables',
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStrikeModal((prev) => ({ ...prev, reason: r }))}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer font-medium"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  required
                  value={strikeModal.reason}
                  onChange={(e) => setStrikeModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  placeholder="Provide precise details of the vendor breach or non-compliance..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStrikeModal({ isOpen: false, reason: '', processing: false })}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={strikeModal.processing || !strikeModal.reason.trim()}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {strikeModal.processing ? 'Recording Strike...' : 'Confirm Warning Strike'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Option 4: Split Escrow Settlement Verdict Modal */}
      {splitModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Enforce Split Escrow Settlement</h4>
              </div>
              <button
                type="button"
                onClick={() => setSplitModal({ isOpen: false, refundAmount: '', payoutAmount: '', notes: '', processing: false })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-purple-900 font-semibold">
                <span>Total Escrow Funds Paid:</span>
                <strong className="font-mono">₹{Number(complaint?.paid_amount || 0).toLocaleString()}</strong>
              </div>
              <p className="text-[11px] text-purple-800">
                Allocate funds between a Customer Razorpay Refund and Vendor Studio Final Payout.
              </p>
            </div>

            <form onSubmit={handleSplitSettlement} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Client Refund (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={Number(complaint?.paid_amount || 0)}
                    value={splitModal.refundAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitModal((prev) => ({
                        ...prev,
                        refundAmount: val,
                        payoutAmount: Math.max(0, Number(complaint?.paid_amount || 0) - Number(val || 0)).toString(),
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Vendor Payout (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={Number(complaint?.paid_amount || 0)}
                    value={splitModal.payoutAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitModal((prev) => ({
                        ...prev,
                        payoutAmount: val,
                        refundAmount: Math.max(0, Number(complaint?.paid_amount || 0) - Number(val || 0)).toString(),
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-purple-700 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Settlement Terms & Official Verdict Memo *
                </label>
                <textarea
                  rows={3}
                  required
                  value={splitModal.notes}
                  onChange={(e) => setSplitModal((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="Detail the rationale for the split allocation..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSplitModal({ isOpen: false, refundAmount: '', payoutAmount: '', notes: '', processing: false })}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={splitModal.processing || !splitModal.notes.trim()}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>{splitModal.processing ? 'Enforcing Verdict...' : 'Enforce Split Verdict'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
