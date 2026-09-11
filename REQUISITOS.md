# Manual completo de instalacion y operacion - VEGA IMPORTADORA

Actualizado: 2026-08-01.

Este archivo es el documento vivo del proyecto. Reune requisitos, arquitectura, instalacion, operacion, flujos de venta, integraciones, respaldos y recuperacion. Cada vez que se agregue una dependencia, servicio externo, tabla, ajuste comercial o paso operativo nuevo, se debe actualizar la seccion correspondiente y registrar el cambio en el historial.

No se deben guardar claves privadas, tokens, contrasenas ni secretos reales dentro de este archivo.

## 1. Software requerido

- Windows 10/11 o servidor compatible con Node.js y MySQL.
- XAMPP con MySQL/MariaDB activo.
- Node.js 20.x o superior.
- npm, incluido con Node.js.
- pnpm instalado globalmente para compilar la tienda:

```powershell
npm install -g pnpm
```

- Navegador moderno: Chrome, Edge o Firefox.
- ngrok u otra herramienta equivalente si Twilio debe llamar al proyecto desde internet mientras esta local.
- cloudflared si se requiere conectar por SSH al servidor publicado con Cloudflare Tunnel.

## 2. Ubicacion esperada del proyecto

Ruta usada actualmente:

```txt
C:\xampp\htdocs\vegabot
```

El proyecto puede moverse a otro equipo, pero las rutas de comandos deben ejecutarse desde la nueva carpeta raiz.

## 3. Base de datos

Motor requerido:

```txt
MySQL/MariaDB desde XAMPP
```

Base de datos:

```txt
vegabot
```

El servidor Node crea automaticamente la base de datos `vegabot` y las tablas necesarias si el usuario MySQL tiene permisos.

Configuracion por defecto:

```txt
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=vegabot
```

Si en otro PC MySQL tiene clave o usuario diferente, definir esas variables de entorno antes de iniciar la app.

## 4. Dependencias Node del backend

Instalar desde la raiz del proyecto:

```powershell
npm install
```

Dependencias principales actuales:

- express
- mysql2
- twilio
- multer

## 5. Dependencias de la tienda

Instalar desde:

```txt
C:\xampp\htdocs\vegabot\tienda\front
```

Comandos:

```powershell
pnpm install
pnpm run build
```

La tienda compilada se sirve desde:

```txt
tienda\front\dist
```

## 6. Comandos para iniciar

1. Iniciar MySQL desde XAMPP.
2. Entrar a la raiz del proyecto:

```powershell
cd C:\xampp\htdocs\vegabot
```

3. Iniciar la app:

```powershell
npm start
```

URL publica local principal:

```txt
http://localhost:3000
```

Rutas importantes:

```txt
/                    Tienda publica, redirige a /tienda/
/tienda/             Tienda virtual publica
/login               Login del bot/admin
/admin               Panel privado del bot
/webhook/twilio      Webhook para Twilio WhatsApp
/tienda-api/api/*    API de la tienda
```

## 7. Servicios externos configurables

Estos datos se configuran desde el panel admin, vista `Ajustes del sistema`.

### Twilio WhatsApp

- Account SID.
- Auth Token.
- WhatsApp Sender con formato `+57...`.
- Messaging Service SID, si aplica.
- URL publica del proyecto para el webhook.

Webhook que debe ponerse en Twilio:

```txt
https://TU-DOMINIO-O-NGROK/webhook/twilio
```

Metodo:

```txt
POST
```

### Wompi

Para pagos de la tienda:

- Wompi Public Key.
- Wompi Private Key.
- Wompi API URL.
- Integrity Secret, si se usa validacion de integridad.
- Events Secret, si se usan webhooks de Wompi.

URLs habituales:

```txt
Sandbox:    https://sandbox.wompi.co/v1
Produccion: https://production.wompi.co/v1
```

### Google OAuth

Para login/registro con Google en la tienda:

- Google OAuth Client ID.
- Origenes autorizados en Google Cloud Console, por ejemplo:

```txt
http://localhost:3000
https://TU-DOMINIO-O-NGROK
```

## 8. Carpetas de almacenamiento local

Estas carpetas se crean/usaran en el servidor local:

```txt
storage\payment-proofs
storage\store-uploads\videos
storage\store-uploads\productos
storage\store-uploads\facturas
```

Al migrar a otro PC, copiar la carpeta `storage` si se quieren conservar comprobantes, videos y archivos subidos.

## 9. Datos que se deben respaldar al migrar

Imprescindible:

- Base de datos MySQL `vegabot`.
- Carpeta `storage`.
- Carpeta completa del proyecto.

Recomendado:

- Exportar la base de datos desde phpMyAdmin o con `mysqldump`.
- Verificar despues de importar que existan productos, usuarios, pedidos, settings y tienda.

### Exportar base de datos local

Desde la raiz del proyecto puedes ejecutar:

```powershell
.\exportar-bd-vegabot.bat
```

O en modo automatizable/SSH:

```powershell
powershell -ExecutionPolicy Bypass -File .\exportar-bd-vegabot.ps1
```

El respaldo queda en:

```txt
backups\vegabot-FECHA-HORA.sql
```

Tambien se puede usar el comando directo:

```powershell
C:\xampp\mysql\bin\mysqldump.exe -u root --default-character-set=utf8mb4 --single-transaction --routines --triggers --events vegabot > backups\vegabot.sql
```

### Importar base de datos en otro PC/servidor Windows con XAMPP

1. Copiar el archivo `.sql` al proyecto, idealmente dentro de `backups`.
2. Iniciar MySQL en XAMPP.
3. Ejecutar desde la raiz del proyecto:

```powershell
.\importar-bd-vegabot.bat backups\NOMBRE-DEL-DUMP.sql
```

O en modo automatizable/SSH:

```powershell
powershell -ExecutionPolicy Bypass -File .\importar-bd-vegabot.ps1 -DumpPath backups\NOMBRE-DEL-DUMP.sql
```

Comando directo equivalente:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS vegabot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 vegabot < backups\NOMBRE-DEL-DUMP.sql
```

## 10. Usuarios iniciales conocidos

Panel administrativo del bot:

```txt
admin@vega.local
```

Usuarios base de la tienda:

```txt
superadmin@vega.local
admin.tienda@vega.local
cliente@vega.local
```

Las contrasenas deben conservarse en un administrador de credenciales y cambiarse antes de produccion. Las cuentas del panel del bot son independientes de las cuentas de la tienda.

## 11. Checklist despues de migrar

- MySQL inicia correctamente.
- `npm install` completo sin errores.
- `pnpm install` y `pnpm run build` completos en `tienda\front`.
- `npm start` inicia el servidor en puerto 3000.
- `http://localhost:3000/tienda/` abre la tienda.
- `http://localhost:3000/login` abre el login del bot.
- `http://localhost:3000/admin` exige sesion.
- El inventario carga desde SAINT cuando existe conectividad y usa la ultima copia valida o MySQL como respaldo cuando SAINT no esta disponible.
- La vista usuarios de tienda carga desde `store_users`.
- La vista proveedores carga desde `store_suppliers`.
- La vista archivos/videos no muestra error.
- Si se usa Twilio, la URL publica responde en `/webhook/twilio`.
- Si se usa Wompi, probar primero en sandbox.

## 12. Acceso SSH por Cloudflare para migracion

En este equipo se dejo descargado:

```txt
C:\xampp\htdocs\vegabot\tools\cloudflared.exe
```

Tambien se agrego el alias SSH local:

```txt
vega-cloudflare
```

Archivo configurado:

```txt
C:\Users\HUGO\.ssh\config
```

Para usar WinSCP con proxy local:

1. Mantener activo el proxy. Puedes hacerlo con doble clic en:

```txt
C:\xampp\htdocs\vegabot\iniciar-proxy-vega-winscp.bat
```

O manualmente:

```powershell
C:\xampp\htdocs\vegabot\tools\cloudflared.exe access tcp --hostname ssh.vegaimportadoracolombia.com --url 127.0.0.1:2222
```

2. En WinSCP conectar con:

```txt
Protocolo: SFTP
Host: 127.0.0.1
Puerto: 2222
Usuario: admin
Carpeta destino: C:\xampp\htdocs\vegabot
```

No guardar la clave en archivos de texto plano.

## 13. Arquitectura actual

La instalacion productiva actual funciona como una sola aplicacion publicada por Node.js:

```txt
Internet / Cloudflare
        |
        v
Node.js + Express, puerto 3000
        |
        +-- Panel administrativo del bot: public\
        +-- Tienda React/Vite compilada: tienda\front\dist
        +-- API del bot y tienda: server\
        +-- MySQL local: base vegabot
        +-- Twilio WhatsApp
        +-- OpenAI Responses API
        +-- SQL Server SAINT por Radmin VPN
        +-- Wompi y Google OAuth
```

El backend Go y los archivos Docker del proyecto original de la tienda no son necesarios para la instalacion actual. La API efectiva de tienda, autenticacion, archivos, pedidos y pagos esta integrada en el servidor Node principal.

### Tablas MySQL principales

```txt
settings                  Configuracion general cifrada o serializada
admin_users               Usuarios del panel del bot
admin_sessions            Sesiones del panel del bot
store_users               Usuarios de la tienda
customers                 Clientes de WhatsApp y memoria del bot
conversations             Mensajes, adjuntos y eventos del chat
carts                     Carritos activos del bot
cart_items                Productos y precios capturados en el carrito
orders                    Cabecera de pedidos del bot
order_items               Detalle de productos de cada pedido
inventory_reservations    Reservas temporales de inventario
payment_validations       Comprobantes enviados al numero validador
products                  Catalogo local, descripciones y respaldo
product_store_names       Nombres comerciales locales para la tienda
categories                Categorias locales
brands                    Marcas locales
store_product_media       Relacion entre productos e imagenes
store_sales               Ventas de la tienda
store_sale_items          Detalle de ventas de la tienda
store_suppliers           Proveedores de la tienda
saint_invoice_queue       Cola persistente de facturas para SAINT
```

## 14. Inicio, servicio y recuperacion

El servicio principal escucha en:

```txt
Puerto: 3000
Dominio: https://vegaimportadoracolombia.com
```

En el servidor existe la tarea programada:

```txt
VegaBotNode
```

La tarea ejecuta `C:\xampp\htdocs\vegabot\run-vegabot.cmd` con la cuenta `SYSTEM`. El lanzador establece la carpeta correcta, inicia `server\index.js` y conserva las salidas en `logs\server.out.log` y `logs\server.err.log`.

Tambien existen en el escritorio del usuario `admin`:

```txt
validar e iniciar app.bat
validar-e-iniciar-app.ps1
```

Estos scripts comprueban la aplicacion y la inician si esta detenida. Para una recuperacion manual:

```powershell
cd C:\xampp\htdocs\vegabot
npm start
```

Cuando se modifica el frontend de la tienda se debe recompilar:

```powershell
cd C:\xampp\htdocs\vegabot\tienda\front
pnpm run build
```

Comprobaciones rapidas:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
schtasks /Query /TN VegaBotNode /FO LIST
Invoke-WebRequest -UseBasicParsing https://vegaimportadoracolombia.com/tienda/
```

Una respuesta HTTP `200` confirma que la tienda publica esta disponible.

## 15. Roles y accesos

### Panel del bot

- `admin`: acceso completo a clientes, pedidos, facturas, inventario, ajustes y usuarios del panel.
- `asesor_caja`: acceso limitado a Clientes, Pedidos y Facturas.
- La vista y los endpoints validan el rol; ocultar un menu no sustituye la autorizacion del servidor.

### Tienda virtual

- `Super Admin`: administracion completa, usuarios y operaciones sensibles de inventario.
- `Admin`: gestion operativa permitida por la tienda.
- `Usuario/Cliente`: compras, perfil e historial propio.

Los usuarios de tienda (`store_users`) y los usuarios del bot (`admin_users`) no comparten sesiones ni permisos.

## 16. Flujo completo del bot de ventas

1. Twilio envia el mensaje entrante a `POST /webhook/twilio`.
2. El sistema normaliza el numero, identifica o crea el cliente y recupera su memoria.
3. Un saludo se responde de forma natural, sin lanzar inmediatamente todo el catalogo.
4. El asistente identifica la necesidad, corrige variaciones de escritura y consulta productos reales disponibles.
5. Si el producto no existe o no tiene disponibilidad, lo informa claramente sin inventar rutas ni referencias.
6. Si existe, explica que es, para que sirve, como funciona, compatibilidad y caracteristicas usando `bot_features` y `store_description`.
7. Cuando el cliente pide imagenes o una referencia visual, se comparte el enlace directo al producto en la tienda.
8. El cliente puede agregar, quitar, reemplazar o dejar unicamente determinados productos en el carrito.
9. El bot confirma cada cambio, muestra un resumen breve y pregunta si desea agregar algo mas.
10. Expresiones naturales como `eso es todo`, `listo ese seria mi pedido` o equivalentes cierran el carrito sin exigir una frase exacta.
11. Se calcula el precio aplicable y se solicita el metodo de pago.
12. Para transferencia o consignacion se envian los datos bancarios parametrizados y se espera el comprobante.
13. Para efectivo o contraentrega se informa el total y el pago al recibir, segun las condiciones comerciales.
14. Al recibir una imagen de comprobante en el estado esperado, se registra y se envia al numero validador.
15. El validador responde con variantes aceptadas de `VALIDADO`; entonces cambia el estado y se notifica al cliente.
16. Al cierre se solicitan los datos necesarios para despacho: nombre, cedula o NIT, telefono, ciudad, direccion y receptor.
17. El pedido queda disponible en la vista Pedidos para validacion y despacho.
18. El bot sigue atendiendo consultas del pedido y permite iniciar nuevas compras sin alterar pedidos anteriores.
19. La atencion manual solo se activa mediante el control del asesor; finalizar un pedido no la activa automaticamente.

## 17. Inteligencia artificial y memoria

- El proveedor activo es OpenAI mediante Responses API.
- La IA se habilita o deshabilita desde `Ajustes del sistema` sin eliminar el flujo transaccional.
- La configuracion se guarda en `settings`: `aiEnabled`, `aiProvider`, `aiModel`, `aiApiKey`, `aiReasoningEffort` y `aiStyle`.
- El modelo y la llave pueden cambiarse manualmente desde el panel por un administrador.
- La IA interpreta lenguaje natural, errores ortograficos, plurales, intenciones y contexto.
- El servidor conserva el control de precios, stock, carrito, pagos, pedidos y estados. La IA no puede inventar productos ni ejecutar operaciones fuera de las reglas.
- La memoria persistente del cliente se guarda en `customers.bot_memory_json`, junto con `bot_stage` y `active_order_id`.
- Los pedidos terminados permanecen independientes; la memoria conversacional no debe modificar un pedido validado.
- Los audios e imagenes recibidos se almacenan y procesan segun su tipo. Los adjuntos enviados desde el panel quedan registrados en la conversacion.
- Cuando la IA esta deshabilitada o falla, el flujo seguro continua con respuestas controladas.

## 18. Clientes, chats y atencion manual

- La vista Clientes muestra una lista compacta con el nombre y el boton para abrir el chat.
- Cada conversacion se abre en una modal adaptable a movil, tableta y escritorio.
- El chat permite texto, imagenes, audios, videos y documentos.
- El boton Plantillas abre el listado de plantillas aprobadas de Twilio; al elegir una queda preparada para enviar.
- El interruptor `Atencion manual` decide quien responde:
  - Desactivado: responde el bot.
  - Activado: el bot guarda los mensajes pero no contesta automaticamente.
- El numero validador de pagos no puede comprar ni entrar al flujo comercial.
- El numero operativo de notificaciones tampoco crea cliente, chat, carrito o pedido cuando escribe al bot.

## 19. Pedidos, pagos y despacho

- La vista Pedidos muestra registros compactos con numero y cliente.
- El detalle se abre en una modal adaptable, donde se revisan productos, cantidades, precios, pago, datos del cliente y despacho.
- Los pedidos conservan instantaneas de precio y stock en `order_items` para no cambiar historicos cuando cambia el catalogo.
- Los comprobantes de transferencia se guardan en `storage\payment-proofs` y se relacionan mediante `payment_validations`.
- Cuando el validador confirma el pago, el cliente recibe un mensaje indicando que el pago fue recibido y que se prepararan los datos de seguimiento.
- Contraentrega usa el flujo de pago en efectivo y no requiere comprobante previo.
- El inventario no se descuenta al crear, confirmar o validar un pedido.
- La reserva evita sobreventa durante el proceso.
- El stock solo se descuenta cuando el pedido cambia a `Despachado`.
- Si el pedido se cancela, rechaza o anula, la reserva se libera.
- Al registrar transportadora y guia, el sistema notifica al cliente por WhatsApp.

## 20. Inventario, precios y conexion SAINT

### Fuente principal

Cuando `saintInventoryEnabled` esta activo, VegaBot consulta la base `Bodega` de SQL Server SAINT y lee, entre otras, las tablas `SAPROD`, `SAEXIS`, `SAINSTA` y `SACODBAR`.

La lectura entrega codigo, descripcion, categoria, marca, existencia, depositos, codigos alternos y precios. La integracion de inventario no modifica la estructura ni los registros de estas tablas.

### Precios comerciales

- `Precio1`: precio mayorista.
- `Precio2`: precio al detal.
- `Precio3`: ignorado por bot y tienda.
- La tienda muestra visualmente Precio mayorista y Precio detal. El carrito inicia en Precio2 y cambia todo el pedido a Precio1 solamente cuando se cumplen simultaneamente las condiciones mayoristas.
- Precio1 aplica con al menos 2 referencias distintas de 6 unidades o mas cada una, minimo 12 unidades totales y subtotal calculado a Precio2 superior a $300.000.
- Los minimos se parametrizan con `minimumWholesaleReferences`, `minimumWholesaleUnits`, `minimumWholesaleTotalUnits` y `minimumWholesaleAmount`.

### Nombre comercial, referencia, descripciones e imagenes

SAINT aporta datos comerciales y existencia. Las imagenes, descripcion para tienda, caracteristicas para el bot y garantia se conservan localmente en MySQL y `storage`, vinculadas por el codigo del producto. Esto permite enriquecer productos SAINT sin modificar su base de datos.

El nombre original de SAINT se conserva sin modificaciones como nombre canonico para el bot, las busquedas internas, los pedidos y las facturas. La tienda usa un nombre comercial independiente almacenado en `product_store_names`; inicialmente los productos SAINT muestran `SIN NOMBRE` y debajo presentan la descripcion original en formato `Ref: nombre SAINT`. El administrador puede editar despues el nombre comercial desde Inventario o desde la gestion de productos de la tienda.

La busqueda publica consulta codigo, nombre comercial, referencia SAINT, categoria y descripcion, de modo que un producto sigue siendo localizable antes y despues de asignarle su nombre comercial.

### Cache y respaldo cuando SAINT se apaga

- Despues de una lectura exitosa, el inventario SAINT queda en memoria del proceso Node.
- Al vencer `saintInventoryCacheMs`, la aplicacion devuelve inmediatamente la ultima copia y actualiza en segundo plano.
- Si la actualizacion falla, conserva la ultima copia valida para que la tienda no quede vacia.
- Mientras se usa esa copia, precios y existencias pueden estar desactualizados.
- Si Node se reinicia con SAINT apagado, la memoria se pierde y se usa la tabla local `products` de MySQL como respaldo.
- Las imagenes y descripciones locales siguen disponibles aunque SAINT no responda.

Para cambios sensibles de codigo, descripcion, categoria, stock o precios locales se exige la Clave inventario de seis digitos. Solo los roles autorizados pueden usarla.

## 21. Tienda virtual

- La pagina principal publica es `/tienda/` y muestra la marca `Vega Importadora`.
- El icono de robot dirige al login del panel administrativo.
- Desde el login del bot existe el regreso a la tienda.
- Las tarjetas muestran existencias en la parte superior y los dos precios resaltados, compactos y centrados.
- Pulsar la imagen o `Ver` abre la misma ficha rapida sin perder filtros, categoria, busqueda ni posicion del catalogo.
- La ficha abre siempre desde arriba y la galeria no se estira con la longitud de la descripcion.
- El zoom funciona dentro de la misma imagen, sin submodal, con niveles de 100% a 300%, controles visibles y seguimiento del cursor.
- Agregar al carrito muestra una animacion de confirmacion.
- Los pedidos al detal pagan $18.000 de envio cuando el subtotal es de hasta $250.000 y obtienen envio gratis unicamente cuando superan ese valor.
- Los pedidos con Precio1 mayorista pagan $18.000 de envio, aunque el subtotal supere los $250.000.
- Un administrador puede marcar referencias con envio gratis. Este beneficio exonera el pedido solo cuando todas las referencias del carrito tienen la marca; agregar una referencia promocional a un carrito mixto no exonera los demas productos.
- Ninguna cantidad de unidades o referencias exonera el envio por fuera de las reglas anteriores.
- Un administrador puede activar una promocion por producto y parametrizar un porcentaje entre 1% y 99%. El descuento se aplica realmente a Precio1 y Precio2 y se conserva en MySQL sin modificar SAINT.
- El checkout permite datos del cliente, metodo de entrega, comprobantes y Wompi.
- Google OAuth permite registro e inicio de sesion cuando el Client ID y los origenes autorizados coinciden con el dominio.
- Los clientes pueden consultar sus pedidos; administradores y superadministradores ven las ventas segun sus permisos.
- Videos, proveedores y panel de archivos usan MySQL y las carpetas de `storage`.

Nota: el frontend compilado se minifica, pero ningun sitio web puede ocultar por completo el codigo enviado al navegador. Las reglas sensibles, credenciales y validaciones deben permanecer en el servidor.

## 22. Facturas en espera de SAINT

- Tanto el bot como la tienda generan una entrada idempotente en `saint_invoice_queue` al completar una venta.
- La factura se crea en SAINT como Factura G en estado de espera.
- El vendedor usado es `VIRTUAL`, mostrado como `Vendedor virtual` cuando ese codigo existe en SAINT.
- La integracion puede insertar la factura comercial requerida, pero nunca altera la estructura de tablas SAINT.
- La numeracion usa el consecutivo de facturas en espera y debe convivir con facturas creadas directamente desde SAINT sin repetir numeros.
- Si SAINT esta apagado, la factura permanece en cola con error y fecha del siguiente intento.
- Entre las 7:00 p. m. y las 8:00 a. m. no se fuerza la conexion.
- Entre las 8:00 a. m. y las 10:00 a. m. se reintenta cada 10 minutos.
- La vista Facturas del panel muestra exclusivamente facturas originadas por el bot.
- El boton de envio manual reintenta una factura pendiente sin duplicarla.
- Despues de crear la factura se envia una notificacion WhatsApp al numero operativo configurado.
- La cola se considera completa solo cuando la factura y su notificacion quedaron procesadas.

## 23. Ajustes del sistema

La antigua vista `Twilio` se llama ahora `Ajustes del sistema` y organiza la configuracion en modales:

1. `Configuracion Twilio WhatsApp`: Account SID, Auth Token, remitente WhatsApp y Messaging Service SID.
2. `OpenAI conversacional`: habilitar IA, proveedor, modelo, llave, esfuerzo de razonamiento y estilo.
3. `Usuarios del panel del bot`: crear, activar, desactivar, asignar rol y restablecer acceso.
4. `Otros ajustes`: numero validador, minimo mayorista, condiciones comerciales, datos bancarios y Clave inventario.
5. `Webhook para Twilio`: muestra la URL publica lista para copiar y el metodo POST.

Otros valores relevantes guardados en `settings`:

```txt
businessName
publicBaseUrl
dispatchCarriers
paymentTerms
bankInfo
storeGoogleClientId
wompiApiUrl
saintInventoryEnabled
saintSqlServer
saintSqlDatabase
saintSqlUser
saintSqlPassword
saintCodVend
```

Los secretos se almacenan en MySQL y no deben copiarse a este manual, repositorios publicos, capturas ni mensajes.

## 24. Diagnostico y mantenimiento

### La tienda no abre

1. Confirmar MySQL en XAMPP.
2. Confirmar tarea `VegaBotNode` en ejecucion.
3. Confirmar puerto 3000.
4. Ejecutar `validar e iniciar app.bat` desde el escritorio del servidor.
5. Revisar `node-start.err.log`, `node-start.out.log` y la carpeta `logs`.

### El bot no responde

1. Confirmar que el webhook Twilio apunta al dominio publico y usa POST.
2. Confirmar `accountSid`, `authToken` y `whatsappNumber`.
3. Verificar que el cliente no tenga Atencion manual activa.
4. Verificar que el remitente no sea el numero validador ni el numero exclusivo de notificaciones.
5. Verificar OpenAI; si falla, revisar que el flujo controlado siga respondiendo.

### El inventario parece SAINT aunque SAINT esta apagado

Es el comportamiento esperado de continuidad: la ultima lectura valida permanece en memoria. Debe considerarse una copia potencialmente desactualizada hasta recuperar la conexion.

### No se crea una factura SAINT

1. Revisar la vista Facturas y `saint_invoice_queue`.
2. Confirmar horario permitido de reintento.
3. Confirmar Radmin VPN y conectividad hacia SQL Server.
4. Confirmar vendedor `VIRTUAL` y consecutivo de Factura G.
5. Usar el reintento manual una sola vez y revisar el error registrado.

### Una imagen no aparece

1. Confirmar que el archivo existe en `storage\store-uploads\productos`.
2. Confirmar la relacion en `store_product_media`.
3. Confirmar permisos de lectura de la cuenta que ejecuta Node.
4. Respaldar siempre MySQL y `storage` juntos.

## 25. Historial de requisitos agregados

### 2026-07-02

- Se crea este archivo `REQUISITOS.md`.
- Se documenta XAMPP/MySQL como base principal.
- Se documenta Node.js, npm y pnpm.
- Se documentan dependencias backend: express, mysql2, twilio, multer.
- Se documenta compilacion de la tienda con pnpm/Vite.
- Se documentan carpetas de almacenamiento local para comprobantes y archivos de tienda.
- Se documentan credenciales/servicios configurables: Twilio, Wompi y Google OAuth.

### 2026-07-03

- Se agrega requisito operativo `cloudflared` para acceso SSH por Cloudflare Tunnel.
- Se documenta conexion WinSCP via proxy local `127.0.0.1:2222`.
- Se documenta carpeta remota destino `C:\xampp\htdocs\vegabot`.
- Se agrega `iniciar-proxy-vega-winscp.bat` para abrir el proxy local con doble clic.
- Se agregan scripts `exportar-bd-vegabot.bat` e `importar-bd-vegabot.bat`.
- Se agregan scripts PowerShell `exportar-bd-vegabot.ps1` e `importar-bd-vegabot.ps1` para ejecucion por SSH.
- Se documenta el flujo de exportacion/importacion de la base MySQL `vegabot`.

### 2026-07-09

- Las imagenes de productos de la tienda se guardan fisicamente en `storage\store-uploads\productos`.
- La relacion producto-imagen se conserva en MySQL mediante la tabla `store_product_media`.
- Al migrar o restaurar la tienda, se debe respaldar la base `vegabot` y la carpeta `storage` para conservar las imagenes asociadas a cada producto.
- Se agrega `Clave inventario` en la vista Twilio/configuracion. Se guarda como hash en MySQL (`settings.inventoryKeyHash`) y se exige para cambios sensibles de inventario como stock, precios y datos del producto.

### 2026-07-12

- La IA conversacional del bot usa OpenAI Responses API.
- La configuracion activa se guarda en MySQL con `settings.aiProvider = openai`, `settings.aiModel` y `settings.aiApiKey`.
- Gemini deja de ser proveedor activo del bot. Si se migra a otro equipo, configurar una llave OpenAI valida desde la vista Twilio/configuracion.
- El flujo seguro del bot sigue controlando inventario, carrito, pedidos, pagos y estados; OpenAI solo mejora la conversacion y la redaccion final.

### 2026-07-13

- Se agrega ficha comercial para el bot en productos: columna MySQL `products.bot_features`.
- La vista Inventario permite editar `Caracteristicas para el bot` por cada producto.
- El bot usa `bot_features` como fuente principal para explicar que es, para que sirve, como funciona, compatibilidad, validaciones y recomendaciones de venta.
- Se genero una ficha base para productos sin informacion manual. Estas fichas se pueden mejorar desde Inventario y no se sobrescriben si ya tienen contenido.

### 2026-07-15

- El modelo principal de OpenAI para el bot se actualiza a `gpt-5.6`.
- Para modelos GPT-5 se envia `reasoning.effort = low` desde Responses API, buscando mejor comprension sin respuestas largas.
- El panel Twilio/configuracion queda con `gpt-5.6` como valor recomendado para `Modelo OpenAI`.

### 2026-07-25

- Se agrega integracion de inventario en modo solo lectura con SQL Server Saint.
- La fuente externa esperada es `DESKTOP-RS2DMUD\SAINT`, base `Bodega`, usuario SQL configurado en `settings.saintSqlUser`.
- El servidor del bot debe tener conectividad de red hacia el equipo Saint. Actualmente se valido por red local/Radmin VPN.
- Para habilitar inventario Saint se usan settings MySQL: `saintInventoryEnabled`, `saintSqlServer`, `saintSqlDatabase`, `saintSqlUser`, `saintSqlPassword`, `saintInventoryCacheMs`.
- Las facturas en espera creadas por bot o tienda usan el vendedor configurado en `settings.saintCodVend`; por defecto queda `VIRTUAL`. En Saint debe existir el vendedor con codigo `VIRTUAL` y nombre `Vendedor virtual` para que el software lo muestre con ese nombre.
- Al crear una factura en espera desde bot o tienda, el sistema envia una notificacion WhatsApp por Twilio al numero operativo `+573213650721`. Requiere `accountSid`, `authToken` y `whatsappNumber` configurados.
- No se modifica estructura de la base Saint: no se agregan tablas, columnas ni indices. La fase inicial solo lee `SAPROD`, `SAEXIS`, `SAINSTA`, `SACODBAR` y datos relacionados.

### 2026-07-29

- El inventario comercial usa `Precio1` y `Precio2` directamente de `Bodega.dbo.SAPROD`.
- La integracion conserva SQL Server Saint en modo lectura para inventario; no crea ni modifica estructuras en la base Saint.
- `Precio2` es el precio transaccional al detal de la tienda. La interfaz posteriormente se amplio para mostrar tambien `Precio1` como referencia mayorista.
- `Precio1` es mayorista. Tienda y bot lo aplican a todo el carrito cuando existen al menos 2 referencias distintas con 6 unidades o mas cada una, el pedido suma minimo 12 unidades y el subtotal previo a Precio2 supera $300.000.
- Si falla cualquiera de las condiciones, todas las referencias permanecen a `Precio2`.
- `Precio3`, `settings.botPriceLevel` y `settings.storePriceLevel` quedan obsoletos y no participan en catalogos, carritos, pedidos ni facturas.
- Los limites se guardan en `settings.minimumWholesaleReferences`, `settings.minimumWholesaleUnits`, `settings.minimumWholesaleTotalUnits` y `settings.minimumWholesaleAmount`, con valores iniciales `2`, `6`, `12` y `300000`.
- MySQL agrega a `cart_items` las columnas `wholesale_price_snapshot`, `retail_price_snapshot` y `price_tier` para recalcular el carrito al agregar o quitar unidades.
- El backend de la tienda vuelve a consultar SAINT y reemplaza cualquier precio enviado por el navegador con `Precio2` antes de crear la venta, el pago y la factura en espera.
- Para leer precios y existencias en tiempo real, el servidor del bot debe mantener conectividad con la instancia SQL Server configurada y tener habilitado `saintInventoryEnabled`.
- La consulta completa de inventario admite hasta 30 segundos para tolerar latencia de VPN; despues de una lectura exitosa conserva la ultima respuesta de Saint en cache durante el intervalo definido por `saintInventoryCacheMs`.
- Los indicadores `inventorySource`, `saintInventoryStatus`, `saintInventoryCount` y `saintInventoryError` son datos transitorios de diagnostico y no deben guardarse como configuracion permanente.
- Las facturas virtuales se crean en SAINT como `TipoFac = G`, usando el consecutivo de facturas en espera `PrxFactEs`; no se modifica la estructura de la base SAINT.
- MySQL usa la tabla `saint_invoice_queue` como cola persistente para evitar que una factura se pierda cuando SAINT se encuentra apagado o sin conectividad.
- Los pedidos creados entre las 7:00 p. m. y las 8:00 a. m. quedan en cola sin intentar conectarse a SAINT. Los pendientes se reintentan cada 10 minutos entre las 8:00 a. m. y las 10:00 a. m., zona horaria `America/Bogota`.
- Cada factura `G` creada correctamente debe enviar una notificacion por WhatsApp al numero operativo `+573213650721`. La cola solo se completa despues de registrar la factura y enviar esta notificacion.
- El numero `+573213650721` es exclusivamente receptor de notificaciones: cualquier mensaje entrante desde ese numero se ignora y no crea cliente, chat, carrito ni pedido.
- El panel administrativo incluye la vista `Facturas`, ubicada debajo de `Inventario`, y consulta exclusivamente registros de `saint_invoice_queue` cuyo origen sea `bot`.
- Desde la vista `Facturas` se puede forzar manualmente el envio de una factura pendiente a SAINT o reintentar solamente su notificacion cuando la Factura G ya existe.
- El envio manual conserva la idempotencia por origen y pedido: una factura completada no vuelve a crearse y las ventas originadas en la tienda no pueden procesarse desde esta vista.
- El panel administrativo del bot admite los roles `admin` y `asesor_caja` en la tabla MySQL `admin_users`.
- El rol `asesor_caja` solo recibe acceso a las vistas `Clientes`, `Pedidos` y `Facturas`; puede atender chats, validar pedidos y procesar facturas pendientes propias del bot.
- Inventario, configuracion Twilio, credenciales, tienda administrativa y gestion de usuarios requieren el rol `admin`. La restriccion se aplica tanto en la interfaz como en los endpoints del servidor.
- La vista `Twilio` incluye la gestion de usuarios del panel del bot para crear cuentas, asignar los roles permitidos, activar o desactivar accesos y restablecer contrasenas.
- Las cuentas del panel del bot (`admin_users`) son independientes de los usuarios registrados en la tienda virtual.

### 2026-08-01

- `REQUISITOS.md` se amplia como manual completo de instalacion, arquitectura, operacion, ventas, mantenimiento y recuperacion.
- Se documentan todas las tablas MySQL actualmente usadas por bot, tienda, pagos, archivos, reservas y facturacion SAINT.
- Se documenta la tarea programada `VegaBotNode` y los scripts del escritorio `validar e iniciar app.bat` y `validar-e-iniciar-app.ps1`.
- Se aclara el comportamiento de continuidad del inventario: la ultima lectura SAINT permanece en memoria y MySQL funciona como respaldo despues de un reinicio sin conectividad.
- La tienda muestra existencias, Precio mayorista y Precio detal; el cobro cambia de Precio2 a Precio1 cuando el carrito cumple toda la regla mayorista.
- La ficha rapida del producto abre sin perder la busqueda, inicia desde arriba y conserva una galeria de altura independiente de la descripcion.
- El zoom del producto funciona dentro de la misma ficha, sin submodal, con controles de 100% a 600%.
- Se documentan los flujos completos de bot, carrito, pagos, validacion externa, despacho, atencion manual y nuevos pedidos.
- Se documenta la organizacion de `Ajustes del sistema` mediante modales de Twilio, OpenAI, usuarios, otros ajustes y webhook.
- Se eliminan contrasenas de prueba visibles del manual; los secretos deben conservarse fuera del proyecto y la documentacion.
- Se separa el nombre comercial de la tienda del nombre original de SAINT mediante la tabla local `product_store_names`.
- Los productos SAINT sin nombre comercial muestran `SIN NOMBRE` y la tienda presenta debajo `Ref: descripcion SAINT`; esta referencia permanece disponible en las busquedas.
- Se restaura la tarea programada `VegaBotNode` y se agrega `run-vegabot.cmd` como lanzador persistente del servicio Node.
- La tienda y el bot no exoneran el envio por cantidad de unidades. Los pedidos al detal con subtotal superior a $250.000 reciben envio gratis; los pedidos mayoristas pagan $18.000 salvo que todas sus referencias esten marcadas expresamente con envio gratis.
- Los logos de las transportadoras se sirven desde la base publica `/tienda/`; el selector muestra las imagenes reales y usa las iniciales como respaldo si un archivo no puede cargarse.

### 2026-08-03

- MySQL mantiene un espejo persistente del inventario activo de `Bodega.dbo.SAPROD` y sus existencias en `SAEXIS`.
- Cada instantanea SAINT valida y sincroniza de forma transaccional productos, categorias y marcas: crea referencias nuevas, actualiza precios y existencias, y elimina de `products` las referencias que ya no aparecen en SAINT.
- La sincronizacion conserva los datos locales enriquecidos de referencias vigentes, incluidos nombre comercial, imagenes, descripcion de tienda, caracteristicas del bot y garantia.
- Si SAINT no responde, devuelve datos invalidos o entrega una lista vacia, la transaccion no se ejecuta y tienda y bot continuan usando el ultimo espejo MySQL valido.
- El servidor fuerza una actualizacion del espejo cada 60 segundos mientras esta encendido. El intervalo puede cambiarse con `SAINT_MIRROR_INTERVAL_MS`, con un minimo de 30 segundos.
- La tabla local `products` incorpora `cost`, `reference`, `unit` y `barcodes` para conservar los campos de inventario que ya entrega SAINT.
- La base SQL Server SAINT permanece en modo lectura para inventario; el espejo solo modifica la base MySQL `vegabot`.

### 2026-08-04

- El iniciador `run-vegabot.cmd` valida primero MariaDB/MySQL de XAMPP y lo inicia de forma oculta cuando el puerto `3306` no responde.
- El acceso directo `validar e iniciar app.bat` puede iniciar MySQL y Node directamente, como proceso desacoplado, sin ejecutar la tarea `VegaBotNode` ni requerir permisos de administrador.
- El inicio espera hasta 45 segundos por MySQL y hasta 55 segundos por el dashboard; los resultados se registran en `logs/startup.log` y `logs/server.err.log`.

### 2026-08-05

- El visor de imagenes de producto admite zoom tactil con dos dedos entre 100% y 300%; el gesto queda contenido en la imagen y no amplia la pagina completa.
- Las tarjetas publicas del catalogo muestran solamente la imagen, el nombre comercial y los precios mayorista y detal; existencias, referencia SAINT, descripcion y demas detalles permanecen en la ficha del producto.
- La accion rapida para agregar al carrito se conserva como boton de icono sobre la imagen. Los controles de editar y eliminar siguen disponibles exclusivamente para administradores.
- En escritorio, el carrito deja de ocupar una columna lateral y se presenta como una barra flotante centrada en la parte inferior, con cantidad de articulos y subtotal.
- Al abrir el carrito flotante, el resumen completo aparece sobre el catalogo y puede cerrarse sin perder la busqueda ni la posicion del usuario. En movil se conserva el cajon lateral existente.
- Cuando una imagen ya esta ampliada, puede desplazarse con un solo dedo dentro del visor; el gesto se limita al area visible y no activa otro nivel de zoom al soltarla.
- La barra flotante del carrito tambien se muestra centrada en la parte inferior de moviles y tablets. El icono anterior del encabezado movil se elimina y WhatsApp se desplaza hacia arriba para no cubrir el carrito.
- Las tarjetas publicas muestran sobre la imagen las existencias y una accion compacta `Agregar`; cuando queda una sola unidad se identifica como `Ultimo disponible`.
- Los productos con existencia cero no aparecen a clientes en el catalogo, resultados de busqueda, productos similares ni enlaces directos. Los administradores conservan su visibilidad para gestionarlos.
- Las imagenes de las tarjetas usan una escala visual mayor para aprovechar mejor el area disponible sin cambiar la proporcion estable de la cuadricula.
- El selector inicial de pago muestra en `Pagar directo con la empresa` la nota `Pago contraentrega habilitado` antes de continuar al formulario.
- Pago directo admite Nequi, Bancolombia y Contraentrega. Contraentrega se guarda como metodo del pedido y se identifica de forma independiente en las vistas administrativas.
- Los pedidos contraentrega no solicitan ni cargan comprobante de pago; el cliente recibe la indicacion de pagar en efectivo cuando reciba el pedido.

### 2026-08-06

- El envio gratis por valor queda restringido a pedidos al detal cuyo subtotal supere los $250.000.
- Todo pedido que active Precio1 mayorista paga $18.000 de envio sin importar su subtotal o cantidad, salvo la marca administrativa explicita de envio gratis aplicada a todas sus referencias.
- Tienda, checkout directo, Wompi, bot y backend comparten esta misma politica; el backend recalcula el envio antes de guardar la venta.
- Se elimina el mensaje dinamico `Agrega $... mas y tu envio queda gratis`; la interfaz comunica la condicion comercial sin valores residuales confusos.
- MySQL incorpora `products.free_shipping`, `products.promotion_enabled` y `products.promotion_percent`; las marcas se conservan durante la sincronizacion del espejo SAINT.
- El editor de productos ofrece controles administrativos para envio gratis y promocion porcentual. El cliente solo ve las etiquetas comerciales y los precios finales.
- Una promocion descuenta el porcentaje configurado de Precio1 y Precio2; el backend vuelve a calcular el valor antes de crear pedidos, pagos y facturas.
- Las tarjetas publicas conservan sobre la imagen un boton compacto con solo el icono del carrito y presentan `Agregar al carrito` debajo de los precios.
- La busqueda publica incorpora filtros por disponibilidad, existencias minimas y maximas, precio detal, categoria y ordenamiento. Los filtros viajan en la URL para conservarse al navegar o compartir el enlace.
- Los productos con existencia cero vuelven a mostrarse en catalogo, busqueda, sugerencias y ficha. Se identifican como `Agotado - Proximo en llegar` y ninguna accion permite agregarlos al carrito.
- La antigua vista de proveedores pasa a ser el directorio publico de distribuidores autorizados en `/tienda/distributors`, conservando `/tienda/suppliers` por compatibilidad.
- MySQL amplia `store_suppliers` con `image_url` e `is_active`. La lectura de distribuidores activos es publica; crear, editar, desactivar, cargar imagenes o eliminar requiere `admin` o `super_admin`.
- Las imagenes de distribuidores se guardan en `storage/store-uploads/distribuidores` y se sirven desde `/tienda-api/uploads/distribuidores`.
- El filtro del catalogo se cierra de forma controlada antes de navegar a los resultados, tanto en escritorio como en movil.
- El saludo inicial y la respuesta a solicitudes de catalogo incluyen `https://vegaimportadoracolombia.com/tienda/`; la capa conversacional debe conservar enlaces completos sin modificarlos.
- El webhook de Twilio confirma la recepcion inmediatamente y procesa cada conversacion en segundo plano, en orden por numero de WhatsApp. Esto evita tiempos de espera cuando OpenAI o SAINT tardan en responder.
- Los `MessageSid` recientes se deduplican durante una hora para impedir respuestas, carritos o pedidos duplicados por reintentos del webhook.
- Tienda y bot guardan primero la factura en la cola MySQL y ejecutan el intento hacia SAINT en segundo plano durante el horario habilitado. Fuera de horario permanece pendiente para los reintentos de 8:00 a. m. a 10:00 a. m.
- Los errores de conexion con SAINT se guardan resumidos y sin incluir comandos codificados, credenciales ni el contenido completo del pedido.
- Wompi opera en produccion con la URL `https://production.wompi.co/v1` y requiere credenciales `pub_prod_`, `prv_prod_`, `prod_events_` y `prod_integrity_` del mismo comercio.
- La llave privada y los secretos de Wompi se guardan exclusivamente en la tabla MySQL `settings`; el navegador recibe unicamente la llave publica.
- En el panel productivo de Wompi debe configurarse la URL de eventos `https://vegaimportadoracolombia.com/tienda-api/api/wompi/events`.
- El webhook de Wompi valida ambiente y firma SHA-256 usando las propiedades declaradas por cada evento, el timestamp y el secreto de eventos. Las firmas invalidas se rechazan.
- Los eventos `transaction.updated` actualizan el pedido asociado por link o referencia y validan moneda COP y monto exacto antes de aceptar el estado informado por Wompi.
- La consulta de la transaccion al regresar al comercio se conserva como respaldo, pero la confirmacion principal del estado depende del webhook firmado.

### 2026-08-27

- La tienda incorpora un icono de descarga junto a las redes sociales y el acceso al bot. Genera `catalogo-vega-importadora.pdf` bajo demanda desde `GET /tienda-api/api/catalog.pdf`.
- El PDF no se almacena como una copia fija: consulta los productos habilitados, precios, existencias, promociones, envio gratis e imagenes vigentes cada vez que el usuario lo descarga.
- El catalogo usa tarjetas A4 paginadas con precio detal, precio mayorista, referencia, categoria y existencias. Las imagenes se convierten temporalmente a miniaturas JPEG para mantener un archivo descargable liviano.
- El servidor requiere las dependencias Node.js `pdfkit` y `sharp`. En una instalacion nueva deben instalarse con `npm install` desde `C:\xampp\htdocs\vegabot` antes de iniciar el servicio.
- La tienda funciona como PWA instalable para vendedores. El manifiesto se entrega en `/tienda/manifest.webmanifest` y el service worker en `/tienda-sw.js` con alcance de todo el dominio.
- El icono de telefono junto al catalogo PDF abre `App para vendedores`: permite instalar la app cuando el navegador lo admite y descargar manualmente productos, categorias, precios, existencias e imagenes para uso local.
- Al no haber conexion, la PWA usa la ultima copia descargada del catalogo y conserva el carrito local. Pagos, validacion de stock, facturacion SAINT y confirmacion de pedido continúan requiriendo conexion para evitar ventas con informacion desactualizada.

### 2026-09-10

- El codigo fuente se administra con Git y se publica en un repositorio privado de GitHub.
- Git 2.55 o superior debe estar instalado en los equipos desde los que se desarrollen o desplieguen cambios.
- Nunca se versionan archivos `.env`, bases de datos, copias SQL, logs, comprobantes, chats, facturas, archivos subidos, dependencias ni compilaciones generadas.
- Las credenciales de MySQL, SAINT, Twilio, OpenAI, Google y Wompi deben configurarse fuera del repositorio, mediante variables de entorno o el panel administrativo respaldado por MySQL.
- Las imagenes y videos cargados en `storage/store-uploads` son datos operativos y deben respaldarse por separado; GitHub conserva el codigo que los gestiona, no los archivos cargados.
