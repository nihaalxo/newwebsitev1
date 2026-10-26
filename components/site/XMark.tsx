/** The X emblem from the suit's chest: two diagonals and the vertical seam through them. */
export default function XMark({ className = 'xmark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5 L19 19 M19 5 L5 19 M12 2.5 V21.5" />
    </svg>
  );
}
