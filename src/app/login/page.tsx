import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/header";
import { LoginForm } from "@/components/login-form";
import { FloatingActions } from "@/components/floating-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Portal Login" };

export default function LoginPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-900"
    >
      <div className="w-full max-w-md rounded-3xl bg-slate-200 p-8 shadow-2xl sm:p-10 dark:bg-slate-800">
        <div className="mb-6 flex justify-center">
          <LogoMark size={81} />
        </div>

        <h2 className="font-head text-2xl font-bold text-slate">
          Sign in
        </h2>

          <p className="mb-6 mt-1 text-sm text-slate/75">
            Use your portal username and password.
          </p>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-slate/70">
            <Link href="/" className="hover:text-brand-strong">
              ← Back to public site
            </Link>
          </p>
      </div>

      <FloatingActions />
    </main>
  );
}