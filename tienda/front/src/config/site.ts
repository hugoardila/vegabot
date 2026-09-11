export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Vega",
  description: "Sistema de punto de venta y catálogo digital para tienda de tecnología.",
  navItems: [
    {
      label: "Inicio",
      href: "/",
    },
    {
      label: "Ruleta",
      href: "/roulette",
    },
    {
      label: "Distribuidores",
      href: "/distributors",
    },
  ],
  navMenuItems: [
    {
      label: "Dashboard",
      href: "/",
    },
    {
      label: "Ruleta",
      href: "/roulette",
    },
    {
      label: "Distribuidores",
      href: "/distributors",
    },
    {
      label: "Checkout",
      href: "/checkout",
    },
    {
      label: "Mi Cuenta",
      href: "/profile",
    },
    {
      label: "Cerrar Sesión",
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/tu-usuario/tienda-digital",
    whatsapp: "https://wa.me/573123756979",
    support: "https://wa.me/573123756979?text=Hola,%20necesito%20soporte%20técnico",
  },
};
