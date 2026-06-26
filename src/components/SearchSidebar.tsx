import React, { useState } from 'react';
import { 
  WaterLevelState, 
  IceState, 
  WeatherData, 
  MapLayerConfig, 
  MapViewType, 
  MonitoringStation 
} from '../types';
import { 
  Layers, 
  Sliders, 
  MapPin, 
  Waves, 
  Snowflake, 
  Wind, 
  Thermometer, 
  Sun, 
  Map, 
  AlertTriangle, 
  ArrowUp, 
  ArrowDown, 
  X,
  XCircle,
  HelpCircle,
  TrendingUp,
  Info
} from 'lucide-react';

interface SearchSidebarProps {
  waterState: WaterLevelState;
  setWaterState: React.Dispatch<React.SetStateAction<WaterLevelState>>;
  iceState: IceState;
  setIceState: React.Dispatch<React.SetStateAction<IceState>>;
  weather: WeatherData;
  setWeather: React.Dispatch<React.SetStateAction<WeatherData>>;
  layers: MapLayerConfig;
  setLayers: React.Dispatch<React.SetStateAction<MapLayerConfig>>;
  viewType: MapViewType;
  setViewType: (type: MapViewType) => void;
  stations: MonitoringStation[];
  selectedStation: MonitoringStation | null;
  onStationSelect: (station: MonitoringStation | null) => void;
}

const SEARCH_SUGGESTIONS = [
  { name: 'Красноярск (в районе о. Отдыха)', stationId: 'krasnoyarsk', desc: 'Центральный пост мониторинга в городской черте' },
  { name: 'Дивногорск (ниже ГЭС)', stationId: 'divnogorsk', desc: 'Пост непосредственно под плотиной Красноярской ГЭС' },
  { name: 'Енисейск', stationId: 'yeniseysk', desc: 'Старейший город на Енисее, точка заторов весеннего ледохода' },
  { name: 'Игарка', stationId: 'igarka', desc: 'Заполярный порт, критический мониторинг толщины льда' },
  { name: 'Дудинка', stationId: 'dudinka', desc: 'Низовья Енисея, морской и речной порт Норникеля' },
];

export default function SearchSidebar({
  waterState,
  setWaterState,
  iceState,
  setIceState,
  weather,
  setWeather,
  layers,
  setLayers,
  viewType,
  setViewType,
  stations,
  selectedStation,
  onStationSelect
}: SearchSidebarProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'settings'>('layers');

  // Toggle checklist layers
  const toggleLayer = (layerKey: keyof MapLayerConfig) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: !prev[layerKey]
    }));
  };

  return (
    <div className="w-full md:w-[380px] bg-white border border-slate-200/80 rounded-2xl shadow-md flex flex-col overflow-hidden max-h-[720px] transition-all">
      <div className="flex border-b border-slate-100 bg-white">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'layers' 
              ? 'border-blue-500 text-blue-600 bg-blue-50/20' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers size={14} /> Подложки и Слои
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'settings' 
              ? 'border-blue-500 text-blue-600 bg-blue-50/20' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Sliders size={14} /> Симуляция
        </button>
      </div>

      {/* 3. SCROLLABLE CONTENTS AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left bg-white">

        {/* TAB 2: ACTIVE LAYERS & MAP SETTINGS */}
        {activeTab === 'layers' && (
          <div className="space-y-4">
            
            {/* Map Type toggle (OSM / Satellite / Hybrid) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Реальная подложка карты</div>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['scheme', 'satellite', 'hybrid'] as MapViewType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setViewType(type)}
                    className={`py-1.5 text-center rounded-lg text-xs font-bold transition-all ${
                      viewType === type 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {type === 'scheme' ? 'OSM Схема' : type === 'satellite' ? 'Спутник' : 'Рельеф GEBCO'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {viewType === 'scheme' ? 'Используется подложка OpenStreetMap' : viewType === 'satellite' ? 'Космические снимки высокого разрешения' : 'GEBCO Bathymetric — глубинная сетка океанов и рек'}
              </p>
            </div>

            {/* Checklist Layers */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Интерактивные Слои</div>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layers.water} 
                    onChange={() => toggleLayer('water')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-500">
                      Уровень воды (Зоны затопления)
                    </div>
                    <div className="text-[10px] text-slate-400">Световое выделение опасных зон русла Енисея</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layers.ice} 
                    onChange={() => toggleLayer('ice')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-500">
                      Ледовый покров (Карта льда)
                    </div>
                    <div className="text-[10px] text-slate-400">Зона замерзания, шуга и незамерзающая полынья ГЭС</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layers.depth} 
                    onChange={() => toggleLayer('depth')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-500">
                      Глубина и Батиметрия (GEBCO)
                    </div>
                    <div className="text-[10px] text-slate-400">Градация глубин русла и водохранилища</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layers.shipping} 
                    onChange={() => toggleLayer('shipping')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-500">
                      Судоходный фарватер
                    </div>
                    <div className="text-[10px] text-slate-400">Речные створы, буи и навигационная обстановка</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layers.stations} 
                    onChange={() => toggleLayer('stations')}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-500">
                      Посты мониторинга Росгидромета
                    </div>
                    <div className="text-[10px] text-slate-400">Станции непрерывного замера на Енисее</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Quick helper card */}
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-2 text-xs">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
              <div className="text-slate-600 text-[11px] leading-normal">
                Карта полностью интерактивна. Вы можете перетаскивать маркеры, кликать на посты мониторинга и приближать участки Енисея в Красноярском крае.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MANUAL ADJUSTMENT SLIDERS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Ручное управление параметрами:
            </div>

            {/* Slider 1: Water Level (Ручной переключатель уровня воды) */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Waves size={14} className="text-blue-500" /> Уровень воды на постах
                </span>
                <span className="font-bold font-mono text-blue-600">
                  {waterState.currentLevel > 0 ? `+${waterState.currentLevel}` : waterState.currentLevel} см
                </span>
              </div>
              <input 
                type="range"
                min="-100"
                max="1000"
                value={waterState.currentLevel}
                onChange={(e) => setWaterState(prev => ({ ...prev, currentLevel: parseInt(e.target.value) }))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>-100 см (Межень)</span>
                <span>+1000 см (Критический паводок)</span>
              </div>

              {/* Dynamic feedback indicator for Flooding or Shallows */}
              <div className="mt-2.5 pt-2 border-t border-slate-150 text-[11px] leading-relaxed">
                {waterState.currentLevel > 120 ? (
                  <div className="text-blue-600 font-medium flex items-start gap-1">
                    <span className="shrink-0">🌊</span>
                    <span>
                      <strong>Зона затопления:</strong> набережные Красноярска и низменные поймы реки постепенно уходят под воду (выделено сине-оранжевым цветом).
                    </span>
                  </div>
                ) : waterState.currentLevel < 120 ? (
                  <div className="text-amber-600 font-medium flex items-start gap-1">
                    <span className="shrink-0">🏝️</span>
                    <span>
                      <strong>Обнажение мелей:</strong> на Енисее проступают реальные судоходные мели и пороги (Ладейская, Посадская, Казачинский порог и др.).
                    </span>
                  </div>
                ) : (
                  <div className="text-emerald-600 font-medium flex items-start gap-1">
                    <span className="shrink-0">✅</span>
                    <span>
                      <strong>Оптимальный уровень:</strong> русло реки в пределах нормы, навигационная обстановка безопасна.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Slider 2: Krasnoyarsk GES Spillway and Discharge */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <TrendingUp size={14} className="text-emerald-500" /> Сброс Красноярской ГЭС
                </span>
                <span className="font-bold font-mono text-emerald-600">
                  {waterState.gesDischargeRate} м³/с
                </span>
              </div>
              <input 
                type="range"
                min="1500"
                max="12000"
                step="100"
                value={waterState.gesDischargeRate}
                onChange={(e) => {
                  const rate = parseInt(e.target.value);
                  setWaterState(prev => ({ 
                    ...prev, 
                    gesDischargeRate: rate,
                    // If discharge is over 6000 m3/s, open the spillway gates
                    isGesGatesOpen: rate >= 6000
                  }));
                }}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>1500 м³/с (Санитарный)</span>
                <span>12000 м³/с (Экстремальный)</span>
              </div>
              
              {/* Checkbox for Spillway open */}
              <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Водосбросные затворы ГЭС открыты</span>
                <input 
                  type="checkbox"
                  checked={waterState.isGesGatesOpen}
                  onChange={(e) => {
                    const isOpen = e.target.checked;
                    setWaterState(prev => ({ 
                      ...prev, 
                      isGesGatesOpen: isOpen,
                      gesDischargeRate: isOpen ? Math.max(prev.gesDischargeRate, 6500) : Math.min(prev.gesDischargeRate, 4000)
                    }));
                  }}
                  className="w-3.5 h-3.5 text-rose-600 rounded border-slate-300"
                />
              </div>
            </div>

            {/* Slider 3: Ice thickness */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Snowflake size={14} className="text-sky-500" /> Толщина льда
                </span>
                <span className="font-bold font-mono text-sky-500">{iceState.averageThickness} см</span>
              </div>
              <input 
                type="range"
                min="0"
                max="150"
                value={iceState.averageThickness}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setIceState(prev => ({ 
                    ...prev, 
                    averageThickness: val,
                    iceCoverage: val === 0 ? 0 : val > 40 ? 95 : 50,
                    iceType: val === 0 ? 'none' : val < 15 ? 'slush' : val < 50 ? 'drift' : 'fast'
                  }));
                }}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>0 см (Вода)</span>
                <span>150 см (Сибирский панцирь)</span>
              </div>
            </div>

            {/* Slider 4: Temperature */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Thermometer size={14} className="text-rose-500" /> Температура воздуха
                </span>
                <span className="font-bold font-mono text-rose-500">
                  {weather.temperature > 0 ? `+${weather.temperature}` : weather.temperature}°C
                </span>
              </div>
              <input 
                type="range"
                min="-50"
                max="40"
                value={weather.temperature}
                onChange={(e) => setWeather(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>-50°C (Якутия/Заполярье)</span>
                <span>+40°C (Летний зной)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. DETAILS FOOTER FOR SELECTED MONITORING STATION */}
      {selectedStation && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-left relative transition-all">
          <button 
            onClick={() => onStationSelect(null)}
            className="absolute top-3.5 right-3 text-slate-400 hover:text-slate-600"
          >
            <XCircle size={18} />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="text-rose-500 shrink-0" size={16} />
            <span className="font-extrabold text-sm text-slate-800 leading-tight">
              {selectedStation.name}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Уровень воды</div>
              <div className={`text-base font-extrabold font-mono ${
                selectedStation.currentLevel >= selectedStation.criticalLevelHigh 
                  ? 'text-rose-500' 
                  : selectedStation.currentLevel <= selectedStation.criticalLevelLow 
                    ? 'text-amber-500' 
                    : 'text-emerald-500'
              }`}>
                {selectedStation.currentLevel > 0 ? `+${selectedStation.currentLevel}` : selectedStation.currentLevel} см
              </div>
            </div>
            
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Станция мониторинга</div>
              <div className="text-xs font-bold text-slate-700">
                {selectedStation.stationType === 'river' ? '🏞️ Речной гидропост' : selectedStation.stationType === 'reservoir' ? '🌊 Водохранилище' : '🌿 Приток Енисея'}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Статус угрозы</div>
              <div className={`text-xs font-bold ${
                selectedStation.currentLevel >= selectedStation.criticalLevelHigh 
                  ? 'text-rose-600 animate-pulse' 
                  : selectedStation.currentLevel <= selectedStation.criticalLevelLow 
                    ? 'text-amber-600' 
                    : 'text-emerald-600'
              }`}>
                {selectedStation.currentLevel >= selectedStation.criticalLevelHigh 
                  ? '⚠️ Опасный паводок!' 
                  : selectedStation.currentLevel <= selectedStation.criticalLevelLow 
                    ? '⛔ Критический спад!' 
                    : '✅ Стабильный'}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Колебание</div>
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1 font-sans">
                {selectedStation.trend === 'up' && '📈 Подъём уровня'}
                {selectedStation.trend === 'down' && '📉 Спад уровня'}
                {selectedStation.trend === 'stable' && '➡️ Стабилен'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
