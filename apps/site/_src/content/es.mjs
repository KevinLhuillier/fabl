export default {
  code: 'es',
  name: 'Español',
  slugs: {
    home: '',
    privacy: 'privacy',
    contact: 'contact',
    legal: 'legal',
    deletion: 'delete-account',
  },
  ui: {
    privacy: 'Privacidad',
    contact: 'Contacto',
    legal: 'Aviso legal',
    privacyPolicy: 'Política de privacidad',
    deletion: 'Eliminar mi cuenta',
    language: 'Idioma',
  },
  pages: {
    home: {
      title: 'Taleway — Aprende inglés con historias',
      description: 'Taleway: aprende inglés con minihistorias interactivas, del nivel A1 al C2.',
      body: () => `
<div class="wrap">
  <section class="hero">
    <img src="/icon.png" alt="Logo de Taleway" />
    <h1>Aprende inglés con historias</h1>
    <p>
      Minihistorias para leer capítulo a capítulo, del nivel A1 al C2, con voz en off,
      traducción de palabras y repasos inteligentes.
    </p>
    <span class="badge">Próximamente en Google Play</span>
  </section>

  <section class="features">
    <div class="card">
      <h2><span class="dot" style="background: var(--violet)"></span>Historias</h2>
      <p>Relatos a tu nivel, divididos en capítulos cortos.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--sun)"></span>Una palabra, una traducción</h2>
      <p>Toca una palabra para traducirla: se añade a tu lista «Mis palabras».</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--mint)"></span>Repasos</h2>
      <p>La repetición espaciada te devuelve las palabras en el momento justo.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--coral)"></span>Un objetivo diario</h2>
      <p>Unos minutos al día y una racha que mantener.</p>
    </div>
  </section>
</div>`,
    },

    privacy: {
      title: 'Política de privacidad — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Política de privacidad</h1>
  <p class="updated">Última actualización: 31 de octubre de 2026</p>

  <p>
    Esta política explica qué datos recoge la aplicación móvil Taleway («la aplicación»), para
    qué, y cuáles son tus derechos.
  </p>

  <h2>Responsable del tratamiento</h2>
  <p>
    ${c.name}, empresario individual (Francia), SIRET ${c.siret}, ${c.address}, Francia.<br />
    Contacto: <a href="mailto:${c.email}">${c.email}</a>
  </p>

  <h2>Datos recogidos</h2>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Dato</th>
          <th>Para qué</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Dirección de correo electrónico y contraseña (almacenada cifrada)</td>
          <td>Crear tu cuenta, iniciar sesión, restablecer tu contraseña</td>
        </tr>
        <tr>
          <td>Nombre de usuario</td>
          <td>Identificarte en la aplicación</td>
        </tr>
        <tr>
          <td>Idioma elegido y objetivo diario</td>
          <td>Mostrar la interfaz y las traducciones en tu idioma, seguir tu objetivo</td>
        </tr>
        <tr>
          <td>Progreso de lectura (historias, capítulos, páginas)</td>
          <td>Retomar la lectura donde la dejaste</td>
        </tr>
        <tr>
          <td>Palabras consultadas y resultados de los repasos</td>
          <td>Crear tu lista «Mis palabras» y programar tus repasos</td>
        </tr>
        <tr>
          <td>Tiempo de práctica, rachas y puntos</td>
          <td>Calcular tu objetivo del día y tu racha</td>
        </tr>
        <tr>
          <td>Suscripción premium (plan, estado, fecha de vencimiento, historial de compras)</td>
          <td>Desbloquear el contenido premium en tu cuenta, en todos tus dispositivos</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>Los pagos los procesa Google Play: nunca tenemos acceso a tus datos bancarios.</p>
  <p>
    Base jurídica: la ejecución del servicio que solicitas al crear una cuenta o suscribirte
    (artículo 6.1.b del RGPD).
  </p>

  <h2>Lo que no hacemos</h2>
  <ul>
    <li>Sin publicidad ni rastreadores publicitarios.</li>
    <li>Sin herramientas de analítica de terceros.</li>
    <li>No vendemos ni compartimos tus datos con fines comerciales.</li>
    <li>Sin acceso a la cámara, los contactos ni tu ubicación.</li>
  </ul>

  <h2>Micrófono y lectura en voz alta</h2>
  <p>
    El micrófono solo se usa cuando empiezas a leer una página en voz alta, y solo mientras
    está activa. El servicio de reconocimiento de voz de tu teléfono (Google en Android, Apple
    en iOS) convierte tu voz en texto y puede procesarla en sus servidores según su propia
    política de privacidad. Taleway solo recibe el texto reconocido, lo usa en tu teléfono para
    comparar tu lectura con la página y no conserva ni la grabación ni el texto.
  </p>

  <h2>Encargados del tratamiento</h2>
  <ul>
    <li><strong>Supabase</strong>: alojamiento de la base de datos y autenticación.</li>
    <li>
      <strong>RevenueCat</strong> (Estados Unidos): gestión de las suscripciones. Recibe el
      identificador técnico de tu cuenta y tu historial de compras, nunca tu correo electrónico
      ni tus datos de lectura.
    </li>
    <li>
      <strong>Google Play</strong>: pago de las suscripciones, según la
      <a href="https://policies.google.com/privacy">política de privacidad de Google</a>.
    </li>
  </ul>
  <p>
    Algunos datos pueden transferirse fuera de la Unión Europea; estas transferencias están
    amparadas por las cláusulas contractuales tipo de la Comisión Europea.
  </p>

  <h2>Plazo de conservación</h2>
  <p>
    Tus datos se conservan mientras exista tu cuenta. Al eliminarla, se borran en un plazo
    máximo de 30 días. Google Play y RevenueCat pueden conservar el historial de compras durante
    más tiempo para cumplir sus obligaciones contables y legales.
  </p>

  <h2>Tus derechos</h2>
  <p>
    Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento o
    solicitar su portabilidad escribiendo a <a href="mailto:${c.email}">${c.email}</a>. Para
    eliminar tu cuenta, consulta <a href="${u.deletion}">esta página</a>. También puedes
    presentar una reclamación ante tu autoridad de protección de datos, como la AEPD en España
    (<a href="https://www.aepd.es">aepd.es</a>) o la CNIL en Francia
    (<a href="https://www.cnil.fr">cnil.fr</a>).
  </p>

  <h2>Seguridad</h2>
  <p>
    Las comunicaciones entre la aplicación y nuestros servidores están cifradas (HTTPS). Cada
    usuario solo puede acceder a los datos de su propia cuenta.
  </p>

  <h2>Cambios</h2>
  <p>
    Esta política puede cambiar. La fecha de la parte superior indica la última versión. En caso
    de discrepancia entre traducciones, prevalece la <a href="/confidentialite">versión francesa</a>.
  </p>
</article>`,
    },

    contact: {
      title: 'Contacto — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Contacto</h1>
  <p>¿Una pregunta, un error, una idea para una historia? Escríbenos:</p>
  <p>
    Correo electrónico: <a href="mailto:${c.email}">${c.email}</a>
  </p>
  <p>
    ${c.name}, empresario individual<br />
    SIRET: ${c.siret}<br />
    ${c.address}, Francia
  </p>
</article>`,
    },

    legal: {
      title: 'Aviso legal — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Aviso legal</h1>

  <h2>Editor</h2>
  <p>
    ${c.name}, empresario individual (microempresa francesa)<br />
    SIRET: ${c.siret}<br />
    Dirección: ${c.address}, Francia<br />
    Correo electrónico: <a href="mailto:${c.email}">${c.email}</a><br />
    Director de la publicación: ${c.name}
  </p>

  <h2>Alojamiento</h2>
  <p>
    Vercel Inc.<br />
    440 N Barranca Ave #4133, Covina, CA 91723, Estados Unidos<br />
    <a href="https://vercel.com">vercel.com</a>
  </p>

  <h2>Propiedad intelectual</h2>
  <p>
    Los contenidos de este sitio y de la aplicación Taleway (textos, historias, ilustraciones,
    grabaciones de audio, logotipo) están protegidos. Queda prohibida cualquier reproducción sin
    autorización.
  </p>

  <h2>Datos personales</h2>
  <p>Consulta la <a href="${u.privacy}">política de privacidad</a>.</p>
</article>`,
    },

    deletion: {
      title: 'Eliminar mi cuenta — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Eliminar mi cuenta de Taleway</h1>

  <h2>Desde la aplicación</h2>
  <ol>
    <li>Abre Taleway y ve a la pestaña <strong>Perfil</strong>.</li>
    <li>Toca <strong>Eliminar mi cuenta</strong> en la parte inferior de la pantalla.</li>
    <li>Confirma: tu cuenta y tus datos se borran de inmediato.</li>
  </ol>

  <h2>Por correo electrónico</h2>
  <p>Si ya no tienes acceso a la aplicación:</p>
  <ol>
    <li>
      Envía un correo a <a href="mailto:${c.email}?subject=Eliminar%20mi%20cuenta%20de%20Taleway">${c.email}</a>
      con el asunto «Eliminar mi cuenta de Taleway».
    </li>
    <li>Envíalo desde la dirección de correo de tu cuenta de Taleway (o indícala en el mensaje).</li>
    <li>Recibirás una confirmación cuando se haya realizado la eliminación.</li>
  </ol>

  <h2>Suscripción</h2>
  <p>
    Eliminar tu cuenta no cancela una suscripción activa: cancélala antes en Google Play
    (<strong>Pagos y suscripciones → Suscripciones</strong>).
  </p>

  <h2>Datos eliminados</h2>
  <p>Todos los datos vinculados a tu cuenta se borran definitivamente:</p>
  <ul>
    <li>dirección de correo electrónico, contraseña y nombre de usuario;</li>
    <li>idioma y objetivo diario;</li>
    <li>progreso de lectura;</li>
    <li>lista «Mis palabras» e historial de repasos;</li>
    <li>tiempo de práctica, rachas y puntos;</li>
    <li>estado de tu suscripción.</li>
  </ul>
  <p>
    Google Play y RevenueCat pueden conservar el historial de compras para cumplir sus
    obligaciones contables y legales.
  </p>

  <h2>Plazo</h2>
  <p>Desde la aplicación, la eliminación es inmediata. Por correo electrónico, se realiza en un plazo máximo de 30 días. Después no se conserva ningún otro dato.</p>
</article>`,
    },
  },
};
