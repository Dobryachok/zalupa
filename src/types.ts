export interface WeatherData {
  temperature: number; // in Celsius
  windSpeed: number; // in m/s
  windDirection: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'; // wind source
  precipitation: 'none' | 'rain' | 'snow' | 'sleet';
  humidity: number; // percentage
  pressure: number; // mm Hg
}

export interface WaterLevelState {
  currentLevel: number; // relative to normal river level standard (в см от нуля гидропоста)
  targetLevel: number; // for smooth animation transitions
  isGesGatesOpen: boolean; // whether the Krasnoyarsk Hydroelectric Station spillway gates are open
  gesDischargeRate: number; // water discharge rate in m³/s (e.g. 2000 to 12000)
}

export interface IceState {
  averageThickness: number; // average thickness in cm (0 to 150)
  iceCoverage: number; // percentage of surface frozen (0 to 100)
  iceType: 'none' | 'slush' | 'drift' | 'fast'; // шуга, дрейфующий лед, припай
  crackRisk: 'low' | 'medium' | 'high'; // safety factor for walkers/fishers
}

export interface MonitoringStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  currentLevel: number; // calculated water level at station in cm
  trend: 'up' | 'down' | 'stable';
  isCritical: boolean;
  stationType: 'river' | 'reservoir' | 'tributary';
  criticalLevelHigh: number; // Critical high level in cm
  criticalLevelLow: number; // Critical low level in cm
}

export type MapViewType = 'scheme' | 'satellite' | 'hybrid';

export interface MapLayerConfig {
  water: boolean;
  ice: boolean;
  weather: boolean;
  shipping: boolean; // фарватер, судоходные знаки
  stations: boolean; // гидропосты мониторинга
  depth: boolean; // GEBCO/Рельеф дна
}
