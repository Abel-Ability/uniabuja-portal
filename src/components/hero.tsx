"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, FileText, Beaker, Users, type LucideIcon } from "lucide-react";

// Full-screen hero with scroll parallax: the background image scales/translates
// slower than the content. Dark gradient overlay (slate 70% → 20%) keeps text
// readable. Entrance animations are CSS-gated and reduced-motion safe.
export function Hero({
  facultyCount,
  departmentCount,
  instituteCentreCount,
}: {
  facultyCount: number;
  departmentCount: number;
  instituteCentreCount: number;
}) {
  const bgRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const stats: { value: string; label: string; icon: LucideIcon }[] = [
    { value: String(facultyCount), label: "Faculties", icon: Building2 },
    { value: String(departmentCount), label: "Departments", icon: FileText },
    { value: String(instituteCentreCount), label: "Institutes, Directorates & Centres", icon: Beaker },
    { value: "Dual-Mode", label: "Conventional + Distance", icon: Users },
  ];

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOffset(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const translate = Math.min(offset * 0.35, 260);

  return (
    <section
      className="relative flex min-h-[100svh] items-end overflow-hidden"
      aria-label="Welcome to the University of Abuja"
    >
      {/* background */}
      <div
        ref={bgRef}
        aria-hidden="true"
        className="absolute inset-0 will-change-transform"
        style={{ transform: `translateY(${translate}px) scale(1.08)` }}
      >
        <Image
          src="/images/gate.svg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      {/* gradient overlay slate 70% -> 20% */}
      <div aria-hidden="true" className="hero-overlay absolute inset-0" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
        <p className="anim-fade-up absolute left-4 top-4 z-10 font-head text-[8px] font-semibold italic tracking-[0.3em] text-red-600 sm:left-6 sm:text-[9.6px]">
          The University for National Unity
        </p>
        <h1 className="anim-fade-up delay-1 mt-4 max-w-4xl font-head text-[25px] font-bold leading-tight text-white sm:text-[40px] md:text-[50px]">
          <span className="anim-grad-text">
            Your journey to excellence begins at University of Abuja
          </span>
        </h1>
        <p className="anim-fade-up delay-2 mt-5 max-w-2xl text-lg text-white/90 sm:text-xl">
          A secure, unified digital portal for admissions, academics, and
          administration. Apply with confidence — your data is protected under
          Nigeria&apos;s Data Protection Act.
        </p>
        <div className="anim-fade-up delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
          <Link
            href="/apply"
            className="btn-sheen inline-flex items-center justify-center gap-2 rounded-full bg-brand-strong px-[42px] py-[21px] text-center font-head text-[21px] font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-xl"
          >
            Apply Now
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/80 bg-white/10 px-[42px] py-[21px] text-center font-head text-[21px] font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:text-slate"
          >
            Check Admission / Portal Login
          </Link>
        </div>
        <ul className="anim-fade-up delay-4 mt-10 flex flex-wrap items-center gap-3 border-t border-white/25 pt-6 text-sm text-white/85 sm:mt-12">
          <li className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 font-semibold backdrop-blur">
            <span aria-hidden="true">📅</span> 2026/2027 Admission Session
          </li>
          <li className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 font-semibold backdrop-blur">
            <span aria-hidden="true">📍</span> Airport Road, Abuja, FCT
          </li>
          <li className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 font-semibold backdrop-blur">
            <span aria-hidden="true">🔒</span> NDPA 2023 Compliant
          </li>
        </ul>
        <div className="anim-fade-up delay-5 mt-6 grid grid-cols-1 gap-4 border-t border-white/25 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
              </div>
              <div>
                <p className="font-head text-2xl font-bold leading-none text-white">{value}</p>
                <p className="mt-1 text-sm font-semibold text-white/70">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* scroll hint */}
      <a
        href="#main-content"
        aria-label="Scroll to content"
        className="scroll-hint absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 rounded-full border border-white/40 px-3 py-2 text-lg text-white/80 transition-colors hover:text-white sm:block"
      >
        ↓
      </a>
    </section>
  );
}
