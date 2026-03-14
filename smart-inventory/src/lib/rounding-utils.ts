export type InvoiceRoundOffMode = "NONE" | "NEAREST" | "UP" | "DOWN" | "MANUAL";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function fractional(value: number): number {
  const abs = Math.abs(value);
  return abs - Math.floor(abs);
}

export function normalizeRoundOffMode(value: string | null | undefined): InvoiceRoundOffMode {
  const normalized = String(value || "MANUAL").toUpperCase();
  if (normalized === "NONE" || normalized === "NEAREST" || normalized === "UP" || normalized === "DOWN" || normalized === "MANUAL") {
    return normalized;
  }
  return "MANUAL";
}

export function calculateAutoRoundOff(baseAmount: number, mode: Exclude<InvoiceRoundOffMode, "MANUAL">): number {
  const roundedBase = round2(baseAmount);

  if (mode === "NONE") {
    return 0;
  }

  const sign = roundedBase < 0 ? -1 : 1;
  const absAmount = Math.abs(roundedBase);
  const floorAbs = Math.floor(absAmount);
  const ceilAbs = Math.ceil(absAmount);

  if (mode === "UP") {
    return round2(sign * ceilAbs - roundedBase);
  }

  if (mode === "DOWN") {
    return round2(sign * floorAbs - roundedBase);
  }

  // NEAREST: below 0.50 -> down, 0.50 and above -> up
  const frac = fractional(absAmount);
  const targetAbs = frac < 0.5 ? floorAbs : ceilAbs;
  return round2(sign * targetAbs - roundedBase);
}

export function resolveRoundOff(
  baseAmount: number,
  mode: InvoiceRoundOffMode,
  manualRoundOff: number | null | undefined
): { mode: InvoiceRoundOffMode; roundOff: number } {
  if (mode === "MANUAL") {
    return { mode, roundOff: round2(Number(manualRoundOff || 0)) };
  }

  return {
    mode,
    roundOff: calculateAutoRoundOff(baseAmount, mode),
  };
}
