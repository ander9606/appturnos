import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * Confirma antes de salir de una pantalla con cambios sin guardar —
 * cubre swipe-back, botón físico Android y el back del header, no solo
 * un botón "Cancelar" a medida.
 */
export function useConfirmDiscard(hasChanges: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges) return;
      e.preventDefault();
      Alert.alert(
        '¿Descartar cambios?',
        'Vas a perder lo que llevas hecho en este formulario.',
        [
          { text: 'Seguir editando', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
  }, [navigation, hasChanges]);
}
