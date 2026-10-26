import React, { useState, useEffect, useRef } from 'react';

export default function ComplaintModal({
  isOpen,
  onClose,
  booking,
  token,
  user,
  onSuccess,
}) {
  const [existingComplaint, setExistingComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Wizard State (1: Category & Problem, 2: Desired Terms, 3: Evidence & Review)
  const [wizardStep, setWizardStep] = useState(1);

  // Form States
  const [category, setCategory] = useState('delay_schedule');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [desiredResolutionType, setDesiredResolutionType] = useState('partial_refund');
  const [desiredResolutionAmount, setDesiredResolutionAmount] = useState('');
  const [desiredResolutionDetails, setDesiredResolutionDetails] = useState('');
  const [priority, setPriority] = useState('medium');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Settlement Offer Action states in tracking mode
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [escalatingAdmin, setEscalatingAdmin] = useState(false);

  // Reply state in tracking mode
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fileInputRef = useRef(null);

  // Check if there is an existing complaint for this booking
  useEffect(() => {
    if (!isOpen || !booking || !token) return;

    const checkExisting = async () => {
      setLoadingExisting(true);
      try {
        const res = await fetch('/api/v1/complaints/my', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const match = data.data.find((c) => c.booking_id === booking.id);
          if (match) {
            setExistingComplaint(match);
            // Load full timeline
            const tRes = await fetch(`/api/v1/complaints/${match.id}/timeline`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const tData = await tRes.json();
            if (tData.success) {
              setTimeline(tData.data?.timeline || []);
            }
          } else {
            setExistingComplaint(null);
            setTimeline([]);
            setWizardStep(1);
          }
        }
      } catch (err) {
        console.error('Failed to check existing complaints:', err);
      } finally {
        setLoadingExisting(false);
      }
    };

    checkExisting();
  }, [isOpen, booking, token]);

  // Set default refund amounts based on booking total
  const bookingTotal = Number(booking?.total_amount || 0);

  const handleApplyPresetChip = (percentageOrType) => {
    if (percentageOrType === 'reshoot_reedit') {
      setDesiredResolutionType('reshoot_reedit');
      setDesiredResolutionAmount('');
    } else if (percentageOrType === 'raw_assets') {
      setDesiredResolutionType('raw_assets');
      setDesiredResolutionAmount('');
    } else if (percentageOrType === 'full') {
      setDesiredResolutionType('full_refund');
      setDesiredResolutionAmount(bookingTotal ? String(bookingTotal) : '');
    } else {
      const pct = Number(percentageOrType);
      const calculated = Math.round((bookingTotal * pct) / 100);
      setDesiredResolutionType('partial_refund');
      setDesiredResolutionAmount(String(calculated));
    }
  };

  const handleNextStep = () => {
    if (wizardStep === 1) {
      if (!subject.trim()) {
        setFeedback({ type: 'error', message: 'Please provide a brief subject or headline for the dispute.' });
        return;
      }
      setFeedback(null);
      setWizardStep(2);
    } else if (wizardStep === 2) {
      if (
        (desiredResolutionType === 'partial_refund' || desiredResolutionType === 'full_refund') &&
        (!desiredResolutionAmount || Number(desiredResolutionAmount) <= 0)
      ) {
        setFeedback({ type: 'error', message: 'Please specify a valid refund amount.' });
        return;
      }
      setFeedback(null);
      setWizardStep(3);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!booking || submitting) return;

    if (!description.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a detailed description of the grievance.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('booking_id', booking.id);
      formData.append('category', category);
      formData.append('subject', subject.trim());
      formData.append('description', description.trim());
      formData.append('desired_resolution', desiredResolutionType);
      formData.append('desired_resolution_type', desiredResolutionType);
      formData.append('desired_resolution_amount', desiredResolutionAmount || 0);
      formData.append('desired_resolution_details', desiredResolutionDetails.trim());
      formData.append('claimed_amount', desiredResolutionAmount || 0);
      formData.append('priority', priority);
      if (proofFile) {
        formData.append('attachment', proofFile);
      }

      const res = await fetch('/api/v1/complaints', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: data.message });
        setExistingComplaint(data.data);
        onSuccess?.(data.data);
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to submit complaint.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptVendorOffer = async () => {
    if (!existingComplaint || acceptingOffer) return;
    setAcceptingOffer(true);
    try {
      const res = await fetch(`/api/v1/complaints/${existingComplaint.id}/accept-vendor-offer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setExistingComplaint(data.data);
        const tRes = await fetch(`/api/v1/complaints/${existingComplaint.id}/timeline`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tData = await tRes.json();
        if (tData.success) setTimeline(tData.data?.timeline || []);
        onSuccess?.(data.data);
      } else {
        alert(data.message || 'Failed to accept offer.');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setAcceptingOffer(false);
    }
  };

  const handleEscalateToAdmin = async () => {
    if (!existingComplaint || escalatingAdmin) return;
    const reason = window.prompt(
      'Please provide a reason for escalating to Platform Admin arbitration:',
      'Could not reach an agreement on the studio counter-proposal.'
    );
    if (reason === null) return;

    setEscalatingAdmin(true);
    try {
      const res = await fetch(`/api/v1/complaints/${existingComplaint.id}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        const tRes = await fetch(`/api/v1/complaints/${existingComplaint.id}/timeline`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tData = await tRes.json();
        if (tData.success) {
          setExistingComplaint(tData.data?.complaint);
          setTimeline(tData.data?.timeline || []);
        }
      } else {
        alert(data.message || 'Failed to escalate.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setEscalatingAdmin(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !existingComplaint || sendingReply) return;

    setSendingReply(true);
    try {
      const res = await fetch(`/api/v1/complaints/${existingComplaint.id}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setTimeline((prev) => [...prev, data.data]);
        setReplyMessage('');
      } else {
        alert(data.message || 'Failed to post reply.');
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  if (!isOpen || !booking) return null;

  const categories = [
    { id: 'delay_schedule', title: 'Schedule & Timeline Delay', desc: 'Missed shooting dates, unexcused delays, or late post-production delivery.' },
    { id: 'deliverable_quality', title: 'Deliverable Quality & Incomplete', desc: 'Defective assets, missed agreed shots, or incomplete edit specifications.' },
    { id: 'unprofessional_conduct', title: 'Unprofessional Conduct', desc: 'Poor communication, contractual breach, or unannounced staff changes.' },
    { id: 'equipment_failure', title: 'Equipment & Technical Problem', desc: 'Missing essential gear, audio/lighting failures, or corrupted storage.' },
    { id: 'payment_dispute', title: 'Payment & Scope Discrepancy', desc: 'Disputed extra fees, scope creep, or invoice mismatch.' },
    { id: 'cancellation', title: 'Unjustified Cancellation', desc: 'Studio cancelled without reasonable advance notice or contractual grounds.' },
    { id: 'other', title: 'Other Grievance', desc: 'Any other service discrepancies or contractual matters.' },
  ];

  const resolutionOptions = [
    { id: 'partial_refund', label: 'Partial Goodwill Refund (₹)' },
    { id: 'full_refund', label: 'Full Booking Refund (₹)' },
    { id: 'reshoot_reedit', label: 'Complimentary Reshoot / Re-edit' },
    { id: 'raw_assets', label: 'Delivery of Raw Uncompressed Files' },
    { id: 'other', label: 'Custom Settlement Terms' },
  ];

  const statusLabels = {
    open: { label: 'Stage 2/4: Mutual Review (7 Days)', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
    under_vendor_review: { label: 'Stage 2/4: Studio Review Active', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    vendor_responded: { label: 'Stage 3/4: Studio Counter-Offer Proposed', bg: 'bg-purple-50 text-purple-900 border-purple-300' },
    resolved: { label: 'Stage 4/4: Settled & Resolved', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    dismissed: { label: 'Closed / Dismissed', bg: 'bg-slate-100 text-slate-800 border-slate-300' },
  };

  // Determine active stepper index (0-based: 0=Filed, 1=Mutual Review, 2=Counter/Arbitration, 3=Settled)
  let activeStepperIndex = 1;
  if (existingComplaint) {
    if (existingComplaint.status === 'resolved' || existingComplaint.status === 'dismissed' || existingComplaint.settlement_agreed) {
      activeStepperIndex = 3;
    } else if (existingComplaint.vendor_offer_type || existingComplaint.is_expired) {
      activeStepperIndex = 2;
    } else {
      activeStepperIndex = 1;
    }
  }

  // SLA Calculation for 1-Week (168 hours) window
  const hoursRemaining = Number(existingComplaint?.hours_remaining ?? 168);
  const daysRemaining = Number(existingComplaint?.days_remaining ?? 7);
  const isSlaExpired = existingComplaint?.is_expired || hoursRemaining <= 0;
  // Progress of 7 days: 0 to 100%
  const elapsedPercent = Math.min(100, Math.max(0, Math.round(((168 - hoursRemaining) / 168) * 100)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 tracking-wider">
                {existingComplaint ? 'Resolution Center' : 'Guided Dispute Filing'}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                1-Week Mutual Settlement SLA
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {existingComplaint ? `Dispute #${existingComplaint.complaint_number}` : 'Raise a Project Dispute'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Project: <strong className="text-slate-800">{booking.project_name || 'Creative Booking'}</strong> &bull; Partner: <strong className="text-slate-800">{booking.business_name || booking.provider_name || 'Creative Studio'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {loadingExisting ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Checking dispute records...
            </div>
          ) : existingComplaint ? (
            /* ================= TRACKING MODE ================= */
            <div className="space-y-5">
              
              {/* 4-Stage Visual Stepper */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4">
                <div className="text-[11px] font-bold text-slate-700 mb-3 uppercase tracking-wider">
                  Resolution Lifecycle Progress
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { title: '1. Request Filed', desc: 'Case Submitted' },
                    { title: '2. Mutual Review', desc: '1-Week Window' },
                    { title: '3. Terms / Arbitrate', desc: 'Offer or Admin' },
                    { title: '4. Escrow Settled', desc: 'Adjusted & Closed' },
                  ].map((st, idx) => {
                    const isDone = activeStepperIndex > idx;
                    const isCurrent = activeStepperIndex === idx;
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <div
                          className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border transition-all ${
                            isDone
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100'
                              : 'bg-white border-slate-300 text-slate-400'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-blue-700' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                          {st.title}
                        </span>
                        <span className="text-[9px] text-slate-400 hidden sm:block">
                          {st.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1-Week SLA Countdown Banner (if not resolved/dismissed) */}
              {existingComplaint.status !== 'resolved' && existingComplaint.status !== 'dismissed' && !existingComplaint.settlement_agreed && (
                <div className={`p-4 rounded-xl border text-xs shadow-xs ${
                  isSlaExpired ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-amber-50/80 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        isSlaExpired ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-200/70 text-amber-900 border-amber-400'
                      }`}>
                        {isSlaExpired ? 'SLA Expired' : '1-Week Mutual Window'}
                      </span>
                      <span className="font-bold">
                        {isSlaExpired ? 'Escalated to Platform Arbitration' : `${daysRemaining} days remaining (${hoursRemaining}h)`}
                      </span>
                    </div>
                    {existingComplaint.resolution_deadline && (
                      <span className="text-[10px] text-slate-600 font-mono">
                        Deadline: {new Date(existingComplaint.resolution_deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Progress bar of 1-week window */}
                  <div className="w-full bg-slate-200/80 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${isSlaExpired ? 'bg-rose-600 w-full' : 'bg-amber-500'}`}
                      style={{ width: isSlaExpired ? '100%' : `${elapsedPercent}%` }}
                    />
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-700">
                    {isSlaExpired
                      ? 'The 1-week mutual settlement window has concluded without consensus. Platform administration has been assigned to conduct binding arbitration and adjust escrow funds.'
                      : 'You and the creative studio have 1 week to agree on terms or submit counter-offers. Upon mutual acceptance, escrow balances adjust instantly. If unresolved at deadline, Platform Arbitration takes over.'}
                  </p>
                </div>
              )}

              {/* Ticket Status Summary Card */}
              <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-600">
                      #{existingComplaint.complaint_number}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Filed on {new Date(existingComplaint.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    {existingComplaint.subject}
                  </h4>
                </div>

                <div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border inline-block ${
                      statusLabels[existingComplaint.status]?.bg || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {statusLabels[existingComplaint.status]?.label || existingComplaint.status}
                  </span>
                </div>
              </div>

              {/* Mutual Settlement Agreement Banner (Escrow Adjusted) */}
              {existingComplaint.settlement_agreed && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs shadow-xs text-emerald-950 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-sm">
                      Mutual Settlement Agreement Finalized
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                      Escrow Auto-Adjusted
                    </span>
                  </div>
                  <p className="leading-relaxed font-medium text-emerald-900">
                    {existingComplaint.settlement_notes || 'Both parties agreed to amicable settlement terms. Booking balances and escrow accounts have been credited accordingly.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-emerald-800 font-medium">
                    <span>
                      Settlement Terms: <strong className="uppercase">{existingComplaint.settlement_type?.replace(/_/g, ' ')}</strong>
                    </span>
                    {Number(existingComplaint.settlement_amount) > 0 && (
                      <>
                        <span>&bull;</span>
                        <span>
                          Deducted / Credited Amount: <strong className="font-mono">₹{Number(existingComplaint.settlement_amount).toLocaleString()}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Studio Counter-Offer Proposal Card */}
              {existingComplaint.vendor_offer_type && !existingComplaint.settlement_agreed && existingComplaint.status !== 'resolved' && existingComplaint.status !== 'dismissed' && (
                <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-300 text-xs shadow-xs text-blue-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-950 block text-sm">
                        Studio Proposed a Counter-Settlement
                      </span>
                      <span className="text-[11px] text-blue-700">
                        You can accept to settle instantly and adjust booking payments.
                      </span>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                      Action Required
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs text-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Proposed Terms:</span>
                      <span className="font-bold text-blue-700 capitalize">
                        {existingComplaint.vendor_offer_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {Number(existingComplaint.vendor_offer_amount) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-600">Offered Settlement Amount:</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          ₹{Number(existingComplaint.vendor_offer_amount).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {existingComplaint.vendor_offer_details && (
                      <p className="text-slate-700 italic pt-1 border-t border-slate-100">
                        &ldquo;{existingComplaint.vendor_offer_details}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={escalatingAdmin || acceptingOffer}
                      onClick={handleEscalateToAdmin}
                      className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      {escalatingAdmin ? 'Escalating...' : 'Decline & Escalate to Admin'}
                    </button>
                    <button
                      type="button"
                      disabled={escalatingAdmin || acceptingOffer}
                      onClick={handleAcceptVendorOffer}
                      className="w-full sm:w-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>✓</span>
                      <span>{acceptingOffer ? 'Accepting...' : "Accept Counter-Offer & Settle Escrow"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Resolution Verdict Card (If Resolved or Dismissed) */}
              {(existingComplaint.status === 'resolved' || existingComplaint.status === 'dismissed') && (
                <div
                  className={`p-4 rounded-xl border text-xs shadow-xs ${
                    existingComplaint.status === 'resolved'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>
                      {existingComplaint.status === 'resolved' ? 'Platform Admin Formal Verdict: Resolved' : 'Platform Verdict: Dismissed'}
                    </span>
                    {existingComplaint.resolved_at && (
                      <span className="text-[10px] opacity-75 font-normal">
                        {new Date(existingComplaint.resolved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed font-medium">
                    {existingComplaint.resolution_notes || 'This dispute has been reviewed and adjudicated by platform administration.'}
                  </p>
                </div>
              )}

              {/* Vendor Official Response Card */}
              {existingComplaint.vendor_response && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-purple-950">
                      Studio Official Statement
                    </span>
                    {existingComplaint.vendor_responded_at && (
                      <span className="text-[10px] text-purple-700">
                        {new Date(existingComplaint.vendor_responded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-purple-900 leading-relaxed italic">
                    &ldquo;{existingComplaint.vendor_response}&rdquo;
                  </p>
                  {existingComplaint.vendor_attachment_url && (
                    <a
                      href={`${existingComplaint.vendor_attachment_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[11px] text-purple-700 font-bold hover:underline"
                    >
                      <span>[View Vendor Counter-Evidence Document]</span>
                    </a>
                  )}
                </div>
              )}

              {/* Customer Initial Claim Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Original Claim Details
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 capitalize">
                    Priority: {existingComplaint.priority || 'medium'}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {existingComplaint.description}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-200">
                  <span>
                    Category: <strong className="text-slate-700 capitalize">{existingComplaint.category?.replace(/_/g, ' ')}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Desired Terms: <strong className="text-slate-700 capitalize">{existingComplaint.desired_resolution?.replace(/_/g, ' ')}</strong>
                  </span>
                  {Number(existingComplaint.desired_resolution_amount || existingComplaint.claimed_amount) > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>
                        Claimed Amount: <strong className="font-mono text-slate-900">₹{Number(existingComplaint.desired_resolution_amount || existingComplaint.claimed_amount).toLocaleString()}</strong>
                      </span>
                    </>
                  )}
                  {existingComplaint.attachment_url && (
                    <>
                      <span>&bull;</span>
                      <a
                        href={`${existingComplaint.attachment_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold hover:underline"
                      >
                        [View Customer Evidence]
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Threaded Mediation Replies */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Mediation Log & Responses ({timeline.length})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Platform mediation history
                  </span>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {timeline.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">
                      Awaiting initial review from platform administration.
                    </p>
                  ) : (
                    timeline.map((entry) => {
                      const isMe = entry.sender_id === user?.id;
                      const isAdmin = entry.sender_role === 'admin';

                      return (
                        <div
                          key={entry.id}
                          className={`p-3 rounded-xl text-xs ${
                            isAdmin
                              ? 'bg-blue-50 border border-blue-200 text-blue-950'
                              : isMe
                              ? 'bg-white border border-slate-200 text-slate-800'
                              : 'bg-purple-50 border border-purple-200 text-purple-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold">
                              {isAdmin ? 'Platform Administrator' : entry.sender_name}
                              <span className="text-[10px] opacity-75 font-normal ml-1">
                                ({entry.sender_role})
                              </span>
                            </span>
                            <span className="text-[10px] opacity-60">
                              {new Date(entry.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="leading-relaxed">{entry.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Follow-up Reply Input */}
                {existingComplaint.status !== 'resolved' && existingComplaint.status !== 'dismissed' && (
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add information or response to admin..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={!replyMessage.trim() || sendingReply}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
                    >
                      {sendingReply ? 'Sending...' : 'Post Note'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* ================= 3-STEP GUIDED WIZARD MODE ================= */
            <form onSubmit={handleSubmitComplaint} className="space-y-5">
              
              {/* Wizard Step Indicator Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Step {wizardStep} of 3: {wizardStep === 1 ? 'Identify Issue' : wizardStep === 2 ? 'Desired Settlement' : 'Evidence & Review'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {wizardStep === 1 ? '33%' : wizardStep === 2 ? '66%' : '100%'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(wizardStep / 3) * 100}%` }}
                  />
                </div>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {/* STEP 1: CATEGORY & SUBJECT */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Select Issue Category <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2.5">
                      Choose the category that best describes the breakdown in service.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {categories.map((c) => {
                        const isSelected = category === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setCategory(c.id)}
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/10'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                {c.title}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {c.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Dispute Headline / Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 5 days overdue for raw deliverables, missed primary video reel"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: DESIRED RESOLUTION & PRESET CHIPS */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-blue-950 block">
                      Direct Mutual Settlement Window (1 Week)
                    </span>
                    <p className="text-blue-900 leading-relaxed text-[11px]">
                      The studio will receive your proposed terms and can accept them directly within 1 week. If accepted, the booking balance is adjusted immediately without administrative delays.
                    </p>
                  </div>

                  {/* Preset Settlement Chips */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-800">
                        Quick Settlement Suggestions
                      </label>
                      {bookingTotal > 0 && (
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          Booking Total: ₹{bookingTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { label: '20% Refund', val: '20' },
                        { label: '30% Refund', val: '30' },
                        { label: '50% Refund', val: '50' },
                        { label: '100% Full Refund', val: 'full' },
                        { label: 'Free Reshoot / Revision', val: 'reshoot_reedit' },
                        { label: 'Raw Uncompressed Assets', val: 'raw_assets' },
                      ].map((chip) => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => handleApplyPresetChip(chip.val)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-xs font-semibold text-slate-700 hover:text-blue-800 transition-colors cursor-pointer shadow-2xs"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Settlement Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={desiredResolutionType}
                        onChange={(e) => setDesiredResolutionType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                      >
                        {resolutionOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(desiredResolutionType === 'partial_refund' || desiredResolutionType === 'full_refund') ? (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Claimed Refund Amount (₹) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            required
                            min="1"
                            max={bookingTotal || 999999}
                            placeholder={bookingTotal ? `Max ₹${bookingTotal.toLocaleString()}` : 'e.g. 2000'}
                            value={desiredResolutionAmount}
                            onChange={(e) => setDesiredResolutionAmount(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Dispute Priority
                        </label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                        >
                          <option value="low">Low (Minor adjustment or delivery)</option>
                          <option value="medium">Medium (Schedule or quality issue)</option>
                          <option value="high">High (Substantial breach or delay)</option>
                          <option value="critical">Critical (Complete failure or no-show)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Direct Settlement Note for Studio (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. If 30% refund is accepted, we will consider the deliverables accepted and close the dispute."
                      value={desiredResolutionDetails}
                      onChange={(e) => setDesiredResolutionDetails(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: CONTEXTUAL EVIDENCE & REVIEW */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {/* Contextual guidance tip */}
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-0.5">
                    <span className="font-bold text-slate-900 block text-[11px]">
                      Context Guidance
                    </span>
                    <p className="text-[11px] text-slate-600">
                      {category === 'delay_schedule'
                        ? 'State the agreed delivery date from chat or milestones, the number of days delayed, and any impact on your production.'
                        : category === 'deliverable_quality'
                        ? 'Detail the missing shots, resolution flaws, color discrepancies, or specifications not met.'
                        : category === 'equipment_failure'
                        ? 'List the contracted equipment vs what was missing or inoperable during your booking.'
                        : 'Provide factual timelines and objective evidence to expedite agreement or administrative evaluation.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Detailed Account of the Grievance <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe what occurred, what was agreed upon, and how the studio failed to deliver the expected service..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all leading-relaxed"
                    />
                  </div>

                  {/* Attachment Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Supporting Evidence Document / Screenshots (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        {proofFile ? 'Change Selected File' : 'Upload Evidence (PDF / Images)'}
                      </button>
                      {proofFile && (
                        <div className="flex items-center gap-2 text-xs text-slate-800">
                          <span className="font-semibold truncate max-w-xs">{proofFile.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setProofFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="text-rose-600 font-bold p-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Attach contracts, defective frames, or message logs (Max 25MB).
                    </p>
                  </div>

                  {/* Filing Summary Review Box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                    <div className="font-bold text-slate-900">
                      Summary Before Submission
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="block text-slate-400">Category:</span>
                        <span className="font-semibold text-slate-800 capitalize">{category.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Resolution Requested:</span>
                        <span className="font-semibold text-slate-800 capitalize">{desiredResolutionType.replace(/_/g, ' ')}</span>
                      </div>
                      {Number(desiredResolutionAmount) > 0 && (
                        <div>
                          <span className="block text-slate-400">Claimed Amount:</span>
                          <span className="font-mono font-bold text-slate-900">₹{Number(desiredResolutionAmount).toLocaleString()}</span>
                        </div>
                      )}
                      <div>
                        <span className="block text-slate-400">SLA Window:</span>
                        <span className="font-semibold text-amber-700">1 Week (7 Days) Mutual Review</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Navigation Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {wizardStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      &larr; Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {wizardStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      Continue &rarr;
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      {submitting ? 'Filing Official Dispute...' : 'File Official Dispute'}
                    </button>
                  )}
                </div>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
