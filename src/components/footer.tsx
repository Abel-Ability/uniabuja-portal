import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/constants";

const QUICK_LINKS = [
  { href: "/apply", label: "Apply for Admission" },
  { href: "/login", label: "Applicant Portal" },
  { href: "/faculties", label: "Faculties & Departments" },
  { href: "/institutes", label: "Institutes & Centres" },
];

export function Footer() {
  return (
    <footer className="bg-brand-strong text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-4 text-sm text-white/80">
          <div className="flex flex-col gap-x-3 gap-y-1 sm:flex-row sm:flex-wrap sm:items-baseline">
            <h3 className="font-head text-sm font-semibold text-gold">Quick Links</h3>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {QUICK_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="transition-colors hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-x-3 gap-y-1 sm:flex-row sm:flex-wrap sm:items-baseline">
            <h3 className="font-head text-sm font-semibold text-gold">Contact</h3>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
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

        <div className="mt-6 border-t border-white/15 pt-4 text-center">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} {BRAND.orgName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
