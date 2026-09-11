import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Product } from "../types";
import { formatPrice } from "../utils/format";
import { getPromotionPercent, getRetailPrice, getWholesalePrice } from "../utils/pricing";
import { addToast } from "@heroui/toast";
import { ArrowLeftIcon, CartIcon, StarIcon } from "../components/atoms/icons";
import { useApp } from "../context/AppContext";
import { ProductReviews } from "../components/organisms/ProductReviews";
import { WholesalePriceCard } from "../components/molecules/WholesalePriceCard";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const API_BASE = API_URL.replace("/api", "");

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSelectedReviewsProduct, addToCart: addToCartContext } = useApp();
  const { token } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const fetchProduct = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/products/${encodeURIComponent(id as string)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Producto no encontrado");
      const data = await res.json();
      setProduct(data);
    } catch (error) {
      console.error(error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // Resolve image URLs
  const resolvedImages = useMemo(() => {
    if (!product?.images || product.images.length === 0 || (product.images.length === 1 && product.images[0] === "")) {
      return ["https://placehold.co/600x600?text=Sin+Imagen"];
    }
    return product.images.map((img) => (img.startsWith("/") ? API_BASE + img : img));
  }, [product]);

  const addToCart = () => {
    if (!product) return;
    setIsAdding(true);

    if (product.stock < 1) {
      addToast({
        title: "Agotado",
        description: "Lo sentimos, este producto se encuentra sin stock.",
        color: "danger",
      });
      setIsAdding(false);
      return;
    }

    // Add quantity times using context (keeps React state in sync)
    for (let i = 0; i < quantity; i++) {
      addToCartContext(product);
    }

    addToast({
      title: "¡Agregado!",
      description: `${quantity}x ${product.name} agregado al carrito.`,
      color: "success",
    });

    setTimeout(() => {
      setIsAdding(false);
    }, 500);
  };

  useEffect(() => {
    fetchProduct();
    setActiveImageIndex(0);
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-black/50 dark:text-white/50 text-sm font-bold animate-pulse">
            Cargando producto...
          </p>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const promotionPercent = getPromotionPercent(product);
  const retailBasePrice = Number(product.price_2 ?? product.price ?? 0);
  const wholesalePrice = getWholesalePrice(product);
  const retailPrice = getRetailPrice(product);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* ── Breadcrumb / Volver ────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/")}
        className="w-fit mb-5 bg-black/5 dark:bg-white/5 text-black/80 dark:text-white/80 text-xs font-bold px-4 py-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
      >
        <ArrowLeftIcon size={14} />
        Volver
      </button>

      {/* ── Main content: Images + Info ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT: Image Gallery (Temu-style)
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col-reverse lg:flex-row gap-3 lg:w-[55%] flex-shrink-0">
          {/* Thumbnail strip (vertical on desktop, horizontal on mobile) */}
          {resolvedImages.length > 1 && (
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-hidden pb-2 lg:pb-0 scrollbar-hide">
              {resolvedImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`flex-shrink-0 w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                    i === activeImageIndex
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-black/10 dark:border-white/10 hover:border-primary/40 opacity-60 hover:opacity-100"
                  }`}
                >
                  {img.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={img} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={img} alt={`Vista ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Main image viewer */}
          <div className="relative flex-1 bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden aspect-square lg:aspect-auto group">
            {/* Blurred background layer */}
            <div className="absolute inset-0 hidden lg:block">
              {resolvedImages[activeImageIndex]?.match(/\.(mp4|webm|mov)$/i) ? (
                <video
                  src={resolvedImages[activeImageIndex]}
                  className="w-full h-full object-cover blur-3xl scale-125 saturate-150 opacity-30"
                  autoPlay muted loop playsInline
                />
              ) : (
                <img
                  src={resolvedImages[activeImageIndex]}
                  alt=""
                  className="w-full h-full object-cover blur-3xl scale-125 saturate-150 opacity-30"
                />
              )}
            </div>

            {/* Foreground image */}
            {resolvedImages[activeImageIndex]?.match(/\.(mp4|webm|mov)$/i) ? (
              <video
                src={resolvedImages[activeImageIndex]}
                className="relative z-10 w-full h-full object-contain p-4"
                autoPlay muted loop playsInline controls
              />
            ) : (
              <img
                src={resolvedImages[activeImageIndex]}
                alt={product.name}
                className="relative z-10 w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              />
            )}

            {/* Image counter badge */}
            {resolvedImages.length > 1 && (
              <div className="absolute bottom-3 right-3 z-20 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                {activeImageIndex + 1} / {resolvedImages.length}
              </div>
            )}

            {/* Navigation arrows for mobile */}
            {resolvedImages.length > 1 && (
              <div className="absolute inset-0 flex items-center justify-between px-3 z-20 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity pointer-events-none">
                <button
                  onClick={() => setActiveImageIndex((prev) => (prev - 1 + resolvedImages.length) % resolvedImages.length)}
                  className="pointer-events-auto w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
                >
                  ‹
                </button>
                <button
                  onClick={() => setActiveImageIndex((prev) => (prev + 1) % resolvedImages.length)}
                  className="pointer-events-auto w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT: Product Information Panel
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col gap-5">
          {/* Product name */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-black dark:text-white leading-tight">
              {product.name}
            </h1>
            {product.saint_name && (
              <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                Ref: <span className="font-semibold">{product.saint_name}</span>
              </p>
            )}

            {(product.free_shipping || promotionPercent > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                {product.free_shipping && (
                  <span className="rounded-md bg-success/10 px-2 py-1 text-success">Envío gratis</span>
                )}
                {promotionPercent > 0 && (
                  <span className="rounded-md bg-danger/10 px-2 py-1 text-danger">
                    En promoción -{formatPrice(promotionPercent)}%
                  </span>
                )}
              </div>
            )}

            {/* Reviews link */}
            <button
              className="flex items-center gap-1.5 mt-2 text-xs text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer"
              onClick={() => setSelectedReviewsProduct(product)}
            >
              <StarIcon size={14} filled />
              <span className="font-bold underline underline-offset-2">Ver reseñas y calificaciones</span>
            </button>
          </div>

          {/* ── Description ──────────────────────────────────────────────── */}
          {product.description && (
            <div className="mt-2 p-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-3 flex items-center gap-2">
                📝 Descripción del producto
              </h3>
              <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* ── Price Block ──────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-black/5 bg-black/[0.03] p-5 dark:border-white/5 dark:bg-white/[0.03]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-black/45 dark:text-white/45">
              Existencias
            </p>
            <p className={`text-3xl font-extrabold ${product.stock > 0 ? "text-success" : "text-danger"}`}>
              {product.stock}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Chip
                size="sm"
                variant="flat"
                className="font-bold text-[10px] uppercase tracking-widest"
                color={product.stock > 0 ? "success" : "danger"}
                startContent={
                  <div className={`size-1.5 rounded-full animate-pulse ${product.stock > 0 ? "bg-success" : "bg-danger"}`} />
                }
              >
                {product.stock === 1
                  ? "Último disponible"
                  : product.stock > 1
                    ? "Disponible"
                    : "Agotado"}
              </Chip>
              {product.stock <= 0 && (
                <span className="text-sm font-black text-danger">
                  Próximo en llegar
                </span>
              )}
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[250px] grid-cols-2 gap-2">
            <WholesalePriceCard
              price={wholesalePrice}
              productName={product.name}
            />
            <div className="min-w-0 rounded-lg border border-primary/20 bg-primary/10 p-2 text-center shadow-sm shadow-primary/15 dark:bg-primary/15 dark:shadow-none">
              <p className="mb-0.5 text-[9px] font-bold text-primary/80 sm:text-[10px]">
                Precio detal
              </p>
              {promotionPercent > 0 && retailBasePrice > 0 && (
                <p className="text-[10px] text-primary/55 line-through">
                  ${formatPrice(retailBasePrice)}
                </p>
              )}
              <p className="break-words text-base font-extrabold leading-tight text-primary sm:text-xl">
                {retailPrice > 0
                  ? `$${formatPrice(retailPrice)}`
                  : "Por consultar"}
              </p>
            </div>
          </div>

          {/* ── Category ─────────────────────────────────────────────────── */}
          {product.category_name && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-black/40 dark:text-white/40 font-bold uppercase tracking-wider">
                Categoría:
              </span>
              <Chip size="sm" variant="flat" color="primary" className="font-bold text-[10px] uppercase tracking-widest">
                {product.category_name}
              </Chip>
            </div>
          )}

          {/* ── Quantity Selector ─────────────────────────────────────────── */}
          {product.stock > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-black/50 dark:text-white/50 font-bold uppercase tracking-wider">
                Cant.
              </span>
              <div className="flex items-center gap-0 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center text-lg font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  −
                </button>
                <span className="w-12 h-10 flex items-center justify-center text-sm font-bold border-x border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  className="w-10 h-10 flex items-center justify-center text-lg font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-black/40 dark:text-white/40">
                ({product.stock} disponibles)
              </span>
            </div>
          )}

          {/* ── Shipping / Info badges ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 py-3 border-y border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-success">✔</span>
              <span className="font-bold text-black/70 dark:text-white/70">
                {product.free_shipping ? "Envío gratis" : "Envío disponible"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-success">✔</span>
              <span className="font-bold text-black/70 dark:text-white/70">Garantía incluida</span>
            </div>
          </div>

          {/* ── Add to cart button ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 mt-1">
            <Button
              className="flex-grow bg-primary text-white font-bold py-7 rounded-2xl text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-primary/90 transition-all disabled:opacity-50"
              isDisabled={product.stock <= 0 || isAdding}
              isLoading={isAdding}
              onClick={addToCart}
              startContent={!isAdding && <CartIcon size={20} />}
            >
              {product.stock <= 0 ? "Agotado · Próximo en llegar" : "Añadir al carrito"}
            </Button>
            <Button
              className="bg-black/5 dark:bg-white/5 font-bold py-7 px-6 rounded-2xl text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              onClick={() => navigate("/")}
            >
              Catálogo
            </Button>
          </div>


          {/* ── SKU ──────────────────────────────────────────────────────── */}
          {(product as any)?.sku && (
            <div className="flex items-center gap-2 text-xs text-black/30 dark:text-white/30">
              <span className="font-bold uppercase tracking-wider">SKU:</span>
              <span className="font-mono">{(product as any).sku}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Product Reviews Section ────────────────────────────────────────── */}
      <div className="mt-10 bg-white dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 p-6 lg:p-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <StarIcon size={18} filled />
          Reseñas del producto
        </h3>
        <ProductReviews 
          productId={product.id} 
          hideForm={true} 
          onOpenModal={() => setSelectedReviewsProduct(product)} 
        />
      </div>
    </div>
  );
}
