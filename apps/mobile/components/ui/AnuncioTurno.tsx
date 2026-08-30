import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnuncioTurnoStore, type TipoAnuncioTurno } from '@/lib/anuncioTurno';

const AUTO_HIDE_MS = 3200;
const HIDDEN_Y = -200;

const CONFIG: Record<TipoAnuncioTurno, { icon: keyof typeof Ionicons.glyphMap; bg: string }> = {
  publicado:  { icon: 'megaphone',      bg: '#059669' }, // success
  cancelado:  { icon: 'close-circle',   bg: '#DC2626' }, // danger
  completado: { icon: 'checkmark-done', bg: '#3B82F6' }, // info
};

/**
 * Anuncio destacado que baja desde arriba de la pantalla al publicar,
 * cancelar o completar un turno — más visible que el toast inferior
 * porque marca el cierre de un flujo importante. Montado una vez en el
 * root layout; ver lib/anuncioTurno.ts para dispararlo.
 */
export function AnuncioTurno() {
  const mensaje = useAnuncioTurnoStore((s) => s.mensaje);
  const tipo    = useAnuncioTurnoStore((s) => s.tipo);
  const hide    = useAnuncioTurnoStore((s) => s.hide);
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;

  useEffect(() => {
    if (!mensaje) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    const id = setTimeout(() => {
      Animated.timing(translateY, { toValue: HIDDEN_Y, duration: 220, useNativeDriver: true }).start(hide);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [mensaje, hide, translateY]);

  if (!mensaje) return null;
  const cfg = CONFIG[tipo];

  return (
    <SafeAreaView pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <Animated.View style={{ transform: [{ translateY }] }} className="mx-4 mt-2">
        <View
          className="flex-row items-center gap-3 rounded-2xl px-4 py-3 shadow-lg"
          style={{ backgroundColor: cfg.bg }}
        >
          <Ionicons name={cfg.icon} size={20} color="#FFFFFF" />
          <Text className="flex-1 text-white text-sm font-semibold">{mensaje}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
