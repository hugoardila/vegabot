import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Sale, User, Product } from "../../types";

interface OrderDetailModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  products: Product[];
  getStatusClasses: (status: string) => string;
  apiUrl: string;
}

const getPaymentMethodBadge = (paymentMethod: string) => {
  const method = paymentMethod?.toLowerCase() || '';
  
  if (method.includes('wompi') || method.includes('tarjeta') || method.includes('pse')) {
    return {
      label: 'Pagar con Wompi',
      icon: '💳',
      color: 'secondary' as const,
      description: '(Tarjeta, PSE, Nequi)'
    };
  } else if (method.includes('contraentrega')) {
    return {
      label: 'Pago contraentrega',
      icon: '$',
      color: 'warning' as const,
      description: 'Pago al recibir el pedido'
    };
  } else {
    return {
      label: 'Pago directo con la empresa',
      icon: '💵',
      color: 'success' as const,
      description: ''
    };
  }
};

export function OrderDetailModal({
  sale,
  isOpen,
  onClose,
  user,
  products,
  getStatusClasses,
  apiUrl,
}: OrderDetailModalProps) {
  const navigate = useNavigate();
  if (!sale) return null;

  const paymentBadge = getPaymentMethodBadge(sale.payment_method);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} placement="center" backdrop="blur" scrollBehavior="inside">
      <ModalContent className="dark:bg-[#0a0a0a] bg-white border border-white/10">
        <>
          <ModalHeader className="flex flex-col gap-1 border-b border-black/5 dark:border-white/5">
            <span className="text-xl font-bold">Detalles del Pedido</span>
          </ModalHeader>
          <ModalBody className="py-4">
            <div className="flex flex-col gap-4 text-black dark:text-white text-sm">
              <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5">
                <span className="font-bold opacity-60 text-xs uppercase tracking-widest">Estado</span>
                <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full border ${getStatusClasses(sale.status)}`}>
                  {sale.status}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold opacity-60 text-xs uppercase tracking-widest">Productos</span>
                <div className="flex flex-col gap-2 border border-black/5 dark:border-white/5 rounded-xl p-3 bg-black/5 dark:bg-white/5">
                  {sale.items?.map((item: any) => {
                    const p = products.find(prod => prod.id === item.product_id);
                    const imgSrc = p && p.images && p.images.length > 0 ? `${apiUrl.replace('/api', '')}${p.images[0]}` : null;
                    return (
                      <div key={item.id} className="flex justify-between items-center py-2 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          {imgSrc ? (
                            <img src={imgSrc} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs">No img</div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-primary text-xs">{item.quantity}x</span>
                            <span className="font-medium text-xs sm:text-sm">{item.product_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold opacity-70">${item.subtotal?.toLocaleString() || 0}</span>
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-primary/10 text-primary font-bold text-xs"
                            onPress={() => {
                              const product = products.find(p => p.id === item.product_id);
                              if (product) {
                                onClose();
                                navigate(`/product/${product.id}`);
                              }
                            }}
                          >
                            Ver
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 bg-primary/5 border border-primary/20 p-4 rounded-xl mt-2">
                <div className="flex flex-col gap-1 mb-2 border-b border-primary/10 pb-3">
                  <span className="font-bold text-xs uppercase tracking-widest text-primary">Información del Cliente</span>
                  <div className="grid grid-cols-2 text-xs gap-2 mt-1">
                    <span className="opacity-70">Nombre:</span> <span className="font-medium text-right">{sale.customer_name || user?.full_name}</span>
                    <span className="opacity-70">Teléfono:</span> <span className="font-medium text-right">{sale.customer_phone}</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 mt-1">
                  <span className="font-bold opacity-60 uppercase tracking-widest text-xs">Método de Pago</span>
                  <Chip 
                    size="md" 
                    color={paymentBadge.color}
                    variant="flat"
                    className="font-bold text-xs w-fit"
                    startContent={<span className="text-lg">{paymentBadge.icon}</span>}
                  >
                    {paymentBadge.label}
                  </Chip>
                  {paymentBadge.description && (
                    <span className="text-[10px] opacity-60">{paymentBadge.description}</span>
                  )}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <span className="font-bold uppercase tracking-widest text-primary">Total Pagado</span>
                  <span className="font-bold text-xl text-primary">${sale.total_amount?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="border-t border-black/5 dark:border-white/5">
            <Button className="w-full font-bold bg-primary text-white" onPress={onClose}>
              Cerrar
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}
