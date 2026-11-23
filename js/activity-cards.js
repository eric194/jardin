// Cartes d'activités illustrées et bannières vectorielles architecturales
// pour les 23 points d'intérêt du Jardin Grand Standing de Thiès.

function esc(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Illustrations de vignettes (48x48) pour chaque type d'activité
function renderActivityThumbSvg(iconKey) {
  const icons = {
    soccer: `
      <rect x="6" y="10" width="36" height="28" rx="4" fill="#ebe3d4" stroke="#8a7c6a" stroke-width="1.3"/>
      <line x1="24" y1="10" x2="24" y2="38" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="24" cy="24" r="5" fill="none" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="24" cy="24" r="2.2" fill="#a64234"/>`,
    training: `
      <circle cx="24" cy="24" r="14" fill="#f3ece0" stroke="#c8bcab" stroke-width="1.2"/>
      <circle cx="24" cy="24" r="7.5" fill="none" stroke="#a64234" stroke-width="1.8" stroke-dasharray="4 3"/>
      <circle cx="24" cy="24" r="2.6" fill="#2b313a"/>`,
    sprint: `
      <rect x="5" y="13" width="38" height="22" rx="4" fill="#c67360"/>
      <path d="M5 20.5h38M5 27.5h38" stroke="#f8f5ef" stroke-width="1.2" opacity="0.85"/>
      <line x1="34" y1="13" x2="34" y2="35" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="24" r="2.3" fill="#2b313a"/>`,
    chrono: `
      <circle cx="24" cy="26" r="12" fill="#efe8dc" stroke="#2b313a" stroke-width="1.4"/>
      <path d="M21 11h6M24 11v3M24 26l4.5-4.5" stroke="#a64234" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="24" cy="26" r="1.8" fill="#2b313a"/>`,
    jogging: `
      <rect x="6" y="10" width="36" height="28" rx="14" fill="none" stroke="#c67360" stroke-width="5"/>
      <rect x="6" y="10" width="36" height="28" rx="14" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="4 4"/>`,
    walk: `
      <path d="M10 34 Q24 14 38 30" fill="none" stroke="#7f9665" stroke-width="3" stroke-linecap="round"/>
      <circle cx="16" cy="20" r="4" fill="#90a674"/>
      <circle cx="32" cy="18" r="5" fill="#7f9665"/>`,
    padel: `
      <rect x="8" y="10" width="32" height="28" rx="3" fill="#dce8eb" stroke="#5d7082" stroke-width="1.4"/>
      <rect x="12" y="13" width="24" height="22" fill="#eadfce" stroke="#ffffff" stroke-width="1.2"/>
      <line x1="24" y1="13" x2="24" y2="35" stroke="#2b313a" stroke-width="1.4"/>`,
    tennis: `
      <rect x="8" y="10" width="32" height="28" rx="3" fill="#e5d5bc" stroke="#a64234" stroke-width="1.3"/>
      <line x1="12" y1="13" x2="12" y2="35" stroke="#ffffff" stroke-width="1.1"/>
      <line x1="36" y1="13" x2="36" y2="35" stroke="#ffffff" stroke-width="1.1"/>
      <line x1="8" y1="24" x2="40" y2="24" stroke="#2b313a" stroke-width="1.5"/>`,
    basket: `
      <rect x="7" y="10" width="34" height="28" rx="3" fill="#dfd2bf" stroke="#a64234" stroke-width="1.3"/>
      <path d="M7 18a7 7 0 0 1 0 12M41 18a7 7 0 0 0 0 12" fill="none" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="24" cy="24" r="4.5" fill="#a64234" stroke="#ffffff" stroke-width="1.2"/>`,
    beach: `
      <rect x="6" y="10" width="36" height="28" rx="3" fill="#f0dba9" stroke="#c89e52" stroke-width="1.3"/>
      <line x1="24" y1="10" x2="24" y2="38" stroke="#2b313a" stroke-width="1.6"/>
      <circle cx="32" cy="20" r="3.4" fill="#ffffff" stroke="#a64234" stroke-width="1.2"/>`,
    volley: `
      <path d="M8 22h32M8 28h32" stroke="#ffffff" stroke-width="1.4"/>
      <rect x="8" y="18" width="32" height="12" fill="none" stroke="#2b313a" stroke-width="1.4"/>
      <circle cx="24" cy="14" r="4" fill="#f2e7cf" stroke="#a64234" stroke-width="1.3"/>`,
    martial: `
      <rect x="8" y="10" width="32" height="28" rx="4" fill="#e5d7c3" stroke="#a64234" stroke-width="1.4"/>
      <rect x="13" y="15" width="22" height="18" rx="2" fill="#c67360" opacity="0.85"/>
      <circle cx="24" cy="24" r="4.5" fill="none" stroke="#ffffff" stroke-width="1.5"/>`,
    workout: `
      <line x1="12" y1="24" x2="36" y2="24" stroke="#2b313a" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="9" y="16" width="5" height="16" rx="2" fill="#a64234"/>
      <rect x="34" y="16" width="5" height="16" rx="2" fill="#a64234"/>
      <rect x="14" y="19" width="3" height="10" rx="1" fill="#5d6470"/>
      <rect x="31" y="19" width="3" height="10" rx="1" fill="#5d6470"/>`,
    seniorFit: `
      <circle cx="24" cy="24" r="14" fill="#e8eedf" stroke="#7f9665" stroke-width="1.4"/>
      <path d="M16 28c2.5-6 13.5-6 16 0" fill="none" stroke="#7f9665" stroke-width="2" stroke-linecap="round"/>
      <circle cx="24" cy="17" r="3.2" fill="#a64234"/>`,
    poolKid: `
      <rect x="7" y="12" width="34" height="24" rx="8" fill="#bce0e4" stroke="#7eaeb4" stroke-width="1.3"/>
      <path d="M12 24q4-4 8 0t8 0 8 0" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="17" cy="18" r="2.8" fill="#e5b899"/>`,
    poolAdult: `
      <rect x="6" y="11" width="36" height="26" rx="4" fill="#9dc4c8" stroke="#5d8d94" stroke-width="1.3"/>
      <line x1="14" y1="11" x2="14" y2="37" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="3 2"/>
      <line x1="24" y1="11" x2="24" y2="37" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="3 2"/>
      <line x1="34" y1="11" x2="34" y2="37" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="3 2"/>`,
    gate: `
      <path d="M8 34V18a16 12 0 0 1 32 0v16" fill="none" stroke="#a64234" stroke-width="2.4"/>
      <rect x="14" y="22" width="20" height="12" rx="2" fill="#efe8dc" stroke="#8a7c6a" stroke-width="1.2"/>`,
    fountain: `
      <ellipse cx="24" cy="31" rx="16" ry="7" fill="#a8cfd4" stroke="#ffffff" stroke-width="1.4"/>
      <path d="M24 30V14M24 16c-5 2-8 6-9 12M24 16c5 2 8 6 9 12" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>`,
    stage: `
      <path d="M8 34c0-10 32-10 32 0" fill="#d8cbb8" stroke="#8a7c6a" stroke-width="1.3"/>
      <path d="M13 34c0-6 22-6 22 0" fill="#b7c6a1" stroke="#ffffff" stroke-width="1.1"/>
      <ellipse cx="24" cy="35" rx="7" ry="3" fill="#a64234"/>`,
    kiosk: `
      <rect x="10" y="20" width="28" height="16" rx="2" fill="#f3ece0" stroke="#8a7c6a" stroke-width="1.3"/>
      <path d="M7 20l5-8h24l5 8H7z" fill="#c67360"/>
      <rect x="18" y="25" width="12" height="11" rx="1" fill="#7c7367"/>`,
    wc: `
      <rect x="8" y="11" width="32" height="26" rx="4" fill="#efe8dc" stroke="#8a7c6a" stroke-width="1.3"/>
      <line x1="24" y1="15" x2="24" y2="33" stroke="#8a7c6a" stroke-width="1.2"/>
      <circle cx="17" cy="20" r="2.5" fill="#2b313a"/>
      <circle cx="31" cy="20" r="2.5" fill="#a64234"/>
      <path d="M14 30v-5h6v5M28 30l3-5 3 5z" fill="#2b313a"/>`,
    playground: `
      <rect x="6" y="29" width="36" height="9" rx="3" fill="#ead4b2"/>
      <path d="M14 29l6-14 6 14M26 17l10 12" fill="none" stroke="#a64234" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="13" cy="14" r="3.5" fill="#7f9665"/>`,
    petanque: `
      <rect x="7" y="11" width="34" height="26" rx="4" fill="#ebd9be" stroke="#c0ab8e" stroke-width="1.3"/>
      <circle cx="18" cy="22" r="3.8" fill="#5d6470"/>
      <circle cx="29" cy="27" r="3.8" fill="#5d6470"/>
      <circle cx="25" cy="18" r="1.8" fill="#a64234"/>`,
    dames: `
      <rect x="10" y="10" width="28" height="28" rx="3" fill="#efe8dc" stroke="#2b313a" stroke-width="1.3"/>
      <rect x="14" y="14" width="10" height="10" fill="#2b313a"/>
      <rect x="24" y="24" width="10" height="10" fill="#2b313a"/>
      <circle cx="19" cy="29" r="3.2" fill="#a64234"/>
      <circle cx="29" cy="19" r="3.2" fill="#c8b89e"/>`,
    picnic: `
      <rect x="8" y="22" width="32" height="16" rx="4" fill="#b7c89f"/>
      <path d="M16 26h16M19 26v6M29 26v6M14 30h20" stroke="#8c5a3c" stroke-width="2" stroke-linecap="round"/>
      <circle cx="24" cy="14" r="6.5" fill="#7f9665"/>`,
    shrubs: `
      <circle cx="17" cy="26" r="8" fill="#90a674"/>
      <circle cx="30" cy="24" r="9" fill="#7f9665"/>
      <circle cx="22" cy="18" r="7" fill="#a8bc8d"/>
      <circle cx="16" cy="22" r="2" fill="#c97b68"/>
      <circle cx="31" cy="20" r="2" fill="#f2e7cf"/>
      <circle cx="25" cy="29" r="2" fill="#d8a35a"/>`,
    parking: `
      <rect x="7" y="11" width="34" height="26" rx="4" fill="#dfd7c8" stroke="#8a7c6a" stroke-width="1.3"/>
      <line x1="18" y1="11" x2="18" y2="37" stroke="#ffffff" stroke-width="1.2"/>
      <line x1="30" y1="11" x2="30" y2="37" stroke="#ffffff" stroke-width="1.2"/>
      <rect x="10" y="16" width="5" height="9" rx="1.5" fill="#464b52"/>
      <rect x="21.5" y="22" width="5" height="9" rx="1.5" fill="#a64234"/>`,
    market: `
      <rect x="6" y="16" width="16" height="18" rx="2" fill="#c67360"/>
      <rect x="26" y="16" width="16" height="18" rx="2" fill="#7f9665"/>
      <path d="M8 22h12M28 22h12" stroke="#ffffff" stroke-width="1.5"/>`,
  };

  const inner = icons[iconKey] || icons.picnic;
  return `<svg class="activity-thumb-svg" viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden="true">${inner}</svg>`;
}

export const SPACE_ACTIVITIES = {
  football: {
    heroKind: "football",
    activities: [
      {
        icon: "soccer",
        title: "Matchs de football à 7 & 9",
        tag: "Sportifs",
        desc: "Aire de jeu 50 × 30 m en gazon synthétique haute densité avec buts réglementaires et tracés permanents.",
      },
      {
        icon: "training",
        title: "Tournois de quartier & entraînements",
        tag: "Tout public",
        desc: "Séances encadrées pour clubs, écoles et associations sportives avec tribune béton-gazon attenante.",
      },
      {
        icon: "chrono",
        title: "Sessions nocturnes éclairées",
        tag: "Soirée",
        desc: "Mâts LED de 11 m assurant un éclairage uniforme pour prolonger les rencontres jusqu'en soirée.",
      },
    ],
  },
  sprint: {
    heroKind: "sprint",
    activities: [
      {
        icon: "sprint",
        title: "Sprint sur 6 couloirs (50 m)",
        tag: "Athlétisme",
        desc: "Revêtement amortissant résine/EPDM à 6 couloirs parallèles de 1,20 m dédiés aux pointes de vitesse.",
      },
      {
        icon: "chrono",
        title: "Tests scolaires & fractionné",
        tag: "Jeunes & Clubs",
        desc: "Lignes de départ et d'arrivée calibrées pour chronométrage scolaire, échauffement et ateliers vitesse.",
      },
    ],
  },
  piste: {
    heroKind: "piste",
    activities: [
      {
        icon: "jogging",
        title: "Boucle de footing 1 080 m",
        tag: "Course à pied",
        desc: "Anneau continu ceinturant tout le parc avec virages relevés doux et marquage central bidirectionnel.",
      },
      {
        icon: "walk",
        title: "Marche active matinale & nocturne",
        tag: "Tout public",
        desc: "Parcours ombragé par les alignements d'arbres le jour et balisé par bornes LED dès la tombée du jour.",
      },
    ],
  },
  padel: {
    heroKind: "padel",
    activities: [
      {
        icon: "padel",
        title: "Doubles de Padel sur court vitré",
        tag: "Raquettes",
        desc: "Court panoramique clos de parois vitrées permettant le rebond tactique et des échanges accessibles à tous.",
      },
      {
        icon: "training",
        title: "Initiation & tournois amicaux",
        tag: "Débutants / Confirmés",
        desc: "Surface minérale drainante à rebond régulier idéale pour découvrir le padel entre amis ou en famille.",
      },
    ],
  },
  tennis: {
    heroKind: "tennis",
    activities: [
      {
        icon: "tennis",
        title: "Simple & double sur surface rapide",
        tag: "Sportifs",
        desc: "Court de 200 m² orienté Nord-Est / Sud-Ouest avec couloirs complets, filet tendu et dégagements latéraux.",
      },
      {
        icon: "training",
        title: "École de tennis & perfectionnement",
        tag: "Jeunes & Adultes",
        desc: "Créneaux réservables pour cours particuliers, stages vacances et rencontres inter-quartiers.",
      },
    ],
  },
  basket: {
    heroKind: "basket",
    activities: [
      {
        icon: "basket",
        title: "Basketball 5×5 & 3×3 enterré",
        tag: "Tout public",
        desc: "Terrain en résine acrylique de 420 m² implanté en contrebas, équipé de deux paniers réglementaires et raquettes tracées.",
      },
      {
        icon: "stage",
        title: "Spectacle depuis le gradin central",
        tag: "Gradins ouverts",
        desc: "Vue dégagée sans barrière depuis le gradin triangulaire végétalisé reliant directement le terrain.",
      },
    ],
  },
  "beach-soccer": {
    heroKind: "beach-soccer",
    activities: [
      {
        icon: "beach",
        title: "Beach Soccer & Beach Handball",
        tag: "Jeunes & Sportifs",
        desc: "Arène de sable fin de 959 m² dotée de deux cages de 3 m pour matchs acrobatiques pieds nus.",
      },
      {
        icon: "volley",
        title: "Tournois de Beach Volleyball",
        tag: "Équipes",
        desc: "Filet central amovible de 12 m tendu à hauteur officielle pour enchaîner les sets sur sable.",
      },
      {
        icon: "stage",
        title: "Gradins enherbés partagés",
        tag: "Spectateurs",
        desc: "Assises en pente douce face au sable permettant aux supporters et familles d'assister aux tournois.",
      },
    ],
  },
  "arts-martiaux": {
    heroKind: "arts-martiaux",
    activities: [
      {
        icon: "martial",
        title: "Dojo plein air : Karaté, Judo & Lutte",
        tag: "Clubs & Jeunes",
        desc: "Plateau dédié de 497 m² accueillant arts martiaux, luttes traditionnelles et sports de combat encadrés.",
      },
      {
        icon: "seniorFit",
        title: "Taï-chi & qi gong matinal",
        tag: "Tout public",
        desc: "Espace calme bordé de massifs arborés propice aux arts énergétiques aux heures fraîches du matin.",
      },
    ],
  },
  "fitness-adulte": {
    heroKind: "fitness-adulte",
    activities: [
      {
        icon: "workout",
        title: "Street workout & musculation libre",
        tag: "Jeunes & Adultes",
        desc: "Station extérieure de 436 m² avec barres de traction, barres parallèles et agrès au poids du corps.",
      },
      {
        icon: "training",
        title: "Circuits cardio & cross-training",
        tag: "Sportifs",
        desc: "Zone de renforcement musculaire en plein air avec sol stabilisé antidérapant à proximité des bassins.",
      },
    ],
  },
  "fitness-senior": {
    heroKind: "fitness-senior",
    activities: [
      {
        icon: "seniorFit",
        title: "Mobilité articulaire douce",
        tag: "Seniors 60+",
        desc: "Parcours santé à faible impact doté d'appareils d'étirement doux, volants d'épaules et marcheurs assistés.",
      },
      {
        icon: "walk",
        title: "Gymnastique d'équilibre & repos",
        tag: "Bien-être 3e âge",
        desc: "Situé dans un écrin ombragé de 161 m² près de la fontaine avec bancs ergonomiques à dossier.",
      },
    ],
  },
  "piscine-enfant": {
    heroKind: "piscine-enfant",
    activities: [
      {
        icon: "poolKid",
        title: "Baignade sécurisée & pataugeoire",
        tag: "Enfants 3–12 ans",
        desc: "Bassin peu profond de 92 m² équipé de margelles en pierre anti-dérapantes pour s'initier à l'eau en toute sérénité.",
      },
      {
        icon: "picnic",
        title: "Plage de surveillance familiale",
        tag: "Parents",
        desc: "Banquettes et espace de détente ombragé juste en bordure permettant aux parents de veiller confortablement.",
      },
    ],
  },
  "piscine-adulte": {
    heroKind: "piscine-adulte",
    activities: [
      {
        icon: "poolAdult",
        title: "Natation libre & longueurs",
        tag: "Adultes & Ados",
        desc: "Grand plan d'eau de 425 m² dédié à la nage sportive, à la fraîcheur estivale et aux séances d'aquagym.",
      },
      {
        icon: "picnic",
        title: "Solarium & pelouse détente",
        tag: "Détente",
        desc: "Large pelouse gazonnée de 288 m² côté Sud pour se sécher au soleil ou lire à l'ombre des arbres.",
      },
    ],
  },
  entree: {
    heroKind: "entree",
    activities: [
      {
        icon: "gate",
        title: "Parvis d'accueil & billetterie",
        tag: "Services",
        desc: "Portique architectural sous auvent encadré par deux pavillons de contrôle et d'information visiteurs.",
      },
      {
        icon: "fountain",
        title: "Fontaine de bienvenue & orientation",
        tag: "Accès",
        desc: "Perspective centrale ouvrant directement sur le grand miroir d'eau et le boulevard Nord vers le parking.",
      },
    ],
  },
  bassin: {
    heroKind: "bassin",
    activities: [
      {
        icon: "fountain",
        title: "Chorégraphie des 17 jets d'eau",
        tag: "Attraction centrale",
        desc: "Miroir d'eau de 564 m² animé par un panache central de 6,6 m et deux couronnes de jets ondulants.",
      },
      {
        icon: "walk",
        title: "Promenade rafraîchissante & spectacle nocturne",
        tag: "Jour & Nuit",
        desc: "Éclairage subaquatique ambre et turquoise illuminant les gerbes d'eau à la tombée du soir.",
      },
    ],
  },
  theatre: {
    heroKind: "theatre",
    activities: [
      {
        icon: "stage",
        title: "Concerts, spectacles & forums citoyens",
        tag: "Culture",
        desc: "Hémicycle en gradins gazonnés face au bassin central pouvant accueillir cérémonies, récitals et projections.",
      },
      {
        icon: "fountain",
        title: "Rampe d'eau de scène & acoustique naturelle",
        tag: "Événements",
        desc: "Double fontaine cintrée en bas de scène offrant fraîcheur et cadre prestigieux de jour comme de nuit.",
      },
    ],
  },
  kiosques: {
    heroKind: "kiosques",
    activities: [
      {
        icon: "kiosk",
        title: "Glaces, jus locaux & rafraîchissements",
        tag: "Restauration",
        desc: "10 kiosques répartis sur deux placettes pavées proposant boissons fraîches, café, thé et encas artisanaux.",
      },
      {
        icon: "picnic",
        title: "Terrasses ombragées à toute heure",
        tag: "Convivialité",
        desc: "Aires dallées et bancs à proximité immédiate des spectacles du théâtre de verdure et des jeux.",
      },
    ],
  },
  toilettes: {
    heroKind: "toilettes",
    activities: [
      {
        icon: "wc",
        title: "Blocs sanitaires Hommes & Femmes",
        tag: "Hygiène & Accès",
        desc: "4 pavillons répartis en deux pôles (Ouest et Est du théâtre), conçus avec accès PMR et robinets d'eau potable.",
      },
      {
        icon: "kiosk",
        title: "Local technique & bureau de gestion",
        tag: "Maintenance",
        desc: "Locaux dédiés à l'entretien permanent, à la sécurité du parc et à la propreté des espaces publics.",
      },
    ],
  },
  "loisirs-enfants": {
    heroKind: "loisirs-enfants",
    activities: [
      {
        icon: "playground",
        title: "Châteaux, toboggans & balançoires sur sable",
        tag: "Enfants 3–12 ans",
        desc: "Grande aire amortissante de 716 m² en sable fin équipée de structures d'escalade, toboggans et bascules sécurisées.",
      },
      {
        icon: "picnic",
        title: "Parcours moteurs & bancs de surveillance",
        tag: "Familles",
        desc: "Deux esplanades complémentaires avec bancs à l'ombre pour permettre aux parents d'accompagner les plus jeunes.",
      },
    ],
  },
  "loisirs-senior": {
    heroKind: "loisirs-senior",
    activities: [
      {
        icon: "petanque",
        title: "Boulodrome de pétanque ombragé",
        tag: "Seniors 60+ & Tout public",
        desc: "Aire dédiée de 436 m² en sable compacté avec bancs périmétriques pour disputer des doublettes et triplettes conviviales.",
      },
      {
        icon: "dames",
        title: "Tables de dames, échecs & awalé",
        tag: "Loisirs 3e âge",
        desc: "Plateaux de jeux de société installés à l'ombre des arbres pour entretenir lien social et moments de calme.",
      },
    ],
  },
  "pelouse-pique-nique": {
    heroKind: "pelouse-pique-nique",
    activities: [
      {
        icon: "picnic",
        title: "Grandes pelouses de pique-nique en famille",
        tag: "Familles & Groupes",
        desc: "Plus de 1 460 m² d'herbe dense et souple ouverts pour étendre une nappe, déjeuner au vert et se reposer.",
      },
      {
        icon: "walk",
        title: "Lecture & sieste sous les arbres",
        tag: "Détente",
        desc: "Aires de repos pavées attenantes avec bancs en bois et pierre dans le secteur le plus paisible du jardin.",
      },
    ],
  },
  "jardin-arbustes": {
    heroKind: "jardin-arbustes",
    activities: [
      {
        icon: "shrubs",
        title: "Collection d'arbustes & flore locale",
        tag: "Botanique",
        desc: "Massifs composés de bougainvilliers, hibiscus, laurels, eucalyptus dorés et espèces sahéliennes adaptées à Thiès.",
      },
      {
        icon: "walk",
        title: "Sentiers de flânerie entre parterres fleuris",
        tag: "Promenade",
        desc: "Allées géométriques bordées de bouquets crème, ocre et terracotta visitées par les papillons en vue Jour.",
      },
    ],
  },
  "fontaine-est": {
    heroKind: "fontaine-est",
    activities: [
      {
        icon: "fountain",
        title: "Bassin fontaine Est & îlot de fraîcheur",
        tag: "Détente",
        desc: "Fontaine paysagère de 118 m² rafraîchissant l'extrémité orientale du parc au bout de la grande promenade.",
      },
      {
        icon: "picnic",
        title: "Aires de repos & rencontres de quartier",
        tag: "Convivialité",
        desc: "Placettes ombragées et bancs alignés constituant un point de rendez-vous calme à l'entrée Est.",
      },
    ],
  },
  parking: {
    heroKind: "parking",
    activities: [
      {
        icon: "parking",
        title: "Stationnement 192 places organisées",
        tag: "Accès véhicules",
        desc: "Grande aire de stationnement en épis et bataille séparée du boulevard Nord par des îlots boisés.",
      },
      {
        icon: "walk",
        title: "Dépose-minute & accès direct au jardin",
        tag: "Mobilité",
        desc: "Cheminements piétons larges et sécurisés reliant les places de parking à l'entrée Nord du parc.",
      },
    ],
  },
  cantines: {
    heroKind: "cantines",
    activities: [
      {
        icon: "market",
        title: "43 cantines commerciales & boutiques",
        tag: "Commerces",
        desc: "Galerie marchande de 43 modules alignés offrant artisanat, services de proximité et rafraîchissements.",
      },
      {
        icon: "kiosk",
        title: "Restauration & promenade animée",
        tag: "Convivialité",
        desc: "Esplanade éclairée la nuit longeant toute la façade des cantines face au boulevard urbain Nord.",
      },
    ],
  },
};

export function renderSpaceHeroSvg(space) {
  const kind = SPACE_ACTIVITIES[space.id]?.heroKind || space.id;
  const scenes = {
    football: `
      <rect width="360" height="118" fill="#f3ece0"/>
      <rect x="26" y="16" width="308" height="86" rx="6" fill="#dfd2bf" stroke="#c3b49d" stroke-width="1.5"/>
      <line x1="180" y1="16" x2="180" y2="102" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="180" cy="59" r="18" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="180" cy="59" r="3" fill="#a64234"/>
      <rect x="26" y="34" width="38" height="50" fill="none" stroke="#ffffff" stroke-width="1.4"/>
      <rect x="296" y="34" width="38" height="50" fill="none" stroke="#ffffff" stroke-width="1.4"/>
      <rect x="18" y="47" width="8" height="24" rx="2" fill="none" stroke="#a64234" stroke-width="2"/>
      <rect x="334" y="47" width="8" height="24" rx="2" fill="none" stroke="#a64234" stroke-width="2"/>`,
    sprint: `
      <rect width="360" height="118" fill="#f4eee4"/>
      <rect x="20" y="24" width="320" height="70" rx="6" fill="#c67360"/>
      <path d="M20 36h320M20 48h320M20 60h320M20 72h320M20 84h320" stroke="#f7f2ea" stroke-width="1.2" opacity="0.85"/>
      <line x1="54" y1="24" x2="54" y2="94" stroke="#ffffff" stroke-width="2"/>
      <line x1="306" y1="24" x2="306" y2="94" stroke="#ffffff" stroke-width="2.6"/>
      <circle cx="96" cy="42" r="4" fill="#2b313a"/>
      <circle cx="142" cy="54" r="4" fill="#ffffff"/>
      <circle cx="118" cy="66" r="4" fill="#2b313a"/>
      <circle cx="164" cy="78" r="4" fill="#ffffff"/>`,
    piste: `
      <rect width="360" height="118" fill="#eef1e6"/>
      <rect x="24" y="18" width="312" height="82" rx="41" fill="none" stroke="#c67360" stroke-width="14"/>
      <rect x="24" y="18" width="312" height="82" rx="41" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-dasharray="9 6"/>
      <circle cx="88" cy="59" r="11" fill="#90a674"/>
      <circle cx="146" cy="54" r="14" fill="#7f9665"/>
      <circle cx="220" cy="62" r="12" fill="#a0b584"/>
      <circle cx="272" cy="58" r="10" fill="#7f9665"/>`,
    padel: `
      <rect width="360" height="118" fill="#eef2f3"/>
      <rect x="74" y="16" width="212" height="86" rx="4" fill="#cfe0e4" stroke="#5d7082" stroke-width="2"/>
      <rect x="84" y="24" width="192" height="70" fill="#e6dac6" stroke="#ffffff" stroke-width="1.6"/>
      <line x1="128" y1="24" x2="128" y2="94" stroke="#ffffff" stroke-width="1.4"/>
      <line x1="232" y1="24" x2="232" y2="94" stroke="#ffffff" stroke-width="1.4"/>
      <line x1="128" y1="59" x2="232" y2="59" stroke="#ffffff" stroke-width="1.4"/>
      <line x1="180" y1="20" x2="180" y2="98" stroke="#2b313a" stroke-width="2.4"/>`,
    tennis: `
      <rect width="360" height="118" fill="#f3ece0"/>
      <rect x="64" y="16" width="232" height="86" rx="4" fill="#e5d5bc" stroke="#a64234" stroke-width="1.8"/>
      <rect x="80" y="25" width="200" height="68" fill="none" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="80" y1="34" x2="280" y2="34" stroke="#ffffff" stroke-width="1.2"/>
      <line x1="80" y1="84" x2="280" y2="84" stroke="#ffffff" stroke-width="1.2"/>
      <line x1="130" y1="34" x2="130" y2="84" stroke="#ffffff" stroke-width="1.3"/>
      <line x1="230" y1="34" x2="230" y2="84" stroke="#ffffff" stroke-width="1.3"/>
      <line x1="130" y1="59" x2="230" y2="59" stroke="#ffffff" stroke-width="1.3"/>
      <line x1="180" y1="14" x2="180" y2="104" stroke="#2b313a" stroke-width="2.4"/>`,
    basket: `
      <rect width="360" height="118" fill="#efe7da"/>
      <rect x="52" y="16" width="256" height="86" rx="6" fill="#dfd2bf" stroke="#a64234" stroke-width="2"/>
      <line x1="180" y1="16" x2="180" y2="102" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="180" cy="59" r="15" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      <path d="M52 33a28 26 0 0 1 0 52M308 33a28 26 0 0 0 0 52" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="80" cy="59" r="4" fill="#a64234"/>
      <circle cx="280" cy="59" r="4" fill="#a64234"/>
      <circle cx="180" cy="59" r="5" fill="#a64234"/>`,
    "beach-soccer": `
      <rect width="360" height="118" fill="#f5ecd6"/>
      <rect x="34" y="15" width="292" height="88" rx="6" fill="#f0dba9" stroke="#d1b06c" stroke-width="1.8"/>
      <rect x="52" y="23" width="256" height="72" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      <line x1="180" y1="19" x2="180" y2="99" stroke="#2b313a" stroke-width="2.6"/>
      <rect x="44" y="45" width="8" height="28" fill="none" stroke="#ffffff" stroke-width="2"/>
      <rect x="308" y="45" width="8" height="28" fill="none" stroke="#ffffff" stroke-width="2"/>
      <circle cx="195" cy="46" r="5" fill="#ffffff" stroke="#a64234" stroke-width="1.4"/>`,
    "arts-martiaux": `
      <rect width="360" height="118" fill="#efe9df"/>
      <rect x="44" y="16" width="272" height="86" rx="8" fill="#e5d7c3" stroke="#bcae98" stroke-width="1.5"/>
      <rect x="74" y="25" width="212" height="68" rx="4" fill="#c67360" opacity="0.88"/>
      <circle cx="180" cy="59" r="21" fill="none" stroke="#f8f4ed" stroke-width="2"/>
      <circle cx="180" cy="59" r="7" fill="#f8f4ed"/>`,
    "fitness-adulte": `
      <rect width="360" height="118" fill="#ece8df"/>
      <rect x="38" y="18" width="284" height="82" rx="10" fill="#e0d6c6"/>
      <line x1="92" y1="78" x2="92" y2="34" stroke="#2b313a" stroke-width="3.2"/>
      <line x1="168" y1="78" x2="168" y2="34" stroke="#2b313a" stroke-width="3.2"/>
      <line x1="92" y1="36" x2="168" y2="36" stroke="#a64234" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="208" y="48" width="76" height="8" rx="4" fill="#2b313a"/>
      <rect x="214" y="36" width="8" height="32" rx="2" fill="#a64234"/>
      <rect x="270" y="36" width="8" height="32" rx="2" fill="#a64234"/>`,
    "fitness-senior": `
      <rect width="360" height="118" fill="#edf1e6"/>
      <circle cx="68" cy="44" r="24" fill="#90a674" opacity="0.7"/>
      <circle cx="294" cy="42" r="22" fill="#7f9665" opacity="0.7"/>
      <rect x="86" y="34" width="188" height="58" rx="16" fill="#e8eedf" stroke="#90a674" stroke-width="1.6"/>
      <circle cx="144" cy="62" r="14" fill="none" stroke="#7f9665" stroke-width="3"/>
      <path d="M188 76c6-20 34-20 40 0" fill="none" stroke="#a64234" stroke-width="2.8" stroke-linecap="round"/>
      <rect x="122" y="88" width="116" height="8" rx="3" fill="#c5a882"/>`,
    "piscine-enfant": `
      <rect width="360" height="118" fill="#eef4f4"/>
      <rect x="46" y="18" width="268" height="82" rx="26" fill="#e8dfd2" stroke="#d1c6b6" stroke-width="1.5"/>
      <rect x="58" y="26" width="244" height="66" rx="20" fill="#bce0e4"/>
      <path d="M84 58q18-10 36 0t36 0 36 0 36 0 36 0" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="122" cy="48" r="7" fill="#e5b899" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="232" cy="64" r="8" fill="#f2e7cf" stroke="#a64234" stroke-width="1.8"/>`,
    "piscine-adulte": `
      <rect width="360" height="118" fill="#ecf3f3"/>
      <rect x="34" y="16" width="292" height="86" rx="8" fill="#e6ddd0" stroke="#c8bcab" stroke-width="1.5"/>
      <rect x="44" y="24" width="272" height="70" rx="5" fill="#9dc4c8"/>
      <path d="M44 41h272M44 59h272M44 77h272" stroke="#ffffff" stroke-width="1.6" stroke-dasharray="8 5" opacity="0.85"/>
      <circle cx="98" cy="50" r="3.5" fill="#a64234"/>
      <circle cx="222" cy="68" r="3.5" fill="#a64234"/>`,
    entree: `
      <rect width="360" height="118" fill="#f3eee6"/>
      <rect x="28" y="72" width="304" height="28" rx="4" fill="#e6ddd0"/>
      <rect x="64" y="34" width="52" height="44" rx="3" fill="#ded6c8" stroke="#bcae98" stroke-width="1.4"/>
      <rect x="244" y="34" width="52" height="44" rx="3" fill="#ded6c8" stroke="#bcae98" stroke-width="1.4"/>
      <path d="M108 42h144c12 0 18 12 0 18H108c-18-6-12-18 0-18z" fill="#e2d7c5" stroke="#a64234" stroke-width="1.6"/>
      <ellipse cx="180" cy="88" rx="22" ry="7" fill="#9dc4c8" stroke="#ffffff" stroke-width="1.4"/>`,
    bassin: `
      <rect width="360" height="118" fill="#edf2f2"/>
      <polygon points="180,14 294,54 244,98 116,98 66,54" fill="#9dc4c8" stroke="#ffffff" stroke-width="3"/>
      <path d="M180 74V26M180 34c-18 4-30 18-34 36M180 34c18 4 30 18 34 36" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse cx="180" cy="74" rx="42" ry="12" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.8"/>
      <ellipse cx="180" cy="74" rx="22" ry="7" fill="none" stroke="#ffffff" stroke-width="1.4"/>`,
    theatre: `
      <rect width="360" height="118" fill="#f2ede4"/>
      <path d="M62 96c0-54 236-54 236 0" fill="#d8cbb8" stroke="#bcae98" stroke-width="1.5"/>
      <path d="M84 96c0-40 192-40 192 0" fill="#a8ba8e" stroke="#ffffff" stroke-width="1.3"/>
      <path d="M108 96c0-28 144-28 144 0" fill="#d8cbb8" stroke="#ffffff" stroke-width="1.3"/>
      <path d="M132 96c0-17 96-17 96 0" fill="#9dc4c8" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="180" cy="96" r="14" fill="#a64234" opacity="0.85"/>`,
    kiosques: `
      <rect width="360" height="118" fill="#f4eee5"/>
      <rect x="44" y="78" width="272" height="22" rx="4" fill="#e6ddd0"/>
      <rect x="74" y="42" width="66" height="40" rx="3" fill="#ffffff" stroke="#bcae98" stroke-width="1.4"/>
      <path d="M66 42l14-14h54l14 14H66z" fill="#c67360"/>
      <rect x="220" y="42" width="66" height="40" rx="3" fill="#ffffff" stroke="#bcae98" stroke-width="1.4"/>
      <path d="M212 42l14-14h54l14 14H212z" fill="#7f9665"/>
      <rect x="96" y="54" width="22" height="22" rx="2" fill="#7c7367"/>
      <rect x="242" y="54" width="22" height="22" rx="2" fill="#7c7367"/>`,
    toilettes: `
      <rect width="360" height="118" fill="#f3eee6"/>
      <rect x="70" y="24" width="220" height="70" rx="8" fill="#e6ddd0" stroke="#c0b4a2" stroke-width="1.5"/>
      <rect x="86" y="34" width="84" height="50" rx="4" fill="#ffffff"/>
      <rect x="190" y="34" width="84" height="50" rx="4" fill="#ffffff"/>
      <circle cx="128" cy="48" r="5" fill="#2b313a"/>
      <rect x="120" y="56" width="16" height="18" rx="2" fill="#2b313a"/>
      <circle cx="232" cy="48" r="5" fill="#a64234"/>
      <path d="M222 74l10-18 10 18z" fill="#a64234"/>`,
    "loisirs-enfants": `
      <rect width="360" height="118" fill="#f5efe2"/>
      <polygon points="180,14 294,59 180,104 66,59" fill="#ead4b2" stroke="#ffffff" stroke-width="2"/>
      <circle cx="142" cy="56" r="10" fill="#a64234" opacity="0.88"/>
      <circle cx="216" cy="56" r="10" fill="#7f9665" opacity="0.88"/>
      <path d="M164 72l16-24 22 24" fill="none" stroke="#2b313a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="180" cy="40" r="6" fill="#d8a35a"/>`,
    "loisirs-senior": `
      <rect width="360" height="118" fill="#f2ece0"/>
      <rect x="38" y="20" width="284" height="78" rx="10" fill="#ead8bc" stroke="#cbb89c" stroke-width="1.5"/>
      <circle cx="116" cy="56" r="8" fill="#464b52"/>
      <circle cx="142" cy="68" r="8" fill="#464b52"/>
      <circle cx="134" cy="42" r="3.8" fill="#a64234"/>
      <rect x="206" y="34" width="52" height="52" rx="4" fill="#f7f3eb" stroke="#2b313a" stroke-width="1.4"/>
      <rect x="216" y="44" width="16" height="16" fill="#2b313a"/>
      <rect x="232" y="60" width="16" height="16" fill="#2b313a"/>
      <circle cx="224" cy="68" r="5" fill="#a64234"/>`,
    "pelouse-pique-nique": `
      <rect width="360" height="118" fill="#edf2e6"/>
      <rect x="32" y="22" width="296" height="76" rx="18" fill="#b7c89f"/>
      <circle cx="88" cy="46" r="22" fill="#7f9665"/>
      <circle cx="272" cy="48" r="24" fill="#90a674"/>
      <rect x="148" y="62" width="64" height="22" rx="4" fill="#f3ece0" stroke="#a64234" stroke-width="1.4"/>
      <path d="M160 62v22M180 62v22M200 62v22" stroke="#c67360" stroke-width="1.4"/>`,
    "jardin-arbustes": `
      <rect width="360" height="118" fill="#eef2e7"/>
      <path d="M24 92Q180 42 336 92" fill="none" stroke="#e4dbcd" stroke-width="18"/>
      <circle cx="86" cy="54" r="20" fill="#90a674"/>
      <circle cx="138" cy="46" r="24" fill="#7f9665"/>
      <circle cx="222" cy="48" r="22" fill="#a0b584"/>
      <circle cx="276" cy="56" r="18" fill="#7f9665"/>
      <circle cx="106" cy="70" r="4.5" fill="#c97b68"/>
      <circle cx="164" cy="64" r="4.5" fill="#d8a35a"/>
      <circle cx="204" cy="66" r="4.5" fill="#f2e7cf"/>
      <circle cx="256" cy="70" r="4.5" fill="#c97b68"/>`,
    "fontaine-est": `
      <rect width="360" height="118" fill="#edf3f2"/>
      <rect x="32" y="20" width="296" height="78" rx="14" fill="#e6ddd0"/>
      <polygon points="180,28 248,59 180,90 112,59" fill="#9dc4c8" stroke="#ffffff" stroke-width="2.5"/>
      <path d="M180 66V38M180 44c-11 3-17 11-19 22M180 44c11 3 17 11 19 22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
      <rect x="52" y="48" width="28" height="10" rx="2" fill="#c5a882"/>
      <rect x="280" y="48" width="28" height="10" rx="2" fill="#c5a882"/>`,
    parking: `
      <rect width="360" height="118" fill="#efe9df"/>
      <rect x="24" y="24" width="312" height="70" rx="6" fill="#d9cfc0" stroke="#c3b49d" stroke-width="1.4"/>
      <path d="M58 24v26M94 24v26M130 24v26M166 24v26M202 24v26M238 24v26M274 24v26M310 24v26" stroke="#f7f4ee" stroke-width="1.4"/>
      <rect x="34" y="30" width="18" height="22" rx="3" fill="#464b52"/>
      <rect x="70" y="30" width="18" height="22" rx="3" fill="#f7f5f0"/>
      <rect x="106" y="30" width="18" height="22" rx="3" fill="#5d7082"/>
      <rect x="178" y="30" width="18" height="22" rx="3" fill="#8c4d43"/>
      <rect x="214" y="30" width="18" height="22" rx="3" fill="#464b52"/>
      <rect x="250" y="30" width="18" height="22" rx="3" fill="#d6b265"/>
      <circle cx="144" cy="74" r="10" fill="#7f9665"/>
      <circle cx="290" cy="74" r="10" fill="#90a674"/>`,
    cantines: `
      <rect width="360" height="118" fill="#f2ece2"/>
      <rect x="26" y="28" width="308" height="64" rx="5" fill="#d8ccb8"/>
      <rect x="36" y="38" width="46" height="44" rx="3" fill="#e5d9c6" stroke="#8a7c6a" stroke-width="1.4"/>
      <rect x="36" y="38" width="46" height="10" rx="2" fill="#c67360"/>
      <rect x="92" y="38" width="46" height="44" rx="3" fill="#e5d9c6" stroke="#8a7c6a" stroke-width="1.4"/>
      <rect x="92" y="38" width="46" height="10" rx="2" fill="#7f9665"/>
      <rect x="148" y="38" width="46" height="44" rx="3" fill="#e5d9c6" stroke="#8a7c6a" stroke-width="1.4"/>
      <rect x="148" y="38" width="46" height="10" rx="2" fill="#d8a35a"/>
      <rect x="204" y="38" width="46" height="44" rx="3" fill="#e5d9c6" stroke="#8a7c6a" stroke-width="1.4"/>
      <rect x="204" y="38" width="46" height="10" rx="2" fill="#c67360"/>
      <rect x="260" y="38" width="64" height="44" rx="3" fill="#e5d9c6" stroke="#8a7c6a" stroke-width="1.4"/>
      <rect x="260" y="38" width="64" height="10" rx="2" fill="#5d7082"/>`,
  };

  const inner = scenes[kind] || scenes.bassin;
  return `<svg class="card-hero-svg" viewBox="0 0 360 118" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

export function renderActivityCardsHtml(space) {
  const entry = SPACE_ACTIVITIES[space.id];
  if (!entry || !entry.activities?.length) {
    return (space.highlights || [])
      .map(
        (h) => `
          <article class="activity-card">
            <div class="activity-illus">${renderActivityThumbSvg("picnic")}</div>
            <div class="activity-info">
              <div class="activity-top"><h4>${esc(h)}</h4></div>
            </div>
          </article>
        `
      )
      .join("");
  }

  return entry.activities
    .map(
      (act) => `
        <article class="activity-card">
          <div class="activity-illus">${renderActivityThumbSvg(act.icon)}</div>
          <div class="activity-info">
            <div class="activity-top">
              <h4>${esc(act.title)}</h4>
              <span class="activity-tag">${esc(act.tag)}</span>
            </div>
            <p>${esc(act.desc)}</p>
          </div>
        </article>
      `
    )
    .join("");
}
