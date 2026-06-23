import React from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      {/* ── Hero ── */}
      <View style={styles.hero}>
        {/* Círculos decorativos */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />

        {/* Logo */}
        <View style={styles.logoBox}>
          <Ionicons name="calendar" size={44} color="white" />
        </View>

        <Text style={styles.appName}>AppTurnos</Text>
        <Text style={styles.appSub}>Gestión de turnos y nómina{'\n'}para tu empresa</Text>

        {/* Indicadores */}
        <View style={styles.dots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* ── Contenido ── */}
      <View style={styles.content}>
        <Text style={styles.question}>¿Cómo quieres continuar?</Text>

        <View style={styles.cards}>
          <OptionCard
            icon="person"
            title="Soy trabajador"
            description="Activa tu cuenta o inicia sesión para ver tus turnos y nómina"
            onPress={() => router.push('/(auth)/activar')}
            variant="filled"
          />
          <OptionCard
            icon="briefcase"
            title="Tengo una empresa"
            description="Registra tu empresa o inicia sesión como administrador"
            onPress={() => router.push('/(auth)/registro-empresa')}
            variant="outline"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>Iniciar sesión →</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function OptionCard({
  icon,
  title,
  description,
  onPress,
  variant,
}: {
  icon: IoniconsName;
  title: string;
  description: string;
  onPress: () => void;
  variant: 'filled' | 'outline';
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        filled ? styles.cardFilled : styles.cardOutline,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, filled ? styles.iconWrapFilled : styles.iconWrapOutline]}>
        <Ionicons name={icon} size={26} color={filled ? 'white' : '#FF5A3C'} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: filled ? 'white' : '#0F172A' }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: filled ? 'rgba(255,255,255,0.76)' : '#64748B' }]}>
          {description}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={filled ? 'rgba(255,255,255,0.6)' : '#CBD5E1'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  hero: {
    minHeight: height * 0.46,
    backgroundColor: '#FF5A3C',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 44,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -90,
    right: -70,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 10,
    left: -60,
  },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 22, backgroundColor: 'white' },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 16,
  },
  cards: { gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 20,
  },
  cardFilled: {
    backgroundColor: '#FF5A3C',
    shadowColor: '#FF5A3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  cardOutline: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapFilled: { backgroundColor: 'rgba(255,255,255,0.22)' },
  iconWrapOutline: { backgroundColor: '#FFF1EE' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 13, marginTop: 3, lineHeight: 18 },

  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },

  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: { fontSize: 14, color: '#94A3B8' },
  footerLink: { fontSize: 15, fontWeight: '700', color: '#FF5A3C', marginTop: 4 },
});
