import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type PillButtonVariant = 'primary' | 'secondary' | 'danger';

export interface PillButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
  fullWidth?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<PillButtonVariant, string> = {
  primary:
    'bg-ink text-white border border-ink hover:opacity-95 active:scale-[0.99]',
  secondary:
    'bg-transparent text-ink border border-line hover:bg-canvas/70 active:scale-[0.99]',
  danger:
    'bg-danger text-white border border-danger hover:opacity-95 active:scale-[0.99]',
};

export function PillButton({
  variant = 'primary',
  fullWidth = false,
  icon,
  className = '',
  disabled,
  type = 'button',
  children,
  ...rest
}: PillButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full px-[22px] font-sans text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
