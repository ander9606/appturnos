import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAvisoEmpresaStore } from '@/lib/avisoEmpresa';

const AUTO_HIDE_MS = 6000;
const HIDDEN_Y = -200;

/**
 * Aviso accionable que baja desde arriba cuando llega una invitación de
 * empresa (p. ej. pasar a nómina) mientras la app está abierta — a
 * diferencia de AnuncioTurno (informativo, no se toca), este navega a
 * "Mis empresas" al tocarlo porque requiere una decisión del trabajador.
 */
export function AvisoEmpresa() {
  const mensaje = useAvisoEmpresaStore((s) => s.mensaje);
  const hide = useAvisoEmpresaStore((s) => s.hide);
  const router = useRouter();
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

  return (
    <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <Animated.View style={{ transform: [{ translateY }] }} className="mx-4 mt-2">
        <Pressable
          onPress={() => {
            hide();
            router.push('/mis-empresas');
          }}
          className="flex-row items-center gap-3 rounded-2xl px-4 py-3 shadow-lg active:opacity-90"
          style={{ backgroundColor: '#D97706' }}
        >
          <Ionicons name="briefcase" size={20} color="#FFFFFF" />
          <Text className="flex-1 text-white text-sm font-semibold">{mensaje}</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
