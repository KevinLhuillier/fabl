/** Screens that have a guided tour, shown the first time each one is opened. */
export type TourScreen = 'home' | 'story' | 'reader' | 'vocabulary' | 'profile';

/**
 * One bubble. `target` names an element registered with `useTour().target(id)`
 * on that screen; without it the bubble is centered. A step whose target is
 * missing (e.g. a page without audio) or off screen is skipped.
 */
export type TourStep = { target?: string; title: string; text: string };

export const TOUR_STEPS: Record<TourScreen, TourStep[]> = {
  home: [
    {
      target: 'stats',
      title: 'Ta progression',
      text: 'Ta série de jours, tes XP et ton objectif du jour. Lis ou révise chaque jour pour garder ta série !',
    },
    {
      target: 'stories',
      title: 'Choisis une histoire',
      text: 'Chaque histoire a un niveau (A1, A2…). Touche une couverture pour voir ses chapitres.',
    },
    {
      title: 'Tes mots et ton profil',
      text: 'En bas, l’onglet « Mes mots » rassemble ton vocabulaire et « Profil » tes réglages.',
    },
  ],
  story: [
    {
      target: 'summary',
      title: 'L’histoire',
      text: 'Le résumé, la durée de lecture et ton avancement dans l’histoire.',
    },
    {
      target: 'chapters',
      title: 'Les chapitres',
      text: 'Touche un chapitre pour le lire. Ta page est enregistrée : tu reprends où tu t’étais arrêté.',
    },
  ],
  reader: [
    {
      target: 'text',
      title: 'Touche un mot',
      text: 'Sa traduction s’affiche et le mot est ajouté à « Mes mots » pour le réviser plus tard.',
    },
    {
      target: 'audio',
      title: 'Écoute la page',
      text: 'Lance la lecture : le texte est surligné au fil de la voix. Un appui long sur un mot lance l’écoute à partir de là.',
    },
    {
      target: 'next',
      title: 'Page suivante',
      text: 'Avance page par page. À la fin du chapitre, tu gagnes des XP !',
    },
  ],
  vocabulary: [
    {
      target: 'review',
      title: 'Révise tes mots',
      text: 'Les mots reviennent juste avant que tu les oublies. Réviser te fait aussi gagner des XP.',
    },
    {
      target: 'search',
      title: 'Retrouve un mot',
      text: 'Cherche un mot ou sa traduction. Chaque carte rappelle la phrase où tu l’as rencontré.',
    },
  ],
  profile: [
    {
      target: 'goal',
      title: 'Ton objectif',
      text: 'Choisis combien d’XP gagner chaque jour.',
    },
    {
      target: 'readAlong',
      title: 'Surlignage audio',
      text: 'Préfères-tu écouter sans que le texte soit surligné ? Désactive-le ici.',
    },
    {
      target: 'replay',
      title: 'Revoir la démo',
      text: 'Tu peux revoir cette présentation à tout moment.',
    },
  ],
};
