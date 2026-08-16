"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
    >
      Print Registration
    </button>
  );
}
