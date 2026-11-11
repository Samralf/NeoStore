"use client";

import { useState } from "react";
import Image from "next/image";

export default function StoreProductGallery({
  images,
  name,
  arabic = false,
}: {
  images: string[];
  name: string;
  arabic?: boolean;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="seo-gallery">
      <Image unoptimized width={900} height={900} src={images[active]} alt={name} />
      {images.length > 1 && (
        <div className="seo-thumbnails" aria-label={arabic ? `صور ${name}` : `${name} images`}>
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              className={index === active ? "active" : ""}
              onClick={() => setActive(index)}
              aria-label={arabic ? `عرض صورة ${name} رقم ${index + 1}` : `Show ${name} image ${index + 1}`}
              aria-pressed={index === active}
            >
              <Image unoptimized width={180} height={180} src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
