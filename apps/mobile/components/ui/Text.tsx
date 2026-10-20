import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import { familiaInter } from '@/lib/tipografia';

/**
 * Estilo que pone Inter según el peso pedido (clase `font-*` o `fontWeight`). El `fontWeight` se
 * fuerza a 'normal' porque el peso ya va en la familia: dejarlo duplicaría la negrita en Android.
 * Si el estilo trae su propia `fontFamily`, se respeta.
 */
function conInter(className: string | undefined, style: TextProps['style']) {
  const { fontWeight, ...resto } = StyleSheet.flatten(style) ?? {};
  return resto.fontFamily ? style : [resto, { fontFamily: familiaInter(className, fontWeight), fontWeight: 'normal' as const }];
}

/** `Text` de la app: igual que el de React Native pero en Inter. Importar de aquí, no de 'react-native'. */
export function Text({ style, ...rest }: TextProps & { ref?: React.Ref<RNText> }) {
  return <RNText {...rest} style={conInter(rest.className, style)} />;
}

/** `TextInput` de la app, en Inter. */
export function TextInput({ style, ...rest }: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput {...rest} style={conInter(rest.className, style)} />;
}
