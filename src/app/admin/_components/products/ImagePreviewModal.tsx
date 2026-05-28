"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";

export function ImagePreviewModal({
  images,
  initialIndex,
  title,
  onClose
}: {
  images: string[];
  initialIndex: number;
  title: string;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const image = images[activeIndex] ?? images[0];

  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex]);

  return (
    <AdminModalBackdrop>
      <div className="image-preview-modal">
        <button className="image-preview-close" type="button" onClick={onClose}><X size={20} /></button>
        <img src={image} alt={title} />
        <strong>{title} <span>{activeIndex + 1} / {images.length}</span></strong>
        {images.length > 1 && (
          <div className="image-preview-thumbs">
            {images.map((item, index) => (
              <button
                className={activeIndex === index ? "active" : ""}
                type="button"
                key={`${item}-${index}`}
                ref={activeIndex === index ? activeThumbRef : null}
                onClick={() => setActiveIndex(index)}
              >
                <img src={item} alt={`${title} 缩略图 ${index + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </AdminModalBackdrop>
  );
}
