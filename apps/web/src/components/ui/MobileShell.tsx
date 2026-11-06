import type { ReactNode } from 'react';

export interface MobileShellProps {
  children: ReactNode;
  className?: string;
}

export function MobileShell({ children, className = '' }: MobileShellProps) {
  return (
    <div className="min-h-dvh w-full bg-canvas text-ink">
      <div
        className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-[14px] pt-4 pb-[max(28px,env(safe-area-inset-bottom))] ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
