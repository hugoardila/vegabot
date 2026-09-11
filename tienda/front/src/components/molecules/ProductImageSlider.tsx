import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "../atoms/icons";

export const ProductImageSlider = ({
  images: initialImages,
  showControls = true,
}: {
  images?: string[];
  showControls?: boolean;
}) => {
  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace("/api", "");
  
  const images = (!initialImages || initialImages.length === 0 || (initialImages.length === 1 && initialImages[0] === "")) 
    ? ["https://placehold.co/400x300?text=Sin+Imagen"] 
    : initialImages.map(img => img.startsWith("/") ? API_BASE + img : img);

  const [index, setIndex] = useState(0);

  const next = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setIndex((prev) => (prev + 1) % images.length);
  };

  const prev = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="relative w-full h-full overflow-hidden group/slider">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="absolute inset-0 w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Background Blurred Image Layer - Desktop Only */}
          <div className="hidden lg:block absolute inset-0 w-full h-full transform-gpu">
            {images[index].match(/\.(mp4|webm|mov)$/i) ? (
              <video
                className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 saturate-150 opacity-40 pointer-events-none"
                src={images[index]}
                autoPlay muted loop playsInline
              />
            ) : (
              <img
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 saturate-150 opacity-40 pointer-events-none"
                src={images[index]}
                decoding="async"
              />
            )}
          </div>
          {/* Foreground Uncropped Image Layer */}
          {images[index].match(/\.(mp4|webm|mov)$/i) ? (
            <video
              className="relative z-10 h-full w-full scale-[1.08] object-contain drop-shadow-2xl transform-gpu"
              src={images[index]}
              autoPlay muted loop playsInline controls
            />
          ) : (
            <img
              alt="product"
              className="pointer-events-none relative z-10 h-full w-full scale-[1.08] object-contain drop-shadow-2xl transform-gpu"
              src={images[index]}
              decoding="async"
              loading="lazy"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {images.length > 1 && (
        <>
          {showControls && (
            <div className="absolute inset-0 lg:opacity-0 lg:group-hover/slider:opacity-100 opacity-100 transition-opacity duration-300 pointer-events-none flex items-center justify-between px-2 z-20">
              <div
                className="pointer-events-auto bg-black/40 lg:bg-black/20 backdrop-blur-md hover:bg-black/60 text-white min-w-10 w-10 h-10 lg:min-w-8 lg:w-8 lg:h-8 rounded-full border border-white/20 flex items-center justify-center cursor-pointer transition-colors"
                role="button"
                tabIndex={0}
                onClick={(e) => prev(e)}
                onKeyDown={(e) => e.key === "Enter" && prev(e)}
              >
                <ChevronLeft size={20} />
              </div>
              <div
                className="pointer-events-auto bg-black/40 lg:bg-black/20 backdrop-blur-md hover:bg-black/60 text-white min-w-10 w-10 h-10 lg:min-w-8 lg:w-8 lg:h-8 rounded-full border border-white/20 flex items-center justify-center cursor-pointer transition-colors"
                role="button"
                tabIndex={0}
                onClick={(e) => next(e)}
                onKeyDown={(e) => e.key === "Enter" && next(e)}
              >
                <ChevronRight size={20} />
              </div>
            </div>
          )}

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
            {images.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 border border-black/10 ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
