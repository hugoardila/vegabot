import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Sale } from "../../types";
import { formatPrice } from "../../utils/format";
import { generateOrderPDF } from "../../utils/pdfGenerator";
import { DownloadIcon, WhatsAppIcon } from "../atoms/icons";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace("/api", "");

interface OrdersListProps {
  sales: Sale[];
  onUpdateStatus: (id: string, status: string) => void;
  isLoading: boolean;
}

// Flujo secuencial: PENDIENTE → EN_REVISION → ACEPTADO → ENVIADO
const STATUS_FLOW: Record<string, { next: string; label: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "danger" } | null> = {
  PENDIENTE:   { next: "EN_REVISION", label: "Poner en Revisión", color: "secondary" },
  EN_REVISION: { next: "ACEPTADO",    label: "Aceptar Pedido",    color: "success"   },
  ACEPTADO:    { next: "ENVIADO",     label: "Marcar como Enviado", color: "primary" },
  ENVIADO:     null, // Estado final — no hay siguiente paso
  CANCELADO:   null, // Estado final
};

const statusColorMap: Record<string, "warning" | "success" | "danger" | "default" | "primary" | "secondary"> = {
  PENDIENTE:   "warning",
  EN_REVISION: "secondary",
  ACEPTADO:    "success",
  ENVIADO:     "primary",
  CANCELADO:   "danger",
};

const statusLabelMap: Record<string, string> = {
  PENDIENTE:   "PENDIENTE",
  EN_REVISION: "EN REVISIÓN",
  ACEPTADO:    "ACEPTADO",
  ENVIADO:     "ENVIADO",
  CANCELADO:   "CANCELADO",
};

const EyeIcon = ({ size = 16 }: { size?: number }) => (
  <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SearchIcon = ({ size = 24, strokeWidth = 1.5, width, height, ...props }: any) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height={height || size}
    role="presentation"
    viewBox="0 0 24 24"
    width={width || size}
    {...props}
  >
    <path
      d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    />
    <path
      d="M22 22L20 20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    />
  </svg>
);

export const OrdersList: React.FC<OrdersListProps> = ({ sales, onUpdateStatus, isLoading }) => {
  const navigate = useNavigate();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [monthFilter, setMonthFilter] = useState(""); // Formato YYYY-MM
  
  // FILTRAR PEDIDOS PENDING (no pagados) - SOLO MOSTRAR PAGADOS O EN PROCESO
  const STATUS_TABS = ["TODOS", "EN_REVISION", "ACEPTADO", "ENVIADO", "CANCELADO", "WOMPI"];
  const itemsPerPage = 10;

  // Extraer los meses únicos de las ventas
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    // FILTRAR: Solo mostrar ventas que NO estén en PENDING
    sales.filter(sale => sale.status !== "PENDING").forEach(sale => {
      if (sale.created_at) {
        const d = new Date(sale.created_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        months.add(`${yyyy}-${mm}`);
      }
    });
    return Array.from(months).sort().reverse();
  }, [sales]);

  const formatMonth = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    const text = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const filteredSales = useMemo(() => {
    // FILTRAR: Excluir pedidos PENDING (no pagados)
    let result = sales.filter(sale => sale.status !== "PENDING");
    
    if (statusFilter === "WOMPI") {
      result = result.filter(sale => (sale.payment_method || "").toLowerCase().includes("wompi"));
    } else if (statusFilter !== "TODOS") {
      result = result.filter(sale => sale.status === statusFilter);
    }
    if (monthFilter) {
      result = result.filter(sale => {
        if (!sale.created_at) return false;
        const d = new Date(sale.created_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}` === monthFilter;
      });
    }
    
    // Sort by date DESC just to be sure it is "por fecha de pedidos para llevar un orden"
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(sale => 
        sale.id.toString().includes(lowerQuery) ||
        (sale.customer_phone && sale.customer_phone.includes(lowerQuery)) ||
        (sale.customer_email && sale.customer_email.toLowerCase().includes(lowerQuery)) ||
        (sale.status.toLowerCase().includes(lowerQuery))
      );
    }
    return result;
  }, [sales, searchQuery, statusFilter, monthFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, monthFilter]);

  const pages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <Button
            className="bg-black/5 dark:bg-white/5 font-bold"
            size="sm"
            variant="flat"
            onClick={() => navigate(-1)}
          >
            ← Volver
          </Button>
          <h2 className="text-2xl font-bold text-black dark:text-white">Gestión de Pedidos</h2>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
          <div></div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-xl">
            <Select
              selectedKeys={monthFilter ? [monthFilter] : ["all"]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                setMonthFilter(val === "all" ? "" : val);
              }}
              items={[
                { key: "all", label: "Todos los Meses" },
                ...availableMonths.map(m => ({ key: m, label: formatMonth(m) })),
              ]}
              className="w-full sm:w-auto min-w-[160px]"
              variant="flat"
              size="sm"
              aria-label="Filtrar por mes"
              classNames={{
                trigger: "bg-black/5 dark:bg-white/5 font-bold",
              }}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>

            <Input
              isClearable
              className="w-full"
              placeholder="Buscar por ID, Teléfono, Email o Estado..."
              startContent={<SearchIcon className="text-default-300" />}
              value={searchQuery}
              onClear={() => setSearchQuery("")}
              onValueChange={setSearchQuery}
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-2 scrollbar-hide">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <Table
            aria-label="Tabla de pedidos de clientes"
            className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm min-w-[900px]"
            isHeaderSticky
          >
          <TableHeader>
            <TableColumn>PEDIDO ID</TableColumn>
            <TableColumn>PRODUCTOS / DETALLES</TableColumn>
            <TableColumn>CLIENTE / TELÉFONO</TableColumn>
            <TableColumn>TOTAL</TableColumn>
            <TableColumn>MÉTODO PAGO</TableColumn>
            <TableColumn>ENTREGA</TableColumn>
            <TableColumn>FECHA</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn align="center">ACCIONES</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={"No hay pedidos registrados aún."}
            isLoading={isLoading}
          >
            {paginatedSales.map((sale) => {
              const parts = (sale.payment_method || "").split(" – ");
              const paymentStr = parts[0]?.trim() || sale.payment_method;
              const deliveryStr = parts.length > 1 ? parts[1]?.trim() : null;
              const isPickup = deliveryStr?.toLowerCase().includes("recoger");
              const deliveryIcon = isPickup ? "🏪" : "🚚";

              return (
              <TableRow key={sale.id}>
                <TableCell>
                  <span className="font-mono text-xs font-bold text-black/40 dark:text-white/40">
                    #{sale.id.toString().padStart(5, '0')}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<EyeIcon size={14} />}
                    onClick={() => setSelectedSale(sale)}
                  >
                    {sale.items?.length ?? 0} producto{(sale.items?.length ?? 0) !== 1 ? "s" : ""}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <p className="text-sm font-bold font-mono">
                      {sale.customer_phone}
                    </p>
                    {sale.customer_email && (
                      <p className="text-[10px] text-primary/70 truncate max-w-[160px]" title={sale.customer_email}>
                        ✉️ {sale.customer_email}
                      </p>
                    )}
                    <p className="text-[10px] text-black/40 dark:text-white/40">
                      ID: {sale.customer_id ?? 'Invitado'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-bold text-primary">${formatPrice(sale.total_amount)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <Chip size="sm" variant="flat" className="capitalize">
                      💳 {paymentStr}
                    </Chip>
                    {sale.receipts && sale.receipts.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {sale.receipts.map((url, i) => (
                          <div key={i} className="group relative">
                            <Image
                              src={`${API_BASE}${url}`}
                              alt={`Recibo ${i + 1}`}
                              className="w-12 h-12 object-cover rounded-md border border-black/10 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                              onClick={() => window.open(`${API_BASE}${url}`, '_blank')}
                            />
                            <div className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-bold size-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {i + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    {deliveryStr ? (
                      <Chip size="sm" color={isPickup ? "secondary" : "primary"} variant="flat" className="capitalize font-bold min-w-max">
                        {deliveryIcon} {deliveryStr}
                      </Chip>
                    ) : (
                      <span className="text-[10px] text-black/40 italic">N/A</span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <p className="text-xs">{new Date(sale.created_at).toLocaleDateString()} {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </TableCell>
                <TableCell>
                  <Chip
                    className="capitalize border-none gap-1 text-default-600"
                    color={statusColorMap[sale.status] || "default"}
                    size="sm"
                    variant="dot"
                  >
                    {statusLabelMap[sale.status] || sale.status}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="relative flex justify-center items-center gap-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      color="secondary"
                      onClick={() => generateOrderPDF(sale)}
                      title="Descargar PDF"
                    >
                      <DownloadIcon size={16} />
                    </Button>
                    {/* Botón WhatsApp para contactar al cliente */}
                    {sale.customer_phone && (
                      <a
                        href={`https://wa.me/${sale.customer_phone}?text=${encodeURIComponent(
                          `Hola ${sale.customer_name || 'Cliente'} 👋\n\n` +
                          `Soy del equipo de Vega. Te contacto sobre tu pedido:\n\n` +
                          `📦 Pedido #${sale.id?.toString().slice(-6)}\n` +
                          `💰 Total: $${sale.total_amount?.toLocaleString() || 0}\n` +
                          `📅 Fecha: ${new Date(sale.created_at).toLocaleDateString()}\n` +
                          `📱 Tu teléfono: ${sale.customer_phone}\n\n` +
                          `¿Me puedes decir tu correo email para confirmar si es tu pedido?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                        title="Contactar por WhatsApp"
                      >
                        <WhatsAppIcon size={16} />
                      </a>
                    )}
                    {/* Botón del siguiente paso en el flujo */}
                    {STATUS_FLOW[sale.status] ? (
                      <Dropdown>
                        <DropdownTrigger>
                          <Button size="sm" variant="flat" color="primary" className="font-bold">
                            Avanzar
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Acciones de estado">
                          {/* Siguiente paso del flujo */}
                          <DropdownItem
                            key="next"
                            color={STATUS_FLOW[sale.status]!.color}
                            onClick={() => {
                              const nextStatus = STATUS_FLOW[sale.status]!.next;
                              onUpdateStatus(sale.id, nextStatus);

                              // Si pasa a EN_REVISION → notificar que está en revisión
                              if (nextStatus === "EN_REVISION" && sale.customer_phone) {
                                let text = `Hola ${sale.customer_name || 'Cliente'} 👋\n`;
                                text += `Recibimos tu pedido *#${sale.id.toString().padStart(5, '0')}*, está siendo revisado.\n\n`;
                                text += `*📋 Datos del cliente*\n`;
                                                                text += `Teléfono: ${sale.customer_phone}\n\n`;
                                text += `*🛒 Detalle del pedido*\n`;
                                if (sale.items && sale.items.length > 0) {
                                  sale.items.forEach(item => {
                                    text += `- ${item.quantity}x ${item.product_name || `Producto #${item.product_id}`} ($${formatPrice(item.subtotal)})\n`;
                                  });
                                }
                                text += `\n*💰 Total:* $${formatPrice(sale.total_amount)}\n`;
                                if (sale.payment_method) text += `*Método de pago:* ${sale.payment_method}\n`;
                                const message = encodeURIComponent(text);
                                window.open(`https://wa.me/${sale.customer_phone.replace(/\D/g, '')}?text=${message}`, "_blank");
                              }

                              // Si pasa a ACEPTADO → notificar que el pedido fue aceptado y se está empacando
                              if (nextStatus === "ACEPTADO" && sale.customer_phone) {
                                let text = `✅ *¡Pedido Aceptado!*\n\n`;
                                text += `Hola ${sale.customer_name || 'Cliente'}, tu pedido *#${sale.id.toString().padStart(5, '0')}* ha sido *aceptado* y lo estamos empacando con mucho cuidado para ti. 📦\n\n`;
                                text += `*📋 Datos del cliente*\n`;
                                                                text += `Teléfono: ${sale.customer_phone}\n\n`;
                                text += `*🛒 Detalle del pedido*\n`;
                                if (sale.items && sale.items.length > 0) {
                                  sale.items.forEach(item => {
                                    text += `- ${item.quantity}x ${item.product_name || `Producto #${item.product_id}`} ($${formatPrice(item.subtotal)})\n`;
                                  });
                                }
                                text += `\n*💰 Total:* $${formatPrice(sale.total_amount)}\n`;
                                if (sale.payment_method) text += `*Método de pago:* ${sale.payment_method}\n`;
                                text += `\nPronto nos pondremos en contacto para coordinar la entrega. ¡Gracias por tu compra! 🙏`;
                                const message = encodeURIComponent(text);
                                window.open(`https://wa.me/${sale.customer_phone.replace(/\D/g, '')}?text=${message}`, "_blank");
                              }

                              // Si pasa a ENVIADO → notificar que el pedido fue enviado con la transportadora
                              if (nextStatus === "ENVIADO" && sale.customer_phone) {
                                // payment_method guarda "Nequi – Transprensa" o solo "Servientrega"
                                const parts = (sale.payment_method || "").split(" – ");
                                const carrier = parts.length > 1 ? parts[1].trim() : parts[0].trim() || "la transportadora que escogiste";
                                const paymentMethod = parts.length > 1 ? parts[0].trim() : null;

                                const getCarrierLink = (c: string) => {
                                  const norm = c.toLowerCase();
                                  if (norm.includes("envia") || norm.includes("envía")) return "https://envia.co/";
                                  if (norm.includes("transprensa")) return "https://transprensa.com/";
                                  if (norm.includes("verdes")) return "https://taxisverdes.eco.co/consulta/consulta.aspx";
                                  if (norm.includes("estelar")) return "https://estelarexpress.co/index.php/atencion-al-cliente/rastreo-de-guia";
                                  if (norm.includes("coomotor")) return "https://www.skydropx.com.co/transportadoras/coomotor/rastreo/";
                                  if (norm.includes("coordinadora")) return "https://coordinadora.com/rastreo/rastreo-de-guia/";
                                  if (norm.includes("servientrega")) return "https://www.servientrega.com/wps/portal/rastreo-envio";
                                  return null;
                                };
                                const trackingLink = getCarrierLink(carrier);

                                const isPickup = carrier.toLowerCase().includes("recoger");

                                let text = "";
                                if (isPickup) {
                                  text = `🏪 *¡Tu pedido está listo para recoger!*\n\n`;
                                  text += `Hola ${sale.customer_name || 'Cliente'}, tu pedido *#${sale.id.toString().padStart(5, '0')}* ya está empacado y listo para que lo recojas en nuestra tienda. ¡Te esperamos! 🙌\n\n`;
                                } else {
                                  text = `🚚 *¡Tu pedido está en camino!*\n\n`;
                                  text += `Hola ${sale.customer_name || 'Cliente'}, tu pedido *#${sale.id.toString().padStart(5, '0')}* ya fue enviado a través de *${carrier}*. 📦\n\n`;
                                }
                                
                                text += `*📋 Datos del cliente*\n`;
                                                                text += `Teléfono: ${sale.customer_phone}\n`;
                                if (!isPickup && sale.delivery_address) text += `Dirección: ${sale.delivery_address}\n`;
                                text += `\n*🛒 Detalle del pedido*\n`;
                                if (sale.items && sale.items.length > 0) {
                                  sale.items.forEach(item => {
                                    text += `- ${item.quantity}x ${item.product_name || `Producto #${item.product_id}`} ($${formatPrice(item.subtotal)})\n`;
                                  });
                                }
                                text += `\n*💰 Total:* $${formatPrice(sale.total_amount)}\n`;
                                if (paymentMethod) text += `*Método de pago:* ${paymentMethod}\n`;
                                
                                if (!isPickup) {
                                  text += `*Transportadora:* ${carrier}\n`;
                                  if (trackingLink) text += `*Rastrear pedido:* ${trackingLink}\n`;
                                }
                                text += `\n¡Gracias por tu compra! Si tienes alguna duda, escríbenos. 🙏`;
                                const message = encodeURIComponent(text);
                                window.open(`https://wa.me/${sale.customer_phone.replace(/\D/g, '')}?text=${message}`, "_blank");
                              }
                            }}
                          >
                            {STATUS_FLOW[sale.status]!.label}
                          </DropdownItem>
                          {/* Siempre se puede cancelar si no está en estado final */}
                          <DropdownItem
                            key="CANCELADO"
                            className="text-danger"
                            color="danger"
                            onClick={() => {
                              onUpdateStatus(sale.id, "CANCELADO");
                              if (sale.customer_phone) {
                                let text = `❌ *Pedido Cancelado*\n\n`;
                                text += `Hola ${sale.customer_name || 'Cliente'}, lamentamos informarte que tu pedido *#${sale.id.toString().padStart(5, '0')}* ha sido *cancelado* por motivos de fraude.\n\n`;
                                text += `*🛒 Detalle del pedido cancelado*\n`;
                                if (sale.items && sale.items.length > 0) {
                                  sale.items.forEach(item => {
                                    text += `- ${item.quantity}x ${item.product_name || `Producto #${item.product_id}`} ($${formatPrice(item.subtotal)})\n`;
                                  });
                                }
                                text += `\n*💰 Total:* $${formatPrice(sale.total_amount)}\n`;
                                text += `\nPara más información escríbenos o llámanos. 📞`;
                                const message = encodeURIComponent(text);
                                window.open(`https://wa.me/${sale.customer_phone.replace(/\D/g, '')}?text=${message}`, "_blank");
                              }
                            }}
                          >
                            Cancelar Pedido
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    ) : (
                      // Estado final: solo muestra etiqueta sin dropdown
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                        sale.status === "ENVIADO" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
                      }`}>
                        {statusLabelMap[sale.status] || sale.status}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>

        {pages > 1 && (
          <div className="flex w-full justify-center mt-4 mb-2">
            <Pagination
              isCompact
              showControls
              color="primary"
              page={currentPage}
              total={pages}
              onChange={setCurrentPage}
              variant="light"
            />
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!selectedSale}
        onOpenChange={(open) => { if (!open) setSelectedSale(null); }}
        size="lg"
        backdrop="blur"
        className="dark:bg-[#0a0a0a] bg-white"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold">
                  Pedido #{selectedSale?.id.toString().padStart(5, '0')}
                </span>
                <p className="text-xs font-normal text-black/40 dark:text-white/40">
                  {selectedSale && new Date(selectedSale.created_at).toLocaleString()} · Teléfono: {selectedSale?.customer_phone ?? '—'}
                </p>
              </ModalHeader>
              <ModalBody className="pb-4 flex flex-col gap-4">
                {/* Products */}
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-3">Productos comprados</p>
                  {selectedSale?.items && selectedSale.items.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedSale.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="size-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm font-bold">
                              {item.quantity}x
                            </div>
                            <div>
                              <p className="text-sm font-bold">{item.product_name || `Producto #${item.product_id}`}</p>
                              <p className="text-[10px] opacity-50">c/u: ${formatPrice(item.unit_price)}</p>
                            </div>
                          </div>
                          <span className="font-bold text-primary">${formatPrice(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic opacity-40">Sin detalles de productos registrados.</p>
                  )}
                </div>

                {/* Delivery Information */}
                {(() => {
                  if (!selectedSale) return null;
                  const parts = (selectedSale.payment_method || "").split(" – ");
                  const deliveryStr = parts.length > 1 ? parts[1]?.trim() : null;
                  const isPickup = deliveryStr?.toLowerCase().includes("recoger");
                  
                  if (!deliveryStr && !selectedSale.delivery_address) return null;

                  return (
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-3">Información de Entrega</p>
                      <div className="flex flex-col gap-2 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                        {/* Tipo de entrega */}
                        {deliveryStr && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-black/60 dark:text-white/60">Tipo:</span>
                            <span className="text-sm font-bold">{isPickup ? "🏪" : "🚚"} {deliveryStr}</span>
                          </div>
                        )}
                        
                        {/* Datos del cliente */}
                        {selectedSale.customer_name && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-black/60 dark:text-white/60">Nombre completo:</span>
                            <span className="text-sm">{selectedSale.customer_name}</span>
                          </div>
                        )}
                        
                        
                        {selectedSale.customer_phone && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-black/60 dark:text-white/60">Teléfono:</span>
                            <span className="text-sm">{selectedSale.customer_phone}</span>
                          </div>
                        )}
                        
                        {selectedSale.customer_email && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-black/60 dark:text-white/60">Email:</span>
                            <span className="text-sm">{selectedSale.customer_email}</span>
                          </div>
                        )}
                        
                        {/* Divider si hay datos de ubicación */}
                        {!isPickup && (selectedSale.delivery_address || selectedSale.delivery_department || selectedSale.delivery_city) && (
                          <div className="border-t border-black/10 dark:border-white/10 my-1"></div>
                        )}
                        
                        {/* Show structured address from database fields */}
                        {!isPickup && (selectedSale.delivery_address || selectedSale.delivery_department || selectedSale.delivery_city) && (
                          <>
                            {/* País/Región */}
                            {selectedSale.delivery_country && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-black/60 dark:text-white/60">País/Región *:</span>
                                <span className="text-sm">{selectedSale.delivery_country}</span>
                              </div>
                            )}
                            
                            {/* Departamento */}
                            {selectedSale.delivery_department && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-black/60 dark:text-white/60">Departamento *:</span>
                                <span className="text-sm">{selectedSale.delivery_department}</span>
                              </div>
                            )}
                            
                            {/* Municipio */}
                            {selectedSale.delivery_city && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-black/60 dark:text-white/60">Municipio *:</span>
                                <span className="text-sm">{selectedSale.delivery_city}</span>
                              </div>
                            )}
                            
                            {/* Dirección */}
                            {selectedSale.delivery_address && (
                              <div className="flex justify-between items-start gap-4">
                                <span className="text-sm font-bold text-black/60 dark:text-white/60 shrink-0">Dirección *:</span>
                                <span className="text-sm text-right">{selectedSale.delivery_address}</span>
                              </div>
                            )}
                            
                            {/* Información adicional */}
                            {selectedSale.delivery_additional_info && (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-bold text-black/60 dark:text-white/60">Información adicional (opcional):</span>
                                <span className="text-sm italic break-words">{selectedSale.delivery_additional_info}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Total */}
                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <span className="font-bold text-sm">Total del pedido</span>
                  <span className="font-bold text-lg text-primary">${formatPrice(selectedSale?.total_amount ?? 0)}</span>
                </div>

                {/* Receipts */}
                {selectedSale?.receipts && selectedSale.receipts.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-3">Comprobantes de pago</p>
                    <div className="flex gap-3 flex-wrap">
                      {selectedSale.receipts.map((url, i) => (
                        <Image
                          key={i}
                          src={`${API_BASE}${url}`}
                          alt={`Comprobante ${i + 1}`}
                          className="w-24 h-24 object-cover rounded-xl border border-black/10 cursor-pointer hover:scale-105 transition-transform shadow-md"
                          onClick={() => window.open(`${API_BASE}${url}`, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="gap-2">
                <Button
                  color="secondary"
                  variant="flat"
                  startContent={<DownloadIcon size={16} />}
                  onClick={() => { generateOrderPDF(selectedSale!); onClose(); }}
                >
                  Descargar PDF
                </Button>
                <Button variant="flat" onClick={onClose}>Cerrar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
