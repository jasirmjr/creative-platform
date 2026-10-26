// Shared booking status helpers for the vendor and client dashboards.

export const REQUEST_STATUSES = ['new_request', 'under_review', 'availability_check'];
export const PAYABLE_STATUSES = ['approved', 'payment_pending'];
export const DECLINED_STATUSES = ['rejected', 'cancelled'];

export const isRequest = (status) => REQUEST_STATUSES.includes(status);
export const isPayable = (status) => PAYABLE_STATUSES.includes(status);
export const isDeclined = (status) => DECLINED_STATUSES.includes(status);
export const isActiveShoot = (status) => status === 'confirmed' || status === 'in_progress';
export const hasDeliverablesAccess = (status) =>
  status === 'confirmed' || status === 'in_progress' || status === 'deliverables_submitted' || status === 'completed';

export const BOOKING_STEPS = ['Requested', 'Accepted', 'Advance paid', 'Shoot', 'Delivered', 'Completed'];

// Index of the step currently in progress (BOOKING_STEPS.length when everything is done).
export const getStepIndex = (status) => {
  if (isRequest(status) || isDeclined(status)) return 1;
  if (isPayable(status)) return 2;
  if (isActiveShoot(status)) return 3;
  if (status === 'deliverables_submitted') return 5;
  if (status === 'completed') return BOOKING_STEPS.length;
  return 1;
};

const VENDOR_LABELS = {
  request: { label: 'New request', tone: 'amber' },
  approved: { label: 'Waiting for advance', tone: 'blue' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  in_progress: { label: 'In progress', tone: 'green' },
  deliverables_submitted: { label: 'Delivered', tone: 'violet' },
  completed: { label: 'Completed', tone: 'slate' },
  rejected: { label: 'Declined', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

const CLIENT_LABELS = {
  request: { label: 'Waiting for partner', tone: 'amber' },
  approved: { label: 'Accepted · pay advance', tone: 'blue' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  in_progress: { label: 'In progress', tone: 'green' },
  deliverables_submitted: { label: 'Files ready to review', tone: 'violet' },
  completed: { label: 'Completed', tone: 'slate' },
  rejected: { label: 'Declined by partner', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export const getStatusMeta = (status, role = 'vendor') => {
  const labels = role === 'client' ? CLIENT_LABELS : VENDOR_LABELS;
  if (isRequest(status)) return labels.request;
  if (isPayable(status)) return labels.approved;
  return labels[status] || labels.request;
};

export const getAmounts = (b) => {
  const total = Number(b.total_amount || 0);
  const paid = Number(b.paid_amount || 0);
  const advance = Number(b.advance_amount) || Math.round(total * 0.3);
  return { total, paid, advance, balance: Math.max(0, total - paid) };
};

export const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const formatDate = (d, withYear = true) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        ...(withYear ? { year: 'numeric' } : {}),
      })
    : '—';

export const formatDateRange = (start, end) => {
  if (!start) return 'Dates to be confirmed';
  if (!end || new Date(start).toDateString() === new Date(end).toDateString()) return formatDate(start);
  return `${formatDate(start, false)} – ${formatDate(end)}`;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isUpcoming = (b) => b.start_date && new Date(b.end_date || b.start_date) >= startOfToday();
export const isPastShoot = (b) => b.end_date && new Date(b.end_date) < startOfToday();

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
