import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacidadScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1 px-6 py-4" showsVerticalScrollIndicator>
        <Text className="text-sm text-foreground leading-6">{PRIVACIDAD_TEXT}</Text>
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIVACIDAD_TEXT = `POLÍTICA DE PRIVACIDAD — ZATURNO

Fecha de vigencia: 13 de septiembre de 2026

1. RESPONSABLE DEL TRATAMIENTO
Zaturno SAS (en adelante "Zaturno"), NIT pendiente de asignación, con correo de contacto soporte@zaturno.app.

2. DATOS QUE RECOPILAMOS
• Datos de identificación: nombre, apellido, número de cédula, correo electrónico y teléfono celular.
• Datos laborales: cargo, salario, jornada laboral, empresa empleadora, historial de turnos.
• Datos de ubicación: coordenadas GPS capturadas en el momento del marcaje de ingreso/egreso al turno — tanto cuando existe un punto de marcaje fijo que validar (geofence) como en el marcaje libre, donde no hay un punto fijo asignado.
• Identificador del dispositivo: un identificador técnico del teléfono usado para marcar, usado para la prevención de fraude descrita en la sección 3.
• Firma electrónica: imagen de la firma del trabajador para contratos diarios de turno.
• Datos de uso: registros de actividad dentro de la app para mejoras del servicio y soporte técnico.

3. FINALIDAD DEL TRATAMIENTO
• Gestión de turnos y asignaciones laborales.
• Liquidación de nómina conforme a la ley laboral colombiana.
• Comunicaciones operativas (notificaciones push de turnos, ausencias, pagos).
• Cumplimiento de obligaciones legales ante autoridades colombianas.
• Prevención de fraude en el marcaje: comparamos la ubicación y el identificador de dispositivo entre las marcaciones de los trabajadores de una misma empresa para detectar posibles registros duplicados o suplantados (por ejemplo, dos personas marcando desde el mismo teléfono y lugar). Cuando se detecta una coincidencia, un gestor de la empresa la revisa manualmente antes de tomar cualquier decisión.

4. BASE LEGAL
El tratamiento se basa en la ejecución del contrato de prestación de servicios entre Zaturno y la empresa empleadora, y en el consentimiento del trabajador al registrarse o activar su cuenta.

5. COMPARTICIÓN DE DATOS
No vendemos datos personales a terceros. Compartimos datos únicamente con:
• La empresa empleadora (para gestión de nómina y turnos).
• Proveedores de infraestructura (servidores en la nube) bajo acuerdos de confidencialidad.
• Autoridades competentes cuando la ley lo exija.

6. RETENCIÓN DE DATOS
Conservamos los datos mientras la cuenta esté activa y hasta 5 años después de la terminación del vínculo laboral, para cumplir obligaciones legales de nómina.

7. DERECHOS DEL TITULAR
Conforme a la Ley 1581 de 2012 puedes solicitar acceso, corrección, actualización, supresión o portabilidad de tus datos enviando un correo a soporte@zaturno.app.

Puedes eliminar tu cuenta directamente desde la app (Perfil → Eliminar cuenta) o escribiendo a soporte@zaturno.app. Al hacerlo:
• Anonimizamos tu nombre, cédula, teléfono, correo, foto, fecha de nacimiento, contacto de emergencia, EPS/AFP y datos bancarios — dejan de estar asociados a tu identidad.
• Conservamos el historial de turnos trabajados, contratos firmados, pagos y calificaciones de forma anonimizada, por la obligación legal de retención de nómina descrita en la sección anterior (hasta 5 años).
• No podrás volver a iniciar sesión con esa cuenta. Esta acción no se puede deshacer.

8. SEGURIDAD
Implementamos cifrado en tránsito (TLS), almacenamiento seguro de tokens (Keystore/SecureStore) y control de acceso por roles para proteger tus datos.

9. DATOS DE UBICACIÓN
La ubicación se captura exclusivamente al momento del marcaje, incluido el marcaje libre. No rastreamos la ubicación de forma continua ni en segundo plano. La única comparación que hacemos entre trabajadores es la de prevención de fraude descrita en la sección 3.

10. CAMBIOS A ESTA POLÍTICA
Notificaremos cambios materiales con al menos 7 días de anticipación mediante notificación push o correo electrónico.

11. CONTACTO Y QUEJAS
soporte@zaturno.app
También puedes radicar quejas ante la Superintendencia de Industria y Comercio (SIC): www.sic.gov.co
`;
