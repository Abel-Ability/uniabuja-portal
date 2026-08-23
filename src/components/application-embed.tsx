const APPLICATION_FORM_URL =
  "https://script.google.com/macros/s/AKfycbwds0DOe4a1Sj1-SyBoCHg5-2jdG86Bq8bzGn90m8n78VqcoEkTA5l_leVuEjFoLAF4/exec";

// ?embed=true tells the Apps Script web app to render without its own
// header/footer chrome (same convention as the TASS 2026 abstract form),
// so it doesn't duplicate the portal's native layout.
const EMBEDDED_FORM_URL = `${APPLICATION_FORM_URL}?embed=true`;

export function ApplicationEmbed() {
  return (
    <iframe
      src={EMBEDDED_FORM_URL}
      className="min-h-[800px] w-full border-0"
      title="University Admission Application"
      allow="camera; microphone"
    />
  );
}
