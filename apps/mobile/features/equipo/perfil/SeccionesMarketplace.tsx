import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { confirm } from '@/lib/confirmDialog';
import { isValidISODate } from '@/lib/dateValidation';
import type { Trabajador, Experiencia, Diploma } from '@api-client';
import { useCrearExperiencia, useEliminarExperiencia, useCrearDiploma, useEliminarDiploma } from './usePerfilLaboral';
import { MiniField, DateField } from './campos';
import { fmtFechaCorta } from './fechasPerfil';
import { EMPTY_EXP, EMPTY_DIP } from './perfilForm';

// Experiencia, diplomas y cargos: solo los ve el trabajador del marketplace (no el de nómina).

export function ExperienciaSection({ experiencias }: { experiencias: Trabajador['experiencias'] }) {
  const crearExp     = useCrearExperiencia();
  const eliminarExp  = useEliminarExperiencia();

  const [showAddExp, setShowAddExp] = useState(false);
  const [newExp, setNewExp] = useState(EMPTY_EXP);

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

  return (
    <>
      <SectionHeader title="Experiencia laboral" count={experiencias?.length} />
      <View className="mx-5 gap-3">
        {(experiencias ?? []).map((exp: Experiencia) => (
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
    </>
  );
}

export function DiplomasSection({ diplomas }: { diplomas: Trabajador['diplomas'] }) {
  const crearDip     = useCrearDiploma();
  const eliminarDip  = useEliminarDiploma();

  const [showAddDip, setShowAddDip] = useState(false);
  const [newDip, setNewDip] = useState(EMPTY_DIP);

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

  return (
    <>
      <SectionHeader title="Diplomas y certificados" count={diplomas?.length} />
      <View className="mx-5 gap-3">
        {(diplomas ?? []).map((dip: Diploma) => (
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
    </>
  );
}

export function CargosSection({ cargos }: { cargos: Trabajador['cargos'] }) {
  if ((cargos ?? []).length === 0) return null;
  return (
    <>
      <SectionHeader title="Cargos certificados" count={cargos?.length} />
      <View className="mx-5 flex-row flex-wrap gap-2">
        {cargos!.map((c) => (
          <View key={c.id} className="bg-info/10 rounded-full px-3 py-1.5">
            <Text className="text-xs font-semibold text-info">{c.nombre}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
