import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { confirm } from './confirmDialog';

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
      confirm({
        title: '¿Descartar cambios?',
        message: 'Vas a perder lo que llevas hecho en este formulario.',
        cancelLabel: 'Seguir editando',
        confirmLabel: 'Descartar',
        destructive: true,
      }).then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
  }, [navigation, hasChanges]);
}
