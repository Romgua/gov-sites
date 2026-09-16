// Partage entre le script de collecte et le front.
export const CATEGORIES = [
  { id: 'institutions', label: 'Institutions & Administration' },
  { id: 'territoires', label: 'Territoires & Préfectures' },
  { id: 'finances', label: 'Finances & Impôts' },
  { id: 'sante', label: 'Santé & Protection sociale' },
  { id: 'emploi', label: 'Travail & Emploi' },
  { id: 'education', label: 'Éducation & Recherche' },
  { id: 'justice', label: 'Justice & Sécurité' },
  { id: 'defense', label: 'Défense & International' },
  { id: 'transports', label: 'Transports & Mobilité' },
  { id: 'environnement', label: 'Environnement, Agriculture & Énergie' },
  { id: 'logement', label: 'Logement & Urbanisme' },
  { id: 'entreprises', label: 'Entreprises & Économie' },
  { id: 'culture', label: 'Culture, Sport & Jeunesse' },
  { id: 'numerique', label: 'Numérique & Données' },
  { id: 'autres', label: 'Autres' },
];

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

export const GROUPS = [
  { id: 'gouv', label: 'Sites du gouvernement (.gouv.fr)' },
  { id: 'public', label: 'Autres services publics' },
];
