import { useEffect, useState } from 'react';

/**
 * Bottom-right transient notification. Pass an empty string to hide it.
 *
 * `imagePath` is optional: an add-to-cart toast shows the product photo so the nurse can confirm
 * what landed in the cart without reopening it. A missing or broken image simply drops the
 * thumbnail rather than leaving a hole.
 */
export function Toast({ message, imagePath }: { message: string; imagePath?: string }) {
  const visible = message !== '';
  const [broken, setBroken] = useState(false);

  // A new image gets a fresh chance to load; without this a single broken path would suppress
  // every later thumbnail.
  useEffect(() => setBroken(false), [imagePath]);

  const showImage = Boolean(imagePath) && !broken;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-6 right-6 z-[80] flex max-w-[340px] items-center gap-3 rounded-lg bg-solid-bg py-2.5 pr-4 text-sm text-solid-ink shadow-lg transition-all duration-300 ${
        showImage ? 'pl-2.5' : 'pl-4'
      } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {showImage && (
        <img
          src={imagePath}
          alt=""
          onError={() => setBroken(true)}
          className="h-11 w-11 flex-none rounded object-cover"
        />
      )}
      <span className="min-w-0">{message}</span>
    </div>
  );
}
