import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { t } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { THEME_COLORS } from '@/lib/designTokens';
import { useNominaPerfil } from '@/features/nomina/useNomina';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, color }: { name: IoniconsName; focused: boolean; color: string }) {
  return (
    <Ionicons
      name={focused ? name.replace('-outline', '') as IoniconsName : name}
      size={22}
      color={color}
    />
  );
}

export default function TabsLayout() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  const isWorker      = rol === 'trabajador_turnos';
  const isNomina      = rol === 'trabajador_nomina';
  const primaryColor  = isNomina ? THEME_COLORS.nomina.primary : THEME_COLORS.turnos.primary;
  const nominaLabel   = rol === 'trabajador_turnos' ? t('tabs.quincena') : t('tabs.nomina');

  const { data: nominaPerfil } = useNominaPerfil();
  const aceptaExtras = isNomina ? Boolean(nominaPerfil?.acepta_extras) : false;
  const turnosTabHref = isNomina
    ? (aceptaExtras ? undefined : null)   // show only if acepta_extras
    : (isWorker ? undefined : undefined); // always show for others
  const turnosLabel = isNomina && aceptaExtras ? 'Extras' : t('tabs.turnos');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="home-outline" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="turnos"
        options={{
          title: turnosLabel,
          href: turnosTabHref,
          tabBarIcon: ({ focused, color }) => <TabIcon name="calendar-outline" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nomina"
        options={{
          title: nominaLabel,
          tabBarIcon: ({ focused, color }) => <TabIcon name="wallet-outline" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="empresas"
        options={{
          title: t('tabs.empresas'),
          href: isWorker && !isNomina ? undefined : null,
          tabBarIcon: ({ focused, color }) => <TabIcon name="business-outline" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="equipo"
        options={{
          title: t('tabs.equipo'),
          href: isWorker ? null : undefined,
          tabBarIcon: ({ focused, color }) => <TabIcon name="people-outline" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: t('tabs.perfil'),
          tabBarIcon: ({ focused, color }) => <TabIcon name="person-outline" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
