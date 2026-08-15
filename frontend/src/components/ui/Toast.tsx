/** Bottom-right transient notification. Pass an empty string to hide it. */
export function Toast({ message }: { message: string }) {
  const visible = message !== '';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-6 right-6 z-[80] max-w-[340px] rounded-lg bg-solid-bg px-4 py-2.5 text-sm text-solid-ink shadow-lg transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
