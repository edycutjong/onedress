import { YouCamError } from './client';

/**
 * Error taxonomy → what the person holding the phone should actually DO.
 *
 * design.md's States table requires the upload-failed card to map the REAL API
 * error to re-shoot guidance ("face the camera", "more light") rather than showing
 * a raw code. Codes come from _docs/SDK_CAPABILITIES.md §1.3/§1.4/§2.1 plus the
 * transport-level codes YouCamClient raises itself.
 */

export type Recovery =
  /** the user must supply a different photo — retrying the same bytes cannot help */
  | 'reshoot'
  /** transient; the same input will probably work on a retry */
  | 'retry'
  /** a configuration/setup problem — retrying will not help the user */
  | 'config'
  /** we could not classify it */
  | 'unknown';

export interface UserFacingError {
  code: string;
  /** short label for the card */
  title: string;
  /** one actionable sentence, addressed to the user */
  guidance: string;
  recovery: Recovery;
}

const MESSAGES: Record<string, Omit<UserFacingError, 'code'>> = {
  // ---- face capture (analyzers) ----
  error_face_angle_invalid: {
    title: 'Face the camera',
    guidance: 'Look straight at the lens — a tilt of more than about 10° is too much.',
    recovery: 'reshoot',
  },
  error_face_angle_upward: {
    title: 'Chin down',
    guidance: 'The camera is below the face. Hold the phone at eye level and shoot again.',
    recovery: 'reshoot',
  },
  error_face_not_forward_facing: {
    title: 'Face the camera',
    guidance: 'Turn to face the lens straight on, both ears roughly level.',
    recovery: 'reshoot',
  },
  error_face_position_invalid: {
    title: 'Center the face',
    guidance: 'Move so the face sits in the middle of the frame, fully inside the edges.',
    recovery: 'reshoot',
  },
  error_src_face_too_small: {
    title: 'Move closer',
    guidance: 'The face needs to fill most of the frame — step in or crop tighter.',
    recovery: 'reshoot',
  },
  error_lighting_dark: {
    title: 'More light',
    guidance: 'Shoot facing a window or a lamp — shadow on the skin skews the measurement.',
    recovery: 'reshoot',
  },
  error_insufficient_lighting: {
    title: 'More light',
    guidance: 'Too dark to measure skin tone accurately. Find brighter, even lighting.',
    recovery: 'reshoot',
  },
  error_below_min_image_size: {
    title: 'Photo too small',
    guidance: 'Use the original photo, not a screenshot or thumbnail (short side ≥320 px).',
    recovery: 'reshoot',
  },
  exceed_max_filesize: {
    title: 'Photo too large',
    guidance: 'Keep it under 10 MB — export at a smaller size and try again.',
    recovery: 'reshoot',
  },

  // ---- full-length capture (cloth-v3) ----
  error_pose: {
    title: 'Stand up straight',
    guidance: 'Standing, front-facing, arms clear of the body — no sitting or crouching.',
    recovery: 'reshoot',
  },
  error_invalid_src: {
    title: 'Full-length photo needed',
    guidance: 'Show the whole body head-to-toe, filling at least 80% of the frame.',
    recovery: 'reshoot',
  },
  error_apply_region_mismatch: {
    title: 'Body not fully visible',
    guidance: 'The dress needs a clear head-to-toe view — nothing cropped or blocked.',
    recovery: 'reshoot',
  },
  error_invalid_ref: {
    title: 'Reference dress unusable',
    guidance: 'That colorway’s reference photo was rejected. Pick another colorway.',
    recovery: 'config',
  },
  error_editing_failed: {
    title: 'Render came back unchanged',
    guidance: 'The try-on looked identical to the original. Try a different full-length photo.',
    recovery: 'reshoot',
  },
  error_nsfw_content_detected: {
    title: 'Photo rejected',
    guidance: 'The content filter blocked this image. Use a different photo.',
    recovery: 'reshoot',
  },

  // ---- transport / setup (raised by YouCamClient) ----
  poll_timeout: {
    title: 'Took too long',
    guidance: 'The render is still queued upstream. Retry this bridesmaid.',
    recovery: 'retry',
  },
  network: {
    title: 'Connection dropped',
    guidance: 'Check the connection and retry — nothing was charged.',
    recovery: 'retry',
  },
  http_429: {
    title: 'Rate limited',
    guidance: 'Too many requests at once. Wait a moment and retry.',
    recovery: 'retry',
  },
  http_401: {
    title: 'API key rejected',
    guidance: 'The YouCam API key is missing or invalid on the server.',
    recovery: 'config',
  },
  http_403: {
    title: 'Out of API units',
    guidance: 'The grant balance is exhausted. The cached demo party still works.',
    recovery: 'config',
  },
  missing_ref_asset: {
    title: 'Reference asset missing',
    guidance: 'No reference image is installed for that colorway or earring.',
    recovery: 'config',
  },
  unexpected_shape: {
    title: 'Unexpected API response',
    guidance: 'The API returned a shape we do not recognise. Retry once, then report it.',
    recovery: 'retry',
  },
};

/** Prefix rules for the documented wildcard families (`error_face_position_*` etc.). */
const PREFIXES: Array<[string, keyof typeof MESSAGES]> = [
  ['error_face_position_', 'error_face_position_invalid'],
  ['error_face_angle_', 'error_face_angle_invalid'],
  ['error_lighting_', 'error_lighting_dark'],
];

/** Map any thrown value to something a card can render. Never throws. */
export function toUserFacingError(err: unknown): UserFacingError {
  const code = err instanceof YouCamError ? err.code : 'unknown';

  const exact = MESSAGES[code];
  if (exact) return { code, ...exact };

  for (const [prefix, target] of PREFIXES) {
    if (code.startsWith(prefix)) return { code, ...MESSAGES[target] };
  }

  // Any other 5xx is transient by definition; any other 4xx is ours to fix.
  if (/^http_5\d\d$/.test(code)) {
    return {
      code,
      title: 'Service hiccup',
      guidance: 'The API had a server error. Retry — nothing was charged.',
      recovery: 'retry',
    };
  }
  if (/^http_4\d\d$/.test(code)) {
    return {
      code,
      title: 'Request rejected',
      guidance: 'The API rejected this request. Check the photo meets the capture guidance.',
      recovery: 'reshoot',
    };
  }

  return {
    code,
    title: 'Something went wrong',
    guidance: err instanceof Error ? err.message : 'Unknown error. Retry once.',
    recovery: 'unknown',
  };
}

/** True when retrying the identical request could plausibly succeed. */
export function isRetryable(err: unknown): boolean {
  return toUserFacingError(err).recovery === 'retry';
}
