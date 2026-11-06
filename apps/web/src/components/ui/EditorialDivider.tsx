export interface EditorialDividerProps {
  className?: string;
}

export function EditorialDivider({
  className = 'my-5',
}: EditorialDividerProps) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      className={`mx-auto h-px w-[42px] bg-line ${className}`.trim()}
    />
  );
}
