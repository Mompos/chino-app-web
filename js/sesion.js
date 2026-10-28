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

  function elegirNuevos() {
    const cupo = P.ajustes().nuevosPorDia || 6;
    const palabras = I.palabrasRepaso.filter(id => !P.visto(id) && listo(I.get(id).texto))
      .sort((a, b) => I.get(a).leccion - I.get(b).leccion).slice(0, 2);
    const frases = D.vocabulario.frases.filter(f => !P.visto(f.id) && listo(f.zh)).slice(0, 1).map(f => f.id);
    const chars = [];
    for (const n of D.niveles) {
      if (!P.desbloqueado(n.nivel)) break;
      for (const c of n.caracteres) {
        if (chars.length >= cupo - palabras.length - frases.length) break;
        if (!P.visto(c)) chars.push(c);
      }
    }
    return [...chars, ...palabras, ...frases];
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
      <section class="caja-hoy hecha">
        <div class="hoy-ico">✅</div>
        <h2>Sesión de hoy completada</h2>
        ${s.total ? `<p>${s.aciertos} de ${s.total} aciertos${s.nuevos ? ` · ${s.nuevos} elementos nuevos` : ''}</p>` : ''}
        <p class="nota">La próxima sesión se abre a medianoche:</p>
        <div class="reloj" id="reloj" role="timer" aria-label="Tiempo hasta la próxima sesión">--:--:--</div>
        <div class="fila botones centrada">
          <a class="btn sec" href="#/hoy/extra">🎯 Práctica extra</a>
          <a class="btn sec" href="#/tonos">🎵 Pares de tonos</a>
          <a class="btn sec" href="#/tutor">💬 Tutor</a>
        </div>
        <p class="nota">La práctica extra no cambia tu repaso programado: los repasos vuelven cuando les toca.</p>
      </section>`;
  }

  function pantalla() {
    detenerReloj();
    const s = P.sesionHoy();
    const racha = P.racha();
    const st = P.estadisticas();
    const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
    const cabecera = `
      <section class="portada"><h1>Hoy <span class="hz">今天</span></h1>
        <p>🔥 ${plural(racha.dias || 0, 'día', 'días')} de racha · ${plural(st.vistos, 'carácter', 'caracteres')} · ${plural(st.palabras, 'palabra', 'palabras')} · ${plural(st.frases, 'frase', 'frases')}</p></section>`;
    if (s.completada) {
      $app().innerHTML = cabecera + htmlCompletada(s);
      arrancarReloj();
      return;
    }
    const plan = preparar();
    const vacia = !plan.repasos.length && !plan.nuevos.length;
    $app().innerHTML = cabecera + `
      <section class="caja-hoy">
        <div class="hoy-ico">☀️</div>
        <h2>Sesión de hoy</h2>
        ${vacia ? `<p>No hay repasos pendientes ni elementos nuevos disponibles: hoy toca una sesión corta de pares de tonos. Para tener más contenido nuevo, consigue estrellas en los niveles.</p>` : `
        <ul class="plan-hoy">
          ${plan.repasos.length ? `<li><b>${plan.repasos.length}</b> repasos</li>` : ''}
          ${plan.nuevos.length ? `<li><b>${plan.nuevos.length}</b> nuevos</li>` : ''}
          <li><b>${plan.pares.length}</b> pares de tonos</li>
        </ul>
        ${plan.nuevos.length ? `<div class="chips centrada">${plan.nuevos.map(id => `<span class="chip chip-texto">${esc(I.get(id).texto)}</span>`).join('')}</div>` : ''}`}
        <p class="nota">Unos ${minutos(plan)} minutos. Solo se puede hacer una vez al día.</p>
        <a class="btn grande-btn" href="#/hoy/empezar">Empezar ▶</a>
      </section>`;
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

  window.Sesion = { pantalla, empezar, extra, insignia, detenerReloj, formatear };
})();
