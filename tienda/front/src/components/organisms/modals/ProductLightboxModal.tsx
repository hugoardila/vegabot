import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, ModalContent, ModalBody, ModalHeader } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Product } from "../../../types";
import { formatPrice } from "../../../utils/format";
import { getPromotionPercent, getRetailPrice, getWholesalePrice } from "../../../utils/pricing";
import { CartIcon, StarIcon } from "../../atoms/icons";
import { WholesalePriceCard } from "../../molecules/WholesalePriceCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const API_BASE = API_URL.replace("/api", "");

interface ProductLightboxModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedProduct: Product | null;
  onAddToCart: (product: Product) => void;
  onOpenReviews?: (product: Product) => void;
}

export const ProductLightboxModal: React.FC<ProductLightboxModalProps> = ({
  isOpen,
  onOpenChange,
  selectedProduct,
  onAddToCart,
  onOpenReviews,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const [isPinching, setIsPinching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDistanceRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchJustEndedRef = useRef(false);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const resolvedImages = useMemo(() => {
    if (
      !selectedProduct?.images ||
      selectedProduct.images.length === 0 ||
      (selectedProduct.images.length === 1 && selectedProduct.images[0] === "")
    ) {
      return ["https://placehold.co/600x600?text=Sin+Imagen"];
    }
    return selectedProduct.images.map((img) => (img.startsWith("/") ? API_BASE + img : img));
  }, [selectedProduct]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setActiveImageIndex(0);
      setZoomLevel(1);
      setZoomOrigin("50% 50%");
      setIsPinching(false);
      setIsPanning(false);
      touchPointsRef.current.clear();
      pinchJustEndedRef.current = false;
      panStateRef.current = null;
      const frame = window.requestAnimationFrame(() => {
        modalBodyRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [isOpen, selectedProduct?.id]);

  const handleAddToCart = () => {
    if (!selectedProduct || selectedProduct.stock < 1) return;
    for (let i = 0; i < quantity; i += 1) {
      onAddToCart(selectedProduct);
    }
  };

  if (!selectedProduct) return null;

  const activeImage = resolvedImages[activeImageIndex] || resolvedImages[0];
  const hasMultipleImages = resolvedImages.length > 1;
  const activeMediaIsVideo = activeImage.match(/\.(mp4|webm|mov)$/i);
  const promotionPercent = getPromotionPercent(selectedProduct);
  const retailBasePrice = Number(selectedProduct.price_2 ?? selectedProduct.price ?? 0);
  const wholesalePrice = getWholesalePrice(selectedProduct);
  const retailPrice = getRetailPrice(selectedProduct);

  const resetZoom = () => {
    setZoomLevel(1);
    setZoomOrigin("50% 50%");
    setIsPinching(false);
    setIsPanning(false);
    touchPointsRef.current.clear();
    pinchStartDistanceRef.current = 0;
    pinchJustEndedRef.current = false;
    panStateRef.current = null;
  };

  const getZoomOriginValues = () => {
    const values = zoomOrigin.split(" ").map((value) => Number.parseFloat(value));
    return {
      x: Number.isFinite(values[0]) ? values[0] : 50,
      y: Number.isFinite(values[1]) ? values[1] : 50,
    };
  };

  const getTouchDistance = () => {
    const points = Array.from(touchPointsRef.current.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  };

  const updateTouchOrigin = (element: HTMLButtonElement) => {
    const points = Array.from(touchPointsRef.current.values());
    if (points.length < 2) return;
    const bounds = element.getBoundingClientRect();
    const midpointX = (points[0].x + points[1].x) / 2;
    const midpointY = (points[0].y + points[1].y) / 2;
    const x = Math.min(100, Math.max(0, ((midpointX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((midpointY - bounds.top) / bounds.height) * 100));
    setZoomOrigin(`${x}% ${y}%`);
  };

  const handleImagePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (touchPointsRef.current.size === 1 && zoomLevel > 1) {
      const origin = getZoomOriginValues();
      panStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: origin.x,
        originY: origin.y,
        moved: false,
      };
      setIsPanning(true);
    }

    if (touchPointsRef.current.size === 2) {
      panStateRef.current = null;
      setIsPanning(false);
      pinchStartDistanceRef.current = getTouchDistance();
      pinchStartZoomRef.current = zoomLevel;
      pinchJustEndedRef.current = false;
      setIsPinching(true);
      updateTouchOrigin(event.currentTarget);
    }
  };

  const handleImagePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch" || !touchPointsRef.current.has(event.pointerId)) return;
    touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (
      touchPointsRef.current.size === 1 &&
      zoomLevel > 1 &&
      panStateRef.current?.pointerId === event.pointerId
    ) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const deltaX = event.clientX - panStateRef.current.startX;
      const deltaY = event.clientY - panStateRef.current.startY;
      const zoomRange = Math.max(0.1, zoomLevel - 1);
      const nextX = Math.min(
        100,
        Math.max(0, panStateRef.current.originX - (deltaX / bounds.width / zoomRange) * 100),
      );
      const nextY = Math.min(
        100,
        Math.max(0, panStateRef.current.originY - (deltaY / bounds.height / zoomRange) * 100),
      );
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        panStateRef.current.moved = true;
      }
      setZoomOrigin(`${nextX}% ${nextY}%`);
      return;
    }

    if (touchPointsRef.current.size < 2 || pinchStartDistanceRef.current <= 0) return;
    event.preventDefault();
    const nextDistance = getTouchDistance();
    const nextZoom = Math.min(
      6,
      Math.max(1, pinchStartZoomRef.current * (nextDistance / pinchStartDistanceRef.current)),
    );
    updateTouchOrigin(event.currentTarget);
    setZoomLevel(nextZoom);
  };

  const handleImagePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;
    const wasPinching = touchPointsRef.current.size >= 2 || isPinching;
    const completedPan = panStateRef.current?.pointerId === event.pointerId
      ? panStateRef.current
      : null;
    touchPointsRef.current.delete(event.pointerId);
    panStateRef.current = null;
    setIsPanning(false);

    if (completedPan?.moved) {
      pinchJustEndedRef.current = true;
    }

    if (wasPinching) {
      pinchJustEndedRef.current = true;
      setIsPinching(false);
    }

    if (touchPointsRef.current.size < 2) {
      pinchStartDistanceRef.current = 0;
    }

    if (wasPinching && touchPointsRef.current.size === 1 && zoomLevel > 1) {
      const [remainingPointer] = Array.from(touchPointsRef.current.entries());
      const origin = getZoomOriginValues();
      panStateRef.current = {
        pointerId: remainingPointer[0],
        startX: remainingPointer[1].x,
        startY: remainingPointer[1].y,
        originX: origin.x,
        originY: origin.y,
        moved: false,
      };
      setIsPanning(true);
    }
  };

  return (
    <>
      <Modal
        backdrop="blur"
          className="bg-white dark:bg-[#0d0d0d] border border-black/10 dark:border-white/10"
          classNames={{
            backdrop: "top-[105px] h-[calc(100dvh-105px)] lg:top-0 lg:h-full",
            wrapper: "top-[105px] h-[calc(100dvh-105px)] lg:top-0 lg:h-full",
            base: "max-h-[calc(100dvh-129px)] max-w-[1180px] lg:max-h-[calc(100vh-2rem)]",
            body: "p-0",
          }}
        isOpen={isOpen}
        placement="center"
        scrollBehavior="inside"
        size="5xl"
        onOpenChange={(open) => {
          if (!open) resetZoom();
          onOpenChange(open);
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
            <ModalHeader className="px-4 lg:px-6 py-4 border-b border-black/5 dark:border-white/5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
                  Vista rapida
                </p>
                <h2 className="text-lg lg:text-2xl font-black text-black dark:text-white truncate">
                  {selectedProduct.name}
                </h2>
                {selectedProduct.saint_name && (
                  <p className="truncate text-[10px] text-black/45 dark:text-white/45">
                    Ref: <span className="font-semibold">{selectedProduct.saint_name}</span>
                  </p>
                )}
              </div>
            </ModalHeader>

            <ModalBody ref={modalBodyRef}>
              <div className="w-full px-4 lg:px-6 py-5 lg:py-6">
                <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-10">
                  <div className="flex flex-col-reverse lg:flex-row gap-3 lg:w-[55%] flex-shrink-0">
                    {hasMultipleImages && (
                      <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-hidden pb-2 lg:pb-0">
                        {resolvedImages.map((img, i) => (
                          <button
                            key={img + i}
                            className={`flex-shrink-0 w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                              i === activeImageIndex
                                ? "border-primary ring-2 ring-primary/20 scale-105"
                                : "border-black/10 dark:border-white/10 hover:border-primary/40 opacity-60 hover:opacity-100"
                            }`}
                            type="button"
                            onClick={() => {
                              setActiveImageIndex(i);
                              resetZoom();
                            }}
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

                    <div className="relative flex-1 bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden aspect-square lg:min-h-[520px] group">
                      <div className="absolute inset-0 hidden lg:block">
                        {activeImage.match(/\.(mp4|webm|mov)$/i) ? (
                          <video
                            src={activeImage}
                            className="w-full h-full object-cover blur-3xl scale-125 saturate-150 opacity-30"
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <img
                            src={activeImage}
                            alt=""
                            className="w-full h-full object-cover blur-3xl scale-125 saturate-150 opacity-30"
                          />
                        )}
                      </div>

                      {activeMediaIsVideo ? (
                        <video
                          src={activeImage}
                          className="relative z-10 w-full h-full object-contain p-4"
                          autoPlay
                          muted
                          loop
                          playsInline
                          controls
                        />
                      ) : (
                        <button
                          aria-label={
                            zoomLevel === 1
                              ? `Ampliar imagen de ${selectedProduct.name}`
                              : `Cambiar zoom de ${selectedProduct.name}`
                          }
                          className={`relative z-10 h-full w-full overflow-hidden ${
                            zoomLevel === 1 ? "cursor-zoom-in" : "cursor-crosshair"
                          }`}
                          style={{ touchAction: zoomLevel > 1 ? "none" : "pan-y" }}
                          title={zoomLevel === 1 ? "Haz clic para ampliar" : "Mueve el cursor para explorar"}
                          type="button"
                          onClick={() => {
                            if (pinchJustEndedRef.current) {
                              pinchJustEndedRef.current = false;
                              return;
                            }
                            setZoomLevel((current) => (current >= 6 ? 1 : current + 1));
                          }}
                          onPointerDown={handleImagePointerDown}
                          onPointerMove={handleImagePointerMove}
                          onPointerUp={handleImagePointerEnd}
                          onPointerCancel={handleImagePointerEnd}
                          onMouseMove={(event) => {
                            if (zoomLevel === 1) return;
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                            const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                            setZoomOrigin(`${x}% ${y}%`);
                          }}
                          onMouseLeave={() => setZoomOrigin("50% 50%")}
                        >
                          <img
                            src={activeImage}
                            alt={selectedProduct.name}
                            className={`h-full w-full select-none object-contain object-top p-4 ${
                              isPinching || isPanning ? "transition-none" : "transition-transform duration-200"
                            }`}
                            draggable={false}
                            style={{
                              transform: `scale(${zoomLevel})`,
                              transformOrigin: zoomOrigin,
                            }}
                          />
                        </button>
                      )}

                      {!activeMediaIsVideo && (
                        <div className="absolute right-3 top-3 z-30 flex items-center gap-0.5 rounded-full bg-black/80 p-1 text-white shadow-xl backdrop-blur-md">
                          <button
                            aria-label="Alejar imagen"
                            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                            disabled={zoomLevel <= 1}
                            title="Alejar"
                            type="button"
                            onClick={() => setZoomLevel((current) => Math.max(1, current - 0.5))}
                          >
                            <ZoomOut aria-hidden="true" size={17} />
                          </button>
                          <span className="w-11 text-center text-[11px] font-bold tabular-nums">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button
                            aria-label="Acercar imagen"
                            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                            disabled={zoomLevel >= 6}
                            title="Acercar"
                            type="button"
                            onClick={() => setZoomLevel((current) => Math.min(6, current + 0.5))}
                          >
                            <ZoomIn aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label="Restablecer zoom"
                            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                            disabled={zoomLevel === 1}
                            title="Restablecer"
                            type="button"
                            onClick={resetZoom}
                          >
                            <RotateCcw aria-hidden="true" size={16} />
                          </button>
                        </div>
                      )}

                      <div className="pointer-events-none absolute left-3 top-3 z-30">
                        <Chip
                          className="font-black shadow-md backdrop-blur-md"
                          color={
                            selectedProduct.stock === 1
                              ? "danger"
                              : selectedProduct.stock > 1
                                ? "success"
                                : "danger"
                          }
                          size="sm"
                          variant="solid"
                        >
                          {selectedProduct.stock === 1
                            ? "Último disponible"
                            : selectedProduct.stock > 1
                              ? `${selectedProduct.stock} disponibles`
                              : "Agotado"}
                        </Chip>
                      </div>

                      {hasMultipleImages && (
                        <>
                          <div className="absolute bottom-3 right-3 z-20 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                            {activeImageIndex + 1} / {resolvedImages.length}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-between px-3 z-20 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity pointer-events-none">
                            <button
                              className="pointer-events-auto w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
                              type="button"
                              onClick={() => {
                                setActiveImageIndex((prev) => (prev - 1 + resolvedImages.length) % resolvedImages.length);
                                resetZoom();
                              }}
                            >
                              {"<"}
                            </button>
                            <button
                              className="pointer-events-auto w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
                              type="button"
                              onClick={() => {
                                setActiveImageIndex((prev) => (prev + 1) % resolvedImages.length);
                                resetZoom();
                              }}
                            >
                              {">"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-5">
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-black dark:text-white leading-tight">
                        {selectedProduct.name}
                      </h1>
                      {selectedProduct.saint_name && (
                        <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                          Ref: <span className="font-semibold">{selectedProduct.saint_name}</span>
                        </p>
                      )}

                      {(selectedProduct.free_shipping || promotionPercent > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                          {selectedProduct.free_shipping && (
                            <span className="rounded-md bg-success/10 px-2 py-1 text-success">Envio gratis</span>
                          )}
                          {promotionPercent > 0 && (
                            <span className="rounded-md bg-danger/10 px-2 py-1 text-danger">
                              En promocion -{formatPrice(promotionPercent)}%
                            </span>
                          )}
                        </div>
                      )}

                      {onOpenReviews && (
                        <button
                          className="flex items-center gap-1.5 mt-2 text-xs text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer"
                          type="button"
                          onClick={() => onOpenReviews(selectedProduct)}
                        >
                          <StarIcon size={14} filled />
                          <span className="font-bold underline underline-offset-2">Ver reseñas y calificaciones</span>
                        </button>
                      )}
                    </div>

                    {selectedProduct.description && (
                      <div className="mt-2 p-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-3">
                          Descripción del producto
                        </h3>
                        <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed whitespace-pre-line">
                          {selectedProduct.description}
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-black/5 bg-black/[0.03] p-5 dark:border-white/5 dark:bg-white/[0.03]">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-black/45 dark:text-white/45">
                        Existencias
                      </p>
                      <p className={`text-3xl font-extrabold ${selectedProduct.stock > 0 ? "text-success" : "text-danger"}`}>
                        {selectedProduct.stock}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Chip
                          size="sm"
                          variant="flat"
                          className="font-bold text-[10px] uppercase tracking-widest"
                          color={selectedProduct.stock > 0 ? "success" : "danger"}
                          startContent={
                            <div className={`size-1.5 rounded-full animate-pulse ${selectedProduct.stock > 0 ? "bg-success" : "bg-danger"}`} />
                          }
                        >
                          {selectedProduct.stock === 1
                            ? "Último disponible"
                            : selectedProduct.stock > 1
                              ? "Disponible"
                              : "Agotado"}
                        </Chip>
                        {selectedProduct.stock <= 0 && (
                          <span className="text-sm font-black text-danger">
                            Próximo en llegar
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mx-auto grid w-full max-w-[250px] grid-cols-2 gap-2">
                      <WholesalePriceCard
                        price={wholesalePrice}
                        productName={selectedProduct.name}
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

                    {selectedProduct.category_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-black/40 dark:text-white/40 font-bold uppercase tracking-wider">
                          Categoría:
                        </span>
                        <Chip size="sm" variant="flat" color="primary" className="font-bold text-[10px] uppercase tracking-widest">
                          {selectedProduct.category_name}
                        </Chip>
                      </div>
                    )}

                    {selectedProduct.stock > 0 && (
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-black/50 dark:text-white/50 font-bold uppercase tracking-wider">
                          Cant.
                        </span>
                        <div className="flex items-center gap-0 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
                          <button
                            className="w-10 h-10 flex items-center justify-center text-lg font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            disabled={quantity <= 1}
                            type="button"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          >
                            -
                          </button>
                          <span className="w-12 h-10 flex items-center justify-center text-sm font-bold border-x border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                            {quantity}
                          </span>
                          <button
                            className="w-10 h-10 flex items-center justify-center text-lg font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            disabled={quantity >= selectedProduct.stock}
                            type="button"
                            onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[10px] text-black/40 dark:text-white/40">
                          ({selectedProduct.stock} disponibles)
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 py-3 border-y border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-success">OK</span>
                        <span className="font-bold text-black/70 dark:text-white/70">
                          {selectedProduct.free_shipping ? "Envío gratis" : "Envío disponible"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-success">OK</span>
                        <span className="font-bold text-black/70 dark:text-white/70">Garantía incluida</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-1">
                      <Button
                        className="flex-grow bg-primary text-white font-bold py-7 rounded-2xl text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-primary/90 transition-all disabled:opacity-50"
                        isDisabled={selectedProduct.stock <= 0}
                        onClick={handleAddToCart}
                        startContent={<CartIcon size={20} />}
                      >
                        {selectedProduct.stock <= 0 ? "Agotado · Próximo en llegar" : "Añadir al carrito"}
                      </Button>
                      <Button
                        className="bg-black/5 dark:bg-white/5 font-bold py-7 px-6 rounded-2xl text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        onClick={onClose}
                      >
                        Catálogo
                      </Button>
                    </div>

                    {(selectedProduct as any)?.sku && (
                      <div className="flex items-center gap-2 text-xs text-black/30 dark:text-white/30">
                        <span className="font-bold uppercase tracking-wider">SKU:</span>
                        <span className="font-mono">{(selectedProduct as any).sku}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
