import { useEffect, useState } from "react";
import type { QuestionImage } from "../types/exam";

interface QuestionImagesProps {
  images?: QuestionImage[];
  compact?: boolean;
}

function gridClass(count: number): string {
  if (count <= 1) return "count-1";
  if (count === 2) return "count-2";
  if (count === 3) return "count-3";
  if (count === 4) return "count-4";
  return "count-many";
}

export function QuestionImages({ images, compact = false }: QuestionImagesProps) {
  const figures = (images ?? []).filter((image) => image.src.trim());
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!figures.length) return null;
  const current = open !== null ? figures[open] : undefined;

  return (
    <>
      <div className={`q-figures ${gridClass(figures.length)}${compact ? " compact" : ""}`}>
        {figures.map((image, index) => (
          <figure key={`${image.src.slice(0, 48)}-${index}`}>
            <button type="button" className="figure-open" onClick={() => setOpen(index)}>
              <img src={image.src} alt={image.alt || `Figure ${index + 1}`} />
            </button>
            {image.alt && <figcaption>{image.alt}</figcaption>}
          </figure>
        ))}
      </div>
      {current && (
        <div className="lightbox" role="presentation" onMouseDown={() => setOpen(null)}>
          <figure className="lightbox-frame" onMouseDown={(event) => event.stopPropagation()}>
            <img src={current.src} alt={current.alt || "Figure"} />
            {current.alt && <figcaption>{current.alt}</figcaption>}
            <button type="button" className="lightbox-close" onClick={() => setOpen(null)}>
              Close
            </button>
          </figure>
        </div>
      )}
    </>
  );
}
