import type { HTMLAttributes, ReactNode } from 'react';

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function SurfaceCard({
  children,
  className = '',
  ...rest
}: SurfaceCardProps) {
  return (
    <div
      className={`rounded-[22px] border border-line bg-paper shadow-[0_10px_30px_rgba(64,54,44,0.05)] ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
