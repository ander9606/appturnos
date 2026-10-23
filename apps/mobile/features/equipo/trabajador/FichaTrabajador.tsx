import { Text } from '@/components/ui/Text';
import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/lib/designTokens';
import { Avatar } from '@/components/ui/Avatar';
import { StarRating } from '@/features/turnos/StarRating';
import { MarcacionSelector } from '@/features/equipo/MarcacionSelector';
import type { Trabajador, PuntoMarcaje } from '@api-client';
import {
  TIPO_LABELS, TIPO_DOC_LABELS, SEXO_LABELS, TIPO_CUENTA_LABELS, fmtFechaCorta,
} from './fichaTrabajador';

export function InfoRow({
  label, value, onCall,
}: {
  label: string;
  value: string | null | undefined;
  /** Si se pasa, muestra un botón de llamar junto al valor (abre el marcador con el número). */
  onCall?: () => void;
}) {
  if (value == null || value === '') return null;
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-border last:border-b-0">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="flex-row items-center gap-2 flex-1 ml-4 justify-end">
        <Text className="text-sm font-medium text-foreground text-right">{value}</Text>
        {onCall && (
          <Pressable
            onPress={onCall}
            hitSlop={8}
            accessibilityLabel={`Llamar a ${label}`}
            className="w-7 h-7 rounded-full bg-success/10 items-center justify-center active:opacity-70"
          >
            <Ionicons name="call" size={14} color={COLORS.success} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function HeroTrabajador({ t }: { t: Trabajador }) {
  return (
    <>
      <View className="items-center pt-8 pb-6 px-4">
        <View className="mb-3">
          <Avatar id={t.id} nombre={t.nombre} apellido={t.apellido} fotoB64={t.foto_perfil} size={80} expandable />
        </View>
        <Text className="text-xl font-bold text-foreground">
          {t.nombre} {t.apellido}
        </Text>
        {t.cargo && (
          <Text className="text-sm text-muted-foreground mt-0.5">{t.cargo}</Text>
        )}
        <View className="flex-row gap-2 mt-2 items-center">
          <View className="bg-primary/10 rounded-full px-3 py-1">
            <Text className="text-primary text-xs font-semibold">
              {TIPO_LABELS[t.tipo] ?? t.tipo}
            </Text>
          </View>
          {!t.activo && (
            <View className="bg-danger/10 rounded-full px-3 py-1">
              <Text className="text-danger text-xs font-semibold">Inactivo</Text>
            </View>
          )}
        </View>
      </View>

      {/* Sobre mí — descripción libre que el trabajador escribe sobre sí mismo */}
      {t.descripcion && (
        <View className="mx-4 mb-3 bg-card rounded-2xl border border-border px-4 py-3.5">
          <Text className="text-xs text-muted-foreground mb-1">Sobre mí</Text>
          <Text className="text-sm text-foreground leading-5">{t.descripcion}</Text>
        </View>
      )}
    </>
  );
}

/** Aviso al admin cuando el trabajador aún no activa su cuenta. */
export function CuentaSinActivarBanner({ t }: { t: Trabajador }) {
  return (
    <View className="mx-4 mb-3 bg-warning/10 border border-warning/30 rounded-2xl p-4 flex-row gap-3">
      <Ionicons name="time-outline" size={20} color={COLORS.warningDark} style={{ marginTop: 1 }} />
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold" style={{ color: COLORS.warningText }}>Cuenta sin activar</Text>
        <Text className="text-xs text-muted-foreground">
          {t.cedula
            ? `Pídele que descargue la app y use "Activar cuenta" con la cédula ${t.cedula}.`
            : 'Pídele que descargue la app y use "Activar cuenta" con su número de cédula.'}
        </Text>
      </View>
    </View>
  );
}

export function DatosPersonalesCard({ t }: { t: Trabajador }) {
  // Los trabajadores 'turnos' no tienen tarifa fija: cobran por turno aceptado (tarifa_dia de la oferta).
  const salarioLabel = t.tipo === 'turnos'
    ? 'Por turno aceptado'
    : t.salario_base != null
    ? `$${Number(t.salario_base).toLocaleString('es-CO')} / mes`
    : t.tarifa_hora != null
    ? `$${Number(t.tarifa_hora).toLocaleString('es-CO')} / hora`
    : 'Sin configurar';

  return (
    <View className="mx-4 bg-card rounded-2xl border border-border px-4">
      <InfoRow label="Cédula"     value={t.cedula} />
      <InfoRow label="Tipo de documento" value={t.tipo_documento ? TIPO_DOC_LABELS[t.tipo_documento] : null} />
      <InfoRow label="Correo"     value={t.email} />
      <InfoRow
        label="Teléfono"
        value={t.telefono}
        onCall={t.telefono ? () => Linking.openURL(`tel:${t.telefono}`) : undefined}
      />
      <InfoRow label="Fecha de nacimiento" value={fmtFechaCorta(t.fecha_nacimiento)} />
      <InfoRow label="Sexo"       value={t.sexo ? SEXO_LABELS[t.sexo] : null} />
      <InfoRow label="Salario"    value={salarioLabel} />
      <InfoRow
        label="Miembro desde"
        value={new Date(t.created_at).toLocaleDateString('es-CO', {
          year: 'numeric', month: 'long', day: 'numeric',
        })}
      />
    </View>
  );
}

/** Contacto de emergencia, dirección y seguridad social/banco/antecedentes (cada bloque solo si hay datos). */
export function DatosAdicionales({ t }: { t: Trabajador }) {
  return (
    <>
      {/* Contacto de emergencia */}
      {(t.contacto_emergencia_nombre || t.contacto_emergencia_tel) && (
        <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4">
          <InfoRow label="Contacto de emergencia" value={t.contacto_emergencia_nombre} />
          <InfoRow
            label="Teléfono de emergencia"
            value={t.contacto_emergencia_tel}
            onCall={t.contacto_emergencia_tel ? () => Linking.openURL(`tel:${t.contacto_emergencia_tel}`) : undefined}
          />
        </View>
      )}

      {/* Dirección — se imprime en el contrato de prestación de servicios, aplica a cualquier tipo */}
      {!!t.direccion && (
        <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4">
          <InfoRow label="Dirección" value={t.direccion} />
        </View>
      )}

      {/* Seguridad social, banco y antecedentes — solo aplica a nómina/ambos */}
      {t.tipo !== 'turnos' && (t.eps || t.afp || t.banco || t.numero_cuenta || t.ant_judiciales_fecha || t.ant_disciplinarios_fecha) && (
        <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4">
          <InfoRow label="EPS"  value={t.eps} />
          <InfoRow label="AFP"  value={t.afp} />
          <InfoRow label="Banco" value={t.banco} />
          <InfoRow label="Tipo de cuenta" value={t.tipo_cuenta ? TIPO_CUENTA_LABELS[t.tipo_cuenta] : null} />
          <InfoRow label="Número de cuenta" value={t.numero_cuenta} />
          <InfoRow label="Antecedentes judiciales" value={fmtFechaCorta(t.ant_judiciales_fecha)} />
          <InfoRow label="Antecedentes disciplinarios" value={fmtFechaCorta(t.ant_disciplinarios_fecha)} />
        </View>
      )}
    </>
  );
}

export function MarcacionCard({ t, puntos }: { t: Trabajador; puntos: PuntoMarcaje[] }) {
  return (
    <View className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 gap-3">
      <Text className="text-sm font-semibold text-foreground">Marcación</Text>
      <MarcacionSelector trabajador={t} puntos={puntos} />
    </View>
  );
}

export function RankingCard({ t }: { t: Trabajador }) {
  return (
    <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4 py-4 flex-row items-center justify-between">
      <Text className="text-sm text-muted-foreground">Calificación promedio</Text>
      {t.total_calificaciones > 0 ? (
        <View className="flex-row items-center gap-2">
          <StarRating mode="display" value={Number(t.ranking)} size="sm" />
          <Text className="text-xs text-muted-foreground">
            ({t.total_calificaciones} {t.total_calificaciones === 1 ? 'turno' : 'turnos'})
          </Text>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground italic">Sin calificaciones aún</Text>
      )}
    </View>
  );
}
