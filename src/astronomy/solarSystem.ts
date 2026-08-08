export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type PlanetId = Exclude<BodyId, 'sun' | 'moon'>;

export interface Vector3Value { x: number; y: number; z: number; }

export interface BodyDefinition {
  id: BodyId;
  name: string;
  englishName: string;
  color: number;
  radius: number;
  periodDays: number;
  description: string;
}

export interface BodyPosition extends BodyDefinition {
  positionAU: Vector3Value;
  distanceAU: number;
  longitudeDeg: number;
}

interface ElementPair { base: number; rate: number; }
interface OrbitalElements {
  a: ElementPair;
  e: ElementPair;
  i: ElementPair;
  l: ElementPair;
  perihelion: ElementPair;
  node: ElementPair;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const AU_KM = 149_597_870.7;

export const BODY_DEFINITIONS: Record<BodyId, BodyDefinition> = {
  sun: { id: 'sun', name: '太陽', englishName: 'Sun', color: 0xffc85a, radius: 2.65, periodDays: 0, description: '太陽系の中心で輝く恒星' },
  mercury: { id: 'mercury', name: '水星', englishName: 'Mercury', color: 0xaaa49b, radius: .38, periodDays: 87.969, description: '太陽に最も近い、小さく速い惑星' },
  venus: { id: 'venus', name: '金星', englishName: 'Venus', color: 0xe7bc78, radius: .57, periodDays: 224.701, description: '厚い雲に包まれた地球の隣人' },
  earth: { id: 'earth', name: '地球', englishName: 'Earth', color: 0x4e8edb, radius: .61, periodDays: 365.256, description: '海と生命をたたえる、わたしたちの惑星' },
  moon: { id: 'moon', name: '月', englishName: 'Moon', color: 0xc8c7c2, radius: .2, periodDays: 27.322, description: '地球の周りを公転する衛星' },
  mars: { id: 'mars', name: '火星', englishName: 'Mars', color: 0xc75f3c, radius: .46, periodDays: 686.98, description: '酸化鉄の大地を持つ赤い惑星' },
  jupiter: { id: 'jupiter', name: '木星', englishName: 'Jupiter', color: 0xd7a879, radius: 1.38, periodDays: 4332.589, description: '巨大な渦を持つ太陽系最大の惑星' },
  saturn: { id: 'saturn', name: '土星', englishName: 'Saturn', color: 0xe2c68b, radius: 1.2, periodDays: 10759.22, description: '明るく広い環が際立つ巨大惑星' },
  uranus: { id: 'uranus', name: '天王星', englishName: 'Uranus', color: 0x84d3da, radius: .84, periodDays: 30688.5, description: '横倒しに近い姿勢で回る氷の惑星' },
  neptune: { id: 'neptune', name: '海王星', englishName: 'Neptune', color: 0x3e68d8, radius: .82, periodDays: 60182, description: '青く、強い風が吹く最遠の惑星' },
};

export const PLANET_IDS: PlanetId[] = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const BODY_IDS: BodyId[] = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// J2000.0を基準にした平均軌道要素と1ユリウス世紀あたりの変化量。
const ELEMENTS: Record<PlanetId, OrbitalElements> = {
  mercury: { a: { base: .38709927, rate: .00000037 }, e: { base: .20563593, rate: .00001906 }, i: { base: 7.00497902, rate: -.00594749 }, l: { base: 252.2503235, rate: 149472.67411175 }, perihelion: { base: 77.45779628, rate: .16047689 }, node: { base: 48.33076593, rate: -.12534081 } },
  venus: { a: { base: .72333566, rate: .0000039 }, e: { base: .00677672, rate: -.00004107 }, i: { base: 3.39467605, rate: -.0007889 }, l: { base: 181.9790995, rate: 58517.81538729 }, perihelion: { base: 131.60246718, rate: .00268329 }, node: { base: 76.67984255, rate: -.27769418 } },
  earth: { a: { base: 1.00000261, rate: .00000562 }, e: { base: .01671123, rate: -.00004392 }, i: { base: -.00001531, rate: -.01294668 }, l: { base: 100.46457166, rate: 35999.37244981 }, perihelion: { base: 102.93768193, rate: .32327364 }, node: { base: 0, rate: 0 } },
  mars: { a: { base: 1.52371034, rate: .00001847 }, e: { base: .0933941, rate: .00007882 }, i: { base: 1.84969142, rate: -.00813131 }, l: { base: -4.55343205, rate: 19140.30268499 }, perihelion: { base: -23.94362959, rate: .44441088 }, node: { base: 49.55953891, rate: -.29257343 } },
  jupiter: { a: { base: 5.202887, rate: -.00011607 }, e: { base: .04838624, rate: -.00013253 }, i: { base: 1.30439695, rate: -.00183714 }, l: { base: 34.39644051, rate: 3034.74612775 }, perihelion: { base: 14.72847983, rate: .21252668 }, node: { base: 100.47390909, rate: .20469106 } },
  saturn: { a: { base: 9.53667594, rate: -.0012506 }, e: { base: .05386179, rate: -.00050991 }, i: { base: 2.48599187, rate: .00193609 }, l: { base: 49.95424423, rate: 1222.49362201 }, perihelion: { base: 92.59887831, rate: -.41897216 }, node: { base: 113.66242448, rate: -.28867794 } },
  uranus: { a: { base: 19.18916464, rate: -.00196176 }, e: { base: .04725744, rate: -.00004397 }, i: { base: .77263783, rate: -.00242939 }, l: { base: 313.23810451, rate: 428.48202785 }, perihelion: { base: 170.9542763, rate: .40805281 }, node: { base: 74.01692503, rate: .04240589 } },
  neptune: { a: { base: 30.06992276, rate: .00026291 }, e: { base: .00859048, rate: .00005105 }, i: { base: 1.77004347, rate: .00035372 }, l: { base: -55.12002969, rate: 218.45945325 }, perihelion: { base: 44.96476227, rate: -.32241464 }, node: { base: 131.78422574, rate: -.00508664 } },
};

const normalizeRadians = (value: number): number => ((value % TAU) + TAU) % TAU;
const normalizeDegrees = (value: number): number => ((value % 360) + 360) % 360;
const atCentury = (pair: ElementPair, centuries: number): number => pair.base + pair.rate * centuries;

export function julianDay(date: Date): number {
  const time = date.getTime();
  if (!Number.isFinite(time)) throw new Error('日時が不正です。');
  return time / 86_400_000 + 2_440_587.5;
}

export function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  const mean = normalizeRadians(meanAnomalyRad);
  let eccentric = mean + eccentricity * Math.sin(mean);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const correction = (eccentric - eccentricity * Math.sin(eccentric) - mean) / (1 - eccentricity * Math.cos(eccentric));
    eccentric -= correction;
    if (Math.abs(correction) < 1e-12) break;
  }
  return eccentric;
}

function currentElements(id: PlanetId, date: Date): { a: number; e: number; i: number; l: number; perihelion: number; node: number } {
  const centuries = (julianDay(date) - 2_451_545) / 36_525;
  const source = ELEMENTS[id];
  return {
    a: atCentury(source.a, centuries),
    e: atCentury(source.e, centuries),
    i: atCentury(source.i, centuries) * DEG,
    l: atCentury(source.l, centuries) * DEG,
    perihelion: atCentury(source.perihelion, centuries) * DEG,
    node: atCentury(source.node, centuries) * DEG,
  };
}

function positionFromEccentricAnomaly(elements: ReturnType<typeof currentElements>, eccentricAnomaly: number): Vector3Value {
  const orbitalX = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
  const orbitalY = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);
  const argumentOfPerihelion = elements.perihelion - elements.node;
  const cosNode = Math.cos(elements.node); const sinNode = Math.sin(elements.node);
  const cosArg = Math.cos(argumentOfPerihelion); const sinArg = Math.sin(argumentOfPerihelion);
  const cosInclination = Math.cos(elements.i); const sinInclination = Math.sin(elements.i);
  return {
    x: (cosNode * cosArg - sinNode * sinArg * cosInclination) * orbitalX + (-cosNode * sinArg - sinNode * cosArg * cosInclination) * orbitalY,
    y: (sinNode * cosArg + cosNode * sinArg * cosInclination) * orbitalX + (-sinNode * sinArg + cosNode * cosArg * cosInclination) * orbitalY,
    z: sinArg * sinInclination * orbitalX + cosArg * sinInclination * orbitalY,
  };
}

export function heliocentricPosition(id: PlanetId, date: Date): Vector3Value {
  const elements = currentElements(id, date);
  const meanAnomaly = elements.l - elements.perihelion;
  return positionFromEccentricAnomaly(elements, solveKepler(meanAnomaly, elements.e));
}

export function orbitPath(id: PlanetId, date: Date, segments = 160): Vector3Value[] {
  const elements = currentElements(id, date);
  return Array.from({ length: segments + 1 }, (_, index) => positionFromEccentricAnomaly(elements, index / segments * TAU));
}

function lunarPosition(date: Date): Vector3Value {
  const days = julianDay(date) - 2_451_545;
  const meanLongitude = normalizeDegrees(218.316 + 13.176396 * days) * DEG;
  const meanAnomaly = normalizeDegrees(134.963 + 13.064993 * days) * DEG;
  const argumentLatitude = normalizeDegrees(93.272 + 13.22935 * days) * DEG;
  const longitude = meanLongitude + 6.289 * DEG * Math.sin(meanAnomaly);
  const latitude = 5.128 * DEG * Math.sin(argumentLatitude);
  const distance = (385_001 - 20_905 * Math.cos(meanAnomaly)) / AU_KM;
  return {
    x: distance * Math.cos(latitude) * Math.cos(longitude),
    y: distance * Math.cos(latitude) * Math.sin(longitude),
    z: distance * Math.sin(latitude),
  };
}

function decorate(definition: BodyDefinition, positionAU: Vector3Value): BodyPosition {
  const distanceAU = Math.hypot(positionAU.x, positionAU.y, positionAU.z);
  return { ...definition, positionAU, distanceAU, longitudeDeg: normalizeDegrees(Math.atan2(positionAU.y, positionAU.x) / DEG) };
}

export function solarSystemAt(date: Date): BodyPosition[] {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const planets = PLANET_IDS.map((id) => decorate(BODY_DEFINITIONS[id], heliocentricPosition(id, safeDate)));
  const earth = planets.find((body) => body.id === 'earth')!;
  const moonRelative = lunarPosition(safeDate);
  const moon = decorate(BODY_DEFINITIONS.moon, {
    x: earth.positionAU.x + moonRelative.x,
    y: earth.positionAU.y + moonRelative.y,
    z: earth.positionAU.z + moonRelative.z,
  });
  return [decorate(BODY_DEFINITIONS.sun, { x: 0, y: 0, z: 0 }), ...planets.slice(0, 3), moon, ...planets.slice(3)];
}
