import type { Body, ClosestApproach, SimulationState } from "./types";
import {
  BODY_COLOR,
  BODY_CORE_COLOR,
  BODY_CULL_PADDING,
  BODY_EDGE_COLOR,
  BODY_GLOW_COLOR,
  CANVAS_BACKGROUND,
  CLOSEST_APPROACH_COLOR,
  DETAILED_BODY_MAX_SCREEN_RADIUS,
  GRAVITATIONAL_CONSTANT,
  MAP_MODE_ZOOM,
  MAX_SCREEN_GLOW_RADIUS,
  NEAR_BODY_DISTANCE,
  ORBIT_GUIDE_COLOR,
  OVERLAY_FONT,
  OVERLAY_TEXT_COLOR,
  PREVIEW_BODY_COLOR,
  PREVIEW_BODY_CORE_COLOR,
  PREVIEW_BODY_EDGE_COLOR,
  PREVIEW_BODY_GLOW_COLOR,
  PROJECTILE_COLOR,
  SAFE_LANDING_RELATIVE_SPEED,
  SHIP_BURN_COLOR,
  SHIP_COLOR,
  SHIP_GRAVITY_SCALE,
  SHIP_MAX_FUEL,
  SOFTENING_DISTANCE,
  STAR_COLOR,
  TRAJECTORY_CACHE_INTERVAL,
  TRAJECTORY_COLOR,
  TRAJECTORY_SAMPLE_INTERVAL,
  TRAJECTORY_STEPS,
  TRAJECTORY_STEP_TIME,
} from "./constants";
import { applyCameraTransform, worldToScreen } from "./camera";
import { calculateOrbitalVelocity, findNearestBody } from "./physics";
import { getMissionTargetId } from "./mission";

interface BodyPalette {
  core: string;
  mid: string;
  edge: string;
  glow: string;
}

interface TrajectoryPrediction {
  points: { x: number; y: number }[];
  closestApproach: ClosestApproach | null;
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

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: SimulationState,
): void {
  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStarfield(ctx, canvas);

  const isMapMode = state.camera.zoom <= MAP_MODE_ZOOM;

  ctx.save();
  applyCameraTransform(ctx, state.camera, canvas);

  if (isMapMode) {
    drawMapOrbits(ctx, state);
  }

  for (const body of state.bodies) {
    const screen = getScreenCircle(body.x, body.y, body.radius, state, canvas);
    if (!isCircleVisible(screen, canvas)) continue;

    if (isMapMode) {
      drawMapBody(ctx, body);
    } else if (screen.radius > DETAILED_BODY_MAX_SCREEN_RADIUS) {
      drawSimpleBody(ctx, body.x, body.y, body.radius, bodyPalette);
    } else {
      drawGlowingBody(ctx, body.x, body.y, body.radius, bodyPalette, state.camera.zoom);
    }
  }

  if (isMapMode) {
    drawMissionMarkers(ctx, state);
  }

  drawPreviewBody(ctx, state, canvas);
  drawProjectiles(ctx, state);
  drawTrajectory(ctx, state);

  if (isMapMode) {
    drawClosestApproach(ctx, state);
  } else {
    drawShip(ctx, state);
  }

  ctx.restore();

  if (isMapMode) {
    drawMapShipMarker(ctx, canvas, state);
  }

  drawOverlay(ctx, canvas, state);
}

function drawPreviewBody(
  ctx: CanvasRenderingContext2D,
  state: SimulationState,
  canvas: HTMLCanvasElement,
): void {
  if (!state.previewBody) return;

  const preview = state.previewBody;
  const screen = getScreenCircle(preview.x, preview.y, preview.radius, state, canvas);

  if (isCircleVisible(screen, canvas)) {
    drawGlowingBody(ctx, preview.x, preview.y, preview.radius, previewPalette, state.camera.zoom);
  }

  const nearest = findNearestBody(preview.x, preview.y, state.bodies);
  if (!nearest) return;

  const orbital = calculateOrbitalVelocity(preview.x, preview.y, nearest);
  const endX = preview.x + orbital.vx * 0.01;
  const endY = preview.y + orbital.vy * 0.01;
  const angle = Math.atan2(orbital.vy, orbital.vx);
  const arrowSize = 8 / state.camera.zoom;

  ctx.save();
  ctx.strokeStyle = ORBIT_GUIDE_COLOR;
  ctx.lineWidth = 2 / state.camera.zoom;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(preview.x, preview.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX, endY);
  ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
  ctx.restore();
}

function getScreenCircle(
  x: number,
  y: number,
  radius: number,
  state: SimulationState,
  canvas: HTMLCanvasElement,
): { x: number; y: number; radius: number } {
  const screen = worldToScreen(x, y, state.camera, canvas.width, canvas.height);
  return { x: screen.x, y: screen.y, radius: radius * state.camera.zoom };
}

function isCircleVisible(
  circle: { x: number; y: number; radius: number },
  canvas: HTMLCanvasElement,
): boolean {
  const radius = circle.radius + BODY_CULL_PADDING;
  return (
    circle.x + radius >= 0 &&
    circle.x - radius <= canvas.width &&
    circle.y + radius >= 0 &&
    circle.y - radius <= canvas.height
  );
}

function drawMapOrbits(ctx: CanvasRenderingContext2D, state: SimulationState): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1 / state.camera.zoom;

  for (const body of state.bodies) {
    if (!body.orbit) continue;
    const center = state.bodies.find((candidate) => candidate.id === body.orbit?.centerBodyId);
    if (!center) continue;

    ctx.beginPath();
    ctx.arc(center.x, center.y, body.orbit.distance, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMapBody(ctx: CanvasRenderingContext2D, body: Body): void {
  ctx.save();
  ctx.fillStyle = body.orbit ? "rgba(255, 255, 255, 0.64)" : "#f2f2f2";
  ctx.strokeStyle = body.orbit ? "rgba(255, 255, 255, 0.74)" : "rgba(255, 255, 255, 0.88)";
  ctx.lineWidth = 1 / Math.max(0.001, ctx.getTransform().a);
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMissionMarkers(ctx: CanvasRenderingContext2D, state: SimulationState): void {
  const pickup = state.bodies.find((body) => body.id === state.mission.pickupBodyId);
  const delivery = state.bodies.find((body) => body.id === state.mission.deliveryBodyId);
  const targetId = getMissionTargetId(state.mission);

  if (pickup) {
    drawMissionMarker(ctx, state, pickup, "PICKUP", pickup.id === targetId, [10, 7]);
  }

  if (delivery) {
    drawMissionMarker(ctx, state, delivery, "DROP", delivery.id === targetId, []);
  }
}

function drawMissionMarker(
  ctx: CanvasRenderingContext2D,
  state: SimulationState,
  body: Body,
  label: string,
  isTarget: boolean,
  dash: number[],
): void {
  const zoom = state.camera.zoom;
  const ringPadding = (isTarget ? 28 : 18) / zoom;
  const labelOffset = body.radius + ringPadding + 18 / zoom;

  ctx.save();
  ctx.strokeStyle = isTarget ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.48)";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = (isTarget ? 2 : 1.2) / zoom;
  ctx.setLineDash(dash.map((value) => value / zoom));
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius + ringPadding, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `${12 / zoom}px monospace`;
  ctx.fillText(label, body.x + labelOffset, body.y);
  ctx.restore();
}

function drawStarfield(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
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
  zoom: number,
): void {
  const glowRadius = Math.min(radius * 1.45, MAX_SCREEN_GLOW_RADIUS / zoom);
  const glow = ctx.createRadialGradient(x, y, radius * 0.25, x, y, glowRadius);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(0.32, palette.glow);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.34, radius * 0.08, x, y, radius * 1.06);
  body.addColorStop(0, palette.core);
  body.addColorStop(0.36, palette.mid);
  body.addColorStop(0.78, palette.mid);
  body.addColorStop(1, palette.edge);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = Math.min(radius * 0.28, 80 / zoom);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSimpleBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  palette: BodyPalette,
): void {
  ctx.save();
  ctx.fillStyle = palette.mid;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = Math.max(1, radius * 0.002);
  ctx.stroke();
  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: SimulationState): void {
  ctx.save();
  ctx.fillStyle = PROJECTILE_COLOR;
  ctx.shadowColor = "rgba(255, 255, 255, 0.36)";
  ctx.shadowBlur = 8 / state.camera.zoom;

  for (const projectile of state.projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTrajectory(ctx: CanvasRenderingContext2D, state: SimulationState): void {
  const prediction = getCachedTrajectory(state);
  const visiblePoints = trimTrajectoryStart(
    state.ship.x,
    state.ship.y,
    prediction.points,
    state.ship.radius * 2.4,
  );
  if (visiblePoints.length < 2) return;

  ctx.save();
  ctx.strokeStyle = TRAJECTORY_COLOR;
  ctx.lineWidth = 1.4 / state.camera.zoom;
  ctx.setLineDash([7 / state.camera.zoom, 9 / state.camera.zoom]);
  ctx.beginPath();
  ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);

  for (let i = 1; i < visiblePoints.length; i++) {
    ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawClosestApproach(ctx: CanvasRenderingContext2D, state: SimulationState): void {
  const prediction = getCachedTrajectory(state);
  const closest = prediction.closestApproach;
  if (!closest) return;

  ctx.save();
  ctx.strokeStyle = CLOSEST_APPROACH_COLOR;
  ctx.fillStyle = CLOSEST_APPROACH_COLOR;
  ctx.lineWidth = 1.2 / state.camera.zoom;
  ctx.setLineDash([4 / state.camera.zoom, 6 / state.camera.zoom]);
  ctx.beginPath();
  ctx.moveTo(closest.trajectoryX, closest.trajectoryY);
  ctx.lineTo(closest.targetX, closest.targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(closest.trajectoryX, closest.trajectoryY, 7 / state.camera.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(closest.targetX, closest.targetY, 5 / state.camera.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${12 / state.camera.zoom}px monospace`;
  ctx.fillText(`${Math.round(closest.distance)}`, closest.trajectoryX + 12 / state.camera.zoom, closest.trajectoryY);
  ctx.restore();
}

function getCachedTrajectory(state: SimulationState): TrajectoryPrediction {
  const now = performance.now();
  const signature = createTrajectorySignature(state);

  if (
    state.trajectoryCache.signature === signature &&
    now - state.trajectoryCache.elapsed < TRAJECTORY_CACHE_INTERVAL * 1000
  ) {
    return {
      points: state.trajectoryCache.points,
      closestApproach: state.trajectoryCache.closestApproach,
    };
  }

  const prediction = calculateProjectileTrajectory(state);
  state.trajectoryCache.points = prediction.points;
  state.trajectoryCache.closestApproach = prediction.closestApproach;
  state.trajectoryCache.elapsed = now;
  state.trajectoryCache.signature = signature;
  return prediction;
}

function createTrajectorySignature(state: SimulationState): string {
  const ship = state.ship;
  const bodySignature = state.bodies
    .map((body) => `${body.id}:${Math.round(body.x / 100)}:${Math.round(body.y / 100)}:${Math.round(body.radius)}`)
    .join(",");

  return [
    Math.round(ship.x / 40),
    Math.round(ship.y / 40),
    Math.round(ship.vx / 4),
    Math.round(ship.vy / 4),
    getMissionTargetId(state.mission),
    bodySignature,
  ].join("|");
}

function trimTrajectoryStart(
  originX: number,
  originY: number,
  points: { x: number; y: number }[],
  distance: number,
): { x: number; y: number }[] {
  const minDistanceSq = distance * distance;
  const firstVisibleIndex = points.findIndex((point) => {
    const dx = point.x - originX;
    const dy = point.y - originY;
    return dx * dx + dy * dy >= minDistanceSq;
  });

  return firstVisibleIndex === -1 ? [] : points.slice(firstVisibleIndex);
}

function calculateProjectileTrajectory(state: SimulationState): TrajectoryPrediction {
  const points: { x: number; y: number }[] = [];
  const bodies = clonePredictedBodies(state.bodies);
  const targetId = getMissionTargetId(state.mission);
  let closestApproach: ClosestApproach | null = null;
  let x = state.ship.x;
  let y = state.ship.y;
  let vx = state.ship.vx;
  let vy = state.ship.vy;

  for (let i = 0; i < TRAJECTORY_STEPS; i++) {
    const acceleration = calculateGravityAcceleration(x, y, bodies);

    x += vx * TRAJECTORY_STEP_TIME + 0.5 * acceleration.ax * TRAJECTORY_STEP_TIME * TRAJECTORY_STEP_TIME;
    y += vy * TRAJECTORY_STEP_TIME + 0.5 * acceleration.ay * TRAJECTORY_STEP_TIME * TRAJECTORY_STEP_TIME;

    advancePredictedBodies(bodies, TRAJECTORY_STEP_TIME);

    const nextAcceleration = calculateGravityAcceleration(x, y, bodies);
    vx += 0.5 * (acceleration.ax + nextAcceleration.ax) * TRAJECTORY_STEP_TIME;
    vy += 0.5 * (acceleration.ay + nextAcceleration.ay) * TRAJECTORY_STEP_TIME;

    const target = bodies.find((body) => body.id === targetId);
    if (target && i % TRAJECTORY_SAMPLE_INTERVAL === 0) {
      const distance = Math.max(0, getDistance(x, y, target.x, target.y) - target.radius - state.ship.radius);
      if (!closestApproach || distance < closestApproach.distance) {
        closestApproach = {
          trajectoryX: x,
          trajectoryY: y,
          targetX: target.x,
          targetY: target.y,
          distance,
        };
      }
    }

    if (i % TRAJECTORY_SAMPLE_INTERVAL === 0) {
      points.push({ x, y });
    }

    if (bodies.some((body) => getDistance(x, y, body.x, body.y) < body.radius + state.ship.radius)) {
      break;
    }
  }

  return { points, closestApproach };
}

function clonePredictedBodies(bodies: Body[]): Body[] {
  return bodies.map((body) => ({
    ...body,
    orbit: body.orbit ? { ...body.orbit } : undefined,
  }));
}

function advancePredictedBodies(bodies: Body[], deltaTime: number): void {
  for (const body of bodies) {
    if (!body.orbit) continue;

    const center = bodies.find((candidate) => candidate.id === body.orbit?.centerBodyId);
    if (!center) continue;

    body.orbit.angle += body.orbit.angularVelocity * deltaTime;
    body.x = center.x + Math.cos(body.orbit.angle) * body.orbit.distance;
    body.y = center.y + Math.sin(body.orbit.angle) * body.orbit.distance;
    body.vx = -Math.sin(body.orbit.angle) * body.orbit.distance * body.orbit.angularVelocity;
    body.vy = Math.cos(body.orbit.angle) * body.orbit.distance * body.orbit.angularVelocity;
  }
}

function calculateGravityAcceleration(
  x: number,
  y: number,
  bodies: Body[],
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;

  for (const body of bodies) {
    const dx = body.x - x;
    const dy = body.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distWithSoftening = Math.max(dist, SOFTENING_DISTANCE);
    const acceleration = (GRAVITATIONAL_CONSTANT * body.mass * SHIP_GRAVITY_SCALE) / (distWithSoftening * distWithSoftening);
    const angle = Math.atan2(dy, dx);

    ax += Math.cos(angle) * acceleration;
    ay += Math.sin(angle) * acceleration;
  }

  return { ax, ay };
}

function drawShip(ctx: CanvasRenderingContext2D, state: SimulationState): void {
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
    ctx.shadowBlur = 10 / state.camera.zoom;
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
  ctx.lineWidth = 2 / state.camera.zoom;
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

function drawMapShipMarker(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: SimulationState,
): void {
  const screen = worldToScreen(state.ship.x, state.ship.y, state.camera, canvas.width, canvas.height);
  const size = 9;
  const cos = Math.cos(state.ship.angle);
  const sin = Math.sin(state.ship.angle);
  const point = (forward: number, side: number) => ({
    x: screen.x + cos * forward - sin * side,
    y: screen.y + sin * forward + cos * side,
  });

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.strokeStyle = SHIP_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, size * 1.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SHIP_COLOR;
  ctx.beginPath();
  ctx.moveTo(point(size * 1.35, 0).x, point(size * 1.35, 0).y);
  ctx.lineTo(point(-size * 0.6, size * 0.75).x, point(-size * 0.6, size * 0.75).y);
  ctx.lineTo(point(-size * 0.2, 0).x, point(-size * 0.2, 0).y);
  ctx.lineTo(point(-size * 0.6, -size * 0.75).x, point(-size * 0.6, -size * 0.75).y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: SimulationState,
): void {
  ctx.save();
  ctx.font = OVERLAY_FONT;
  ctx.fillStyle = OVERLAY_TEXT_COLOR;
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 8;

  const padding = 10;
  let y = padding + 14;

  ctx.fillText(`Bodies: ${state.bodies.length}`, padding, y);
  y += 20;
  ctx.fillText(`Status: ${state.isPaused ? "PAUSED" : "RUNNING"} | FPS: ${Math.round(state.fps)}`, padding, y);
  y += 20;
  ctx.fillText(`Time: ${state.timeScale.toFixed(3).replace(/\.?0+$/, "")}x | Zoom: ${state.camera.zoom.toFixed(3)}x`, padding, y);
  y += 20;
  ctx.fillText(`Mission: ${state.mission.hasCargo ? "Deliver" : "Pickup"} Moon ${getMissionTargetId(state.mission)} | Done: ${state.mission.completedDeliveries}`, padding, y);
  y += 20;
  ctx.fillText(state.mission.message, padding, y);

  const relativeSpeed = getNearbyRelativeSpeed(state);
  if (relativeSpeed !== null) {
    y += 20;
    const landingText = relativeSpeed <= SAFE_LANDING_RELATIVE_SPEED ? "safe" : "rough";
    ctx.fillText(`Relative speed: ${relativeSpeed.toFixed(1)} / ${SAFE_LANDING_RELATIVE_SPEED} (${landingText})`, padding, y);
  } else if (state.lastLanding && state.lastLanding.elapsed < 4) {
    y += 20;
    ctx.fillText(
      `${state.lastLanding.safe ? "Gentle" : "Rough"} landing on Moon ${state.lastLanding.bodyId}: ${state.lastLanding.relativeSpeed.toFixed(1)}`,
      padding,
      y,
    );
  }

  y += 20;
  ctx.font = "12px monospace";
  ctx.fillText(
    "Click & drag spawn | Shift+Click orbit | A/D steer | Space burn | F shoot | [/]: zoom | ,/.: time | R reset",
    padding,
    y,
  );

  ctx.shadowBlur = 0;
  drawFuelBar(ctx, canvas, state.ship.fuel / SHIP_MAX_FUEL);
  ctx.restore();
}

function getNearbyRelativeSpeed(state: SimulationState): number | null {
  let bestSurfaceDistance = Infinity;
  let relativeSpeed: number | null = null;

  for (const body of state.bodies) {
    if (!body.orbit && state.ship.landedOnBodyId !== body.id) continue;

    const distance = getDistance(state.ship.x, state.ship.y, body.x, body.y);
    const surfaceDistance = distance - body.radius - state.ship.radius;
    if (surfaceDistance > NEAR_BODY_DISTANCE || surfaceDistance > bestSurfaceDistance) continue;

    const rvx = state.ship.vx - body.vx;
    const rvy = state.ship.vy - body.vy;
    bestSurfaceDistance = surfaceDistance;
    relativeSpeed = Math.sqrt(rvx * rvx + rvy * rvy);
  }

  return relativeSpeed;
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

function getDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
