import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { can, landingPathFor, readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Cart from './views/Cart';
import Catalog from './views/Catalog';
import Dashboard from './views/Dashboard';
import Login from './views/Login';
import PatientDetail from './views/PatientDetail';
import Patients from './views/Patients';

/**
 * Routed app with /login as a real route, so signing in pushes a history entry and the browser
 * back button works. ThemeProvider wraps the router so color mode persists on the login screen.
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
    <ThemeProvider>
      <BrowserRouter>
        <CartProvider>
          <Routes>
            <Route path="/login" element={<Login onSignIn={signIn} />} />
            <Route path="/" element={user ? <Navigate to={landingPathFor(user)} replace /> : toLogin} />
            {/* Roles without reporting are sent to the storefront rather than shown an error —
                there is nothing for them to fix, and the link is already hidden from their nav. */}
            <Route
              path="/dashboard"
              element={
                user ? (
                  can(user, 'reporting') ? (
                    <Dashboard user={user} onSignOut={signOut} />
                  ) : (
                    <Navigate to="/catalog" replace />
                  )
                ) : (
                  toLogin
                )
              }
            />
            <Route path="/catalog/:offerId" element={user ? <Catalog user={user} onSignOut={signOut} /> : toLogin} />
            <Route path="/catalog" element={user ? <Catalog user={user} onSignOut={signOut} /> : toLogin} />
            <Route path="/cart" element={user ? <Cart user={user} onSignOut={signOut} /> : toLogin} />
            <Route path="/patients" element={user ? <Patients user={user} onSignOut={signOut} /> : toLogin} />
            <Route
              path="/patients/:patientId"
              element={user ? <PatientDetail user={user} onSignOut={signOut} /> : toLogin}
            />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
