import { useState } from "react";

interface CarrierLogoProps {
  src: string;
  name: string;
  className?: string;
}

export function CarrierLogo({ src, name, className = "h-full w-full" }: CarrierLogoProps) {
  const [hasError, setHasError] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (hasError) {
    return (
      <span
        aria-label={`Logo ${name}`}
        className={`${className} flex items-center justify-center rounded bg-primary/10 text-[10px] font-black text-primary`}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={`${className} object-contain`}
      onError={() => setHasError(true)}
    />
  );
}
