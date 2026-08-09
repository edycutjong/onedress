import { z } from 'zod';

/**
 * Zod schemas mirroring the YouCam (Perfect Corp) response shapes we depend on.
 * Grounded in _docs/SDK_CAPABILITIES.md (docs v1.14). We validate the fields the
 * app actually reads and `.passthrough()` the rest, so an added upstream field
 * never breaks a task — but a *missing* field we rely on fails loudly (Zod), not
 * as a silent `undefined` deep in the pipeline.
 */

export type Feature =
  | 'skin-tone-analysis'
  | 'fitzpatrick-scale-analyzer'
  | 'face-attr-analysis'
  | 'cloth-v3'
  | '2d-vto/earring';

// ---- Credit balance: GET /s2s/v1.0/client/credit ----
export const CreditResponse = z.object({
  status: z.number().optional(),
  results: z.array(
    z
      .object({
        type: z.string().optional(), // ApiSubsToken | ApiPaygToken
        amount: z.number().optional(),
        amount_dec: z.number(),
        expiry: z.number().optional(),
      })
      .passthrough(),
  ),
});
export type CreditResponse = z.infer<typeof CreditResponse>;

// ---- File API: POST /s2s/v2.0/file ----
// Verified live 2026-08-04: envelope is { status, data: { files: [...] } }.
export const FileInitResponse = z
  .object({
    status: z.number().optional(),
    data: z
      .object({
        files: z.array(
          z
            .object({
              file_id: z.string(),
              requests: z
                .array(
                  z
                    .object({
                      url: z.string().url(),
                      headers: z.record(z.string()).optional(),
                      method: z.string().optional(),
                    })
                    .passthrough(),
                )
                .optional(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();
export type FileInitResponse = z.infer<typeof FileInitResponse>;

// ---- Task creation: POST /s2s/v2.0/task/<feature> → { status, data: { task_id } } ----
export const TaskCreateResponse = z
  .object({
    status: z.number().optional(),
    data: z.object({ task_id: z.string() }).passthrough(),
  })
  .passthrough();
export type TaskCreateResponse = z.infer<typeof TaskCreateResponse>;

// ---- Task poll: GET /s2s/v2.0/task/<feature>/{task_id} ----
// { status, data: { task_status, error?, error_message?, results?|url? } }.
// The per-feature result payload lives under data; we keep it passthrough and
// extract at the call site.
export const TaskStatus = z.enum(['running', 'success', 'error']);

export const TaskPollResponse = z
  .object({
    status: z.number().optional(),
    data: z
      .object({
        task_status: TaskStatus.optional(),
        // API returns `error: null` while running — allow null, not just absent.
        error: z.string().nullish(),
        error_message: z.string().nullish(),
      })
      .passthrough(),
  })
  .passthrough();
export type TaskPollResponse = z.infer<typeof TaskPollResponse>;
