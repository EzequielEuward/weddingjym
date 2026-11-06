import type { ModuleAvailability } from '@wedding/shared';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BentoModuleCardProps {
  availability: ModuleAvailability;
  to: string;
  eyebrow?: string;
  title: string;
  description: string;
  badgeText?: string;
  icon?: ReactNode;
}

export function BentoModuleCard({
  availability,
  to,
  eyebrow,
  title,
  description,
  badgeText,
  icon,
}: BentoModuleCardProps) {
  if (availability === 'hidden') {
    return null;
  }

  if (availability === 'coming_soon') {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-[148px] flex-col justify-between rounded-[22px] border border-line/80 bg-paper/65 p-4 opacity-75"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-muted">
            {icon}
          </span>
          <span className="rounded-full border border-line bg-canvas px-2 py-0.5 font-sans text-[9px] font-medium tracking-[0.14em] text-muted uppercase">
            Próximamente
          </span>
        </div>

        <div className="mt-3">
          {eyebrow ? (
            <p className="font-sans text-[10px] tracking-[0.16em] text-muted uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-0.5 font-serif text-[22px] leading-[1.08] font-medium tracking-[-0.02em] text-ink/85">
            {title}
          </h2>
          <p className="mt-1 font-sans text-[12px] leading-[1.4] text-muted">
            {description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group flex min-h-[164px] flex-col justify-between rounded-[22px] border border-line bg-paper p-4 no-underline shadow-[0_10px_30px_rgba(64,54,44,0.05)] transition hover:border-accent/70 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-ink transition group-hover:border-ink">
          {icon}
        </span>

        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-ink transition group-hover:bg-ink group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3">
        {badgeText ? (
          <span className="mb-1 inline-block rounded-full border border-line bg-canvas px-2 py-0.5 font-sans text-[10px] font-medium text-muted">
            {badgeText}
          </span>
        ) : eyebrow ? (
          <p className="font-sans text-[10px] tracking-[0.16em] text-muted uppercase">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="mt-0.5 font-serif text-[24px] leading-[1.06] font-medium tracking-[-0.02em] text-ink">
          {title}
        </h2>
        <p className="mt-1 font-sans text-[12.5px] leading-[1.4] text-muted">
          {description}
        </p>
      </div>
    </Link>
  );
}
