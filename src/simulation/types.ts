export interface Body {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  orbit?: Orbit;
}

export interface Orbit {
  centerBodyId: number;
  distance: number;
  angle: number;
  angularVelocity: number;
}

export interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  mass: number;
  isBurning: boolean;
  landedOnBodyId: number | null;
  takeoffGraceTime: number;
  takeoffThrustMultiplier: number;
  fuel: number;
  burnCooldown: number;
}

export interface ShipControls {
  burn: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  manualZoom: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  age: number;
}

export interface PreviewBody {
  x: number;
  y: number;
  radius: number;
  startTime: number;
}

export interface TrajectoryCache {
  points: { x: number; y: number }[];
  closestApproach: ClosestApproach | null;
  elapsed: number;
  signature: string;
}

export interface ClosestApproach {
  trajectoryX: number;
  trajectoryY: number;
  targetX: number;
  targetY: number;
  distance: number;
}

export interface MissionState {
  pickupBodyId: number;
  deliveryBodyId: number;
  hasCargo: boolean;
  completedDeliveries: number;
  message: string;
}

export interface LastLanding {
  bodyId: number;
  relativeSpeed: number;
  safe: boolean;
  elapsed: number;
}

export interface SimulationState {
  bodies: Body[];
  isPaused: boolean;
  timeScale: number;
  fps: number;
  previewBody: PreviewBody | null;
  nextBodyId: number;
  ship: Ship;
  shipControls: ShipControls;
  camera: Camera;
  projectiles: Projectile[];
  nextProjectileId: number;
  trajectoryCache: TrajectoryCache;
  mission: MissionState;
  lastLanding: LastLanding | null;
}
