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
 * Routed app with /login as a real route, so signing in pushes a history entry and the browser
 * back button works. Every role lands on the catalog by default; patients and other views route
 * from the top nav when permissions allow.
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

  const toLogin = <Navigate to="/login" replace />;

  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/login" element={<Login onSignIn={signIn} />} />
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={user ? <Catalog user={user} onSignOut={signOut} /> : toLogin} />
          <Route path="/patients" element={user ? <Patients user={user} onSignOut={signOut} /> : toLogin} />
          <Route
            path="/patients/:patientId"
            element={user ? <PatientDetail user={user} onSignOut={signOut} /> : toLogin}
          />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
