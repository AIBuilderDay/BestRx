import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Catalog from './views/Catalog';
import Login from './views/Login';
import PatientDetail from './views/PatientDetail';
import Patients from './views/Patients';
import Settings from './views/Settings';

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

  return (
    <ThemeProvider>
      {!user ? (
        <Login onSignIn={signIn} />
      ) : (
        <BrowserRouter>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/catalog" replace />} />
              <Route path="/catalog" element={<Catalog user={user} />} />
              <Route path="/patients" element={<Patients user={user} />} />
              <Route path="/patients/:patientId" element={<PatientDetail user={user} />} />
              <Route path="/settings" element={<Settings user={user} onSignOut={signOut} />} />
            </Routes>
          </CartProvider>
        </BrowserRouter>
      )}
    </ThemeProvider>
  );
}
