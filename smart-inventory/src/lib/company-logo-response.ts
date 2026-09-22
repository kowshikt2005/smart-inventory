import { readFile } from "node:fs/promises";
import path from "node:path";

const COMPANY_LOGO_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function notFoundResponse() {
  return new Response("Company logo not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function createCompanyLogoResponse(
  filename: string | null,
  applicationRoot = process.cwd(),
): Promise<Response> {
  if (!filename || !COMPANY_LOGO_FILENAME_PATTERN.test(filename)) {
    return notFoundResponse();
  }

  const extension = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[extension];
  if (!contentType) return notFoundResponse();

  try {
    const file = await readFile(
      path.join(applicationRoot, "uploads", "company", filename),
    );

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFoundResponse();
  }
}
