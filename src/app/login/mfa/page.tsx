import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { LogoMark } from "@/components/header";
import { MfaLoginForm } from "@/components/mfa-login-form";
import { FloatingActions } from "@/components/floating-actions";
import { BRAND, landingForRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function MfaLoginPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!session.user.mfaEnabled) redirect(landingForRole(session.user.role));

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center bg-brand-strong px-4 py-12"
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800 md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-brand-strong p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="font-head font-bold">UniAbuja Portal</span>
          </div>
          <div>
            <h1 className="font-head text-3xl font-bold leading-tight">
              Two-step verification.
            </h1>
            <p className="mt-3 text-sm text-white/85">
              {session.user.fullName.split(" ")[0]}, enter the 6-digit code from
              your authenticator app to finish signing in.
            </p>
          </div>
          <p className="text-xs text-white/70">{BRAND.orgTagline}</p>
        </div>
        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <LogoMark size={32} />
            <span className="font-head font-bold text-slate">UniAbuja Portal</span>
          </div>
          <h2 className="font-head text-2xl font-bold text-slate">Verify your identity</h2>
          <p className="mb-6 mt-1 text-sm text-slate/75">
            Signed in as <span className="font-semibold">{session.user.username}</span>.
          </p>
          <MfaLoginForm />
        </div>
      </div>
      <FloatingActions />
    </main>
  );
}
