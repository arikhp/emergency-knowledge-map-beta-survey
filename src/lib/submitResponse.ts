const ENDPOINT = import.meta.env.VITE_SHEET_ENDPOINT as string | undefined;

export interface SubmitResult {
  ok: boolean;
  skipped?: boolean;
}

// Google Apps Script web apps don't return CORS headers for simple deployments,
// so we POST with mode: 'no-cors' (the standard workaround) and treat "fetch
// didn't throw" as success, since the response body is opaque either way.
export async function submitResponse(flat: Record<string, string>): Promise<SubmitResult> {
  if (!ENDPOINT) {
    return { ok: false, skipped: true };
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(flat)) {
    body.append(key, value ?? '');
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
