/**
 * Mi perfil laboral — trabajador_turnos
 *
 * Permite al trabajador ver y actualizar sus datos laborales:
 * identificación, información personal, seguridad social,
 * datos bancarios y contacto de emergencia.
 */
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  usePerfilLaboral,
  useUpdatePerfilLaboral,
  useCrearExperiencia,
  useEliminarExperiencia,
  useCrearDiploma,
  useEliminarDiploma,
} from '@/features/equipo/perfil/usePerfilLaboral';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoRow }        from '@/components/ui/InfoRow';
import type { TipoDocumento, SexoTrabajador, TipoCuenta, Experiencia, Diploma } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { confirm } from '@/lib/confirmDialog';
import { showToast } from '@/lib/toast';
import { isValidISODate } from '@/lib/dateValidation';
import { bogotaToday } from '@/lib/formatters';
import { MiniField, DateField, PillRow, FieldInput } from '@/features/equipo/perfil/campos';
import { fmtFecha, fmtFechaCorta } from '@/features/equipo/perfil/fechasPerfil';
import { type FormState, buildForm, EMPTY_EXP, EMPTY_DIP } from '@/features/equipo/perfil/perfilForm';

// ── Screen ────────────────────────────────────────────────────────────────

export default function MiPerfilLaboralScreen() {
  const rol      = useAuthStore((s) => s.usuario?.rol);
  const isNomina = rol === 'trabajador_nomina';

  const { data: perfil, isLoading } = usePerfilLaboral();
  const update       = useUpdatePerfilLaboral();
  const crearExp     = useCrearExperiencia();
  const eliminarExp  = useEliminarExperiencia();
  const crearDip     = useCrearDiploma();
  const eliminarDip  = useEliminarDiploma();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildForm(undefined));

  // Estado para los formularios inline de experiencia y diploma
  const [showAddExp, setShowAddExp] = useState(false);
  const [newExp, setNewExp] = useState(EMPTY_EXP);
  const [showAddDip, setShowAddDip] = useState(false);
  const [newDip, setNewDip] = useState(EMPTY_DIP);

  useEffect(() => {
    if (perfil) setForm(buildForm(perfil));
  }, [perfil]);

  const set = <K extends keyof FormState>(key: K) =>
    (val: FormState[K]) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const fechas: [string, string][] = [
      [form.fecha_nacimiento, 'Fecha de nacimiento'],
      [form.ant_judiciales_fecha, 'Fecha de antecedentes judiciales'],
      [form.ant_disciplinarios_fecha, 'Fecha de antecedentes disciplinarios'],
    ];
    for (const [valor, label] of fechas) {
      if (valor && (!isValidISODate(valor) || valor > bogotaToday())) {
        showAlert('Fecha inválida', `${label} debe tener formato AAAA-MM-DD y no puede ser futura.`, 'warning');
        return;
      }
    }
    try {
      await update.mutateAsync({
        tipo_documento:             form.tipo_documento || undefined,
        cedula:                     form.cedula || undefined,
        fecha_nacimiento:           form.fecha_nacimiento || undefined,
        sexo:                       (form.sexo as SexoTrabajador) || undefined,
        telefono:                   form.telefono || undefined,
        descripcion:                form.descripcion || undefined,
        direccion:                  form.direccion || undefined,
        eps:                        form.eps || undefined,
        afp:                        form.afp || undefined,
        banco:                      form.banco || undefined,
        tipo_cuenta:                (form.tipo_cuenta as TipoCuenta) || undefined,
        numero_cuenta:              form.numero_cuenta || undefined,
        contacto_emergencia_nombre: form.contacto_emergencia_nombre || undefined,
        contacto_emergencia_tel:    form.contacto_emergencia_tel || undefined,
        ant_judiciales_fecha:       form.ant_judiciales_fecha || undefined,
        ant_disciplinarios_fecha:   form.ant_disciplinarios_fecha || undefined,
      });
      setEditing(false);
      showToast('Perfil actualizado correctamente.');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Error al guardar';
      showAlert('Error', msg);
    }
  };

  const handleCancel = () => {
    if (perfil) setForm(buildForm(perfil));
    setEditing(false);
  };

  const handleAddExperiencia = async () => {
    if (!newExp.empresa_nombre || !newExp.cargo || !newExp.fecha_inicio) {
      showAlert('Campos requeridos', 'Empresa, cargo y fecha de inicio son obligatorios', 'warning');
      return;
    }
    if (!isValidISODate(newExp.fecha_inicio)) {
      showAlert('Fecha inválida', 'La fecha de inicio debe tener formato AAAA-MM-DD.', 'warning');
      return;
    }
    if (newExp.fecha_fin && (!isValidISODate(newExp.fecha_fin) || newExp.fecha_fin < newExp.fecha_inicio)) {
      showAlert('Fecha inválida', 'La fecha de fin debe ser AAAA-MM-DD y no puede ser antes que la de inicio.', 'warning');
      return;
    }
    try {
      await crearExp.mutateAsync({
        empresa_nombre: newExp.empresa_nombre,
        cargo: newExp.cargo,
        fecha_inicio: newExp.fecha_inicio,
        fecha_fin: newExp.fecha_fin || null,
      });
      setNewExp(EMPTY_EXP);
      setShowAddExp(false);
    } catch {
      showAlert('Error', 'No se pudo guardar la experiencia');
    }
  };

  const handleDeleteExperiencia = async (id: number) => {
    const ok = await confirm({ title: 'Eliminar experiencia', message: '¿Estás seguro?', confirmLabel: 'Eliminar', destructive: true });
    if (ok) eliminarExp.mutate(id);
  };

  const handleAddDiploma = async () => {
    if (!newDip.titulo || !newDip.institucion) {
      showAlert('Campos requeridos', 'Título e institución son obligatorios', 'warning');
      return;
    }
    try {
      await crearDip.mutateAsync({
        titulo: newDip.titulo,
        institucion: newDip.institucion,
        anio: newDip.anio ? Number(newDip.anio) : null,
      });
      setNewDip(EMPTY_DIP);
      setShowAddDip(false);
    } catch {
      showAlert('Error', 'No se pudo guardar el diploma');
    }
  };

  const handleDeleteDiploma = async (id: number) => {
    const ok = await confirm({ title: 'Eliminar diploma', message: '¿Estás seguro?', confirmLabel: 'Eliminar', destructive: true });
    if (ok) eliminarDip.mutate(id);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
        <SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
        <Ionicons name="person-outline" size={48} color={COLORS.placeholder} />
        <Text className="text-base font-semibold text-foreground mt-4 text-center">
          Perfil no encontrado
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-1">
          Tu perfil laboral aún no ha sido creado por la empresa.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Identificación ─────────────────────────────────────── */}
          <SectionHeader title="Identificación" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <PillRow
                  label="Tipo de documento"
                  options={['CC', 'CE', 'PAS'] as TipoDocumento[]}
                  value={form.tipo_documento}
                  onChange={set('tipo_documento')}
                  labels={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }}
                />
                <FieldInput
                  label="Número de documento"
                  value={form.cedula}
                  onChangeText={set('cedula')}
                  keyboardType="numeric"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow
                  label="Tipo doc."
                  value={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }[perfil.tipo_documento ?? 'CC']}
                />
                <InfoRow label="Documento" value={perfil.cedula} last />
              </>
            )}
          </View>

          {/* ── Información personal ────────────────────────────────── */}
          <SectionHeader title="Información personal" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <DateField
                  label="Fecha de nacimiento"
                  value={form.fecha_nacimiento}
                  onChange={set('fecha_nacimiento')}
                  maximumDate={new Date()}
                />
                <PillRow
                  label="Sexo"
                  options={['M', 'F', 'otro'] as SexoTrabajador[]}
                  value={form.sexo as SexoTrabajador}
                  onChange={set('sexo')}
                  labels={{ M: 'Masculino', F: 'Femenino', otro: 'Otro' }}
                />
                <FieldInput
                  label="Teléfono"
                  value={form.telefono}
                  onChangeText={set('telefono')}
                  keyboardType="phone-pad"
                />
                <FieldInput
                  label="Dirección"
                  value={form.direccion}
                  onChangeText={set('direccion')}
                  placeholder="Se imprime en tu contrato de prestación de servicios"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Nacimiento" value={fmtFecha(perfil.fecha_nacimiento)} />
                <InfoRow
                  label="Sexo"
                  value={
                    perfil.sexo
                      ? ({ M: 'Masculino', F: 'Femenino', otro: 'Otro' } as Record<string, string>)[perfil.sexo]
                      : null
                  }
                />
                <InfoRow label="Teléfono" value={perfil.telefono} />
                <InfoRow label="Dirección" value={perfil.direccion} last />
              </>
            )}
          </View>

          {/* ── Sobre mí ────────────────────────────────────────────── */}
          <SectionHeader title="Sobre mí" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <FieldInput
                label="Descripción"
                value={form.descripcion}
                onChangeText={set('descripcion')}
                placeholder="Cuéntale a las empresas qué sabes hacer, tu experiencia y tus fortalezas…"
                multiline
                maxLength={500}
                last
              />
            ) : (
              <View className="px-5 py-3.5 bg-card">
                <Text className="text-xs text-muted-foreground mb-1">Descripción</Text>
                <Text className="text-sm text-foreground leading-5">
                  {perfil.descripcion || 'Aún no has escrito una descripción de tu perfil.'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Seguridad social ────────────────────────────────────── */}
          <SectionHeader title="Seguridad social" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput label="EPS" value={form.eps} onChangeText={set('eps')} />
                <FieldInput label="AFP / Fondo de pensión" value={form.afp} onChangeText={set('afp')} last />
              </>
            ) : (
              <>
                <InfoRow label="EPS" value={perfil.eps} />
                <InfoRow label="AFP" value={perfil.afp} last />
              </>
            )}
          </View>

          {/* ── Datos bancarios ─────────────────────────────────────── */}
          <SectionHeader title="Datos bancarios" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput label="Banco" value={form.banco} onChangeText={set('banco')} />
                <PillRow
                  label="Tipo de cuenta"
                  options={['ahorros', 'corriente'] as TipoCuenta[]}
                  value={form.tipo_cuenta as TipoCuenta}
                  onChange={set('tipo_cuenta')}
                  labels={{ ahorros: 'Ahorros', corriente: 'Corriente' }}
                />
                <FieldInput
                  label="Número de cuenta"
                  value={form.numero_cuenta}
                  onChangeText={set('numero_cuenta')}
                  keyboardType="numeric"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Banco" value={perfil.banco} />
                <InfoRow
                  label="Tipo"
                  value={perfil.tipo_cuenta
                    ? perfil.tipo_cuenta.charAt(0).toUpperCase() + perfil.tipo_cuenta.slice(1)
                    : null}
                />
                <InfoRow label="Cuenta" value={perfil.numero_cuenta} last />
              </>
            )}
          </View>

          {/* ── Contacto de emergencia ──────────────────────────────── */}
          <SectionHeader title="Contacto de emergencia" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput
                  label="Nombre"
                  value={form.contacto_emergencia_nombre}
                  onChangeText={set('contacto_emergencia_nombre')}
                />
                <FieldInput
                  label="Teléfono"
                  value={form.contacto_emergencia_tel}
                  onChangeText={set('contacto_emergencia_tel')}
                  keyboardType="phone-pad"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Nombre" value={perfil.contacto_emergencia_nombre} />
                <InfoRow label="Teléfono" value={perfil.contacto_emergencia_tel} last />
              </>
            )}
          </View>

          {/* ── Antecedentes ─────────────────────────────────────────── */}
          <SectionHeader title="Certificados de antecedentes" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <DateField
                  label="Antecedentes judiciales"
                  value={form.ant_judiciales_fecha}
                  onChange={set('ant_judiciales_fecha')}
                  maximumDate={new Date()}
                />
                <DateField
                  label="Antecedentes disciplinarios"
                  value={form.ant_disciplinarios_fecha}
                  onChange={set('ant_disciplinarios_fecha')}
                  maximumDate={new Date()}
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Judiciales" value={fmtFecha(perfil.ant_judiciales_fecha)} />
                <InfoRow label="Disciplinarios" value={fmtFecha(perfil.ant_disciplinarios_fecha)} last />
              </>
            )}
          </View>

          {/* ── Experiencia / Diplomas / Cargos (solo marketplace) ───── */}
          {!isNomina && (
          <>
          <SectionHeader title="Experiencia laboral" count={perfil.experiencias?.length} />
          <View className="mx-5 gap-3">
            {(perfil.experiencias ?? []).map((exp: Experiencia) => (
              <View key={exp.id} className="bg-card rounded-2xl border border-border px-4 py-3 flex-row items-start gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-foreground">{exp.empresa_nombre}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{exp.cargo}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {fmtFechaCorta(exp.fecha_inicio)}
                    {' – '}
                    {exp.fecha_fin ? fmtFechaCorta(exp.fecha_fin) : 'actualidad'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteExperiencia(exp.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {showAddExp ? (
              <View className="bg-card rounded-2xl border border-primary-200 p-4 gap-3">
                <MiniField label="Empresa" value={newExp.empresa_nombre} onChangeText={(v) => setNewExp((p) => ({ ...p, empresa_nombre: v }))} />
                <MiniField label="Cargo" value={newExp.cargo} onChangeText={(v) => setNewExp((p) => ({ ...p, cargo: v }))} />
                <DateField
                  compact
                  label="Fecha inicio"
                  value={newExp.fecha_inicio}
                  onChange={(v) => setNewExp((p) => ({ ...p, fecha_inicio: v }))}
                  maximumDate={new Date()}
                />
                <DateField
                  compact
                  label="Fecha fin (dejar vacío si actual)"
                  value={newExp.fecha_fin}
                  onChange={(v) => setNewExp((p) => ({ ...p, fecha_fin: v }))}
                  minimumDate={newExp.fecha_inicio ? new Date(`${newExp.fecha_inicio}T00:00:00`) : undefined}
                  maximumDate={new Date()}
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => { setShowAddExp(false); setNewExp(EMPTY_EXP); }}
                    className="flex-1 h-9 rounded-xl border border-border items-center justify-center"
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddExperiencia}
                    disabled={crearExp.isPending}
                    className="flex-1 h-9 rounded-xl bg-primary-500 items-center justify-center active:opacity-80"
                  >
                    {crearExp.isPending
                      ? <Spinner size="small" color={COLORS.white} />
                      : <Text className="text-xs font-semibold text-white">Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowAddExp(true)}
                className="h-11 rounded-2xl border border-dashed border-border items-center justify-center flex-row gap-2 active:opacity-70"
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-muted-foreground">Agregar experiencia</Text>
              </TouchableOpacity>
            )}
          </View>

          <SectionHeader title="Diplomas y certificados" count={perfil.diplomas?.length} />
          <View className="mx-5 gap-3">
            {(perfil.diplomas ?? []).map((dip: Diploma) => (
              <View key={dip.id} className="bg-card rounded-2xl border border-border px-4 py-3 flex-row items-start gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-foreground">{dip.titulo}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{dip.institucion}</Text>
                  {dip.anio && (
                    <Text className="text-xs text-muted-foreground mt-0.5">{dip.anio}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteDiploma(dip.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {showAddDip ? (
              <View className="bg-card rounded-2xl border border-primary-200 p-4 gap-3">
                <MiniField label="Título / Certificado" value={newDip.titulo} onChangeText={(v) => setNewDip((p) => ({ ...p, titulo: v }))} />
                <MiniField label="Institución" value={newDip.institucion} onChangeText={(v) => setNewDip((p) => ({ ...p, institucion: v }))} />
                <MiniField label="Año (opcional)" value={newDip.anio} onChangeText={(v) => setNewDip((p) => ({ ...p, anio: v }))} keyboardType="numeric" placeholder="2023" />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => { setShowAddDip(false); setNewDip(EMPTY_DIP); }}
                    className="flex-1 h-9 rounded-xl border border-border items-center justify-center"
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddDiploma}
                    disabled={crearDip.isPending}
                    className="flex-1 h-9 rounded-xl bg-primary-500 items-center justify-center active:opacity-80"
                  >
                    {crearDip.isPending
                      ? <Spinner size="small" color={COLORS.white} />
                      : <Text className="text-xs font-semibold text-white">Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowAddDip(true)}
                className="h-11 rounded-2xl border border-dashed border-border items-center justify-center flex-row gap-2 active:opacity-70"
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-muted-foreground">Agregar diploma o certificado</Text>
              </TouchableOpacity>
            )}
          </View>

          {(perfil.cargos ?? []).length > 0 && (
            <>
              <SectionHeader title="Cargos certificados" count={perfil.cargos?.length} />
              <View className="mx-5 flex-row flex-wrap gap-2">
                {perfil.cargos!.map((c) => (
                  <View key={c.id} className="bg-info/10 rounded-full px-3 py-1.5">
                    <Text className="text-xs font-semibold text-info">{c.nombre}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          </>)}

          {/* ── Acciones ─────────────────────────────────────────────── */}
          <View className="mx-5 mt-6 gap-3">
            {editing ? (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCancel}
                  className="flex-1 h-12 rounded-2xl border border-border items-center justify-center active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-muted-foreground">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={update.isPending}
                  className="flex-1 h-12 rounded-2xl bg-primary-500 items-center justify-center active:opacity-80 disabled:opacity-50"
                >
                  {update.isPending ? (
                    <Spinner size="small" color={COLORS.white} />
                  ) : (
                    <Text className="text-sm font-semibold text-white">Guardar cambios</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                className="h-12 rounded-2xl border border-primary-500 items-center justify-center flex-row gap-2 active:opacity-70"
              >
                <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                <Text className="text-sm font-semibold text-primary-500">Editar perfil laboral</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
