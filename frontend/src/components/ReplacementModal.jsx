import React, { useState, useEffect } from 'react';

export default function ReplacementModal({
  isOpen,
  onClose,
  booking,
  token: propToken,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [swappingVendorId, setSwappingVendorId] = useState(null);

  const token = propToken || sessionStorage.getItem('token') || localStorage.getItem('token');

  useEffect(() => {
    if (!isOpen || !booking) {
      setCandidates([]);
      setError('');
      setSearchQuery('');
      setSwappingVendorId(null);
      return;
    }

    fetchCandidates();
  }, [isOpen, booking]);

  const fetchCandidates = async () => {
    if (!booking) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/bookings/${booking.id}/replacement-candidates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch replacement candidates.');
      }

      setCandidates(data.candidates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReplacement = async (candidate) => {
    if (!booking || !candidate) return;
    const confirmMsg = `Swap ${candidate.business_name} into your crew for "${booking.project_name || 'Production Shoot'}"?\n\nShoot Schedule: ${new Date(booking.start_date).toLocaleDateString()} to ${new Date(booking.end_date).toLocaleDateString()}\nNew Project Fee: ₹${Number(candidate.calculated_total).toLocaleString()}`;
    if (!window.confirm(confirmMsg)) return;

    setSwappingVendorId(candidate.vendor_id);
    setError('');

    try {
      const res = await fetch(`/api/v1/bookings/${booking.id}/replace-vendor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_vendor_id: candidate.vendor_id,
          new_resource_id: candidate.resource_id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to replace vendor.');
      }

      onSuccess?.(data.data, data.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSwappingVendorId(null);
    }
  };

  if (!isOpen || !booking) return null;

  const filteredCandidates = candidates.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.business_name && c.business_name.toLowerCase().includes(q)) ||
      (c.owner_name && c.owner_name.toLowerCase().includes(q)) ||
      (c.skills && c.skills.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
    );
  });

  const startDateFormatted = new Date(booking.start_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const endDateFormatted = new Date(booking.end_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Same-Date Replacement
              </span>
              {booking.crew_role && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                  Role: {booking.crew_role}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Re-arrange Crew Specialist
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Campaign: <strong className="text-slate-700">{booking.crew_bundle_name || booking.project_name}</strong> &bull; Schedule: <span className="font-semibold text-slate-800">{startDateFormatted} → {endDateFormatted}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Previous Vendor Decline Context */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-bold text-rose-900">
                Current Partner Status: Declined
              </div>
              <p className="text-rose-800 text-[11px] mt-0.5">
                <strong>{booking.business_name || booking.provider_name}</strong> was unable to take this shoot slot.
                {booking.rejection_reason && (
                  <span className="italic"> &ldquo;{booking.rejection_reason}&rdquo;</span>
                )}
              </p>
            </div>
            <span className="text-[10px] font-bold text-rose-700 bg-white border border-rose-200 px-2.5 py-1 rounded-full whitespace-nowrap self-start sm:self-auto">
              Vacant Crew Slot
            </span>
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
            All candidates below are <strong>vetted &amp; verified creative partners</strong> with zero calendar conflicts on your specified shoot schedule ({startDateFormatted} → {endDateFormatted}). Swapping updates this crew slot without affecting the rest of your production team.
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {error}
            </div>
          )}

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search candidates by name, skill, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={fetchCandidates}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Candidates List */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Scanning vetted partners available on {startDateFormatted}...
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6">
              <h3 className="text-xs font-bold text-slate-800">No Replacement Candidates Available</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                No verified creative partners matching &ldquo;{booking.crew_role || booking.category_name}&rdquo; are currently free of blackout dates or shoots on these exact dates.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCandidates.map((cand) => {
                const isSwapping = swappingVendorId === cand.vendor_id;
                const skillsArray = typeof cand.skills === 'string'
                  ? cand.skills.split(',').map((s) => s.trim()).filter(Boolean)
                  : [];

                return (
                  <div
                    key={cand.vendor_id}
                    className="p-4 bg-white border border-slate-200 hover:border-blue-300 rounded-xl transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {cand.business_name}
                        </span>
                        {cand.owner_name && (
                          <span className="text-xs text-slate-500">
                            ({cand.owner_name})
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Verified Partner
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        <span>Location: <strong>{cand.location || 'Pan-India'}</strong></span>
                        {cand.experience && (
                          <span>Exp: <strong>{cand.experience} yrs</strong></span>
                        )}
                        {cand.experience_level && (
                          <span className="capitalize">Tier: <strong>{cand.experience_level}</strong></span>
                        )}
                      </div>

                      {skillsArray.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          {skillsArray.slice(0, 4).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                          {skillsArray.length > 4 && (
                            <span className="text-[10px] text-slate-400">
                              +{skillsArray.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pricing & Swap Button */}
                    <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                      <div className="text-right">
                        <div className="font-bold font-mono text-slate-900 text-sm">
                          ₹{Number(cand.calculated_total).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ₹{Number(cand.daily_rate).toLocaleString()}/day &bull; {cand.duration_days}d
                        </div>
                        <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                          Advance: ₹{Number(cand.calculated_advance).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectReplacement(cand)}
                        disabled={isSwapping || Boolean(swappingVendorId)}
                        className="mt-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isSwapping ? 'Swapping...' : 'Swap into Crew'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Found {candidates.length} available replacement candidate(s)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
