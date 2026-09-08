import React, { useState, useEffect } from 'react';
import PortfolioMediaViewer from './PortfolioMediaViewer';

export default function ProfessionalDetailModal({
  professional,
  isOpen,
  onClose,
  onRequestBooking,
  onOpenChat,
}) {
  const [portfolio, setPortfolio] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(5.0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [blockedRanges, setBlockedRanges] = useState([]);

  useEffect(() => {
    if (!isOpen || !professional) return;

    const vendorId = professional.vendor_id || professional.id;
    if (!vendorId) return;

    async function loadPortfolio() {
      setLoadingPortfolio(true);
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/portfolios/vendor/${vendorId}`);
        const data = await res.json();
        if (data.success) {
          setPortfolio(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load portfolio works:', err);
      } finally {
        setLoadingPortfolio(false);
      }
    }

    async function loadReviews() {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/reviews/vendor/${vendorId}`);
        const data = await res.json();
        if (data.success) {
          setReviews(data.data || []);
          setAvgRating(data.average_rating || 5.0);
          setTotalReviews(data.total_reviews || 0);
        }
      } catch (err) {
        console.error('Failed to load reviews:', err);
      }
    }

    async function loadAvailability() {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/schedule/vendor/${vendorId}`);
        const data = await res.json();
        if (data.success) {
          setBlockedRanges(data.all_blocked_ranges || []);
        }
      } catch (err) {
        console.error('Failed to load vendor availability:', err);
      }
    }

    loadPortfolio();
    loadReviews();
    loadAvailability();
  }, [isOpen, professional]);

  if (!isOpen || !professional) return null;

  const availability = professional.availability_status || 'available';
  const availabilityColors = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending_booking: 'bg-amber-50 text-amber-700 border-amber-200',
    booked: 'bg-rose-50 text-rose-700 border-rose-200',
    unavailable: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const skills = professional.skills
    ? professional.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Commercial Production', 'High-Speed Lighting', 'Cinematic Vision'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-xl relative my-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Header Profile Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-md flex-shrink-0">
            {(professional.business_name || professional.title || 'C')[0]}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                {professional.category_name || professional.resource_type === 'gear' ? 'Gear Listing' : 'Creative Talent'}
              </span>

              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${availabilityColors[availability] || availabilityColors.available}`}>
                ● {availability.replace('_', ' ')}
              </span>

              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                Verified
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              {professional.business_name || professional.title}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              <span>👤 Lead: {professional.owner_name || professional.provider_name || 'Creative Specialist'}</span>
              <span>📍 {professional.location || 'India'}</span>
              {professional.experience && <span>⏳ {professional.experience}</span>}
            </div>
          </div>

          {/* Pricing Box */}
          <div className="text-left sm:text-right bg-slate-50 p-3 rounded-xl border border-slate-100 self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Base Pricing</span>
            <span className="text-base font-bold text-slate-900 font-mono">
              ₹{Number(professional.base_price || professional.pricing || 15000).toLocaleString()}
              <span className="text-xs font-normal text-slate-500">/{professional.pricing_unit || 'day'}</span>
            </span>
          </div>
        </div>

        {/* Bio / Description */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">About & Professional Bio</h3>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 p-4 rounded-xl">
            {professional.description || professional.bio || 'Verified creative professional providing premium production services, cinematographic capture, and specialized equipment packages.'}
          </p>
        </div>

        {/* Skills & Experience Tags */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Skills & Specializations</h3>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg shadow-2xs"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Availability & Blackout Dates Alert */}
        <div className="mb-6 p-4 rounded-xl border transition-all bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>📅 Calendar & Working Availability</span>
            </h3>
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                blockedRanges.length > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {blockedRanges.length > 0 ? `${blockedRanges.length} Reserved Period(s)` : '✓ Open for Booking'}
            </span>
          </div>

          {blockedRanges.length === 0 ? (
            <p className="text-xs text-emerald-800 font-medium">
              This provider has no active blackout dates and is currently accepting bookings on all open days.
            </p>
          ) : (
            <div>
              <p className="text-xs text-slate-600 mb-2">
                This provider cannot accept bookings during the following reserved / off-duty periods:
              </p>
              <div className="flex flex-wrap gap-2">
                {blockedRanges.map((b, idx) => (
                  <span
                    key={idx}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${
                      b.type === 'booking'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span>{b.type === 'booking' ? '🔴' : '🟠'}</span>
                    <strong>{b.reason || 'Off-Duty'}:</strong>
                    <span>
                      {new Date(b.start_date).toLocaleDateString()} &rarr; {new Date(b.end_date).toLocaleDateString()}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Gallery Works */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Portfolio & Creative Showcase ({portfolio.length})
            </h3>
            <span className="text-[11px] text-slate-400">Verified Work Samples</span>
          </div>

          {loadingPortfolio ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl">
              Loading portfolio works...
            </div>
          ) : portfolio.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              No public portfolio works uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {portfolio.map((work) => {
                const isExternal =
                  work.media_url &&
                  !work.media_url.startsWith('/uploads') &&
                  !work.media_url.includes('127.0.0.1:5000/uploads') &&
                  !work.media_url.includes('localhost:5000/uploads');
                const isInstagram = work.media_url && /(?:instagram\.com|instagr\.am)/i.test(work.media_url);
                const isYouTube = work.media_url && /(?:youtube\.com|youtu\.be)/i.test(work.media_url);

                return (
                  <div
                    key={work.id}
                    onClick={() => {
                      if (isExternal) {
                        window.open(work.media_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className={`bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs group ${
                      isExternal ? 'cursor-pointer hover:border-slate-300 transition-colors' : ''
                    }`}
                  >
                    <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                      <PortfolioMediaViewer
                        mediaUrl={work.media_url}
                        thumbnailUrl={work.thumbnail_url}
                        mediaType={work.media_type}
                        title={work.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 right-2 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-xs pointer-events-none z-10">
                        {work.media_type === 'document' ? 'PDF' : work.media_type === 'video' ? 'Video' : 'Photo'}
                      </span>
                    </div>
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{work.title}</h4>
                        {work.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{work.description}</p>
                        )}
                      </div>
                      {isExternal && (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                          {isInstagram ? 'Reel ↗' : isYouTube ? 'Video ↗' : 'Open ↗'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Client Reviews & Ratings Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>⭐ Client Reviews & Ratings</span>
              <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                ★ {avgRating} ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">Verified Client Feedback</span>
          </div>

          {reviews.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              No client reviews yet. Book this partner to be the first to leave a verified review!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 font-semibold">{rev.customer_name}</strong>
                      {rev.project_name && (
                        <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.2 rounded-md">
                          {rev.project_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                      <span>{'★'.repeat(rev.rating)}</span>
                      <span className="text-slate-500 text-[10px] font-normal">
                        ({rev.rating}/5)
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-700 text-xs italic leading-relaxed mt-1">
                    &ldquo;{rev.comment}&rdquo;
                  </p>

                  <span className="text-[10px] text-slate-400 block mt-1.5">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>

          {onOpenChat && (
            <button
              onClick={() => {
                onClose();
                onOpenChat({ vendorId: professional.vendor_id || professional.id });
              }}
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>💬</span>
              <span>Message Studio</span>
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onRequestBooking(professional);
            }}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Book Now</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
