# 📋 Modal de Términos y Condiciones - Información

## ✅ ¿Qué hace este modal?

El modal de términos y condiciones aparece **automáticamente la primera vez** que un usuario visita tu tienda en línea.

## 👥 ¿Quién ve el modal?

### ✅ SÍ ven el modal:
- **Clientes** (usuarios con rol "cliente")
- **Invitados** (usuarios sin cuenta, navegando sin login)

### ❌ NO ven el modal:
- **Admins** (usuarios con rol "admin")
- **Super Admins** (usuarios con rol "super_admin")

**Razón:** Los administradores ya conocen las políticas de la tienda y no necesitan aceptarlas cada vez.

## 🔄 Flujo del Modal

```
Usuario entra al sitio
        ↓
¿Es admin o super_admin?
   ↓              ↓
  SÍ             NO
   ↓              ↓
NO muestra     Espera 1 seg
  modal            ↓
                ¿Ya aceptó?
                   ↓
                  NO
                   ↓
              Muestra modal
                   ↓
         Usuario lee y acepta
                   ↓
       Guarda en localStorage
                   ↓
         Puede usar la tienda
```

## 🔧 Implementación Técnica

El modal verifica el rol del usuario antes de mostrarse:

```typescript
useEffect(() => {
  // No mostrar el modal si el usuario es admin o super_admin
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  
  if (isAdmin) {
    return; // Los admins no ven el modal
  }

  // Para clientes e invitados, verificar si ya aceptaron
  const hasAccepted = localStorage.getItem(TERMS_ACCEPTED_KEY);
  if (!hasAccepted) {
    setTimeout(() => setIsOpen(true), 1000);
  }
}, [user]);
```

## 📦 Características

✅ **Aparece solo una vez** por navegador (usa localStorage)  
✅ **No se puede cerrar** sin aceptar  
✅ **Dos checkboxes obligatorios:**
   - Términos y Condiciones
   - Política de Privacidad

✅ **Dos botones:**
   - 🔴 **Rechazar y Salir** - Muestra alerta
   - 🟢 **Aceptar y Continuar** - Solo activo si marca ambos checkboxes

✅ **Contenido scrollable** con toda la información legal  
✅ **Responsive** - Funciona en móvil, tablet y desktop  
✅ **Dark mode** - Compatible con tema claro y oscuro

## 💾 Datos Guardados

Cuando el usuario acepta, se guarda en localStorage:

```json
{
  "accepted": true,
  "date": "2026-06-14T10:30:00.000Z",
  "version": "1.0"
}
```

## 🧪 Cómo Probarlo

### Ver el modal como cliente/invitado:

1. **Opción 1 - Navegador incógnito:**
   - Abre ventana incógnita
   - Ve a tu sitio **sin iniciar sesión**
   - Verás el modal

2. **Opción 2 - Borrar localStorage:**
   - F12 → Console
   - Escribe: `localStorage.removeItem("terms_accepted")`
   - Recarga la página

3. **Opción 3 - Crear cuenta de cliente:**
   - Crea una cuenta normal (no admin)
   - Verás el modal

### NO verás el modal si:

❌ Inicias sesión como admin  
❌ Inicias sesión como super_admin  

## ⚖️ Cumplimiento Legal

Este modal cumple con:

✅ **Ley 1581 de 2012** (Habeas Data) - Autorización de tratamiento de datos  
✅ **Ley 1480 de 2011** (Estatuto del Consumidor) - Información clara  
✅ **Decreto 1377 de 2013** - Consentimiento expreso e informado

## 📝 Contenido del Modal

### Términos y Condiciones (Resumido):
1. Aceptación de términos
2. Productos y servicios
3. Garantías (12 meses / 3 meses / 30 días)
4. Derecho de retracto (5 días hábiles)
5. Pagos con Wompi
6. Comentarios y moderación
7. Propiedad intelectual
8. Ley aplicable

### Política de Privacidad (Resumido):
1. Ley 1581/2012 (Habeas Data)
2. Datos que recopilamos
3. Google OAuth (sin acceso a contraseñas)
4. NO almacenamos datos de tarjetas
5. Derechos de los titulares
6. Seguridad (SSL, cifrado)
7. Cookies
8. Conservación de datos

## 🎯 Casos de Uso

### Caso 1: Usuario nuevo (invitado)
```
Entra al sitio → Ve el modal → Acepta → Puede navegar
```

### Caso 2: Usuario registrado (cliente)
```
Primera vez → Ve el modal → Acepta → No lo ve más
```

### Caso 3: Admin
```
Inicia sesión como admin → NO ve el modal → Accede directo
```

### Caso 4: Usuario que ya aceptó
```
Entra al sitio → localStorage verifica → NO ve el modal
```

## 🔄 Actualización de Términos

Si actualizas los términos y quieres que los usuarios los vuelvan a aceptar:

1. Cambia la versión en el código:
```typescript
version: "2.0"  // Antes era "1.0"
```

2. Cambia la clave del localStorage:
```typescript
const TERMS_ACCEPTED_KEY = "terms_accepted_v2";
```

Los usuarios verán el modal nuevamente.

## 📍 Archivos del Proyecto

```
front/src/components/organisms/
└── TermsModal.tsx  ← El modal completo

front/src/components/templates/
└── MainLayout.tsx  ← Donde se integra

Documentos legales completos:
├── TERMINOS_Y_CONDICIONES.md
└── POLITICA_DE_PRIVACIDAD.md
```

## ✅ Estado Actual

- ✅ Modal implementado y funcional
- ✅ Solo aparece a clientes e invitados
- ✅ NO aparece a admins
- ✅ Guarda evidencia de aceptación
- ✅ Cumple con legislación colombiana
- ✅ Build compilando sin errores

---

**¡Todo listo para usar en producción!** 🚀

**Fecha:** 14 de junio de 2026  
**Versión:** 1.0  
**Framework:** React + TypeScript + HeroUI
