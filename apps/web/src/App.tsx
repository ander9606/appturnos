import { BrowserRouter, Routes, Route } from 'react-router';
import { LoginPage } from '@/modules/auth/LoginPage';
import { ProtectedRoute, RoleRoute } from '@/modules/auth/ProtectedRoute';
import { Layout } from '@/shared/components/Layout';
import { WelcomePage } from '@/pages/WelcomePage';
import { RegistroEmpresaPage } from '@/pages/RegistroEmpresaPage';
import { PrivacidadPage } from '@/pages/PrivacidadPage';
import { TerminosPage } from '@/pages/TerminosPage';
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
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/bienvenida" element={<WelcomePage />} />
        <Route path="/registro" element={<RegistroEmpresaPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="/terminos" element={<TerminosPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_nomina', 'jefe_turnos', 'nomina']} />}>
              <Route index element={<DashboardPage />} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_nomina', 'nomina']} />}>
              <Route path="nomina" element={<NominaPage />} />
              <Route path="nomina/:id" element={<PeriodoDetailPage />} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_nomina', 'jefe_turnos']} />}>
              <Route path="equipo" element={<EquipoPage />} />
              <Route path="equipo/:id" element={<TrabajadorDetailPage />} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_turnos']} />}>
              <Route path="turnos" element={<TurnosPage />} />
              <Route path="turnos/:id" element={<OfertaDetailPage />} />
              <Route path="configuracion" element={<ConfiguracionPage />} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa']} />}>
              <Route path="integracion" element={<IntegracionPage />} />
            </Route>
            <Route element={<RoleRoute roles={['super_admin']} />}>
              <Route path="admin/empresas" element={<SuperAdminPage />} />
              <Route path="admin/empresas/:id" element={<EmpresaDetailPage />} />
              <Route path="admin/wompi-eventos" element={<WompiEventosPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
