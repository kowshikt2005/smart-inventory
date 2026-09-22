import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_COMPANY_NAME,
  getCompanyLogoFilename,
  isCompanyLogoUploadPath,
  normalizeCompanyBranding,
  toPublicCompanyBranding,
} from "./company-branding-contract";

test("normalizes a configured company name and logo", () => {
  const branding = normalizeCompanyBranding([
    { key: "company_name", value: "  Acme Wholesale  " },
    {
      key: "company_logo_url",
      value: "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.png",
    },
  ]);

  assert.deepEqual(branding, {
    companyName: "Acme Wholesale",
    storedLogoUrl:
      "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.png",
  });
});

test("uses a neutral company name when the setting is blank or missing", () => {
  assert.equal(normalizeCompanyBranding([]).companyName, DEFAULT_COMPANY_NAME);
  assert.equal(
    normalizeCompanyBranding([{ key: "company_name", value: "   " }])
      .companyName,
    "Company Name",
  );
});

test("accepts only a UUID image inside the company upload folder", () => {
  const accepted = [
    "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.jpg",
    "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.jpeg",
    "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.png",
    "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.webp",
  ];

  for (const url of accepted) {
    assert.equal(
      getCompanyLogoFilename(url),
      url.slice("/api/uploads/company/".length),
    );
  }
});

test("rejects non-company, non-image, external, and traversal logo paths", () => {
  const rejected = [
    "/api/uploads/items/123e4567-e89b-42d3-a456-426614174000.png",
    "/api/uploads/employees/123e4567-e89b-42d3-a456-426614174000.png",
    "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.pdf",
    "/api/uploads/company/../items/123e4567-e89b-42d3-a456-426614174000.png",
    "https://example.com/logo.png",
    "/api/uploads/company/logo.png",
    null,
  ];

  for (const url of rejected) {
    assert.equal(getCompanyLogoFilename(url), null);
  }
});

test("recognizes saved company logo URLs and permits an empty removal value", () => {
  assert.equal(
    isCompanyLogoUploadPath(
      "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.png",
    ),
    true,
  );
  assert.equal(isCompanyLogoUploadPath(""), true);
  assert.equal(isCompanyLogoUploadPath("/api/uploads/items/logo.png"), false);
});

test("public branding hides the stored upload path", () => {
  assert.deepEqual(
    toPublicCompanyBranding({
      companyName: "Acme Wholesale",
      storedLogoUrl:
        "/api/uploads/company/123e4567-e89b-42d3-a456-426614174000.png",
    }),
    { companyName: "Acme Wholesale", logoUrl: "/api/branding/logo" },
  );

  assert.deepEqual(
    toPublicCompanyBranding({
      companyName: "Company Name",
      storedLogoUrl: null,
    }),
    { companyName: "Company Name", logoUrl: null },
  );
});
