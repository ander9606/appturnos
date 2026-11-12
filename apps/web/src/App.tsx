import { lazy, Suspense, type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginPage } from '@/modules/auth/LoginPage';
import { RecuperarPasswordPage } from '@/modules/auth/RecuperarPasswordPage';
import { ProtectedRoute, RoleRoute } from '@/modules/auth/ProtectedRoute';
import { useAuthStore } from '@/modules/auth/authStore';
import { Layout } from '@/shared/components/Layout';
import { LandingPage } from '@/pages/LandingPage';
import { WelcomePage } from '@/pages/WelcomePage';
import { RegistroEmpresaPage } from '@/pages/RegistroEmpresaPage';
import { PrivacidadPage } from '@/pages/PrivacidadPage';
import { TerminosPage } from '@/pages/TerminosPage';
import { PageLoading } from '@/shared/components/Spinner';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Páginas de la app autenticada: en un solo bundle eager pesaban ~1.1 MB incluso
// para un visitante que solo ve el login. Cada una pasa a su propio chunk, que
// el navegador solo pide al entrar a esa ruta.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CalendarioPage = lazy(() => import('@/pages/CalendarioPage').then((m) => ({ default: m.CalendarioPage })));
const NominaPage = lazy(() => import('@/modules/nomina/pages/NominaPage').then((m) => ({ default: m.NominaPage })));
const PeriodoDetailPage = lazy(() => import('@/modules/nomina/pages/PeriodoDetailPage').then((m) => ({ default: m.PeriodoDetailPage })));
const EquipoPage = lazy(() => import('@/modules/equipo/pages/EquipoPage').then((m) => ({ default: m.EquipoPage })));
const TrabajadorDetailPage = lazy(() => import('@/modules/equipo/pages/TrabajadorDetailPage').then((m) => ({ default: m.TrabajadorDetailPage })));
const TurnosPage = lazy(() => import('@/modules/turnos/pages/TurnosPage').then((m) => ({ default: m.TurnosPage })));
const OfertaDetailPage = lazy(() => import('@/modules/turnos/pages/OfertaDetailPage').then((m) => ({ default: m.OfertaDetailPage })));
const GruposPage = lazy(() => import('@/modules/grupos/pages/GruposPage').then((m) => ({ default: m.GruposPage })));
const GrupoDetailPage = lazy(() => import('@/modules/grupos/pages/GrupoDetailPage').then((m) => ({ default: m.GrupoDetailPage })));
const ConfiguracionPage = lazy(() => import('@/modules/configuracion/pages/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })));
const IntegracionPage = lazy(() => import('@/modules/integracion/pages/IntegracionPage').then((m) => ({ default: m.IntegracionPage })));
const ReportesPage = lazy(() => import('@/modules/reportes/pages/ReportesPage').then((m) => ({ default: m.ReportesPage })));
const SuperAdminPage = lazy(() => import('@/modules/admin/pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })));
const EmpresaDetailPage = lazy(() => import('@/modules/admin/pages/EmpresaDetailPage').then((m) => ({ default: m.EmpresaDetailPage })));
const WompiEventosPage = lazy(() => import('@/modules/admin/pages/WompiEventosPage').then((m) => ({ default: m.WompiEventosPage })));
const PlanesPage = lazy(() => import('@/modules/admin/pages/PlanesPage').then((m) => ({ default: m.PlanesPage })));

/** Envuelve una página lazy en su propio Suspense, para que el spinner solo
 *  reemplace el contenido (el Layout/sidebar de alrededor sigue montado). */
function p(el: JSX.Element) {
  return <Suspense fallback={<PageLoading />}>{el}</Suspense>;
}

/** La raíz es pública (landing de marketing) para visitantes anónimos; un usuario
 *  con sesión activa se manda directo a su dashboard en vez de ver el folleto. */
function RootRoute() {
  const usuario = useAuthStore((s) => s.usuario);
  if (usuario) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/bienvenida" element={<WelcomePage />} />
        <Route path="/registro" element={<RegistroEmpresaPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar" element={<RecuperarPasswordPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="/terminos" element={<TerminosPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_nomina', 'jefe_turnos', 'nomina']} />}>
              <Route path="dashboard" element={p(<DashboardPage />)} />
              <Route path="calendario" element={p(<CalendarioPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_nomina', 'nomina']} />}>
              <Route path="nomina" element={p(<NominaPage />)} />
              <Route path="nomina/:id" element={p(<PeriodoDetailPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_nomina', 'jefe_turnos']} />}>
              <Route path="equipo" element={p(<EquipoPage />)} />
              <Route path="equipo/:id" element={p(<TrabajadorDetailPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_turnos', 'jefe_nomina']} />}>
              <Route path="turnos" element={p(<TurnosPage />)} />
              <Route path="turnos/:id" element={p(<OfertaDetailPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina']} />}>
              <Route path="reportes" element={p(<ReportesPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa', 'jefe_turnos']} />}>
              <Route path="grupos" element={p(<GruposPage />)} />
              <Route path="grupos/:id" element={p(<GrupoDetailPage />)} />
              <Route path="configuracion" element={p(<ConfiguracionPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['admin_empresa']} />}>
              <Route path="integracion" element={p(<IntegracionPage />)} />
            </Route>
            <Route element={<RoleRoute roles={['super_admin']} />}>
              <Route path="admin/empresas" element={p(<SuperAdminPage />)} />
              <Route path="admin/empresas/:id" element={p(<EmpresaDetailPage />)} />
              <Route path="admin/wompi-eventos" element={p(<WompiEventosPage />)} />
              <Route path="admin/planes" element={p(<PlanesPage />)} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
