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
export const SOI_LOCK_DISTANCE_MULTIPLIER = 18;
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
export const TRAJECTORY_STEP_TIME = MAX_DELTA_TIME;
export const TRAJECTORY_STEPS = 60000;
export const TRAJECTORY_FALLBACK_STEPS = 6000;
export const TRAJECTORY_SAMPLE_INTERVAL = 5;
export const TRAJECTORY_CLOSED_ORBIT_MIN_STEPS = 1800;
export const TRAJECTORY_CLOSED_ORBIT_POSITION_TOLERANCE = 180;
export const TRAJECTORY_CLOSED_ORBIT_VELOCITY_TOLERANCE = 6;
export const CONIC_ELLIPSE_SAMPLES = 900;
export const CONIC_HYPERBOLA_SAMPLES = 900;
export const CONIC_MAX_HYPERBOLA_SWEEP = Math.PI * 1.65;
export const TRAJECTORY_CACHE_INTERVAL = 0.08;
export const TRAJECTORY_COLOR = "rgba(145, 194, 205, 0.54)";
export const CLOSEST_APPROACH_COLOR = "rgba(214, 185, 126, 0.82)";
export const APSIS_MARKER_COLOR = "rgba(191, 217, 166, 0.88)";

// Render performance constants
export const MAX_SCREEN_GLOW_RADIUS = 220;
export const DETAILED_BODY_MAX_SCREEN_RADIUS = 850;
export const BODY_CULL_PADDING = 260;

// Visual constants
export const CANVAS_BACKGROUND = "#071016";
export const BODY_COLOR = "#6f8f9a";
export const BODY_CORE_COLOR = "#b9c7c6";
export const BODY_GLOW_COLOR = "rgba(116, 158, 170, 0.1)";
export const BODY_EDGE_COLOR = "rgba(18, 32, 42, 0.18)";
export const PREVIEW_BODY_COLOR = "#b8aa83";
export const PREVIEW_BODY_CORE_COLOR = "#e8dcc0";
export const PREVIEW_BODY_GLOW_COLOR = "rgba(216, 188, 123, 0.16)";
export const PREVIEW_BODY_EDGE_COLOR = "rgba(82, 69, 48, 0.12)";
export const SHIP_COLOR = "#f1e8cf";
export const SHIP_BURN_COLOR = "rgba(225, 151, 94, 0.78)";
export const PROJECTILE_COLOR = "#e6c67a";
export const STAR_COLOR = "rgba(210, 222, 218, 0.55)";
export const ORBIT_GUIDE_COLOR = "#9fb7b4";
export const OVERLAY_TEXT_COLOR = "#dfe8df";
export const OVERLAY_FONT = "14px monospace";
