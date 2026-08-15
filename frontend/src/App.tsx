import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Cart from './views/Cart';
import Catalog from './views/Catalog';
import Login from './views/Login';
import PatientDetail from './views/PatientDetail';
import Patients from './views/Patients';
import Orders from './views/Orders';
import Settings from './views/Settings';

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
            <Route path="/" element={<Navigate to="/catalog" replace />} />
            <Route path="/catalog/:offerId" element={user ? <Catalog user={user} /> : toLogin} />
            <Route path="/catalog" element={user ? <Catalog user={user} /> : toLogin} />
            <Route path="/cart" element={user ? <Cart user={user} /> : toLogin} />
            <Route path="/patients" element={user ? <Patients user={user} /> : toLogin} />
            <Route
              path="/patients/:patientId"
              element={user ? <PatientDetail user={user} /> : toLogin}
            />
            <Route path="/orders" element={user ? <Orders user={user} /> : toLogin} />
            <Route path="/settings" element={user ? <Settings user={user} onSignOut={signOut} /> : toLogin} />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
