"use client";

import { useServerInsertedHTML } from "next/navigation";

// Injects an inline script into the <head> of the server-rendered HTML,
// OUTSIDE the React component tree. React 19 warns (and refuses to re-run)
// <script> elements it renders on the client, so emitting the script through
// useServerInsertedHTML keeps it out of the tree during hydration while still
// running it synchronously during HTML parsing (pre-paint).
export function InlineScript({ html }: { html: string }) {
  useServerInsertedHTML(() => (
    <script
      type="text/javascript"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ));
  return null;
}
