import assert from "node:assert/strict";
import test from "node:test";

import { getPortalBrandingMetadata } from "./portal-branding";

test("derives customer-facing portal metadata from the configured company name", () => {
  assert.deepEqual(getPortalBrandingMetadata("Acme Wholesale"), {
    title: "Acme Wholesale — Customer Portal",
    appleWebAppTitle: "Acme Wholesale Portal",
  });
});

test("uses the neutral company name when no company name is configured", () => {
  assert.deepEqual(getPortalBrandingMetadata("   "), {
    title: "Company Name — Customer Portal",
    appleWebAppTitle: "Company Name Portal",
  });
});
