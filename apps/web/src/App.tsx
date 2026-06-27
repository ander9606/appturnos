import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginPage } from '@/modules/auth/LoginPage';
import { ProtectedRoute } from '@/modules/auth/ProtectedRoute';
import { Layout } from '@/shared/components/Layout';
import { WelcomePage } from '@/pages/WelcomePage';
import { RegistroEmpresaPage } from '@/pages/RegistroEmpresaPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NominaPage } from '@/modules/nomina/pages/NominaPage';
import { PeriodoDetailPage } from '@/modules/nomina/pages/PeriodoDetailPage';
import { EquipoPage } from '@/modules/equipo/pages/EquipoPage';
import { TrabajadorDetailPage } from '@/modules/equipo/pages/TrabajadorDetailPage';
import { TurnosPage } from '@/modules/turnos/pages/TurnosPage';
import { OfertaDetailPage } from '@/modules/turnos/pages/OfertaDetailPage';
import { ConfiguracionPage } from '@/modules/configuracion/pages/ConfiguracionPage';
import { IntegracionPage } from '@/modules/integracion/pages/IntegracionPage';
import { SuperAdminPage } from '@/modules/admin/pages/SuperAdminPage';
import { EmpresaDetailPage } from '@/modules/admin/pages/EmpresaDetailPage';
import { WompiEventosPage } from '@/modules/admin/pages/WompiEventosPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/bienvenida" element={<WelcomePage />} />
        <Route path="/registro" element={<RegistroEmpresaPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="nomina" element={<NominaPage />} />
            <Route path="nomina/:id" element={<PeriodoDetailPage />} />
            <Route path="equipo" element={<EquipoPage />} />
            <Route path="equipo/:id" element={<TrabajadorDetailPage />} />
            <Route path="turnos" element={<TurnosPage />} />
            <Route path="turnos/:id" element={<OfertaDetailPage />} />
            <Route path="configuracion" element={<ConfiguracionPage />} />
            <Route path="integracion" element={<IntegracionPage />} />
            <Route path="admin/empresas" element={<SuperAdminPage />} />
            <Route path="admin/empresas/:id" element={<EmpresaDetailPage />} />
            <Route path="admin/wompi-eventos" element={<WompiEventosPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
