const storeAsset = (path: string) => {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  return `${baseUrl}${path.replace(/^\/+/, "")}`;
};

export interface CarrierOption {
  id: string;
  name: string;
  img: string;
}

export const CARRIERS: CarrierOption[] = [
  { id: "servientrega", name: "Servientrega", img: storeAsset("img/transportadora/servientrega-seeklogo.png") },
  { id: "estelar", name: "Estelar Expres", img: storeAsset("img/transportadora/channels4_profile.jpg") },
  { id: "envia", name: "Envía", img: storeAsset("img/transportadora/envia-mensajeria-logo-png_seeklogo-311137.png") },
  { id: "taxisverdes", name: "Taxis Verdes", img: storeAsset("img/transportadora/images.jpg") },
  { id: "transcarga", name: "Transcarga Mundial", img: storeAsset("img/transportadora/1200x630wa.jpg") },
  { id: "transprensa", name: "Transprensa", img: storeAsset("img/transportadora/images.png") },
  { id: "coomotor", name: "Coomotor", img: storeAsset("img/transportadora/coomotor-logo-png_seeklogo-204653.png") },
  { id: "coordinadora", name: "Coordinadora", img: storeAsset("img/transportadora/COORDINADORA-01.jpg") },
  { id: "472", name: "472", img: storeAsset("img/transportadora/4-72_logo.svg.png") },
];
