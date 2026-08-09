import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/header";
import { LoginForm } from "@/components/login-form";
import { FloatingActions } from "@/components/floating-actions";
import { generateCaptcha } from "@/lib/captcha";
import { BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Portal Login" };

export default function LoginPage() {
  const challenge = generateCaptcha();
  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center bg-brand-strong px-4 py-12"
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-brand-strong p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="font-head font-bold">UniAbuja Portal</span>
          </div>
          <div>
            <h1 className="font-head text-3xl font-bold leading-tight">
              One sign-on for every academic and administrative service.
            </h1>
            <p className="mt-3 text-sm text-white/85">
              Central SSO (OAuth 2.0 / OIDC) guards Admissions, Fees, Results,
              Transcripts, LMS, Clearance and more. MFA and step-up
              authentication protect high-risk actions.
            </p>
          </div>
          <p className="text-xs text-white/70">
            {BRAND.orgTagline}
          </p>
        </div>
        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <LogoMark size={32} />
            <span className="font-head font-bold text-slate">UniAbuja Portal</span>
          </div>
          <h2 className="font-head text-2xl font-bold text-slate">Sign in</h2>
          <p className="mb-6 mt-1 text-sm text-slate/75">
            Use your portal username and password.
          </p>
          <LoginForm challenge={challenge} />
          <p className="mt-6 text-center text-xs text-slate/70">
            <Link href="/" className="hover:text-brand-strong">
              ← Back to public site
            </Link>
          </p>
        </div>
      </div>
      <FloatingActions />
    </main>
  );
}
