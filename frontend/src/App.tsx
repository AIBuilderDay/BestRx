import { useState } from 'react';
import { readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Catalog from './views/Catalog';
import Login from './views/Login';

/**
 * Session gate: sign in, then the app. Every role lands on the catalog for now — it is the only
 * view; per-role landing pages (orders board, cost dashboard) route from here when they exist.
 */
export default function App() {
  const [user, setUser] = useState<User | null>(readSession);

  const signIn = (next: User) => {
    writeSession(next.id);
    setUser(next);
  };

  const signOut = () => {
    writeSession(null);
    setUser(null);
  };

  if (!user) return <Login onSignIn={signIn} />;
  return <Catalog user={user} onSignOut={signOut} />;
}
