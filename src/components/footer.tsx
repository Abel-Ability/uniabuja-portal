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
    <footer className="bg-white text-brand-strong">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-5xl text-sm text-brand-strong">
          <div className="flex flex-col items-center justify-center gap-y-3 text-center">
            <div className="flex flex-col items-center gap-x-4 gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <h3 className="font-head text-sm font-semibold text-brand-strong">
                Quick Links
              </h3>
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
                {QUICK_LINKS.map(({ href, label }) => (
                  <li key={href} className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-gold">
                      •
                    </span>
                    <Link
                      href={href}
                      className="transition-colors hover:text-gold"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-center gap-x-4 gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <h3 className="font-head text-sm font-semibold text-brand-strong">
                Contact
              </h3>
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

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-brand-strong/15 pt-3 text-center">
          <img
            src="https://drive.google.com/thumbnail?id=1rovoohmsc10VxMnig2NbrDv5_aaH9ukJ"
            alt="Capacity Building and Support logo"
            width={36}
            height={36}
            style={{ objectFit: "contain" }}
          />
          <p className="text-xs text-brand-strong">
            © 2025 Capacity Building and Support. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
