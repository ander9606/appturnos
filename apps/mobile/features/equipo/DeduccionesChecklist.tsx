/**
 * DeduccionesChecklist — preview en vivo de los descuentos de ley (salud/pensión)
 * mientras se digita el salario/tarifa en el formulario de trabajador.
 * Solo se renderiza si la empresa contrata por nómina laboral.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { empresasApi, calcularDeducciones, HORAS_MES_NOMINA } from '@api-client';
import { formatCOP } from '@/lib/formatters';

interface Props {
  tarifaHora?: number | null;
  salarioBase?: number | null;
}

export function DeduccionesChecklist({ tarifaHora, salarioBase }: Props) {
  // Comparte cache con la pantalla "Mi empresa" (mismo queryKey) — no dispara un fetch extra si ya está cargada.
  const { data: empresa } = useQuery({
    queryKey: ['mi-empresa'],
    queryFn: () => empresasApi.obtenerMiEmpresa(),
    staleTime: 300_000,
  });

  if (empresa?.tipo_contrato !== 'laboral') return null;

  const ibc = tarifaHora ? tarifaHora * HORAS_MES_NOMINA : salarioBase || 0;
  if (!ibc) return null;

  const d = calcularDeducciones(ibc);
  const items = [
    { label: 'Salud (4%)', valor: d.salud, aplica: true },
    { label: 'Pensión (4%)', valor: d.pension - d.fondoSolidaridadTasa * ibc, aplica: true },
    {
      label: `Fondo de solidaridad pensional (+${(d.fondoSolidaridadTasa * 100).toFixed(1)}%)`,
      valor: d.fondoSolidaridadTasa * ibc,
      aplica: d.fondoSolidaridadTasa > 0,
      hint: 'Aplica desde 4 SMMLV',
    },
  ];

  return (
    <View className="mb-4 -mt-1 bg-card border border-border rounded-2xl p-4 gap-2.5">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Descuentos de ley sobre {formatCOP(ibc)}/mes
      </Text>
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-2">
          <Ionicons
            name={item.aplica ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={item.aplica ? '#10B981' : '#CBD5E1'}
          />
          <Text className={`text-sm flex-1 ${item.aplica ? 'text-foreground' : 'text-muted-foreground'}`}>
            {item.label}{item.hint && !item.aplica ? ` — ${item.hint}` : ''}
          </Text>
          {item.aplica && (
            <Text className="text-sm font-semibold text-danger">-{formatCOP(item.valor)}</Text>
          )}
        </View>
      ))}
      <View className="flex-row items-center justify-between pt-2 mt-1 border-t border-border">
        <Text className="text-sm font-bold text-foreground">Neto estimado</Text>
        <Text className="text-sm font-bold text-success">{formatCOP(d.neto)}/mes</Text>
      </View>
      <Text className="text-[10px] text-muted-foreground">
        No incluye ARL ni caja de compensación: en Colombia esos van 100% a cargo de la empresa, no se descuentan del trabajador.
      </Text>
    </View>
  );
}
