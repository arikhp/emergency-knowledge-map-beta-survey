import type { APIRequestContext } from '@playwright/test';

// Client for the verification endpoint (doGet) in google-apps-script/Code.gs.
// It only works on the TEST deployment (the one with the VERIFY_TOKEN script
// property) and only for LIVE-SMOKE-* / LOADTEST-* rows.

export interface PdfInfo {
  found: boolean;
  name?: string;
  size?: number;
  mimeType?: string;
  startsWithPdfHeader?: boolean;
  folder?: string;
  error?: string;
}

export interface FindResult {
  ok: boolean;
  error?: string;
  rows: number;
  rowsWithPdfLink: number;
  pdfErrors: number;
  driveFiles: number;
  matches?: { values: Record<string, string>; pdf: PdfInfo }[];
}

export function testBackend(request: APIRequestContext, endpoint: string, token: string) {
  async function call<T>(action: string, prefix: string): Promise<T> {
    // Apps Script answers with a redirect to script.googleusercontent.com; request follows it.
    // Now and then that redirect returns a Google HTML error page instead of JSON; retry those.
    for (let attempt = 1; ; attempt++) {
      const res = await request.get(endpoint, { params: { token, action, prefix }, timeout: 60_000 });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        if (attempt >= 4) throw new Error(`Test backend gave no JSON for "${action}" (status ${res.status()})`);
        await new Promise((r) => setTimeout(r, 3_000 * attempt));
        continue;
      }
      if (!body.ok) throw new Error(`Test backend refused "${action}": ${body.error}`);
      return body as T;
    }
  }
  return {
    find: (prefix: string) => call<FindResult>('find', prefix),
    cleanup: (prefix: string) => call<{ deletedRows: number; trashedPdfs: number }>('cleanup', prefix),
  };
}
