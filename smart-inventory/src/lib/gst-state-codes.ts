// GST State Code to State Name mapping
// First 2 digits of GSTIN represent the state code
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
};

/**
 * Get state name from GST state code (first 2 digits of GSTIN)
 */
export function getStateFromGSTIN(gstin: string): { stateCode: string; stateName: string } | null {
  if (!gstin || gstin.length < 2) return null;
  const stateCode = gstin.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) return null;
  return { stateCode, stateName };
}

// Reverse lookup: normalized state name → 2-digit code
// For duplicate names (e.g. "Andhra Pradesh"), prefer the newer/current code
const GST_STATE_NAME_TO_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(GST_STATE_CODES)) {
  const key = name.toLowerCase().replace(/\s*\(new\)\s*$/i, "").trim();
  // Later entries (higher codes) overwrite earlier ones for duplicates
  GST_STATE_NAME_TO_CODE[key] = code;
}

/**
 * Get a 2-digit GST state code from a free-text state name.
 * Returns null if not recognized.
 */
export function getStateCodeFromName(stateName: string | null | undefined): string | null {
  if (!stateName) return null;
  const key = stateName.trim().toLowerCase().replace(/\s*\(new\)\s*$/i, "").trim();
  return GST_STATE_NAME_TO_CODE[key] ?? null;
}
