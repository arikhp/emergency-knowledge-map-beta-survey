import { test as base, expect, type Request } from '@playwright/test';

export interface MockBackend {
  requests: Request[];
  /** Parsed form fields of the most recent submission. */
  lastBody(): URLSearchParams;
}

interface Options {
  backendMode: 'ok' | 'fail';
}

// Every test gets a mocked Sheet backend. The test build posts to the fake
// https://sheet.test endpoint (see playwright.config.ts), which is fulfilled
// here. As a safety net, any request to a real Apps Script URL is aborted and
// fails the test, so a misconfigured build can never write to the real Sheet.
export const test = base.extend<Options & { backend: MockBackend }>({
  backendMode: ['ok', { option: true }],

  // auto: installed for every test, before any navigation, even if unused.
  backend: [async ({ page, backendMode }, use) => {
    const requests: Request[] = [];

    // @live runs deliberately post to the real test backend: no mocking.
    if (process.env.LIVE) {
      await use({ requests, lastBody: () => { throw new Error('No mock backend in LIVE mode'); } });
      return;
    }
    const leaked: string[] = [];

    await page.route('https://script.google.com/**', async (route) => {
      leaked.push(route.request().url());
      await route.abort();
    });

    await page.route('https://sheet.test/**', async (route) => {
      requests.push(route.request());
      if (backendMode === 'fail') {
        await route.abort('failed');
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
    });

    await use({
      requests,
      lastBody() {
        const req = requests.at(-1);
        if (!req) throw new Error('No submission was sent');
        return new URLSearchParams(req.postData() ?? '');
      },
    });

    expect(leaked, 'requests to the real Apps Script backend').toEqual([]);
  }, { auto: true }],
});

export { expect };
