import { actionSheet } from '@/lib/actionSheet';
import { showAlert } from '@/lib/alertDialog';

/**
 * Menú "Tomar foto / Galería / Quitar" + selector de imagen cuadrada.
 * Resuelve: base64 si eligió una imagen · `null` si eligió quitarla · `undefined` si canceló
 * (o no dio permiso) — así `if (r !== undefined) subir(r)` cubre los tres casos.
 */
export async function elegirFotoConMenu(opts: { title: string; quitarLabel?: string }): Promise<string | null | undefined> {
  const eleccion = await actionSheet({
    title: opts.title,
    items: [
      { key: 'camara', label: 'Tomar foto', icon: 'camera-outline' },
      { key: 'galeria', label: 'Elegir de la galería', icon: 'images-outline' },
      ...(opts.quitarLabel ? [{ key: 'quitar', label: opts.quitarLabel, icon: 'trash-outline' as const, destructive: true }] : []),
    ],
  });
  if (eleccion === 'quitar') return null;
  if (eleccion !== 'camara' && eleccion !== 'galeria') return undefined;

  const ImagePicker = await import('expo-image-picker');
  const camara = eleccion === 'camara';
  const perm = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    showAlert('Permiso requerido', camara ? 'Permite el acceso a la cámara.' : 'Permite el acceso a la galería.', 'warning');
    return undefined;
  }
  const config = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] as [number, number] };
  const result = camara ? await ImagePicker.launchCameraAsync(config) : await ImagePicker.launchImageLibraryAsync(config);
  return !result.canceled && result.assets[0]?.base64 ? result.assets[0].base64 : undefined;
}
