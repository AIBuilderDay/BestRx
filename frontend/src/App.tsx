import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Catalog from './views/Catalog';
import Patients from './views/Patients';
import PatientDetail from './views/PatientDetail';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:patientId" element={<PatientDetail />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
