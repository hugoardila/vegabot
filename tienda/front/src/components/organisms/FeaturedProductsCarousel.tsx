import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Sparkles, Tag, X } from "lucide-react";
import { ProductImageSlider } from "../molecules/ProductImageSlider";
import { CartIcon } from "../atoms/icons";
import { CartItem, Product } from "../../types";
import { formatPrice } from "../../utils/format";
import { getPromotionPercent, getRetailPrice } from "../../utils/pricing";
import { adminService } from "../../services/admin";

interface FeaturedProductsCarouselProps {
  products: Product[];
  cart: CartItem[];
  addToCart: (product: Product) => void;
  handleViewProduct: (product: Product) => void;
  isAdmin?: boolean;
  token?: string | null;
}

const DEFAULT_FEATURED_TITLE = "Promociones y envíos gratis";
const FEATURED_TITLE_SETTING = "featured_products_title";

const FEATURED_PALETTES = [
  {
    card: "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30",
    media: "bg-amber-100/80 dark:bg-amber-900/25",
    chip: "bg-amber-200/80 text-amber-950 dark:bg-amber-800/60 dark:text-amber-100",
    accent: "bg-amber-400",
  },
  {
    card: "border-cyan-200 bg-cyan-50 dark:border-cyan-800/50 dark:bg-cyan-950/30",
    media: "bg-cyan-100/80 dark:bg-cyan-900/25",
    chip: "bg-cyan-200/80 text-cyan-950 dark:bg-cyan-800/60 dark:text-cyan-100",
    accent: "bg-cyan-500",
  },
  {
    card: "border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30",
    media: "bg-rose-100/80 dark:bg-rose-900/25",
    chip: "bg-rose-200/80 text-rose-950 dark:bg-rose-800/60 dark:text-rose-100",
    accent: "bg-rose-500",
  },
  {
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30",
    media: "bg-emerald-100/80 dark:bg-emerald-900/25",
    chip: "bg-emerald-200/80 text-emerald-950 dark:bg-emerald-800/60 dark:text-emerald-100",
    accent: "bg-emerald-500",
  },
  {
    card: "border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30",
    media: "bg-orange-100/80 dark:bg-orange-900/25",
    chip: "bg-orange-200/80 text-orange-950 dark:bg-orange-800/60 dark:text-orange-100",
    accent: "bg-orange-500",
  },
  {
    card: "border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/30",
    media: "bg-blue-100/80 dark:bg-blue-900/25",
    chip: "bg-blue-200/80 text-blue-950 dark:bg-blue-800/60 dark:text-blue-100",
    accent: "bg-blue-500",
  },
] as const;

const getProductPalette = (product: Product) => {
  const paletteKey = `${product.id}-${product.category_name || "featured"}`;
  const hash = Array.from(paletteKey).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

  return FEATURED_PALETTES[hash % FEATURED_PALETTES.length];
};

export const FeaturedProductsCarousel: React.FC<FeaturedProductsCarouselProps> = ({
  products,
  cart,
  addToCart,
  handleViewProduct,
  isAdmin = false,
  token,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [sectionTitle, setSectionTitle] = useState(DEFAULT_FEATURED_TITLE);
  const [draftTitle, setDraftTitle] = useState(DEFAULT_FEATURED_TITLE);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState("");

  const featuredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.enabled !== false &&
          product.stock > 0 &&
          (product.free_shipping || getPromotionPercent(product) > 0),
      ),
    [products],
  );

  useEffect(() => {
    let active = true;

    adminService
      .getSettings()
      .then((settings) => {
        if (!active) return;
        const configuredTitle = String(settings?.[FEATURED_TITLE_SETTING] || "").trim();
        const nextTitle = configuredTitle || DEFAULT_FEATURED_TITLE;
        setSectionTitle(nextTitle);
        setDraftTitle(nextTitle);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const openTitleEditor = () => {
    setDraftTitle(sectionTitle);
    setTitleError("");
    setIsEditingTitle(true);
    setIsPaused(true);
  };

  const cancelTitleEditor = () => {
    setDraftTitle(sectionTitle);
    setTitleError("");
    setIsEditingTitle(false);
    setIsPaused(false);
  };

  const saveSectionTitle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = draftTitle.trim().replace(/\s+/g, " ");

    if (!normalizedTitle) {
      setTitleError("Escribe un título para esta sección.");
      return;
    }
    if (!token) {
      setTitleError("Tu sesión de administrador expiró. Inicia sesión nuevamente.");
      return;
    }

    setIsSavingTitle(true);
    setTitleError("");
    try {
      await adminService.updateSettings({ [FEATURED_TITLE_SETTING]: normalizedTitle }, token);
      setSectionTitle(normalizedTitle);
      setDraftTitle(normalizedTitle);
      setIsEditingTitle(false);
      setIsPaused(false);
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : "No fue posible guardar el título.");
    } finally {
      setIsSavingTitle(false);
    }
  };

  const goTo = (index: number) => {
    if (!trackRef.current || featuredProducts.length === 0) return;

    const nextIndex = (index + featuredProducts.length) % featuredProducts.length;
    const target = trackRef.current.children.item(nextIndex) as HTMLElement | null;

    if (target) {
      trackRef.current.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
    }
    setActiveIndex(nextIndex);
  };

  useEffect(() => {
    if (featuredProducts.length < 2 || isPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => goTo(activeIndex + 1), 4500);
    return () => window.clearInterval(timer);
  }, [activeIndex, featuredProducts.length, isPaused]);

  useEffect(() => {
    if (activeIndex >= featuredProducts.length) setActiveIndex(0);
  }, [activeIndex, featuredProducts.length]);

  if (featuredProducts.length === 0) return null;

  return (
    <section
      aria-label={sectionTitle}
      className="mt-5 border-y border-black/5 py-3 dark:border-white/10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isEditingTitle ? (
            <form className="flex min-w-0 items-center gap-1" onSubmit={saveSectionTitle}>
              <input
                autoFocus
                aria-label="Título del carrusel de promociones"
                className="h-8 min-w-0 flex-1 rounded-md border border-primary/30 bg-white px-2 text-xs font-bold text-black outline-none ring-primary/20 focus:ring-2 dark:bg-black dark:text-white"
                disabled={isSavingTitle}
                maxLength={80}
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  if (titleError) setTitleError("");
                }}
              />
              <button
                aria-label="Guardar título"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success text-white transition-colors hover:bg-success/90 disabled:cursor-wait disabled:opacity-60"
                disabled={isSavingTitle}
                title="Guardar"
                type="submit"
              >
                {isSavingTitle ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}
              </button>
              <button
                aria-label="Cancelar edición"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white text-black/60 transition-colors hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                disabled={isSavingTitle}
                title="Cancelar"
                type="button"
                onClick={cancelTitleEditor}
              >
                <X size={15} />
              </button>
            </form>
          ) : (
            <div className="flex min-w-0 items-start gap-1.5">
              <h2 className="flex min-w-0 items-start gap-1.5 text-sm font-black text-black/80 dark:text-white/85">
                <Sparkles className="mt-0.5 shrink-0 text-amber-500" size={16} />
                <span className="break-words">{sectionTitle}</span>
              </h2>
              {isAdmin && (
                <button
                  aria-label="Editar título de promociones"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-black/45 transition-colors hover:bg-primary/10 hover:text-primary dark:text-white/55"
                  title="Editar título"
                  type="button"
                  onClick={openTitleEditor}
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
          {titleError && <p className="mt-1 text-[10px] font-semibold text-danger">{titleError}</p>}
        </div>

        {featuredProducts.length > 1 && (
          <div className="flex shrink-0 gap-1">
            <button
              aria-label="Producto anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-black/65 transition-colors hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/70"
              title="Anterior"
              type="button"
              onClick={() => goTo(activeIndex - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              aria-label="Producto siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-black/65 transition-colors hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/70"
              title="Siguiente"
              type="button"
              onClick={() => goTo(activeIndex + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {featuredProducts.map((product) => {
          const promotionPercent = getPromotionPercent(product);
          const retailPrice = getRetailPrice(product);
          const cartQuantity = cart.find((item) => item.product.id === product.id)?.quantity || 0;
          const cannotAdd = cartQuantity >= product.stock;
          const palette = getProductPalette(product);

          return (
            <article
              key={product.id}
              className={`group relative flex w-full shrink-0 snap-start cursor-pointer overflow-hidden rounded-md border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[230px] ${palette.card}`}
              role="button"
              tabIndex={0}
              onClick={() => handleViewProduct(product)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleViewProduct(product);
              }}
            >
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 z-10 h-1 ${palette.accent}`} />

              <div className={`relative h-[124px] w-[42%] max-w-[150px] shrink-0 overflow-hidden border-r border-black/5 pt-1 dark:border-white/10 sm:h-[104px] sm:w-[96px] ${palette.media}`}>
                <ProductImageSlider images={product.images} showControls={false} />
                <span
                  className={`absolute bottom-1 left-1 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded px-1.5 py-1 text-[9px] font-black uppercase leading-none shadow-sm ${palette.chip}`}
                  title={product.category_name || "Producto destacado"}
                >
                  <Tag aria-hidden="true" className="shrink-0" size={10} />
                  <span className="truncate">{product.category_name || "Destacados"}</span>
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-2">
                <div className="mb-1 flex flex-wrap gap-1 text-[9px] font-black leading-none">
                  {promotionPercent > 0 && (
                    <span className="rounded bg-danger px-1.5 py-1 text-white shadow-sm">
                      -{formatPrice(promotionPercent)}%
                    </span>
                  )}
                  {product.free_shipping && (
                    <span className="rounded bg-success px-1.5 py-1 text-white shadow-sm">
                      Envío gratis
                    </span>
                  )}
                </div>

                <h3 className="line-clamp-2 min-h-8 text-xs font-bold leading-4 text-black/80 dark:text-white/85 sm:text-[11px]">
                  {product.name}
                </h3>

                <div className="mt-auto flex items-end justify-between gap-1">
                  <span className="truncate text-sm font-black text-primary">
                    {retailPrice > 0 ? `$${formatPrice(retailPrice)}` : "Consultar"}
                  </span>
                  <button
                    aria-label={`Agregar ${product.name} al carrito`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={cannotAdd}
                    title={cannotAdd ? "Límite de existencias alcanzado" : "Agregar al carrito"}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!cannotAdd) addToCart(product);
                    }}
                  >
                    <CartIcon size={13} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
