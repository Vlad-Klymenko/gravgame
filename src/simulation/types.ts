export interface Body {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
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

export interface SimulationState {
  bodies: Body[];
  isPaused: boolean;
  previewBody: PreviewBody | null;
  nextBodyId: number;
  ship: Ship;
  shipControls: ShipControls;
  projectiles: Projectile[];
  nextProjectileId: number;
}
