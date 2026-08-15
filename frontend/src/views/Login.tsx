import { useState, type FormEvent } from 'react';
import { getUser } from '../data/db';
import { DEMO_ACCOUNT_IDS, DEMO_PASSWORD, findUserByEmail, ROLE_LABELS } from '../lib/auth';
import type { User } from '../types/domain';
import { Logo } from '../components/ui/Logo';

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('');

/** Sign-in screen — the "minimal" variant from mockups/login.html. Fake auth, real permissions. */
export default function Login({ onSignIn }: { onSignIn: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const demoAccounts = DEMO_ACCOUNT_IDS.map(getUser).filter((u): u is User => u !== undefined);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const user = findUserByEmail(email);
    if (!user) {
      setError('No account matches that email. Pick a demo account below.');
      return;
    }
    if (user.orgType === 'vendor') {
      setError('Vendor accounts don’t sign in here — vendors respond to text and email links.');
      return;
    }
    if (password !== DEMO_PASSWORD) {
      setError('Wrong password — it’s “demo” for every demo account.');
      return;
    }
    onSignIn(user);
  };

  const fillAccount = (user: User) => {
    setEmail(user.email);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-6">
      <div className="w-full max-w-84 text-center">
        <div className="mb-5.5 flex justify-center text-ink">
          <Logo height={44} />
        </div>
        <h1 className="mb-7.5 text-[22px] font-semibold tracking-tight">Sign in to BestRx</h1>

        <form onSubmit={submit} noValidate className="text-left">
          <div className="mb-3.5">
            <label
              htmlFor="email"
              className="mb-1.25 block text-[11px] font-medium uppercase tracking-[0.07em] text-[var(--color-ink-3)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospice-a.example"
              autoComplete="username"
              className="w-full rounded-[var(--radius-control)] border border-line-strong bg-bg px-2.75 py-2.25 text-ink placeholder:text-[var(--color-ink-3)]"
            />
          </div>
          <div className="mb-3.5">
            <label
              htmlFor="password"
              className="mb-1.25 block text-[11px] font-medium uppercase tracking-[0.07em] text-[var(--color-ink-3)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-[var(--radius-control)] border border-line-strong bg-bg px-2.75 py-2.25 text-ink placeholder:text-[var(--color-ink-3)]"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-[var(--radius-control)] border border-solid-bg bg-solid-bg px-3.5 py-2.25 text-[13px] font-medium text-solid-ink transition-opacity hover:opacity-85"
          >
            Sign in
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-[13px] text-risk">
              {error}
            </p>
          ) : null}
        </form>

        <div className="my-5.5 mb-2.5 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] uppercase tracking-[0.07em] text-[var(--color-ink-3)]">
            Or continue as
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div role="list" className="grid gap-2 text-left">
          {demoAccounts.map((user) => (
            <button
              key={user.id}
              type="button"
              role="listitem"
              aria-label={`Sign in as ${user.name}, ${ROLE_LABELS[user.role]}`}
              onClick={() => fillAccount(user)}
              className={`flex w-full items-center gap-2.75 rounded-[var(--radius-card)] border px-3 py-2.25 transition-colors hover:bg-hover ${
                email === user.email ? 'border-ink' : 'border-line'
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-line bg-bg-subtle text-[11px] font-semibold text-[var(--color-ink-2)]"
              >
                {initials(user.name)}
              </span>
              <span className="min-w-0 flex-1 text-[13px] font-medium">{user.name}</span>
              <span className="flex-none whitespace-nowrap rounded-full border border-line-strong px-2.25 py-0.5 text-[11px] font-medium text-[var(--color-ink-2)]">
                {ROLE_LABELS[user.role]}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs text-[var(--color-ink-3)]">
          Demo accounts · Sample Hospice A · password <b className="text-ink">demo</b>
        </p>
      </div>
    </div>
  );
}
