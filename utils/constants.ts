export const COMPRESSION = {
  MAX_WIDTH: 3840,           // 2x cap for 1920px viewport (per D-08)
  MAX_SIZE_KB: 500,          // per CAPT-05
  START_QUALITY: 0.82,       // WebP starting quality
  MIN_QUALITY: 0.40,         // Minimum acceptable quality
  QUALITY_STEP: 0.05,        // Quality reduction per iteration
} as const;

export const ANIMATION = {
  FLASH_DURATION_MS: 300,
  PREVIEW_DELAY_MS: 200,
  PREVIEW_HOLD_MS: 2000,
  PREVIEW_EXIT_MS: 300,
  TOTAL_DURATION_MS: 3500,
  PREVIEW_WIDTH_PX: 280,
} as const;

export const DB = {
  NAME: 'screenshotr',
  VERSION: 1,
  CAPTURES_STORE: 'captures',
} as const;
