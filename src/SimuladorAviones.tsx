import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ScrollArea } from './components/ui/scroll-area';
import { Badge } from './components/ui/badge';

// ===============
// 1) DATOS Y TIPOS
// ===============
const razonesCancelacion = [
  "Mantenimiento de aeronave",
  "Condiciones meteorológicas adversas",
  "Problemas técnicos con el avión",
  "Problemas de tripulación",
  "Problemas de seguridad en el aeropuerto",
  "Fallo mecánico",
  "Interrupción en el tráfico aéreo",
  "Protestas o manifestaciones",
  "Huelga del personal aeroportuario",
  "Incidencias con el sistema de reservas",
];

// Ajusta tu token si quieres, aunque aquí usaremos Stamen para el “efecto nubes”
const STADIA_TOKEN = import.meta.env.VITE_STADIA_TOKEN;

export const destinos_coords: Record<string, [number, number]> = {
  // México
  'CDMX': [19.4326, -99.1332],
  'Cancún': [21.1619, -86.8515],
  'Monterrey': [25.6866, -100.3161],
  'Guadalajara': [20.6597, -103.3496],
  'Tijuana': [32.5149, -117.0382],
  'Mérida': [20.9674, -89.5926],

  // Sudamérica
  'Lima': [-12.0464, -77.0428],
  'Bogotá': [4.7110, -74.0721],
  'Buenos Aires': [-34.6037, -58.3816],
  'Santiago': [-33.4489, -70.6693],

  // EUA / Canadá
  'Nueva York': [40.7128, -74.0060],
  'Vancouver': [49.2827, -123.1207],
  'Montreal': [45.5017, -73.5673],

  // Asia
  'Tokio': [35.6895, 139.6917],
  'Seúl': [37.5665, 126.9780],
  'Shanghái': [31.2304, 121.4737],
  'Dubái': [25.2048, 55.2708],

  // Europa
  'Madrid': [40.4168, -3.7038],
  'París': [48.8566, 2.3522],
  'Berlín': [52.5200, 13.4050],
  'Roma': [41.9028, 12.4964],
  'Londres': [51.5072, -0.1276],

  // África
  'El Cairo': [30.0444, 31.2357],

  // Brasil
  'São Paulo': [-23.5505, -46.6333],
  'Río de Janeiro': [-22.9068, -43.1729],
};

export interface Origen {
  nombre: string;
  coords: [number, number];
}

export const origenes: Origen[] = [
  // México
  { nombre: 'CDMX', coords: [19.4326, -99.1332] },
  { nombre: 'Cancún', coords: [21.1619, -86.8515] },
  { nombre: 'Monterrey', coords: [25.6866, -100.3161] },
  { nombre: 'Guadalajara', coords: [20.6597, -103.3496] },
  { nombre: 'Tijuana', coords: [32.5149, -117.0382] },
  { nombre: 'Mérida', coords: [20.9674, -89.5926] },

  // Sudamérica
  { nombre: 'Lima', coords: [-12.0464, -77.0428] },
  { nombre: 'Bogotá', coords: [4.7110, -74.0721] },
  { nombre: 'Buenos Aires', coords: [-34.6037, -58.3816] },
  { nombre: 'Santiago', coords: [-33.4489, -70.6693] },

  // EUA / Canadá
  { nombre: 'Nueva York', coords: [40.7128, -74.0060] },
  { nombre: 'Vancouver', coords: [49.2827, -123.1207] },
  { nombre: 'Montreal', coords: [45.5017, -73.5673] },

  // Asia
  { nombre: 'Tokio', coords: [35.6895, 139.6917] },
  { nombre: 'Seúl', coords: [37.5665, 126.9780] },
  { nombre: 'Shanghái', coords: [31.2304, 121.4737] },
  { nombre: 'Dubái', coords: [25.2048, 55.2708] },

  // Europa
  { nombre: 'Madrid', coords: [40.4168, -3.7038] },
  { nombre: 'París', coords: [48.8566, 2.3522] },
  { nombre: 'Berlín', coords: [52.5200, 13.4050] },
  { nombre: 'Roma', coords: [41.9028, 12.4964] },
  { nombre: 'Londres', coords: [51.5072, -0.1276] },

  // África
  { nombre: 'El Cairo', coords: [30.0444, 31.2357] },

  // Brasil
  { nombre: 'São Paulo', coords: [-23.5505, -46.6333] },
  { nombre: 'Río de Janeiro', coords: [-22.9068, -43.1729] },
];

// Estados y probabilidad reducida de “Cancelado”
type EstadoVuelo = 'A Tiempo' | 'Retrasado' | 'Embarcando' | 'Cancelado';
function pickEstado(): EstadoVuelo {
  // Ajusta estas probabilidades a tu gusto:
  const r = Math.random();
  if (r < 0.95) return 'A Tiempo';       // 70% A Tiempo
  else if (r < 0.85) return 'Retrasado';  // 15% Retrasado
  else if (r < 0.75) return 'Embarcando'; // 10% Embarcando
  else return 'Cancelado';               // 5% Cancelado
}

// =======================
// 2) FUNCIONES AUXILIARES
// =======================
interface Avion {
  id: number;
  origen: string;
  destino: string;
  ruta: [number, number][];
  punto: number;
  altitud: number;
  velocidad: number;
  aerolinea: string;
  estado: EstadoVuelo;
  razonCancelacion?: string;
  puerta: string;
  yaAnuncioCancelacion?: boolean;
}

// Calcular ángulo para rotar ícono
function calcularAngulo(p1: [number, number], p2: [number, number]): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const lat1 = toRad(p1[0]);
  const lon1 = toRad(p1[1]);
  const lat2 = toRad(p2[0]);
  const lon2 = toRad(p2[1]);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const brng = Math.atan2(y, x);
  return ((brng * 180 / Math.PI) + 360) % 360;
}

// Ícono custom de avión
function iconoAvion(angulo: number, colorRojo = false) {
  return L.divIcon({
    html: `
      <div style="transform: rotate(${angulo}deg); transform-origin: center;">
        <img 
          src="/icon/airplaneAm.png" 
          style="
            width: 30px;
            transform: rotate(90deg);
            ${
              colorRojo
                ? 'filter: brightness(0) saturate(100%) invert(18%) ' +
                  'sepia(93%) saturate(6688%) hue-rotate(354deg) brightness(98%) contrast(114%);'
                : ''
            }"
        />
      </div>
    `,
    iconSize: [30, 30],
    className: '',
  });
}

// Generar curva de coordenadas entre dos puntos
function generarCurva(o: [number, number], d: [number, number], puntos = 30): [number, number][] {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;
  const [lat1, lon1] = o.map(toRad) as [number, number];
  const [lat2, lon2] = d.map(toRad) as [number, number];
  const dist = Math.acos(
    Math.sin(lat1)*Math.sin(lat2) +
    Math.cos(lat1)*Math.cos(lat2)*Math.cos(lon2 - lon1)
  );

  if (Number.isNaN(dist)) {
    console.warn("No se pudo calcular la distancia, revisa coords:", o, d);
    return [];
  }

  const arr: [number, number][] = [];
  for (let i = 0; i <= puntos; i++) {
    const f = i / puntos;
    const A = Math.sin((1-f)*dist)/Math.sin(dist);
    const B = Math.sin(f*dist)/Math.sin(dist);
    const x = A*Math.cos(lat1)*Math.cos(lon1) + B*Math.cos(lat2)*Math.cos(lon2);
    const y = A*Math.cos(lat1)*Math.sin(lon1) + B*Math.cos(lat2)*Math.sin(lon2);
    const z = A*Math.sin(lat1) + B*Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x*x + y*y));
    const lon = Math.atan2(y, x);
    arr.push([toDeg(lat), toDeg(lon)]);
  }
  return arr;
}

// Generar un avión con probabilidad reducida de cancelación
function generarAvion(id: number): Avion | null {
  const ori = origenes[Math.floor(Math.random() * origenes.length)];
  const destKeys = Object.keys(destinos_coords);
  if (!destKeys.length) {
    console.error("No hay destinos en destinos_coords");
    return null;
  }

  const destName = destKeys[Math.floor(Math.random() * destKeys.length)];
  const destinoCoords = destinos_coords[destName];
  if (!destinoCoords) {
    console.warn("No se encontraron coords para destino:", destName);
    return null;
  }

  const estado = pickEstado();
  let razon: string | undefined;
  if (estado === 'Cancelado') {
    razon = razonesCancelacion[Math.floor(Math.random() * razonesCancelacion.length)];
  }

  const ruta = generarCurva(ori.coords, destinoCoords);
  if (!ruta.length) {
    console.warn("Ruta inválida (vacía) entre:", ori.nombre, "→", destName);
    return null;
  }

  return {
    id,
    origen: ori.nombre,
    destino: destName,
    ruta,
    punto: 0,
    altitud: Math.floor(5000 + Math.random() * 30000),
    velocidad: Math.floor(400 + Math.random() * 200),
    aerolinea: ['Aeroméxico','Volaris','VivaAerobus','Delta','United','Copa Airlines'][Math.floor(Math.random() * 6)],
    estado,
    razonCancelacion: razon,
    puerta: ['A1','B2','C3','D4','E5','F6'][Math.floor(Math.random() * 6)],
  };
}

interface QueueTask {
  flightId?: number;
  text: string;
  callback?: () => void;
}

function anunciarTexto(texto: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'es-MX';
    utter.pitch = 1.1;
    utter.rate = 0.95;
    utter.onend = () => resolve();

    const voces = synth.getVoices();
    const voz = voces.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('female'))
             || voces.find(v => v.lang.startsWith('es'));
    if (voz) utter.voice = voz;

    synth.speak(utter);
  });
}

// =======================
// 3) COMPONENTE PRINCIPAL
// =======================
export default function SimuladorAviones() {
  const [aviones, setAviones] = useState<Avion[]>([]);
  const [vuelosAterrizados, setVuelosAterrizados] = useState<Avion[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  // Audios
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const despegueAudio = useRef<HTMLAudioElement | null>(null);
  const aterrizajeAudio = useRef<HTMLAudioElement | null>(null);

  // Colas (cancel/normal)
  const cancelQueueRef = useRef<QueueTask[]>([]);
  const normalQueueRef = useRef<QueueTask[]>([]);
  const processingRef = useRef<boolean>(false);

  // Para tooltip permanente
  const [currentAnnouncedFlightId, setCurrentAnnouncedFlightId] = useState<number | null>(null);

  // Vista seleccionada
  // 'panel' -> sólo panel y llegadas
  // 'map'   -> sólo mapa
  // 'both'  -> panel y mapa
  const [viewMode, setViewMode] = useState<'panel' | 'map' | 'both'>('both');

  // Estado para el menú hamburguesa
  const [menuOpen, setMenuOpen] = useState(false);

  // 1) Cargar audios
  useEffect(() => {
    audioRef.current = new Audio('/audio/flyby.mp3');
    despegueAudio.current = new Audio('/audio/departure.mp3');
    aterrizajeAudio.current = new Audio('/audio/landing.mp3');
  }, []);

  // 2) Reordenar un vuelo en el panel
  function reorderFlightToTop(flightId: number) {
    setAviones((prev) => {
      const idx = prev.findIndex(a => a.id === flightId);
      if (idx < 0) return prev;
      const selected = prev[idx];
      return [selected, ...prev.slice(0, idx), ...prev.slice(idx+1)];
    });
  }

  // 3) Procesar colas
  function processQueues() {
    if (processingRef.current) return;
    processingRef.current = true;

    const processNext = () => {
      const cancelTask = cancelQueueRef.current.shift();
      if (cancelTask) {
        if (cancelTask.flightId != null) {
          setCurrentAnnouncedFlightId(cancelTask.flightId);
          reorderFlightToTop(cancelTask.flightId);
        }
        anunciarTexto(cancelTask.text).then(() => {
          cancelTask.callback?.();
          processNext();
        });
      } else {
        const normalTask = normalQueueRef.current.shift();
        if (normalTask) {
          if (normalTask.flightId != null) {
            setCurrentAnnouncedFlightId(normalTask.flightId);
            reorderFlightToTop(normalTask.flightId);
          }
          anunciarTexto(normalTask.text).then(() => {
            normalTask.callback?.();
            processNext();
          });
        } else {
          setCurrentAnnouncedFlightId(null);
          processingRef.current = false;
        }
      }
    };
    processNext();
  }

  function enqueueCancelTask(flightId: number, text: string, callback?: () => void) {
    cancelQueueRef.current.push({ flightId, text, callback });
    processQueues();
  }

  function enqueueNormalTask(flightId: number, text: string, callback?: () => void) {
    normalQueueRef.current.push({ flightId, text, callback });
    processQueues();
  }

  // 4) Interval ppal para generar y mover aviones
  useEffect(() => {
    const interval = setInterval(() => {
      setAviones((prev) => {
        let newFlights = [...prev];
        const aterrizados: Avion[] = [];

        // Avanzar cada avión
        for (let i = 0; i < newFlights.length; i++) {
          const av = newFlights[i];
          if (av.estado === 'Cancelado') {
            if (!av.yaAnuncioCancelacion) {
              enqueueCancelTask(av.id,
                `El vuelo con destino a ${av.destino} se encuentra cancelado.
                 Por: ${av.razonCancelacion || 'No especificada'}.`,
                () => {
                  setAviones(old => old.filter(x => x.id !== av.id));
                }
              );
              newFlights[i] = { ...av, yaAnuncioCancelacion: true };
            }
          } else {
            const nextP = av.punto + 1;
            if (nextP >= av.ruta.length) {
              // Aterrizó
              aterrizados.push(av);
              newFlights[i] = null as any;
            } else {
              newFlights[i] = { ...av, punto: nextP };
            }
          }
        }

        // Quitar nulos (aterrizados)
        newFlights = newFlights.filter(Boolean) as Avion[];

        // Manejar aterrizados
        for (const av of aterrizados) {
          aterrizajeAudio.current?.play();
          const destinoCoords = destinos_coords[av.destino];
          if (mapRef.current && destinoCoords) {
            mapRef.current.flyTo(destinoCoords, 10, { duration: 1.5 });
          }
          setVuelosAterrizados((old) => [...old.slice(-9), av]);
          enqueueNormalTask(av.id,
            `Bienvenidos a ${av.destino}. Les recordamos permanecer sentados hasta que el avión llegue a su posición final.`
          );
        }

        return newFlights;
      });

      // Generar nuevo vuelo
      if (Math.random() < 0.96) {
        const nuevo = generarAvion(Date.now());
        if (!nuevo) {
          console.warn("No se pudo generar vuelo (coords inválidas). Se omite.");
          return;
        }
        audioRef.current?.play();
        despegueAudio.current?.play();

        const origenCoords = origenes.find(o => o.nombre === nuevo.origen)?.coords;
        if (mapRef.current && origenCoords) {
          mapRef.current.flyTo(origenCoords, 10, { duration: 1.5 });
        }

        setAviones((prev) => [nuevo, ...prev]);

        if (nuevo.estado !== 'Cancelado') {
          const distKm = origenCoords
            ? L.latLng(origenCoords).distanceTo(L.latLng(destinos_coords[nuevo.destino])) / 1000
            : 0;
          const minEst = Math.round((distKm / nuevo.velocidad) * 60);

          enqueueNormalTask(nuevo.id,
            `El vuelo con destino a ${nuevo.destino} ha despegado.
             Por favor, mantengan sus cinturones de seguridad abrochados durante el vuelo.
             Les deseamos un viaje placentero con ${nuevo.aerolinea}.
             Altitud estimada: ${nuevo.altitud} pies.
             Velocidad: ${nuevo.velocidad} km/h.
             Duración: ${minEst} minutos.`
          );
        }
      }
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // 5) Forzar un re-cálculo del tamaño del mapa al cambiar a "map" o "both"
  useEffect(() => {
    if (mapRef.current) {
      // Dejamos un pequeño retardo
      setTimeout(() => {
        mapRef.current!.invalidateSize();
      }, 200);
    }
  }, [viewMode]);

  // Determinar color de tarjeta según estado
  function getCardColor(estado: EstadoVuelo) {
    switch (estado) {
      case 'Cancelado': return 'bg-orange-600';
      case 'Retrasado': return 'bg-yellow-600';
      default: return 'bg-[#2b2b3c]';
    }
  }

  // Tomar sólo 10 vuelos (listado circular visible en el panel)
  const avionesParaPanel = aviones.slice(0, 7);

  // ================
  // RENDER
  // ================
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Menú Superior con Hamburguesa */}
      <header className="bg-gray-900 p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Control de Tráfico Aéreo</h1>
        
        {/* Botón hamburguesa */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white focus:outline-none"
        >
          {/* Un simple icono “hamburguesa” con 3 barras */}
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Opciones del menú (visibles sólo cuando menuOpen es true) */}
        {menuOpen && (
          <div className="absolute top-16 right-4 bg-gray-800 p-3 rounded-md shadow-md flex flex-col gap-2">
            <button
              onClick={() => {
                setViewMode('panel');
                setMenuOpen(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md text-sm"
            >
              Solo Panel y Llegadas
            </button>
            {/*<button
              onClick={() => {
                setViewMode('map');
                setMenuOpen(false);
              }}
              className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md text-sm"
            >
              Solo Mapa
            </button>*/}
            <button
              onClick={() => {
                setViewMode('both');
                setMenuOpen(false);
              }}
              className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-md text-sm"
            >
              Panel y Mapa
            </button>
          </div>
        )}
      </header>

      {/* Dependiendo de la vista, mostramos distintas secciones */}
      {viewMode === 'panel' && (
        <>
          {/* SOLO PANEL Y LLEGADAS */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-1 flex-1">
              <div className="border-gray-700 bg-[#1e1e2e] p-4 overflow-y-auto h-full">
                <h2 className="text-2xl font-bold mb-4">🛫 Panel de Vuelos</h2>
                <ScrollArea>
                  <div className="space-y-4">
                    {avionesParaPanel.map((vuelo) => (
                      <div
                        key={`card-${vuelo.id}`}
                        className={`
                          rounded-lg shadow-md p-4 cursor-pointer
                          transition-colors duration-700 text-white
                          ${getCardColor(vuelo.estado)}
                        `}
                        onClick={() => {
                          // Aquí NO volamos el mapa porque no se ve en esta vista.
                        }}
                      >
                        <div className="font-semibold text-lg">
                          {vuelo.origen} → {vuelo.destino}
                        </div>
                        <div className="text-sm text-gray-200">{vuelo.aerolinea}</div>
                        <div className="text-xs text-gray-300">
                          Alt: {vuelo.altitud} ft · Vel: {vuelo.velocidad} km/h
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
                          <Badge className="bg-gray-700 text-white">
                            {vuelo.puerta}
                          </Badge>
                          <Badge className="bg-gray-800 text-white">
                            {vuelo.estado}
                          </Badge>
                          {vuelo.estado === 'Cancelado' && (
                            <span className="text-xs text-red-200 italic">
                              {vuelo.razonCancelacion || 'No especificada'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* ÚLTIMO VUELO ATERRIZADO */}
          {vuelosAterrizados.length > 0 && (
            <div className="bg-[#111827] text-white p-6 border-t border-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-yellow-400">🛬 Último Aterrizaje</h3>
              <div className="bg-[#1f2937] p-4 rounded-lg shadow-md flex flex-col gap-2">
                {(() => {
                  const ultimo = vuelosAterrizados.at(-1);
                  if (!ultimo) return null;
                  return (
                    <>
                      <div className="text-xl font-semibold">
                        {ultimo.origen} → {ultimo.destino}
                      </div>
                      <div className="text-lg text-gray-300">
                        ✈️ {ultimo.aerolinea}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-base">
                        <span className="bg-blue-600 px-3 py-1 rounded-full">
                          Altitud: {ultimo.altitud} ft
                        </span>
                        <span className="bg-green-600 px-3 py-1 rounded-full">
                          Velocidad: {ultimo.velocidad} km/h
                        </span>
                        <span className="bg-purple-600 px-3 py-1 rounded-full">
                          Puerta: {ultimo.puerta}
                        </span>
                        <span className="bg-red-600 px-3 py-1 rounded-full">
                          Estado: {ultimo.estado}
                        </span>
                        {ultimo.estado === 'Cancelado' && (
                          <span className="bg-red-800 px-3 py-1 rounded-full">
                            Razón: {ultimo.razonCancelacion || 'No especificada'}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === 'map' && (
        <>
          {/* SOLO MAPA */}
          <div className="flex-1">
            <MapContainer
              center={[23.6345, -102.5528]}
              zoom={5}
              scrollWheelZoom
              className="w-full h-full"
              whenCreated={(map) => { mapRef.current = map; }}
            >
              {/* TileLayer de Stamen Watercolor (efecto “nubes”) */}
              <TileLayer
                attribution='Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.'
                url="https://stamen-tiles.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg"
              />
              {aviones.map((vuelo) => {
                const idx = vuelo.punto;
                const actualPos = vuelo.ruta[idx];
                if (!actualPos || Number.isNaN(actualPos[0]) || Number.isNaN(actualPos[1])) {
                  console.warn("Coordenadas inválidas en render:", vuelo, actualPos);
                  return null;
                }
                const isCancel = (vuelo.estado === 'Cancelado');
                const isBeingAnnounced = (vuelo.id === currentAnnouncedFlightId);

                return (
                  <div key={`avion-${vuelo.id}`}>
                    <Marker
                      position={actualPos}
                      icon={iconoAvion(
                        (calcularAngulo(
                          actualPos,
                          vuelo.ruta[idx+1] || actualPos
                        ) - 85 + 360) % 360,
                        isCancel
                      )}
                    >
                      {isBeingAnnounced ? (
                        <Tooltip permanent direction="top" offset={[0, -15]}>
                          ✈️ {vuelo.origen} → {vuelo.destino}<br />
                          Alt: {vuelo.altitud} ft - Vel: {vuelo.velocidad} km/h
                          {isCancel && (
                            <div style={{ color:'red', fontWeight:'bold' }}>
                              Cancelado: {vuelo.razonCancelacion || 'Sin razón'}
                            </div>
                          )}
                        </Tooltip>
                      ) : (
                        <Tooltip direction="top" offset={[0, -15]}>
                          {vuelo.origen} → {vuelo.destino}
                        </Tooltip>
                      )}
                    </Marker>

                    {vuelo.ruta && vuelo.ruta.length > 1 && (
                      <Polyline
                        positions={vuelo.ruta}
                        pathOptions={{ color: '#999', weight: 2, dashArray: '3' }}
                      />
                    )}
                  </div>
                );
              })}
            </MapContainer>
          </div>
        </>
      )}

      {viewMode === 'both' && (
        <>
          {/* PANEL + MAPA (vista original) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 flex-1">
            <div className="order-1 lg:col-span-2 h-[50vh] lg:h-auto">
              <MapContainer
                center={[23.6345, -102.5528]}
                zoom={5}
                scrollWheelZoom
                className="w-full h-full"
                whenCreated={(map) => { mapRef.current = map; }}
              >
                
                <TileLayer
                  attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
                  url={`https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${STADIA_TOKEN}`}
                />
                {aviones.map((vuelo) => {
                  const idx = vuelo.punto;
                  const actualPos = vuelo.ruta[idx];
                  if (!actualPos || Number.isNaN(actualPos[0]) || Number.isNaN(actualPos[1])) {
                    console.warn("Coordenadas inválidas en render:", vuelo, actualPos);
                    return null;
                  }
                  const isCancel = (vuelo.estado === 'Cancelado');
                  const isBeingAnnounced = (vuelo.id === currentAnnouncedFlightId);

                  return (
                    <div key={`avion-${vuelo.id}`}>
                      <Marker
                        position={actualPos}
                        icon={iconoAvion(
                          (calcularAngulo(
                            actualPos,
                            vuelo.ruta[idx+1] || actualPos
                          ) - 85 + 360) % 360,
                          isCancel
                        )}
                      >
                        {isBeingAnnounced ? (
                          <Tooltip permanent direction="top" offset={[0, -15]}>
                            ✈️ {vuelo.origen} → {vuelo.destino}<br />
                            Alt: {vuelo.altitud} ft - Vel: {vuelo.velocidad} km/h
                            {isCancel && (
                              <div style={{ color:'red', fontWeight:'bold' }}>
                                Cancelado: {vuelo.razonCancelacion || 'Sin razón'}
                              </div>
                            )}
                          </Tooltip>
                        ) : (
                          <Tooltip direction="top" offset={[0, -15]}>
                            {vuelo.origen} → {vuelo.destino}
                          </Tooltip>
                        )}
                      </Marker>

                      {vuelo.ruta && vuelo.ruta.length > 1 && (
                        <Polyline
                          positions={vuelo.ruta}
                          pathOptions={{ color: '#999', weight: 2, dashArray: '3' }}
                        />
                      )}
                    </div>
                  );
                })}
              </MapContainer>
            </div>

            {/* Panel de Vuelos */}
            <div className="order-2 border-l border-gray-700 bg-[#1e1e2e] p-4 overflow-y-auto h-full">
              <h2 className="text-2xl font-bold mb-4">🛫 Panel de Vuelos</h2>
              <ScrollArea>
                <div className="space-y-4">
                  {avionesParaPanel.map((vuelo) => (
                    <div
                      key={`card-${vuelo.id}`}
                      className={`
                        rounded-lg shadow-md p-4 cursor-pointer
                        transition-colors duration-700 text-white
                        ${getCardColor(vuelo.estado)}
                      `}
                      onClick={() => {
                        if (vuelo.estado === 'Cancelado') return;
                        const coords = vuelo.ruta[vuelo.punto];
                        if (!coords) return;
                        if (mapRef.current) {
                          mapRef.current.flyTo(coords, 13, { animate: true, duration: 1.2 });
                          setTimeout(() => {
                            mapRef.current!.invalidateSize();
                          }, 1300);
                        }
                      }}
                    >
                      <div className="font-semibold text-lg">
                        {vuelo.origen} → {vuelo.destino}
                      </div>
                      <div className="text-sm text-gray-200">{vuelo.aerolinea}</div>
                      <div className="text-xs text-gray-300">
                        Alt: {vuelo.altitud} ft · Vel: {vuelo.velocidad} km/h
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap items-center">
                        <Badge className="bg-gray-700 text-white">
                          {vuelo.puerta}
                        </Badge>
                        <Badge className="bg-gray-800 text-white">
                          {vuelo.estado}
                        </Badge>
                        {vuelo.estado === 'Cancelado' && (
                          <span className="text-xs text-red-200 italic">
                            {vuelo.razonCancelacion || 'No especificada'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Último Vuelo Aterrizado */}
          {vuelosAterrizados.length > 0 && (
            <div className="bg-[#111827] text-white p-6 border-t border-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-yellow-400">🛬 Último Aterrizaje</h3>
              <div className="bg-[#1f2937] p-4 rounded-lg shadow-md flex flex-col gap-2">
                {(() => {
                  const ultimo = vuelosAterrizados.at(-1);
                  if (!ultimo) return null;
                  return (
                    <>
                      <div className="text-xl font-semibold">
                        {ultimo.origen} → {ultimo.destino}
                      </div>
                      <div className="text-lg text-gray-300">
                        ✈️ {ultimo.aerolinea}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-base">
                        <span className="bg-blue-600 px-3 py-1 rounded-full">
                          Altitud: {ultimo.altitud} ft
                        </span>
                        <span className="bg-green-600 px-3 py-1 rounded-full">
                          Velocidad: {ultimo.velocidad} km/h
                        </span>
                        <span className="bg-purple-600 px-3 py-1 rounded-full">
                          Puerta: {ultimo.puerta}
                        </span>
                        <span className="bg-red-600 px-3 py-1 rounded-full">
                          Estado: {ultimo.estado}
                        </span>
                        {ultimo.estado === 'Cancelado' && (
                          <span className="bg-red-800 px-3 py-1 rounded-full">
                            Razón: {ultimo.razonCancelacion || 'No especificada'}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
