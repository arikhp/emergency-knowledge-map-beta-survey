const ENDPOINT = import.meta.env.VITE_SHEET_ENDPOINT as string | undefined;

export interface SubmitResult {
  ok: boolean;
  skipped?: boolean;
}

export interface PdfAttachment {
  base64: string;
  filename: string;
}

// Google Apps Script web apps don't return CORS headers for simple deployments,
// so we POST with mode: 'no-cors' (the standard workaround) and treat "fetch
// didn't throw" as success, since the response body is opaque either way.
// The row write (and the Drive PDF save, if a pdf is included) happen
// synchronously on the server before it issues its response redirect, so
// this succeeds even though the client never gets to read that response.
export async function submitResponse(
  flat: Record<string, string>,
  pdf?: PdfAttachment,
): Promise<SubmitResult> {
  if (!ENDPOINT) {
    return { ok: false, skipped: true };
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(flat)) {
    body.append(key, value ?? '');
  }
  if (pdf) {
    body.append('pdfBase64', pdf.base64);
    body.append('pdfFilename', pdf.filename);
  }

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      body,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
