import { Text, TextInput } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS, alpha } from '@/lib/designTokens';
import { ContadorCirculo } from '@/components/ui/ContadorCirculo';
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { formatShortDate } from './turnosPestana';

export type ActiveTab = 'mis_turnos' | 'disponibles';

/** Saldo a pagar del período + postulantes pendientes, bajo el título (solo quien gestiona). */
export function ResumenGestor({ totalAPagar, pendientesCount }: { totalAPagar: number; pendientesCount: number }) {
  const router = useRouter();
  return (
    <View className="flex-row gap-2">
      <TouchableOpacity
        onPress={() => router.push('/liquidacion-turnos')}
        activeOpacity={0.8}
        className="flex-1 flex-row items-center justify-between rounded-2xl px-4 py-2.5"
        style={{ backgroundColor: alpha(COLORS.white, 0.18) }}
      >
        <View>
          <Text className="text-[11px] font-medium text-white/80">
            Total a pagar
          </Text>
          <Text className="text-base font-extrabold text-white">
            ${totalAPagar.toLocaleString('es-CO')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/postulaciones')}
        activeOpacity={0.8}
        accessibilityLabel="Ver postulaciones"
        className="items-center justify-center rounded-2xl"
        style={{ backgroundColor: pendientesCount > 0 ? COLORS.warningLight : alpha(COLORS.white, 0.18), minWidth: 68, paddingHorizontal: 12 }}
      >
        <Ionicons name="people" size={18} color={pendientesCount > 0 ? COLORS.warningDark : COLORS.white} />
        <Text
          className="text-[10px] font-bold mt-0.5"
          style={{ color: pendientesCount > 0 ? COLORS.warningDark : COLORS.white }}
        >
          {pendientesCount > 0 ? `${pendientesCount} pend.` : 'Al día'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** FAB — crear turno (única acción flotante; liquidación y postulaciones viven en el header). */
export function FabCrearTurno() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push('/turno/nuevo')}
      activeOpacity={0.85}
      style={{
        position: 'absolute',
        bottom: 24,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      }}
      accessibilityLabel="Crear turno"
    >
      <Ionicons name="add" size={28} color={COLORS.white} />
    </TouchableOpacity>
  );
}

type PeriodoEventual = { estado: string; fecha_fin: string };

/** Banner de turnos eventuales (trabajador_nomina). */
export function BannerEventual({ periodo }: { periodo: PeriodoEventual | undefined }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => periodo && router.push('/liquidacion-eventual')}
      activeOpacity={periodo ? 0.8 : 1}
      disabled={!periodo}
      className="mx-5 mt-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex-row items-center gap-3"
      style={{ opacity: periodo ? 1 : 0.6 }}
    >
      <Ionicons name="briefcase-outline" size={20} color={COLORS.eventual} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-violet-700">Turnos eventuales · Pago trimestral</Text>
        <Text className="text-xs text-violet-500 mt-0.5">
          {periodo
            ? (periodo.estado === 'abierto' ? `Período abierto hasta ${periodo.fecha_fin}` : 'Período liquidado')
            : 'Aún no hay período eventual abierto'}
        </Text>
      </View>
      {periodo && <Ionicons name="chevron-forward-outline" size={16} color={COLORS.eventual} />}
    </TouchableOpacity>
  );
}

/** Selector "Mis Turnos" / "Disponibles" del trabajador. */
export function SelectorTabs({ activeTab, onChange, disponibles = 0 }: { activeTab: ActiveTab; onChange: (t: ActiveTab) => void; /** Ofertas a las que aún puede postularse; se muestra como círculo en "Disponibles". */ disponibles?: number }) {
  return (
    <View className="bg-card flex-row border-b border-border px-6">
      {(['mis_turnos', 'disponibles'] as ActiveTab[]).map((tab) => {
        const label = tab === 'mis_turnos' ? 'Mis Turnos' : 'Disponibles';
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            className={`py-3 mr-6 border-b-2 ${isActive ? 'border-primary-500' : 'border-transparent'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <View className="flex-row items-center gap-1.5">
              <Text className={`text-sm font-semibold ${isActive ? 'text-primary-500' : 'text-muted-foreground'}`}>
                {label}
              </Text>
              {tab === 'disponibles' && <ContadorCirculo n={disponibles} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Aviso de calificación + buscador, encabezado de la lista de ofertas. */
export function EncabezadoOfertas({
  isNomina, hayOfertas, search, onSearch,
}: { isNomina: boolean; hayOfertas: boolean; search: string; onSearch: (s: string) => void }) {
  const router = useRouter();
  return (
    <>
      {!isNomina && (
        <TouchableOpacity
          onPress={() => router.push('/mis-empresas')}
          className="flex-row items-center gap-2 bg-info/10 rounded-xl px-3 py-2 mb-3"
        >
          <Ionicons name="information-circle-outline" size={15} color={COLORS.info} />
          <Text className="text-xs text-info flex-1">
            Ves las ofertas antes o después según tu calificación en cada empresa.
          </Text>
          <Text className="text-xs font-semibold text-info">Ver</Text>
        </TouchableOpacity>
      )}
      {hayOfertas && (
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10 mb-3">
          <Ionicons name="search-outline" size={15} color={COLORS.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            className="flex-1 text-sm text-foreground"
            placeholder="Buscar por empresa, cargo o lugar…"
            placeholderTextColor={COLORS.placeholder}
            value={search}
            onChangeText={onSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
}

export function EmptyMisTurnos({ fecha }: { fecha: string }) {
  return <EmptyState title="Sin turnos este día" message={`No tienes turnos asignados el ${formatShortDate(fecha)}.`} />;
}

export function EmptyOfertas({ fecha, search }: { fecha: string; search: string }) {
  return search.trim() ? (
    <EmptyState variant="search" title="Sin resultados" message={`No hay ofertas que coincidan con "${search}".`} />
  ) : (
    <EmptyState title="Sin ofertas este día" message={`No hay turnos disponibles el ${formatShortDate(fecha)}. Prueba con otra fecha.`} />
  );
}
