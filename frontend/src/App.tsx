import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { can, isFamilyMember, readSession, writeSession } from './lib/auth';
import type { User } from './types/domain';
import Cart from './views/Cart';
import Catalog from './views/Catalog';
import Family from './views/Family';
import Login from './views/Login';
import NurseAssignment from './views/NurseAssignment';
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
  const family = isFamilyMember(user);
  const home = user ? (family ? '/family' : '/catalog') : '/login';

  // Catalog and cart are open to staff and family; the family flow just looks different inside them.
  const sharedRoute = (render: (u: User) => ReactNode): ReactNode =>
    user ? render(user) : toLogin;
  // Orders, patients and assignments are staff-only — a family member gets sent to their own view.
  const staffRoute = (render: (u: User) => ReactNode): ReactNode =>
    !user ? toLogin : family ? <Navigate to="/family" replace /> : render(user);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <CartProvider userId={user?.id ?? null}>
        <Routes>
          <Route path="/login" element={<Login onSignIn={signIn} />} />
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route
            path="/family"
            element={
              !user ? (
                toLogin
              ) : family ? (
                <Family user={user} onSignOut={signOut} />
              ) : (
                <Navigate to="/catalog" replace />
              )
            }
          />
          <Route
            path="/catalog/:offerId"
            element={sharedRoute((u) => <Catalog user={u} onSignOut={signOut} />)}
          />
          <Route path="/catalog" element={sharedRoute((u) => <Catalog user={u} onSignOut={signOut} />)} />
          <Route path="/cart" element={sharedRoute((u) => <Cart user={u} onSignOut={signOut} />)} />
          <Route path="/orders" element={staffRoute((u) => <Orders user={u} onSignOut={signOut} />)} />
          <Route path="/patients" element={staffRoute((u) => <Patients user={u} onSignOut={signOut} />)} />
          <Route
            path="/patients/:patientId"
            element={staffRoute((u) => <PatientDetail user={u} onSignOut={signOut} />)}
          />
          <Route
            path="/assignments"
            element={
              user && can(user, 'nurse-assignment') ? (
                <NurseAssignment user={user} onSignOut={signOut} />
              ) : user ? (
                <Navigate to={home} replace />
              ) : (
                toLogin
              )
            }
          />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
