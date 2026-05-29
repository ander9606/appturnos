/**
 * Layout del panel de super_admin.
 * Tabs: Dashboard, Empresas, Reportes.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name.replace('-outline', '') as IoniconsName : name}
      size={22}
      color={focused ? '#6366F1' : '#94A3B8'}
    />
  );
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
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
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="grid-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="empresas"
        options={{
          title: 'Empresas',
          tabBarIcon: ({ focused }) => <TabIcon name="business-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
