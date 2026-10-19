import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { COLORS, alpha } from '@/lib/designTokens';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Animated,
  Easing,
  AccessibilityInfo,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/useAuthStore';

const { height } = Dimensions.get('window');

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function WelcomeScreen() {
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const markLaunched = useAuthStore((s) => s.markLaunched);
  React.useEffect(() => { markLaunched(); }, []);
  const { entrada, float, sway } = useAnimacionHero();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Hero: llega hasta el borde superior (sin franja clara bajo la barra de estado) ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <HeroBackground sway={sway} />

        {/* El planeta entra con un pequeño escalado y luego flota; el texto sube suavemente */}
        <Animated.Image
          source={require('../../assets/logo-mark.png')}
          accessibilityLabel="Logo de Zaturno"
          style={[
            styles.logo,
            {
              opacity: entrada,
              transform: [
                { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: entrada,
            transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <Text style={styles.appName}>Zaturno</Text>
          <Text style={styles.appSub}>Turnos y nómina para tu empresa</Text>
        </Animated.View>
      </View>

      {/* ── Contenido ── */}
      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View>
          <Text style={styles.question}>¿Cómo quieres empezar?</Text>

          <View style={styles.cards}>
            <OptionCard
              icon="person"
              title="Ya te invitó una empresa"
              description="Activa tu cuenta con tu cédula"
              onPress={() => router.push('/(auth)/activar')}
              highlight
            />
            {/* Apple guideline 3.1.1: registro de empresas/organizaciones no se
                expone en iOS (se sigue ofreciendo en Android y en la web). */}
            {Platform.OS !== 'ios' && (
              <OptionCard
                icon="briefcase"
                title="Tengo una empresa"
                description="Administra empleados, turnos y nómina"
                onPress={() => router.push('/(auth)/registro-empresa')}
              />
            )}
            <OptionCard
              icon="calendar"
              title="Busco trabajo por turnos"
              description="Regístrate y postúlate a turnos disponibles"
              onPress={() => router.push('/(auth)/registro')}
            />
          </View>
        </View>

        {/* Quien ya tiene cuenta (el caso más frecuente) tiene su botón a mano del pulgar */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
          <Button label="Iniciar sesión" fullWidth onPress={() => router.push('/(auth)/login')} />
        </View>
      </View>
    </View>
  );
}

/**
 * Animación del hero: entrada (0→1 una vez), flotar del planeta y vaivén de las órbitas (0↔1 en bucle).
 * Respeta "reducir movimiento" del sistema: en ese caso todo queda quieto y ya visible.
 */
function useAnimacionHero() {
  const entrada = useRef(new Animated.Value(0)).current;
  const float   = useRef(new Animated.Value(0.5)).current;
  const sway    = useRef(new Animated.Value(0.5)).current;
  const [reducir, setReducir] = useState<boolean | null>(null); // null = aún no se sabe

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => vivo && setReducir(v)).catch(() => vivo && setReducir(false));
    // Si el sistema tarda en responder, no dejar el hero invisible: se asume "sin reducir"
    const espera = setTimeout(() => vivo && setReducir((r) => r ?? false), 400);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducir);
    return () => { vivo = false; clearTimeout(espera); sub.remove(); };
  }, []);

  useEffect(() => {
    if (reducir === null) return;
    if (reducir) { entrada.setValue(1); float.setValue(0.5); sway.setValue(0.5); return; }

    Animated.timing(entrada, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const vaiven = (v: Animated.Value, duration: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
    const loops = [vaiven(float, 2200), vaiven(sway, 5000)];
    float.setValue(0); sway.setValue(0);
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reducir, entrada, float, sway]);

  return { entrada, float, sway };
}

/** Degradado de marca (naranja → naranja oscuro) con órbitas finas, como las del planeta del logo. */
function HeroBackground({ sway }: { sway: Animated.Value }) {
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 320" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} />
            <Stop offset="1" stopColor={COLORS.primary600} />
          </LinearGradient>
        </Defs>
        <Rect width="390" height="320" fill="url(#hero)" />
      </Svg>
      {/* Las órbitas se mecen unos grados alrededor del centro, como si el planeta tirara de ellas */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '2.5deg'] }) }] },
        ]}
      >
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 320" preserveAspectRatio="xMidYMid slice">
          {[
            { rx: 150, ry: 50, o: 0.18 },
            { rx: 215, ry: 74, o: 0.12 },
            { rx: 290, ry: 100, o: 0.07 },
          ].map((e) => (
            <Ellipse
              key={e.rx}
              cx={195} cy={118} rx={e.rx} ry={e.ry}
              rotation={25} origin="195, 118"
              fill="none" stroke={alpha(COLORS.white, e.o)} strokeWidth={1.5}
            />
          ))}
          <Circle cx={52} cy={70} r={2.5} fill={alpha(COLORS.white, 0.5)} />
          <Circle cx={338} cy={58} r={2} fill={alpha(COLORS.white, 0.4)} />
          <Circle cx={352} cy={188} r={3} fill={alpha(COLORS.white, 0.35)} />
          <Circle cx={36} cy={196} r={2} fill={alpha(COLORS.white, 0.4)} />
        </Svg>
      </Animated.View>
    </>
  );
}

function OptionCard({
  icon,
  title,
  description,
  onPress,
  highlight,
}: {
  icon: IoniconsName;
  title: string;
  description: string;
  onPress: () => void;
  /** La opción más probable para un trabajador: tinte de marca, sin competir con el botón de abajo. */
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={[styles.card, highlight ? styles.cardHighlight : styles.cardPlain]}
    >
      <View style={[styles.iconWrap, highlight ? styles.iconWrapHighlight : styles.iconWrapPlain]}>
        <Ionicons name={icon} size={24} color={highlight ? COLORS.white : COLORS.primary} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={highlight ? COLORS.primary : COLORS.borderStrong} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  hero: {
    minHeight: Math.max(270, height * 0.36),
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  logo: { width: 132, height: 132, marginBottom: -6 },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
    textAlign: 'center',
    marginTop: 4,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    justifyContent: 'space-between',
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.foreground,
    textAlign: 'center',
    marginBottom: 16,
  },
  cards: { gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 92,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  cardHighlight: {
    backgroundColor: COLORS.primaryLight,
    borderColor: alpha(COLORS.primary, 0.45),
  },
  cardPlain: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapHighlight: { backgroundColor: COLORS.primary },
  iconWrapPlain: { backgroundColor: COLORS.primaryLight },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.foreground },
  cardDesc: { fontSize: 13, marginTop: 2, lineHeight: 18, color: COLORS.slate600 },

  footer: { gap: 10, paddingTop: 16 },
  footerText: { fontSize: 14, color: COLORS.mutedForeground, textAlign: 'center' },
});
