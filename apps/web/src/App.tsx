import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginPage } from '@/modules/auth/LoginPage';
import { ProtectedRoute } from '@/modules/auth/ProtectedRoute';
import { Layout } from '@/shared/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { NominaPage } from '@/modules/nomina/pages/NominaPage';
import { PeriodoDetailPage } from '@/modules/nomina/pages/PeriodoDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="nomina" element={<NominaPage />} />
            <Route path="nomina/:id" element={<PeriodoDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
