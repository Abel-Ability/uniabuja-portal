import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

const QUICK_LINKS = [
  { href: "/apply", label: "Apply for Admission" },
  { href: "/login", label: "Applicant Portal" },
  { href: "/faculties", label: "Faculties & Departments" },
  { href: "/institutes", label: "Institutes & Centres" },
];

export function Footer() {
  return (
    <footer className="bg-brand-strong text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white px-4 py-3 text-center shadow-sm sm:px-6 sm:py-3.5">
          <div className="flex flex-col items-center justify-center gap-y-3 text-sm text-slate">
            <div className="flex flex-col items-center gap-x-4 gap-y-1 sm:flex-row sm:flex-wrap sm:justify-center sm:items-center">
              <h3 className="font-head text-sm font-semibold text-gold">Quick Links</h3>
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
                {QUICK_LINKS.map(({ href, label }) => (
                  <li key={href} className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-gold">
                      •
                    </span>
                    <Link
                      href={href}
                      className="transition-colors hover:text-brand-strong"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-center gap-x-4 gap-y-1 sm:flex-row sm:flex-wrap sm:justify-center sm:items-center">
              <h3 className="font-head text-sm font-semibold text-gold">Contact</h3>
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
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
        </div>

        <div className="mt-3 flex flex-col items-center gap-1.5 border-t border-white/15 pt-3 text-center">
          <img
            src="https://drive.google.com/thumbnail?id=1rovoohmsc10VxMnig2NbrDv5_aaH9ukJ"
            alt="Capacity Building and Support logo"
            width={48}
            height={48}
            style={{ objectFit: "contain" }}
          />
          <p className="text-xs text-white/60">
            © 2025 Capacity Building and Support. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
