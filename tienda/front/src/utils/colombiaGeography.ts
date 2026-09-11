/**
 * Datos geográficos completos de Colombia
 * Departamentos y municipios actualizados según DANE
 */

export const COLOMBIA_DEPARTMENTS: string[] = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada"
];

export const MUNICIPALITIES_BY_DEPARTMENT: Record<string, string[]> = {
  "Amazonas": [
    "Leticia", "El Encanto", "La Pedrera", "La Victoria", "Mirití-Paraná",
    "Puerto Alegría", "Puerto Arica", "Puerto Nariño", "Puerto Santander",
    "Tarapacá", "Chorrera", "Pacoa"
  ],
  "Antioquia": [
    "Medellín", "Abejorral", "Abriaquí", "Alejandría", "Amagá", "Amalfi",
    "Andes", "Angelópolis", "Angostura", "Anorí", "Antioquia", "Anzá",
    "Apopa", "Arboletes", "Argelia", "Armenia", "Barbosa", "Belmira",
    "Bello", "Beltrán", "Betania", "Betulia", "Briceño", "Buriticá",
    "Cáceres", "Caicedo", "Caldas", "Campamento", "Cañasgordas", "Caracolí",
    "Caramanta", "Carolina", "Caucasia", "Chigorodó", "Chinchiná", "Cisneros",
    "Ciudad Bolívar", "Cocorná", "Concepción", "Concordia", "Copacabana",
    "Coper", "Dabeiba", "Don Matías", "El Bagre", "El Carmen de Viboral",
    "El Peñol", "El Retén", "El Santuario", "Entrerríos", "Envigado",
    "Fredonia", "Frontino", "Giraldo", "Gómez Plata", "Granada", "Guadalupe",
    "Guarne", "Guatapé", "Guarne", "Heliconia", "Hispania", "Itagüí",
    "Ituango", "Jardín", "Jericó", "La Ceja", "La Estrella", "La Pintada",
    "La Unión", "Liborina", "Maceo", "Marinilla", "Medellín", "Montebello",
    "Murindó", "Mutatá", "Nariño", "Nechí", "Necoclí", "Nariño",
    "Olaya", "Peque", "Pueblorrico", "Puerto Berrío", "Puerto Nare",
    "Puerto Triunfo", "Remedios", "Rionegro", "Sabanalarga", "Sabaneta",
    "Salgar", "San Andrés de Cuerquia", "San Carlos", "San Félix", "San Francisco",
    "San Jerónimo", "San José de la Montaña", "San Juan de Urabá", "San Luis",
    "San Pedro", "San Pedro de los Milagros", "San Rafael", "San Roque",
    "Santa Bárbara", "Santa Fe de Antioquia", "Santa Rosa de Osos", "Santo Domingo",
    "Sonsón", "Sopetrán", "Támesis", "Tarazá", "Tarso", "Titiribí", "Toledo",
    "Turbo", "Uramita", "Urrao", "Valdivia", "Valparaíso", "Vegachí",
    "Venecia", "Vigía del Fuerte", "Yalí", "Yarumal", "Yolombó", "Yondó",
    "Zaragoza", "Apartadó", "Carepa", "Chigorodó", "Turbo", "Necoclí"
  ],
  "Arauca": [
    "Arauca", "Arauquita", "Cravo Norte", "Fortul", "Puerto Rondón", "Saravena", "Tame"
  ],
  "Atlántico": [
    "Barranquilla", "Baranoa", "Campo de la Cruz", "Candelaria", "Galapa",
    "Juan de Acosta", "Luruaco", "Malambo", "Manatí", "Palmar de Varela",
    "Piojó", "Polonuevo", "Ponedera", "Puerto Colombia", "Repelón", "Sabanagrande",
    "Sabanalarga", "Santa Lucía", "Santo Tomás", "Soledad", "Suan", "Usiacurí"
  ],
  "Bolívar": [
    "Cartagena", "Achí", "Altos del Rosario", "Arenal", "Arjona", "Arroyo Hondo",
    "Barranco de Loba", "Calamar", "Cantagallo", "Cartagena", "Cicuco",
    "Clemencia", "Córdoba", "Cruz del Viso", "El Carmen de Bolívar", "El Guamo",
    "El Peñón", "Hatillo de Loba", "Isabel López", "Magangué", "Mahates",
    "Margarita", "María La Baja", "Mompós", "Montecristo", "Morales",
    "Norosí", "Pinillos", "Regidor", "Río Viejo", "San Cristóbal", "San Estanislao",
    "San Fernando", "San Jacinto", "San Jacinto del Cauca", "San Juan Nepomuceno",
    "San Martín de Loba", "San Pablo", "Santa Ana", "Santa Catalina", "Santa Rosa",
    "Santa Rosa del Sur", "Simití", "Soplaviento", "Talaigua Nuevo", "Tiquisio",
    "Turbaco", "Turbana", "Villanueva", "Zambrano", "María La Baja", "Arjona",
    "El Carmen de Bolívar", "Magangué", "Turbaco", "Turbana"
  ],
  "Boyacá": [
    "Tunja", "Almeida", "Aquitania", "Arcabuco", "Berbeo", "Boyacá", "Busbanzá",
    "Cabrera", "Chita", "Chiquinquirá", "Chiscas", "Chíquiza", "Chivor", "Ciénega",
    "Coper", "Covarachía", "Cubará", "Cucaita", "Cuítiva", "Duitama", "El Cocuy",
    "El Espino", "Firavitoba", "Floresta", "Gámeza", "Garagoa", "Guacamayas",
    "Güicán", "Guayatá", "Iza", "Jericó", "Labranzagrande", "La Capilla",
    "La Victoria", "Macanal", "Maripí", "Miraflores", "Moniquirá", "Mongua",
    "Monguí", "Motavita", "Muzo", "Nobsa", "Nuevo Colón", "Oiba", "Pachavita",
    "Páez", "Paipa", "Pajarito", "Panqueba", "Paya", "Paz de Río", "Pesca",
    "Pisba", "Puerto Boyacá", "Quípama", "Ráquira", "Rondón", "Saboyá", "Sáchica",
    "Samacá", "San Eduardo", "San José de Pare", "San Luis de Gaceno", "San Mateo",
    "San Miguel de Sema", "San Pablo de Borbur", "Santa María", "Santa Rosa de Viterbo",
    "Santa Sofía", "Sativanorte", "Sativasur", "Sogamoso", "Soatá", "Socha",
    "Socotá", "Sogamoso", "Sora", "Soracá", "Sotaquirá", "Susacón", "Sutamarchán",
    "Sutatenza", "Tasco", "Tenza", "Tibasosa", "Tinjacá", "Tipacoque", "Toca",
    "Togüí", "Topaga", "Tota", "Tunja", "Tununguá", "Turmequé", "Tuta", "Tutazá",
    "Úmbita", "Ventaquemada", "Villa de Leyva", "Viracachá", "Zetaquira"
  ],
  "Caldas": [
    "Manizales", "Aguadas", "Anserma", "Aranzazu", "Belalcázar", "Chinchiná",
    "Filadelfia", "La Dorada", "Manzanares", "Marulanda", "Marmato", "Marulanda",
    "Neira", "Norcasia", "Pácora", "Palestina", "Pensilvania", "Riosucio",
    "Risaralda", "Salamina", "Samaná", "Supía", "Victoria"
  ],
  "Caquetá": [
    "Florencia", "Albania", "Belén de los Andaquíes", "Cartagena del Chairá",
    "Curillo", "El Doncello", "El Paujil", "Florencia", "La Montañita", "Milán",
    "Morelia", "Puerto Rico", "San José del Fragua", "Solano", "Solita", "Valparaíso"
  ],
  "Casanare": [
    "Yopal", "Aguazul", "Chámeza", "Hato Corozal", "La Salina", "Maní", "Monterrey",
    "Nunchía", "Orocué", "Paz de Ariporo", "Pore", "Recetor", "Sácama", "San Luis de Palenque",
    "Tauramena", "Trinidad", "Villanueva", "Yopal"
  ],
  "Cauca": [
    "Popayán", "Almaguer", "Argelia", "Balboa", "Bolívar", "Buenos Aires",
    "Cajibío", "Caldono", "Caloto", "Corinto", "El Tambo", "Florencia", "Guapi",
    "Inzá", "Jambaló", "La Sierra", "López de Micay", "Mercaderes", "Mojarras",
    "Morales", "Mora", "Padilla", "Páez", "Patía", "Piamonte", "Piendamó",
    "Popayán", "Puerto Tejada", "Puracé", "Rosas", "San Sebastián", "Santander de Quilichao",
    "Santa Rosa", "Silvia", "Sotará", "Suárez", "Timbío", "Toribío", "Totoró",
    "Villa Rica"
  ],
  "Cesar": [
    "Valledupar", "Aguachica", "Agustín Codazzi", "Astrea", "Becerril", "Bosconia",
    "Chimichagua", "Chiriguaná", "Curumaní", "El Copey", "El Paso", "Gamarra",
    "González", "La Gloria", "La Jagua de Ibirico", "Manaure", "Pailitas", "Pelaya",
    "Pueblo Bello", "Río de Oro", "San Alberto", "San Diego", "San Martín", "Tamalameque",
    "Valledupar"
  ],
  "Chocó": [
    "Quibdó", "Acandí", "Alto Baudó", "Atrato", "Bagadó", "Bahía Solano",
    "Bajo Baudó", "Bojayá", "Carmen del Darién", "Cértegui", "Condoto", "El Cantón de San Pablo",
    "El Litoral del San Juan", "Istmina", "Juradó", "Lloró", "Medio Atrato",
    "Medio Baudó", "Medio San Juan", "Nóvita", "Nuquí", "Quibdó", "Río Ira", "Río Quito",
    "Riosucio", "Sipí", "Tadó", "Unguía", "Unión Panamericana"
  ],
  "Córdoba": [
    "Montería", "Ayapel", "Buenavista", "Canalete", "Cereté", "Chimá",
    "Chinú", "Ciénaga de Oro", "Cotorra", "La Apartada", "Lorica", "Los Córdobas",
    "Momil", "Montería", "Moñitos", "Planeta Rica", "Pueblo Nuevo", "Puerto Escondido",
    "Purísima", "Sahagún", "San Andrés de Sotavento", "San Antero", "San Bernardo del Viento",
    "San Carlos", "San José de Uré", "San Pelayo", "Santa Cruz de Lorica", "Tuchín",
    "Valencia"
  ],
  "Cundinamarca": [
    "Bogotá", "Albania", "Almeida", "Apulo", "Arbeláez", "Beltrán", "Bojacá",
    "Cabrera", "Cachipay", "Cajicá", "Caparrapí", "Cáqueza", "Carmen de Carupa",
    "Chaguaní", "Chía", "Chipaque", "Choachí", "Chocontá", "Cogua", "Cota",
    "Cucunubá", "El Colegio", "El Peñón", "El Rosal", "Facatativá", "Fómeque",
    "Fosca", "Funza", "Fuquene", "Gachancipá", "Gachetá", "Guaduas", "Guasca",
    "Guataquí", "Guayabal de Síquima", "Gutierrez", "Jerusalén", "Junín", "La Calera",
    "La Mesa", "La Palma", "La Peña", "Lenguazaque", "López", "Madrid", "Manta",
    "Medina", "Mosquera", "Nariño", "Nemocón", "Nilo", "Nomón", "Pacho", "Pandi",
    "Paratebueno", "Pasca", "Puerto Salgar", "Quebradanegra", "Quetame", "Quipile",
    "Ricaurte", "San Antonio del Tequendama", "San Bernardo", "San Cayetano", "San Francisco",
    "San Juan de Río Seco", "Sasaima", "Sesquilé", "Sibaté", "Silvania", "Simijaca",
    "Soacha", "Subachoque", "Suesca", "Supatá", "Sutatenza", "Tabio", "Tausa",
    "Tena", "Tenjo", "Tibacuy", "Tocaima", "Tocancipá", "Topaipí", "Ubalá", "Ubaque",
    "Une", "Utica", "Venieta", "Vergara", "Villapinzón", "Villeta", "Viotá", "Yacopí",
    "Zipacón", "Zipaquirá"
  ],
  "Guainía": [
    "Inírida", "Barranco Minas", "Cacahual", "La Guadalupe", "Mapiripana", "Morichal",
    "Pana Pana", "Puerto Colombia", "San José del Guaviare"
  ],
  "Guaviare": [
    "San José del Guaviare", "Calamar", "El Retorno", "Miraflores"
  ],
  "Huila": [
    "Neiva", "Acevedo", "Agrado", "Aipe", "Algeciras", "Altamira", "Baraya",
    "Campoalegre", "Colombia", "Elías", "Garzón", "Gigante", "Guadalupe", "Hobo",
    "Iquira", "Isnos", "La Argentina", "La Plata", "Nátaga", "Neiva", "Oporapa",
    "Paicol", "Palermo", "Palestina", "Pital", "Pitalito", "Rivera", "Saladoblanco",
    "San Agustín", "Santa María", "Suaza", "Tarqui", "Tello", "Teruel", "Tesalia",
    "Timaná", "Villavieja", "Yaguará"
  ],
  "La Guajira": [
    "Riohacha", "Albania", "Barrancas", "Dibulla", "El Molino", "Fonseca",
    "Hatonuevo", "La Jagua del Pilar", "Maicao", "Manaure", "Riohacha", "San Juan del Cesar",
    "Uribia", "Urumita", "Villanueva"
  ],
  "Magdalena": [
    "Santa Marta", "Algarrobo", "Aracataca", "Ariguaní", "Cerro de San Antonio",
    "Chibolo", "Ciénaga", "Concordia", "El Banco", "El Piñón", "El Retén",
    "Fundación", "Guamal", "Pedraza", "Pivijay", "Plato", "Pueblo Viejo",
    "Remolino", "Sabanas de San Ángel", "Salamina", "San Ángel", "Santa Bárbara de Pinto",
    "Santa Marta", "Sitionuevo", "Tenerife", "Zapayán", "Zona Bananera"
  ],
  "Meta": [
    "Villavicencio", "Acacías", "Barranca de Upía", "Cabuyaro", "Castilla la Nueva",
    "Cubarral", "Cumaral", "El Calvario", "El Castillo", "El Dorado", "Fuente de Oro",
    "Granada", "Guamal", "La Macarena", "Lejanías", "Mapiripán", "Mesetas",
    "Puerto Concordia", "Puerto Gaitán", "Puerto Lleras", "Puerto López", "Restrepo",
    "San Carlos de Guaroa", "San Juan de Arama", "San Martín", "Uribe", "Villavicencio",
    "Vista Hermosa"
  ],
  "Nariño": [
    "Pasto", "Albán", "Aldana", "Ancuyá", "Arboleda", "Barbacoas", "Belén",
    "Buesaco", "Chachagüí", "Colón", "Consacá", "Contadero", "Córdoba", "Cuaspud",
    "Cumbal", "Cumbitara", "El Charco", "El Peñol", "El Rosal", "El Tambo",
    "Funes", "Guachucal", "Guaitarilla", "Gualmatán", "Iles", "Imués", "Ipiales",
    "La Cruz", "La Florida", "La Llanada", "La Unión", "Leiva", "Linares",
    "Los Andes", "Magüí", "Mallama", "Mosquera", "Nariño", "Ospina", "Pasto",
    "Policarpa", "Potosí", "Providencia", "Puerres", "Pupiales", " Ricaurte",
    "Robles", "Samaniego", "San Andrés de Tumaco", "San Bernardo", "San Lorenzo",
    "San Pablo", "San Pedro de Cartago", "Sandoná", "Santa Bárbara", "Santacruz",
    "Sapuyes", "Taminango", "Tangua", "Tuquerres", "Yacuanquer"
  ],
  "Norte de Santander": [
    "Cúcuta", "Ábrego", "Arboledas", "Bochalema", "Bucarasica", "Cáchira",
    "Cácota", "Chinácota", "Chitagá", "Convención", "Cúcuta", "El Carmen",
    "El Zulia", "Durania", "El Tarra", "Gramal", "Hacarí", "Herrán", "Labateca",
    "La Esperanza", "La Playa", "Los Patios", "Lourdes", "Mutiscua", "Ocaña",
    "Pamplona", "Pamplonita", "Puerto Santander", "Ragonvalia", "Salazar",
    "San Calixto", "San Cayetano", "Santiago", "Sardinata", "Silos", "Teorama",
    "Tibú", "Toledo", "Villa Caro", "Villa del Rosario"
  ],
  "Putumayo": [
    "Mocoa", "Colón", "Orito", "Puerto Asís", "Puerto Caicedo", "Puerto Guzmán",
    "Puerto Leguízamo", "San Francisco", "San Miguel", "Santiago", "Valle del Guamuez",
    "Villagarzón"
  ],
  "Quindío": [
    "Armenia", "Armenia", "Buenavista", "Calarcá", "Circasia", "Córdoba",
    "Filandia", "Génova", "La Celia", "La Tebaida", "Montenegro", "Pijao",
    "Quimbaya", "Salento"
  ],
  "Risaralda": [
    "Pereira", "Apía", "Balboa", "Belén de Umbría", "Dosquebradas", "Guática",
    "La Celia", "Marsella", "Mistrató", "Pereira", "Pueblo Rico", "Quinchía",
    "Santa Rosa de Cabal", "Santuario"
  ],
  "San Andrés y Providencia": [
    "San Andrés", "Providencia"
  ],
  "Santander": [
    "Bucaramanga", "Aguada", "Albania", "Aratoca", "Barbosa", "Barichara",
    "Barrancabermeja", "Betulia", "Bucaramanga", "Bucarasica", "Cabrera",
    "California", "Capitanejo", "Carcasí", "Cepitá", "Cerrito", "Charalá",
    "Chitaraque", "Chimá", "Cimitarra", "Concepción", "Confines", "Contratación",
    "Coromoro", "Curití", "El Carmen de Chucurí", "El Guacamayo", "El Peñón",
    "Encino", "Floridablanca", "Floridablanca", "Galán", "Girón", "Girón",
    "Guaca", "Guadalupe", "Guapotá", "Guavatá", "Guepsa", "Hato", "Jesús María",
    "Jordan", "La Belleza", "La Paz", "Landázuri", "Lebrija", "Los Santos",
    "Macaravita", "Málaga", "Matanza", "Mogotes", "Molagavita", "Ocamonte",
    "Onzaga", "Palmar", "Palmas del Socorro", "Páramo", "Piedecuesta", "Pinchote",
    "Puente Nacional", "Puerto Parra", "Puerto Wilches", "Rionegro", "Sabana de Torres",
    "San Andrés", "San Benito", "San Gil", "San Joaquín", "San José de Miranda",
    "San Miguel", "San Vicente de Chucurí", "Santa Bárbara", "Santa Helena del Opón",
    "Simacota", "Socorro", "Suaita", "Suratá", "Tona", "Valle de San José",
    "Vetas", "Villanueva", "Zapatoca"
  ],
  "Sucre": [
    "Sincelejo", "Buenavista", "Caimito", "Chalán", "Colosó", "Corozal",
    "Coveñas", "El Guamo", "Galeras", "Guaranda", "La Unión", "Los Palmitos",
    "Majagual", "Morroa", "Ovejas", "Palmito", "Palmito", "Sampués", "San Benito Abad",
    "San Juan de Betulia", "San Luis de Sincé", "San Marcos", "San Onofre", "San Pedro",
    "Since", "Sincelejo", "Sincé", "Sucre", "Tolú", "Tolú Viejo"
  ],
  "Tolima": [
    "Ibagué", "Alpujarra", "Ambalema", "Anzoátegui", "Armero", "Ataco",
    "Cajamarca", "Carmen de Apicalá", "Casabianca", "Chaparral", "Coello",
    "Coyaima", "Cunday", "Espinal", "Falan", "Flandes", "Fresno", "Guamo",
    "Herveo", "Honda", "Ibagué", "Icononzo", "Lérida", "Líbano", "Melgar",
    "Murillo", "Natagaima", "Ortega", "Palocabildo", "Piedras", "Planadas",
    "Prado", "Purificación", "Rioblanco", "Roncesvalles", "Rovira", "Saldaña",
    "San Antonio", "San Luis", "San Sebastián", "Santa Isabel", "Santana",
    "Venadillo", "Villahermosa", "Villarrica"
  ],
  "Valle del Cauca": [
    "Cali", "Alcalá", "Andalucía", "Ansermanuevo", "Argelia", "Bolívar",
    "Buenaventura", "Buga", "Bugalagrande", "Caicedonia", "Cali", "Candelaria",
    "Cartago", "Dagua", "El Águila", "El Cairo", "El Cerrito", "El Dovio",
    "Florida", "Ginebra", "Guacarí", "Guadalajara de Buga", "Jamundí", "La Cumbre",
    "La Unión", "La Victoria", "Obando", "Palmira", "Pradera", "Restrepo",
    "Riofrío", "Roldanillo", "San Pedro", "Sevilla", "Tuluá", "Trujillo",
    "Ulloa", "Versalles", "Vijes", "Villa Rica", "Yotoco", "Yumbo", "Zarzal"
  ],
  "Vaupés": [
    "Mitú", "Carurú", "Pacoa", "Taraira", "Yavaraté"
  ],
  "Vichada": [
    "Puerto Carreño", "Cumaribo", "La Primavera", "Puerto Carreño", "Río Negro",
    "Santa Rosalía"
  ]
};

/**
 * Obtiene la lista de municipios de un departamento específico
 * @param departmentName - Nombre del departamento (ej: "Antioquia", "Huila")
 * @returns Array de strings con los nombres de los municipios, o array vacío si no existe
 */
export function getMunicipalitiesByDepartment(departmentName: string): string[] {
  return MUNICIPALITIES_BY_DEPARTMENT[departmentName] || [];
}

/**
 * Verifica si un departamento existe en la lista
 * @param departmentName - Nombre del departamento a verificar
 * @returns true si el departamento existe, false en caso contrario
 */
export function isValidDepartment(departmentName: string): boolean {
  return COLOMBIA_DEPARTMENTS.includes(departmentName as any);
}

/**
 * Obtiene todos los departamentos de Colombia
 * @returns Array con los nombres de todos los departamentos
 */
export function getAllDepartments(): readonly string[] {
  return COLOMBIA_DEPARTMENTS;
}
