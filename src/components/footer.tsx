import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { LogoMark } from "./header";
import { BRAND } from "@/lib/constants";
import { getAcademicUnits, getCentres } from "@/lib/sheets";

export async function Footer() {
  const [academicUnits, centres] = await Promise.all([
    getAcademicUnits().catch(() => null),
    getCentres().catch(() => null),
  ]);
  const hasStats =
    academicUnits != null && academicUnits.facultyCount > 0 && centres != null && centres.length > 0;

  return (
    <footer className="bg-brand-strong text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center gap-3">
              <LogoMark size={40} />
              <div className="leading-tight">
                <div className="font-head text-base font-semibold">{BRAND.orgName}</div>
                <div className="text-xs text-white/70">(Now Yakubu Gowon University)</div>
              </div>
            </div>
            <p className="max-w-md text-sm text-white/80">
              {BRAND.orgTagline}.
              {hasStats
                ? ` A dual-mode institution serving ${academicUnits.facultyCount} academic
                  units, ${academicUnits.departmentCount} departments and ${centres.length}
                  institutes, directorates &amp; centres.`
                : ""}
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-head text-sm font-semibold text-gold">Quick Links</h3>
            <ul className="space-y-1.5 text-sm text-white/80">
              <li>
                <Link href="/apply" className="transition-colors hover:text-gold">
                  Apply for Admission
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-gold">
                  Applicant Portal
                </Link>
              </li>
              <li>
                <Link href="/faculties" className="transition-colors hover:text-gold">
                  Faculties &amp; Departments
                </Link>
              </li>
              <li>
                <Link href="/institutes" className="transition-colors hover:text-gold">
                  Institutes &amp; Centres
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-head text-sm font-semibold text-gold">Contact</h3>
            <ul className="space-y-1.5 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                Airport Road, Abuja, FCT, Nigeria
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                +234 812 210 0528
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                info@uniabuja.edu.ng
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/15 pt-4 sm:flex-row">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} {BRAND.orgName}. All rights reserved.
          </p>
          <p className="text-xs text-white/60">{BRAND.orgTagline}</p>
        </div>
      </div>
    </footer>
  );
}
