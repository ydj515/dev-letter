"use client";

import Image from "next/image";
import { logos } from "@/constants";

const TechCarousel = () => {
  // Duplicate the icons for a seamless loop
  const duplicatedIcons = [...logos, ...logos];

  return (
    <div
      className="w-full max-w-4xl mx-auto overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0, black 128px, black calc(100% - 128px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 128px, black calc(100% - 128px), transparent 100%)",
      }}
    >
      <div className="flex w-max animate-scroll">
        {duplicatedIcons.map((icon, index) => (
          <div key={index} className="flex-shrink-0 px-4">
            <Image src={`${icon.src}`} alt={icon.alt} width={64} height={64} className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechCarousel;
