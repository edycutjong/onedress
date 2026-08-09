import { errorResponse, getClient, notConfigured } from '@/lib/api/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload — multipart form with one `file`, returns its YouCam `file_id`.
 *
 * The browser never touches the File API directly: it would need the API key to
 * initialise an upload. So the bytes come here, the server does init + presigned
 * PUT, and the browser gets back an opaque file_id it can pass to /api/party.
 *
 * Limits mirror the documented input contract (SDK_CAPABILITIES.md §1.x/§2.1) so a
 * bad photo is rejected here, for free, instead of costing units at task time.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — the documented ceiling
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const client = getClient();
  if (!client) return notConfigured();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      {
        error: {
          code: 'bad_request',
          title: 'Malformed upload',
          guidance: 'Send the photo as multipart/form-data under the field name "file".',
          recovery: 'config' as const,
        },
      },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json(
      {
        error: {
          code: 'no_file',
          title: 'No photo received',
          guidance: 'Pick a photo and try again.',
          recovery: 'reshoot' as const,
        },
      },
      { status: 400 },
    );
  }

  if (!ALLOWED.has(file.type)) {
    return Response.json(
      {
        error: {
          code: 'unsupported_type',
          title: 'Unsupported format',
          guidance: `${file.type || 'That file'} will not work — use a JPG, PNG or WebP photo.`,
          recovery: 'reshoot' as const,
        },
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      {
        error: {
          code: 'exceed_max_filesize',
          title: 'Photo too large',
          guidance: 'Keep it under 10 MB — export at a smaller size and try again.',
          recovery: 'reshoot' as const,
        },
      },
      { status: 413 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileId = await client.uploadFile(bytes, file.type, file.name || 'upload.jpg');
    return Response.json({ fileId, bytes: bytes.length });
  } catch (err) {
    return errorResponse(err);
  }
}
