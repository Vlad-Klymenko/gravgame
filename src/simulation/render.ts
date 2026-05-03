import type { SimulationState } from "./types";
import {
  CANVAS_BACKGROUND,
  GRAVITATIONAL_CONSTANT,
  BODY_COLOR,
  BODY_CORE_COLOR,
  BODY_EDGE_COLOR,
  BODY_GLOW_COLOR,
  PREVIEW_BODY_COLOR,
  PREVIEW_BODY_CORE_COLOR,
  PREVIEW_BODY_EDGE_COLOR,
  PREVIEW_BODY_GLOW_COLOR,
  ORBIT_GUIDE_COLOR,
  OVERLAY_TEXT_COLOR,
  OVERLAY_FONT,
  PROJECTILE_COLOR,
  SHIP_BURN_COLOR,
  SHIP_COLOR,
  SHIP_GRAVITY_SCALE,
  SHIP_MAX_FUEL,
  SOFTENING_DISTANCE,
  STAR_COLOR,
  TRAJECTORY_COLOR,
  TRAJECTORY_SAMPLE_INTERVAL,
  TRAJECTORY_STEPS,
  TRAJECTORY_STEP_TIME,
} from "./constants";
import { calculateOrbitalVelocity, findNearestBody } from "./physics";

interface BodyPalette {
  core: string;
  mid: string;
  edge: string;
  glow: string;
}

const bodyPalette: BodyPalette = {
  core: BODY_CORE_COLOR,
  mid: BODY_COLOR,
  edge: BODY_EDGE_COLOR,
  glow: BODY_GLOW_COLOR,
};

const previewPalette: BodyPalette = {
  core: PREVIEW_BODY_CORE_COLOR,
  mid: PREVIEW_BODY_COLOR,
  edge: PREVIEW_BODY_EDGE_COLOR,
  glow: PREVIEW_BODY_GLOW_COLOR,
};

interface PredictedBody {
  id: number;
  x: number;
  y: number;
  radius: number;
  mass: number;
}

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: SimulationState,
): void {
  // Clear canvas
  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStarfield(ctx, canvas);

  for (const body of state.bodies) {
    drawGlowingBody(ctx, body.x, body.y, body.radius, bodyPalette);
  }

  // Draw preview body if active
  if (state.previewBody) {
    drawGlowingBody(
      ctx,
      state.previewBody.x,
      state.previewBody.y,
      state.previewBody.radius,
      previewPalette,
    );

    // Draw orbital velocity guide if there are existing bodies
    if (state.bodies.length > 0) {
      const nearest = findNearestBody(
        state.previewBody.x,
        state.previewBody.y,
        state.bodies,
      );
      if (nearest) {
        const orbital = calculateOrbitalVelocity(
          state.previewBody.x,
          state.previewBody.y,
          nearest,
        );

        // Draw orbital velocity vector as an arrow
        const endX = state.previewBody.x + orbital.vx * 0.01;
        const endY = state.previewBody.y + orbital.vy * 0.01;

        ctx.strokeStyle = ORBIT_GUIDE_COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(state.previewBody.x, state.previewBody.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(orbital.vy, orbital.vx);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(
          endX - arrowSize * Math.cos(angle - Math.PI / 6),
          endY - arrowSize * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(endX, endY);
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle + Math.PI / 6),
          endY - arrowSize * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();

        ctx.globalAlpha = 1;
      }
    }
  }

  drawProjectiles(ctx, state);
  drawTrajectory(ctx, state);
  drawShip(ctx, state);

  // Draw overlay
  drawOverlay(ctx, canvas, state);
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): void {
  const spacing = 58;
  const cols = Math.ceil(canvas.width / spacing) + 1;
  const rows = Math.ceil(canvas.height / spacing) + 1;

  ctx.save();
  ctx.fillStyle = STAR_COLOR;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const seed = x * 7349 + y * 9151;
      const brightness = pseudoRandom(seed);

      if (brightness < 0.34) continue;

      const offsetX = (pseudoRandom(seed + 17) - 0.5) * spacing;
      const offsetY = (pseudoRandom(seed + 29) - 0.5) * spacing;
      const radius = 0.45 + pseudoRandom(seed + 41) * 1.1;

      ctx.globalAlpha = 0.16 + brightness * 0.42;
      ctx.beginPath();
      ctx.arc(x * spacing + offsetX, y * spacing + offsetY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawGlowingBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  palette: BodyPalette,
): void {
  const glowRadius = radius * 2.4;
  const glow = ctx.createRadialGradient(x, y, radius * 0.25, x, y, glowRadius);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(0.42, palette.glow);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = ctx.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.34,
    radius * 0.08,
    x,
    y,
    radius * 1.06,
  );
  body.addColorStop(0, palette.core);
  body.addColorStop(0.36, palette.mid);
  body.addColorStop(0.78, palette.mid);
  body.addColorStop(1, palette.edge);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = radius * 0.6;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  state: SimulationState,
): void {
  ctx.save();
  ctx.fillStyle = PROJECTILE_COLOR;
  ctx.shadowColor = "rgba(255, 255, 255, 0.36)";
  ctx.shadowBlur = 8;

  for (const projectile of state.projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  state: SimulationState,
): void {
  const points = calculateProjectileTrajectory(state);
  if (points.length < 2) return;

  const visiblePoints = trimTrajectoryStart(
    state.ship.x,
    state.ship.y,
    points,
    state.ship.radius * 2.4,
  );

  if (visiblePoints.length < 2) return;

  ctx.save();
  ctx.strokeStyle = TRAJECTORY_COLOR;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([7, 9]);
  ctx.beginPath();
  ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);

  for (const point of visiblePoints.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.restore();
}

function trimTrajectoryStart(
  originX: number,
  originY: number,
  points: { x: number; y: number }[],
  distance: number,
): { x: number; y: number }[] {
  const firstVisibleIndex = points.findIndex((point) => {
    const dx = point.x - originX;
    const dy = point.y - originY;
    return Math.sqrt(dx * dx + dy * dy) >= distance;
  });

  return firstVisibleIndex === -1 ? [] : points.slice(firstVisibleIndex);
}

function calculateProjectileTrajectory(
  state: SimulationState,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const bodies = state.bodies.map((body) => ({
    id: body.id,
    x: body.x,
    y: body.y,
    radius: body.radius,
    mass: body.mass,
  }));
  let x = state.ship.x;
  let y = state.ship.y;
  let vx = state.ship.vx;
  let vy = state.ship.vy;

  for (let i = 0; i < TRAJECTORY_STEPS; i++) {
    const acceleration = calculateGravityAcceleration(x, y, bodies);

    x +=
      vx * TRAJECTORY_STEP_TIME +
      0.5 * acceleration.ax * TRAJECTORY_STEP_TIME * TRAJECTORY_STEP_TIME;
    y +=
      vy * TRAJECTORY_STEP_TIME +
      0.5 * acceleration.ay * TRAJECTORY_STEP_TIME * TRAJECTORY_STEP_TIME;

    const nextAcceleration = calculateGravityAcceleration(x, y, bodies);

    vx +=
      0.5 * (acceleration.ax + nextAcceleration.ax) * TRAJECTORY_STEP_TIME;
    vy +=
      0.5 * (acceleration.ay + nextAcceleration.ay) * TRAJECTORY_STEP_TIME;

    if (i % TRAJECTORY_SAMPLE_INTERVAL === 0) {
      points.push({ x, y });
    }

    const hasHitBody = bodies.some((body) => {
      const dx = body.x - x;
      const dy = body.y - y;
      return Math.sqrt(dx * dx + dy * dy) < body.radius + state.ship.radius;
    });

    if (hasHitBody) break;
  }

  return points;
}

function calculateGravityAcceleration(
  x: number,
  y: number,
  bodies: PredictedBody[],
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;

  for (const body of bodies) {
    const dx = body.x - x;
    const dy = body.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distWithSoftening = Math.max(dist, SOFTENING_DISTANCE);
    const acceleration =
      (GRAVITATIONAL_CONSTANT * body.mass * SHIP_GRAVITY_SCALE) /
      (distWithSoftening * distWithSoftening);
    const angle = Math.atan2(dy, dx);

    ax += Math.cos(angle) * acceleration;
    ay += Math.sin(angle) * acceleration;
  }

  return { ax, ay };
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  state: SimulationState,
): void {
  const ship = state.ship;
  const nose = ship.radius * 1.65;
  const wing = ship.radius * 0.8;
  const tail = ship.radius * 1.05;
  const cos = Math.cos(ship.angle);
  const sin = Math.sin(ship.angle);

  const point = (forward: number, side: number) => ({
    x: ship.x + cos * forward - sin * side,
    y: ship.y + sin * forward + cos * side,
  });

  const front = point(nose, 0);
  const right = point(-ship.radius * 0.12, wing);
  const back = point(-tail, 0);
  const left = point(-ship.radius * 0.12, -wing);

  if (ship.isBurning) {
    const flameBack = point(-tail * 1.85, 0);
    const flameLeft = point(-tail * 0.82, -ship.radius * 0.36);
    const flameRight = point(-tail * 0.82, ship.radius * 0.36);

    ctx.save();
    ctx.fillStyle = SHIP_BURN_COLOR;
    ctx.shadowColor = SHIP_BURN_COLOR;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(flameLeft.x, flameLeft.y);
    ctx.lineTo(flameBack.x, flameBack.y);
    ctx.lineTo(flameRight.x, flameRight.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = SHIP_COLOR;
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(front.x, front.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(back.x, back.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: SimulationState,
): void {
  ctx.font = OVERLAY_FONT;
  ctx.fillStyle = OVERLAY_TEXT_COLOR;
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 8;

  const padding = 10;
  let y = padding + 14; // Line height ~14px

  // Body count
  ctx.fillText(`Bodies: ${state.bodies.length}`, padding, y);

  // Status
  y += 20;
  const status = state.isPaused ? "PAUSED" : "RUNNING";
  ctx.fillText(`Status: ${status}`, padding, y);

  // Controls
  y += 20;
  ctx.font = "12px monospace";
  ctx.fillText(
    "Click & drag to spawn | Shift+Click orbit | A/D steer | Space burn | F shoot | P pause | R reset",
    padding,
    y,
  );

  // Orbital velocity hint
  if (state.previewBody && state.bodies.length > 0) {
    y += 16;
    ctx.fillStyle = ORBIT_GUIDE_COLOR;
    ctx.fillText("Green arrow = stable orbit velocity", padding, y);
  }

  ctx.shadowBlur = 0;
  drawFuelBar(ctx, canvas, state.ship.fuel / SHIP_MAX_FUEL);
}

function drawFuelBar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  fuelRatio: number,
): void {
  const width = 150;
  const height = 9;
  const padding = 18;
  const labelWidth = 34;
  const x = canvas.width - width - labelWidth - padding;
  const y = canvas.height - height - padding;
  const clampedRatio = Math.max(0, Math.min(1, fuelRatio));

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.74)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillRect(x + 2, y + 2, (width - 4) * clampedRatio, height - 4);

  ctx.font = "12px monospace";
  ctx.fillStyle = OVERLAY_TEXT_COLOR;
  ctx.fillText("Fuel", x + width + 10, y + height);
  ctx.restore();
}
