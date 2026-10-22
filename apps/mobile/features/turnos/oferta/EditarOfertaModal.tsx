import { showAlert } from '@/lib/alertDialog';
import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/lib/toast';
import { useActualizarOferta, useActualizarPuesto, useCrearPuesto, useCargos } from '@/features/turnos/useTurnos';
import { parseTarifa } from '@/features/turnos/crear/utils';
import { LugarInput } from '@/features/turnos/crear/LugarInput';
import { Button } from '@/components/ui/Button';
import { formatTimeObj, toISODate } from '@/lib/formatters';
import type { Cargo, OfertaPuesto } from '@api-client';
import { ApiError } from '@api-client';
import { fmtDate } from './fechasOferta';

// ── Editar oferta (gestores) — título/descripción/fecha/hora/lugar. Si cambian
// fecha/hora/lugar, el backend pasa a los confirmados a 'por_reconfirmar'. ──

type OfertaEditable = {
  id: number; titulo: string; descripcion: string | null;
  fecha: string; hora_inicio: string; hora_fin_estimada: string | null;
  lugar: string | null; latitud: number | null; longitud: number | null;
  puestos: OfertaPuesto[];
};

export function EditarOfertaModal({
  visible,
  oferta,
  onClose,
}: {
  visible: boolean;
  oferta: OfertaEditable;
  onClose: () => void;
}) {
  const actualizarM = useActualizarOferta();
  const [titulo, setTitulo] = useState(oferta.titulo);
  const [descripcion, setDescripcion] = useState(oferta.descripcion ?? '');
  const [fecha, setFecha] = useState(new Date());
  const [horaInicio, setHoraInicio] = useState(new Date());
  const [horaFin, setHoraFin] = useState<Date | null>(null);
  const [lugar, setLugar] = useState(oferta.lugar ?? '');
  // mysql2 devuelve DECIMAL como string: se convierte para que LugarInput pueda usar toFixed.
  const [latitud, setLatitud] = useState<number | null>(oferta.latitud == null ? null : Number(oferta.latitud));
  const [longitud, setLongitud] = useState<number | null>(oferta.longitud == null ? null : Number(oferta.longitud));
  const [showFecha, setShowFecha] = useState(false);
  const [showHoraInicio, setShowHoraInicio] = useState(false);
  const [showHoraFin, setShowHoraFin] = useState(false);
  const [agregandoVacante, setAgregandoVacante] = useState(false);
  const [vacante, setVacante] = useState<{ cargo: Cargo | null; plazas: number; tarifa: string }>({ cargo: null, plazas: 1, tarifa: '' });
  const crearPuestoM = useCrearPuesto();
  const actualizarPuestoM = useActualizarPuesto();
  const { data: cargos = [] } = useCargos(agregandoVacante);
  const usedIds = new Set(oferta.puestos.map(p => p.cargo_id));

  // Solo al abrir: un refetch de la oferta (p. ej. tras agregar una vacante) no debe pisar lo que el gestor ya escribió.
  React.useEffect(() => {
    if (!visible) return;
    setTitulo(oferta.titulo);
    setDescripcion(oferta.descripcion ?? '');
    const [ay, am, ad] = oferta.fecha.split('-').map(Number);
    setFecha(new Date(ay, am - 1, ad));
    const [hi, mi] = oferta.hora_inicio.split(':').map(Number);
    const dInicio = new Date();
    dInicio.setHours(hi, mi, 0, 0);
    setHoraInicio(dInicio);
    if (oferta.hora_fin_estimada) {
      const [hf, mf] = oferta.hora_fin_estimada.split(':').map(Number);
      const dFin = new Date();
      dFin.setHours(hf, mf, 0, 0);
      setHoraFin(dFin);
    } else {
      setHoraFin(null);
    }
    setLugar(oferta.lugar ?? '');
    setLatitud(oferta.latitud == null ? null : Number(oferta.latitud));
    setLongitud(oferta.longitud == null ? null : Number(oferta.longitud));
    setShowFecha(false);
    setShowHoraInicio(false);
    setShowHoraFin(false);
    setAgregandoVacante(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cambianCriticos = toISODate(fecha) !== oferta.fecha
    || `${formatTimeObj(horaInicio)}:00` !== oferta.hora_inicio.slice(0, 5) + ':00'
    || (horaFin ? `${formatTimeObj(horaFin)}:00` : null) !== oferta.hora_fin_estimada
    || lugar !== (oferta.lugar ?? '');

  // Cada toque guarda de una vez (igual que "Agregar vacante"). El mínimo son las plazas ya
  // cubiertas — nunca menos de 1; el backend lo vuelve a validar.
  async function cambiarPlazas(p: OfertaPuesto, delta: 1 | -1) {
    const plazas = p.plazas + delta;
    if (plazas < Math.max(1, p.plazas_cubiertas)) return;
    try {
      await actualizarPuestoM.mutateAsync({ ofertaId: oferta.id, puestoId: p.id, plazas });
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudieron cambiar las plazas.');
    }
  }

  async function handleAgregarVacante() {
    if (!vacante.cargo) { showAlert('Datos incompletos', 'Elige un rol para la vacante.', 'warning'); return; }
    const tarifa = parseTarifa(vacante.tarifa);
    if (tarifa <= 0) { showAlert('Datos incompletos', 'Ingresa la tarifa por turno.', 'warning'); return; }
    try {
      await crearPuestoM.mutateAsync({ ofertaId: oferta.id, cargo_id: vacante.cargo.id, plazas: vacante.plazas, tarifa_dia: tarifa });
      setAgregandoVacante(false);
      setVacante({ cargo: null, plazas: 1, tarifa: '' });
      showToast('Vacante agregada.');
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo agregar la vacante.');
    }
  }

  async function handleGuardar() {
    if (horaFin && formatTimeObj(horaFin) <= formatTimeObj(horaInicio)) {
      showAlert('Error', 'La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    try {
      await actualizarM.mutateAsync({
        id: oferta.id,
        titulo,
        // Tal cual (no `|| undefined`): así vaciar el campo sí lo borra.
        // `undefined` significa "no tocar" para el backend — con eso, borrar
        // la descripción o el lugar nunca se guardaba.
        descripcion,
        fecha: toISODate(fecha),
        hora_inicio: `${formatTimeObj(horaInicio)}:00`,
        hora_fin_estimada: horaFin ? `${formatTimeObj(horaFin)}:00` : undefined,
        lugar,
        latitud: latitud ?? undefined,
        longitud: longitud ?? undefined,
      });
      onClose();
      showToast('Turno actualizado.');
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo actualizar el turno.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Editar turno</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Título</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Fecha</Text>
            <TouchableOpacity
              onPress={() => setShowFecha(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">{fmtDate(toISODate(fecha))}</Text>
            </TouchableOpacity>
            {showFecha && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={(_: DateTimePickerEvent, d?: Date) => {
                  if (Platform.OS === 'android') setShowFecha(false);
                  if (d) setFecha(d);
                }}
              />
            )}
            {showFecha && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowFecha(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Hora inicio</Text>
              <TouchableOpacity
                onPress={() => setShowHoraInicio(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-foreground">{formatTimeObj(horaInicio)}</Text>
              </TouchableOpacity>
              {showHoraInicio && (
                <DateTimePicker
                  value={horaInicio}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowHoraInicio(false);
                    if (d) setHoraInicio(d);
                  }}
                />
              )}
              {showHoraInicio && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowHoraInicio(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                  <Text className="text-sm font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Hora fin</Text>
              <TouchableOpacity
                onPress={() => setShowHoraFin(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-foreground">{horaFin ? formatTimeObj(horaFin) : 'Sin definir'}</Text>
              </TouchableOpacity>
              {showHoraFin && (
                <DateTimePicker
                  value={horaFin ?? horaInicio}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowHoraFin(false);
                    if (d) setHoraFin(d);
                  }}
                />
              )}
              {showHoraFin && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowHoraFin(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                  <Text className="text-sm font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Lugar</Text>
            <LugarInput
              value={lugar}
              latitud={latitud}
              longitud={longitud}
              onChange={(l, lat, lng) => { setLugar(l); setLatitud(lat); setLongitud(lng); }}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Descripción</Text>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={3}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">Vacantes</Text>
              {!agregandoVacante && (
                <TouchableOpacity onPress={() => setAgregandoVacante(true)} hitSlop={8} className="flex-row items-center gap-1">
                  <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                  <Text className="text-xs font-semibold text-primary">Agregar vacante</Text>
                </TouchableOpacity>
              )}
            </View>
            {oferta.puestos.length === 0 && <Text className="text-sm text-muted-foreground">Sin vacantes</Text>}
            {oferta.puestos.map(p => {
              const minimo = Math.max(1, p.plazas_cubiertas);
              const ocupado = actualizarPuestoM.isPending;
              return (
                <View key={p.id} className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{p.cargo_nombre}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {p.plazas_cubiertas > 0 ? `${p.plazas_cubiertas} cubierta(s) — no se pueden quitar` : 'Sin cubrir'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                      style={{ opacity: ocupado || p.plazas <= minimo ? 0.4 : 1 }}
                      disabled={ocupado || p.plazas <= minimo}
                      onPress={() => cambiarPlazas(p, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar una plaza de ${p.cargo_nombre}`}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.mutedForeground} />
                    </TouchableOpacity>
                    <Text className="text-base font-bold text-foreground w-6 text-center">{p.plazas}</Text>
                    <TouchableOpacity
                      className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                      style={{ opacity: ocupado ? 0.4 : 1 }}
                      disabled={ocupado}
                      onPress={() => cambiarPlazas(p, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Agregar una plaza a ${p.cargo_nombre}`}
                    >
                      <Ionicons name="add" size={16} color={COLORS.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {agregandoVacante && (
              <View className="bg-card border border-border rounded-xl p-3 gap-3">
                {/* ponytail: chips sin buscador — CargoModal es otro Modal y RN no anida Modals bien en iOS. Upgrade path: buscador si el catálogo crece. */}
                <View className="flex-row flex-wrap gap-2">
                  {cargos.filter(c => !usedIds.has(c.id)).map(c => {
                    const sel = vacante.cargo?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setVacante(v => ({ ...v, cargo: c }))}
                        className={`px-3 py-1.5 rounded-full border ${sel ? 'bg-primary border-primary' : 'border-border'}`}
                      >
                        <Text className={`text-xs font-semibold ${sel ? 'text-white' : 'text-foreground'}`}>{c.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="flex-row gap-4">
                  <View className="gap-1">
                    <Text className="text-xs text-muted-foreground">Plazas</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                        onPress={() => setVacante(v => ({ ...v, plazas: Math.max(1, v.plazas - 1) }))}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.mutedForeground} />
                      </TouchableOpacity>
                      <Text className="text-base font-bold text-foreground w-6 text-center">{vacante.plazas}</Text>
                      <TouchableOpacity
                        className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                        onPress={() => setVacante(v => ({ ...v, plazas: v.plazas + 1 }))}
                      >
                        <Ionicons name="add" size={16} color={COLORS.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-xs text-muted-foreground">Tarifa por turno</Text>
                    <View className="flex-row items-center bg-muted rounded-xl px-3 gap-1">
                      <Text className="text-sm font-bold text-muted-foreground">$</Text>
                      <TextInput
                        className="flex-1 py-2 text-sm font-semibold text-foreground"
                        placeholder="120.000"
                        placeholderTextColor={COLORS.placeholder}
                        value={vacante.tarifa}
                        onChangeText={t => setVacante(v => ({ ...v, tarifa: t.replace(/[^\d.,]/g, '') }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Button label="Cancelar" variant="secondary" onPress={() => setAgregandoVacante(false)} style={{ flex: 1 }} />
                  <Button
                    label="Agregar"
                    variant="primary"
                    loading={crearPuestoM.isPending}
                    onPress={handleAgregarVacante}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>

          {cambianCriticos && (
            <View className="flex-row items-center gap-2 bg-warning-light rounded-xl px-3 py-2.5">
              <Ionicons name="warning-outline" size={16} color={COLORS.warningText} />
              <Text className="flex-1 text-xs font-medium text-warning">
                Quienes ya estén confirmados deberán reconfirmar su participación tras este cambio.
              </Text>
            </View>
          )}

          <Button
            label={actualizarM.isPending ? 'Guardando…' : 'Guardar cambios'}
            variant="primary"
            fullWidth
            loading={actualizarM.isPending}
            onPress={handleGuardar}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
