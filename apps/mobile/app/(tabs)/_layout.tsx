import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { t } from '@/lib/i18n';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  focused,
}: {
  name: IoniconsName;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name.replace('-outline', '') as IoniconsName : name}
      size={22}
      color={focused ? '#FF5A3C' : '#94A3B8'}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF5A3C',
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
          tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="turnos"
        options={{
          title: t('tabs.turnos'),
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="nomina"
        options={{
          title: t('tabs.nomina'),
          tabBarIcon: ({ focused }) => <TabIcon name="wallet-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="equipo"
        options={{
          title: t('tabs.equipo'),
          tabBarIcon: ({ focused }) => <TabIcon name="people-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: t('tabs.perfil'),
          tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
