/**
 * SignaturePad — captura firma digital
 *
 * Usa PanResponder para capturar trazos y los renderiza como paths SVG.
 * Al confirmar exporta el SVG como base64 (data compatible con firma_b64).
 *
 * El lienzo se dibuja girado 90° dentro del modal (vertical): una firma
 * natural es más ancha que alta, y las cajas donde se muestra después
 * (el recuadro de firma del contrato, el PDF) también son anchas — así
 * que el usuario gira el teléfono para firmar cómodo, apoyado en la
 * línea guía, y los trazos quedan capturados ya en esas proporciones
 * horizontales, sin necesidad de rotar la imagen después. Las posiciones
 * del toque se leen en pageX/pageY (coordenadas de pantalla, no afectadas
 * por el transform) y se invierte la rotación a mano — ver toCanvasPoint.
 *
 * Requiere: react-native-svg (expo install react-native-svg)
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  PanResponder,
  LayoutChangeEvent,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';

// ── Types ─────────────────────────────────────────────────────────────────

interface Point { x: number; y: number }
type Stroke = Point[];

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (base64: string) => void;
  loading?: boolean;
  confirmLabel?: string;
  title?: string;
  subtitle?: string;
}

// ── SVG export ────────────────────────────────────────────────────────────

function strokeToPathD(stroke: Stroke): string {
  if (stroke.length < 2) return '';
  if (stroke.length === 2) {
    return `M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)} L ${stroke[1].x.toFixed(1)} ${stroke[1].y.toFixed(1)}`;
  }
  // Smooth freehand strokes: quadratic curve through the midpoint of each
  // point pair, using the raw point as control — avoids the jagged polyline
  // look of straight M/L segments.
  let d = `M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)}`;
  for (let i = 1; i < stroke.length - 1; i++) {
    const midX = (stroke[i].x + stroke[i + 1].x) / 2;
    const midY = (stroke[i].y + stroke[i + 1].y) / 2;
    d += ` Q ${stroke[i].x.toFixed(1)} ${stroke[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = stroke[stroke.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function strokesToSvgBase64(
  strokes: Stroke[],
  width: number,
  height: number,
): string {
  const paths = strokes
    .map((s) => strokeToPathD(s))
    .filter(Boolean)
    .map(
      (d) =>
        `<path d="${d}" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#fff">${paths}</svg>`;

  // btoa is available in Hermes (React Native's JS engine)
  return btoa(unescape(encodeURIComponent(svg)));
}

// ── Component ─────────────────────────────────────────────────────────────

export function SignaturePad({
  visible,
  onClose,
  onConfirm,
  loading = false,
  confirmLabel = 'Confirmar salida',
  title = 'Firma digital',
  subtitle = 'Dibuja tu firma para confirmar la salida y firmar el contrato',
}: SignaturePadProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Tamaño del contenedor tal como se ve en pantalla (vertical, sin rotar).
  const [outerSize, setOuterSize] = useState({ w: 300, h: 400 });
  // Lienzo real donde se capturan los trazos: mismo tamaño que outerSize
  // pero con ancho/alto invertidos, porque se gira 90° para quedar ancho.
  const landscape = { w: outerSize.h, h: outerSize.w };
  const currentStroke = useRef<Stroke>([]);
  const outerRef = useRef<View>(null);
  const canvasOffset = useRef({ x: 0, y: 0 });

  const isEmpty = strokes.every((s) => s.length < 2);

  // ── Capture canvas position ───────────────────────────────────────────
  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setOuterSize({ w: width, h: height });

    outerRef.current?.measure((fx, fy, w, h, px, py) => {
      canvasOffset.current = { x: px, y: py };
    });
  }, []);

  /**
   * El toque llega en coordenadas de pantalla (pageX/pageY), que el
   * transform:[{rotate}] no altera — se invierte la rotación a mano para
   * ubicar el punto dentro del lienzo apaisado (ver comentario de cabecera).
   * Girar 90° deja: el borde izquierdo del lienzo → arriba de la pantalla,
   * el borde superior del lienzo → derecha de la pantalla.
   */
  const toCanvasPoint = useCallback((pageX: number, pageY: number): Point => {
    const relX = pageX - canvasOffset.current.x;
    const relY = pageY - canvasOffset.current.y;
    return { x: relY, y: outerSize.w - relX };
  }, [outerSize.w]);

  // ── PanResponder ──────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        currentStroke.current = [toCanvasPoint(pageX, pageY)];
        Haptics.selectionAsync();
      },

      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        currentStroke.current = [...currentStroke.current, toCanvasPoint(pageX, pageY)];
        // Live update — force re-render by spreading into state
        setStrokes((prev) => {
          const copy = [...prev];
          copy[copy.length] = currentStroke.current; // append live stroke
          return copy;
        });
      },

      onPanResponderRelease: () => {
        const stroke = currentStroke.current;
        currentStroke.current = [];
        setStrokes((prev) => {
          // Remove the "live" entry (last) and add finalized stroke
          const withoutLive = prev.slice(0, prev.length - 1);
          return [...withoutLive, stroke];
        });
      },
    }),
  ).current;

  const handleClear = () => {
    setStrokes([]);
    currentStroke.current = [];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleConfirm = () => {
    if (isEmpty) return;
    const base64 = strokesToSvgBase64(strokes, landscape.w, landscape.h);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(base64);
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-background">
        {/* ── Header ─────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-bold text-foreground">{title}</Text>
            <Text className="text-sm text-muted-foreground mt-0.5">
              {subtitle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            className="w-9 h-9 bg-muted rounded-full items-center justify-center"
            accessibilityLabel="Cerrar"
          >
            <Text className="text-base text-muted-foreground font-semibold">✕</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-xs text-muted-foreground text-center px-6 pt-3">
          Gira tu teléfono: firmar en horizontal es más cómodo
        </Text>

        {/* ── Canvas ─────────────────────────────────────────────── */}
        <View className="flex-1 px-5 py-6 gap-4">
          <View
            ref={outerRef}
            onLayout={onCanvasLayout}
            className="flex-1 bg-card rounded-2xl border-2 border-dashed border-border overflow-hidden"
            style={{ minHeight: 200, alignItems: 'center', justifyContent: 'center' }}
          >
            {/* Lienzo apaisado, girado 90° dentro del contenedor vertical —
                ver el comentario de cabecera del archivo. */}
            <View
              {...panResponder.panHandlers}
              style={{ width: landscape.w, height: landscape.h, transform: [{ rotate: '90deg' }] }}
            >
              <Svg
                width={landscape.w}
                height={landscape.h}
                style={{ position: 'absolute', top: 0, left: 0 }}
              >
                {/* Línea guía — como el renglón de una hoja: se firma apoyado en ella */}
                <Line
                  x1={landscape.w * 0.08}
                  y1={landscape.h * 0.62}
                  x2={landscape.w * 0.92}
                  y2={landscape.h * 0.62}
                  stroke="#CBD5E1"
                  strokeWidth={1.5}
                  strokeDasharray="5,5"
                />
                {strokes.map((stroke, i) => {
                  const d = strokeToPathD(stroke);
                  if (!d) return null;
                  return (
                    <Path
                      key={i}
                      d={d}
                      stroke="#0F172A"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}
              </Svg>

              {/* Empty hint */}
              {isEmpty && (
                <View style={{ width: landscape.w, height: landscape.h }} className="items-center justify-center gap-2 pointer-events-none">
                  <Text className="text-3xl opacity-30">✍️</Text>
                  <Text className="text-sm text-muted-foreground opacity-60">
                    Firma sobre la línea
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Actions ────────────────────────────────────────── */}
          <View className="flex-row gap-3">
            <Button
              label="Limpiar"
              variant="ghost"
              size="md"
              onPress={handleClear}
              style={{ flex: 1 }}
            />
            <Button
              label={loading ? 'Guardando…' : confirmLabel}
              variant="primary"
              size="md"
              loading={loading}
              disabled={isEmpty}
              onPress={handleConfirm}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
