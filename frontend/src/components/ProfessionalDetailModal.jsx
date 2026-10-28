import React, { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import PortfolioMediaViewer from './PortfolioMediaViewer';
import { resolveMediaUrl, hideBrokenImage } from '../utils/media';

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

  // Lock both body and html scroll so there is strictly ONE single scrollbar
  useEffect(() => {
    if (isOpen) {
      const prevBody = document.body.style.overflow;
      const prevHtml = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBody || '';
        document.documentElement.style.overflow = prevHtml || '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !professional) return;

    const vendorId = professional.vendor_id || professional.id;
    if (!vendorId) return;

    async function loadPortfolio() {
      setLoadingPortfolio(true);
      try {
        const res = await fetch(`/api/v1/portfolios/vendor/${vendorId}`);
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
        const res = await fetch(`/api/v1/reviews/vendor/${vendorId}`);
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
        const res = await fetch(`/api/v1/schedule/vendor/${vendorId}`);
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

  const skills = professional.skills
    ? professional.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Commercial Production', 'High-Speed Lighting', 'Cinematic Vision'];

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto w-full min-h-screen text-slate-900 flex flex-col">
      {/* Top Header Bar - Natural Document Flow (Never Overlaps Content on Scroll) */}
      <header className="w-full border-b border-slate-200 bg-white px-4 sm:px-8 lg:px-16 h-16 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        <div className="flex items-center gap-3">
          {onOpenChat && (
            <button
              onClick={() => {
                onClose();
                onOpenChat({ vendorId: professional.vendor_id || professional.id });
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Message Studio
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onRequestBooking(professional);
            }}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs hover:shadow-blue-500/25 cursor-pointer"
          >
            Book Hold
          </button>

          {/* Close button with Icon in Top Right Corner */}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer ml-1"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Profile Header Details - Clean, Attractive, Fully Visible */}
      <div className="w-full bg-slate-50 border-b border-slate-200 px-4 sm:px-8 lg:px-16 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-extrabold text-4xl flex items-center justify-center shadow-md shrink-0 overflow-hidden">
              {professional.profile_image ? (
                <img src={resolveMediaUrl(professional.profile_image)} onError={hideBrokenImage} alt="" className="w-full h-full object-cover" />
              ) : (
                (professional.business_name || professional.title || 'C')[0]
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                  {professional.category_name || professional.resource_type === 'gear' ? 'Gear Listing' : 'Creative Talent'}
                </span>

                <span
                  className={`text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border ${
                    availability === 'available'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {availability.replace('_', ' ')}
                </span>

                <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Verified Partner
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {professional.business_name || professional.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-2 font-medium">
                <span>Lead: {professional.owner_name || professional.provider_name || 'Creative Specialist'}</span>
                <span>•</span>
                <span>{professional.location || 'India'}</span>
                {professional.experience && (
                  <>
                    <span>•</span>
                    <span>{professional.experience} Experience</span>
                  </>
                )}
                <span>•</span>
                <span className="font-semibold text-slate-800">Rating {avgRating} ({totalReviews} reviews)</span>
              </div>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs shrink-0 text-left md:text-right flex md:flex-col justify-between items-center md:items-end">
            <span className="text-xs text-slate-400 uppercase font-semibold block">Standard Rate</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-1">
              ₹{Number(professional.base_price || professional.pricing || 15000).toLocaleString()}
              <span className="text-sm font-normal text-slate-500">/{professional.pricing_unit || 'day'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="w-full px-4 sm:px-8 lg:px-16 py-10 space-y-10 flex-1">
        {/* About & Bio */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">About & Professional Bio</h2>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed max-w-4xl font-normal">
            {professional.description || professional.bio || 'Verified creative professional providing premium production services, cinematographic capture, and specialized equipment packages.'}
          </p>
        </div>

        {/* Skills & Specializations */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Skills & Specializations</h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200/60"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Calendar & Working Availability */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calendar & Working Availability</h2>
            <span
              className={`text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full border ${
                blockedRanges.length > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {blockedRanges.length > 0 ? `${blockedRanges.length} Reserved Period(s)` : 'Open for Booking'}
            </span>
          </div>

          {blockedRanges.length === 0 ? (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
              This provider has no active blackout dates and is currently accepting bookings on all open days.
            </p>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-600 mb-3">
                This provider cannot accept bookings during the following reserved or off-duty periods:
              </p>
              <div className="flex flex-wrap gap-2">
                {blockedRanges.map((b, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
                      b.type === 'booking'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <strong>{b.reason || 'Off-Duty'}: </strong>
                    <span>
                      {new Date(b.start_date).toLocaleDateString()} to {new Date(b.end_date).toLocaleDateString()}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Portfolio & Creative Showcase */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Portfolio & Creative Showcase ({portfolio.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Verified Work Samples & Media</p>
            </div>
          </div>

          {loadingPortfolio ? (
            <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl">
              Loading portfolio works...
            </div>
          ) : portfolio.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              No public portfolio works uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                    className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-lg hover:border-blue-300 transition-all group flex flex-col justify-between ${
                      isExternal ? 'cursor-pointer' : ''
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
                      <span className="absolute top-2.5 right-2.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-xs pointer-events-none z-10">
                        {work.media_type === 'document' ? 'PDF' : work.media_type === 'video' ? 'Video' : 'Photo'}
                      </span>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {work.title}
                        </h4>
                        {work.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{work.description}</p>
                        )}
                      </div>

                      {isExternal && (
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md shrink-0">
                          {isInstagram ? 'Reel' : isYouTube ? 'Video' : 'External'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Partition Line between Posts and Reviews */}
        <div className="relative py-8 my-4">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-6 text-xs uppercase tracking-widest font-bold text-slate-400 border border-slate-200 rounded-full py-1.5 shadow-2xs">
              Client Reviews & Feedback
            </span>
          </div>
        </div>

        {/* Client Reviews & Ratings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Client Reviews & Ratings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Verified Client Feedback ({totalReviews})</p>
            </div>

            <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
              Average Rating {avgRating} / 5.0
            </span>
          </div>

          {reviews.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              No client reviews yet. Book this partner to be the first to leave a verified review.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <strong className="text-sm text-slate-900 font-semibold">{rev.customer_name}</strong>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        Rating {rev.rating} / 5
                      </span>
                    </div>

                    {rev.project_name && (
                      <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md inline-block mb-3">
                        Project: {rev.project_name}
                      </span>
                    )}

                    <p className="text-slate-600 text-xs leading-relaxed italic">
                      "{rev.comment}"
                    </p>
                  </div>

                  <span className="text-[10px] text-slate-400 block mt-4 pt-3 border-t border-slate-100">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
