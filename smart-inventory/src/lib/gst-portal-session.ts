import type { Browser, Page } from "playwright";

export type FilingStep =
  | "init"
  | "awaiting_captcha"
  | "awaiting_login_otp"
  | "logged_in"
  | "uploading"
  | "awaiting_evc"
  | "filed"
  | "error";

export interface GSTPortalSession {
  browser: Browser;
  page: Page;
  createdAt: number;
  step: FilingStep;
  error?: string;
  arn?: string;
}

// Module-level singleton — survives across API calls on the same Node.js process (EC2)
const sessions = new Map<string, GSTPortalSession>();

// Auto-cleanup sessions older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > 30 * 60 * 1000) {
      s.browser.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

export function getSession(id: string): GSTPortalSession | undefined {
  return sessions.get(id);
}

export function updateSession(
  id: string,
  patch: Partial<Pick<GSTPortalSession, "step" | "arn" | "error">>
): void {
  const s = sessions.get(id);
  if (s) Object.assign(s, patch);
}

export function deleteSession(id: string): void {
  const s = sessions.get(id);
  if (s) {
    s.browser.close().catch(() => {});
    sessions.delete(id);
  }
}

export async function createSession(): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-IN,en;q=0.9",
  });

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    browser,
    page,
    createdAt: Date.now(),
    step: "init",
  });
  return sessionId;
}

/** Take a screenshot of a specific element and return as data URL */
export async function screenshotElement(
  page: Page,
  selector: string
): Promise<string> {
  const el = page.locator(selector).first();
  const buf = await el.screenshot();
  return `data:image/png;base64,${buf.toString("base64")}`;
}
