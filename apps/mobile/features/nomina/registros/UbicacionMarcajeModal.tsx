import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { View, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UbicacionLink } from '@/components/ui/UbicacionLink';
import { fmtFechaCorta } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { RegistroDiario } from '@api-client';

// ── Modal: ubicación de marcaje ──────────────────────────────────────────

export function UbicacionMarcajeModal({
  registro,
  onClose,
}: {
  registro: RegistroDiario | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!registro) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="w-full bg-background rounded-t-3xl px-6 pt-5"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-lg font-bold text-foreground">Ubicación de marcaje</Text>
              <Text className="text-sm text-muted-foreground">
                {registro.trabajador_nombre} {registro.trabajador_apellido} · {fmtFechaCorta(registro.fecha)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>
          <View className="gap-3">
            {registro.latitud_entrada != null && (
              <UbicacionLink lat={registro.latitud_entrada} lng={registro.longitud_entrada!} label="Entrada" />
            )}
            {registro.latitud_salida != null && (
              <UbicacionLink lat={registro.latitud_salida} lng={registro.longitud_salida!} label="Salida" />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
