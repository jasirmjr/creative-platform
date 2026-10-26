import React from 'react';
import { X, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { BOOKING_STEPS } from './bookingStatus';

const cx = (...classes) => classes.filter(Boolean).join(' ');

// ---------- Buttons ----------
const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  danger: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        BUTTON_VARIANTS[variant],
        className
      )}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}

// ---------- Status badge ----------
const TONES = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

const DOTS = {
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-400',
  red: 'bg-rose-500',
};

export function StatusBadge({ tone = 'slate', children }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone])}>
      <span className={cx('w-1.5 h-1.5 rounded-full', DOTS[tone])} />
      {children}
    </span>
  );
}

// ---------- Progress steps ----------
export function ProgressSteps({ current, failed = false }) {
  return (
    <ol className="flex items-center w-full">
      {BOOKING_STEPS.map((label, i) => {
        const done = !failed && i < current;
        const active = !failed && i === current;
        const failedStep = failed && i === 1;
        return (
          <li key={label} className={cx('flex items-center', i < BOOKING_STEPS.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={cx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  done && 'bg-emerald-500 text-white',
                  active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                  failedStep && 'bg-rose-500 text-white',
                  !done && !active && !failedStep && 'bg-slate-200 text-slate-500'
                )}
              >
                {done ? <Check className="w-3 h-3" /> : failedStep ? <X className="w-3 h-3" /> : i + 1}
              </span>
              <span
                className={cx(
                  'text-[10px] sm:text-[11px] font-medium whitespace-nowrap hidden sm:block',
                  active ? 'text-blue-700' : failedStep ? 'text-rose-600' : done ? 'text-slate-600' : 'text-slate-400'
                )}
              >
                {failedStep ? 'Declined' : label}
              </span>
            </div>
            {i < BOOKING_STEPS.length - 1 && (
              <span className={cx('h-0.5 flex-1 mx-1 sm:mb-4 rounded-full', done ? 'bg-emerald-400' : 'bg-slate-200')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Page header ----------
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ---------- Stat tile ----------
export function StatTile({ label, value, hint, icon: Icon, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'text-left bg-white border border-slate-200 rounded-xl p-4 transition-all',
        onClick && 'hover:border-blue-300 hover:shadow-sm cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </Tag>
  );
}

// ---------- Section card ----------
export function Section({ title, description, action, children, className }) {
  return (
    <section className={cx('bg-white border border-slate-200 rounded-xl', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- Attention list ----------
// items: [{ id, tone, title, detail, actions: [{ label, onClick, variant, disabled }] }]
export function AttentionList({ items, emptyTitle = "You're all caught up", emptyText }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
        <p className="text-sm font-semibold text-slate-800 mt-2">{emptyTitle}</p>
        {emptyText && <p className="text-sm text-slate-500 mt-1">{emptyText}</p>}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className={cx('hidden sm:block w-2 h-2 rounded-full shrink-0', DOTS[item.tone || 'blue'])} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            {item.detail && <p className="text-sm text-slate-500 mt-0.5 truncate">{item.detail}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.actions.map((a) => (
              <Button key={a.label} size="sm" variant={a.variant || 'primary'} onClick={a.onClick} disabled={a.disabled}>
                {a.label}
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Filter tabs ----------
export function FilterTabs({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cx(
            'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
            value === o.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {o.label}
          {o.count > 0 && (
            <span
              className={cx(
                'text-[11px] font-semibold px-1.5 rounded-full',
                o.highlight ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Empty / loading ----------
export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-xl px-6 py-12 text-center">
      {Icon && <Icon className="w-8 h-8 text-slate-300 mx-auto" />}
      <p className="text-sm font-semibold text-slate-800 mt-3">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingCard({ text = 'Loading…' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-sm text-slate-500">
      <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin align-middle mr-2" />
      {text}
    </div>
  );
}

// ---------- Toast ----------
export function Toast({ notification, onClose }) {
  if (!notification) return null;
  const ok = notification.type === 'success';
  return (
    <div
      className={cx(
        'mb-6 px-4 py-3 rounded-xl border text-sm flex items-start gap-3',
        ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
      )}
    >
      {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
      <span className="flex-1">{notification.message}</span>
      <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------- Switch ----------
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300"
    >
      <span className={cx('relative w-9 h-5 rounded-full transition-colors', checked ? 'bg-emerald-500' : 'bg-slate-300')}>
        <span className={cx('absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', checked && 'translate-x-4')} />
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </button>
  );
}

// ---------- Date chip ----------
export function DateChip({ date }) {
  const d = date ? new Date(date) : null;
  return (
    <span className="w-11 shrink-0 rounded-lg border border-slate-200 bg-slate-50 text-center py-1">
      <span className="block text-[10px] font-semibold uppercase text-blue-600 leading-tight">
        {d ? d.toLocaleDateString('en-IN', { month: 'short' }) : '—'}
      </span>
      <span className="block text-base font-bold text-slate-900 leading-tight">{d ? d.getDate() : ''}</span>
    </span>
  );
}

// ---------- Avatar ----------
export function Avatar({ name, image, size = 'md', className }) {
  const dims = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <span className={cx('rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center shrink-0 overflow-hidden', dims, className)}>
      {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : (name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

// ---------- Dashboard shell (sidebar + content) ----------
// sections: [{ title, items: [{ key, label, icon, badge, badgeTone, onClick }] }]
export function DashboardShell({ sections, activeKey, onSelect, profile, children }) {
  const allItems = sections.flatMap((s) => s.items);
  const handle = (item) => (item.onClick ? item.onClick() : onSelect(item.key));

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 shrink-0 flex-col sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <nav className="flex-1 p-3 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = !item.onClick && item.key === activeKey;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handle(item)}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                        active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <Icon className={cx('w-[18px] h-[18px] shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.badge > 0 && (
                        <span
                          className={cx(
                            'min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center',
                            item.badgeTone === 'red' ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {profile && (
          <div className="m-3 p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <Avatar name={profile.name} image={profile.image} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
              <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                {profile.statusTone && <span className={cx('w-1.5 h-1.5 rounded-full', DOTS[profile.statusTone])} />}
                {profile.subtitle}
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile nav */}
      <nav className="md:hidden sticky top-16 z-30 bg-white border-b border-slate-200 px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {allItems.map((item) => {
          const active = !item.onClick && item.key === activeKey;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handle(item)}
              className={cx(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer',
                active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.badge > 0 && (
                <span className={cx('text-[11px] font-semibold px-1.5 rounded-full', active ? 'bg-white/25' : 'bg-blue-600 text-white')}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 min-w-0 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
