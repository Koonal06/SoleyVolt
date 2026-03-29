import { useEffect } from "react";

export function useNoIndex() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const selector = 'meta[name="robots"]';
    const existing = document.head.querySelector<HTMLMetaElement>(selector);
    const previous = existing?.getAttribute("content") ?? null;
    const meta = existing ?? document.createElement("meta");

    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow, noarchive");

    if (!existing) {
      document.head.appendChild(meta);
    }

    return () => {
      if (!existing) {
        meta.remove();
        return;
      }

      if (previous) {
        existing.setAttribute("content", previous);
      } else {
        existing.removeAttribute("content");
      }
    };
  }, []);
}
