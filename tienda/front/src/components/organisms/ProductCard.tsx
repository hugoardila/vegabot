import React from "react";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { ProductImageSlider } from "../molecules/ProductImageSlider";
import { Product } from "../../types";
import { formatPrice } from "../../utils/format";
import { getPromotionPercent, getRetailPrice, getWholesalePrice } from "../../utils/pricing";
import { CartIcon, PencilIcon, TrashIcon } from "../atoms/icons";
import { WholesalePriceCard } from "../molecules/WholesalePriceCard";
import { Power } from "lucide-react";

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  cartQuantity: number;
  addToCart: (product: Product) => void;
  handleViewProduct: (product: Product) => void;
  handleOpenProductModal: (product: Product) => void;
  handleDeleteProduct: (id: string) => void;
  handleUpdateProductStatus: (id: string, enabled: boolean) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isAdmin,
  cartQuantity,
  addToCart,
  handleViewProduct,
  handleOpenProductModal,
  handleDeleteProduct,
  handleUpdateProductStatus,
}) => {
  const openProduct = () => handleViewProduct(product);
  const stopInteractiveClick = (event: React.MouseEvent) => event.stopPropagation();
  const retailBasePrice = Number(product.price_2 ?? product.price ?? 0);
  const wholesalePrice = getWholesalePrice(product);
  const retailPrice = getRetailPrice(product);
  const promotionPercent = getPromotionPercent(product);
  const cannotAdd = product.stock <= 0 || cartQuantity >= product.stock;
  const isEnabled = product.enabled !== false;
  const pillBase =
    "inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all duration-150 active:scale-95 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <Card
      className="group cursor-pointer overflow-hidden border border-black/5 bg-white shadow-sm transition-all hover:border-primary/20 dark:border-white/5 dark:bg-white/5"
      role="button"
      tabIndex={0}
      onClick={openProduct}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Enter") openProduct();
      }}
    >
      <CardBody className="relative aspect-square overflow-hidden bg-black/5 p-0 dark:bg-white/5">
        <ProductImageSlider images={product.images} />
        <button
          aria-label={`Ver ${product.name}`}
          className="absolute inset-0 z-[15] cursor-pointer bg-transparent"
          type="button"
          onClick={(event) => {
            stopInteractiveClick(event);
            openProduct();
          }}
        />

        {!isAdmin && (
          <div className="pointer-events-none absolute left-2 top-2 z-20">
            <Chip
              className="font-black shadow-md backdrop-blur-md"
              color={product.stock <= 1 ? "danger" : "success"}
              size="sm"
              variant="solid"
            >
              {product.stock <= 0
                ? "Agotado"
                : product.stock === 1
                  ? "Último disponible"
                  : `${product.stock} disponibles`}
            </Chip>
          </div>
        )}

        <div className="pointer-events-none absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
          {isAdmin && (
            <>
              {!isEnabled && (
                <Chip className="font-bold backdrop-blur-md" color="warning" size="sm" variant="solid">
                  Deshabilitado
                </Chip>
              )}
              <Chip
                className="font-bold backdrop-blur-md"
                color={product.stock > 0 ? "success" : "danger"}
                size="sm"
                variant="flat"
              >
                {product.stock > 0 ? `Existencias: ${product.stock}` : "Agotado"}
              </Chip>
            </>
          )}

          {!isAdmin && cartQuantity > 0 && (
            <Chip
              className="animate-appearance-in backdrop-blur-md"
              color="success"
              size="sm"
              variant="flat"
            >
              +{cartQuantity}
            </Chip>
          )}
        </div>

        {!isAdmin && (
          <button
            aria-label={`Añadir ${product.name} al carrito`}
            className={`absolute bottom-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white p-0 text-primary shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-white/10 dark:bg-[#151515] ${
              cannotAdd
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:scale-105 active:scale-95"
            }`}
            disabled={cannotAdd}
            title={product.stock <= 0 ? "Producto agotado" : cannotAdd ? "Límite de existencias alcanzado" : "Añadir al carrito"}
            type="button"
            onClick={(event) => {
              stopInteractiveClick(event);
              if (!cannotAdd) addToCart(product);
            }}
          >
            <CartIcon size={17} />
          </button>
        )}
      </CardBody>

      <CardFooter className="flex flex-col items-start gap-2 bg-white p-2.5 lg:p-3 dark:bg-[#0d0d0d]">
        <p
          className={`h-10 w-full overflow-hidden text-sm font-semibold leading-5 lg:text-[15px] ${
            product.stock === 0 ? "text-danger" : "text-black/90 dark:text-white/90"
          }`}
        >
          {product.name}
        </p>

        <div className="min-h-4 w-full">
          {product.stock <= 0 && (
            <p className="text-xs font-black text-danger">
              Agotado · Próximo en llegar
            </p>
          )}
        </div>

        {(product.free_shipping || promotionPercent > 0) && (
          <div className="flex min-h-4 w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold">
            {product.free_shipping && <span className="text-success">Envio gratis</span>}
            {promotionPercent > 0 && (
              <span className="text-danger">En promocion -{formatPrice(promotionPercent)}%</span>
            )}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-1">
          <WholesalePriceCard
            compact
            interactive={!isAdmin}
            price={wholesalePrice}
            productName={product.name}
          />
          <div className="min-w-0 rounded-md border border-primary/20 bg-primary/10 p-1 text-center shadow-sm shadow-primary/15 dark:bg-primary/15 dark:shadow-none">
            <span className="block whitespace-nowrap text-[7px] font-bold leading-none text-primary/80 sm:text-[8px]">
              Precio detal
            </span>
            {promotionPercent > 0 && retailBasePrice > 0 && (
              <span className="mt-1 block text-[8px] leading-none text-primary/55 line-through">
                ${formatPrice(retailBasePrice)}
              </span>
            )}
            <span className={`mt-1 block whitespace-nowrap font-black leading-none text-primary ${retailPrice > 0 ? "text-[10px] sm:text-xs" : "text-[8px]"}`}>
              {retailPrice > 0 ? `$${formatPrice(retailPrice)}` : "Por consultar"}
            </span>
          </div>
        </div>

        {!isAdmin && (
          <button
            aria-label={`Agregar ${product.name} al carrito`}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={cannotAdd}
            type="button"
            onClick={(event) => {
              stopInteractiveClick(event);
              if (!cannotAdd) addToCart(product);
            }}
          >
            <CartIcon size={15} />
            {product.stock <= 0 ? "Agotado" : "Agregar al carrito"}
          </button>
        )}

        {isAdmin && (
          <div className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-1.5 border-t border-black/5 pt-2 dark:border-white/5">
            <button
              className={`${pillBase} flex-1 bg-black/5 text-black/55 hover:bg-primary/12 hover:text-primary dark:bg-white/5 dark:text-white/55 dark:hover:text-primary`}
              title="Editar producto"
              onClick={(event) => {
                stopInteractiveClick(event);
                handleOpenProductModal(product);
              }}
            >
              <PencilIcon size={11} />
              Editar
            </button>

            <button
              className={`${pillBase} min-w-0 px-2 ${
                isEnabled
                  ? "bg-warning/10 text-warning hover:bg-warning/20"
                  : "bg-success/10 text-success hover:bg-success/20"
              }`}
              title={
                isEnabled
                  ? "Deshabilitar producto en la tienda"
                  : "Habilitar producto en la tienda"
              }
              onClick={(event) => {
                stopInteractiveClick(event);
                handleUpdateProductStatus(product.id, !isEnabled);
              }}
            >
              <Power size={11} />
              {isEnabled ? "Ocultar" : "Habilitar"}
            </button>

            <button
              className={`${pillBase} bg-danger/10 px-2.5 text-danger hover:bg-danger/20`}
              title="Eliminar producto"
              onClick={(event) => {
                stopInteractiveClick(event);
                handleDeleteProduct(product.id);
              }}
            >
              <TrashIcon size={13} />
            </button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};
