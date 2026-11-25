/**
 * PagoDesglose — de dónde sale el pago de un período, sin párrafos: una barra apilada en pesos (qué parte del bruto es
 * salario, recargos, extras…), una fila corta por concepto y, debajo, bruto → descuentos → auxilio → neto. La cuenta
 * ("horas × valor × factor") queda un toque más abajo en cada fila. Lee los montos de la liquidación, no los recalcula.
 */
import { Text } from '@/components/ui/Text';
import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import type { LiquidacionLinea } from '@api-client';
import { CompositionBar } from '@/components/ui/CompositionBar';
import { HOUR_TYPE_COLORS } from '@/lib/designTokens';
import { formatCOP } from '@/lib/formatters';
import { desglosePago, type ClaveConcepto } from './pagoDesglose';

const COLOR_CONCEPTO: Record<ClaveConcepto, string> = {
  base: HOUR_TYPE_COLORS.ordinarias,
  nocturno: HOUR_TYPE_COLORS.nocturna,
  extraDiurna: HOUR_TYPE_COLORS.extraDiurna,
  extraNocturna: HOUR_TYPE_COLORS.extraNocturna,
  festivo: HOUR_TYPE_COLORS.festivo,
};

export function PagoDesglose({ linea }: { linea: LiquidacionLinea }) {
  const d = useMemo(() => desglosePago(linea), [linea]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const hayAjustes = d.descuentos.length > 0 || d.auxilio > 0;

  return (
    <View className="gap-3">
      <CompositionBar height={10} segments={d.conceptos.map((c) => ({ value: c.monto, color: COLOR_CONCEPTO[c.clave] }))} />

      <View className="gap-1">
        {d.conceptos.map((c) => (
          <TouchableOpacity
            key={c.clave}
            onPress={() => setAbierto((a) => (a === c.clave ? null : c.clave))}
            accessibilityRole="button"
            accessibilityState={{ expanded: abierto === c.clave }}
            accessibilityLabel={`${c.label}, ${formatCOP(c.monto)}. Toca para ver cómo se calcula`}
            className="py-1.5"
          >
            <View className="flex-row items-center gap-2.5">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR_CONCEPTO[c.clave] }} />
              <Text className="flex-1 text-sm text-foreground">{c.label}</Text>
              <Text className="text-sm font-semibold text-foreground">{formatCOP(c.monto)}</Text>
            </View>
            {abierto === c.clave && (
              <Text className="text-xs text-muted-foreground mt-1 ml-5">{c.formula}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {hayAjustes ? (
        <View className="gap-1 pt-2 border-t border-border">
          <Fila label="Bruto" valor={formatCOP(d.bruto)} fuerte />
          {d.descuentos.map((x) => (
            <Fila key={x.clave} label={x.label} valor={`-${formatCOP(x.monto)}`} clase="text-danger-dark" />
          ))}
          {d.auxilio > 0 && <Fila label="Auxilio de transporte" valor={`+${formatCOP(d.auxilio)}`} />}
          <View className="flex-row items-center justify-between pt-2 mt-1 border-t border-border">
            <Text className="text-sm font-semibold text-foreground">Neto a pagar</Text>
            <Text className="text-xl font-extrabold text-success">{formatCOP(d.neto)}</Text>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <Text className="text-sm font-semibold text-foreground">Total a pagar</Text>
          <Text className="text-xl font-extrabold text-success">{formatCOP(d.neto)}</Text>
        </View>
      )}
    </View>
  );
}

function Fila({ label, valor, fuerte, clase = 'text-foreground' }: { label: string; valor: string; fuerte?: boolean; clase?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className={`flex-1 text-sm ${fuerte ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</Text>
      <Text className={`text-sm ${fuerte ? 'font-semibold' : 'font-medium'} ${clase}`}>{valor}</Text>
    </View>
  );
}

