// Pantallas de la aplicación (todo se pinta dentro de <main id="app">).
(function () {
  const D = window.DATOS;
  const P = window.Progreso;
  const $app = () => document.getElementById('app');

  const TIPOS = {
    P: ['Pictograma', 'Dibujo estilizado de un objeto.'],
    S: ['Simbólico', 'Signo abstracto que indica una idea (números, posiciones).'],
    I: ['Ideograma compuesto', 'Combina varios componentes cuyo significado se suma.'],
    F: ['Fonético-semántico', 'Una parte da el significado y otra da el sonido. ~80 % de los caracteres son así.'],
  };

  // Primer carácter de la descomposición IDS → disposición de los componentes
  const ESTRUCTURAS = {
    '⿰': '◧ izquierda + derecha', '⿱': '⬒ arriba + abajo', '⿲': 'izquierda + centro + derecha',
    '⿳': 'arriba + centro + abajo', '⿴': '▣ rodeado por completo', '⿵': 'rodeado por arriba',
    '⿶': 'rodeado por abajo', '⿷': 'rodeado por la izquierda', '⿸': 'rodeado por arriba a la izquierda',
    '⿹': 'rodeado por arriba a la derecha', '⿺': 'rodeado por abajo a la izquierda', '⿻': 'componentes superpuestos',
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  // Quita las marcas de tono conservando la ü (su diéresis es U+0308, que se recompone con NFC)
  function sinTono(s) { return s.normalize('NFD').replace(/[̀-̄̌]/g, '').normalize('NFC'); }
  function tonoClase(t) { return 't' + (t || 5); }
  function estrellas(n, total = 3) {
    return '<span class="estrellas" aria-label="' + n + ' de ' + total + ' estrellas">' +
      Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('') + '</span>';
  }
  function hablar(texto) {
    return `<button class="btn-audio" data-decir="${esc(texto)}" title="Escuchar" aria-label="Escuchar ${esc(texto)}">🔊</button>`;
  }
  function chip(c) {
    const ch = D.caracteres[c];
    const dom = P.dominio(c);
    return `<a class="chip dom${dom}" href="#/caracter/${encodeURIComponent(c)}" title="${esc(ch ? ch.pinyin + ' · ' + ch.significado : c)}">${esc(c)}</a>`;
  }

  // ── Conjuntos de caracteres (un nivel o una lección del libro) ──────
  function conjunto(tipo, id) {
    id = +id;
    if (tipo === 'nivel') {
      const n = D.niveles[id - 1];
      if (!n) return null;
      return { tipo, id, ruta: `#/nivel/${id}`, titulo: `Nivel ${id} · ${n.nombre}`, tituloZh: n.nombreZh, chars: n.caracteres };
    }
    if (tipo === 'libro') {
      const l = D.libro[id - 1];
      if (!l) return null;
      return { tipo, id, ruta: `#/libro/${id}`, titulo: `Lección ${id} · ${l.tituloEs}`, tituloZh: l.titulo, chars: [...l.caracteres] };
    }
    return null;
  }

  // ── Inicio: mapa de niveles ─────────────────────────────────────────
  function inicio() {
    const st = P.estadisticas();
    const racha = P.racha();
    const pend = P.pendientes().length;
    const total = Object.keys(D.caracteres).length;
    const aj = P.ajustes();
    $app().innerHTML = `
      <section class="hero">
        <div>
          <h1>Aprende chino <span class="hz">一步一步</span></h1>
          <p>${total} caracteres del chino simplificado ordenados en 10 niveles de dificultad: su pinyin, su significado, de qué componentes están hechos y cómo se escriben.</p>
        </div>
        <div class="stats">
          <div><b>${st.vistos}</b><span>vistos</span></div>
          <div><b>${st.dominados}</b><span>dominados</span></div>
          <div><b>${racha.dias || 0}</b><span>días de racha</span></div>
        </div>
      </section>
      ${pend ? `<a class="aviso-repaso" href="#/repaso">🔁 Tienes <b>${pend}</b> caracteres para repasar hoy <span>Repasar →</span></a>` : ''}
      <section class="niveles">
        ${D.niveles.map(n => {
          const abierto = P.desbloqueado(n.nivel);
          const pr = P.nivel(n.nivel);
          const avance = Math.round(P.progresoNivel(n.nivel) * 100);
          return `
          <a class="nivel-card ${abierto ? '' : 'bloqueado'}" href="${abierto ? '#/nivel/' + n.nivel : '#/'}" ${abierto ? '' : 'aria-disabled="true" data-bloqueado="1"'}>
            <div class="nivel-num">${n.nivel}</div>
            <div class="nivel-info">
              <h3>${esc(n.nombre)} <span class="hz">${esc(n.nombreZh)}</span></h3>
              <div class="muestra hz">${n.caracteres.slice(0, 8).join(' ')}</div>
              <div class="barra-avance"><span style="width:${avance}%"></span></div>
            </div>
            <div class="nivel-estado">${abierto ? estrellas(pr.estrellas) : '🔒'}</div>
          </a>`;
        }).join('')}
      </section>
      <details class="ajustes">
        <summary>⚙️ Ajustes y progreso</summary>
        <label class="fila"><input type="checkbox" id="aj-todo" ${aj.desbloquearTodo ? 'checked' : ''}> Desbloquear todos los niveles</label>
        <label class="fila">Velocidad de la voz
          <input type="range" id="aj-vel" min="0.5" max="1.2" step="0.1" value="${aj.velocidadVoz}"> <output>${aj.velocidadVoz}</output></label>
        <p class="nota">${window.Voz.disponible() ? '🔊 Voz en chino disponible.' : '⚠️ No hay ninguna voz en chino instalada. En Windows: Configuración → Hora e idioma → Idioma y región → Agregar un idioma → Chino (simplificado, China), marcando «Texto a voz». Después reinicia la app.'}</p>
        <div class="fila botones">
          <button class="btn sec" id="aj-exportar">Exportar progreso</button>
          <button class="btn sec" id="aj-importar">Importar progreso</button>
          <button class="btn peligro" id="aj-reiniciar">Borrar progreso</button>
        </div>
        <p class="nota">Para desbloquear un nivel consigue al menos 1 estrella (70 %) en el desafío del nivel anterior.</p>
      </details>
      <footer class="creditos">
        Datos: ${D.fuentes.map(esc).join(' · ')}. Trazos animados con Hanzi Writer.
      </footer>`;

    $app().querySelectorAll('[data-bloqueado]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); toast('Consigue al menos 1 estrella en el nivel anterior para desbloquearlo.');
    }));
    document.getElementById('aj-todo').onchange = e => { P.cambiarAjuste('desbloquearTodo', e.target.checked); inicio(); };
    const vel = document.getElementById('aj-vel');
    vel.oninput = () => { vel.nextElementSibling.textContent = vel.value; P.cambiarAjuste('velocidadVoz', +vel.value); };
    vel.onchange = () => window.Voz.decir('你好，我们一起学汉语');
    document.getElementById('aj-exportar').onclick = async () => {
      const txt = P.exportar();
      try { await navigator.clipboard.writeText(txt); toast('Progreso copiado al portapapeles.'); }
      catch (e) { prompt('Copia este texto para guardar tu progreso:', txt); }
    };
    document.getElementById('aj-importar').onclick = () => {
      const txt = prompt('Pega aquí el texto de tu progreso exportado:');
      if (!txt) return;
      try { P.importar(txt); toast('Progreso importado.'); inicio(); } catch (e) { toast('Ese texto no es un progreso válido.'); }
    };
    document.getElementById('aj-reiniciar').onclick = () => {
      if (confirm('¿Seguro que quieres borrar todo tu progreso? No se puede deshacer.')) { P.reiniciar(); inicio(); }
    };
  }

  // ── Portada de un nivel o lección ───────────────────────────────────
  function portada(cj) {
    const esNivel = cj.tipo === 'nivel';
    const pr = esNivel ? P.nivel(cj.id) : null;
    const vistos = cj.chars.filter(c => P.char(c)?.visto).length;
    $app().innerHTML = `
      <nav class="migas"><a href="${esNivel ? '#/' : '#/libro'}">← ${esNivel ? 'Niveles' : 'Libro'}</a></nav>
      <section class="portada">
        <div>
          <h1>${esc(cj.titulo)} <span class="hz">${esc(cj.tituloZh)}</span></h1>
          <p>${cj.chars.length} caracteres · ${vistos} vistos${esNivel ? ` · mejor resultado ${Math.round(pr.mejor * 100)} % ${estrellas(pr.estrellas)}` : ''}</p>
        </div>
      </section>
      <section class="modos">
        <a class="modo" href="${cj.ruta}/aprender"><span class="ico">📖</span><b>Aprender</b><small>Fichas con pinyin, significado, componentes y trazos</small></a>
        <a class="modo" href="${cj.ruta}/practicar"><span class="ico">🎯</span><b>Practicar</b><small>Preguntas sin límite para afianzar</small></a>
        <a class="modo" href="${cj.ruta}/escribir"><span class="ico">✍️</span><b>Escribir</b><small>Traza cada carácter en el orden correcto</small></a>
        ${esNivel ? `<a class="modo destacado" href="${cj.ruta}/desafio"><span class="ico">🏆</span><b>Desafío</b><small>20 preguntas: gana estrellas y desbloquea el siguiente nivel</small></a>` : ''}
      </section>
      <section class="rejilla">
        ${cj.chars.map(c => {
          const ch = D.caracteres[c];
          return `<a class="celda dom${P.dominio(c)}" href="#/caracter/${encodeURIComponent(c)}">
            <span class="hz grande">${esc(c)}</span>
            <span class="py ${tonoClase(ch.tono)}">${esc(ch.pinyin)}</span>
            <span class="sig">${esc(ch.significado)}</span>
          </a>`;
        }).join('')}
      </section>
      <p class="nota leyenda">El color del borde indica tu dominio: <span class="chip dom0">新</span> nuevo → <span class="chip dom5">精</span> dominado.</p>`;
  }

  // ── Ficha completa de un carácter ───────────────────────────────────
  function ficha(c, contexto) {
    const ch = D.caracteres[c];
    if (!ch) return `<p>Carácter no encontrado.</p>`;
    const tipo = TIPOS[ch.tipo] || ['', ''];
    const nivel = D.niveles[ch.nivel - 1];
    const comps = ch.componentes.filter(k => k.c && k.c !== '—');
    const contienen = (D.componentes.find(f => f.c === c)?.caracteres || []).filter(x => x !== c);
    return `
      <article class="ficha">
        <div class="ficha-izq">
          <div class="trazos-caja"><div id="hw" class="hw" aria-label="Animación de trazos de ${esc(c)}"></div></div>
          <div class="botones-trazo">
            <button class="btn sec" data-accion="animar">▶ Ver trazos</button>
            ${hablar(c)}
          </div>
          <dl class="meta">
            <div><dt>Trazos</dt><dd>${ch.trazos}</dd></div>
            <div><dt>Radical</dt><dd class="hz">${esc(ch.radical)}</dd></div>
            <div><dt>Nivel</dt><dd><a href="#/nivel/${ch.nivel}">${ch.nivel} · ${esc(nivel.nombre)}</a></dd></div>
            ${ch.hsk ? `<div><dt>HSK</dt><dd>${ch.hsk}</dd></div>` : ''}
            ${ch.leccionLibro ? `<div><dt>Libro</dt><dd><a href="#/libro/${ch.leccionLibro}">Lección ${ch.leccionLibro}</a></dd></div>` : ''}
          </dl>
        </div>
        <div class="ficha-der">
          <div class="cabecera-char">
            <span class="hz enorme">${esc(c)}</span>
            <div>
              <div class="py grande ${tonoClase(ch.tono)}">${esc(ch.pinyin)}</div>
              <div class="tono-etq">${ch.tono === 5 ? 'tono neutro' : ch.tono + '.º tono'}</div>
              <div class="significado">${esc(ch.significado)}</div>
            </div>
          </div>
          <p class="tipo"><span class="etq tipo-${ch.tipo}">${tipo[0]}</span> <small>${tipo[1]}</small></p>
          <p class="descripcion">${esc(ch.descripcion)}</p>
          ${comps.length ? `
          <h4>Composición</h4>
          <div class="composicion">
            ${comps.map((k, i) => `${i ? '<span class="mas">+</span>' : ''}
              <a class="comp ${k.rol === 's' ? 'sem' : k.rol === 'f' ? 'fon' : ''}" href="#/componentes/${encodeURIComponent(k.c)}">
                <span class="hz">${esc(k.c)}</span><small>${esc(k.nombre)}</small>
                ${k.rol === 's' ? '<em>significado</em>' : k.rol === 'f' ? '<em>sonido</em>' : ''}
              </a>`).join('')}
            <span class="mas">=</span><span class="comp resultado"><span class="hz">${esc(c)}</span><small>${esc(ch.significado.split(/[;,]/)[0])}</small></span>
          </div>
          ${ESTRUCTURAS[ch.descomposicion?.[0]] ? `<p class="nota">Estructura: ${ESTRUCTURAS[ch.descomposicion[0]]}</p>` : ''}` : ''}
          ${ch.ejemplos.length ? `
          <h4>Palabras</h4>
          <ul class="ejemplos">
            ${ch.ejemplos.map(e => `<li>${hablar(e.palabra)}<span class="hz">${esc(e.palabra)}</span> <span class="py">${esc(e.pinyin)}</span> <span class="sig">${esc(e.significado)}</span></li>`).join('')}
          </ul>` : ''}
          ${contienen.length ? `<h4>Aparece dentro de</h4><div class="chips">${contienen.map(chip).join('')}</div>` : ''}
          ${contexto || ''}
        </div>
      </article>`;
  }

  let writer = null;
  function montarWriter(c, opciones = {}) {
    const el = document.getElementById('hw');
    if (!el) return null;
    if (!window.HanziWriter) {
      el.innerHTML = `<div class="sin-red hz">${esc(c)}<small>Sin conexión: la animación de trazos necesita internet.</small></div>`;
      return null;
    }
    const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
    el.innerHTML = '';
    writer = HanziWriter.create(el, c, Object.assign({
      width: el.clientWidth || 240, height: el.clientWidth || 240, padding: 12,
      showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 250,
      strokeColor: oscuro ? '#f3ede2' : '#2b2622', outlineColor: oscuro ? '#4a4038' : '#e8dfd2',
      radicalColor: '#c8372d', highlightColor: '#1f8a70', drawingColor: oscuro ? '#f3ede2' : '#2b2622',
      // Trazos incluidos en la app (js/data/trazos.js); si faltan, Hanzi Writer los pide a internet
      charDataLoader: (ch, ok, fallo) => window.TRAZOS && window.TRAZOS[ch]
        ? ok(window.TRAZOS[ch])
        : fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(ch)}.json`).then(r => r.json()).then(ok, fallo),
      onLoadCharDataError: () => { el.innerHTML = `<div class="sin-red hz">${esc(c)}<small>No se pudieron cargar los trazos (¿sin conexión?).</small></div>`; },
    }, opciones));
    return writer;
  }

  function verCaracter(c) {
    const ch = D.caracteres[c];
    const nivel = ch ? D.niveles[ch.nivel - 1] : null;
    $app().innerHTML = `<nav class="migas"><a href="javascript:history.back()">← Volver</a>${nivel ? ` · <a href="#/nivel/${ch.nivel}">Nivel ${ch.nivel}</a>` : ''}</nav>` + ficha(c);
    if (ch) { montarWriter(c); setTimeout(() => writer && writer.animateCharacter(), 400); }
  }

  // ── Aprender: fichas una a una ──────────────────────────────────────
  function aprender(cj, i) {
    i = Math.max(0, Math.min(cj.chars.length - 1, +i || 0));
    const c = cj.chars[i];
    P.marcarVisto(c);
    const nav = `
      <div class="paginador">
        <a class="btn sec ${i === 0 ? 'off' : ''}" href="${cj.ruta}/aprender/${i - 1}">← Anterior</a>
        <span>${i + 1} / ${cj.chars.length}</span>
        ${i < cj.chars.length - 1
          ? `<a class="btn" href="${cj.ruta}/aprender/${i + 1}">Siguiente →</a>`
          : `<a class="btn" href="${cj.ruta}/practicar">¡A practicar! 🎯</a>`}
      </div>`;
    $app().innerHTML = `
      <nav class="migas"><a href="${cj.ruta}">← ${esc(cj.titulo)}</a></nav>
      <div class="progreso-fino"><span style="width:${(i + 1) / cj.chars.length * 100}%"></span></div>
      ${ficha(c)}
      ${nav}`;
    montarWriter(c);
    setTimeout(() => writer && writer.animateCharacter(), 500);
    teclas({
      ArrowLeft: () => i > 0 && (location.hash = `${cj.ruta}/aprender/${i - 1}`),
      ArrowRight: () => i < cj.chars.length - 1 && (location.hash = `${cj.ruta}/aprender/${i + 1}`),
      ' ': () => window.Voz.decir(c),
    });
  }

  // ── Escribir: práctica de trazos con Hanzi Writer ───────────────────
  function escribir(cj, i) {
    i = Math.max(0, Math.min(cj.chars.length - 1, +i || 0));
    const c = cj.chars[i];
    const ch = D.caracteres[c];
    $app().innerHTML = `
      <nav class="migas"><a href="${cj.ruta}">← ${esc(cj.titulo)}</a></nav>
      <div class="progreso-fino"><span style="width:${(i + 1) / cj.chars.length * 100}%"></span></div>
      <section class="escribir">
        <div class="enunciado">
          <div class="py grande ${tonoClase(ch.tono)}">${esc(ch.pinyin)} ${hablar(c)}</div>
          <div class="significado">${esc(ch.significado)}</div>
          <p class="nota">Dibuja los ${ch.trazos} trazos en orden con el ratón o el dedo. Tras 3 errores en un trazo te mostraremos una pista.</p>
        </div>
        <div class="trazos-caja grande"><div id="hw" class="hw cuadricula"></div></div>
        <div id="resultado-escritura" class="nota" aria-live="polite"></div>
        <div class="botones-trazo">
          <button class="btn sec" data-accion="animar">👁 Ver cómo se escribe</button>
          <button class="btn sec" data-accion="contorno">Mostrar/ocultar guía</button>
          <button class="btn sec" data-accion="reiniciar">↺ Otra vez</button>
        </div>
        <div class="paginador">
          <a class="btn sec ${i === 0 ? 'off' : ''}" href="${cj.ruta}/escribir/${i - 1}">← Anterior</a>
          <span>${i + 1} / ${cj.chars.length}</span>
          ${i < cj.chars.length - 1 ? `<a class="btn" href="${cj.ruta}/escribir/${i + 1}">Siguiente →</a>` : `<a class="btn" href="${cj.ruta}">Terminar ✓</a>`}
        </div>
      </section>`;
    let guia = true;
    const iniciarQuiz = () => {
      const w = montarWriter(c, { showOutline: guia, showCharacter: false, width: 300, height: 300 });
      if (!w) return;
      const out = document.getElementById('resultado-escritura');
      out.textContent = '';
      w.quiz({
        showHintAfterMisses: 3,
        onComplete: s => {
          const bien = s.totalMistakes <= Math.max(1, Math.floor(ch.trazos / 4));
          P.responder(c, bien);
          out.innerHTML = bien
            ? `✅ ¡Muy bien! ${s.totalMistakes ? s.totalMistakes + ' error(es).' : 'Sin errores.'}`
            : `✍️ Terminado con ${s.totalMistakes} errores. Repítelo para afianzarlo.`;
          window.Voz.decir(c);
        },
      });
    };
    iniciarQuiz();
    $app().querySelector('[data-accion="contorno"]').onclick = () => { guia = !guia; iniciarQuiz(); };
    $app().querySelector('[data-accion="reiniciar"]').onclick = iniciarQuiz;
    $app().querySelector('[data-accion="animar"]').onclick = () => {
      const w = montarWriter(c, { width: 300, height: 300 });
      w && w.animateCharacter({ onComplete: () => setTimeout(iniciarQuiz, 900) });
    };
  }

  // ── Guía de pinyin ──────────────────────────────────────────────────
  function contornoSVG(t) {
    const Y = v => 50 - (v - 1) * 10; // escala 1..5 → y
    const caminos = { 1: [[10, 5], [90, 5]], 2: [[10, 3], [90, 5]], 3: [[10, 2], [45, 1], [90, 4]], 4: [[10, 5], [90, 1]], 5: [[45, 3], [55, 3]] };
    const pts = caminos[t].map(([x, v]) => `${x},${Y(v)}`).join(' ');
    return `<svg viewBox="0 0 100 60" class="contorno ${tonoClase(t)}" aria-hidden="true">
      ${[1, 2, 3, 4, 5].map(v => `<line x1="0" x2="100" y1="${Y(v)}" y2="${Y(v)}" class="guia"/>`).join('')}
      <polyline points="${pts}" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function pinyin() {
    const G = window.PINYIN;
    $app().innerHTML = `
      <section class="portada"><h1>Pinyin <span class="hz">拼音</span></h1>
        <p>El pinyin es la escritura del chino con letras latinas. Cada sílaba tiene una <b>inicial</b> (consonante), una <b>final</b> (vocales, a veces con n/ng) y un <b>tono</b>. Pulsa cualquier ejemplo para escucharlo.</p>
        <a class="btn" href="#/pinyin/practicar">🎵 Practicar tonos</a>
      </section>
      <h2>Los 4 tonos (+ el neutro)</h2>
      <p class="nota">El tono cambia el significado: mā (mamá), má (cáñamo), mǎ (caballo), mà (regañar). Los colores de los tonos se mantienen en toda la app.</p>
      <div class="tonos">
        ${G.tonos.map(t => `
          <div class="tono-card ${tonoClase(t.n)}">
            ${contornoSVG(t.n)}
            <h3>${t.nombre} <span class="marca">${t.marca}</span></h3>
            <p class="forma">${t.forma}</p>
            <p>${esc(t.consejo)}</p>
            <button class="ej" data-decir="${esc(t.ejemplo.c)}"><span class="hz">${t.ejemplo.c}</span> ${t.ejemplo.p} · ${esc(t.ejemplo.es)} 🔊</button>
          </div>`).join('')}
      </div>
      <h2>Iniciales <small>声母</small></h2>
      ${G.iniciales.map(g => `
        <h3 class="grupo">${esc(g.grupo)}</h3>
        <div class="sonidos">${g.items.map(x => `
          <button class="sonido" data-decir="${esc(x.ej.split(' ')[0])}">
            <b>${x.i}</b><span>${esc(x.nota)}</span><em class="hz">${esc(x.ej)} 🔊</em></button>`).join('')}</div>`).join('')}
      <h2>Finales <small>韵母</small></h2>
      ${G.finales.map(g => `
        <h3 class="grupo">${esc(g.grupo)}</h3>
        <div class="sonidos">${g.items.map(x => `
          <button class="sonido" data-decir="${esc(x.ej.split(' ')[0])}">
            <b>${x.f}</b><span>${esc(x.nota)}</span><em class="hz">${esc(x.ej)} 🔊</em></button>`).join('')}</div>`).join('')}
      <h2>Reglas importantes</h2>
      <div class="reglas">${G.reglas.map(r => `<div class="regla"><h4>${esc(r.titulo)}</h4><p>${esc(r.texto)}</p></div>`).join('')}</div>
      <h2>Trazos básicos <small>笔画</small></h2>
      <div class="trazos-basicos">${G.trazos.map(t => `
        <div class="trazo"><span class="hz grande">${t.c}</span><b>${t.nombre}</b><small>${esc(t.es)}</small><span class="hz">${t.ej}</span></div>`).join('')}</div>
      <h2>Orden de los trazos <small>笔顺</small></h2>
      <ol class="orden">${G.ordenTrazos.map(o => `<li>${esc(o.regla)} <span class="hz">${o.ej}</span></li>`).join('')}</ol>`;
  }

  // ── Componentes (familias) ──────────────────────────────────────────
  function componentes(sel) {
    $app().innerHTML = `
      <section class="portada"><h1>Componentes <span class="hz">部件</span></h1>
        <p>Casi todos los caracteres se construyen con piezas que se repiten. Si reconoces los componentes, aprender un carácter nuevo es como leer una pequeña historia. Pulsa un componente para ver su familia.</p></section>
      <div class="familias">
        ${D.componentes.map(f => `
          <a class="familia ${f.c === sel ? 'activa' : ''}" href="#/componentes/${encodeURIComponent(f.c)}" id="f-${f.c.codePointAt(0)}">
            <span class="hz grande">${esc(f.c)}</span><small>${esc(f.nombre)}</small><em>${f.caracteres.length}</em>
          </a>`).join('')}
      </div>
      <div id="familia-detalle"></div>`;
    if (sel) {
      const f = D.componentes.find(x => x.c === sel);
      const det = document.getElementById('familia-detalle');
      if (f) {
        const propio = D.caracteres[sel];
        det.innerHTML = `
          <section class="detalle-familia">
            <h2><span class="hz">${esc(sel)}</span> ${esc(f.nombre)} ${propio ? `· <a href="#/caracter/${encodeURIComponent(sel)}">ver ficha</a>` : ''}</h2>
            ${propio ? `<p>${esc(propio.descripcion)}</p>` : ''}
            <div class="rejilla">${f.caracteres.map(c => {
              const ch = D.caracteres[c];
              return `<a class="celda dom${P.dominio(c)}" href="#/caracter/${encodeURIComponent(c)}"><span class="hz grande">${esc(c)}</span><span class="py ${tonoClase(ch.tono)}">${esc(ch.pinyin)}</span><span class="sig">${esc(ch.significado)}</span></a>`;
            }).join('')}</div>
          </section>`;
        det.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (D.caracteres[sel]) {
        location.hash = '#/caracter/' + encodeURIComponent(sel);
      }
    }
  }

  // ── Libro «Chino paso a paso 1» ─────────────────────────────────────
  function libro() {
    $app().innerHTML = `
      <section class="portada"><h1>Chino paso a paso 1 <span class="hz">汉语一步一步</span></h1>
        <p>Los caracteres que se practican en cada lección del libro de ejercicios, para estudiar al mismo ritmo que el curso. Los niveles del juego mezclan estas lecciones según la dificultad de cada carácter; aquí los tienes en el orden del libro.</p></section>
      <div class="lecciones">
        ${D.libro.map(l => {
          const vistos = [...l.caracteres].filter(c => P.char(c)?.visto).length;
          return `
          <a class="leccion" href="#/libro/${l.leccion}">
            <div class="nivel-num">${l.leccion}</div>
            <div><h3><span class="hz">${esc(l.titulo)}</span></h3><p>${esc(l.tituloEs)}</p>
            <div class="muestra hz">${[...l.caracteres].slice(0, 12).join(' ')}${l.caracteres.length > 12 ? ' …' : ''}</div></div>
            <div class="nivel-estado"><small>${vistos}/${[...l.caracteres].length}</small></div>
          </a>`;
        }).join('')}
      </div>`;
  }

  // ── Repaso ──────────────────────────────────────────────────────────
  function repaso() {
    const pend = P.pendientes();
    const deb = P.debiles(20);
    $app().innerHTML = `
      <section class="portada"><h1>Repaso <span class="hz">复习</span></h1>
        <p>La repetición espaciada te pregunta cada carácter justo antes de que lo olvides: si aciertas, vuelve en 1, 2, 4, 8 y 16 días; si fallas, vuelve hoy.</p></section>
      ${pend.length ? `
        <div class="caja-repaso"><b>${pend.length}</b> caracteres pendientes hoy
          <div class="chips">${pend.slice(0, 40).map(chip).join('')}</div>
          <a class="btn" href="#/repaso/empezar">Empezar repaso</a></div>`
      : deb.length ? `
        <div class="caja-repaso">🎉 ¡Nada pendiente por hoy! ¿Quieres reforzar tus caracteres más débiles?
          <div class="chips">${deb.map(chip).join('')}</div>
          <a class="btn" href="#/repaso/empezar">Repasar los más débiles</a></div>`
      : `<div class="caja-repaso">Aún no has estudiado ningún carácter. Empieza por el <a href="#/nivel/1">nivel 1</a>.</div>`}`;
  }

  // ── Utilidades compartidas ──────────────────────────────────────────
  let manejadorTeclas = null;
  function teclas(mapa) {
    if (manejadorTeclas) document.removeEventListener('keydown', manejadorTeclas);
    manejadorTeclas = mapa ? e => {
      if (e.target.matches('input, textarea')) return;
      const f = mapa[e.key];
      if (f) { e.preventDefault(); f(e); }
    } : null;
    if (manejadorTeclas) document.addEventListener('keydown', manejadorTeclas);
  }

  let tt;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3000);
  }

  // Delegación global: botones de audio y animación
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-decir]');
    if (d) { e.preventDefault(); window.Voz.decir(d.dataset.decir); return; }
    const a = e.target.closest('[data-accion="animar"]');
    if (a && writer && !a.closest('.escribir')) { writer.animateCharacter(); }
  });

  window.Vistas = { inicio, portada, aprender, escribir, verCaracter, pinyin, componentes, libro, repaso, conjunto, teclas, toast, esc, tonoClase, sinTono, hablar, estrellas, chip, ficha };
})();
