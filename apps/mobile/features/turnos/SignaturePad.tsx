/**
 * SignaturePad — captura firma digital
 *
 * Usa PanResponder para capturar trazos y los renderiza como paths SVG.
 * Al confirmar exporta el SVG como base64 (data compatible con firma_b64).
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
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
  subtitle?: string;
}

// ── SVG export ────────────────────────────────────────────────────────────

function strokeToPathD(stroke: Stroke): string {
  if (stroke.length < 2) return '';
  const [first, ...rest] = stroke;
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (const p of rest) {
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
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
  subtitle = 'Dibuja tu firma para confirmar la salida y firmar el contrato',
}: SignaturePadProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 300, h: 180 });
  const currentStroke = useRef<Stroke>([]);
  const canvasRef = useRef<View>(null);
  const canvasOffset = useRef({ x: 0, y: 0 });

  const isEmpty = strokes.every((s) => s.length < 2);

  // ── Capture canvas position ───────────────────────────────────────────
  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ w: width, h: height });

    canvasRef.current?.measure((fx, fy, w, h, px, py) => {
      canvasOffset.current = { x: px, y: py };
    });
  }, []);

  // ── PanResponder ──────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        currentStroke.current = [{ x, y }];
        Haptics.selectionAsync();
      },

      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        currentStroke.current = [...currentStroke.current, { x, y }];
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
    const base64 = strokesToSvgBase64(strokes, canvasSize.w, canvasSize.h);
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
      presentationStyle="formSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-background">
        {/* ── Header ─────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-bold text-foreground">Firma digital</Text>
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

        {/* ── Canvas ─────────────────────────────────────────────── */}
        <View className="flex-1 px-5 py-6 gap-4">
          <View
            ref={canvasRef}
            onLayout={onCanvasLayout}
            className="flex-1 bg-card rounded-2xl border-2 border-dashed border-border overflow-hidden"
            {...panResponder.panHandlers}
            style={{ minHeight: 200 }}
          >
            <Svg
              width={canvasSize.w}
              height={canvasSize.h}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
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
              <View className="flex-1 items-center justify-center gap-2 pointer-events-none">
                <Text className="text-3xl opacity-30">✍️</Text>
                <Text className="text-sm text-muted-foreground opacity-60">
                  Dibuja tu firma aquí
                </Text>
              </View>
            )}
          </View>

          {/* ── Línea de firma ──────────────────────────────────── */}
          <View className="px-8">
            <View className="h-px bg-border" />
            <Text className="text-xs text-center text-muted-foreground mt-1">Firma</Text>
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
