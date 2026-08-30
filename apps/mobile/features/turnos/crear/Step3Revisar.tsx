import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { parseTarifa, calcularPresupuesto } from './utils';
import { formatDateObj, formatTimeObj } from '@/lib/formatters';
import type { WizardData } from './types';

type Props = {
  data: WizardData;
  onBack: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  isPublished: boolean;
  onClose: () => void;
};

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2.5 border-b border-border">
      <Ionicons name={icon as any} size={16} color="#64748B" style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="text-sm font-medium text-foreground">{value}</Text>
      </View>
    </View>
  );
}

export function Step3Revisar({ data, onBack, onPublish, isPublishing, isPublished, onClose }: Props) {
  const fecha = data.fecha ? formatDateObj(data.fecha) : '';
  const inicio = data.hora_inicio ? formatTimeObj(data.hora_inicio) : '';
  const fin = data.hora_fin ? ` – ${formatTimeObj(data.hora_fin)}` : '';

  const totalPlazas = data.puestos.reduce((s, p) => s + p.plazas, 0);
  const presupuesto = calcularPresupuesto(data.puestos);

  return (
    <ScrollView contentContainerClassName="px-5 py-4 gap-5 pb-10">
      <View
        className="bg-card rounded-2xl px-4 py-2"
        style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
      >
        <SummaryRow icon="text-outline"     label="Título"   value={data.titulo} />
        <SummaryRow icon="calendar-outline" label="Fecha"    value={fecha} />
        <SummaryRow icon="time-outline"     label="Horario"  value={`${inicio}${fin}`} />
        {data.lugar ? (
          <SummaryRow icon="location-outline" label="Lugar" value={data.lugar} />
        ) : null}
        {data.encargado_nombre ? (
          <SummaryRow
            icon="person-outline"
            label="Encargado en el punto"
            value={data.encargado_telefono ? `${data.encargado_nombre} · ${data.encargado_telefono}` : data.encargado_nombre}
          />
        ) : null}
        {data.latitud !== null ? (
          <SummaryRow
            icon="navigate-outline"
            label="Coordenadas GPS"
            value={`${data.latitud.toFixed(5)}, ${data.longitud?.toFixed(5)}`}
          />
        ) : null}
      </View>

      <View
        className="bg-card rounded-2xl px-4 py-3 gap-2"
        style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
      >
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Puestos ({totalPlazas} plazas en total)
        </Text>
        {data.puestos.map((p) => {
          const tarifa = parseTarifa(p.tarifa_dia);
          return (
            <View key={p.key} className="flex-row items-center justify-between py-2 border-b border-border last:border-0">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-primary-500">{p.plazas}×</Text>
                <Text className="text-sm font-medium text-foreground">{p.cargo_nombre}</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                ${tarifa.toLocaleString('es-CO')} c/u
              </Text>
            </View>
          );
        })}
        {presupuesto > 0 && (
          <View className="flex-row items-center justify-between pt-2 mt-1">
            <Text className="text-sm font-bold text-foreground">Presupuesto total</Text>
            <Text className="text-sm font-bold text-success">
              ${presupuesto.toLocaleString('es-CO')}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-start gap-3 bg-info-light rounded-2xl px-4 py-3">
        <Ionicons name="notifications-outline" size={18} color="#3B82F6" style={{ marginTop: 1 }} />
        <Text className="flex-1 text-sm text-info">
          {data.visibilidad === 'dirigida'
            ? `Al publicar, se notificará solo a ${data.destinatarios.length} persona${data.destinatarios.length !== 1 ? 's' : ''} que elegiste.`
            : 'Al publicar, se enviará una notificación push a todos los trabajadores de la empresa que tengan cada cargo certificado.'}
        </Text>
      </View>

      <View className="flex-row gap-3">
        {!isPublished && (
          <Button label="← Atrás" variant="secondary" onPress={onBack} style={{ flex: 1 }} disabled={isPublishing} />
        )}
        <Button
          label={isPublishing ? 'Publicando…' : isPublished ? 'Cerrar' : 'Publicar turno'}
          variant="primary"
          size="lg"
          loading={isPublishing}
          onPress={isPublished ? onClose : onPublish}
          style={{ flex: isPublished ? 1 : 2 }}
        />
      </View>
    </ScrollView>
  );
}
