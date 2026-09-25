/**
 * Lista de lo que cambia al aceptar una invitación a nómina — compartida
 * entre mis-empresas.tsx (tarjeta en la lista) y InvitacionFlotanteCard.tsx
 * (aviso invasivo al recibir la invitación), para que ambos digan lo mismo.
 */
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const CAMBIOS_NOMINA: { tipo: 'pierde' | 'gana'; texto: string }[] = [
  { tipo: 'pierde', texto: 'Ya no recibe ofertas de turnos de otras empresas — sus demás vínculos se archivan.' },
  { tipo: 'gana', texto: 'Salario fijo en vez de pago por turno.' },
  { tipo: 'gana', texto: 'Horas extra y recargos (nocturno, dominical, festivo) calculados automáticamente.' },
  { tipo: 'gana', texto: 'Aportes de ley a salud y pensión ya descontados; ARL y caja de compensación los paga la empresa.' },
];

/** Misma lista como texto con viñetas, para diálogos de solo texto plano (confirm()). */
export function formatCambiosNomina() {
  return CAMBIOS_NOMINA.map((c) => `${c.tipo === 'gana' ? '✓' : '✗'} ${c.texto}`).join('\n');
}

export function CambioRow({ tipo, texto }: { tipo: 'pierde' | 'gana'; texto: string }) {
  const gana = tipo === 'gana';
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons
        name={gana ? 'checkmark-circle' : 'close-circle'}
        size={15}
        color={gana ? '#059669' : '#DC2626'}
        style={{ marginTop: 1 }}
      />
      <Text className="text-xs text-foreground flex-1">{texto}</Text>
    </View>
  );
}

export function CambiosNominaList() {
  return (
    <View className="gap-2">
      {CAMBIOS_NOMINA.map((c) => (
        <CambioRow key={c.texto} tipo={c.tipo} texto={c.texto} />
      ))}
    </View>
  );
}
