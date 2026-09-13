export function TerminosPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Términos y condiciones</h1>
        <p className="text-sm text-foreground leading-6 whitespace-pre-line">{TERMINOS_TEXT}</p>
      </div>
    </div>
  );
}

const TERMINOS_TEXT = `TÉRMINOS Y CONDICIONES DE USO — ZATURNO

Fecha de vigencia: 13 de septiembre de 2026

1. ACEPTACIÓN
Al usar la aplicación Zaturno aceptas estos términos en su totalidad. Si no estás de acuerdo, no uses la aplicación.

2. DESCRIPCIÓN DEL SERVICIO
Zaturno es una plataforma de gestión de turnos y nómina para empresas colombianas. Permite administrar trabajadores, asignaciones de turnos, marcaciones de ingreso/egreso y liquidaciones de nómina.

El pago de cada turno se calcula según la tarifa pactada y los recargos de ley (nocturno, dominical, festivo, horas extra). Además, cuando aplica:
• Se descuenta automáticamente 1 hora de almuerzo en jornadas mayores a 6 horas, salvo que el trabajador marque que tuvo una jornada continua sin ese descanso.
• El gestor de la empresa puede asignar manualmente un bono extra a un turno puntual (por ejemplo, una propina), visible en el detalle del turno y en el contrato correspondiente.

3. DATOS PERSONALES Y PRIVACIDAD
Recopilamos los siguientes datos para prestar el servicio:
• Nombre, correo electrónico y número de celular (identificación y comunicación).
• Ubicación geográfica durante el marcaje de ingreso/egreso, incluido el marcaje libre sin punto fijo asignado.
• Identificador del dispositivo usado para marcar, para detectar posible fraude (ej. dos personas marcando desde el mismo teléfono).
• Firma electrónica en contratos diarios (almacenada como imagen codificada).
• Datos laborales y salariales proporcionados por la empresa empleadora.

El tratamiento de datos personales se rige por la Ley 1581 de 2012 (habeas data). Consulta nuestra política de privacidad completa en /privacidad.

Puedes eliminar tu cuenta en cualquier momento desde la app (Perfil → Eliminar cuenta). Conservamos de forma anonimizada el historial de turnos trabajados, contratos y pagos por obligación legal de nómina — el detalle completo está en /privacidad.

4. USO ACEPTABLE
No puedes usar Zaturno para actividades ilegales, suplantar identidades o interferir con el servicio. El acceso es personal e intransferible.

5. PROPIEDAD INTELECTUAL
Todo el software, diseño y contenido de Zaturno es propiedad de sus desarrolladores. No se otorgan licencias de uso más allá de lo necesario para operar la aplicación.

6. LIMITACIÓN DE RESPONSABILIDAD
Zaturno no es responsable por pérdidas de datos causadas por fallas en el dispositivo del usuario, conectividad interrumpida o uso indebido de credenciales.

7. MODIFICACIONES
Podemos actualizar estos términos en cualquier momento. Te notificaremos con al menos 7 días de anticipación para cambios materiales.

8. LEY APLICABLE
Estos términos se rigen por la legislación colombiana. Cualquier controversia se someterá a los jueces competentes de Colombia.

9. CONTACTO
soporte@zaturno.app
`;
