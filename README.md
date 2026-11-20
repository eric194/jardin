# Parc linéaire de Thiès — site 3D interactif

Site de présentation du projet **DQE202611-THS-PARC** pour **DIEYLANI AER – SASU**.
Construit dans **Antigravity** (Gemini) à partir du plan Archicad fourni
(`JARDIN-ERT-TO-SVG.svg`) et du devis du 19 novembre 2026.

## Lancer le site

```bash
cd parc-thies-3d
python -m http.server 5601 --bind 127.0.0.1
```

Ouvrir <http://127.0.0.1:5601>.

Le site est statique : HTML, CSS et JavaScript vanilla, sans build ni dépendance externe.
Les données sont chargées depuis `data/spots.json` et `data/project.json`.

## Le principe

- Un hero plein écran avec **deux plateaux 3D** : le parc linéaire (500 × 50 m) et le
  parking avec cantines (390 × 20 m), séparés par la voirie de liaison.
- **8 marqueurs** cliquables : sports, piste, piscines, jeux, théâtre, jardin, entrée,
  parking/cantines.
- Panneau latéral sur desktop, feuille basse sur mobile.
- Filtres par usage, vue 3D / vue plan, zoom, recentrage, déplacement à la souris ou au doigt.
- Sections : lieu, programme, budget (13 lots et 120 lignes), cadre et exclusions.

## Structure

```text
parc-thies-3d/
├── index.html
├── styles.css
├── app.js
├── data/
│   ├── project.json       # données du devis
│   └── spots.json         # 8 points, positions, surfaces, catégories
├── assets/
│   ├── fonts/             # Fraunces + Manrope
│   └── img/               # plans extraits du SVG Archicad
├── downloads/             # DQE PDF
├── reference/             # brief de construction + capture de référence
├── qa-desktop.png
├── qa-mobile.png
└── QA.md
```

## Source du plan

Le SVG Archicad complet (`JARDIN-ERT-TO-SVG.svg`, 15,6 Mo) a été recadré en deux calques :

- `plan-park.png` : 2660 × 295 px, parc 500 × 50 m ;
- `plan-parking.png` : 1620 × 145 px, parking 390 × 20 m.

Le calque de stalles et de conteneurs du parking est un **schéma de lecture** aligné sur
le plan (43 blocs, stalles, îlots). Il ne remplace pas la géométrie du DQE.

## Données

Les chiffres du site proviennent de `data/project.json` :

- 25 000 m² de parc, 500 × 50 m, 1 100 ml de clôture, 107 zones Archicad ;
- 7 800 m² de parking, 312 places, 43 cantines ;
- 13 lots, 120 lignes ;
- 2 667 060 155 FCFA HT, TVA 18 % 480 070 828, 3 147 130 983 FCFA TTC.

Le site n’affiche ni majoration interne, ni frais généraux, ni conditions de règlement.
La seule note est la liste des prestations exclues.

## Vérifications

Voir `QA.md` : tests desktop 1440 × 1000, tablette 768 × 1024, mobile 390 × 844,
clic des 8 marqueurs, filtres, vue plan, zoom, budget, PDF, débordements et console.
