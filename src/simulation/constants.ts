// Physics constants
export const GRAVITATIONAL_CONSTANT = 6500;
export const SOFTENING_DISTANCE = 25;
export const MAX_DELTA_TIME = 0.016; // ~60 FPS cap
export const BODY_TIME_SCALE = 0.02;

// Body spawning constants
export const MIN_BODY_RADIUS = 140;
export const MAX_BODY_RADIUS = 4500;
export const PREVIEW_GROWTH_RATE = 1800; // world units per second
export const DENSITY = 0.004; // mass per world-unit area
export const EDGE_BOUNCE_DAMPING = 0.94;

// Ship constants
export const SHIP_RADIUS = 24;
export const SHIP_MASS = 1;
export const SHIP_THRUST_ACCELERATION = 165;
export const SHIP_TAKEOFF_EXTRA_SPEED = 95;
export const SHIP_TAKEOFF_GRACE_TIME = 2;
export const SHIP_TAKEOFF_MIN_THRUST_MULTIPLIER = 0.55;
export const SHIP_TAKEOFF_MAX_THRUST_MULTIPLIER = 1.35;
export const SHIP_ROTATION_SPEED = 3.2;
export const SHIP_GRAVITY_SCALE = 0.075;
export const SHIP_EDGE_BOUNCE_DAMPING = 0.76;
export const LANDED_BODY_MIN_RADIUS_RATIO = 1.25;
export const SHIP_MAX_FUEL = 10;
export const SHIP_FUEL_REGEN_DELAY = 2;
export const SHIP_FUEL_REGEN_RATE = 2.5;
export const SAFE_LANDING_RELATIVE_SPEED = 80;
export const NEAR_BODY_DISTANCE = 5000;

// Projectile constants
export const PROJECTILE_MASS_RATIO = 0.18;
export const PROJECTILE_RADIUS = 5;
export const PROJECTILE_SPEED = 320;
export const PROJECTILE_MAX_AGE = 5;
export const PROJECTILE_GRAVITY_SCALE = 0.65;

// Camera constants
export const CAMERA_INITIAL_ZOOM = 0.12;
export const CAMERA_MIN_ZOOM = 0.0018;
export const CAMERA_MAX_ZOOM = 0.9;
export const CAMERA_NEAR_ALTITUDE = 180;
export const CAMERA_FAR_ALTITUDE = 2800;
export const CAMERA_SMOOTHING = 4.5;
export const CAMERA_ZOOM_STEP = 1.18;
export const MAP_MODE_ZOOM = 0.012;

// Time controls
export const MIN_TIME_SCALE = 0.125;
export const MAX_TIME_SCALE = 8;
export const TIME_SCALE_STEP = 2;

// Trajectory guide constants
export const TRAJECTORY_STEP_TIME = 0.035;
export const TRAJECTORY_STEPS = 1200;
export const TRAJECTORY_SAMPLE_INTERVAL = 5;
export const TRAJECTORY_CACHE_INTERVAL = 0.08;
export const TRAJECTORY_COLOR = "rgba(255, 255, 255, 0.34)";
export const CLOSEST_APPROACH_COLOR = "rgba(255, 255, 255, 0.72)";

// Render performance constants
export const MAX_SCREEN_GLOW_RADIUS = 220;
export const DETAILED_BODY_MAX_SCREEN_RADIUS = 850;
export const BODY_CULL_PADDING = 260;

// Visual constants
export const CANVAS_BACKGROUND = "#020202";
export const BODY_COLOR = "#d8d8d8";
export const BODY_CORE_COLOR = "#f7f7f7";
export const BODY_GLOW_COLOR = "rgba(255, 255, 255, 0.045)";
export const BODY_EDGE_COLOR = "rgba(255, 255, 255, 0)";
export const PREVIEW_BODY_COLOR = "#cfcfcf";
export const PREVIEW_BODY_CORE_COLOR = "#ffffff";
export const PREVIEW_BODY_GLOW_COLOR = "rgba(255, 255, 255, 0.06)";
export const PREVIEW_BODY_EDGE_COLOR = "rgba(255, 255, 255, 0)";
export const SHIP_COLOR = "#ffffff";
export const SHIP_BURN_COLOR = "rgba(255, 255, 255, 0.7)";
export const PROJECTILE_COLOR = "#ffffff";
export const STAR_COLOR = "rgba(255, 255, 255, 0.58)";
export const ORBIT_GUIDE_COLOR = "#bdbdbd";
export const OVERLAY_TEXT_COLOR = "#ffffff";
export const OVERLAY_FONT = "14px monospace";
