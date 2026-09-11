import React, { useEffect, useState, useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";
import { useAuth } from "../../context/AuthContext";
import { Product } from "../../types";
import { TrashIcon } from "../atoms/icons";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Review {
  id: number;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id?: string;
}

// ─── Star component ───────────────────────────────────────────────────────────
const Star = ({
  filled,
  half = false,
  size = 18,
}: {
  filled: boolean;
  half?: boolean;
  size?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={
      filled || half ? "text-yellow-400" : "text-black/15 dark:text-white/15"
    }
  >
    {half ? (
      <>
        <defs>
          <linearGradient id="half-fill">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          fill="url(#half-fill)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
        />
      </>
    ) : (
      <path
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
      />
    )}
  </svg>
);

// Render 5 stars based on a numeric rating (supports .5 halves)
const StarRow = ({ rating, size = 18 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        filled={i <= Math.floor(rating)}
        half={i === Math.ceil(rating) && rating % 1 >= 0.5}
      />
    ))}
  </div>
);

// Distribution bar for a single rating level (e.g. how many 5-star reviews)
const RatingBar = ({
  count,
  total,
  level,
}: {
  count: number;
  total: number;
  level: number;
}) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[11px] text-black/50 dark:text-white/50">
      <span className="w-4 text-right font-semibold">{level}</span>
      <Star size={11} filled />
      <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-yellow-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-5">{count}</span>
    </div>
  );
};

// ─── Main Reviews Component ───────────────────────────────────────────────────
export const ProductReviews: React.FC<{ 
  productId: string; 
  hideForm?: boolean; 
  hideReviews?: boolean;
  onOpenModal?: () => void;
  onCloseModal?: () => void;
}> = ({
  productId,
  hideForm = false,
  hideReviews = false,
  onOpenModal,
  onCloseModal,
}) => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewToDelete, setReviewToDelete] = useState<number | null>(null);
  const ITEMS_PER_PAGE = 10;

  // Form state
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/products/${encodeURIComponent(productId)}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
        
        // Auto-fill if user already has a review
        if (user) {
          const myReview = data.find((r: Review) => r.user_id === user.id);
          if (myReview) {
            setRating(myReview.rating);
            setComment(myReview.comment);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();

    const handleUpdate = () => fetchReviews();
    window.addEventListener("reviewUpdated", handleUpdate);
    return () => window.removeEventListener("reviewUpdated", handleUpdate);
  }, [productId, user]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const { total, avgRating, distribution } = useMemo(() => {
    const t = reviews.length;
    const avg = t > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / t : 0;
    const dist = [5, 4, 3, 2, 1].map((level) => ({
      level,
      count: reviews.filter((r) => r.rating === level).length,
    }));
    return { total: t, avgRating: avg, distribution: dist };
  }, [reviews]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return reviews.slice(start, start + ITEMS_PER_PAGE);
  }, [reviews, currentPage]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!token) {
      setError("Debes iniciar sesión para dejar una reseña.");
      return;
    }
    if (rating === 0) {
      setError("Selecciona una calificación con las estrellas.");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch(`${API_URL}/products/${encodeURIComponent(productId)}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rating,
        comment,
      }),
    });

    setSubmitting(false);

    if (res.ok || res.status === 201 || res.status === 200) {
      setSuccess(true);
      await fetchReviews();
      window.dispatchEvent(new Event("reviewUpdated"));
      if (onCloseModal) onCloseModal();
      setSuccess(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar la reseña.");
    }
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      const res = await fetch(`${API_URL}/reviews/${reviewToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setReviewToDelete(null);
        addToast({
          title: "Reseña eliminada",
          description: "La reseña ha sido borrada exitosamente.",
          color: "success",
        });
        await fetchReviews();
        window.dispatchEvent(new Event("reviewUpdated"));
      } else {
        const data = await res.json().catch(() => ({}));
        addToast({
          title: "Error",
          description: data.error || "No se pudo eliminar la reseña.",
          color: "danger",
        });
      }
    } catch (err) {
      addToast({
        title: "Error de conexión",
        description: "Inténtalo de nuevo más tarde.",
        color: "danger",
      });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* ── Summary ───────────────────────────────────────────────────── */}
      {!hideReviews && !loading && total > 0 && (
        <div className="flex gap-6 items-center p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8">
          {/* Big number */}
          <div className="flex flex-col items-center min-w-[56px]">
            <span className="text-4xl font-black text-black dark:text-white leading-none">
              {avgRating.toFixed(1)}
            </span>
            <StarRow rating={avgRating} size={13} />
            <span className="text-[10px] text-black/40 dark:text-white/40 mt-1">
              {total} reseña{total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 flex flex-col gap-1.5">
            {distribution.map(({ level, count }) => (
              <RatingBar
                key={level}
                level={level}
                count={count}
                total={total}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Write a review ────────────────────────────────────────────── */}
      {!hideForm ? (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-black/8 dark:border-white/8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
              {token ? "Deja tu calificación" : "Inicia sesión para calificar"}
            </p>
          </div>

          {token ? (
            <div className="p-4 flex flex-col gap-3">
              {/* Star picker */}
              <div className="flex flex-col gap-1">
                <p className="text-xs text-black/50 dark:text-white/50">
                  Calificación
                  <span className="text-danger ml-0.5">*</span>
                </p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(i)}
                      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(0)}
                      onClick={() => setRating(i)}
                      className="transition-transform hover:scale-125 active:scale-95"
                      aria-label={`${i} estrella${i !== 1 ? "s" : ""}`}
                    >
                      <Star size={28} filled={i <= (hovered || rating)} />
                    </button>
                  ))}
                  {(hovered || rating) > 0 && (
                    <span className="ml-2 text-xs self-center text-black/40 dark:text-white/40">
                      {
                        [
                          "",
                          "Malo",
                          "Regular",
                          "Bueno",
                          "Muy bueno",
                          "Excelente",
                        ][hovered || rating]
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <textarea
                className="w-full text-sm bg-black/5 dark:bg-white/8 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-primary transition-colors resize-none placeholder:text-black/30 dark:placeholder:text-white/30 text-black dark:text-white"
                placeholder="Cuéntanos tu experiencia con este producto..."
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />

              {/* Feedback */}
              {error && (
                <p className="text-danger text-xs font-medium flex items-center gap-1.5">
                  <span>⚠️</span> {error}
                </p>
              )}
              {success && (
                <p className="text-success text-xs font-bold flex items-center gap-1.5">
                  <span>✅</span> ¡Reseña publicada exitosamente!
                </p>
              )}

              <button
              onClick={handleSubmit}
              disabled={submitting}
              className="self-end px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
            >
              {submitting ? "Guardando…" : (reviews.some(r => r.user_id === user?.id) ? "Actualizar reseña" : "Publicar reseña")}
            </button>
            </div>
          ) : (
            <div className="px-4 py-5 flex items-center gap-3 text-black/40 dark:text-white/40">
              <span className="text-xl">🔒</span>
              <p className="text-xs">
                <span className="font-semibold text-primary cursor-pointer">
                  Inicia sesión
                </span>{" "}
                para compartir tu opinión sobre este producto.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-center">
          <Button
            onClick={onOpenModal}
            className="bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
          >
            Escribir una reseña
          </Button>
        </div>
      )}

      {/* ── Reviews list ──────────────────────────────────────────────── */}
      {!hideReviews && (
        loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-black/30 dark:text-white/30">
          <span className="text-4xl">💬</span>
          <p className="text-sm font-semibold">Sin reseñas todavía</p>
          <p className="text-xs">¡Sé el primero en calificar este producto!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
            {total} reseña{total !== 1 ? "s" : ""}
          </p>
          {paginatedReviews.map((rev) => (
            <div
              key={rev.id}
              className="p-4 rounded-2xl border border-black/8 dark:border-white/8 bg-white dark:bg-black/30 flex flex-col gap-2 hover:border-black/15 dark:hover:border-white/15 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Avatar placeholder */}
                  <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                    {rev.reviewer_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-black dark:text-white truncate">
                      {rev.reviewer_name}
                    </p>
                    <StarRow rating={rev.rating} size={13} />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-[10px] text-black/30 dark:text-white/30 mt-0.5">
                    {new Date(rev.created_at).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {(isAdmin || (user && rev.user_id === user.id)) && (
                    <button
                      onClick={() => setReviewToDelete(rev.id)}
                      className="p-1.5 rounded-lg text-danger hover:bg-danger/10 active:scale-90 transition-all"
                      title="Eliminar reseña"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
              {rev.comment && (
                <p className="text-xs text-black/65 dark:text-white/65 leading-relaxed pl-9">
                  {rev.comment}
                </p>
              )}
              {user && rev.user_id === user.id && (
                <div className="flex justify-end mt-1">
                  <Button 
                    size="sm" 
                    variant="light" 
                    color="primary" 
                    className="text-[10px] h-6 min-h-6 uppercase font-bold"
                    onClick={() => {
                      if (hideForm && onOpenModal) {
                        onOpenModal();
                      } else {
                        // Scroll to top of the modal/container to see the form
                        const modalBody = document.querySelector('.flex-col.gap-6');
                        if (modalBody) modalBody.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    Editar mi reseña
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* ── Paginación ─────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex w-full justify-center mt-2">
              <Pagination
                isCompact
                showControls
                color="primary"
                page={currentPage}
                total={totalPages}
                onChange={(page) => {
                  setCurrentPage(page);
                }}
                variant="light"
              />
            </div>
          )}
        </div>
        )
      )}

      {/* Alerta de confirmación bonita */}
      <Modal isOpen={!!reviewToDelete} onOpenChange={(open) => !open && setReviewToDelete(null)} placement="center" backdrop="blur">
        <ModalContent className="dark:bg-[#0a0a0a] bg-white border border-white/10 p-2">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-black dark:text-white pb-2">
                <span className="text-xl">⚠️ Confirmar Eliminación</span>
              </ModalHeader>
              <ModalBody className="text-black/70 dark:text-white/70 text-sm">
                <p>¿Estás seguro de que deseas eliminar esta reseña? Esta acción no se puede deshacer.</p>
              </ModalBody>
              <ModalFooter className="flex gap-3 pt-4">
                <Button className="flex-1 font-bold bg-danger text-white" onPress={handleDeleteReview}>
                  Sí, Eliminar
                </Button>
                <Button className="font-bold bg-black/5 dark:bg-white/5" variant="flat" onPress={onClose}>
                  Cancelar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

// ─── Reviews Modal (exported for use in index.tsx) ────────────────────────────
interface ProductReviewsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProduct: Product | null;
}

export const ProductReviewsModal: React.FC<ProductReviewsModalProps> = ({
  isOpen,
  onOpenChange,
  selectedProduct,
}) => {
  return (
    <Modal
      backdrop="opaque"
      className="dark:bg-[#0d0d0d] bg-white border border-black/10 dark:border-white/10 m-0 sm:m-4 rounded-b-none rounded-t-[2rem] sm:rounded-2xl"
      isOpen={isOpen}
      size="lg"
      onOpenChange={onOpenChange}
      scrollBehavior="inside"
      placement="bottom"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5 pb-2 border-b border-black/8 dark:border-white/8">
              <p className="text-black dark:text-white font-bold text-base leading-tight">
                {selectedProduct?.name}
              </p>
              <p className="text-[11px] font-normal text-black/40 dark:text-white/40 uppercase tracking-wider">
                Deja tu calificación
              </p>
            </ModalHeader>
            <ModalBody className="py-5">
              {selectedProduct && (
                <ProductReviews 
                  productId={selectedProduct.id} 
                  hideReviews={true} 
                  onCloseModal={() => onOpenChange(false)}
                />
              )}
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
