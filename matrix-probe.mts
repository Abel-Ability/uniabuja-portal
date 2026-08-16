import { ROLES, landingForRole, getMenuForRole, visibleModules, PORTAL_MODULES, ROLE_LABELS } from "./src/lib/constants";
for (const role of ROLES) {
  const menu = getMenuForRole(role);
  const keys = visibleModules(role);
  const fallback = PORTAL_MODULES.filter((m) => keys.includes(m.key)).map((m) => `/portal/${m.slug}`);
  console.log(`${role}\t${ROLE_LABELS[role]}\tlanding=${landingForRole(role)}\tmenu=${menu.length ? "DEDICATED" : "PORTAL_MODULES"}`);
  if (menu.length) {
    for (const m of menu) console.log(`    -> ${m.href}\t${m.label}`);
  } else {
    for (const h of fallback) console.log(`    -> ${h}`);
  }
}
