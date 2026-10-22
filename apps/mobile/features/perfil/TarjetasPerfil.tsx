import React from 'react';
import { View } from 'react-native';
import { t } from '@/lib/i18n';
import {
  type Acceso,
  ACCESOS_TRABAJADOR_TURNOS, ACCESOS_JEFE_TURNOS, ACCESOS_GESTOR_NOMINA, ACCESOS_ADMIN,
  ACCESO_AUSENCIAS, ACCESOS_CONTRATOS_TURNOS, ACCESOS_LEGAL,
} from './accesos';
import { CardRow, FilaAcceso, ROL_LABELS, SectionHeader } from './PerfilUi';

function Filas({ accesos, primera = false }: { accesos: Acceso[]; primera?: boolean }) {
  return (
    <>
      {accesos.map((a, i) => (
        <FilaAcceso key={a.label} icon={a.icon} label={a.label} route={a.route} boton={a.boton} primera={primera && i === 0} />
      ))}
    </>
  );
}

const TARJETA = 'mx-5 bg-card rounded-2xl border border-border overflow-hidden';

/** Tarjeta "Cuenta": el rol y los accesos rápidos de ese rol. */
export function CuentaCard({ rol }: { rol: string | undefined }) {
  const isTrabajadorTurnos = rol === 'trabajador_turnos';
  const isJefeTurnos       = rol === 'jefe_turnos';
  const isAdmin            = rol === 'admin_empresa';
  const isGestorNomina     = rol === 'jefe_nomina' || rol === 'nomina';

  return (
    <>
      <SectionHeader title={t('perfil.cuenta')} />

      <View className={TARJETA}>
        {/* trabajador_nomina no agrega filas en esta tarjeta — "Rol" queda como última fila para ese rol */}
        <CardRow label={t('perfil.rol')} value={ROL_LABELS[rol ?? ''] ?? (rol ?? '—')} last={!isTrabajadorTurnos && !isJefeTurnos && !isAdmin && !isGestorNomina} />
        {isTrabajadorTurnos && <Filas accesos={ACCESOS_TRABAJADOR_TURNOS} />}
        {isJefeTurnos && <Filas accesos={ACCESOS_JEFE_TURNOS} />}
        {isGestorNomina && <Filas accesos={ACCESOS_GESTOR_NOMINA} />}
        {isAdmin && <Filas accesos={ACCESOS_ADMIN} />}
      </View>
    </>
  );
}

/** Ausencias (y, para el trabajador de turnos, contratos y cuentas de cobro). */
export function AusenciasCard({ isTrabajadorTurnos }: { isTrabajadorTurnos: boolean }) {
  return (
    <>
      <SectionHeader title={isTrabajadorTurnos ? 'Ausencias, contratos y cuentas de cobro' : 'Ausencias y contratos'} />
      <View className={TARJETA}>
        <Filas accesos={[ACCESO_AUSENCIAS]} primera />
        {isTrabajadorTurnos && <Filas accesos={ACCESOS_CONTRATOS_TURNOS} />}
      </View>
    </>
  );
}

export function LegalCard() {
  return (
    <>
      <SectionHeader title="Legal" />
      <View className={TARJETA}>
        <Filas accesos={ACCESOS_LEGAL} primera />
      </View>
    </>
  );
}
