import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/shared/api/axios';
import { useAuthStore } from '@/modules/auth/authStore';
import { homeForRol } from '@/modules/auth/roleHome';

export function TerminosPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const actualizarUsuario = useAuthStore((s) => s.actualizarUsuario);

  // Igual que mobile (app/terminos.tsx): si hay sesión y aún no aceptó, se
  // exige leer hasta el final antes de poder aceptar. super_admin no opera
  // sobre datos de trabajadores/empresa, así que nunca queda bloqueado aquí
  // (ver también el gate de ProtectedRoute.tsx).
  const pendiente = !!usuario && !usuario.terminos_aceptados_at && usuario.rol !== 'super_admin';

  const [scrolled, setScrolled] = useState(!pendiente);
  const [aceptando, setAceptando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
  };

  const aceptar = async () => {
    setAceptando(true);
    try {
      const res = await api.patch<{ data: { terminos_aceptados_at: string } }>('/auth/me/terminos');
      actualizarUsuario({ terminos_aceptados_at: res.data.data.terminos_aceptados_at });
      navigate(homeForRol(usuario!.rol), { replace: true });
    } catch {
      setAceptando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex flex-col items-center">
      <div className={`max-w-2xl w-full flex flex-col ${pendiente ? 'h-[calc(100vh-5rem)]' : ''}`}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Términos y condiciones</h1>
        {pendiente && <p className="text-sm text-muted-foreground mb-4">Lee el acuerdo completo antes de continuar.</p>}

        <div
          ref={scrollRef}
          onScroll={pendiente ? onScroll : undefined}
          className={pendiente ? 'flex-1 overflow-y-auto border border-border rounded-xl p-5 bg-card mt-2' : 'mt-6'}
        >
          <p className="text-sm text-foreground leading-6 whitespace-pre-line">{TERMINOS_TEXT}</p>
        </div>

        {pendiente ? (
          <div className="pt-4 flex flex-col gap-2 shrink-0">
            {!scrolled && (
              <p className="text-xs text-center text-muted-foreground">Desplázate hasta el final para aceptar</p>
            )}
            <button
              type="button"
              onClick={aceptar}
              disabled={!scrolled || aceptando}
              className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-primary/25"
            >
              {aceptando ? 'Aceptando…' : 'Acepto los términos y condiciones'}
            </button>
          </div>
        ) : usuario ? (
          <button
            type="button"
            onClick={() => navigate(homeForRol(usuario.rol))}
            className="mt-8 self-start text-sm font-semibold text-primary hover:underline"
          >
            ← Volver
          </button>
        ) : null}
      </div>
    </div>
  );
}

const TERMINOS_TEXT = `TÉRMINOS Y CONDICIONES DE USO — ZATURNO

Fecha de vigencia: 12 de noviembre de 2026

1. ACEPTACIÓN
Al usar la aplicación Zaturno aceptas estos términos en su totalidad. Si no estás de acuerdo, no uses la aplicación.

2. DESCRIPCIÓN DEL SERVICIO
Zaturno es una plataforma de gestión de turnos y nómina para empresas colombianas. Permite administrar trabajadores, asignaciones de turnos, marcaciones de ingreso/egreso y liquidaciones de nómina.

Zaturno calcula el pago de dos formas, según el tipo de vínculo del trabajador con la empresa:
• Nómina: se liquidan las horas trabajadas con los recargos de ley vigentes (nocturno, dominical/festivo, horas extra) sobre el período de pago (mensual, quincenal o semanal). En jornadas mayores a 6 horas se descuenta automáticamente 1 hora de almuerzo, salvo que el trabajador marque que tuvo una jornada continua sin ese descanso.
• Turnos: se paga una tarifa fija por cada turno completado, pactada al publicar la oferta, sin recargos de ley adicionales. El gestor de la empresa puede asignar manualmente un bono extra a un turno puntual (por ejemplo, una propina), visible en el detalle del turno y en el contrato correspondiente.

El administrador de tu empresa puede consultar el detalle completo de estas reglas, con ejemplos, desde el panel de administración.

Zaturno no realiza pagos ni maneja dinero real en ningún momento. Es únicamente un puente de información entre trabajadores y empresas: calcula y registra los montos correspondientes a cada turno o período de nómina para que ambas partes lleven un control claro y verificable, pero el pago efectivo lo realiza la empresa directamente al trabajador por fuera de la aplicación.

3. DATOS PERSONALES Y PRIVACIDAD
Recopilamos los siguientes datos para prestar el servicio:
• Nombre, correo electrónico y número de celular (identificación y comunicación).
• Ubicación geográfica durante el marcaje de ingreso/egreso, incluido el marcaje libre sin punto fijo asignado.
• Identificador del dispositivo usado para marcar, para detectar posible fraude (ej. dos personas marcando desde el mismo teléfono).
• Firma electrónica en contratos diarios (almacenada como imagen codificada).
• Datos laborales y salariales proporcionados por la empresa empleadora.

El tratamiento de datos personales se rige por la Ley 1581 de 2012 (habeas data). Consulta nuestra política de privacidad completa en /privacidad.

Puedes eliminar tu cuenta en cualquier momento desde la app (Perfil → Eliminar cuenta). Conservamos de forma anonimizada el historial de turnos trabajados, contratos y pagos por obligación legal de nómina — el detalle completo está en /privacidad.

4. PLANES Y PAGOS
Zaturno se paga por período (mensual, trimestral, semestral o anual) mediante un link de pago de Wompi que tú mismo generas desde Mi plan — no guardamos tarjetas ni cobramos de forma automática. Las empresas nuevas tienen 30 días gratis para probar la plataforma.

Si tu período vence sin que lo renueves, tienes 3 días de gracia antes de que se bloqueen las acciones de escritura; tu historial no se borra.

Puedes cancelar la renovación de tu plan en cualquier momento desde Mi plan, con un solo botón: dejas de recibir recordatorios y no se te cobra de nuevo, pero mantienes acceso hasta el final del período ya pagado. Puedes reactivarla antes de esa fecha si cambias de opinión.

Un cambio de precio de plan solo aplica a renovaciones futuras — nunca a un período que ya pagaste.

Las empresas con una integración activa de logiq360 no pagan la suscripción directamente a Zaturno; su acceso depende de esa integración.

5. USO ACEPTABLE
No puedes usar Zaturno para actividades ilegales, suplantar identidades o interferir con el servicio. El acceso es personal e intransferible.

6. PROPIEDAD INTELECTUAL
Todo el software, diseño y contenido de Zaturno es propiedad de sus desarrolladores. No se otorgan licencias de uso más allá de lo necesario para operar la aplicación.

7. LIMITACIÓN DE RESPONSABILIDAD
Zaturno no es responsable por pérdidas de datos causadas por fallas en el dispositivo del usuario, conectividad interrumpida o uso indebido de credenciales.

8. MODIFICACIONES
Podemos actualizar estos términos en cualquier momento. Te notificaremos con al menos 7 días de anticipación para cambios materiales.

9. LEY APLICABLE
Estos términos se rigen por la legislación colombiana. Cualquier controversia se someterá a los jueces competentes de Colombia.

10. CONTACTO
soporte@zaturno.app
`;
