import { ReactNode } from 'react';

interface PageBannerProps {
  /** Page title shown in large text */
  title: string;
  /** Short description shown below the title */
  subtitle: string;
  /** Icon rendered inside the coloured pill on the left */
  icon: ReactNode;
  /** Optional element rendered on the right side (e.g. a Button) */
  action?: ReactNode;
}

/**
 * Consistent gradient page banner used at the top of every main page.
 * Matches the Dashboard welcome banner design.
 */
export default function PageBanner({ title, subtitle, icon, action }: PageBannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl text-white px-5 sm:px-6 py-5 sm:py-6 mb-5"
      style={{ background: 'linear-gradient(135deg, #0a1a2e 0%, #1f4e88 60%, #3582e2 100%)' }}
    >
      {/* Decorative circles — same as Dashboard */}
      <div
        className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: '#93c5fd', opacity: 0.10 }}
      />
      <div
        className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: '#93c5fd', opacity: 0.06 }}
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left — icon + title + subtitle */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex-shrink-0 p-2.5 rounded-xl border border-white/15"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)' }}
          >
            {icon}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight">
              {title}
            </h1>
            <p className="text-white/55 text-sm mt-0.5 leading-snug">{subtitle}</p>
          </div>
        </div>

        {/* Right — optional action */}
        {action && (
          <div className="flex-shrink-0 self-start sm:self-auto">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
