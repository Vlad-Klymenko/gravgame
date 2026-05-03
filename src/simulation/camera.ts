import type { Camera, Ship } from "./types";
import {
  CAMERA_INITIAL_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_SMOOTHING,
} from "./constants";

export function createCamera(x: number, y: number): Camera {
  return {
    x,
    y,
    zoom: CAMERA_INITIAL_ZOOM,
    manualZoom: CAMERA_INITIAL_ZOOM,
  };
}

export function updateCamera(
  camera: Camera,
  ship: Ship,
  deltaTime: number,
): void {
  const smoothing = 1 - Math.exp(-CAMERA_SMOOTHING * deltaTime);

  camera.x += (ship.x - camera.x) * smoothing;
  camera.y += (ship.y - camera.y) * smoothing;
  camera.zoom += (camera.manualZoom - camera.zoom) * smoothing;
}

export function zoomCamera(camera: Camera, factor: number): void {
  camera.manualZoom = Math.max(
    CAMERA_MIN_ZOOM,
    Math.min(CAMERA_MAX_ZOOM, camera.manualZoom * factor),
  );
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (screenX - canvasWidth / 2) / camera.zoom + camera.x,
    y: (screenY - canvasHeight / 2) / camera.zoom + camera.y,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (worldX - camera.x) * camera.zoom + canvasWidth / 2,
    y: (worldY - camera.y) * camera.zoom + canvasHeight / 2,
  };
}

export function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvas: HTMLCanvasElement,
): void {
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}
