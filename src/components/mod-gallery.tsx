"use client";

import { useEffect, useState } from "react";
import type { CatalogModImage } from "@/lib/types";

export function ModGallery({
  images,
  name,
}: {
  images: CatalogModImage[];
  name: string;
}) {
  const [active, setActive] = useState<CatalogModImage | null>(null);

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (images.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[#9aa3b8]">
        Screenshots
      </h2>
      <ul className="mod-gallery">
        {images.map((image) => (
          <li key={image.id}>
            <button
              type="button"
              className="mod-gallery-item"
              onClick={() => setActive(image)}
            >
              <img src={image.url} alt={`${name} screenshot`} />
            </button>
          </li>
        ))}
      </ul>
      {active ? (
        <div
          className="mod-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} screenshot`}
          onClick={() => setActive(null)}
        >
          <img src={active.url} alt={`${name} screenshot`} />
        </div>
      ) : null}
    </div>
  );
}
