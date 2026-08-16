// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { ApplyForm } from "@/app/(public)/apply/apply-form";
import { FloatingActions } from "@/components/floating-actions";
import { Header } from "@/components/header";
import { Reveal } from "@/components/reveal";
import { generateCaptcha } from "@/lib/captcha";
import { Hero } from "@/components/hero";
import { LoginForm } from "@/components/login-form";
import { MfaLoginForm } from "@/components/mfa-login-form";
import { ConsentBanner } from "@/components/consent-banner";
import { VerifyForm } from "@/app/(public)/verify/verify-form";
import { NowWidget } from "@/components/now-widget";

const errors: string[] = [];
const origError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
    origError(...args);
  };
  (globalThis as Record<string, unknown>).fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ current: { temperature_2m: 27, weather_code: 2 } }),
    });
  if (!("matchMedia" in window)) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof IntersectionObserver === "undefined") {
    (globalThis as Record<string, unknown>).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
afterAll(() => {
  console.error = origError;
});

function check(name: string, el: React.ReactElement) {
  errors.length = 0;
  const html = renderToString(el);
  document.body.innerHTML = html;
  const root = hydrateRoot(
    document.body,
    el,
    { onUncaughtError: () => {}, onRecoverableError: () => {} },
  );
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      try {
        root.unmount();
      } catch {
        /* teardown race, not a hydration failure */
      }
      const bad = errors.filter((e) => /didn't match|hydrat/i.test(e));
      document.body.innerHTML = "";
      expect(bad, `${name}:\n${bad.join("\n") || "ok"}`).toEqual([]);
      resolve();
    }, 0);
  });
}

const DEPARTMENTS = [
  {
    id: "Sociology",
    name: "Sociology",
    faculty: "Social Sciences",
  },
  {
    id: "Physics",
    name: "Physics",
    faculty: "Physical Science",
  },
];

describe("hydration smoke (client components)", () => {
  it("ApplyForm hydrates without attribute mismatches", async () => {
    await check("ApplyForm", <ApplyForm departments={DEPARTMENTS} challenge={generateCaptcha()} />);
  });

  it("FloatingActions hydrates without attribute mismatches", async () => {
    await check("FloatingActions", <FloatingActions />);
  });

  it("Header hydrates without attribute mismatches", async () => {
    await check("Header", <Header />);
  });

  it("Reveal hydrates without attribute mismatches", async () => {
    await check("Reveal div", <Reveal>hi</Reveal>);
    await check("Reveal li", <Reveal as="li">hi</Reveal>);
  });

  it("Hero hydrates without attribute mismatches", async () => {
    await check("Hero", <Hero facultyCount={17} departmentCount={112} instituteCentreCount={3} />);
  });

  it("LoginForm hydrates without attribute mismatches", async () => {
    await check("LoginForm", <LoginForm />);
  });

  it("MfaLoginForm hydrates without attribute mismatches", async () => {
    await check("MfaLoginForm", <MfaLoginForm />);
  });

  it("VerifyForm hydrates without attribute mismatches", async () => {
    await check("VerifyForm", <VerifyForm />);
  });

  it("NowWidget hydrates without attribute mismatches", async () => {
    await check("NowWidget", <NowWidget />);
  });

  it("ConsentBanner hydrates cleanly (returning visitor, localStorage set)", async () => {
    localStorage.setItem("uap-consent", "all");
    await check("ConsentBanner seeded", <ConsentBanner />);
    localStorage.clear();
  });

  it("ConsentBanner hydrates cleanly (first-time visitor, empty localStorage)", async () => {
    localStorage.clear();
    await check("ConsentBanner fresh", <ConsentBanner />);
  });
});
