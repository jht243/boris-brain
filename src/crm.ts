// Mock Pipedrive pipelines for the "CRM Insights" demo tab.
//
// Audience: a senior RevOps consultant who runs many fintech-lender clients on
// Pipedrive. He picks a client from the dropdown and sees what AI surfaces the
// moment it reads that client's CRM — deals rotting in underwriting, funded
// merchants overdue for a renewal, leads going cold, declined deals worth a
// second look. Each client below is a different lender with its own book.
//
// Dates are expressed as day-offsets (no real Date math) so the demo is stable.

import { completeJson } from "./llm.js";

export type Stage =
  | "New Lead"
  | "Qualified"
  | "Application Out"
  | "Underwriting"
  | "Offer Out"
  | "Funded"
  | "Declined";

export const OPEN_STAGES: Stage[] = [
  "New Lead",
  "Qualified",
  "Application Out",
  "Underwriting",
  "Offer Out",
];

export type Product =
  | "MCA / Cash Advance"
  | "Merchant Processing"
  | "Equipment Financing"
  | "Business Line of Credit"
  | "Renewal";

export interface Deal {
  id: string;
  org: string;
  contact: string;
  industry: string;
  product: Product;
  /** Funding amount (open/won) or requested amount. USD. */
  value: number;
  stage: Stage;
  owner: string;
  source: string;
  /** Days since anyone logged an activity (call/email/note) on the deal. */
  daysSinceActivity: number;
  /** Days the deal has sat in its current stage. */
  daysInStage: number;
  /** Total age of the deal in days. */
  ageDays: number;
  // --- Won-deal-only fields (used for renewal / cross-sell detection) ---
  /** For Funded deals: how long ago it funded. */
  fundedDaysAgo?: number;
  /** For Funded deals: % of the balance the merchant has paid down. */
  paidPct?: number;
  /** For Funded deals: original factor rate. */
  factorRate?: number;
  /** Whether the merchant already has a second product on the books. */
  hasCrossSell?: boolean;
}

export interface Client {
  id: string;
  name: string;
  vertical: string;
  deals: Deal[];
}

// ---------------------------------------------------------------------------
// Client A — Summit Cash Capital (merchant cash advance / renewals)
// ---------------------------------------------------------------------------
const SUMMIT_DEALS: Deal[] = [
  // --- Rotting in underwriting: high value, stuck, no recent touch ---
  { id: "D-1041", org: "Sunbelt Auto Group", contact: "Marco Ruiz", industry: "Auto Repair", product: "MCA / Cash Advance", value: 85000, stage: "Underwriting", owner: "Marcus Bell", source: "ISO partner", daysSinceActivity: 16, daysInStage: 23, ageDays: 41 },
  { id: "D-1067", org: "Harbor Freight Logistics", contact: "Tara Quinn", industry: "Trucking", product: "Equipment Financing", value: 142000, stage: "Underwriting", owner: "Dana Cho", source: "Referral", daysSinceActivity: 21, daysInStage: 27, ageDays: 52 },
  { id: "D-1090", org: "Vesper Hospitality", contact: "Liam Park", industry: "Restaurants", product: "MCA / Cash Advance", value: 60000, stage: "Offer Out", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 12, daysInStage: 14, ageDays: 33 },

  // --- High-value going cold (untouched) in early/mid stages ---
  { id: "D-1102", org: "Crown Mattress Outlet", contact: "Bianca Lowe", industry: "Retail", product: "MCA / Cash Advance", value: 48000, stage: "Qualified", owner: "Marcus Bell", source: "Cold outreach", daysSinceActivity: 9, daysInStage: 11, ageDays: 18 },
  { id: "D-1115", org: "Pinnacle Roofing Co.", contact: "Derek Shaw", industry: "Construction", product: "Business Line of Credit", value: 110000, stage: "Application Out", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 11, daysInStage: 13, ageDays: 24 },
  { id: "D-1123", org: "Lone Star BBQ Holdings", contact: "Gail Mercer", industry: "Restaurants", product: "MCA / Cash Advance", value: 72000, stage: "Underwriting", owner: "Dana Cho", source: "Inbound web", daysSinceActivity: 8, daysInStage: 9, ageDays: 30 },

  // --- Healthy active deals (recently touched) ---
  { id: "D-1130", org: "Azure Dental Partners", contact: "Dr. Neel Shah", industry: "Medical / Dental", product: "Equipment Financing", value: 95000, stage: "Offer Out", owner: "Rey Ortiz", source: "Referral", daysSinceActivity: 2, daysInStage: 4, ageDays: 19 },
  { id: "D-1138", org: "Velocity Fitness", contact: "Sam Doyle", industry: "Gyms / Fitness", product: "MCA / Cash Advance", value: 40000, stage: "Qualified", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 1, daysInStage: 2, ageDays: 6 },
  { id: "D-1144", org: "Meridian Liquor Mart", contact: "Omar Haddad", industry: "Liquor / Convenience", product: "MCA / Cash Advance", value: 33000, stage: "Application Out", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 3, daysInStage: 5, ageDays: 12 },
  { id: "D-1151", org: "Coastal Salon Group", contact: "Renée Webb", industry: "Salons / Spas", product: "Merchant Processing", value: 0, stage: "Qualified", owner: "Dana Cho", source: "Referral", daysSinceActivity: 4, daysInStage: 6, ageDays: 10 },

  // --- New leads (some untouched, the classic speed-to-lead gap) ---
  { id: "D-1160", org: "Greenline Landscaping", contact: "Tony Vasquez", industry: "Landscaping", product: "MCA / Cash Advance", value: 25000, stage: "New Lead", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 6, daysInStage: 6, ageDays: 6 },
  { id: "D-1161", org: "Bright Smiles Pediatrics", contact: "Dr. Alana Cruz", industry: "Medical / Dental", product: "Equipment Financing", value: 64000, stage: "New Lead", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 8, daysInStage: 8, ageDays: 8 },
  { id: "D-1162", org: "Iron Peak Gym", contact: "Chad Foley", industry: "Gyms / Fitness", product: "MCA / Cash Advance", value: 30000, stage: "New Lead", owner: "Priya Nair", source: "Cold outreach", daysSinceActivity: 5, daysInStage: 5, ageDays: 5 },
  { id: "D-1163", org: "Maple & Oak Furniture", contact: "Heidi Brandt", industry: "Retail", product: "MCA / Cash Advance", value: 52000, stage: "New Lead", owner: "Dana Cho", source: "ISO partner", daysSinceActivity: 10, daysInStage: 10, ageDays: 10 },

  // --- Funded deals (won). Renewal / cross-sell candidates by design ---
  { id: "D-0921", org: "Riverside Diner Group", contact: "Pete Salerno", industry: "Restaurants", product: "MCA / Cash Advance", value: 55000, stage: "Funded", owner: "Marcus Bell", source: "ISO partner", daysSinceActivity: 96, daysInStage: 96, ageDays: 150, fundedDaysAgo: 96, paidPct: 68, factorRate: 1.32, hasCrossSell: false },
  { id: "D-0935", org: "Apex Collision Center", contact: "Wes Tanner", industry: "Auto Repair", product: "MCA / Cash Advance", value: 78000, stage: "Funded", owner: "Dana Cho", source: "Referral", daysSinceActivity: 118, daysInStage: 118, ageDays: 175, fundedDaysAgo: 118, paidPct: 81, factorRate: 1.28, hasCrossSell: false },
  { id: "D-0948", org: "Golden Crust Bakery", contact: "Marie Dubois", industry: "Restaurants", product: "MCA / Cash Advance", value: 42000, stage: "Funded", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 102, daysInStage: 102, ageDays: 160, fundedDaysAgo: 102, paidPct: 74, factorRate: 1.35, hasCrossSell: true },
  { id: "D-0959", org: "TrueNorth HVAC", contact: "Glen Park", industry: "Home Services", product: "Equipment Financing", value: 130000, stage: "Funded", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 134, daysInStage: 134, ageDays: 190, fundedDaysAgo: 134, paidPct: 88, factorRate: 1.30, hasCrossSell: false },
  // Funded but too recent / barely paid down — should NOT be flagged for renewal.
  { id: "D-1015", org: "Sunset Car Wash", contact: "Ivan Petrov", industry: "Auto Services", product: "MCA / Cash Advance", value: 38000, stage: "Funded", owner: "Marcus Bell", source: "Cold outreach", daysSinceActivity: 34, daysInStage: 34, ageDays: 60, fundedDaysAgo: 34, paidPct: 22, factorRate: 1.40, hasCrossSell: false },
  // Funded, no second product attached — cross-sell candidate.
  { id: "D-0972", org: "Empire Wholesale Foods", contact: "Nadia Khan", industry: "Wholesale / Distribution", product: "MCA / Cash Advance", value: 90000, stage: "Funded", owner: "Dana Cho", source: "Referral", daysSinceActivity: 47, daysInStage: 47, ageDays: 95, fundedDaysAgo: 47, paidPct: 41, factorRate: 1.33, hasCrossSell: false },

  // --- Declined / lost (re-engage candidates) ---
  { id: "D-0810", org: "Bayou Seafood Co.", contact: "Curtis Bell", industry: "Restaurants", product: "MCA / Cash Advance", value: 50000, stage: "Declined", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 74, daysInStage: 74, ageDays: 110 },
  { id: "D-0824", org: "Granite State Movers", contact: "Holly Frye", industry: "Moving / Storage", product: "MCA / Cash Advance", value: 36000, stage: "Declined", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 88, daysInStage: 88, ageDays: 120 },
  { id: "D-0790", org: "Old Town Hardware", contact: "Russell Mott", industry: "Retail", product: "Business Line of Credit", value: 65000, stage: "Declined", owner: "Marcus Bell", source: "Cold outreach", daysSinceActivity: 140, daysInStage: 140, ageDays: 165 },
  // Recently declined — too soon to re-approach (should NOT be flagged).
  { id: "D-1055", org: "Nova Print Shop", contact: "Dana Lin", industry: "Printing", product: "MCA / Cash Advance", value: 28000, stage: "Declined", owner: "Dana Cho", source: "Inbound web", daysSinceActivity: 9, daysInStage: 9, ageDays: 20 },
];

// ---------------------------------------------------------------------------
// Client B — Keystone Merchant Services (payments / processing + MCA)
// ---------------------------------------------------------------------------
const KEYSTONE_DEALS: Deal[] = [
  { id: "K-2010", org: "Coastal Retail Group", contact: "Erin Vance", industry: "Retail", product: "Merchant Processing", value: 32000, stage: "Underwriting", owner: "Dana Cho", source: "ISO partner", daysSinceActivity: 14, daysInStage: 19, ageDays: 30 },
  { id: "K-2014", org: "Urban Eats Collective", contact: "Paolo Greco", industry: "Restaurants", product: "Merchant Processing", value: 41000, stage: "Offer Out", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 11, daysInStage: 16, ageDays: 28 },
  { id: "K-2021", org: "Peak Outdoor Co.", contact: "Sandra Wills", industry: "E-commerce", product: "MCA / Cash Advance", value: 60000, stage: "Underwriting", owner: "Rey Ortiz", source: "Referral", daysSinceActivity: 18, daysInStage: 22, ageDays: 40 },

  { id: "K-2030", org: "Bella Nails & Spa", contact: "Mia Tran", industry: "Salons / Spas", product: "Merchant Processing", value: 21000, stage: "Qualified", owner: "Priya Nair", source: "Cold outreach", daysSinceActivity: 8, daysInStage: 9, ageDays: 14 },
  { id: "K-2035", org: "Greenfield Grocers", contact: "Hank Ross", industry: "Grocery", product: "Merchant Processing", value: 38000, stage: "Application Out", owner: "Dana Cho", source: "ISO partner", daysSinceActivity: 9, daysInStage: 11, ageDays: 19 },
  { id: "K-2038", org: "Frontline Fitness", contact: "Cory Webb", industry: "Gyms / Fitness", product: "MCA / Cash Advance", value: 45000, stage: "Qualified", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 10, daysInStage: 10, ageDays: 16 },
  { id: "K-2042", org: "Tidewater Cafe", contact: "Joy Abara", industry: "Restaurants", product: "Merchant Processing", value: 18000, stage: "New Lead", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 8, daysInStage: 8, ageDays: 8 },

  { id: "K-2050", org: "Lumière Boutique", contact: "Cara Levin", industry: "Retail", product: "Merchant Processing", value: 27000, stage: "Offer Out", owner: "Priya Nair", source: "Referral", daysSinceActivity: 2, daysInStage: 3, ageDays: 17 },
  { id: "K-2053", org: "Harbor Point Dental", contact: "Dr. Sana Iqbal", industry: "Medical / Dental", product: "Merchant Processing", value: 35000, stage: "Qualified", owner: "Dana Cho", source: "Inbound web", daysSinceActivity: 3, daysInStage: 4, ageDays: 9 },
  { id: "K-2056", org: "Sprint Auto Parts", contact: "Del Pryor", industry: "Auto Parts", product: "MCA / Cash Advance", value: 50000, stage: "Application Out", owner: "Marcus Bell", source: "ISO partner", daysSinceActivity: 4, daysInStage: 5, ageDays: 12 },
  { id: "K-2060", org: "Nova Pet Supplies", contact: "Beth Cole", industry: "E-commerce", product: "Merchant Processing", value: 22000, stage: "New Lead", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 2, daysInStage: 2, ageDays: 2 },

  { id: "K-1905", org: "Maple Street Bakery", contact: "Owen Daly", industry: "Restaurants", product: "MCA / Cash Advance", value: 48000, stage: "Funded", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 104, daysInStage: 104, ageDays: 160, fundedDaysAgo: 104, paidPct: 71, factorRate: 1.31, hasCrossSell: true },
  { id: "K-1912", org: "Cedar Auto Body", contact: "Gus Marin", industry: "Auto Repair", product: "MCA / Cash Advance", value: 66000, stage: "Funded", owner: "Dana Cho", source: "Referral", daysSinceActivity: 122, daysInStage: 122, ageDays: 175, fundedDaysAgo: 122, paidPct: 79, factorRate: 1.29, hasCrossSell: true },
  // Cross-sell: processing merchants with no advance on the books.
  { id: "K-1920", org: "Riverside Florist", contact: "Lana Beck", industry: "Retail", product: "Merchant Processing", value: 30000, stage: "Funded", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 47, daysInStage: 47, ageDays: 110, fundedDaysAgo: 60, hasCrossSell: false },
  { id: "K-1925", org: "Summit Hardware", contact: "Roy Stein", industry: "Retail", product: "Merchant Processing", value: 44000, stage: "Funded", owner: "Rey Ortiz", source: "Referral", daysSinceActivity: 52, daysInStage: 52, ageDays: 120, fundedDaysAgo: 75, hasCrossSell: false },
  // Funded too recent (not renewal).
  { id: "K-1960", org: "Bayview Grill", contact: "Tess Olin", industry: "Restaurants", product: "MCA / Cash Advance", value: 40000, stage: "Funded", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 30, daysInStage: 30, ageDays: 55, fundedDaysAgo: 30, paidPct: 19, factorRate: 1.34, hasCrossSell: true },

  { id: "K-1810", org: "Oak & Iron Furniture", contact: "Vic Reyes", industry: "Retail", product: "MCA / Cash Advance", value: 52000, stage: "Declined", owner: "Dana Cho", source: "Cold outreach", daysSinceActivity: 80, daysInStage: 80, ageDays: 110 },
  { id: "K-1822", org: "Citywide Cleaners", contact: "Ana Pope", industry: "Services", product: "Merchant Processing", value: 24000, stage: "Declined", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 95, daysInStage: 95, ageDays: 125 },
  // Declined too recent.
  { id: "K-2005", org: "Pronto Print", contact: "Sal Diaz", industry: "Printing", product: "Merchant Processing", value: 16000, stage: "Declined", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 10, daysInStage: 10, ageDays: 22 },
];

// ---------------------------------------------------------------------------
// Client C — Apex Equipment Capital (equipment finance / working capital)
// ---------------------------------------------------------------------------
const APEX_DEALS: Deal[] = [
  { id: "A-3010", org: "Ironclad Construction", contact: "Drew Hale", industry: "Construction", product: "Equipment Financing", value: 165000, stage: "Underwriting", owner: "Priya Nair", source: "Referral", daysSinceActivity: 17, daysInStage: 24, ageDays: 45 },
  { id: "A-3015", org: "Longhaul Freight LLC", contact: "Mona Pratt", industry: "Trucking", product: "Equipment Financing", value: 128000, stage: "Underwriting", owner: "Dana Cho", source: "ISO partner", daysSinceActivity: 15, daysInStage: 19, ageDays: 38 },
  { id: "A-3019", org: "Precision Dental Labs", contact: "Dr. Ravi Menon", industry: "Medical / Dental", product: "Equipment Financing", value: 92000, stage: "Offer Out", owner: "Rey Ortiz", source: "Inbound web", daysSinceActivity: 12, daysInStage: 15, ageDays: 33 },

  { id: "A-3025", org: "Summit Steel Works", contact: "Hugo Frank", industry: "Manufacturing", product: "Business Line of Credit", value: 140000, stage: "Application Out", owner: "Marcus Bell", source: "Referral", daysSinceActivity: 9, daysInStage: 12, ageDays: 22 },
  { id: "A-3030", org: "Valley Harvest Farms", contact: "Cole Banks", industry: "Agriculture", product: "Equipment Financing", value: 110000, stage: "Qualified", owner: "Priya Nair", source: "Cold outreach", daysSinceActivity: 10, daysInStage: 11, ageDays: 18 },
  { id: "A-3034", org: "Apex Landscaping Pros", contact: "Nia Ford", industry: "Landscaping", product: "MCA / Cash Advance", value: 38000, stage: "Qualified", owner: "Dana Cho", source: "Inbound web", daysSinceActivity: 8, daysInStage: 9, ageDays: 14 },

  { id: "A-3040", org: "Granite Ridge Builders", contact: "Seth Crane", industry: "Construction", product: "Equipment Financing", value: 175000, stage: "Offer Out", owner: "Rey Ortiz", source: "Referral", daysSinceActivity: 2, daysInStage: 4, ageDays: 20 },
  { id: "A-3044", org: "Coastal Cargo Lines", contact: "Reed Salas", industry: "Trucking", product: "Equipment Financing", value: 86000, stage: "Application Out", owner: "Marcus Bell", source: "ISO partner", daysSinceActivity: 3, daysInStage: 5, ageDays: 12 },
  { id: "A-3048", org: "Metro Imaging Center", contact: "Dr. Paul Reyes", industry: "Medical / Dental", product: "Equipment Financing", value: 120000, stage: "Qualified", owner: "Priya Nair", source: "Inbound web", daysSinceActivity: 2, daysInStage: 3, ageDays: 8 },
  { id: "A-3052", org: "Newleaf Nurseries", contact: "Gwen Hart", industry: "Agriculture", product: "MCA / Cash Advance", value: 42000, stage: "New Lead", owner: "Dana Cho", source: "Inbound web", daysSinceActivity: 6, daysInStage: 6, ageDays: 6 },

  { id: "A-2905", org: "Titan Excavation", contact: "Brad Olsen", industry: "Construction", product: "Equipment Financing", value: 158000, stage: "Funded", owner: "Rey Ortiz", source: "Referral", daysSinceActivity: 128, daysInStage: 128, ageDays: 190, fundedDaysAgo: 128, paidPct: 84, hasCrossSell: true },
  { id: "A-2912", org: "Redline Trucking Co.", contact: "Kim Vargas", industry: "Trucking", product: "Equipment Financing", value: 134000, stage: "Funded", owner: "Marcus Bell", source: "ISO partner", daysSinceActivity: 110, daysInStage: 110, ageDays: 170, fundedDaysAgo: 110, paidPct: 73, hasCrossSell: false },
  { id: "A-2918", org: "Pinewood Millworks", contact: "Eli Burke", industry: "Manufacturing", product: "Equipment Financing", value: 98000, stage: "Funded", owner: "Priya Nair", source: "Referral", daysSinceActivity: 99, daysInStage: 99, ageDays: 150, fundedDaysAgo: 99, paidPct: 66, hasCrossSell: true },
  // Cross-sell: funded equipment clients with no working-capital line.
  { id: "A-2925", org: "Harvest Gold Dairy", contact: "Tom Pell", industry: "Agriculture", product: "Equipment Financing", value: 115000, stage: "Funded", owner: "Dana Cho", source: "Inbound web", daysSinceActivity: 50, daysInStage: 50, ageDays: 100, fundedDaysAgo: 55, hasCrossSell: false },
  { id: "A-2930", org: "Bedrock Paving", contact: "Lou Marsh", industry: "Construction", product: "Equipment Financing", value: 76000, stage: "Funded", owner: "Marcus Bell", source: "ISO partner", daysSinceActivity: 44, daysInStage: 44, ageDays: 115, fundedDaysAgo: 68, hasCrossSell: false },
  // Funded too recent.
  { id: "A-2960", org: "Skyline Crane Rental", contact: "Jed Pace", industry: "Construction", product: "Equipment Financing", value: 145000, stage: "Funded", owner: "Rey Ortiz", source: "Referral", daysSinceActivity: 28, daysInStage: 28, ageDays: 50, fundedDaysAgo: 28, paidPct: 14, hasCrossSell: true },

  { id: "A-2810", org: "Frontier Logistics", contact: "Rosa Kemp", industry: "Trucking", product: "Equipment Financing", value: 90000, stage: "Declined", owner: "Priya Nair", source: "ISO partner", daysSinceActivity: 85, daysInStage: 85, ageDays: 120 },
  { id: "A-2820", org: "Copperline Electrical", contact: "Walt Nash", industry: "Construction", product: "Business Line of Credit", value: 70000, stage: "Declined", owner: "Dana Cho", source: "Cold outreach", daysSinceActivity: 100, daysInStage: 100, ageDays: 130 },
  // Declined too recent.
  { id: "A-2998", org: "Quickset Concrete", contact: "Sid Roe", industry: "Construction", product: "MCA / Cash Advance", value: 35000, stage: "Declined", owner: "Marcus Bell", source: "Inbound web", daysSinceActivity: 11, daysInStage: 11, ageDays: 24 },
];

export const CLIENTS: Client[] = [
  { id: "summit", name: "Summit Cash Capital", vertical: "Merchant cash advance", deals: SUMMIT_DEALS },
  { id: "keystone", name: "Keystone Merchant Services", vertical: "Payments & processing", deals: KEYSTONE_DEALS },
  { id: "apex", name: "Apex Equipment Capital", vertical: "Equipment finance", deals: APEX_DEALS },
];

/** Resolve a client by id, defaulting to the first. */
export function getClient(id?: string): Client {
  return CLIENTS.find((c) => c.id === id) ?? CLIENTS[0];
}

// ---------------------------------------------------------------------------
// Segment thresholds — the rules the demo runs the moment Pipedrive connects.
// ---------------------------------------------------------------------------
export const RULES = {
  rottenDaysInStage: 14, // open deal stuck in one stage this long = rotting
  coldDaysNoTouch: 7, // open deal with no activity this long = going cold
  renewalMinDaysFunded: 90, // funded at least this long ago
  renewalMinPaidPct: 50, // and paid down at least this much = renewal-ready
  reEngageMinDaysDeclined: 60, // declined at least this long ago = safe to re-approach
  reEngageMaxDaysDeclined: 180, // but not so long it's stale
  highValue: 75000, // "big deal" threshold for prioritization
};

const isOpen = (d: Deal) => OPEN_STAGES.includes(d.stage);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export interface Segment {
  key: string;
  label: string;
  blurb: string;
  deals: Deal[];
  totalValue: number;
}

/** Run all segment rules over a pipeline. Pure + deterministic. */
export function computeSegments(deals: Deal[]): Segment[] {
  const rotting = deals.filter(
    (d) => isOpen(d) && d.daysInStage >= RULES.rottenDaysInStage
  );
  const cold = deals.filter(
    (d) =>
      isOpen(d) &&
      d.daysSinceActivity >= RULES.coldDaysNoTouch &&
      d.daysInStage < RULES.rottenDaysInStage // keep distinct from "rotting"
  );
  const renewal = deals.filter(
    (d) =>
      d.stage === "Funded" &&
      (d.fundedDaysAgo ?? 0) >= RULES.renewalMinDaysFunded &&
      (d.paidPct ?? 0) >= RULES.renewalMinPaidPct
  );
  const crossSell = deals.filter(
    (d) => d.stage === "Funded" && d.hasCrossSell === false && !renewal.includes(d)
  );
  const reEngage = deals.filter(
    (d) =>
      d.stage === "Declined" &&
      d.daysSinceActivity >= RULES.reEngageMinDaysDeclined &&
      d.daysSinceActivity <= RULES.reEngageMaxDaysDeclined
  );

  const seg = (
    key: string,
    label: string,
    blurb: string,
    list: Deal[]
  ): Segment => ({
    key,
    label,
    blurb,
    deals: list,
    totalValue: list.reduce((s, d) => s + d.value, 0),
  });

  return [
    seg("rotting", "Rotting deals", `Stuck in one stage ${RULES.rottenDaysInStage}+ days`, rotting),
    seg("cold", "Going cold (untouched)", `No activity in ${RULES.coldDaysNoTouch}+ days`, cold),
    seg("renewal", "Renewal-ready (upsell)", `Funded ${RULES.renewalMinDaysFunded}+ days ago, paid past ${RULES.renewalMinPaidPct}%`, renewal),
    seg("crosssell", "Cross-sell ready", "Funded merchants without a second product", crossSell),
    seg("reengage", "Re-speak / re-engage", `Declined ${RULES.reEngageMinDaysDeclined}–${RULES.reEngageMaxDaysDeclined} days ago`, reEngage),
  ];
}

export interface PipelineStats {
  totalDeals: number;
  openDeals: number;
  openValue: number;
  fundedValue: number;
  byStage: { stage: Stage; count: number; value: number }[];
  byIndustry: { industry: string; count: number; value: number }[];
  atRiskValue: number; // open value sitting in rotting + cold
}

export function computeStats(deals: Deal[]): PipelineStats {
  const open = deals.filter(isOpen);
  const stages: Stage[] = [...OPEN_STAGES, "Funded", "Declined"];
  const byStage = stages.map((stage) => {
    const list = deals.filter((d) => d.stage === stage);
    return { stage, count: list.length, value: list.reduce((s, d) => s + d.value, 0) };
  });
  const industries = [...new Set(deals.map((d) => d.industry))];
  const byIndustry = industries
    .map((industry) => {
      const list = deals.filter((d) => d.industry === industry);
      return { industry, count: list.length, value: list.reduce((s, d) => s + d.value, 0) };
    })
    .sort((a, b) => b.value - a.value);

  const segs = computeSegments(deals);
  const atRisk = new Set<string>();
  for (const s of segs) {
    if (s.key === "rotting" || s.key === "cold") s.deals.forEach((d) => atRisk.add(d.id));
  }
  const atRiskValue = deals
    .filter((d) => atRisk.has(d.id))
    .reduce((s, d) => s + d.value, 0);

  return {
    totalDeals: deals.length,
    openDeals: open.length,
    openValue: open.reduce((s, d) => s + d.value, 0),
    fundedValue: deals.filter((d) => d.stage === "Funded").reduce((s, d) => s + d.value, 0),
    byStage,
    byIndustry,
    atRiskValue,
  };
}

// ---------------------------------------------------------------------------
// AI layer — exec summary + recommended actions + automation rules.
// Grounded on the computed segments so it's fast and never invents deals.
// ---------------------------------------------------------------------------
export interface Finding {
  title: string;
  severity: "high" | "medium" | "low";
  detail: string;
  dealIds: string[];
  recommendedAction: string;
  channel: "slack" | "email" | "task";
}
export interface AutomationRule {
  name: string;
  trigger: string;
  action: string;
  channel: "slack" | "email" | "task";
}
export interface CrmInsights {
  headline: string;
  findings: Finding[];
  rules: AutomationRule[];
}

const INSIGHT_SYSTEM = `You are an AI revenue-operations layer on top of a fintech lender's Pipedrive CRM (merchant cash advance, renewals, equipment financing, merchant processing).

The reader is a senior RevOps consultant who knows this business cold. Write for an expert. State findings and numbers only. NEVER explain what a term means, why a pattern matters, or give any background, teaching, or context. No filler, no hedging, no em dashes. Talk in dollars and deal IDs.

You are given a pipeline and pre-computed segments (rotting deals, deals going cold, renewal-ready funded merchants, cross-sell candidates, declined deals worth re-approaching). Surface the money and the next move.

Return ONLY a JSON object with this exact shape:
{
  "headline": "one line: total dollars at risk plus dollars in opportunity, with deal counts. No explanation.",
  "findings": [
    {
      "title": "short label",
      "severity": "high" | "medium" | "low",
      "detail": "ONE short line: the pattern plus the dollar and deal-count figures. Facts only, no reasoning, no education.",
      "dealIds": ["D-1041", ...],
      "recommendedAction": "terse imperative command, max 8 words. e.g. 'Call and escalate with underwriting today'",
      "channel": "slack" | "email" | "task"
    }
  ],
  "rules": [
    {
      "name": "rule name",
      "trigger": "the if-condition, terse",
      "action": "what fires, terse",
      "channel": "slack" | "email" | "task"
    }
  ]
}

Produce 4-6 findings (one per meaningful segment, highest dollars first) and 4-6 automation rules. Reference real deal IDs. Renewals and re-engagement carry the most dollars, rank accordingly.`;

export async function generateInsights(deals: Deal[]): Promise<CrmInsights> {
  const segments = computeSegments(deals);
  const stats = computeStats(deals);

  const segmentText = segments
    .map((s) => {
      const rows = s.deals
        .map(
          (d) =>
            `    ${d.id} | ${d.org} | ${d.industry} | ${d.product} | ${money(
              d.value
            )} | stage:${d.stage} | ${d.daysInStage}d in stage | ${d.daysSinceActivity}d no touch` +
            (d.fundedDaysAgo
              ? ` | funded ${d.fundedDaysAgo}d ago${d.paidPct != null ? `, ${d.paidPct}% paid` : ""}${d.hasCrossSell ? ", has 2nd product" : ", no 2nd product"}`
              : "")
        )
        .join("\n");
      return `${s.label} (${s.deals.length} deals, ${money(s.totalValue)}): ${s.blurb}\n${rows || "    (none)"}`;
    })
    .join("\n\n");

  const user = `PIPELINE SNAPSHOT
Open deals: ${stats.openDeals} worth ${money(stats.openValue)}
At-risk open value (rotting + cold): ${money(stats.atRiskValue)}
Funded book: ${money(stats.fundedValue)}
Top industries: ${stats.byIndustry.slice(0, 4).map((i) => `${i.industry} (${i.count})`).join(", ")}

SEGMENTS THE RULES ALREADY FLAGGED
${segmentText}

Write the insights JSON now.`;

  return completeJson<CrmInsights>({
    system: INSIGHT_SYSTEM,
    user,
    maxTokens: 2000,
  });
}
