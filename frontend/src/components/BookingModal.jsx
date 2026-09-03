import React, { useState, useEffect } from 'react';
import InteractiveCalendarPicker from './InteractiveCalendarPicker';

export default function BookingModal({ item, isOpen, onClose, onSuccess, token, onOpenAuth }) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [blockedRanges, setBlockedRanges] = useState([]);
  const [showCalendar, setShowCalendar] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen || !item) return;

    const vendorId = item.vendor_id || item.id;
    if (!vendorId) return;

    async function loadAvailability() {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/schedule/vendor/${vendorId}`);
        const data = await res.json();
        if (data.success) {
          setBlockedRanges(data.all_blocked_ranges || []);
        }
      } catch (err) {
        console.error('Failed to load availability in BookingModal:', err);
      }
    }

    loadAvailability();
  }, [isOpen, item]);

  // Check if chosen dates conflict
  const dateConflict = (() => {
    if (!startDate || !endDate || blockedRanges.length === 0) return null;
    const startStr = startDate;
    const endStr = endDate;

    for (const b of blockedRanges) {
      const bStart = b.start_date.split('T')[0];
      const bEnd = b.end_date.split('T')[0];
      if (!(endStr <= bStart || startStr >= bEnd)) {
        return b;
      }
    }
    return null;
  })();

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      onOpenAuth?.();
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resource_id: item.id,
          project_name: projectName || `${item.title} Project`,
          project_description: description,
          start_date: startDate,
          end_date: endDate,
          location,
          duration: duration || 'Custom Schedule',
          estimated_budget: estimatedBudget ? Number(estimatedBudget) : Number(item.base_price || 0),
          additional_requirements: additionalRequirements,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit requirement');

      onSuccess(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 sm:p-8 shadow-xl relative my-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-6">
          <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Managed Marketplace Booking
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            Submit Project Requirement
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Section 11 Requirement Form &bull; Booking with{' '}
            <strong className="text-slate-800">{item.business_name || item.provider_name || item.title}</strong>
          </p>
        </div>

        {/* Selected Talent / Gear Summary Pill */}
        <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-900 block">{item.title}</span>
            <span className="text-[11px] text-slate-500">{item.category_name || 'Creative Discipline'} &bull; {item.location || 'India'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Base Rate</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              ₹{Number(item.base_price || 0).toLocaleString()}
              <span className="text-xs font-normal text-slate-500">/{item.pricing_unit || 'day'}</span>
            </span>
          </div>
        </div>

        {/* Managed Marketplace Notice */}
        <div className="mb-5 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 leading-relaxed">
          📋 <strong>Managed Review Process:</strong> After you submit, our platform operations team will verify the provider's availability calendar, confirm commercial terms, and generate your payment link.
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Red Bull Commercial Ad Shoot or Wedding Film Reel"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          {/* Date Conflict Alert Banner */}
          {dateConflict && (
            <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-fadeIn">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <strong className="font-bold block">Provider Unavailable on Selected Dates:</strong>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  The provider is{' '}
                  {dateConflict.type === 'booking'
                    ? 'already booked for another project'
                    : `marked off-duty (${dateConflict.reason || 'Unavailable'})`}{' '}
                  from <strong>{new Date(dateConflict.start_date).toLocaleDateString()}</strong> to{' '}
                  <strong>{new Date(dateConflict.end_date).toLocaleDateString()}</strong>.
                </p>
                <p className="text-[11px] text-amber-900 mt-1 font-semibold">
                  &rarr; Please select different shoot dates to proceed.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Calendar Toggle Header */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>📅</span>
              <span>Select Shoot Dates from Calendar</span>
            </span>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <span>📅</span>
              <span>{showCalendar ? 'Minimize Calendar' : 'Expand Calendar'}</span>
            </button>
          </div>

          {/* VISUAL INTERACTIVE CALENDAR */}
          {showCalendar && (
            <div className="animate-fadeIn">
              <InteractiveCalendarPicker
                startDate={startDate}
                endDate={endDate}
                blockedRanges={blockedRanges}
                minDate={todayStr}
                onChange={({ start_date, end_date }) => {
                  setStartDate(start_date);
                  setEndDate(end_date || start_date);
                }}
              />
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Required Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                }}
                className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none transition-all ${
                  dateConflict
                    ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 focus:border-blue-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Required End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={startDate || todayStr}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none transition-all ${
                  dateConflict
                    ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 focus:border-blue-600'
                }`}
              />
            </div>
          </div>

          {/* Location & Expected Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Shoot Location <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Film City Studio 4, Mumbai"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Duration
              </label>
              <input
                type="text"
                placeholder="e.g. 2 Days (8 Hours/day)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {/* Estimated Budget */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Estimated Total Budget (INR)
            </label>
            <input
              type="number"
              placeholder={`Base: ₹${Number(item.base_price || 0).toLocaleString()}`}
              value={estimatedBudget}
              onChange={(e) => setEstimatedBudget(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all font-mono"
            />
          </div>

          {/* Project Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Project Description & Scope
            </label>
            <textarea
              rows="3"
              placeholder="Provide context regarding the project narrative, brand guidelines, or specific scenes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          {/* Additional Requirements */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Requirements / Gear Needs / Reference Links
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Need backup camera body, wireless audio kit, Dropbox storyboard link..."
              value={additionalRequirements}
              onChange={(e) => setAdditionalRequirements(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || Boolean(dateConflict)}
            className={`w-full py-3 text-white text-xs font-semibold rounded-xl transition-all shadow-sm mt-2 flex items-center justify-center gap-1.5 ${
              dateConflict
                ? 'bg-amber-600 hover:bg-amber-700 cursor-not-allowed opacity-90'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50'
            }`}
          >
            {dateConflict
              ? '⚠️ Resolve Date Conflict Before Submitting'
              : submitting
              ? 'Submitting Requirement...'
              : 'Submit Requirement for Admin Review'}
          </button>
        </form>
      </div>
    </div>
  );
}