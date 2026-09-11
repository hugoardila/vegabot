import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { useAuth } from "../../context/AuthContext";

const TERMS_ACCEPTED_KEY = "terms_accepted";

export const TermsModal: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  useEffect(() => {
    // Si no hay usuario logueado (invitado), no mostrar el modal
    if (!user) {
      return;
    }

    // No mostrar el modal si el usuario es admin o super_admin
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    
    if (isAdmin) {
      return; // Los admins no ven el modal
    }

    // Verificar si ESTE usuario en específico ya aceptó los términos
    const hasAccepted = localStorage.getItem(`${TERMS_ACCEPTED_KEY}_${user.id}`);
    if (!hasAccepted) {
      // Mostrar el modal después de un pequeño delay para mejor UX
      setTimeout(() => {
        setIsOpen(true);
      }, 1000);
    }
  }, [user]);

  const handleAccept = () => {
    if (acceptedTerms && acceptedPrivacy && user) {
      // Guardar en localStorage que este usuario aceptó
      localStorage.setItem(`${TERMS_ACCEPTED_KEY}_${user.id}`, JSON.stringify({
        accepted: true,
        date: new Date().toISOString(),
        version: "1.0"
      }));
      setIsOpen(false);
    }
  };

  const handleReject = () => {
    // Mostrar alerta y redirigir al login
    alert("Para utilizar nuestros servicios, debe aceptar los Términos y Condiciones y la Política de Privacidad.");
    
    // Cerrar el modal
    setIsOpen(false);
    
    // Redirigir al login después de un breve momento
    setTimeout(() => {
      navigate("/login");
    }, 300);
  };

  const canAccept = acceptedTerms && acceptedPrivacy;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={() => {}} // No permitir cerrar sin aceptar
      isDismissable={false}
      hideCloseButton={true}
      size="4xl"
      scrollBehavior="inside"
      backdrop="blur"
      className="dark:bg-[#0a0a0a] bg-white"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-black/10 dark:border-white/10 pb-4">
          <h2 className="text-2xl font-bold text-black dark:text-white">
            Bienvenido a Nuestra Tienda
          </h2>
          <p className="text-sm font-normal text-black/60 dark:text-white/60">
            Antes de continuar, por favor revisa y acepta nuestros términos legales
          </p>
        </ModalHeader>
        
        <ModalBody className="py-6">
          {/* Términos y Condiciones */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-black dark:text-white mb-3 flex items-center gap-2">
              📋 Términos y Condiciones
            </h3>
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6 border border-black/10 dark:border-white/10 max-h-[300px] overflow-y-auto text-sm space-y-4">
              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">1. Aceptación de Términos</h4>
                <p className="text-black/70 dark:text-white/70">
                  Al acceder y utilizar nuestra plataforma de comercio electrónico, usted acepta estar sujeto a estos Términos y Condiciones. 
                  Si no está de acuerdo, por favor no utilice nuestros servicios.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">2. Productos y Servicios</h4>
                <p className="text-black/70 dark:text-white/70">
                  Comercializamos artículos de informática, computadores, celulares, accesorios tecnológicos y repuestos. 
                  Todos los productos están sujetos a disponibilidad de inventario.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">3. Garantías</h4>
                <ul className="list-disc list-inside text-black/70 dark:text-white/70 space-y-1">
                  <li><strong>Equipos nuevos:</strong> 12 meses de garantía</li>
                  <li><strong>Repuestos:</strong> 3 meses de garantía</li>
                  <li><strong>Accesorios:</strong> 30 días de garantía</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">4. Derecho de Retracto</h4>
                <p className="text-black/70 dark:text-white/70">
                  Conforme al Estatuto del Consumidor (Ley 1480 de 2011), tiene 5 días hábiles para retractarse de su compra 
                  sin justificación, siempre que el producto esté sin uso y con empaques originales.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">5. Pagos y Facturación</h4>
                <p className="text-black/70 dark:text-white/70">
                  Utilizamos Wompi como pasarela de pagos segura. <strong>NO almacenamos datos de tarjetas de crédito.</strong> 
                  Para emitir factura electrónica requerimos: correo, teléfono y número de cédula (obligatorio por normativa DIAN).
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">6. Comentarios y Reseñas</h4>
                <p className="text-black/70 dark:text-white/70">
                  Puede publicar comentarios sobre productos. Nos reservamos el derecho de moderar, eliminar contenido inapropiado 
                  y bloquear usuarios que violen nuestras normas de conducta.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">7. Propiedad Intelectual</h4>
                <p className="text-black/70 dark:text-white/70">
                  Todo el contenido de esta plataforma está protegido por leyes de propiedad intelectual. 
                  Queda prohibida su reproducción sin autorización.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">8. Ley Aplicable</h4>
                <p className="text-black/70 dark:text-white/70">
                  Estos términos se rigen por las leyes de Colombia (Ley 1480 de 2011, Ley 1581 de 2012). 
                  Jurisdicción: tribunales colombianos. Entidades de protección: Superintendencia de Industria y Comercio (SIC).
                </p>
              </section>
            </div>
          </div>

          {/* Política de Privacidad */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-black dark:text-white mb-3 flex items-center gap-2">
              🔒 Política de Privacidad y Tratamiento de Datos
            </h3>
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6 border border-black/10 dark:border-white/10 max-h-[300px] overflow-y-auto text-sm space-y-4">
              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Compromiso con su Privacidad</h4>
                <p className="text-black/70 dark:text-white/70">
                  Cumplimos estrictamente con la <strong>Ley 1581 de 2012 (Ley de Habeas Data)</strong> de Colombia 
                  para la protección de sus datos personales.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Datos que Recopilamos</h4>
                <p className="text-black/70 dark:text-white/70 mb-2">
                  <strong>Al crear cuenta:</strong>
                </p>
                <ul className="list-disc list-inside text-black/70 dark:text-white/70 space-y-1 mb-3">
                  <li>Nombre completo, correo electrónico, contraseña (cifrada)</li>
                  <li>Con Google OAuth: solo información básica (NO su contraseña de Google)</li>
                </ul>
                <p className="text-black/70 dark:text-white/70 mb-2">
                  <strong>Al realizar compras:</strong>
                </p>
                <ul className="list-disc list-inside text-black/70 dark:text-white/70 space-y-1">
                  <li>Número de cédula (obligatorio para factura electrónica DIAN)</li>
                  <li>Correo electrónico y teléfono</li>
                  <li>Dirección de envío</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Datos que NO Almacenamos</h4>
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
                  <p className="text-danger font-bold">
                    ❌ NO almacenamos números completos de tarjetas de crédito<br/>
                    ❌ NO almacenamos códigos CVV<br/>
                    ❌ NO tenemos acceso a contraseñas de Google
                  </p>
                  <p className="text-black/70 dark:text-white/70 text-xs mt-2">
                    Los pagos se procesan directamente por Wompi con certificación PCI DSS.
                  </p>
                </div>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Uso de sus Datos</h4>
                <ul className="list-disc list-inside text-black/70 dark:text-white/70 space-y-1">
                  <li>Procesar pedidos y pagos</li>
                  <li>Emitir facturación electrónica legal</li>
                  <li>Gestionar garantías y soporte al cliente</li>
                  <li>Cumplir obligaciones legales y tributarias</li>
                  <li>Mejorar nuestros servicios (análisis estadísticos)</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Sus Derechos</h4>
                <p className="text-black/70 dark:text-white/70 mb-2">Tiene derecho a:</p>
                <ul className="list-disc list-inside text-black/70 dark:text-white/70 space-y-1">
                  <li>Acceder y consultar sus datos personales</li>
                  <li>Rectificar datos inexactos o desactualizados</li>
                  <li>Solicitar supresión de sus datos</li>
                  <li>Revocar autorización de tratamiento</li>
                  <li>Presentar quejas ante la SIC</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Seguridad</h4>
                <p className="text-black/70 dark:text-white/70">
                  Implementamos cifrado SSL, contraseñas cifradas, bases de datos seguras y cumplimos estándares 
                  internacionales de seguridad (PCI DSS).
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Conservación de Datos</h4>
                <p className="text-black/70 dark:text-white/70">
                  Sus datos de transacciones se conservan mínimo 5 años por obligación tributaria (DIAN). 
                  Datos de marketing solo mientras no revoque su autorización.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-black dark:text-white mb-2">Cookies</h4>
                <p className="text-black/70 dark:text-white/70">
                  Utilizamos cookies para mantener su sesión, recordar preferencias y mejorar su experiencia. 
                  Puede configurar su navegador para rechazarlas, aunque esto puede afectar la funcionalidad.
                </p>
              </section>
            </div>
          </div>

          {/* Checkboxes de Aceptación */}
          <div className="space-y-3 border-t border-black/10 dark:border-white/10 pt-4">
            <Checkbox
              isSelected={acceptedTerms}
              onValueChange={setAcceptedTerms}
              classNames={{
                label: "text-sm",
              }}
            >
              <span className="text-black dark:text-white">
                He leído y acepto los{" "}
                <span className="font-bold text-primary">Términos y Condiciones</span>
              </span>
            </Checkbox>

            <Checkbox
              isSelected={acceptedPrivacy}
              onValueChange={setAcceptedPrivacy}
              classNames={{
                label: "text-sm",
              }}
            >
              <span className="text-black dark:text-white">
                He leído y acepto la{" "}
                <span className="font-bold text-primary">Política de Privacidad</span> y autorizo el tratamiento 
                de mis datos personales conforme a la Ley 1581 de 2012
              </span>
            </Checkbox>
          </div>

          {/* Aviso Legal */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mt-4">
            <p className="text-xs text-black/70 dark:text-white/70">
              <strong className="text-primary">⚖️ Aviso Legal:</strong> Al aceptar estos términos, usted declara ser mayor de 18 años 
              o contar con autorización de sus padres/tutores. Puede revocar su autorización en cualquier momento 
              contactándonos. Para dudas o ejercer sus derechos, escríbanos o acuda a la Superintendencia de 
              Industria y Comercio (SIC).
            </p>
          </div>
        </ModalBody>

        <ModalFooter className="border-t border-black/10 dark:border-white/10 pt-4">
          <Button
            color="danger"
            variant="flat"
            onPress={handleReject}
            className="font-bold"
          >
            Rechazar y Salir
          </Button>
          <Button
            color="primary"
            onPress={handleAccept}
            isDisabled={!canAccept}
            className="font-bold"
          >
            Aceptar y Continuar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
