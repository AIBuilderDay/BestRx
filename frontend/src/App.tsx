import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Cart from './views/Cart';
import Catalog from './views/Catalog';
import Login from './views/Login';
import Orders from './views/Orders';
import PatientDetail from './views/PatientDetail';
import Patients from './views/Patients';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

/**
 * Routed app with /login as a real route, so signing in pushes a history entry and the browser
 * back button works. ThemeProvider wraps the router so color mode persists on the login screen.
 */
export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <RoutedApp />
      </DataProvider>
    </ThemeProvider>
  );
}

/**
 * Split from App so the session is read after DataProvider has loaded the users table —
 * `readSession` resolves an id against it, and would find nothing on an empty snapshot.
 */
function RoutedApp() {
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
      <ScrollToTop />
      <CartProvider>
        <Routes>
          <Route path="/login" element={<Login onSignIn={signIn} />} />
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog/:offerId" element={user ? <Catalog user={user} onSignOut={signOut} /> : toLogin} />
          <Route path="/catalog" element={user ? <Catalog user={user} onSignOut={signOut} /> : toLogin} />
          <Route path="/cart" element={user ? <Cart user={user} onSignOut={signOut} /> : toLogin} />
          <Route path="/orders" element={user ? <Orders user={user} onSignOut={signOut} /> : toLogin} />
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
