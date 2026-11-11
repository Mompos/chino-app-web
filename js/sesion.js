// "Sesión de hoy": el plan diario de estudio.
//   1. Fichas de los elementos nuevos (caracteres, palabras y una frase).
//   2. Preguntas: repasos pendientes + lo nuevo + dos pares de tonos.
//   3. Al terminar queda cerrada hasta la medianoche (reloj con cuenta atrás): el repaso diario no se repite.
//      Después solo se puede hacer práctica extra, que no altera la repetición espaciada.
(function () {
  const D = window.DATOS;
  const P = window.Progreso;
  const V = window.Vistas;
  const I = window.Items;
  const esc = V.esc;
  const $app = () => document.getElementById('app');
  const MAX_REPASOS = 20;

  const barajar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Un elemento de texto se puede presentar cuando ya se conocen todos sus caracteres con ficha
  const listo = texto => { const cs = I.caracteresDe(texto); return cs.length > 0 && cs.every(c => P.visto(c)); };

  // Modo clase (Ajustes → leccionActual): lo nuevo sale primero de las lecciones del libro hasta la actual
  function elegirNuevos() {
    const cupo = P.ajustes().nuevosPorDia || 6;
    const L = P.ajustes().leccionActual || 0;
    const enCurso = l => !L || (l && l <= L);
    const palabras = I.palabrasRepaso.filter(id => !P.visto(id) && enCurso(I.get(id).leccion) && listo(I.get(id).texto))
      .sort((a, b) => I.get(a).leccion - I.get(b).leccion).slice(0, 2);
    // Frases de verdad (3 palabras o más): «你好！» ya se aprende como palabra
    const esFrase = f => f.tokens.filter(t => !/^[，。？！]+$/.test(t)).length >= 3;
    const frases = D.vocabulario.frases.filter(f => !P.visto(f.id) && esFrase(f) && enCurso(f.l) && listo(f.zh)).slice(0, 1).map(f => f.id);
    const cupoChars = cupo - palabras.length - frases.length;
    const chars = [];
    const tomar = c => { if (chars.length < cupoChars && !P.visto(c) && !chars.includes(c)) chars.push(c); };
    if (L) D.libro.slice(0, L).forEach(lec => [...lec.caracteres].forEach(tomar));
    for (const n of D.niveles) {
      if (!P.desbloqueado(n.nivel)) break;
      n.caracteres.forEach(tomar);
    }
    return [...chars, ...palabras, ...frases];
  }

  // ── Modo clase ──
  const ico = n => window.Iconos.svg(n);
  // Fila de acción de una lista (icono, título, detalle y flecha)
  const fila = (href, icono, titulo, detalle) => `
    <a class="fila-accion" href="${href}"><span class="fa-ico">${ico(icono)}</span>
      <span class="fa-txt"><b>${titulo}</b>${detalle ? `<small>${detalle}</small>` : ''}</span>${ico('flecha')}</a>`;

  function htmlClase() {
    const L = P.ajustes().leccionActual || 0;
    if (!L) return `
      <section class="tarjeta">
        <h3 class="tarjeta-tit">${ico('libro')} Tu curso</h3>
        ${fila('#/libro', 'pin', '¿Vas a clase con <i>Chino paso a paso</i>?', 'Indica en qué lección vas y la app se adaptará a tu curso')}
      </section>`;
    const lec = D.libro[L - 1], sig = D.libro[L];
    return `
      <section class="tarjeta">
        <h3 class="tarjeta-tit">${ico('libro')} Tu curso <a class="tit-enlace" href="#/libro/${L}">Lección ${L} · <span class="hz">${esc(lec.titulo)}</span></a></h3>
        ${sig ? fila('#/clase/antes', 'ojo', 'Antes de clase', `Avance del vocabulario de la lección ${L + 1}`) : ''}
        ${fila('#/clase/despues', 'repetir', 'Después de clase', `Repaso de la lección ${L}`)}
      </section>`;
  }

  // Antes de clase: fichas del vocabulario de la lección siguiente (solo verlas: no cuentan para el repaso)
  function antesDeClase(k = 0) {
    const L = (P.ajustes().leccionActual || 0) + 1;
    const palabras = I.palabrasDe(L);
    if (!palabras.length) { location.hash = '#/hoy'; return; }
    if (k >= palabras.length) {
      $app().innerHTML = `
        <section class="final">
          <h1>¡Listo para la clase! 准备好了!</h1>
          <p>Has visto las ${palabras.length} palabras nuevas de la lección ${L}. En clase te sonarán: así se aprenden mejor.</p>
          <div class="fila botones centrada"><a class="btn" href="#/libro/${L}">Ver la lección ${L}</a><a class="btn sec" href="#/hoy">Volver a Hoy</a></div>
        </section>`;
      return;
    }
    const p = palabras[k];
    $app().innerHTML = `
      <nav class="migas"><a href="#/hoy">← Hoy</a><span class="marcador">Avance de la lección ${L} · ${k + 1}/${palabras.length}</span></nav>
      <div class="progreso-fino"><span style="width:${(k + 1) / palabras.length * 100}%"></span></div>
      <article class="ficha ficha-texto">
        <div class="cabecera-char col">
          <span class="hz palabra-grande">${esc(p.w)}</span>
          <div class="py grande">${esc(p.py)}</div>
          <div class="significado">${esc(p.es)}</div>
          <div class="fila centrada">${V.hablar(p.w)} ${window.Pronunciar ? window.Pronunciar.boton(p.w, p.py) : ''}</div>
        </div>
      </article>
      <div class="paginador"><button class="btn sec" id="atras" ${k ? '' : 'disabled'}>← Anterior</button>
        <button class="btn" id="seguir">Siguiente →</button></div>`;
    setTimeout(() => window.Voz.decir(p.w), 300);
    document.getElementById('seguir').onclick = () => antesDeClase(k + 1);
    document.getElementById('atras').onclick = () => k && antesDeClase(k - 1);
    V.teclas({ Enter: () => antesDeClase(k + 1), ArrowRight: () => antesDeClase(k + 1), ArrowLeft: () => k && antesDeClase(k - 1) });
  }

  // Después de clase: preguntas sobre caracteres, palabras y frases de la lección actual
  function despuesDeClase() {
    const L = P.ajustes().leccionActual || 0;
    if (!L) { location.hash = '#/libro'; return; }
    const ids = [...D.libro[L - 1].caracteres, ...I.palabrasDe(L).map(p => p.id).filter(id => I.palabrasRepaso.includes(id)), ...I.frasesDe(L).map(f => f.id)];
    window.Quiz.iniciar({ titulo: `Después de clase · Lección ${L}`, volver: '#/hoy', chars: ids, n: 20, modo: 'practica' });
  }

  function preparar() {
    const repasos = P.pendientes().slice(0, MAX_REPASOS);
    const nuevos = elegirNuevos();
    const pares = barajar(I.pares()).slice(0, 2).map(t => t.id);
    return { repasos, nuevos, pares };
  }

  function minutos(plan) {
    return Math.max(3, Math.round(plan.repasos.length * 0.3 + plan.nuevos.length * 1 + plan.pares.length * 0.3));
  }

  // ── Reloj ──
  let reloj = null;
  function detenerReloj() { clearInterval(reloj); reloj = null; }
  function formatear(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
  }
  function arrancarReloj() {
    detenerReloj();
    const tic = () => {
      const el = document.getElementById('reloj');
      if (!el) return detenerReloj();
      const ms = P.msHastaManana();
      el.textContent = formatear(ms);
      // Pasada la medianoche se abre la nueva sesión sin recargar
      if (!P.sesionHoy().completada) { detenerReloj(); pantalla(); window.App && window.App.actualizarBadge(); }
    };
    tic();
    reloj = setInterval(tic, 1000);
  }

  function htmlCompletada(s) {
    return `
      <section class="sesion-hoy hecha">
        <div class="sh-cab"><span class="sh-ico ok">${ico('check')}</span>
          <div><h2>Sesión completada</h2>${s.total ? `<p>${s.aciertos} de ${s.total} aciertos${s.nuevos ? ` · ${s.nuevos} nuevos` : ''}</p>` : ''}</div></div>
        <div class="reloj-caja"><span class="nota">${ico('reloj')} La próxima sesión se abre en</span>
          <div class="reloj" id="reloj" role="timer" aria-label="Tiempo hasta la próxima sesión">--:--:--</div></div>
      </section>
      <section class="tarjeta">
        <h3 class="tarjeta-tit">${ico('diana')} Si te quedan ganas</h3>
        ${fila('#/hoy/extra', 'diana', 'Práctica extra', 'Tus elementos más débiles; no cambia el repaso programado')}
        ${fila('#/tonos', 'tonos', 'Pares de tonos', 'Escucha, reconoce y pronuncia')}
        ${fila('#/tutor', 'chat', 'Conversar con el tutor', 'Practica una situación de tu lección')}
      </section>`;
  }

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function pantalla() {
    detenerReloj();
    const s = P.sesionHoy();
    const racha = P.racha();
    const st = P.estadisticas();
    const hoy = new Date();
    const plural = (n, uno, varios) => `<b>${n}</b> ${n === 1 ? uno : varios}`;
    const cabecera = `
      <header class="cab-hoy">
        <p class="fecha">${DIAS[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]}</p>
        <h1>Hoy <span class="hz">今天</span></h1>
        <div class="pastillas">
          <span class="pastilla racha">${ico('llama')} ${plural(racha.dias || 0, 'día', 'días')}</span>
          <span class="pastilla">${plural(st.vistos, 'carácter', 'caracteres')}</span>
          <span class="pastilla">${plural(st.palabras, 'palabra', 'palabras')}</span>
          <span class="pastilla">${plural(st.frases, 'frase', 'frases')}</span>
        </div>
      </header>`;
    if (s.completada) {
      $app().innerHTML = cabecera + htmlCompletada(s) + htmlClase();
      arrancarReloj();
      return;
    }
    const plan = preparar();
    const vacia = !plan.repasos.length && !plan.nuevos.length;
    const chip = id => { const it = I.get(id); return `<span class="chip ${it.tipo === 'frase' ? 'chip-frase' : 'chip-texto'}" title="${esc(it.pinyin + ' · ' + it.significado)}">${esc(it.texto)}</span>`; };
    $app().innerHTML = cabecera + `
      <section class="sesion-hoy">
        <div class="sh-cab"><span class="sh-ico">${ico('sol')}</span>
          <div><h2>Sesión de hoy</h2><p>Unos ${minutos(plan)} minutos · una vez al día</p></div></div>
        ${vacia ? `<p>No hay repasos pendientes ni elementos nuevos: hoy toca una sesión corta de pares de tonos. Para tener contenido nuevo, consigue estrellas en los niveles.</p>` : `
        <div class="plan-hoy">
          ${plan.repasos.length ? `<div><b>${plan.repasos.length}</b><span>repasos</span></div>` : ''}
          ${plan.nuevos.length ? `<div><b>${plan.nuevos.length}</b><span>nuevos</span></div>` : ''}
          <div><b>${plan.pares.length}</b><span>pares de tonos</span></div>
        </div>
        ${plan.nuevos.length ? `<p class="sh-sub">Hoy aprenderás</p><div class="chips">${plan.nuevos.map(chip).join('')}</div>` : ''}`}
        <a class="btn btn-bloque" href="#/hoy/empezar">Empezar ${ico('flecha')}</a>
      </section>` + htmlClase();
  }

  // ── Desarrollo de la sesión ──
  function empezar() {
    if (P.sesionHoy().completada) { V.toast('Ya completaste la sesión de hoy. ¡Vuelve mañana!'); location.hash = '#/hoy'; return; }
    const plan = preparar();
    if (!plan.nuevos.length) return preguntas(plan);
    tarjeta(plan, 0);
  }

  // Ficha breve de un elemento nuevo
  function tarjeta(plan, k) {
    const id = plan.nuevos[k];
    const it = I.get(id);
    P.marcarVisto(id);
    const siguiente = k + 1 < plan.nuevos.length;
    const cuerpo = it.tipo === 'caracter' ? V.ficha(id) : `
      <article class="ficha ficha-texto">
        <div class="cabecera-char col">
          <span class="hz ${it.tipo === 'frase' ? 'frase-grande' : 'palabra-grande'}">${esc(it.texto)}</span>
          <div class="py grande">${esc(it.pinyin)}</div>
          <div class="significado">${esc(it.significado)}</div>
          <div class="fila centrada">${V.hablar(it.texto)} ${window.Pronunciar ? window.Pronunciar.boton(it.texto, it.pinyin) : ''}</div>
        </div>
        <h4>Caracteres</h4>
        <div class="desglose">${I.caracteresDe(it.texto).map(c => {
          const ch = D.caracteres[c];
          return `<a class="celda dom${P.dominio(c)}" href="#/caracter/${encodeURIComponent(c)}" target="_blank"><span class="hz grande">${esc(c)}</span><span class="py ${V.tonoClase(ch.tono)}">${esc(ch.pinyin)}</span><span class="sig">${esc(ch.significado)}</span></a>`;
        }).join('')}</div>
        ${it.leccion ? `<p class="nota">Lección ${it.leccion} del libro.</p>` : ''}
      </article>`;
    $app().innerHTML = `
      <nav class="migas"><a href="#/hoy">← Hoy</a><span class="marcador">Nuevo ${k + 1} de ${plan.nuevos.length}</span></nav>
      <div class="progreso-fino"><span style="width:${(k + 1) / (plan.nuevos.length + 1) * 100}%"></span></div>
      ${cuerpo}
      <div class="paginador"><span></span>
        <button class="btn" id="seguir">${siguiente ? 'Siguiente →' : 'A las preguntas ▶'}</button></div>`;
    if (it.tipo === 'caracter') V.montarTrazos(id);
    setTimeout(() => window.Voz.decir(it.texto), 400);
    const avanzar = () => siguiente ? tarjeta(plan, k + 1) : preguntas(plan);
    document.getElementById('seguir').onclick = avanzar;
    V.teclas({ Enter: avanzar, ArrowRight: avanzar });
    window.scrollTo(0, 0);
  }

  function preguntas(plan) {
    const ids = [...plan.repasos, ...plan.nuevos];
    const lista = barajar(ids.map(id => window.Quiz.pregunta(id, ids)));
    for (const t of plan.pares) lista.splice(Math.random() * (lista.length + 1) | 0, 0, window.Quiz.pregunta(t, ids));
    window.Quiz.iniciar({
      titulo: 'Sesión de hoy', volver: '#/hoy', modo: 'sesion', preguntas: lista,
      alTerminar: s => terminar(s, plan),
    });
  }

  function terminar(s, plan) {
    P.completarSesion({ aciertos: s.aciertos, total: s.i, nuevos: plan.nuevos.length });
    window.App && window.App.actualizarBadge();
    const fallados = [...new Set(s.fallos)];
    $app().innerHTML = `
      <section class="final">
        <h1>${s.i && s.aciertos / s.i >= 0.85 ? '¡Excelente! 太棒了!' : '¡Sesión completada! 加油!'}</h1>
        <div class="puntuacion"><b>${s.aciertos}</b> / ${s.i}</div>
        ${fallados.length ? `<p>Estos volverán a salir en tu próxima sesión:</p><div class="chips">${fallados.map(V.chipItem).join('')}</div>` : ''}
      </section>` + htmlCompletada(P.sesionHoy());
    arrancarReloj();
  }

  // Práctica extra tras la sesión: los más débiles, sin tocar la repetición espaciada
  function extra() {
    const ids = P.debiles(20);
    if (!ids.length) { V.toast('Aún no hay nada que practicar: haz primero la sesión de hoy.'); location.hash = '#/hoy'; return; }
    window.Quiz.iniciar({ titulo: 'Práctica extra', volver: '#/hoy', chars: ids, n: Infinity, modo: 'practica', sinSRS: true });
  }

  // Número para la insignia de la pestaña «Hoy»: repasos pendientes, o ✓ si la sesión está hecha
  function insignia() {
    if (P.sesionHoy().completada) return '✓';
    const n = P.pendientes().length;
    return n ? String(Math.min(n, 99)) : '';
  }

  window.Sesion = { pantalla, empezar, extra, insignia, detenerReloj, formatear, antesDeClase, despuesDeClase };
})();
