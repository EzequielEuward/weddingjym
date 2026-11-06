import { WEDDING_CONFIG } from '@wedding/shared';
import { ArrowLeft, Pencil, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface WeddingHeaderHomeProps {
  variant?: 'home';
  guestAlias?: string | null;
  onEditAlias?: () => void;
}

export interface WeddingHeaderSubrouteProps {
  variant: 'subroute';
  title: string;
  eyebrow?: string;
  countLabel?: string;
  backTo?: string;
  rightSlot?: ReactNode;
}

export type WeddingHeaderProps =
  | WeddingHeaderHomeProps
  | WeddingHeaderSubrouteProps;

export function WeddingHeader(props: WeddingHeaderProps) {
  if (props.variant === 'subroute') {
    const { title, eyebrow, countLabel, backTo = '/', rightSlot } = props;
    return (
      <header className="mb-4 flex items-center justify-between gap-3 pt-1">
        <Link
          to={backTo}
          aria-label="Volver al inicio"
          className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1 text-center">
          {eyebrow ? (
            <p className="truncate font-sans text-[11px] font-normal tracking-[0.2em] text-muted uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="truncate font-serif text-[32px] leading-[1.05] font-medium tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {countLabel ? (
            <p className="mt-0.5 font-sans text-[12px] text-muted">
              {countLabel}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-[48px] shrink-0 justify-end">
          {rightSlot ?? null}
        </div>
      </header>
    );
  }

  const { guestAlias, onEditAlias } = props;

  return (
    <header className="pt-3 text-center">
      <p className="font-sans text-[11px] font-normal tracking-[0.22em] text-muted uppercase">
        {WEDDING_CONFIG.dateDisplay} · ALDEANO
      </p>

      <h1 className="mt-2 font-serif text-[50px] leading-[0.98] font-medium tracking-[-0.04em] text-ink">
        {WEDDING_CONFIG.couple.partnerOne}{' '}
        <span className="font-normal italic">&amp;</span>{' '}
        {WEDDING_CONFIG.couple.partnerTwo}
      </h1>

      <p className="mx-auto mt-2.5 max-w-[320px] font-serif text-[20px] leading-[1.3] font-normal text-muted italic">
        {WEDDING_CONFIG.subtitle}
      </p>

      {guestAlias ? (
        <button
          type="button"
          onClick={onEditAlias}
          aria-label={`Cambiar nombre (${guestAlias})`}
          className="mt-3 inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-1 font-sans text-[12px] text-ink transition hover:border-accent"
        >
          <UserCheck className="h-3.5 w-3.5 text-accent" />
          <span>{guestAlias}</span>
          {onEditAlias ? <Pencil className="ml-0.5 h-3 w-3 text-muted" /> : null}
        </button>
      ) : null}
    </header>
  );
}
