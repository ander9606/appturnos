import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { COLORS, alpha } from '@/lib/designTokens';
import React from 'react';
import {
  View,
  Image,
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

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Hero: llega hasta el borde superior (sin franja clara bajo la barra de estado) ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <HeroBackground />

        <Image source={require('../../assets/logo-mark.png')} style={styles.logo} accessibilityLabel="Logo de Zaturno" />
        <Text style={styles.appName}>Zaturno</Text>
        <Text style={styles.appSub}>Turnos y nómina para tu empresa</Text>
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

/** Degradado de marca (naranja → naranja oscuro) con órbitas finas, como las del planeta del logo. */
function HeroBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 320" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="hero" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.primary} />
          <Stop offset="1" stopColor={COLORS.primary600} />
        </LinearGradient>
      </Defs>
      <Rect width="390" height="320" fill="url(#hero)" />
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
