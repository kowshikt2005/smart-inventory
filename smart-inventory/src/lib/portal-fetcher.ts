/**
 * Shared SWR fetcher for portal pages.
 *
 * Redirects to /portal/login on 401/403 so every page handles token expiry
 * consistently, rather than showing cryptic error states.
 */
export async function portalFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      window.location.href = "/portal/login";
    }
    // Return a never-resolving promise so SWR stays in loading state
    // while the redirect happens, rather than showing an error.
    return new Promise(() => {});
  }
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  return res.json() as Promise<T>;
}
