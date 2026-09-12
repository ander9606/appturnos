// ponytail: lazy import — native module only loaded when handler runs, not at route discovery time

/** GPS del momento de una acción — opcional, nunca bloquea el flujo si falla o se niega el permiso. */
export async function obtenerUbicacionActual(): Promise<{ latitud?: number; longitud?: number }> {
  try {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitud: loc.coords.latitude, longitud: loc.coords.longitude };
  } catch {
    return {};
  }
}
