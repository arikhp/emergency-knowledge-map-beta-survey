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
    const res = await request.get(endpoint, { params: { token, action, prefix }, timeout: 60_000 });
    const body = await res.json();
    if (!body.ok) throw new Error(`Test backend refused "${action}": ${body.error}`);
    return body as T;
  }
  return {
    find: (prefix: string) => call<FindResult>('find', prefix),
    cleanup: (prefix: string) => call<{ deletedRows: number; trashedPdfs: number }>('cleanup', prefix),
  };
}
