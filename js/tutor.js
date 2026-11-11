// Tutor de conversación con IA (Claude), a tu nivel y en situaciones de cada lección del libro.
// Usa el SDK oficial de Anthropic empaquetado para el navegador (vendor/anthropic-sdk.js, se carga solo aquí).
// Necesita tu propia clave de API: se guarda SOLO en este dispositivo, en una clave de almacenamiento aparte
// del progreso, así que nunca sale al exportar ni al sincronizar. Cada mensaje tiene un coste en tu cuenta.
(function () {
  const D = window.DATOS;
  const V = window.Vistas;
  const I = window.Items;
  const esc = V.esc;
  const $app = () => document.getElementById('app');
  const CLAVE_API = 'hanzi-tutor-clave';
  const MODELO = 'claude-opus-5-5';

  const ESCENARIOS = [
    { l: 1, titulo: 'Saludar', zh: '打招呼', situacion: 'Os encontráis por la mañana y os saludáis; preguntas cómo está la otra persona y su familia.' },
    { l: 2, titulo: 'Presentarse', zh: '认识新朋友', situacion: 'Conoces a alguien nuevo: preguntáis el apellido y el nombre, y le ofreces té o café.' },
    { l: 3, titulo: 'La familia', zh: '我的家', situacion: 'Habláis de vuestras familias: cuántas personas son, hermanos, hijos y edades.' },
    { l: 4, titulo: 'Nacionalidad y trabajo', zh: '你是哪国人', situacion: 'Preguntáis de qué país sois, qué idiomas habláis y en qué trabajáis.' },
    { l: 5, titulo: 'Fechas y cumpleaños', zh: '生日', situacion: 'Habláis de la fecha de hoy, del cumpleaños de alguien y de una fiesta.' },
    { l: 6, titulo: 'Salir a comer', zh: '去饭馆', situacion: 'Os encontráis en la calle: adónde vas, tienes hambre y decidís ir a comer comida china.' },
    { l: 7, titulo: 'Dirección y teléfono', zh: '你住在哪儿', situacion: 'Preguntáis dónde vivís, si está lejos, y os pedís el número de móvil.' },
    { l: 8, titulo: 'La hora y la rutina', zh: '几点了', situacion: 'Preguntáis la hora y habláis de vuestra rutina: levantarse, trabajar, comer, dormir.' },
    { l: 9, titulo: 'De compras', zh: '买东西', situacion: 'Estás en una tienda o centro comercial y quieres comprar libros, bolígrafos o un móvil.' },
    { l: 10, titulo: 'Regatear en el mercado', zh: '多少钱', situacion: 'Compras fruta en un mercado: preguntas precios, te parece caro y pides descuento.' },
    { l: 10, titulo: 'Conversación libre', zh: '自由对话', situacion: 'Conversación libre sobre cualquier tema cotidiano que proponga el alumno.' },
  ];

  const leerClave = () => { try { return localStorage.getItem(CLAVE_API) || ''; } catch (e) { return ''; } };
  const guardarClave = v => { try { v ? localStorage.setItem(CLAVE_API, v) : localStorage.removeItem(CLAVE_API); } catch (e) { /* ignorar */ } };

  // Carga perezosa del SDK (785 KB): solo cuando se usa el tutor
  let sdk = null;
  function cargarSDK() {
    if (sdk) return Promise.resolve(sdk);
    if (window.AnthropicSDK) return Promise.resolve(sdk = window.AnthropicSDK);
    return new Promise((ok, fallo) => {
      const s = document.createElement('script');
      s.src = 'vendor/anthropic-sdk.js';
      s.onload = () => ok(sdk = window.AnthropicSDK);
      s.onerror = () => fallo(new Error('No se pudo cargar el tutor (¿sin conexión?).'));
      document.head.appendChild(s);
    });
  }

  function esquema(z) {
    return z.object({
      respuesta: z.object({
        hanzi: z.string().describe('Lo que dice el tutor, en chino simplificado'),
        pinyin: z.string().describe('Pinyin con marcas de tono de la respuesta'),
        espanol: z.string().describe('Traducción al español de la respuesta'),
      }),
      correccion: z.object({
        hay_error: z.boolean().describe('true si el último mensaje del alumno tiene errores'),
        corregido_hanzi: z.string().describe('Versión correcta en chino del mensaje del alumno (vacío si no había errores o si escribió en español)'),
        corregido_pinyin: z.string().describe('Pinyin de la versión corregida (vacío si no aplica)'),
        explicacion: z.string().describe('Explicación breve en español del error, o cómo se dice en chino si el alumno escribió en español; vacío si estaba bien'),
      }),
      sugerencia: z.object({
        hanzi: z.string().describe('Una respuesta sencilla que el alumno podría dar ahora, en chino'),
        pinyin: z.string(),
        espanol: z.string(),
      }),
    });
  }

  function sistema(esc_) {
    const palabras = D.vocabulario.palabras.filter(p => p.l <= esc_.l).map(p => p.w).join('、');
    return `Eres un tutor paciente de chino mandarín para un hispanohablante principiante que estudia con el libro «Chino paso a paso 1».
Escenario de práctica: ${esc_.titulo}. ${esc_.situacion}
Haz de interlocutor natural en esa situación: escribe una o dos frases cortas por turno, en chino simplificado, y termina normalmente con una pregunta para que el alumno siga hablando.
Nivel: usa casi solo este vocabulario de las lecciones 1 a ${esc_.l} (más números y nombres propios): ${palabras}. Si necesitas otra palabra, que sea muy común.
El alumno puede escribir en chino, en pinyin o en español. Si escribe en español, enséñale cómo se dice en chino en la corrección. Si escribe en pinyin, corrige los tonos si fallan.
En la corrección sé amable y concreto: un solo punto importante, explicado en español. Si el mensaje estaba bien, deja la explicación vacía y hay_error en false.
La sugerencia debe ser una respuesta breve y fácil que el alumno pueda decir ahora mismo.`;
  }

  let chat = null; // { escenario, mensajes: [...], vista: [...] }

  function pantalla() {
    const clave = leerClave();
    $app().innerHTML = `
      <section class="portada"><h1>Tutor <span class="hz">老师</span></h1>
        <p>Conversa en chino a tu nivel en situaciones de cada lección. El tutor te responde con pinyin y traducción, corrige lo que escribes y te sugiere qué decir. Puedes escribir en chino, en pinyin o en español.</p></section>
      ${clave ? `
      <div class="escenarios">
        ${ESCENARIOS.map((e, k) => `
          <button class="escenario" data-k="${k}">
            <span class="nivel-num">${k < 10 ? e.l : '∞'}</span>
            <span><b>${esc(e.titulo)}</b> <span class="hz">${esc(e.zh)}</span><small>${esc(e.situacion)}</small></span>
          </button>`).join('')}
      </div>
      <details class="ajustes"><summary>${window.Iconos.svg('llave')} Clave de API</summary>${htmlClave(true)}</details>` : `
      <section class="caja-repaso">
        <h2>${window.Iconos.svg('llave')} Configura el tutor</h2>
        ${htmlClave(false)}
      </section>`}`;
    montarClave();
    $app().querySelectorAll('.escenario').forEach(b => b.onclick = () => empezar(ESCENARIOS[+b.dataset.k]));
  }

  function htmlClave(hayClave) {
    return `
      <p>El tutor usa la IA de Claude (Anthropic) y necesita <b>tu propia clave de API</b>. Créala en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> y pégala aquí.</p>
      <ul class="nota">
        <li>Se guarda <b>solo en este dispositivo</b>. No se incluye al exportar ni al sincronizar el progreso.</li>
        <li>Cada mensaje se cobra en tu cuenta de Anthropic: orientativamente, uno o dos céntimos de dólar.</li>
        <li>No la uses en un dispositivo compartido.</li>
      </ul>
      <div class="fila">
        <input type="password" id="clave-api" class="campo" placeholder="sk-ant-…" autocomplete="off" spellcheck="false" value="">
        <button class="btn" id="guardar-clave">Guardar</button>
        ${hayClave ? '<button class="btn peligro" id="borrar-clave">Borrar clave</button>' : ''}
      </div>
      ${hayClave ? `<p class="nota">${window.Iconos.svg('check')} Hay una clave guardada en este dispositivo.</p>` : ''}`;
  }
  function montarClave() {
    const g = document.getElementById('guardar-clave');
    if (g) g.onclick = () => {
      const v = document.getElementById('clave-api').value.trim();
      if (!v) return V.toast('Pega primero la clave.');
      guardarClave(v);
      V.toast('Clave guardada en este dispositivo.');
      pantalla();
    };
    const b = document.getElementById('borrar-clave');
    if (b) b.onclick = () => { guardarClave(''); V.toast('Clave borrada.'); pantalla(); };
  }

  function empezar(escenario) {
    chat = { escenario, mensajes: [], vista: [] };
    // Ruta propia para el chat, así «atrás» vuelve a la lista de escenarios
    location.hash = '#/tutor/chat';
    enviar('(Empieza tú la conversación del escenario.)', true);
  }

  function burbujaTutor(o) {
    const r = o.respuesta, c = o.correccion, s = o.sugerencia;
    return `
      ${c && (c.hay_error || c.explicacion) ? `
        <div class="correccion">${window.Iconos.svg('pincel')} ${c.corregido_hanzi ? `<span class="hz">${esc(c.corregido_hanzi)}</span> <span class="py">${esc(c.corregido_pinyin)}</span><br>` : ''}${esc(c.explicacion)}</div>` : ''}
      <div class="burbuja tutor">
        <div class="hz frase-chat">${esc(r.hanzi)} ${V.hablar(r.hanzi)}</div>
        <div class="py">${esc(r.pinyin)}</div>
        <div class="trad">${esc(r.espanol)}</div>
      </div>
      ${s && s.hanzi ? `<button class="sugerencia" data-sug="${esc(s.hanzi)}">${window.Iconos.svg('bombilla')} Podrías decir: <span class="hz">${esc(s.hanzi)}</span> <span class="py">${esc(s.pinyin)}</span> <small>${esc(s.espanol)}</small></button>` : ''}`;
  }

  function pintarChat() {
    const e = chat.escenario;
    const dictado = window.SpeechRecognition || window.webkitSpeechRecognition;
    $app().innerHTML = `
      <nav class="migas"><a href="#/tutor">← Escenarios</a><span class="marcador">${esc(e.titulo)} · <span class="hz">${esc(e.zh)}</span></span></nav>
      <section class="chat" id="chat" aria-live="polite">
        ${chat.vista.map(v => v.tipo === 'yo' ? `<div class="burbuja yo">${esc(v.texto)}</div>` : v.tipo === 'error' ? `<p class="aviso-mal">${esc(v.texto)}</p>` : burbujaTutor(v.datos)).join('')}
        ${chat.pensando ? '<div class="burbuja tutor pensando">…</div>' : ''}
      </section>
      <form class="entrada-chat" id="form-chat">
        ${dictado ? `<button type="button" class="btn sec" id="dictar" title="Dictar en chino" aria-label="Dictar en chino">${window.Iconos.svg('micro')}</button>` : ''}
        <input class="campo" id="msg" placeholder="Escribe en chino, pinyin o español…" autocomplete="off" ${chat.pensando ? 'disabled' : ''}>
        <button class="btn" ${chat.pensando ? 'disabled' : ''}>Enviar</button>
      </form>`;
    const $chat = document.getElementById('chat');
    $chat.scrollTop = $chat.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    document.getElementById('form-chat').onsubmit = ev => {
      ev.preventDefault();
      const t = document.getElementById('msg').value.trim();
      if (t && !chat.pensando) enviar(t);
    };
    $chat.querySelectorAll('[data-sug]').forEach(b => b.onclick = () => { const m = document.getElementById('msg'); m.value = b.dataset.sug; m.focus(); });
    const d = document.getElementById('dictar');
    if (d) d.onclick = () => dictar(d);
    if (!chat.pensando) document.getElementById('msg').focus({ preventScroll: true });
  }

  // Dictado por voz en chino (Chrome, Edge y Safari lo permiten)
  function dictar(boton) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new R();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    boton.classList.add('grabando');
    rec.onresult = e => { document.getElementById('msg').value = e.results[0][0].transcript; };
    rec.onerror = e => V.toast(e.error === 'not-allowed' ? 'Permite el micrófono para dictar.' : 'No se pudo reconocer la voz.');
    rec.onend = () => boton.classList.remove('grabando');
    rec.start();
  }

  async function enviar(texto, oculto) {
    if (!oculto) chat.vista.push({ tipo: 'yo', texto });
    chat.mensajes.push({ role: 'user', content: texto });
    chat.pensando = true;
    pintarChat();
    const escenario = chat.escenario;
    try {
      const { Anthropic, betaZodOutputFormat, z } = await cargarSDK();
      const cliente = new Anthropic({ apiKey: leerClave(), dangerouslyAllowBrowser: true });
      try {
        const resp = await cliente.beta.messages.parse({
          model: MODELO,
          max_tokens: 16000,
          // Si el modelo rechazara la petición, el servidor la reintenta con otro modelo adecuado
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low', format: betaZodOutputFormat(esquema(z)) },
          cache_control: { type: 'ephemeral' },
          system: sistema(escenario),
          messages: chat.mensajes,
        });
        if (chat === null || chat.escenario !== escenario) return; // el usuario salió del chat
        // Se devuelve el contenido completo (incluidos los bloques de razonamiento) en el siguiente turno
        chat.mensajes.push({ role: 'assistant', content: resp.content });
        if (resp.stop_reason === 'refusal' || !resp.parsed_output) {
          chat.vista.push({ tipo: 'error', texto: 'El tutor no pudo responder a ese mensaje. Prueba a decirlo de otra forma.' });
        } else {
          chat.vista.push({ tipo: 'tutor', datos: resp.parsed_output });
          window.Voz.decir(resp.parsed_output.respuesta.hanzi);
        }
      } catch (e) {
        chat.mensajes.pop(); // el mensaje no llegó: se puede reenviar
        let msg = 'No se pudo contactar con el tutor.';
        if (e instanceof Anthropic.AuthenticationError) msg = 'La clave de API no es válida. Revísala en «Tutor → Clave de API».';
        else if (e instanceof Anthropic.PermissionDeniedError) msg = 'Tu clave no tiene permiso para usar este modelo.';
        else if (e instanceof Anthropic.RateLimitError) msg = 'Demasiados mensajes seguidos o sin saldo: espera un poco o revisa tu cuenta de Anthropic.';
        else if (e instanceof Anthropic.APIConnectionError) msg = 'Sin conexión a internet: el tutor necesita conexión.';
        else if (e instanceof Anthropic.APIError) msg = `Error del servicio (${e.status}). Inténtalo de nuevo.`;
        chat.vista.push({ tipo: 'error', texto: msg });
      }
    } catch (e) {
      chat.mensajes.pop();
      chat.vista.push({ tipo: 'error', texto: e.message });
    }
    chat.pensando = false;
    if (location.hash.startsWith('#/tutor/chat')) pintarChat();
  }

  function ruta(sub) {
    if (sub === 'chat' && chat) return pintarChat();
    pantalla();
  }

  window.Tutor = { ruta, pantalla };
})();
