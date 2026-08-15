import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Catalog from './views/Catalog';
import Login from './views/Login';
import PatientDetail from './views/PatientDetail';
import Patients from './views/Patients';

/**
 * Session gate, then routed app. Every role lands on the catalog by default; patients and other
 * views route from the top nav when permissions allow.
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

  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<Catalog user={user} onSignOut={signOut} />} />
          <Route path="/patients" element={<Patients user={user} onSignOut={signOut} />} />
          <Route path="/patients/:patientId" element={<PatientDetail user={user} onSignOut={signOut} />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
