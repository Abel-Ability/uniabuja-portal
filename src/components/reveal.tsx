"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Scroll-reveal wrapper: fades content up as it enters the viewport.
// - Respects prefers-reduced-motion (renders immediately).
// - Works without JS (content stays visible via the html.js gate in CSS).
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "article" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
