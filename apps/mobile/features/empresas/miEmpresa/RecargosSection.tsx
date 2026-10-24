import React, { useRef, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { Text } from '@/components/ui/Text';
import { confirm } from '@/lib/confirmDialog';
import { useTheme } from '@/lib/theme';
import { useReprocesarRecargos } from './useMiEmpresa';
import type { FormData } from './miEmpresaForm';
import { RECARGOS_OPTIONS, DOMINGO_HABITUAL_OPTIONS } from './opcionesEmpresa';

/** Cálculo de recargos + regla del domingo habitual. Mantener presionado "Con recargos" reprocesa el período abierto. */
export function RecargosSection({ control, sumar }: { control: Control<FormData>; sumar: boolean }) {
  const theme = useTheme();
  const reprocesar = useReprocesarRecargos();
  // Mantener presionado "Con recargos" reprocesa el período abierto con la
  // regla actual — deliberadamente prolongado (no un long-press corto) para
  // que no se dispare sin querer: recalcula horas ya registradas del equipo.
  const HOLD_MS = 1800;
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdRunning = useRef<Animated.CompositeAnimation | null>(null);
  const iniciarHold = (activo: boolean) => {
    if (!activo || reprocesar.isPending) return;
    holdAnim.setValue(0);
    holdRunning.current = Animated.timing(holdAnim, { toValue: 1, duration: HOLD_MS, useNativeDriver: false });
    holdRunning.current.start(({ finished }) => { if (finished) reprocesar.mutate(); });
  };
  const cancelarHold = () => {
    holdRunning.current?.stop();
    holdAnim.setValue(0);
  };
  const [verAviso, setVerAviso] = useState(false);

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Cálculo de recargos
        </Text>
        <Text className="text-xs text-muted-foreground">
          Define si Zaturno calcula los recargos nocturnos y festivos al liquidar.
        </Text>
      </View>
      <Controller
        control={control}
        name="sumar_nocturnas_festivo"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            {RECARGOS_OPTIONS.map((opt) => {
              const active = value === opt.value;
              const elegir = () => {
                if (opt.value || !value) return onChange(opt.value);
                confirm({
                  title: 'Dejar de sumar recargos',
                  message: 'Zaturno dejará de calcular el recargo nocturno y festivo. Las horas son normales hasta 42 h a la semana y, después, extra diurna. La empresa calcula esos recargos y responde por la liquidación. ¿Confirmas?',
                  confirmLabel: 'Sí, dejar de sumar',
                  destructive: true,
                }).then((ok) => { if (ok) onChange(false); });
              };
              return (
                <Pressable
                  key={String(opt.value)}
                  onPress={elegir}
                  onPressIn={() => iniciarHold(opt.value && active)}
                  onPressOut={cancelarHold}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  className={`flex-1 overflow-hidden rounded-2xl border py-3 px-2 items-center gap-0.5 active:opacity-70 ${
                    active ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'
                  }`}
                >
                  {opt.value && active && (
                    <Animated.View
                      pointerEvents="none"
                      style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: holdAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                        backgroundColor: theme.primaryLight,
                      }}
                    />
                  )}
                  <Text className={`text-sm font-bold ${active ? 'text-primary-500' : 'text-foreground'}`}>
                    {opt.label}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground text-center">{opt.sub}</Text>
                  {opt.value && active && (
                    <Text className="text-[9px] text-muted-foreground/70 text-center mt-0.5">
                      Mantén presionado para reprocesar el período
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      />

      {!sumar && (
        <View className="gap-2">
          <Pressable onPress={() => setVerAviso((v) => !v)} accessibilityRole="button" className="self-start">
            <Text className="text-xs font-semibold text-primary-500">
              {verAviso ? 'Ocultar aviso' : 'Aviso sobre el cálculo'}
            </Text>
          </Pressable>
          {verAviso && (
            <Text className="text-xs text-muted-foreground">
              Zaturno registra las horas trabajadas. Si la empresa no suma recargos automáticamente, el cálculo de recargos y horas extra lo hace la empresa con la información que toma de Zaturno, y la empresa es la responsable de revisarlo y de la liquidación que paga. Zaturno no responde por los montos que se liquiden con esta opción.
            </Text>
          )}
        </View>
      )}

      {sumar && (
        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Cuándo un domingo es habitual
          </Text>
          <Controller
            control={control}
            name="regla_domingo_habitual"
            render={({ field: { onChange, value } }) => (
              <View className="gap-2" accessibilityRole="radiogroup">
                {DOMINGO_HABITUAL_OPTIONS.map((opt) => {
                  const active = value === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => onChange(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      className={`rounded-2xl border px-4 py-3 active:opacity-70 ${
                        active ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${active ? 'text-primary-500' : 'text-foreground'}`}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}
