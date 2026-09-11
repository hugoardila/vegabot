import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Sale } from "../types";
import { formatPrice } from "./format";

export const generateOrderPDF = async (sale: Sale) => {
  const doc = new jsPDF();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  const SERVER_URL = API_BASE.replace("/api", "");

  const pageW = doc.internal.pageSize.getWidth();

  // ─── WATERMARK ───────────────────────────────────────────────────────────────
  let watermarkImgData: string | null = null;
  try {
    watermarkImgData = await getBase64ImageFromURL("/img/marcadeagua/marca.png");
  } catch (error) {
    console.warn("No se pudo cargar la marca de agua:", error);
  }

  // (Watermark will be drawn at the end, over the cards)
  const drawWatermark = () => {
    if (!watermarkImgData) return;
    
    // Obtener propiedades reales de la imagen para no deformarla
    const imgProps = doc.getImageProperties(watermarkImgData);
    const aspect = imgProps.width / imgProps.height;
    
    const pageH = doc.internal.pageSize.getHeight();
    
    // Definir tamaño máximo (ej. 70% del ancho o alto de la página)
    const maxW = pageW * 0.7;
    const maxH = pageH * 0.6;
    
    let imgW = maxW;
    let imgH = imgW / aspect;
    
    // Si la imagen calculada es más alta que el máximo permitido, ajustarla por el alto
    if (imgH > maxH) {
      imgH = maxH;
      imgW = imgH * aspect;
    }

    try {
      doc.saveGraphicsState();
      // Ajustar opacidad entre 0.15 y 0.20 según lo solicitado
      doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    } catch (e) {}
    
    doc.addImage(watermarkImgData, "PNG", (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH);
    
    try {
      doc.restoreGraphicsState();
    } catch (e) {}
  };

  // ─── Brand colors ────────────────────────────────────────────────────────────
  const PRIMARY:   [number, number, number] = [79, 70, 229];
  const DARK:      [number, number, number] = [15, 15, 20];
  const LIGHT_BG:  [number, number, number] = [245, 247, 255];
  const GRAY:      [number, number, number] = [120, 120, 140];
  const SUCCESS:   [number, number, number] = [34, 197, 94];
  const WARNING:   [number, number, number] = [234, 179, 8];
  const DANGER:    [number, number, number] = [239, 68, 68];

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const drawLabel = (text: string, x: number, y: number) => {
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text(text.toUpperCase(), x, y);
  };

  const drawValue = (text: string, x: number, y: number, size = 10) => {
    doc.setFontSize(size);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(text, x, y);
  };

  // ─── Parse payment_method → pago | transportadora ───────────────────────────
  // Formats stored:
  //   Manual:  "Nequi – Envía"  or  "Bancolombia – Recoger en tienda"  (en dash –)
  //   Wompi:   "Wompi - NEQUI"  or  "Wompi - Aprobado"                (hyphen -)
  const rawMethod = sale.payment_method ?? "";
  // Try en-dash first, then regular hyphen
  const dashIdx = rawMethod.indexOf("\u2013") !== -1
    ? rawMethod.indexOf("\u2013")
    : rawMethod.indexOf(" - ") !== -1
      ? rawMethod.indexOf(" - ")
      : -1;
  const sepLen = rawMethod.indexOf("\u2013") !== -1 ? 1 : (rawMethod.indexOf(" - ") !== -1 ? 3 : 0);
  const pagoStr    = dashIdx !== -1 ? rawMethod.substring(0, dashIdx).trim()              : rawMethod;
  const deliveryStr= dashIdx !== -1 ? rawMethod.substring(dashIdx + sepLen).trim()        : "";
  // For Wompi payments the delivery type is stored in delivery_address fields, not in payment_method
  const isWompi    = pagoStr.toLowerCase().startsWith("wompi");
  // isPickup: manual orders check deliveryStr; Wompi orders check if deliveryStr says "recoger/tienda"
  const deliveryLower = deliveryStr.toLowerCase();
  const isPickup  = deliveryLower.includes("recoger") || deliveryLower.includes("tienda");
  // Consider it shipping if it's not pickup and there's a carrier or address data
  const hasStructuredAddress = !!(sale.delivery_department || sale.delivery_city || sale.delivery_address);
  const isShipping = !isPickup && (deliveryStr !== "" || (isWompi && hasStructuredAddress));

  // ─── HEADER BAND ─────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("COMPROBANTE DE PEDIDO", pageW / 2, 16, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 255);
  doc.text(
    `Pedido #${sale.id.toString().padStart(5, "0")}   |   ${new Date(sale.created_at).toLocaleString("es-CO")}`,
    pageW / 2, 24, { align: "center" }
  );

  // Status badge in header
  // Handles both Spanish names (PAGADO, CANCELADO) and English names from Wompi (PAID, APPROVED, CANCELLED)
  const statusUpper = (sale.status ?? "").toUpperCase();
  const statusColor: [number, number, number] =
    (statusUpper === "PAGADO" || statusUpper === "PAID" || statusUpper === "APPROVED") ? SUCCESS :
    (statusUpper === "ENTREGADO" || statusUpper === "DELIVERED")                       ? [99, 102, 241] :
    (statusUpper === "CANCELADO" || statusUpper === "CANCELLED" || statusUpper === "DECLINED" || statusUpper === "VOIDED") ? DANGER : WARNING;
  // Friendly label in Spanish
  const statusLabel =
    statusUpper === "PAID"      ? "PAGADO" :
    statusUpper === "APPROVED"  ? "APROBADO" :
    statusUpper === "DECLINED"  ? "RECHAZADO" :
    statusUpper === "VOIDED"    ? "ANULADO" :
    statusUpper === "PENDING"   ? "PENDIENTE" :
    statusUpper === "CANCELLED" ? "CANCELADO" :
    sale.status;
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageW / 2 - 22, 27, 44, 8, 2, 2, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, pageW / 2, 32.5, { align: "center" });

  // ─── SECTION: DATOS DEL CLIENTE ──────────────────────────────────────────────
  let y = 50;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y - 6, pageW - 28, 64, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("DATOS DEL CLIENTE", 20, y);
  y += 7;

  // Row 0: Nombre
  drawLabel("Nombre completo", 20, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(sale.customer_name ?? "Sin nombre registrado", 20, y);
  y += 9;

  // Row 1: Telefono | Email
  drawLabel("Telefono de contacto", 20, y);
  drawLabel("Correo electronico", pageW / 2, y);
  y += 5;
  drawValue(sale.customer_phone ?? "-", 20, y);
  drawValue(sale.customer_email ?? "No registrado", pageW / 2, y);
  y += 8;

  // Row 2: ID sistema | Documento
  drawLabel("ID interno del cliente", 20, y);
  drawLabel("Documento / Cedula", pageW / 2, y);
  y += 5;
  drawValue(sale.customer_id ? `Cliente #${sale.customer_id.substring(0,8)}...` : "Sin cuenta / Invitado", 20, y);
  drawValue(sale.customer_id_number ?? "No registrado", pageW / 2, y);
  y += 12;

  // ─── SECTION: METODO DE ENTREGA ──────────────────────────────────────────────
  // Use structured fields from database if available, otherwise parse delivery_address
  const hasStructuredData = !!(sale.delivery_department || sale.delivery_city);
  const parsedAddress     = sale.delivery_address || "";
  const parsedCity        = sale.delivery_city || "";
  const parsedDepartment  = sale.delivery_department || "";
  const parsedCountry     = sale.delivery_country || "Colombia";
  const parsedAdditionalInfo = sale.delivery_additional_info || "";

  const hasAddressData = hasStructuredData || (parsedAddress.trim() !== "");
  const deliveryBoxH = isPickup ? 24 : (hasAddressData ? 62 : 36);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y - 6, pageW - 28, deliveryBoxH, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("METODO DE ENTREGA", 20, y);
  y += 7;

  if (isPickup) {
    drawLabel("Tipo de entrega", 20, y);
    drawLabel("Transportadora / Distribuidor", pageW / 2, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Recoger en tienda", 20, y);
    drawValue(deliveryStr || "Recoger en tienda", pageW / 2, y, 10);
    y += 12;
  } else if (isShipping || hasAddressData) {
    drawLabel("Tipo de entrega", 20, y);
    drawLabel("Transportadora / Distribuidor", pageW / 2, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Envio a domicilio", 20, y);
    drawValue(deliveryStr || "No especificada", pageW / 2, y, 10);
    y += 8;
    
    // Show structured address if available
    if (hasStructuredData && (parsedAddress || parsedDepartment || parsedCity)) {
      // Row 1: País/Región | Departamento
      drawLabel("Pais/Region *", 20, y);
      if (parsedDepartment) {
        drawLabel("Departamento *", pageW / 2, y);
      }
      y += 5;
      drawValue(parsedCountry, 20, y, 9);
      if (parsedDepartment) {
        drawValue(parsedDepartment, pageW / 2, y, 9);
      }
      y += 8;
      
      // Row 2: Municipio | Dirección
      if (parsedCity) {
        drawLabel("Municipio *", 20, y);
      }
      if (parsedAddress) {
        drawLabel("Direccion *", parsedCity ? pageW / 2 : 20, y);
      }
      y += 5;
      if (parsedCity) {
        drawValue(parsedCity, 20, y, 9);
      }
      if (parsedAddress) {
        drawValue(parsedAddress, parsedCity ? pageW / 2 : 20, y, 9);
      }
      y += 8;
      
      // Row 3: Información adicional (if exists)
      if (parsedAdditionalInfo) {
        drawLabel("Informacion adicional (opcional)", 20, y);
        y += 5;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        const infoLines = doc.splitTextToSize(parsedAdditionalInfo, pageW - 44);
        doc.text(infoLines, 20, y);
        y += (infoLines.length * 4) + 4;
      }
    } else {
      // Fallback: show raw address if no structured data
      if (sale.delivery_address && sale.delivery_address.trim() !== "") {
        drawLabel("Direccion / Nota del cliente", 20, y);
        y += 5;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        const addressLines = doc.splitTextToSize(sale.delivery_address, pageW - 44);
        doc.text(addressLines, 20, y);
        y += (addressLines.length * 5) + 4;
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...GRAY);
        doc.text("* Confirmar direccion de envio con el cliente antes de despachar.", 20, y);
        y += 8;
      }
    }
    y += 4;
  } else {
    drawLabel("Entrega", 20, y);
    y += 5;
    drawValue(deliveryStr || "No especificada", 20, y);
    y += 12;
  }

  // ─── SECTION: METODO DE PAGO ─────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y - 6, pageW - 28, 20, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("METODO DE PAGO", 20, y);
  y += 7;

  drawLabel("Plataforma / Metodo de pago", 20, y);
  y += 5;
  drawValue(pagoStr || "No especificado", 20, y, 10);
  y += 12;

  // ─── SECTION: PRODUCTOS ──────────────────────────────────────────────────────
  const tableData = sale.items?.map((item) => [
    item.quantity.toString(),
    item.product_name || `Producto #${item.product_id}`,
    `$${formatPrice(item.unit_price)}`,
    `$${formatPrice(item.subtotal)}`,
  ]) || [];

  autoTable(doc, {
    startY: y,
    head: [["Cant.", "Producto / Descripcion", "Precio Unit.", "Subtotal"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: DARK,
    },
    alternateRowStyles: { fillColor: [240, 242, 255] },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 },
      2: { halign: "right", cellWidth: 34 },
      3: { halign: "right", cellWidth: 34, fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  const tableEndY: number = (doc as any).lastAutoTable.finalY;

  // ─── TOTAL ───────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(pageW - 14 - 72, tableEndY + 6, 72, 14, 3, 3, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(
    `TOTAL: $${formatPrice(sale.total_amount)}`,
    pageW - 14 - 4,
    tableEndY + 15,
    { align: "right" }
  );

  // ─── COMPROBANTES DE PAGO ────────────────────────────────────────────────────
  if (sale.receipts && sale.receipts.length > 0) {
    let currentY = tableEndY + 30;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("COMPROBANTES DE PAGO ADJUNTOS", 14, currentY);
    currentY += 8;

    const imgSize = 55;
    const gap = 8;
    let imgX = 14;

    for (const url of sale.receipts) {
      if (imgX + imgSize > pageW - 14) {
        imgX = 14;
        currentY += imgSize + gap;
      }
      if (currentY + imgSize > 270) {
        doc.addPage();
        currentY = 20;
        imgX = 14;
      }
      try {
        const fullUrl = `${SERVER_URL}${url}`;
        const imgData = await getBase64ImageFromURL(fullUrl);
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.5);
        doc.rect(imgX - 1, currentY - 1, imgSize + 2, imgSize + 2);
        doc.addImage(imgData, "JPEG", imgX, currentY, imgSize, imgSize);
        imgX += imgSize + gap;
      } catch {
        doc.setFontSize(7);
        doc.setTextColor(...DANGER);
        doc.text("[Error al cargar imagen]", imgX, currentY + imgSize / 2);
        imgX += imgSize + gap;
      }
    }
  }

  // ─── FOOTER & WATERMARK ──────────────────────────────────────────────────────
  const totalPages: number = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Dibujar la marca de agua AQUÍ asegura que quede por encima de los recuadros
    drawWatermark();
    
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.text(
      `Generado: ${new Date().toLocaleString("es-CO")}  |  Documento interno, no es factura oficial`,
      pageW / 2,
      footerY,
      { align: "center" }
    );
    doc.text(`Pag. ${i} / ${totalPages}`, pageW - 14, footerY, { align: "right" });
  }

  doc.save(`Pedido_${sale.id.toString().padStart(5, "0")}.pdf`);
};

// ─── Helper: URL → Base64 ────────────────────────────────────────────────────
const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};
