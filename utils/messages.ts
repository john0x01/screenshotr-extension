export type BackgroundMessage =
  | { type: 'SHOW_CAPTURE_ANIMATION'; thumbnail: string }
  | { type: 'CAPTURE_COMPLETE'; captureId: string };

export type ContentMessage =
  | { type: 'ANIMATION_DONE' };

export type OffscreenMessage =
  | { type: 'COMPRESS_IMAGE_OFFSCREEN'; dataUrl: string; maxWidth: number; maxSizeKB: number; quality: number };

export type OffscreenResponse =
  | { buffer: number[]; size: number };

export type PopupMessage =
  | { type: 'SIGN_IN'; provider: 'google' | 'github' }
  | { type: 'SIGN_OUT' };
