/**
 * The agent → cart comet hand-off (mockups/agent-cart-handoff.html, decided cut):
 * a streaking comet arcs from the search bar to the cart icon, the icon bounces
 * with a double-ring burst and sparks, then the caller opens the drawer where the
 * new line lands with the gradient ring (`.agent-added` in index.css).
 *
 * Pure DOM show — no app state. Defensive by design: every export resolves/returns
 * no matter what (missing elements, reduced motion), so the order flow can never
 * hang on a visual effect.
 */

const COMET_MS = 1100;
const CART_TARGET = '[data-testid="cart-button"]';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fly the comet from the search bar to the cart icon. Resolves when it lands. */
export function flyCometToCart(fromEl: HTMLElement | null): Promise<void> {
  return new Promise((resolve) => {
    const toEl = document.querySelector<HTMLElement>(CART_TARGET);
    if (!fromEl || !toEl || reducedMotion()) {
      resolve();
      return;
    }

    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const x0 = from.right - 14;
    const y0 = from.top + from.height / 2;
    const x1 = to.left + to.width / 2;
    const y1 = to.top + to.height / 2;
    // quadratic arc: control point above the midpoint
    const cx = (x0 + x1) / 2;
    const cy = Math.min(y0, y1) - 36;

    const comet = document.createElement('div');
    comet.className = 'agent-comet';
    comet.appendChild(Object.assign(document.createElement('div'), { className: 'agent-comet-tail' }));
    document.body.appendChild(comet);

    const bez = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * x0 + 2 * u * t * cx + t * t * x1,
        y: u * u * y0 + 2 * u * t * cy + t * t * y1,
      };
    };

    let start: number | null = null;
    let lastTrail = 0;
    const frame = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / COMET_MS);
      const e = 1 - Math.pow(1 - t, 2.2); // ease-out along the arc
      const p = bez(e);
      const ahead = bez(Math.min(1, e + 0.02));
      const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
      comet.style.transform = `translate(${p.x - 7.5}px, ${p.y - 7.5}px) rotate(${angle}deg) scale(${1 - 0.3 * e})`;
      comet.style.opacity = e > 0.94 ? '0' : '1';
      // ember trail behind the head
      if (ts - lastTrail > 36 && e < 0.9) {
        lastTrail = ts;
        const ember = document.createElement('div');
        ember.className = 'agent-comet-trail';
        ember.style.left = `${p.x - 2.5}px`;
        ember.style.top = `${p.y - 2.5}px`;
        document.body.appendChild(ember);
        window.setTimeout(() => ember.remove(), 550);
      }
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        comet.remove();
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/** Impact at the cart icon: bounce + double-ring burst + a few sparks. Fire-and-forget. */
export function burstAtCart(): void {
  const toEl = document.querySelector<HTMLElement>(CART_TARGET);
  if (!toEl || reducedMotion()) return;

  toEl.classList.add('cart-boom');
  window.setTimeout(() => toEl.classList.remove('cart-boom'), 1100);

  const rect = toEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let i = 0; i < 7; i++) {
    const spark = document.createElement('div');
    spark.className = 'agent-comet-spark';
    spark.style.left = `${x - 2}px`;
    spark.style.top = `${y - 2}px`;
    document.body.appendChild(spark);
    const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2 + (i % 2 ? 0.3 : -0.2);
    const radius = 20 + (i % 3) * 8;
    spark
      .animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) scale(0.2)`,
            opacity: 0,
          },
        ],
        { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
      .addEventListener('finish', () => spark.remove());
  }
}
