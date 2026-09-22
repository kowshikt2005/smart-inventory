import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createCompanyLogoResponse } from "./company-logo-response";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

async function fixture(extension: "png" | "jpg" | "webp") {
  const root = await mkdtemp(path.join(tmpdir(), "company-logo-"));
  const companyDir = path.join(root, "uploads", "company");
  const filename = `${UUID}.${extension}`;
  const bytes = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  await mkdir(companyDir, { recursive: true });
  await writeFile(path.join(companyDir, filename), bytes);
  return { root, filename, bytes };
}

test("serves the selected PNG inline with exact bytes", async () => {
  const { root, filename, bytes } = await fixture("png");
  const response = await createCompanyLogoResponse(filename, root);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test("maps JPEG and WebP files to their image MIME types", async () => {
  const jpeg = await fixture("jpg");
  const webp = await fixture("webp");

  assert.equal(
    (await createCompanyLogoResponse(jpeg.filename, jpeg.root)).headers.get(
      "content-type",
    ),
    "image/jpeg",
  );
  assert.equal(
    (await createCompanyLogoResponse(webp.filename, webp.root)).headers.get(
      "content-type",
    ),
    "image/webp",
  );
});

test("returns 404 for missing or unsafe filenames", async () => {
  const { root } = await fixture("png");

  for (const filename of [
    null,
    `${UUID}.jpeg`,
    `../items/${UUID}.png`,
    "logo.png",
  ]) {
    const response = await createCompanyLogoResponse(filename, root);
    assert.equal(response.status, 404);
  }
});
