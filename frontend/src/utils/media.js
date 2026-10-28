// Uploads used to be stored as absolute dev-server URLs (http://127.0.0.1:5000/uploads/...),
// which only load on the machine that uploaded them. Serve them relative so the
// /uploads rewrite works locally and on Vercel.
const LOCAL_UPLOAD_ORIGIN = /^https?:\/\/(?:127\.0\.0\.1|localhost):5000(?=\/uploads\/)/i;

export const resolveMediaUrl = (url) => (url ? url.replace(LOCAL_UPLOAD_ORIGIN, '') : url);

// Hide an image that fails to load so the fallback behind it (initials, colour) shows instead
export const hideBrokenImage = (e) => {
  e.currentTarget.style.display = 'none';
};
