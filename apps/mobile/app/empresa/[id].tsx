/**
 * Detalle y edición de una empresa — panel super_admin.
 * Permite ver métricas, editar campos y cambiar estado activo/inactivo.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useAuthStore } from '@/features/auth/useAuthStore';
import {
  useAdminEmpresa,
  useActualizarEmpresa,
  useCambiarEstadoEmpresa,
  useGenerarLinkPago,
} from '@/features/admin/useAdmin';
import { formatCOP } from '@/lib/formatters';
import { confirm } from '@/lib/confirmDialog';
import type { PlanEmpresa, EmpresaAdmin, LinkPagoResponse } from '@api-client';

const OPCIONES_MESES = [1, 3, 6, 12];

// ── Constants ─────────────────────────────────────────────────────────────

const PLANES: { value: PlanEmpresa; label: string; color: string }[] = [
  { value: 'basico', label: 'Básico', color: '#94A3B8' },
  { value: 'profesional', label: 'Profesional', color: '#3B82F6' },
  { value: 'empresarial', label: 'Empresarial', color: '#8B5CF6' },
];

// ── Sub-components ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <View className="flex-row justify-between items-center py-2.5 border-b border-border">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value ?? '—'}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  disabled,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address';
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Text>
      <TextInput
        className={[
          'bg-background border rounded-xl px-3 h-11 text-sm text-foreground',
          disabled ? 'border-border opacity-50' : 'border-border',
        ].join(' ')}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        editable={!disabled}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function EmpresaDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const empresaId = Number(id);

  const isSuperAdmin = useAuthStore((s) => s.usuario?.rol === 'super_admin');
  const { data: empresa, isLoading, isError } = useAdminEmpresa(empresaId, isSuperAdmin);
  const { mutateAsync: actualizar, isPending: guardando } = useActualizarEmpresa(empresaId);
  const { mutateAsync: cambiarEstado, isPending: cambiandoEstado } = useCambiarEstadoEmpresa();
  const { mutateAsync: generarLink, isPending: generandoLink } = useGenerarLinkPago(empresaId);

  const [mesesLink, setMesesLink] = useState(1);
  const [linkGenerado, setLinkGenerado] = useState<LinkPagoResponse | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [plan, setPlan] = useState<PlanEmpresa>('basico');
  const [descripcion, setDescripcion] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [aceptaPostulaciones, setAceptaPostulaciones] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Sync form with fetched data
  useEffect(() => {
    if (empresa) {
      setNombre(empresa.nombre);
      setNit(empresa.nit ?? '');
      setCiudad(empresa.ciudad ?? '');
      setPlan(empresa.plan);
      setDescripcion(empresa.descripcion ?? '');
      setLogoUrl(empresa.logo_url ?? '');
      setAceptaPostulaciones(empresa.acepta_postulaciones === 1);
    }
  }, [empresa]);

  const handleGuardar = async () => {
    try {
      await actualizar({
        nombre,
        nit: nit || null,
        ciudad: ciudad || null,
        plan,
        descripcion: descripcion || null,
        logo_url: logoUrl || null,
        acepta_postulaciones: aceptaPostulaciones,
      });
      setEditMode(false);
      Alert.alert('✅', 'Empresa actualizada correctamente.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      Alert.alert('Error', msg);
    }
  };

  const handleCambiarEstado = async () => {
    if (!empresa) return;
    const nuevaAccion = empresa.activo === 1 ? 'desactivar' : 'activar';
    const label = nuevaAccion.charAt(0).toUpperCase() + nuevaAccion.slice(1);
    const ok = await confirm({
      title: `¿${label} empresa?`,
      message: `La empresa "${empresa.nombre}" será ${nuevaAccion === 'activar' ? 'activada' : 'desactivada'}.`,
      confirmLabel: label,
      destructive: nuevaAccion === 'desactivar',
    });
    if (!ok) return;
    try {
      await cambiarEstado({ id: empresaId, activo: empresa.activo !== 1 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      Alert.alert('Error', msg);
    }
  };

  const handleGenerarLink = async () => {
    if (!empresa) return;
    setLinkGenerado(null);
    try {
      const resultado = await generarLink({ plan: empresa.plan, meses: mesesLink });
      setLinkGenerado(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar el link';
      Alert.alert('Error', msg);
    }
  };

  const handleCopiarLink = async () => {
    if (!linkGenerado) return;
    await Clipboard.setStringAsync(linkGenerado.url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-muted-foreground mt-3 text-sm">Cargando empresa…</Text>
      </SafeAreaView>
    );
  }

  if (isError || !empresa) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-2 px-8">
        <Text className="text-3xl">⚠️</Text>
        <Text className="text-foreground font-semibold text-lg text-center">
          No se encontró la empresa
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary text-sm font-semibold mt-2">← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isActiva = empresa.activo === 1;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View
        className="px-4 pt-3 pb-5 flex-row items-center justify-between"
        style={{ backgroundColor: '#6366F1' }}
      >
        <Pressable onPress={() => router.back()} className="mr-3">
          <Text className="text-white text-base">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold" numberOfLines={1}>
            {empresa.nombre}
          </Text>
          <Text className="text-white/70 text-xs">{empresa.slug}</Text>
        </View>
        {editMode ? (
          <Pressable
            onPress={() => setEditMode(false)}
            className="bg-white/20 rounded-xl px-3 py-1.5"
          >
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setEditMode(true)}
            className="bg-white/20 rounded-xl px-3 py-1.5"
          >
            <Text className="text-white text-xs font-semibold">✏️ Editar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
      >
        {/* ── Estado y plan ──────────────────────────────────────────── */}
        <View className="flex-row mx-4 gap-3 mb-4">
          {/* Estado badge */}
          <View
            className="flex-1 rounded-2xl p-3 border items-center gap-1"
            style={{
              backgroundColor: isActiva ? '#22C55E10' : '#EF444410',
              borderColor: isActiva ? '#22C55E40' : '#EF444440',
            }}
          >
            <Text className="text-2xl">{isActiva ? '✅' : '⛔'}</Text>
            <Text
              className="text-xs font-bold"
              style={{ color: isActiva ? '#16A34A' : '#DC2626' }}
            >
              {isActiva ? 'ACTIVA' : 'INACTIVA'}
            </Text>
          </View>

          {/* Plan badge */}
          {(() => {
            const planInfo = PLANES.find((p) => p.value === empresa.plan)!;
            return (
              <View
                className="flex-1 rounded-2xl p-3 border items-center gap-1"
                style={{
                  backgroundColor: planInfo.color + '10',
                  borderColor: planInfo.color + '40',
                }}
              >
                <Text className="text-2xl">⭐</Text>
                <Text
                  className="text-xs font-bold"
                  style={{ color: planInfo.color }}
                >
                  {planInfo.label.toUpperCase()}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* ── Métricas ───────────────────────────────────────────────── */}
        <View className="mx-4 bg-card border border-border rounded-2xl px-4 py-2 mb-4">
          <Text className="text-sm font-bold text-foreground py-2 border-b border-border mb-1">
            📊 Métricas
          </Text>
          <InfoRow label="Trabajadores" value={empresa.total_trabajadores} />
          <InfoRow label="· Turnos" value={empresa.trabajadores_turnos} />
          <InfoRow label="· Nómina" value={empresa.trabajadores_nomina} />
          <InfoRow label="· Ambos" value={empresa.trabajadores_ambos} />
          <InfoRow label="Usuarios con acceso" value={empresa.total_usuarios} />
          {empresa.total_ofertas !== undefined && (
            <InfoRow label="Ofertas de turno" value={empresa.total_ofertas} />
          )}
          {empresa.total_periodos !== undefined && (
            <InfoRow label="Períodos de nómina" value={empresa.total_periodos} />
          )}
          <InfoRow
            label="Creada"
            value={new Date(empresa.created_at).toLocaleDateString('es-CO', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          />
        </View>

        {/* ── Suscripción ────────────────────────────────────────────── */}
        <View className="mx-4 bg-card border border-border rounded-2xl px-4 py-2 mb-4">
          <Text className="text-sm font-bold text-foreground py-2 border-b border-border mb-1">
            💳 Suscripción
          </Text>
          <InfoRow
            label="logiq360"
            value={empresa.logiq360_conectado ? 'Conectado (no paga)' : 'No conectado'}
          />
          <InfoRow
            label="Origen del pago"
            value={
              empresa.suscripcion_origen === 'wompi' ? 'Directo (Wompi)'
              : empresa.suscripcion_origen === 'logiq360' ? 'logiq360'
              : 'Manual'
            }
          />
          <InfoRow
            label="Vigente hasta"
            value={
              empresa.suscripcion_vigente_hasta
                ? new Date(`${empresa.suscripcion_vigente_hasta}T00:00:00`).toLocaleDateString('es-CO', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : 'Indefinida'
            }
          />
        </View>

        {/* ── Generar link de pago ─────────────────────────────────────── */}
        <View className="mx-4 bg-card border border-border rounded-2xl p-4 gap-3 mb-4">
          <Text className="text-sm font-bold text-foreground">🔗 Generar link de pago</Text>
          <Text className="text-xs text-muted-foreground -mt-1">
            El sistema envía esto automático al vencer la suscripción. Úsalo solo si necesitas
            reenviarlo o regenerarlo a mano.
          </Text>

          <View className="flex-row gap-2">
            {OPCIONES_MESES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMesesLink(m)}
                className="flex-1 rounded-xl border py-2 items-center"
                style={{
                  borderColor: mesesLink === m ? '#6366F1' : '#E2E8F0',
                  backgroundColor: mesesLink === m ? '#6366F120' : 'transparent',
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: mesesLink === m ? '#6366F1' : '#94A3B8' }}
                >
                  {m} mes{m > 1 ? 'es' : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleGenerarLink}
            disabled={generandoLink}
            className="h-11 rounded-xl items-center justify-center active:opacity-80"
            style={{ backgroundColor: '#6366F1' }}
          >
            {generandoLink ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white text-sm font-bold">Generar link</Text>
            )}
          </Pressable>

          {linkGenerado && (
            <View className="bg-background border border-border rounded-xl p-3 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-foreground">
                  {formatCOP(linkGenerado.monto_cop)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Expira {new Date(linkGenerado.expira_at).toLocaleDateString('es-CO', {
                    day: 'numeric', month: 'short',
                  })}
                </Text>
              </View>
              <Text className="text-xs text-foreground" numberOfLines={2}>
                {linkGenerado.url}
              </Text>
              <Pressable
                onPress={handleCopiarLink}
                className="h-10 rounded-lg items-center justify-center border active:opacity-70"
                style={{ borderColor: linkCopiado ? '#16A34A' : '#6366F1' }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: linkCopiado ? '#16A34A' : '#6366F1' }}
                >
                  {linkCopiado ? '✓ Copiado' : '📋 Copiar link'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Formulario de edición ──────────────────────────────────── */}
        <View className="mx-4 bg-card border border-border rounded-2xl p-4 gap-4 mb-4">
          <Text className="text-sm font-bold text-foreground">
            {editMode ? '✏️ Editando empresa' : '📝 Información'}
          </Text>

          <Field
            label="Nombre"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre de la empresa"
            disabled={!editMode}
          />
          <Field
            label="NIT"
            value={nit}
            onChangeText={setNit}
            placeholder="ej. 900123456-1"
            disabled={!editMode}
          />
          <Field
            label="Ciudad"
            value={ciudad}
            onChangeText={setCiudad}
            placeholder="ej. Bogotá"
            disabled={!editMode}
          />
          <Field
            label="Logo URL"
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://…"
            disabled={!editMode}
            keyboardType="url"
          />
          <Field
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Descripción breve"
            disabled={!editMode}
          />

          {/* Acepta postulaciones toggle */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Acepta postulaciones</Text>
              <Text className="text-xs text-muted-foreground">
                Aparece en el directorio de empleadores
              </Text>
            </View>
            <Switch
              value={aceptaPostulaciones}
              onValueChange={setAceptaPostulaciones}
              disabled={!editMode}
              trackColor={{ false: '#E2E8F0', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {editMode && (
            <Pressable
              onPress={handleGuardar}
              disabled={guardando}
              className="h-11 rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: '#6366F1' }}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white text-sm font-bold">Guardar cambios</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* ── Zona peligrosa ─────────────────────────────────────────── */}
        <View className="mx-4 border border-danger/30 rounded-2xl p-4 gap-3">
          <Text className="text-sm font-bold text-danger">⚠️ Zona de riesgo</Text>
          <Pressable
            onPress={handleCambiarEstado}
            disabled={cambiandoEstado}
            className="h-11 rounded-xl items-center justify-center border active:opacity-80"
            style={{
              borderColor: isActiva ? '#EF4444' : '#22C55E',
              backgroundColor: isActiva ? '#EF444410' : '#22C55E10',
            }}
          >
            {cambiandoEstado ? (
              <ActivityIndicator size="small" color={isActiva ? '#EF4444' : '#22C55E'} />
            ) : (
              <Text
                className="text-sm font-bold"
                style={{ color: isActiva ? '#EF4444' : '#22C55E' }}
              >
                {isActiva ? '⛔ Desactivar empresa' : '✅ Activar empresa'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
