import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  WaterLevelState, 
  IceState, 
  WeatherData, 
  MonitoringStation, 
  MapLayerConfig, 
  MapViewType 
} from '../types';
import { 
  Maximize2, 
  Minimize2, 
  Compass, 
  Layers, 
  Info,
  Sliders,
  Activity,
  Wind,
  Snowflake,
  ShieldAlert,
  MapPin,
  Flame
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface HydroMapProps {
  waterState: WaterLevelState;
  iceState: IceState;
  weather: WeatherData;
  layers: MapLayerConfig;
  viewType: MapViewType;
  stations: MonitoringStation[];
  onStationSelect: (station: MonitoringStation) => void;
  selectedStationId: string | null;
  onWaterLevelChange?: (level: number) => void;
}

// Coordinates of flooding polygons near Yenisey River in Krasnoyarsk
const TATYSHEV_ISLAND_COORDS: [number, number][] = [
  [56.023, 92.905], [56.035, 92.935], [56.042, 92.965], [56.035, 92.985], 
  [56.015, 92.955], [56.010, 92.925], [56.018, 92.905]
];

const RECREATION_ISLAND_COORDS: [number, number][] = [
  [55.998, 92.885], [56.008, 92.898], [56.012, 92.895], [56.014, 92.875],
  [56.002, 92.855], [55.996, 92.870]
];

const LOWER_YENISEY_FLOODPLAIN: [number, number][] = [
  [58.43, 92.15], [58.46, 92.19], [58.49, 92.17], [58.52, 92.25],
  [58.48, 92.29], [58.44, 92.24], [58.42, 92.18]
];

// New Floodable areas (excess water zones)
const LEFT_BANK_EMBANKMENT_COORDS: [number, number][] = [
  [56.009, 92.868], [56.012, 92.880], [56.014, 92.890], [56.017, 92.885], 
  [56.014, 92.872], [56.010, 92.865]
];

const YARYGIN_EMBANKMENT_COORDS: [number, number][] = [
  [55.990, 92.895], [55.996, 92.908], [55.994, 92.915], [55.988, 92.902]
];

const UST_MANA_COORDS: [number, number][] = [
  [55.940, 92.468], [55.946, 92.482], [55.944, 92.492], [55.938, 92.478]
];

const KUBEKOVO_COORDS: [number, number][] = [
  [56.138, 93.178], [56.152, 93.202], [56.148, 93.212], [56.132, 93.188]
];

// Real known shoals (shallows / sandbanks / перекаты / мели) of the Yenisey from navigation charts
const REAL_SHALLOWS = [
  {
    id: 'ladeyskaya',
    name: 'Ладейская мель (Ладейский перекат)',
    location: 'г. Красноярск, ниже Октябрьского моста',
    coords: [
      [56.041, 92.965], [56.046, 92.978], [56.044, 92.988], [56.037, 92.972]
    ] as [number, number][],
    description: 'Опасное скалистое мелководье в черте Красноярска. При снижении уровня воды косы обнажаются, затрудняя судоходство и сужая фарватер.',
    criticalLevel: 120 // starts appearing at this waterLevel
  },
  {
    id: 'posadskaya',
    name: 'Посадская отмель (остров Посадный)',
    location: 'г. Красноярск, в районе исторического водозабора',
    coords: [
      [56.003, 92.842], [56.009, 92.855], [56.006, 92.862], [56.001, 92.848]
    ] as [number, number][],
    description: 'Историческая песчаная коса в центральной черте Красноярска. При низких расходах Красноярской ГЭС полностью обнажается, образуя обширный сухой пляж.',
    criticalLevel: 100
  },
  {
    id: 'kazachinsky',
    name: 'Казачинский порог (Казачинская мель)',
    location: 'Казачинский район, 223–224 км от Красноярска',
    coords: [
      [57.484, 93.000], [57.491, 93.012], [57.481, 93.008]
    ] as [number, number][],
    description: 'Самый сложный каменистый порог на Енисее. Образован выступом скальных пород. В межень глубины критически падают, требуя проводки судов специальным туером.',
    criticalLevel: 150
  },
  {
    id: 'prutovsky',
    name: 'Прутовский перекат',
    location: 'Енисейский район, ниже устья р. Кемь',
    coords: [
      [58.614, 92.162], [58.624, 92.172], [58.617, 92.178]
    ] as [number, number][],
    description: 'Песчаный перекат-лимитатор в районе Енисейска. В летнюю межень становится серьезной преградой, приводящей к простоям крупнотоннажного флота.',
    criticalLevel: 120
  },
  {
    id: 'barabanovsky',
    name: 'Барабановский перекат',
    location: 'Сухобузимский район, у села Барабаново',
    coords: [
      [56.324, 93.632], [56.329, 93.652], [56.321, 93.642]
    ] as [number, number][],
    description: 'Коварная отмель напротив старинной деревянной церкви Барабаново. Здесь река сильно расширяется, глубина падает, образуя песчаные банки.',
    criticalLevel: 110
  },
  {
    id: 'korkinsky',
    name: 'Коркинский перекат',
    location: 'Березовский район, район д. Коркино',
    coords: [
      [56.120, 93.300], [56.130, 93.315], [56.125, 93.325], [56.115, 93.310]
    ] as [number, number][],
    description: 'Каменистая мель выше устья р. Базаиха. Ограничивает судоходство судов с большой осадкой в осенний период спада воды.',
    criticalLevel: 100
  }
];

// Smooth centerline coordinates of the Krasnoyarsk Reservoir (Sayan waterbody)
const RESERVOIR_COURSE: [number, number][] = [
  [53.9000, 91.5000], // Abakan / start of reservoir
  [54.1000, 91.4000],
  [54.2500, 91.5500],
  [54.4000, 91.7000],
  [54.6000, 91.8000],
  [54.8000, 91.9500],
  [55.1000, 91.8500],
  [55.3000, 91.7500],
  [55.5000, 92.0000],
  [55.7000, 92.1500],
  [55.8500, 92.1000],
  [55.9341, 92.2923]  // Krasnoyarsk GES (confluence point)
];

// High-fidelity centerline coordinates of the Yenisey River in Krasnoyarsk Krai
const YENISEY_RIVER_COURSE: [number, number][] = [
  [55.9341, 92.2923], // Krasnoyarsk GES (243m elevation)
  [55.9385, 92.3020],
  [55.9430, 92.3150],
  [55.9520, 92.3250],
  [55.9575, 92.3450],
  [55.9597, 92.3688], // Divnogorsk
  [55.9620, 92.3850],
  [55.9580, 92.4050],
  [55.9510, 92.4250],
  [55.9430, 92.4450],
  [55.9416, 92.4764], // Ust-Mana
  [55.9460, 92.5100],
  [55.9520, 92.5350],
  [55.9580, 92.5600], // Ovsyanka
  [55.9650, 92.6100], // Sliznevo
  [55.9720, 92.6350],
  [55.9810, 92.6700], // Laletino
  [55.9880, 92.7150], // Borodino
  [55.9920, 92.7480], // Udachny
  [55.9960, 92.7750],
  [56.0010, 92.7950], // Gremyachiy Log
  [56.0035, 92.8180], // Railway Bridge
  [56.0050, 92.8400],
  [56.0084, 92.8680], // Kommunalny Bridge
  [56.0100, 92.8900], // Recreation Island
  [56.0150, 92.9150], // Tatyshev South
  [56.0272, 92.9430], // Oktyabrsky Bridge
  [56.0380, 92.9700], // Tatyshev North
  [56.0420, 92.9950], // Korshunovo
  [56.0350, 93.0400],
  [56.0320, 93.1120], // Berezovka
  [56.0500, 93.1400],
  [56.0950, 93.1600],
  [56.1420, 93.1850], // Kubekovo
  [56.1800, 93.2400],
  [56.2100, 93.3100],
  [56.2400, 93.4300],
  [56.2800, 93.5200],
  [56.3200, 93.6300], // Barabanovo
  [56.3600, 93.6800],
  [56.4170, 93.7020], // Atamanovo
  [56.4500, 93.6800],
  [56.4850, 93.6300], // Kononovo
  [56.5400, 93.5700],
  [56.5900, 93.5200],
  [56.6800, 93.4700],
  [56.7800, 93.4100], // Pavlovshchina
  [56.9100, 93.3500],
  [57.0500, 93.3000],
  [57.1500, 93.2200],
  [57.2500, 93.1500],
  [57.3800, 93.0600],
  [57.4840, 93.0040], // Kazachinsky Porog
  [57.6200, 93.0300],
  [57.8000, 93.1000],
  [57.9500, 93.0800],
  [58.1150, 92.9900], // Strelka (Angara confluence)
  [58.2000, 92.8000],
  [58.2800, 92.6000],
  [58.3600, 92.4000],
  [58.4520, 92.1830]  // Yeniseysk
];

// Catmull-Rom Spline Interpolation to smooth path curves and fully match physical geometry
function interpolateCatmullRom(points: [number, number][], segmentsPerLink = 12): [number, number][] {
  if (points.length < 2) return points;
  
  const p = [points[0], ...points, points[points.length - 1]];
  const result: [number, number][] = [];
  
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2];
    
    for (let j = 0; j < segmentsPerLink; j++) {
      const t = j / segmentsPerLink;
      const t2 = t * t;
      const t3 = t2 * t;
      
      const lat = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );
      
      const lng = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );
      
      result.push([lat, lng]);
    }
  }
  
  result.push(points[points.length - 1]);
  return result;
}

const SMOOTH_RESERVOIR_COURSE = interpolateCatmullRom(RESERVOIR_COURSE, 12);
const SMOOTH_YENISEY_COURSE = interpolateCatmullRom(YENISEY_RIVER_COURSE, 12);

// Programmatic oval generator for precise high-fidelity lake polygons
function generateOvalPolygon(center: [number, number], latRadius: number, lngRadius: number, pointsCount = 32): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    const lat = center[0] + Math.sin(angle) * latRadius;
    const lng = center[1] + Math.cos(angle) * lngRadius;
    points.push([lat, lng]);
  }
  return points;
}

// Detects standard OpenStreetMap Mapnik water colors and OpenTopoMap water colors
function isOsmWater(r: number, g: number, b: number): boolean {
  // OSM water: rgb(170, 211, 223), OpenTopoMap water: rgb(179, 212, 240) / rgb(158, 202, 225)
  // B is dominant channel, with G close behind, and R significantly lower
  if (b >= 200 && g >= 175 && r >= 130 && r <= 212) {
    if (b > r + 15 && g > r + 10 && b >= g - 15) {
      return true;
    }
  }
  return false;
}

// Helper to convert tile coordinates to lat/lng
function tileToLatLng(x: number, y: number, z: number): { lat: number; lng: number } {
  const n = Math.pow(2, z);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y / n))));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

function getClosestSegmentDistanceFast(
  lat: number,
  lng: number,
  activeSegments: [number, number, number, number, number][] // [y1, x1, y2, x2, i]
) {
  let minSegDist = Infinity;
  let closestSegmentIndex = 0;
  let interpolationT = 0;

  for (let i = 0; i < activeSegments.length; i++) {
    const seg = activeSegments[i];
    const res = getDistanceToSegment([lat, lng], [seg[0], seg[1]], [seg[2], seg[3]]);
    if (res.distance < minSegDist) {
      minSegDist = res.distance;
      closestSegmentIndex = seg[4];
      interpolationT = res.t;
    }
  }

  return {
    distance: minSegDist,
    segmentIndex: closestSegmentIndex,
    t: interpolationT
  };
}

function getStaticLandElevationFast(
  lat: number,
  lng: number,
  activeReservoirSegments: [number, number, number, number, number][],
  activeYeniseySegments: [number, number, number, number, number][]
): { groundElevation: number; rivResult: any; resResult: any } {
  // 1. Distance to reservoir
  let resResult = { distance: 999, segmentIndex: 0, t: 0 };
  let reservoirWidth = 0.05;
  const reservoirWaterSurface = 243.0;
  let resDistFromShore = 999;

  if (activeReservoirSegments.length > 0) {
    resResult = getClosestSegmentDistanceFast(lat, lng, activeReservoirSegments);
    const resProgress = resResult.segmentIndex / (SMOOTH_RESERVOIR_COURSE.length - 1);
    reservoirWidth = getInterpolatedReservoirWidth(resProgress, 120);
    resDistFromShore = Math.max(0, resResult.distance - reservoirWidth);
  }

  // 2. Distance to river
  let rivResult = { distance: 999, segmentIndex: 0, t: 0 };
  let baseRivWidth = 0.005;
  let riverWaterSurface = 120;
  let rivDistFromShore = 999;
  let progress = 0;

  if (activeYeniseySegments.length > 0) {
    rivResult = getClosestSegmentDistanceFast(lat, lng, activeYeniseySegments);
    const totalSegments = SMOOTH_YENISEY_COURSE.length - 1;
    progress = (rivResult.segmentIndex + rivResult.t) / totalSegments;
    baseRivWidth = getInterpolatedRiverWidth(progress);
    const baseRiverElevation = 243.0 - progress * (243.0 - 76.0);
    riverWaterSurface = baseRiverElevation;
    rivDistFromShore = Math.max(0, rivResult.distance - baseRivWidth);
  }

  // Determine closest main water body at base level
  let minDistFromShore = rivDistFromShore;
  let shoreWaterSurface = riverWaterSurface;

  if (resDistFromShore < rivDistFromShore && lat < 55.94) {
    minDistFromShore = resDistFromShore;
    shoreWaterSurface = reservoirWaterSurface;
  }

  // 3. Distance to region-specific lakes (Bele, Shira, Tagarskoye)
  let nearLake = false;
  let lakeSurface = 140;
  let lakeDist = 999;

  // Lake Tagarskoye
  const dLatT = lat - 53.59;
  const dLngT = lng - 92.25;
  const distT = Math.sqrt(dLatT * dLatT + dLngT * dLngT);
  if (distT < 0.08) {
    nearLake = true;
    lakeSurface = 145;
    lakeDist = Math.max(0, distT - 0.012);
  }

  // Lake Shira
  const dLatS = lat - 54.49;
  const dLngS = lng - 90.21;
  const distS = Math.sqrt(dLatS * dLatS + dLngS * dLngS);
  if (distS < 0.12) {
    nearLake = true;
    lakeSurface = 109;
    lakeDist = Math.max(0, distS - 0.02);
  }

  // Lake Bele
  const dLatB1 = lat - 54.66;
  const dLngB1 = lng - 90.10;
  const distB1 = Math.sqrt(dLatB1 * dLatB1 + dLngB1 * dLngB1);
  const dLatB2 = lat - 54.63;
  const dLngB2 = lng - 90.22;
  const distB2 = Math.sqrt(dLatB2 * dLatB2 + dLngB2 * dLngB2);
  const distB = Math.min(distB1, distB2);
  if (distB < 0.15) {
    nearLake = true;
    lakeSurface = 236;
    lakeDist = Math.max(0, distB - 0.035);
  }

  if (nearLake && lakeDist < minDistFromShore) {
    minDistFromShore = lakeDist;
    shoreWaterSurface = lakeSurface;
  }

  // Calculate raw regional terrain elevation baseline
  let rawTerrainHeight = 140;

  // Mountainous zones
  if (lng > 92.7 && lat < 56.1) {
    const dLat = lat - 55.9;
    const dLng = lng - 92.95;
    const mountainProximity = Math.max(0, 1 - Math.sqrt(dLat * dLat + dLng * dLng) / 0.5);
    rawTerrainHeight = 150 + mountainProximity * 650;
  }
  else if (lat < 55.96) {
    const dLat = lat - 55.90;
    const dLng = lng - 92.30;
    const mountainProximity = Math.max(0, 1 - Math.sqrt(dLat * dLat + dLng * dLng) / 0.4);
    rawTerrainHeight = 220 + mountainProximity * 550;
  }
  else if (lng > 93.0) {
    rawTerrainHeight = 180 + (lng - 93.0) * 120;
  }
  else if (lng < 92.2) {
    rawTerrainHeight = 110 + (lng - 91.0) * 40;
  } else {
    rawTerrainHeight = 140 + (lat - 56.0) * 30;
  }

  const noise = Math.sin(lat * 150) * Math.cos(lng * 150) * 12.0
              + Math.sin(lat * 380) * Math.cos(lng * 380) * 4.0
              + Math.sin(lat * 80) * Math.sin(lng * 80) * 22.0
              + Math.cos(lat * 25) * Math.sin(lng * 25) * 45.0;

  const transitionRange = 0.08;
  const t = Math.min(1.0, minDistFromShore / transitionRange);
  const smoothT = t * t * (3 - 2 * t);

  const shoreElevation = shoreWaterSurface + 1.5;
  const rawTerrainWithNoise = rawTerrainHeight + noise * smoothT;

  let terrainHeight = shoreElevation + smoothT * (rawTerrainWithNoise - shoreElevation);

  if (terrainHeight < shoreWaterSurface + 0.5) {
    terrainHeight = shoreWaterSurface + 0.5 + minDistFromShore * 15.0;
  }

  return {
    groundElevation: Math.round(terrainHeight),
    rivResult,
    resResult
  };
}

function getWaterSurfaceElevationFast(
  lat: number,
  lng: number,
  currentWaterLevel: number,
  rivResult: any,
  resResult: any
): number {
  let currentWaterSurface = 120;

  const resLevelChange = (currentWaterLevel - 120) / 150;
  const reservoirWaterSurface = 243.0 + resLevelChange;

  const totalSegments = SMOOTH_YENISEY_COURSE.length - 1;
  const progress = rivResult.distance < 999 ? (rivResult.segmentIndex + rivResult.t) / totalSegments : 0;
  const riverLevelChange = (currentWaterLevel - 120) / 100;
  const baseRiverElevation = 243.0 - progress * (243.0 - 76.0);
  const riverWaterSurface = baseRiverElevation + riverLevelChange;

  if (resResult.distance < rivResult.distance && lat < 55.94) {
    currentWaterSurface = reservoirWaterSurface;
  } else {
    currentWaterSurface = riverWaterSurface;
  }

  // Adjust for region-specific lakes (Bele, Shira, Tagarskoye)
  const dLatTagar = lat - 53.59;
  const dLngTagar = lng - 92.25;
  const distTagar = Math.sqrt(dLatTagar * dLatTagar + dLngTagar * dLngTagar);
  
  const dLatShira = lat - 54.49;
  const dLngShira = lng - 90.21;
  const distShira = Math.sqrt(dLatShira * dLatShira + dLngShira * dLngShira);
  
  const dLatBele = lat - 54.64;
  const dLngBele = lng - 90.16;
  const distBele = Math.sqrt(dLatBele * dLatBele + dLngBele * dLngBele);
  
  const levelFactor = Math.max(0, (currentWaterLevel - 120) / 100);
  if (distTagar < 0.04) {
    currentWaterSurface = 145 + levelFactor * 0.5;
  } else if (distShira < 0.08) {
    currentWaterSurface = 109 + levelFactor * 0.5;
  } else if (distBele < 0.1) {
    currentWaterSurface = 236 + levelFactor * 0.5;
  }

  return currentWaterSurface;
}

// Custom tile layer for pixel-perfect morphological flooding
const WaterOverlayClass = L.TileLayer.extend({
  createTile: function(coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const ctx = tile.getContext('2d')!;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.getTileUrl(coords);
    
    const tileKey = `${coords.x}:${coords.y}:${coords.z}`;
    
    img.onload = () => {
      if (!this._activeTiles) {
        this._activeTiles = new Map();
      }
      this._activeTiles.set(tileKey, {
        canvas: tile,
        img: img,
        coords: coords,
        hasWater: false,
        mask: null
      });
      
      this._drawTileInPlace(tileKey);
      done(undefined, tile);
    };
    
    img.onerror = () => {
      done(undefined, tile);
    };
    
    return tile;
  },

  _drawTileInPlace: function(tileKey: string) {
    if (!this._activeTiles) return;
    const tileData = this._activeTiles.get(tileKey);
    if (!tileData) return;
    
    const { canvas, img, coords } = tileData;
    const ctx = canvas.getContext('2d')!;
    const size = 256;
    
    // Draw original image to read pixels
    ctx.drawImage(img, 0, 0);
    
    try {
      const imgData = ctx.getImageData(0, 0, 256, 256);
      const data = imgData.data;
      
      const currentLevelRef = this.options.currentLevelRef;
      const level = currentLevelRef ? currentLevelRef.current : 120;
      
      // Determine color for water bodies (always beautiful blue)
      const waterColor = [37, 99, 235]; // Vivid beautiful blue
      
      // Compute mask if not already cached
      if (!tileData.mask) {
        const mask = new Uint8Array(size * size);
        let hasWater = false;
        for (let i = 0; i < size * size; i++) {
          const idx = i * 4;
          if (isOsmWater(data[idx], data[idx + 1], data[idx + 2]) && data[idx + 3] > 0) {
            mask[i] = 1;
            hasWater = true;
          }
        }
        tileData.mask = mask;
        tileData.hasWater = hasWater;
      }
      
      if (!tileData.hasWater) {
        ctx.clearRect(0, 0, 256, 256);
        return;
      }
      
      const mask = tileData.mask;
      
      // Perform morphological dilation to expand water onto adjacent land as water level rises
      let R = 0;
      const excessLevel = Math.max(0, level - 120);
      if (excessLevel > 0) {
        // At higher zoom levels, dilate by more pixels for a noticeable flood expansion.
        const scaleFactor = Math.max(0.2, (coords.z - 4) * 0.25);
        R = Math.min(15, Math.floor((excessLevel / 120) * scaleFactor));
      }
      
      let dilatedMask = mask;
      if (R > 0) {
        dilatedMask = new Uint8Array(size * size);
        for (let y = 0; y < size; y++) {
          const yMul = y * size;
          for (let x = 0; x < size; x++) {
            const idx = yMul + x;
            if (mask[idx]) {
              dilatedMask[idx] = 1;
              continue;
            }
            
            // Fast box-radius check to dilate water pixels
            const xMin = Math.max(0, x - R);
            const xMax = Math.min(size - 1, x + R);
            const yMin = Math.max(0, y - R);
            const yMax = Math.min(size - 1, y + R);
            
            let found = false;
            for (let ny = yMin; ny <= yMax; ny++) {
              const nRow = ny * size;
              for (let nx = xMin; nx <= xMax; nx++) {
                if (mask[nRow + nx]) {
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
            if (found) {
              dilatedMask[idx] = 1;
            }
          }
        }
      }
      
      // Get tile lat/lng bounding box to filter active course segments
      const pMin = tileToLatLng(coords.x, coords.y, coords.z);
      const pMax = tileToLatLng(coords.x + 1, coords.y + 1, coords.z);
      const latMin = Math.min(pMin.lat, pMax.lat);
      const latMax = Math.max(pMin.lat, pMax.lat);
      const lngMin = Math.min(pMin.lng, pMax.lng);
      const lngMax = Math.max(pMin.lng, pMax.lng);

      // Margin of 0.06 degrees (about 6.6km) to account for river proximity
      const margin = 0.06;
      
      const activeYeniseySegments: [number, number, number, number, number][] = [];
      for (let i = 0; i < SMOOTH_YENISEY_COURSE.length - 1; i++) {
        const p1 = SMOOTH_YENISEY_COURSE[i];
        const p2 = SMOOTH_YENISEY_COURSE[i + 1];
        const minSegLat = Math.min(p1[0], p2[0]);
        const maxSegLat = Math.max(p1[0], p2[0]);
        const minSegLng = Math.min(p1[1], p2[1]);
        const maxSegLng = Math.max(p1[1], p2[1]);
        
        if (maxSegLat >= latMin - margin && minSegLat <= latMax + margin &&
            maxSegLng >= lngMin - margin && minSegLng <= lngMax + margin) {
          activeYeniseySegments.push([p1[0], p1[1], p2[0], p2[1], i]);
        }
      }

      const activeReservoirSegments: [number, number, number, number, number][] = [];
      for (let i = 0; i < SMOOTH_RESERVOIR_COURSE.length - 1; i++) {
        const p1 = SMOOTH_RESERVOIR_COURSE[i];
        const p2 = SMOOTH_RESERVOIR_COURSE[i + 1];
        const minSegLat = Math.min(p1[0], p2[0]);
        const maxSegLat = Math.max(p1[0], p2[0]);
        const minSegLng = Math.min(p1[1], p2[1]);
        const maxSegLng = Math.max(p1[1], p2[1]);
        
        if (maxSegLat >= latMin - margin && minSegLat <= latMax + margin &&
            maxSegLng >= lngMin - margin && minSegLng <= lngMax + margin) {
          activeReservoirSegments.push([p1[0], p1[1], p2[0], p2[1], i]);
        }
      }

      // Precalculate latitudes and longitudes for every pixel fast to avoid sinh/atan in inner loop
      const n = Math.pow(2, coords.z);
      const tileLngMin = (coords.x / n) * 360 - 180;
      const tileLngMax = ((coords.x + 1) / n) * 360 - 180;
      const lngStep = (tileLngMax - tileLngMin) / size;

      const rowLats = new Float64Array(size);
      for (let py = 0; py < size; py++) {
        const ty = coords.y + py / size;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty / n))));
        rowLats[py] = (latRad * 180) / Math.PI;
      }

      // Build the finished tile output
      const outputImgData = ctx.createImageData(size, size);
      const outData = outputImgData.data;
      
      const baseAlpha = 205; // 80% opacity for normal waterbodies
      const floodAlpha = 140; // 55% semi-transparent for flooded shores (revealing buildings/streets)
      
      for (let i = 0; i < size * size; i++) {
        const idx = i * 4;
        if (dilatedMask[i]) {
          if (mask[i]) {
            outData[idx] = waterColor[0];
            outData[idx + 1] = waterColor[1];
            outData[idx + 2] = waterColor[2];
            outData[idx + 3] = baseAlpha;
          } else {
            // Dilated candidate pixel: flood only if local water surface exceeds physical land elevation!
            const px = i % size;
            const py = Math.floor(i / size);
            const lat = rowLats[py];
            const lng = tileLngMin + px * lngStep;
            
            const fastTerrain = getStaticLandElevationFast(lat, lng, activeReservoirSegments, activeYeniseySegments);
            const waterSurface = getWaterSurfaceElevationFast(lat, lng, level, fastTerrain.rivResult, fastTerrain.resResult);
            
            if (waterSurface > fastTerrain.groundElevation) {
              outData[idx] = waterColor[0];
              outData[idx + 1] = waterColor[1];
              outData[idx + 2] = waterColor[2];
              outData[idx + 3] = floodAlpha;
            } else {
              outData[idx + 3] = 0; // Not flooded, remains dry land
            }
          }
        } else {
          outData[idx + 3] = 0; // completely transparent for dry land
        }
      }
      
      ctx.clearRect(0, 0, 256, 256);
      ctx.putImageData(outputImgData, 0, 0);
      
      const tileCanvasCacheRef = this.options.tileCanvasCacheRef;
      if (tileCanvasCacheRef && tileCanvasCacheRef.current) {
        tileCanvasCacheRef.current.set(tileKey, canvas);
      }
    } catch (e) {
      ctx.clearRect(0, 0, 256, 256);
    }
  },

  redrawInPlace: function() {
    if (!this._activeTiles) return;
    this._activeTiles.forEach((tileData: any, tileKey: string) => {
      this._drawTileInPlace(tileKey);
    });
  },

  removeTile: function(coords: L.Coords) {
    if (!this._activeTiles) return;
    const tileKey = `${coords.x}:${coords.y}:${coords.z}`;
    this._activeTiles.delete(tileKey);
    
    const tileCanvasCacheRef = this.options.tileCanvasCacheRef;
    if (tileCanvasCacheRef && tileCanvasCacheRef.current) {
      tileCanvasCacheRef.current.delete(tileKey);
    }
  }
});

// continuous physical width model for the reservoir
function getInterpolatedReservoirWidth(progress: number, currentWaterLevel: number): number {
  let baseWidth = 0.04;
  if (progress <= 0.3) {
    baseWidth = 0.02 + progress * 0.05; // 0.02 -> 0.035
  } else if (progress <= 0.8) {
    const t = (progress - 0.3) / 0.5;
    baseWidth = 0.035 + t * 0.025; // 0.035 -> 0.06
  } else {
    const t = (progress - 0.8) / 0.2;
    baseWidth = 0.06 + t * 0.02; // 0.06 -> 0.08 near GES
  }
  const levelChange = (currentWaterLevel - 120) / 150;
  return baseWidth + levelChange * 0.008;
}

// continuous physical depth model for the reservoir
function getInterpolatedReservoirDepth(progress: number): number {
  // Upper reservoir (Abakan / Shushenskoye end) is shallower: 5 - 30m
  // Middle reservoir (Daurskoye) is 30 - 60m
  // Lower reservoir (near the GES Dam) is 60 - 105m
  if (progress <= 0.3) {
    const t = progress / 0.3;
    return 5.0 + t * 25.0; // 5m -> 30m
  } else if (progress <= 0.7) {
    const t = (progress - 0.3) / 0.4;
    return 30.0 + t * 30.0; // 30m -> 60m
  } else {
    const t = (progress - 0.7) / 0.3;
    return 60.0 + t * 45.0; // 60m -> 105m
  }
}

// continuous physical width model for the Yenisey riverbed (in degrees)
function getInterpolatedRiverWidth(progress: number): number {
  if (progress <= 0.03) {
    // GES to Divnogorsk
    return 0.004 + (progress / 0.03) * 0.001;
  } else if (progress <= 0.12) {
    // Divnogorsk to Krasnoyarsk city
    const t = (progress - 0.03) / 0.09;
    return 0.005 + t * 0.007; // 0.005 -> 0.012
  } else if (progress <= 0.35) {
    // Krasnoyarsk to mid stream
    const t = (progress - 0.12) / 0.23;
    return 0.012 + t * 0.004; // 0.012 -> 0.016
  } else if (progress <= 0.65) {
    // Mid stream to below Angara confluence (Strelka)
    const t = (progress - 0.35) / 0.30;
    return 0.016 + t * 0.019; // 0.016 -> 0.035
  } else {
    // Strelka to Yeniseysk
    const t = (progress - 0.65) / 0.35;
    return 0.035 - t * 0.007; // 0.035 -> 0.028
  }
}

// continuous physical depth model for the Yenisey riverbed (authentic navigation data)
function getInterpolatedRiverDepth(progress: number): number {
  // Progress along Yenisey (0 = Krasnoyarsk GES tailwater, 1 = Yeniseysk)
  if (progress <= 0.05) {
    // Divnogorsk / GES Tailwater: very deep rocky channel
    const t = progress / 0.05;
    return 12.0 - t * 3.5; // 12.0m -> 8.5m
  } else if (progress <= 0.15) {
    // Krasnoyarsk City limits: dredged fairway
    const t = (progress - 0.05) / 0.10;
    return 8.5 - t * 2.5; // 8.5m -> 6.0m
  } else if (progress <= 0.35) {
    // Krasnoyarsk to near Kazachinskoye
    const t = (progress - 0.15) / 0.20;
    return 6.0 + t * 3.0; // 6.0m -> 9.0m
  } else if (progress <= 0.41) {
    // Kazachinsky Porog area (critical rocky section)
    const t = (progress - 0.35) / 0.06;
    const isPorogCenter = Math.abs(progress - 0.38) < 0.015;
    if (isPorogCenter) {
      return 3.5; // Rocky sill minimum depth in the channel
    }
    return 9.0 - t * 4.0; // 9.0m down towards 5.0m
  } else if (progress <= 0.60) {
    // Below Porog to Angara confluence (Strelka)
    const t = (progress - 0.41) / 0.19;
    return 7.0 + t * 5.0; // 7.0m -> 12.0m
  } else {
    // Lower Yenisey after Angara confluence: massive deep water river
    const t = (progress - 0.60) / 0.40;
    return 12.0 + t * 10.0; // 12.0m -> 22.0m
  }
}

// continuous human segment labeling
function getRiverSegmentName(progress: number): string {
  if (progress <= 0.03) return 'Енисей (Приплотинный участок)';
  if (progress <= 0.06) return 'Река Енисей (Район Дивногорска)';
  if (progress <= 0.12) return 'Река Енисей (Черта города Красноярск)';
  if (progress <= 0.40) return 'Река Енисей (Среднее течение)';
  if (progress <= 0.65) return 'Река Енисей (Район устья р. Ангара)';
  return 'Река Енисей (Нижнее течение, у Енисейска)';
}

// Mathematical 2D point-to-line segment distance helper
function getDistanceToSegment(p: [number, number], a: [number, number], b: [number, number]) {
  const x = p[1]; // longitude
  const y = p[0]; // latitude
  const x1 = a[1];
  const y1 = a[0];
  const x2 = b[1];
  const y2 = b[0];

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return {
    distance: Math.sqrt(dx * dx + dy * dy),
    closestPoint: [yy, xx] as [number, number],
    t: Math.max(0, Math.min(1, param))
  };
}

// Solves closest point and distance across a multi-segment line course
function getClosestSegmentDistance(lat: number, lng: number, course: [number, number][]) {
  let minSegDist = Infinity;
  let closestSegmentIndex = 0;
  let closestPointOnLine: [number, number] = course[0];
  let interpolationT = 0;

  for (let i = 0; i < course.length - 1; i++) {
    const a = course[i];
    const b = course[i + 1];
    const res = getDistanceToSegment([lat, lng], a, b);
    if (res.distance < minSegDist) {
      minSegDist = res.distance;
      closestSegmentIndex = i;
      closestPointOnLine = res.closestPoint;
      interpolationT = res.t;
    }
  }

  return {
    distance: minSegDist,
    segmentIndex: closestSegmentIndex,
    closestPoint: closestPointOnLine,
    t: interpolationT
  };
}

// Determines if point matches any water body (reservoir, river, lakes) and computes detailed GIS attributes
function getWaterBodyAttributes(lat: number, lng: number, currentWaterLevel: number) {
  const levelFactor = Math.max(0, (currentWaterLevel - 120) / 100);

  // 1. Check Lakes (Bele, Shira, Tagarskoye) with water-expanding bounding shapes
  // Lake Bele (West + East lobes)
  const beleWestExpansion = 1.0 + levelFactor * 0.05;
  const dLatBeleW = (lat - 54.66) / (0.024 * beleWestExpansion);
  const dLngBeleW = (lng - 90.10) / (0.045 * beleWestExpansion);
  const distBeleWSq = dLatBeleW * dLatBeleW + dLngBeleW * dLngBeleW;

  const dLatBeleE = (lat - 54.63) / (0.022 * beleWestExpansion);
  const dLngBeleE = (lng - 90.22) / (0.055 * beleWestExpansion);
  const distBeleESq = dLatBeleE * dLatBeleE + dLngBeleE * dLngBeleE;

  if (distBeleWSq <= 1.0 || distBeleESq <= 1.0) {
    const baseSurf = 236; // meters above sea level
    const maxDepth = 48;
    const ratio = distBeleWSq <= 1.0 ? 1.0 - Math.sqrt(distBeleWSq) : 1.0 - Math.sqrt(distBeleESq);
    const depth = ratio * maxDepth + levelFactor * 0.5;
    return {
      isWater: true,
      zoneType: 'river' as const,
      zoneName: distBeleWSq <= 1.0 ? 'Озеро Белё (Западный плес)' : 'Озеро Белё (Восточный плес)',
      waterSurfaceElevation: baseSurf + levelFactor * 0.5,
      depth: Math.max(0.5, depth),
      elevation: baseSurf - depth
    };
  }

  // Lake Shira
  const shiraExpansion = 1.0 + levelFactor * 0.05;
  const dLatShira = (lat - 54.49) / (0.026 * shiraExpansion);
  const dLngShira = (lng - 90.21) / (0.048 * shiraExpansion);
  const distShiraSq = dLatShira * dLatShira + dLngShira * dLngShira;
  if (distShiraSq <= 1.0) {
    const baseSurf = 109; // meters
    const maxDepth = 22;
    const ratio = 1.0 - Math.sqrt(distShiraSq);
    const depth = ratio * maxDepth + levelFactor * 0.5;
    return {
      isWater: true,
      zoneType: 'river' as const,
      zoneName: 'Озеро Шира (Курортная зона)',
      waterSurfaceElevation: baseSurf + levelFactor * 0.5,
      depth: Math.max(0.5, depth),
      elevation: baseSurf - depth
    };
  }

  // Lake Tagarskoye
  const tagarExpansion = 1.0 + levelFactor * 0.05;
  const dLatTagar = (lat - 53.59) / (0.008 * tagarExpansion);
  const dLngTagar = (lng - 92.25) / (0.015 * tagarExpansion);
  const distTagarSq = dLatTagar * dLatTagar + dLngTagar * dLngTagar;
  if (distTagarSq <= 1.0) {
    const baseSurf = 145;
    const maxDepth = 3.5;
    const ratio = 1.0 - Math.sqrt(distTagarSq);
    const depth = ratio * maxDepth + levelFactor * 0.5;
    return {
      isWater: true,
      zoneType: 'river' as const,
      zoneName: 'Озеро Тагарское (Лечебное)',
      waterSurfaceElevation: baseSurf + levelFactor * 0.5,
      depth: Math.max(0.3, depth),
      elevation: baseSurf - depth
    };
  }

  // 2. Check Krasnoyarsk Reservoir (using the high-fidelity SMOOTHED course)
  const resResult = getClosestSegmentDistance(lat, lng, SMOOTH_RESERVOIR_COURSE);
  const resProgress = resResult.segmentIndex / (SMOOTH_RESERVOIR_COURSE.length - 1);
  const reservoirWidth = getInterpolatedReservoirWidth(resProgress, currentWaterLevel);

  const resLevelChange = (currentWaterLevel - 120) / 150; // lower amplitude in reservoir
  const reservoirWaterSurface = 243.0 + resLevelChange;

  if (resResult.distance < reservoirWidth) {
    const ratio = (reservoirWidth - resResult.distance) / reservoirWidth; // 1 at center, 0 at edge
    const maxDepth = getInterpolatedReservoirDepth(resProgress);
    const depth = Math.max(0.5, ratio * maxDepth + resLevelChange);
    
    return {
      isWater: true,
      zoneType: 'river' as const,
      zoneName: 'Красноярское водохранилище (Красноярское море)',
      waterSurfaceElevation: reservoirWaterSurface,
      depth: depth,
      elevation: reservoirWaterSurface - depth
    };
  }

  // 3. Check Yenisey River Course (using the high-fidelity SMOOTHED course)
  const rivResult = getClosestSegmentDistance(lat, lng, SMOOTH_YENISEY_COURSE);
  const totalSegments = SMOOTH_YENISEY_COURSE.length - 1;
  const progress = (rivResult.segmentIndex + rivResult.t) / totalSegments;
  
  const baseRivWidth = getInterpolatedRiverWidth(progress);
  const riverLevelChange = (currentWaterLevel - 120) / 100; // in meters
  // expand riverbed slightly on rising level
  const currentRivWidth = baseRivWidth + Math.max(0, riverLevelChange) * (progress < 0.12 ? 0.0018 : 0.0035);

  const baseRiverElevation = 243.0 - progress * (243.0 - 76.0);
  const waterSurfaceElevation = baseRiverElevation + riverLevelChange;

  if (rivResult.distance < currentRivWidth) {
    const ratio = (currentRivWidth - rivResult.distance) / currentRivWidth;
    const shapeProfile = Math.pow(ratio, 0.35); // flat-bottomed trough (U-shaped riverbed)
    const maxRivDepth = getInterpolatedRiverDepth(progress);
    
    let depth = shapeProfile * maxRivDepth + riverLevelChange;
    depth = Math.max(0.3, depth);

    // Check for real shoals
    let isOnShoal = false;
    let activeShoalName = '';
    const shoals = [
      { name: 'Ладейская мель', coords: [56.041, 92.975], limit: 120 },
      { name: 'Посадская отмель', coords: [56.005, 92.852], limit: 100 },
      { name: 'Казачинский порог', coords: [57.485, 93.006], limit: 150 },
      { name: 'Прутовский перекат', coords: [58.619, 92.170], limit: 120 },
      { name: 'Барабановский перекат', coords: [56.324, 93.642], limit: 110 },
      { name: 'Коркинский перекат', coords: [56.122, 93.312], limit: 100 }
    ];

    for (const s of shoals) {
      const dLat = lat - s.coords[0];
      const dLng = lng - s.coords[1];
      const d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (d < 0.015) {
        isOnShoal = true;
        activeShoalName = s.name;
        break;
      }
    }

    if (isOnShoal && currentWaterLevel < 120) {
      depth = Math.max(0.0, depth - 4.0);
      if (depth <= 0) {
        return {
          isWater: true,
          zoneType: 'shoal' as const,
          zoneName: `Обнажившаяся коса (${activeShoalName})`,
          waterSurfaceElevation: waterSurfaceElevation,
          depth: 0,
          elevation: waterSurfaceElevation
        };
      } else {
        return {
          isWater: true,
          zoneType: 'shoal' as const,
          zoneName: `Опасное мелководье (${activeShoalName})`,
          waterSurfaceElevation: waterSurfaceElevation,
          depth: depth,
          elevation: waterSurfaceElevation - depth
        };
      }
    }

    return {
      isWater: true,
      zoneType: 'river' as const,
      zoneName: getRiverSegmentName(progress),
      waterSurfaceElevation: waterSurfaceElevation,
      depth: depth,
      elevation: waterSurfaceElevation - depth
    };
  }

  // 4. Check Floodplain
  const floodplainWidth = currentRivWidth * 3.2;
  if (rivResult.distance < floodplainWidth) {
    const ratio = (rivResult.distance - currentRivWidth) / (floodplainWidth - currentRivWidth);
    const landElevation = baseRiverElevation + 0.3 + ratio * 4.8;

    if (waterSurfaceElevation > landElevation) {
      const depth = waterSurfaceElevation - landElevation;
      return {
        isWater: true,
        zoneType: 'flooded_bank' as const,
        zoneName: 'Затопленное побережье (Пойма)',
        waterSurfaceElevation: waterSurfaceElevation,
        depth: depth,
        elevation: landElevation
      };
    } else {
      return {
        isWater: false,
        zoneType: 'floodplain' as const,
        zoneName: 'Речная пойма (Низменность)',
        waterSurfaceElevation: 0,
        depth: 0,
        elevation: landElevation
      };
    }
  }

  return null;
}

// Elevation and depth calculation model for each coordinate
// Static physical land elevation ONLY (as if there is no riverbed)
function getStaticLandElevation(lat: number, lng: number): number {
  // 1. Distance to the reservoir at level 120
  const resResult = getClosestSegmentDistance(lat, lng, SMOOTH_RESERVOIR_COURSE);
  const resProgress = resResult.segmentIndex / (SMOOTH_RESERVOIR_COURSE.length - 1);
  const reservoirWidth = getInterpolatedReservoirWidth(resProgress, 120);
  const reservoirWaterSurface = 243.0; // level change is 0 at 120
  const resDistFromShore = Math.max(0, resResult.distance - reservoirWidth);

  // 2. Distance to the river at level 120
  const rivResult = getClosestSegmentDistance(lat, lng, SMOOTH_YENISEY_COURSE);
  const totalSegments = SMOOTH_YENISEY_COURSE.length - 1;
  const progress = (rivResult.segmentIndex + rivResult.t) / totalSegments;
  const baseRivWidth = getInterpolatedRiverWidth(progress);
  const baseRiverElevation = 243.0 - progress * (243.0 - 76.0);
  const riverWaterSurface = baseRiverElevation; // level change is 0 at 120
  const rivDistFromShore = Math.max(0, rivResult.distance - baseRivWidth);

  // Determine closest main water body (river vs reservoir) at base level
  let minDistFromShore = rivDistFromShore;
  let shoreWaterSurface = riverWaterSurface;

  if (resDistFromShore < rivDistFromShore && lat < 55.94) {
    minDistFromShore = resDistFromShore;
    shoreWaterSurface = reservoirWaterSurface;
  }

  // 3. Distance to region-specific lakes (Bele, Shira, Tagarskoye) at base level (levelFactor = 0)
  let nearLake = false;
  let lakeSurface = 140;
  let lakeDist = 999;

  // Lake Tagarskoye
  const dLatT = lat - 53.59;
  const dLngT = lng - 92.25;
  const distT = Math.sqrt(dLatT * dLatT + dLngT * dLngT);
  if (distT < 0.08) {
    nearLake = true;
    lakeSurface = 145;
    lakeDist = Math.max(0, distT - 0.012);
  }

  // Lake Shira
  const dLatS = lat - 54.49;
  const dLngS = lng - 90.21;
  const distS = Math.sqrt(dLatS * dLatS + dLngS * dLngS);
  if (distS < 0.12) {
    nearLake = true;
    lakeSurface = 109;
    lakeDist = Math.max(0, distS - 0.02);
  }

  // Lake Bele
  const dLatB1 = lat - 54.66;
  const dLngB1 = lng - 90.10;
  const distB1 = Math.sqrt(dLatB1 * dLatB1 + dLngB1 * dLngB1);
  const dLatB2 = lat - 54.63;
  const dLngB2 = lng - 90.22;
  const distB2 = Math.sqrt(dLatB2 * dLatB2 + dLngB2 * dLngB2);
  const distB = Math.min(distB1, distB2);
  if (distB < 0.15) {
    nearLake = true;
    lakeSurface = 236;
    lakeDist = Math.max(0, distB - 0.035);
  }

  if (nearLake && lakeDist < minDistFromShore) {
    minDistFromShore = lakeDist;
    shoreWaterSurface = lakeSurface;
  }

  // Calculate raw regional terrain elevation baseline
  let rawTerrainHeight = 140;

  // Mountainous zones
  if (lng > 92.7 && lat < 56.1) {
    // Sayan mountains range (foothills of Eastern Sayan)
    const dLat = lat - 55.9;
    const dLng = lng - 92.95;
    const mountainProximity = Math.max(0, 1 - Math.sqrt(dLat * dLat + dLng * dLng) / 0.5);
    rawTerrainHeight = 150 + mountainProximity * 650; // up to 800m
  }
  else if (lat < 55.96) {
    // Mountainous borders of the Krasnoyarsk Reservoir (e.g., near Biryusa karst and Divnogorsk)
    const dLat = lat - 55.90;
    const dLng = lng - 92.30;
    const mountainProximity = Math.max(0, 1 - Math.sqrt(dLat * dLat + dLng * dLng) / 0.4);
    rawTerrainHeight = 220 + mountainProximity * 550; // up to 770m
  }
  else if (lng > 93.0) {
    rawTerrainHeight = 180 + (lng - 93.0) * 120;
  }
  else if (lng < 92.2) {
    rawTerrainHeight = 110 + (lng - 91.0) * 40;
  } else {
    // Flat/rolling plains of Krasnoyarsk forest-steppe
    rawTerrainHeight = 140 + (lat - 56.0) * 30;
  }

  // Multi-frequency coherent topographic noise for realistic ridges and valleys
  const noise = Math.sin(lat * 150) * Math.cos(lng * 150) * 12.0
              + Math.sin(lat * 380) * Math.cos(lng * 380) * 4.0
              + Math.sin(lat * 80) * Math.sin(lng * 80) * 22.0
              + Math.cos(lat * 25) * Math.sin(lng * 25) * 45.0; // regional rolling hills

  // Smoothstep blend factor based on distance from the shore.
  // transitionRange of 0.08 degrees is roughly 8km, giving a natural rise.
  const transitionRange = 0.08;
  const t = Math.min(1.0, minDistFromShore / transitionRange);
  const smoothT = t * t * (3 - 2 * t);

  // The shore is just slightly above water level
  const shoreElevation = shoreWaterSurface + 1.5;

  // Apply noise primarily as we move into the rugged hills
  const rawTerrainWithNoise = rawTerrainHeight + noise * smoothT;

  // Blend elevation smoothly
  let terrainHeight = shoreElevation + smoothT * (rawTerrainWithNoise - shoreElevation);

  // Guarantee land elevation never drops below the adjacent water surface level
  if (terrainHeight < shoreWaterSurface + 0.5) {
    terrainHeight = shoreWaterSurface + 0.5 + minDistFromShore * 15.0;
  }

  return Math.round(terrainHeight);
}

function calculateGeoProfile(
  lat: number,
  lng: number,
  currentWaterLevel: number,
  zoom: number,
  tileCanvasCache: Map<string, HTMLCanvasElement>,
  getRealElevation?: (lat: number, lng: number) => number | null
) {
  // Convert coordinate to tile coordinate to check if pixel is water
  // We MUST round zoom to the nearest integer to align perfectly with cached Leaflet tiles!
  const intZoom = Math.round(zoom);
  const n = Math.pow(2, intZoom);
  const xTile = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  
  let isWaterPixel = false;
  let isBaseWaterPixel = false;
  
  if (Math.abs(lat) <= 85.0511) {
    const yTile = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const tileX = Math.floor(xTile);
    const tileY = Math.floor(yTile);
    const pixelX = Math.max(0, Math.min(255, Math.floor((xTile - tileX) * 256)));
    const pixelY = Math.max(0, Math.min(255, Math.floor((yTile - tileY) * 256)));
    
    const tileKey = `${tileX}:${tileY}:${intZoom}`;
    const canvas = tileCanvasCache.get(tileKey);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
          const alpha = pixel[3];
          if (alpha > 0) {
            isWaterPixel = true;
            // baseAlpha is 205, floodAlpha is 140. We check if it was naturally water on OSM tile.
            isBaseWaterPixel = (alpha > 180);
          }
        } catch (e) {
          isWaterPixel = false;
          isBaseWaterPixel = false;
        }
      }
    }
  }

  // Find dynamic local water body surface elevation
  let currentWaterSurface = 140; // Default fallback

  // Check if closer to reservoir or river
  const resResult = getClosestSegmentDistance(lat, lng, SMOOTH_RESERVOIR_COURSE);
  const rivResult = getClosestSegmentDistance(lat, lng, SMOOTH_YENISEY_COURSE);

  if (lat < 55.94 && resResult.distance < rivResult.distance) {
    const resLevelChange = (currentWaterLevel - 120) / 150;
    currentWaterSurface = 243.0 + resLevelChange;
  } else {
    const totalSegments = SMOOTH_YENISEY_COURSE.length - 1;
    const progress = (rivResult.segmentIndex + rivResult.t) / totalSegments;
    const baseRiverElevation = 243.0 - progress * (243.0 - 76.0);
    const riverLevelChange = (currentWaterLevel - 120) / 100;
    currentWaterSurface = baseRiverElevation + riverLevelChange;
  }

  // Check for lakes
  const levelFactor = Math.max(0, (currentWaterLevel - 120) / 100);
  const dLatB1 = lat - 54.66;
  const dLngB1 = lng - 90.10;
  const distB1 = Math.sqrt(dLatB1 * dLatB1 + dLngB1 * dLngB1);
  const dLatB2 = lat - 54.63;
  const dLngB2 = lng - 90.22;
  const distB2 = Math.sqrt(dLatB2 * dLatB2 + dLngB2 * dLngB2);
  const distB = Math.min(distB1, distB2);
  if (distB < 0.15) {
    currentWaterSurface = 236 + levelFactor * 0.5;
  }
  const dLatS = lat - 54.49;
  const dLngS = lng - 90.21;
  const distS = Math.sqrt(dLatS * dLatS + dLngS * dLngS);
  if (distS < 0.12) {
    currentWaterSurface = 109 + levelFactor * 0.5;
  }
  const dLatT = lat - 53.59;
  const dLngT = lng - 92.25;
  const distT = Math.sqrt(dLatT * dLatT + dLngT * dLngT);
  if (distT < 0.08) {
    currentWaterSurface = 145 + levelFactor * 0.5;
  }

  // Get real or base terrain elevation
  const realElev = getRealElevation ? getRealElevation(lat, lng) : null;
  let groundElevation = realElev !== null ? realElev : getStaticLandElevation(lat, lng);
  let depth = 0;
  let zoneType: 'river' | 'flooded_bank' | 'shoal' | 'floodplain' | 'land' = 'land';
  let zoneName = '';

  const baseWaterAttr = getWaterBodyAttributes(lat, lng, currentWaterLevel);

  if (isWaterPixel) {
    if (isBaseWaterPixel) {
      // Natural OSM water body (riverbed!). This is the blue part drawn from the blue map.
      if (realElev !== null) {
        // We have the REAL terrain elevation!
        groundElevation = realElev;
        // Determine depth as the difference between water surface and terrain bottom
        const calculatedDepth = currentWaterSurface - groundElevation;
        // Ensure depth is realistic for Yenisey river / Reservoir
        if (lat < 55.94 && resResult.distance < rivResult.distance) {
          // Reservoir: can be deep, up to 105m near the dam
          depth = Number(Math.max(2.0, Math.min(105.0, calculatedDepth)).toFixed(1));
        } else {
          // Yenisey river: usually 2.0 to 12.0m depth
          depth = Number(Math.max(1.5, Math.min(25.0, calculatedDepth)).toFixed(1));
        }
        // If ground elevation is higher than water surface, adjust ground elevation to be below water surface
        if (groundElevation >= currentWaterSurface) {
          groundElevation = Math.round(currentWaterSurface - depth);
        }
        zoneType = (baseWaterAttr && baseWaterAttr.zoneType === 'shoal') ? 'shoal' : 'river';
        zoneName = baseWaterAttr ? baseWaterAttr.zoneName : getRiverSegmentName((rivResult.segmentIndex + rivResult.t) / (SMOOTH_YENISEY_COURSE.length - 1));
      } else {
        // Fallback when real-world elevation is loading or unavailable
        if (baseWaterAttr && baseWaterAttr.isWater && (baseWaterAttr.zoneType === 'river' || baseWaterAttr.zoneType === 'shoal')) {
          depth = Number(baseWaterAttr.depth.toFixed(1));
          groundElevation = Math.round(currentWaterSurface - depth);
          zoneType = baseWaterAttr.zoneType;
          zoneName = baseWaterAttr.zoneName;
        } else {
          const totalSegments = SMOOTH_YENISEY_COURSE.length - 1;
          const progress = (rivResult.segmentIndex + rivResult.t) / totalSegments;
          const maxRivDepth = getInterpolatedRiverDepth(progress);

          depth = Number(maxRivDepth.toFixed(1));
          groundElevation = Math.round(currentWaterSurface - depth);
          zoneType = 'river';
          zoneName = getRiverSegmentName(progress);
        }
      }
    } else {
      // Flooded land! (dilated water pixel)
      // Only considered flooded if water surface is physically higher than ground elevation!
      if (currentWaterSurface > groundElevation) {
        depth = Number((currentWaterSurface - groundElevation).toFixed(1));
        zoneType = 'flooded_bank';
        zoneName = 'Затопленная суша (Пойма)';
      } else {
        // Otherwise, it is dry land even if within the dilated pixel radius
        depth = 0;
        zoneType = 'land';
        zoneName = groundElevation > 400 ? 'Горный хребет (Саяны)' : groundElevation > 250 ? 'Возвышенность' : 'Низменность (Суша)';
      }
    }
  } else {
    // Strictly dry land! No depth, zoneType is land
    depth = 0;
    zoneType = 'land';
    zoneName = groundElevation > 400 ? 'Горный хребет (Саяны)' : groundElevation > 250 ? 'Возвышенность' : 'Низменность (Суша)';
  }

  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    elevation: groundElevation,
    depth: depth,
    zoneType: zoneType,
    zoneName: zoneName
  };
}

export default function HydroMap({
  waterState,
  iceState,
  weather,
  layers,
  viewType,
  stations,
  onStationSelect,
  selectedStationId,
  onWaterLevelChange
}: HydroMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Layer groups to easily manage toggles
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const floodGroupRef = useRef<L.LayerGroup | null>(null);
  const iceGroupRef = useRef<L.LayerGroup | null>(null);
  const flowGroupRef = useRef<L.LayerGroup | null>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    lat: number;
    lng: number;
    elevation: number;
    depth: number;
    zoneType: string;
    zoneName: string;
    isLoading?: boolean;
  } | null>(null);

  const [zoom, setZoom] = useState<number>(5);

  const [fetchedElevations, setFetchedElevations] = useState<Record<string, number>>({});
  const elevationCacheRef = useRef<Map<string, number>>(new Map());
  const elevationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoveredLatLngRef = useRef<{ lat: number; lng: number } | null>(null);

  const getRealElevationValue = useCallback((lat: number, lng: number): number | null => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (fetchedElevations[key] !== undefined) {
      return fetchedElevations[key];
    }
    if (elevationCacheRef.current.has(key)) {
      return elevationCacheRef.current.get(key)!;
    }
    return null;
  }, [fetchedElevations]);

  const fetchElevationOnHover = useCallback((lat: number, lng: number) => {
    if (elevationTimeoutRef.current) {
      clearTimeout(elevationTimeoutRef.current);
    }
    
    elevationTimeoutRef.current = setTimeout(async () => {
      const latKey = Number(lat.toFixed(4));
      const lngKey = Number(lng.toFixed(4));
      const key = `${latKey},${lngKey}`;
      
      if (elevationCacheRef.current.has(key)) {
        return;
      }

      try {
        const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latKey}&longitude=${lngKey}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.elevation && data.elevation.length > 0) {
          const val = Math.round(data.elevation[0]);
          elevationCacheRef.current.set(key, val);
          setFetchedElevations(prev => ({
            ...prev,
            [key]: val
          }));
        }
      } catch (err) {
        console.error("Error fetching elevation from Open-Meteo API:", err);
      }
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (elevationTimeoutRef.current) {
        clearTimeout(elevationTimeoutRef.current);
      }
    };
  }, []);

  const currentLevelRef = useRef(waterState.currentLevel);
  useEffect(() => {
    currentLevelRef.current = waterState.currentLevel;
  }, [waterState.currentLevel]);

  const currentZoomRef = useRef(zoom);
  useEffect(() => {
    currentZoomRef.current = zoom;
  }, [zoom]);

  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const tileCanvasCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const waterOverlayRef = useRef<L.TileLayer | null>(null);

  const fetchElevationOnHoverRef = useRef(fetchElevationOnHover);
  useEffect(() => {
    fetchElevationOnHoverRef.current = fetchElevationOnHover;
  }, [fetchElevationOnHover]);

  const getRealElevationValueRef = useRef(getRealElevationValue);
  useEffect(() => {
    getRealElevationValueRef.current = getRealElevationValue;
  }, [getRealElevationValue]);

  // Synchronize hover info when fetched elevations or other states update
  useEffect(() => {
    if (!hoveredLatLngRef.current) return;
    const { lat, lng } = hoveredLatLngRef.current;
    
    const realElev = getRealElevationValue(lat, lng);
    if (realElev === null) {
      setHoverInfo({
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        elevation: 0,
        depth: 0,
        zoneType: 'land',
        zoneName: 'Загрузка данных высоты...',
        isLoading: true
      });
      return;
    }

    if (!layers.water) {
      setHoverInfo({
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        elevation: realElev,
        depth: 0,
        zoneType: 'land',
        zoneName: realElev > 400 ? 'Горный хребет (Саяны)' : realElev > 250 ? 'Возвышенность' : 'Низменность (Суша)',
        isLoading: false
      });
      return;
    }

    const profile = calculateGeoProfile(
      lat,
      lng,
      waterState.currentLevel,
      zoom,
      tileCanvasCacheRef.current,
      getRealElevationValue
    );
    setHoverInfo({
      ...profile,
      isLoading: false
    });
  }, [fetchedElevations, waterState.currentLevel, zoom, layers.water, getRealElevationValue]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on Krasnoyarsk Krai along the Yenisey River
    const map = L.map(mapContainerRef.current, {
      center: [58.5, 91.5], // Centered between Krasnoyarsk and Yeniseysk
      zoom: 5,
      minZoom: 3,
      maxZoom: 15,
      zoomControl: false, // Custom zoom buttons in top right
      attributionControl: false // Cleaner interface like Yandex
    });

    mapRef.current = map;

    // Add Layer Groups
    markersGroupRef.current = L.layerGroup().addTo(map);
    floodGroupRef.current = L.layerGroup().addTo(map);
    iceGroupRef.current = L.layerGroup().addTo(map);
    flowGroupRef.current = L.layerGroup().addTo(map);

    // Persistent Water Overlay
    const waterOverlay = new (WaterOverlayClass as any)('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: 'anonymous',
      opacity: layers.water ? 1.0 : 0.0,
      currentLevelRef: currentLevelRef,
      tileCanvasCacheRef: tileCanvasCacheRef,
      zIndex: 100
    });
    waterOverlayRef.current = waterOverlay;

    waterOverlay.on('tileunload', (e: any) => {
      const coords = e.coords;
      if (coords) {
        waterOverlay.removeTile(coords);
      }
    });

    waterOverlay.addTo(map);

    // Track mouse coordinates for dynamic depth & elevation profile
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      hoveredLatLngRef.current = { lat, lng };

      // Trigger debounced real-world elevation fetch from Open-Meteo
      fetchElevationOnHoverRef.current(lat, lng);

      const realElev = getRealElevationValueRef.current(lat, lng);

      if (realElev === null) {
        setHoverInfo({
          lat: Number(lat.toFixed(4)),
          lng: Number(lng.toFixed(4)),
          elevation: 0,
          depth: 0,
          zoneType: 'land',
          zoneName: 'Загрузка...',
          isLoading: true
        });
        return;
      }

      if (!layersRef.current.water) {
        // If water layer is disabled, treat everything as dry land
        setHoverInfo({
          lat: Number(lat.toFixed(4)),
          lng: Number(lng.toFixed(4)),
          elevation: realElev,
          depth: 0,
          zoneType: 'land',
          zoneName: realElev > 400 ? 'Горный хребет (Саяны)' : realElev > 250 ? 'Возвышенность' : 'Низменность (Суша)',
          isLoading: false
        });
        return;
      }

      const profile = calculateGeoProfile(
        lat,
        lng,
        currentLevelRef.current,
        currentZoomRef.current,
        tileCanvasCacheRef.current,
        getRealElevationValueRef.current
      );
      setHoverInfo({
        ...profile,
        isLoading: false
      });
    });

    map.on('mouseout', () => {
      hoveredLatLngRef.current = null;
      setHoverInfo(null);
    });

    // Handle zoomend to dynamically scale river widths
    map.on('zoomend', () => {
      setZoom(map.getZoom());
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync Base Tile Layer based on viewType
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = '';
    let options: L.TileLayerOptions = {};

    if (viewType === 'scheme') {
      // Standard clean OpenStreetMap schema
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      options = {
        maxZoom: 19,
        className: 'osm-tiles'
      };
    } else if (viewType === 'satellite') {
      // Esri World Imagery (Real Satellite images)
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      options = {
        maxZoom: 18
      };
    } else {
      // OpenTopoMap (Shows depth/topography very elegantly, perfect substitute for GEBCO / Relief)
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      options = {
        maxZoom: 17
      };
    }

    tileLayerRef.current = L.tileLayer(url, { ...options, zIndex: 1 }).addTo(map);
  }, [viewType]);

  // Sync Water Overlay TileLayer Redraw and Visibility
  useEffect(() => {
    const waterOverlay = waterOverlayRef.current as any;
    if (!waterOverlay) return;
    
    // Toggle opacity based on layers.water
    waterOverlay.setOpacity(layers.water ? 1.0 : 0.0);
    
    if (layers.water) {
      waterOverlay.redrawInPlace();
    }
  }, [layers.water, waterState.currentLevel]);

  // Sync Vector Flooding and Shallows Features
  useEffect(() => {
    if (floodGroupRef.current) floodGroupRef.current.clearLayers();
  }, [layers.water, waterState.currentLevel]);

  // Sync Ice Cover Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (iceGroupRef.current) iceGroupRef.current.clearLayers();

    if (layers.ice && iceState.averageThickness > 0) {
      const isSolid = iceState.iceType === 'fast';
      const iceOpacity = Math.min(0.7, iceState.iceCoverage / 100);
      const iceColor = isSolid ? '#e0f2fe' : '#bae6fd';

      const iceBoundary: [number, number][] = [
        [58.45, 92.18], [69.40, 86.18], [71.50, 83.50], [72.00, 100.0],
        [60.00, 105.0], [58.00, 95.0]
      ];

      L.polygon(iceBoundary, {
        color: '#60a5fa',
        fillColor: iceColor,
        fillOpacity: iceOpacity * 0.6,
        weight: 1,
        dashArray: '5, 5'
      })
      .bindPopup(`<b>Ледовый щит Сибири</b><br/>Толщина льда: ${iceState.averageThickness} см<br/>Покрытие: ${iceState.iceCoverage}%<br/>Тип: ${iceState.iceType === 'fast' ? 'Сплошной припай' : 'Дрейфующий лед'}`)
      .addTo(iceGroupRef.current!);
    }
  }, [layers.ice, iceState]);

  // Sync Monitoring Stations Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markersGroupRef.current) markersGroupRef.current.clearLayers();

    if (layers.stations) {
      stations.forEach((station) => {
        const isSelected = station.id === selectedStationId;
        const isCrit = station.currentLevel >= station.criticalLevelHigh || station.currentLevel <= station.criticalLevelLow;
        const levelSign = station.currentLevel > 0 ? `+${station.currentLevel}` : `${station.currentLevel}`;

        const iconHtml = `
          <div class="flex flex-col items-center">
            <div class="shadow-md rounded-full px-2 py-0.5 text-[10px] font-bold font-mono text-white flex items-center justify-center border transition-all ${
              isCrit 
                ? 'bg-rose-500 border-rose-600 animate-pulse scale-110' 
                : isSelected
                  ? 'bg-blue-600 border-blue-700 ring-2 ring-blue-300'
                  : 'bg-slate-800 border-slate-900'
            }">
              ${levelSign}
            </div>
            <div class="w-2.5 h-2.5 rounded-full border-2 border-white -mt-0.5 shadow transition-all ${
              isCrit ? 'bg-rose-500' : isSelected ? 'bg-blue-600' : 'bg-slate-800'
            }"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-station-marker',
          iconSize: [50, 40],
          iconAnchor: [25, 25]
        });

        const marker = L.marker([station.lat, station.lng], { icon: customIcon })
          .addTo(markersGroupRef.current!)
          .on('click', () => {
            onStationSelect(station);
            map.setView([station.lat, station.lng], Math.max(map.getZoom(), 7), { animate: true });
          });

        marker.bindPopup(`
          <div class="p-1 text-slate-800">
            <h4 class="font-extrabold text-sm border-b pb-1 mb-1 text-slate-900">${station.name}</h4>
            <div class="text-xs space-y-1">
              <div>Уровень воды: <span class="font-bold font-mono ${isCrit ? 'text-rose-600' : 'text-emerald-600'}">${levelSign} см</span></div>
              <div>Критический высокий порог: <span class="font-bold text-rose-500">${station.criticalLevelHigh} см</span></div>
              <div>Тип поста: <span class="font-semibold text-slate-600">${station.stationType === 'river' ? 'Речной пост' : 'Водохранилище'}</span></div>
            </div>
          </div>
        `);
      });
    }
  }, [layers.stations, stations, selectedStationId]);

  // Sync Shipping and Krasnoyarsk GES Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (flowGroupRef.current) flowGroupRef.current.clearLayers();

    if (layers.shipping) {
      // 2. Draw Krasnoyarsk GES Marker
      const gesCoords: [number, number] = [55.9341, 92.2923];
      const gesStatusHtml = `
        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 border border-emerald-600 shadow-md text-white rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap leading-none ${
          waterState.isGesGatesOpen ? 'bg-rose-500 border-rose-600 animate-pulse' : 'bg-emerald-500 border-emerald-600'
        }">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
          Красноярская ГЭС: ${waterState.gesDischargeRate} м³/с
        </div>
      `;

      const gesIcon = L.divIcon({
        html: gesStatusHtml,
        className: 'ges-marker',
        iconSize: [160, 30],
        iconAnchor: [80, 15]
      });

      L.marker(gesCoords, { icon: gesIcon })
        .addTo(flowGroupRef.current!)
        .bindPopup(`
          <div class="p-2 text-slate-800">
            <h4 class="font-extrabold text-xs text-slate-900">Красноярская ГЭС им. 50-летия СССР</h4>
            <p class="text-xs text-slate-500 mt-1">Одна из мощнейших гидроэлектростанций мира. Является ключевым регулятором уровня воды в Енисее.</p>
            <div class="text-xs space-y-1 border-t pt-2 mt-2">
              <div>Текущий расход воды: <span class="font-bold text-emerald-600">${waterState.gesDischargeRate} м³/с</span></div>
              <div>Водосбросные шандоры: <span class="font-bold ${waterState.isGesGatesOpen ? 'text-red-500' : 'text-slate-600'}">${waterState.isGesGatesOpen ? 'ОТКРЫТЫ (Холостой сброс)' : 'ЗАКРЫТЫ'}</span></div>
            </div>
          </div>
        `);
    }
  }, [layers.shipping, waterState.isGesGatesOpen, waterState.gesDischargeRate, waterState.currentLevel]);

  // Zoom control triggers
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetView = () => {
    mapRef.current?.setView([58.5, 91.5], 5);
  };

  return (
    <div className="relative w-full h-[580px] bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner flex flex-col">
      
      {/* 1. MAP CANVAS HOLDER */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-10" 
      />

      {/* 2. DYNAMIC PROFILE HUD (Real-time depth & elevation data on hover) */}
      <div className="absolute top-4 left-4 p-4 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-lg z-20 w-[280px] text-left transition-all duration-200 pointer-events-none">
        <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
          <Activity size={13} className="text-blue-500 animate-pulse" /> 
          Профиль высот и глубин (HUD)
        </h4>
        
        {hoverInfo ? (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                hoverInfo.zoneType === 'river' ? 'bg-blue-500 text-white' :
                hoverInfo.zoneType === 'flooded_bank' ? 'bg-rose-500 text-white animate-pulse' :
                hoverInfo.zoneType === 'shoal' ? 'bg-amber-500 text-white' :
                'bg-slate-100 text-slate-600'
              }`}>
                {hoverInfo.zoneType === 'river' ? 'Русло' :
                 hoverInfo.zoneType === 'flooded_bank' ? 'ЗАТOПЛЕНO' :
                 hoverInfo.zoneType === 'shoal' ? 'МЕЛЬ' : 'СУША'}
              </span>
              <span className="text-xs font-bold text-slate-800 line-clamp-1">
                {hoverInfo.zoneName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-xs">
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">Рельеф суши</div>
                {hoverInfo.isLoading ? (
                  <div className="h-5 w-16 bg-slate-200 animate-pulse rounded mt-0.5"></div>
                ) : (
                  <div className="font-extrabold text-slate-800 font-mono text-sm mt-0.5">
                    {hoverInfo.elevation} м
                  </div>
                )}
                <div className="text-[8px] text-slate-400">высота над морем</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">Глубина воды</div>
                {hoverInfo.isLoading ? (
                  <div className="h-5 w-16 bg-slate-200 animate-pulse rounded mt-0.5"></div>
                ) : (
                  <div className={`font-extrabold font-mono text-sm mt-0.5 ${hoverInfo.depth > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                    {hoverInfo.depth > 0 ? `${hoverInfo.depth} м` : '—'}
                  </div>
                )}
                <div className="text-[8px] text-slate-400">толща водоема</div>
              </div>
            </div>

            <div className="text-[9px] font-mono text-slate-400 flex justify-between pt-1 border-t border-slate-100">
              <span>Ш: {hoverInfo.lat}°</span>
              <span>Д: {hoverInfo.lng}°</span>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Наведите курсор на любую точку карты для замера высот и глубины в реальном времени
            </p>
          </div>
        )}
      </div>

      {/* 3. COMPASS AND NORTH WIND INDICATOR */}
      <div className="absolute bottom-4 left-4 p-3 bg-white border border-slate-200/80 rounded-xl shadow-md pointer-events-none z-20 flex items-center gap-3">
        <div className="relative w-9 h-9 border border-slate-200 rounded-full flex items-center justify-center bg-slate-50">
          <Compass className="text-slate-600 animate-pulse" size={20} />
          <span className="absolute top-0 text-[7px] font-extrabold text-rose-500 leading-none">N</span>
          <span className="absolute bottom-0 text-[7px] font-bold text-slate-400 leading-none">S</span>
        </div>
        <div className="text-left leading-none">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Направление ветра</div>
          <div className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1 mt-0.5 font-mono">
            <Wind size={11} className="text-blue-500" />
            {weather.windDirection} • {weather.windSpeed} м/с
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION BUTTONS (Yandex Maps Clean White Style) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
          <button 
            onClick={handleZoomIn}
            className="p-2.5 hover:bg-slate-50 border-b border-slate-100 text-slate-600 transition-colors"
            title="Приблизить карту"
          >
            <Maximize2 size={15} />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2.5 hover:bg-slate-50 border-b border-slate-100 text-slate-600 transition-colors"
            title="Отдалить карту"
          >
            <Minimize2 size={15} />
          </button>
          <button 
            onClick={handleResetView}
            className="py-1.5 text-[9px] font-bold text-slate-500 hover:bg-slate-50 text-center transition-colors font-mono"
            title="Сбросить на Сибирь"
          >
            ЦЕНТР
          </button>
        </div>

        {/* Legend Panel */}
        <div className="hidden md:block p-3 bg-white border border-slate-200 rounded-xl shadow-md text-left w-[180px]">
          <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
            <Info size={12} className="text-blue-500" /> Состояние Енисея
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Сброс ГЭС:</span>
              <span className="font-bold text-slate-800 font-mono">{waterState.gesDischargeRate} м³/с</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Уровень:</span>
              <span className={`font-bold font-mono ${waterState.currentLevel >= 500 ? 'text-rose-500' : 'text-slate-800'}`}>
                {waterState.currentLevel > 0 ? `+${waterState.currentLevel}` : waterState.currentLevel} см
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Лед:</span>
              <span className="font-bold text-slate-800">{iceState.averageThickness} см</span>
            </div>
            <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
              <span className="text-slate-400 font-semibold">Водосброс ГЭС:</span>
              <span className={`px-1.5 py-0.5 rounded font-extrabold text-[8px] uppercase ${waterState.isGesGatesOpen ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                {waterState.isGesGatesOpen ? 'ОТКРЫТ' : 'НОРМА'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. DYNAMIC ACCESSIBLE SLIDER ON MAP (Ручной переключатель уровня воды) */}
      <div className="absolute bottom-4 right-4 bg-white p-3 border border-slate-200 rounded-xl shadow-md z-20 w-[240px] text-left">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <Activity size={13} className="text-blue-500 animate-pulse" /> Уровень воды (ручной)
          </span>
          <span className="font-mono font-bold text-blue-600 text-xs">
            {waterState.currentLevel > 0 ? `+${waterState.currentLevel}` : waterState.currentLevel} см
          </span>
        </div>
        
        {onWaterLevelChange && (
          <input 
            type="range"
            min="-100"
            max="1000"
            value={waterState.currentLevel}
            onChange={(e) => onWaterLevelChange(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        )}
        
        <div className="flex justify-between text-[8px] text-slate-400 font-mono font-bold mt-1">
          <span>-100см (Межень)</span>
          <span>+300см (Выход)</span>
          <span className="text-rose-500">+800см (Опасный)</span>
        </div>
      </div>
    </div>
  );
}
