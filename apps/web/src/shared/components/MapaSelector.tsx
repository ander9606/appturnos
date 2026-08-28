import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { X, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

// Vite no resuelve los íconos por default de Leaflet (rutas relativas al CSS)
// — sin esto el pin queda invisible. Fix estándar: apuntarlo a los assets importados.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Bogotá — centro de referencia cuando no hay coords ni GPS disponible (igual que mobile).
const FALLBACK_CENTER: [number, number] = [4.7110, -74.0721];

interface Props {
  initialLat: number | null;
  initialLng: number | null;
  /** Radio en metros a dibujar como referencia visual (geofence). Opcional. */
  radiusM?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

function ClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Selector de ubicación interactivo (mapa + pin arrastrable) — equivalente web
 * de components/ui/MapaSelector.tsx en mobile. Usa Leaflet + OpenStreetMap
 * (mismo servicio que ya usa LugarInput para buscar direcciones): gratis, sin
 * API key.
 */
export function MapaSelector({ initialLat, initialLng, radiusM, onConfirm, onClose }: Props) {
  const [pin, setPin] = useState<[number, number]>(FALLBACK_CENTER);
  const [loading, setLoading] = useState(initialLat == null || initialLng == null);

  useEffect(() => {
    if (initialLat != null && initialLng != null) {
      setPin([initialLat, initialLng]);
      setLoading(false);
      return;
    }
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPin([pos.coords.latitude, pos.coords.longitude]);
        setLoading(false);
      },
      () => setLoading(false),
    );
    // Solo al montar — initialLat/initialLng no deben re-disparar el GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onClose} size="lg" padded={false} className="overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-base font-bold text-foreground">Ajustar ubicación</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <div style={{ height: 360 }} className="flex-shrink-0 bg-muted">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={28} className="text-info animate-spin" />
          </div>
        ) : (
          <MapContainer center={pin} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker
              position={pin}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  setPin([lat, lng]);
                },
              }}
            />
            {!!radiusM && (
              <Circle center={pin} radius={radiusM} pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.12 }} />
            )}
            <ClickHandler onMove={(lat, lng) => setPin([lat, lng])} />
          </MapContainer>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          Hacé clic en el mapa o arrastrá el pin para ajustar el punto exacto
        </p>
        <p className="text-xs font-medium text-foreground text-center">
          {pin[0].toFixed(6)}, {pin[1].toFixed(6)}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => onConfirm(pin[0], pin[1])}
          className="w-full bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          Confirmar ubicación
        </button>
      </div>
    </Modal>
  );
}
