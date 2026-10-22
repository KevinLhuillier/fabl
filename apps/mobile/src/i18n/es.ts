import type { Messages } from './fr';

/** Spanish interface texts (same keys as `fr`). */

/** "2.699": Spanish thousands separator (no Intl dependency). */
const number = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** Spanish plural: only 1 is singular. */
const count = (n: number, one: string, many: string) => `${number(n)} ${n === 1 ? one : many}`;

export const es: Messages = {
  number,
  common: {
    back: 'Volver',
    continue: 'Continuar',
    close: 'Cerrar',
    cancel: 'Cancelar',
    gotIt: 'Entendido',
    next: 'Siguiente',
    skip: 'Saltar',
    retry: 'Reintentar',
    chapters: (n) => count(n, 'capítulo', 'capítulos'),
    pages: (n) => count(n, 'página', 'páginas'),
    words: (n) => count(n, 'palabra', 'palabras'),
    minutes: (n) => `${n} min`,
  },
  levels: {
    A1: 'Principiante',
    A2: 'Elemental',
    B1: 'Intermedio',
    B2: 'Intermedio alto',
    C1: 'Avanzado',
    C2: 'Maestría',
  },
  pos: {
    NOUN: 'sustantivo',
    PROPN: 'nombre propio',
    VERB: 'verbo',
    ADJ: 'adjetivo',
    ADV: 'adverbio',
    PRON: 'pronombre',
    DET: 'determinante',
    ADP: 'preposición',
    CCONJ: 'conjunción',
    SCONJ: 'conjunción',
    NUM: 'número',
    INTJ: 'interjección',
    PART: 'partícula',
  },
  tabs: {
    stories: 'Historias',
    vocabulary: 'Mis palabras',
    profile: 'Perfil',
  },
  signIn: {
    tagline: 'Aprende inglés viviendo historias en las que tú eres el héroe.',
    welcomeBack: '¡Qué bueno verte de nuevo!',
    createAccount: 'Crea tu cuenta',
    email: 'Correo electrónico',
    password: 'Contraseña (mín. 6 caracteres)',
    signIn: 'Iniciar sesión',
    signUp: 'Registrarse',
    noAccount: '¿Aún no tienes cuenta? Regístrate',
    haveAccount: 'Ya tengo una cuenta',
    accountCreated:
      '¡Cuenta creada! Haz clic en el enlace que recibiste por correo y luego inicia sesión.',
    errors: {
      invalidCredentials: 'Correo o contraseña incorrectos.',
      emailNotConfirmed:
        'Confirma tu correo (con el enlace que recibiste) y vuelve a iniciar sesión.',
      alreadyRegistered: 'Ya existe una cuenta con este correo.',
      passwordTooShort: 'La contraseña debe tener al menos 6 caracteres.',
      invalidEmail: 'Correo electrónico no válido.',
    },
  },
  home: {
    title: 'Tus historias',
    toReviewToday: (n) => `${count(n, 'palabra', 'palabras')} para repasar hoy`,
    review: 'Repasar',
    loadError: (message) => `No se pudieron cargar las historias: ${message}`,
    comingSoon: 'Pronto habrá nuevas historias',
  },
  stats: {
    goalReached: '¡Objetivo cumplido!',
    dailyGoal: 'Objetivo del día',
  },
  storyTile: {
    a11y: (title, level, percent) => `${title}, nivel ${level}, ${percent} % leído`,
  },
  story: {
    readingTime: (minutes) => `≈ ${minutes} min`,
  },
  toc: {
    contents: 'Índice',
    storyDone: '¡Historia terminada!',
    end: 'Fin',
    chapterA11y: (n, title) => `Capítulo ${n}: ${title}`,
    resume: (page, total) => `CONTINUAR · PÁGINA ${page} / ${total}`,
    start: 'EMPEZAR A LEER',
  },
  reader: {
    close: 'Cerrar el capítulo',
    notFound: 'Capítulo no encontrado: vuelve a publicar la historia.',
    header: (n, title, page, total) =>
      `CAPÍTULO ${n} · ${title.toUpperCase()} · PÁGINA ${page}/${total}`,
    longPressHint: 'Mantén pulsada una palabra para escuchar desde ahí',
    tapHint: 'Toca una palabra para ver su traducción',
    finish: 'Terminar el capítulo',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    chapterTitle: (n, title) => `Capítulo ${n} · ${title}`,
    play: 'Escuchar la página',
    pause: 'Pausar la lectura',
  },
  wordSheet: {
    baseForm: 'forma base: ',
    translationSoon: 'Traducción disponible pronto',
    added: 'Añadida a tus palabras',
    alreadyAdded: 'Ya está en tus palabras',
  },
  vocabulary: {
    title: 'Mis palabras',
    toReview: (n) => `${count(n, 'palabra', 'palabras')} para repasar`,
    allReviewed: 'Todo repasado',
    learned: (n) => count(n, 'palabra aprendida', 'palabras aprendidas'),
    review: 'Repasar',
    practice: 'Practicar',
    search: 'Buscar una palabra o una traducción',
    noMatch: 'Ninguna palabra coincide.',
    empty: 'Toca una palabra en una historia para ver su traducción: aparecerá aquí.',
    due: 'Para repasar',
    removeA11y: (word) => `Quitar «${word}»`,
    removeTitle: '¿Quitar esta palabra?',
    removeMessage: (word) => `«${word}» ya no estará en tus palabras ni en tus repasos.`,
    remove: 'Quitar',
  },
  review: {
    quit: 'Salir del repaso',
    nothingTitle: 'Nada que repasar',
    nothingText: 'Lee una historia y toca palabras para llenar tu lista.',
    score: (correct, total) => `${correct} / ${total} respuestas correctas`,
    howDoYouSay: '¿Cómo se dice en inglés…?',
    whatDoesItMean: '¿Qué significa…?',
    right: '¡Muy bien!',
    almost: '¡Casi!',
    correctAnswer: 'Respuesta correcta: ',
    typeEnglish: 'Escribe la palabra en inglés',
    typeTranslation: 'Escribe la traducción',
    yourAnswer: 'Tu respuesta',
    check: 'Comprobar',
    dontKnow: 'No lo sé',
    watchSpelling: 'Cuidado con la ortografía.',
    quote: (sentence) => `«${sentence}»`,
  },
  celebration: {
    chapter: '¡Capítulo terminado!',
    story: '¡Historia terminada!',
    review: '¡Repaso terminado!',
    streak: (days) => `Racha: ${days} d`,
    goalReached: '¡Objetivo del día cumplido!',
    goalProgress: (xp, goal) => `Objetivo del día: ${xp} / ${goal} XP`,
    nextChapter: 'Capítulo siguiente',
    later: 'Más tarde',
  },
  language: {
    title: 'Elige tu idioma',
    hint: 'Para la aplicación y la traducción de las palabras. Podrás cambiarlo en tu perfil.',
  },
  profile: {
    title: 'Perfil',
    totalXp: 'XP en total',
    currentStreak: 'Racha actual',
    bestStreak: 'Mejor racha',
    dailyGoal: 'Objetivo diario',
    dailyGoalHint: 'XP que quieres ganar cada día.',
    readAlong: 'Resaltado del audio',
    readAlongHint: 'Resalta el texto y la palabra leída mientras escuchas.',
    language: 'Idioma',
    languageHint: 'Idioma de la aplicación y de las traducciones.',
    replay: 'Ver la demo otra vez',
    signOut: 'Cerrar sesión',
  },
  tour: {
    home: {
      stats: {
        title: 'Tu progreso',
        text: 'Tu racha de días, tus XP y tu objetivo del día. ¡Lee o repasa cada día para mantener tu racha!',
      },
      stories: {
        title: 'Elige una historia',
        text: 'Cada historia tiene un nivel (A1, A2…). Toca una portada para ver sus capítulos.',
      },
      tabs: {
        title: 'Tus palabras y tu perfil',
        text: 'Abajo, la pestaña «Mis palabras» reúne tu vocabulario y «Perfil» tus ajustes.',
      },
    },
    story: {
      summary: {
        title: 'La historia',
        text: 'El resumen, el tiempo de lectura y tu avance en la historia.',
      },
      chapters: {
        title: 'Los capítulos',
        text: 'Toca un capítulo para leerlo. Tu página se guarda: continúas donde lo dejaste.',
      },
    },
    reader: {
      text: {
        title: 'Toca una palabra',
        text: 'Aparece su traducción y la palabra se añade a «Mis palabras» para repasarla más tarde.',
      },
      audio: {
        title: 'Escucha la página',
        text: 'Inicia la lectura: el texto se resalta al ritmo de la voz. Mantén pulsada una palabra para escuchar desde ahí.',
      },
      next: {
        title: 'Página siguiente',
        text: 'Avanza página a página. ¡Al final del capítulo ganas XP!',
      },
    },
    vocabulary: {
      review: {
        title: 'Repasa tus palabras',
        text: 'Las palabras vuelven justo antes de que las olvides. Repasar también te da XP.',
      },
      search: {
        title: 'Encuentra una palabra',
        text: 'Busca una palabra o su traducción. Cada tarjeta recuerda la frase donde la encontraste.',
      },
    },
    profile: {
      goal: {
        title: 'Tu objetivo',
        text: 'Elige cuántos XP quieres ganar cada día.',
      },
      readAlong: {
        title: 'Resaltado del audio',
        text: '¿Prefieres escuchar sin que se resalte el texto? Desactívalo aquí.',
      },
      language: {
        title: 'Idioma',
        text: 'Cambia el idioma de la aplicación y de las traducciones.',
      },
      replay: {
        title: 'Ver la demo otra vez',
        text: 'Puedes volver a ver esta presentación cuando quieras.',
      },
    },
  },
};
