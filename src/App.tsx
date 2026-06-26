import { useState, useEffect, useMemo } from 'react';
import { 
  WaterLevelState, 
  IceState, 
  WeatherData, 
  MapLayerConfig, 
  MapViewType, 
  MonitoringStation 
} from './types';
import HydroMap from './components/HydroMap';
import SearchSidebar from './components/SearchSidebar';
import { 
  Anchor, 
  Clock, 
  RefreshCw, 
  Compass, 
  Waves, 
  Info,
  Layers,
  Flame,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Snowflake,
  ShieldAlert
} from 'lucide-react';

export default function App() {
  // 1. Central Hydrology and Environmental States (Yenisey / Krasnoyarsk context)
  const [waterState, setWaterState] = useState<WaterLevelState>({
    currentLevel: 120, // normal level in cm above gauge zero
    targetLevel: 120,
    isGesGatesOpen: false,
    gesDischargeRate: 2600 // starting discharge in m³/s
  });

  const [iceState, setIceState] = useState<IceState>({
    averageThickness: 0,
    iceCoverage: 0,
    iceType: 'none',
    crackRisk: 'low'
  });

  const [weather, setWeather] = useState<WeatherData>({
    temperature: 22,
    windSpeed: 3,
    windDirection: 'SW',
    precipitation: 'none',
    humidity: 55,
    pressure: 745
  });

  const [layers, setLayers] = useState<MapLayerConfig>({
    water: true,
    ice: true,
    weather: true,
    shipping: true,
    stations: true,
    depth: true
  });

  const [viewType, setViewType] = useState<MapViewType>('scheme');
  const [selectedStation, setSelectedStation] = useState<MonitoringStation | null>(null);
  const [mockTime, setMockTime] = useState<string>('');

  // Setup current local clock (Krasnoyarsk UTC+7 style)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Krasnoyarsk is UTC+7, which is +4 hours from Moscow. Let's format it nicely.
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Krasnoyarsk'
      };
      setMockTime(now.toLocaleTimeString('ru-RU', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Monitoring Stations Data Synchronization with real-world Yenisey physics
  const getRecalculatedStations = (): MonitoringStation[] => {
    const baseLevel = waterState.currentLevel;
    const discharge = waterState.gesDischargeRate;

    // We calculate levels at different gauge stations along the Yenisey river:
    return [
      {
        id: 'divnogorsk',
        name: 'г. Дивногорск (ниже Красноярской ГЭС)',
        lat: 55.9597,
        lng: 92.3688,
        // Extremely dependent on the direct GES discharge
        currentLevel: Math.round((discharge - 2000) * 0.05 + baseLevel * 0.3),
        trend: discharge > 3500 ? 'up' : discharge < 2200 ? 'down' : 'stable',
        isCritical: Math.round((discharge - 2000) * 0.05 + baseLevel * 0.3) >= 450,
        stationType: 'river',
        criticalLevelHigh: 450,
        criticalLevelLow: -30
      },
      {
        id: 'krasnoyarsk',
        name: 'г. Красноярск (остров Отдыха)',
        lat: 56.0090,
        lng: 92.8970,
        // Highly dependent on GES discharge + tributary inputs
        currentLevel: Math.round((discharge - 2000) * 0.042 + baseLevel * 0.45),
        trend: discharge > 3000 ? 'up' : discharge < 2400 ? 'down' : 'stable',
        isCritical: Math.round((discharge - 2000) * 0.042 + baseLevel * 0.45) >= 500,
        stationType: 'river',
        criticalLevelHigh: 500,
        criticalLevelLow: -50
      },
      {
        id: 'yeniseysk',
        name: 'г. Енисейск (Средний Енисей)',
        lat: 58.4520,
        lng: 92.1830,
        // Spring thaw and ice jams cause extreme water level rises here (up to 8-10 meters!)
        currentLevel: Math.round(
          baseLevel * 1.1 + 
          (iceState.averageThickness > 35 && weather.temperature > -5 ? 280 : 0) // Ice jam water pileup effect
        ),
        trend: baseLevel > 200 ? 'up' : baseLevel < 50 ? 'down' : 'stable',
        isCritical: Math.round(baseLevel * 1.1 + (iceState.averageThickness > 35 && weather.temperature > -5 ? 280 : 0)) >= 800,
        stationType: 'river',
        criticalLevelHigh: 800,
        criticalLevelLow: -100
      },
      {
        id: 'igarka',
        name: 'г. Игарка (Заполярный Енисей)',
        lat: 67.4667,
        lng: 86.5333,
        currentLevel: Math.round(baseLevel * 1.25),
        trend: baseLevel > 250 ? 'up' : 'stable',
        isCritical: Math.round(baseLevel * 1.25) >= 1200,
        stationType: 'river',
        criticalLevelHigh: 1200,
        criticalLevelLow: -150
      },
      {
        id: 'dudinka',
        name: 'г. Дудинка (Устье Енисея)',
        lat: 69.4000,
        lng: 86.1833,
        currentLevel: Math.round(baseLevel * 1.4),
        trend: baseLevel > 300 ? 'up' : 'stable',
        isCritical: Math.round(baseLevel * 1.4) >= 1400,
        stationType: 'river',
        criticalLevelHigh: 1400,
        criticalLevelLow: -200
      }
    ];
  };

  const stations = useMemo(() => getRecalculatedStations(), [
    waterState.currentLevel,
    waterState.gesDischargeRate,
    iceState.averageThickness,
    weather.temperature
  ]);
  const currentSelectedStationObj = selectedStation 
    ? stations.find(s => s.id === selectedStation.id) || null 
    : null;

  // Reset all simulation parameters to default baseline levels
  const handleResetState = () => {
    setWaterState({
      currentLevel: 120,
      targetLevel: 120,
      isGesGatesOpen: false,
      gesDischargeRate: 2600
    });
    setIceState({
      averageThickness: 0,
      iceCoverage: 0,
      iceType: 'none',
      crackRisk: 'low'
    });
    setWeather({
      temperature: 22,
      windSpeed: 3,
      windDirection: 'SW',
      precipitation: 'none',
      humidity: 55,
      pressure: 745
    });
    setLayers({
      water: true,
      ice: false,
      weather: false,
      shipping: true,
      stations: true,
      depth: true
    });
  };

  // Global warnings evaluation based on levels
  const hasCriticalFlooding = stations.some(s => s.isCritical);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col transition-colors duration-300">
      
      {/* 1. PROFESSIONAL YANDEX MAPS-STYLE HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-sm px-6 py-3.5 flex flex-wrap justify-between items-center gap-4">
        
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Anchor className="stroke-[2.5]" size={22} />
          </div>
        </div>

        {/* Dashboard Status Controls */}
        <div className="flex items-center gap-4 text-xs">
          
          {/* Krasnoyarsk Local Time indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-full font-mono text-slate-600">
            <Clock size={13} className="text-slate-400" />
            <span className="font-bold">{mockTime || '00:00:00'}</span>
          </div>

          {/* Master Reset Button */}
          <button 
            onClick={handleResetState}
            className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-full cursor-pointer shadow-sm transition-all"
            title="Сбросить все параметры к норме"
          >
            <RefreshCw size={13} className="text-slate-500" />
          </button>
        </div>
      </header>

      {/* 2. CORE WORKSPACE */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* Dynamic warning banner if flooding or severe GES discharges are active */}
        {waterState.gesDischargeRate >= 7000 && (
          <div className="p-4 bg-rose-500/5 border border-rose-500/20 text-rose-700 rounded-2xl text-xs flex gap-3.5 items-start text-left shadow-sm">
            <ShieldAlert className="shrink-0 text-rose-500 mt-0.5" size={20} />
            <div>
              <strong className="font-extrabold text-rose-800 text-sm">Внимание! Чрезвычайный холостой водосброс Красноярской ГЭС</strong> 
              <p className="mt-1 text-slate-600">
                Расход воды через плотину увеличен до <strong className="text-rose-700">{waterState.gesDischargeRate} м³/с</strong>. Открыты водосбросные пролеты. 
                Угроза подтопления пониженных участков Красноярска, Дивногорска и прибрежных дачных поселков ниже по течению Енисея. Набережные города залиты водой!
              </p>
            </div>
          </div>
        )}

        {/* TOP LEVEL: SIDEPANEL & INTERACTIVE LEAFLET GEO-MAP CONTAINER */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Yandex Maps-style side search & presets console */}
          <SearchSidebar
            waterState={waterState}
            setWaterState={setWaterState}
            iceState={iceState}
            setIceState={setIceState}
            weather={weather}
            setWeather={setWeather}
            layers={layers}
            setLayers={setLayers}
            viewType={viewType}
            setViewType={setViewType}
            stations={stations}
            selectedStation={currentSelectedStationObj}
            onStationSelect={setSelectedStation}
          />

          {/* Interactive OSM Geo Map */}
          <div className="flex-1 flex flex-col gap-4">
            <HydroMap
              waterState={waterState}
              iceState={iceState}
              weather={weather}
              layers={layers}
              viewType={viewType}
              stations={stations}
              onStationSelect={setSelectedStation}
              selectedStationId={selectedStation ? selectedStation.id : null}
              onWaterLevelChange={(level) => setWaterState(prev => ({ ...prev, currentLevel: level }))}
            />
          </div>
        </div>

        {/* BOTTOM DETAILS GRID - ADVANCED TECHNICAL INFO CARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Waves size={18} />
              </div>
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-tight">Режим реки Енисей</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Енисей — величайшая река Сибири с ярко выраженным весенним половодьем и летне-осенними паводками. В зимний период регулируется водохранилищем Саяно-Шушенской и Красноярской ГЭС.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-150 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Базис замера:</span>
                <span className="font-bold text-slate-800">Балтийская система (БСВ)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Средний годовой сток:</span>
                <span className="font-bold text-slate-800">19 800 м³/с</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={18} />
              </div>
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-tight">Красноярский гидроузел</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Плотиной ГЭС образовано Красноярское море объемом 73 км³. Нормальный подпорный уровень (НПУ) равен 243 метрам, превышение которого ведет к открытию водосброса.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-150 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Сбросной лимит Красноярска:</span>
                <span className="font-bold text-slate-800">~6 000 м³/с</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Текущая пропускная способность:</span>
                <span className="font-bold text-slate-800">14 000 м³/с</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <Snowflake size={18} />
              </div>
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-tight">Ледовые переправы и риски</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Особенность Енисея ниже ГЭС — полынья длиной 100-200 км, парящая всю зиму. На остальной части края лед стабилен и служит основной транспортной артерией зимой (зимники).
            </p>
            <div className="mt-4 pt-3 border-t border-slate-150 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Минимум для пешеходов:</span>
                <span className="font-bold text-slate-800">15 см</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Минимум для автомобилей:</span>
                <span className="font-bold text-slate-800">45-50 см</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* 3. FOOTER INFO DETAILS */}
      <footer className="mt-auto py-5 bg-white border-t border-slate-200/80 text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between gap-4 items-center">
          <div>
            Система мониторинга вод Енисейского бассейнового управления • ГУ МЧС по Красноярскому краю
          </div>
          <div>
            © {new Date().getFullYear()} ГидроКарта Красноярского Края
          </div>
        </div>
      </footer>
    </div>
  );
}
