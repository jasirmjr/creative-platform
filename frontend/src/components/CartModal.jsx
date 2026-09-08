import React, { useState, useEffect } from 'react';
import InteractiveCalendarPicker from './InteractiveCalendarPicker';

export default function CartModal({
  isOpen,
  onClose,
  cart,
  onRemoveFromCart,
  onUpdateCartItem,
  onClearCart,
  onCheckoutSuccess,
  onOpenAuth,
  user,
  token: propToken,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [vendorAvailability, setVendorAvailability] = useState({});
  const [expandedCalendarId, setExpandedCalendarId] = useState(null);

  // Multi-Talent Crew Bundle: Master Project Brief States
  const [masterProjectName, setMasterProjectName] = useState('Commercial Production Shoot');
  const [masterLocation, setMasterLocation] = useState('Film Studio / On-Location');
  const [masterStartDate, setMasterStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [masterEndDate, setMasterEndDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [syncFeedback, setSyncFeedback] = useState(null);

  const token = propToken || sessionStorage.getItem('token');
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-expand calendar for single item or first item if not expanded
  useEffect(() => {
    if (cart.length === 1 && expandedCalendarId === null) {
      setExpandedCalendarId(cart[0].cart_id !== undefined ? cart[0].cart_id : 0);
    }
  }, [cart]);

  // Fetch blocked / booked date ranges for each vendor in cart
  useEffect(() => {
    if (!isOpen || cart.length === 0) return;

    const vendorIds = [...new Set(cart.map((item) => item.vendor_id || item.id).filter(Boolean))];

    vendorIds.forEach(async (vId) => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/schedule/vendor/${vId}`);
        const data = await res.json();
        if (data.success) {
          setVendorAvailability((prev) => ({
            ...prev,
            [vId]: data.all_blocked_ranges || [],
          }));
        }
      } catch (e) {
        console.error('Failed to load vendor availability in cart:', e);
      }
    });
  }, [isOpen, cart]);

  // Synchronize dates across all crew members with 1 click
  const handleSyncAllDates = () => {
    if (!masterStartDate) return;
    const effectiveEnd = masterEndDate || masterStartDate;
    cart.forEach((item, idx) => {
      const itemId = item.cart_id !== undefined ? item.cart_id : idx;
      onUpdateCartItem?.(itemId, {
        start_date: masterStartDate,
        end_date: effectiveEnd,
        project_name: masterProjectName,
        location: masterLocation,
      });
    });
    setSyncFeedback(`Dates synchronized across all ${cart.length} crew members!`);
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  // Helper to check if a cart item has conflicting dates
  const getItemConflict = (item) => {
    const vId = item.vendor_id || item.id;
    const blockedRanges = vendorAvailability[vId] || [];
    if (blockedRanges.length === 0) return null;

    const itemStart = item.start_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const itemEnd = item.end_date || item.start_date || itemStart;

    for (const b of blockedRanges) {
      const bStart = b.start_date.split('T')[0];
      const bEnd = b.end_date.split('T')[0];

      // Overlap condition
      if (!(itemEnd < bStart || itemStart > bEnd)) {
        return b;
      }
    }
    return null;
  };

  const hasAnyConflict = cart.some((item) => getItemConflict(item) !== null);

  if (!isOpen) return null;

  // Calculate total across all cart items
  const totalAmount = cart.reduce((sum, item) => {
    const start = new Date(item.start_date || Date.now() + 86400000);
    const end = new Date(item.end_date || item.start_date || start);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1);
    const price = Number(item.base_price || item.pricing || 15000);
    return sum + price * days;
  }, 0);

  const handleCheckout = async () => {
    if (!token) {
      setError('Please sign in with your registered account to submit your production hold.');
      onOpenAuth?.();
      return;
    }

    if (cart.length === 0) return;

    setError('');
    setSubmitting(true);

    try {
      // Prepare payload with crew roles and master project details
      const itemsPayload = cart.map((item) => {
        const start = item.start_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const end = item.end_date || item.start_date || start;
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const days = Math.max(1, Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) || 1);
        const price = Number(item.base_price || item.pricing || 15000);
        const crewRole = item.crew_role || item.skills || item.category_name || (item.category ? item.category.name : null) || 'Creative Specialist';

        return {
          vendor_id: item.vendor_id || item.id,
          resource_id: item.resource_id || null,
          project_name: masterProjectName.trim() || item.project_name || `${item.business_name || item.title || 'Creative'} Production`,
          project_description: item.project_description || item.notes || null,
          start_date: start,
          end_date: end,
          location: masterLocation.trim() || item.location || 'India',
          duration: `${days} Day(s)`,
          estimated_budget: price * days,
          additional_requirements: item.additional_requirements || null,
          crew_role: crewRole,
        };
      });

      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/checkout-cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: itemsPayload,
          master_project_name: masterProjectName.trim(),
          master_location: masterLocation.trim(),
          master_notes: '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      onClearCart();
      onClose();
      onCheckoutSuccess?.(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-xl relative my-8 max-h-[90vh] overflow-y-auto flex flex-col justify-between"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 tracking-wider">
              {cart.length >= 2 ? 'Production Crew Assembly' : 'Production Hold Cart'}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {cart.length} {cart.length === 1 ? 'talent' : 'crew members'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {cart.length >= 2 ? 'Assemble Your Multi-Talent Crew' : 'Your Production Booking Cart'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {cart.length >= 2
              ? 'Coordinate unified shoot dates and locations across all assembled creative specialists in one project booking.'
              : 'Review your requested creative talent before submitting for direct booking confirmation.'}
          </p>
        </div>

        {error && (
          <div className="my-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* MULTI-TALENT CREW BRIEF & DATE SYNCHRONIZER */}
        {cart.length > 0 && (
          <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Production Brief & Schedule Synchronizer
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                Synchronize all crew members in 1 click
              </span>
            </div>

            {/* Unified Project Title & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Unified Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Ad Shoot, Brand Campaign..."
                  value={masterProjectName}
                  onChange={(e) => setMasterProjectName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Shoot Location / Studio
                </label>
                <input
                  type="text"
                  placeholder="e.g. Studio 4, Film City, Indiranagar..."
                  value={masterLocation}
                  onChange={(e) => setMasterLocation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Master Date Synchronizer */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-800">
                  Master Shoot Schedule
                </span>

                {syncFeedback && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {syncFeedback}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div>
                  <span className="block text-[10px] text-slate-500 font-medium mb-0.5">Start Date</span>
                  <input
                    type="date"
                    min={todayStr}
                    value={masterStartDate}
                    onChange={(e) => setMasterStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 font-medium mb-0.5">End Date</span>
                  <input
                    type="date"
                    min={masterStartDate || todayStr}
                    value={masterEndDate}
                    onChange={(e) => setMasterEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="sm:pt-4">
                  <button
                    type="button"
                    onClick={handleSyncAllDates}
                    className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    Sync to Entire Crew
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                Clicking sync updates all {cart.length} crew members to these dates. Individual post-production or prep dates can still be adjusted per member below.
              </p>
            </div>
          </div>
        )}

        {/* Cart Items List */}
        <div className="my-3 space-y-4 max-h-[42vh] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <span className="text-3xl block mb-2">🛒</span>
              <p className="text-sm font-semibold text-slate-700">Your Crew Cart is Empty</p>
              <p className="text-xs text-slate-400 mt-1">
                Browse our approved talent and studios to assemble your production crew.
              </p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const defaultStart = item.start_date || masterStartDate || todayStr;
              const defaultEnd = item.end_date || masterEndDate || defaultStart;
              const start = new Date(defaultStart);
              const end = new Date(defaultEnd);
              const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
              const price = Number(item.base_price || item.pricing || 15000);
              const itemTotal = price * days;
              const vId = item.vendor_id || item.id;
              const blockedRanges = vendorAvailability[vId] || [];
              const conflict = getItemConflict(item);
              const crewRole = item.crew_role || item.skills || item.category_name || (item.category ? item.category.name : null) || 'Creative Specialist';

              return (
                <div
                  key={item.cart_id || idx}
                  className={`p-4 rounded-xl flex flex-col gap-3 shadow-2xs border transition-all ${
                    conflict ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          {item.business_name || item.title}
                        </h4>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Role: {crewRole}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lead: {item.owner_name || item.provider_name || 'Creative Pro'} &bull; {item.location || 'India'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        ₹{itemTotal.toLocaleString()}
                      </span>
                      <span className="block text-[11px] text-slate-400 font-mono">
                        (₹{price.toLocaleString()}/{item.pricing_unit || 'day'} &times; {days}d)
                      </span>
                    </div>
                  </div>

                  {/* Conflict Alert Banner */}
                  {conflict && (
                    <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-fadeIn">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-200 border border-amber-400">
                        [SCHEDULE CONFLICT]
                      </span>
                      <div>
                        <strong className="font-bold block">Provider Unavailable on Selected Dates:</strong>
                        <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                          {item.business_name || item.title} is{' '}
                          {conflict.type === 'booking'
                            ? 'already booked for another production'
                            : `marked off-duty (${conflict.reason || 'Unavailable'})`}{' '}
                          from <strong>{new Date(conflict.start_date).toLocaleDateString()}</strong> to{' '}
                          <strong>{new Date(conflict.end_date).toLocaleDateString()}</strong>.
                        </p>
                        <p className="text-[11px] text-amber-900 mt-1 font-semibold">
                          &rarr; Please pick different shoot dates for this crew member to proceed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Schedule Details & Individual Calendar Toggle */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Assigned Shoot Schedule
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {days} production day(s) assigned
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCalendarId(
                          expandedCalendarId === (item.cart_id !== undefined ? item.cart_id : idx)
                            ? null
                            : (item.cart_id !== undefined ? item.cart_id : idx)
                        )
                      }
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {expandedCalendarId === (item.cart_id !== undefined ? item.cart_id : idx)
                        ? 'Minimize Calendar'
                        : 'View / Adjust Calendar'}
                    </button>
                  </div>

                  {/* Visual Calendar */}
                  {expandedCalendarId === (item.cart_id !== undefined ? item.cart_id : idx) && (
                    <div className="mt-1 animate-fadeIn">
                      <InteractiveCalendarPicker
                        startDate={defaultStart}
                        endDate={defaultEnd}
                        blockedRanges={blockedRanges}
                        minDate={todayStr}
                        onChange={({ start_date, end_date }) => {
                          onUpdateCartItem?.(item.cart_id !== undefined ? item.cart_id : idx, {
                            start_date,
                            end_date: end_date || start_date,
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Staggered Date Override Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Individual Start Date
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={defaultStart}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          onUpdateCartItem?.(item.cart_id !== undefined ? item.cart_id : idx, {
                            start_date: newStart,
                            end_date: newStart,
                          });
                        }}
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all ${
                          conflict
                            ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                            : 'border-slate-300 focus:border-blue-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Individual End Date
                      </label>
                      <input
                        type="date"
                        min={defaultStart || todayStr}
                        value={defaultEnd}
                        onChange={(e) =>
                          onUpdateCartItem?.(item.cart_id !== undefined ? item.cart_id : idx, { end_date: e.target.value })
                        }
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all ${
                          conflict
                            ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                            : 'border-slate-300 focus:border-blue-600'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Item Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Duration: <strong>{days} Day(s)</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart?.(item.cart_id || idx)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
                    >
                      Remove from Crew
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer & Checkout Summary */}
        <div className="pt-4 border-t border-slate-200">
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed mb-4">
            ✓ <strong>Unified Crew Booking:</strong> All {cart.length} creative specialists will be scheduled under project <strong>&ldquo;{masterProjectName}&rdquo;</strong>. Confirmed immediately in your workspace and vendor dashboards.
          </div>

          {!token && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between mb-4">
              <span>Account required to complete booking.</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Sign In / Join
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-slate-500 block">Total Crew Production Cost</span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer underline"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Add More Crew Members
            </button>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0 || hasAnyConflict}
              className={`flex-1 py-2.5 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                hasAnyConflict
                  ? 'bg-amber-600 hover:bg-amber-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>
                {hasAnyConflict
                  ? 'Resolve Schedule Conflicts to Book'
                  : submitting
                  ? 'Confirming Crew Production...'
                  : `Confirm & Book Crew (${cart.length})`}
              </span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
