import { prisma } from "./prisma";

// Feature-flag system to support the pilot-faculty → all-faculties rollout.
const DEFAULT_FLAGS: Record<string, boolean> = {
  "pilot-faculties": true,
  "pg-module": true,
  "siwes-module": true,
  "nysc-module": true,
  "timetabling-module": true,
  "lms-grade-passback": true,
  "step-up-auth": true,
  "public-verification": true,
  "digital-id-cards": true,
};

let cache: Record<string, boolean> | null = null;

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  if (cache) return cache;
  const rows = await prisma.featureFlag.findMany();
  cache = { ...DEFAULT_FLAGS };
  for (const row of rows) cache[row.key] = row.enabled;
  return cache;
}

export async function isEnabled(key: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key] ?? false;
}

export function invalidateFlagCache(): void {
  cache = null;
}
