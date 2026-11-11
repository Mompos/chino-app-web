// Enrutador por hash (#/...) — funciona abriendo index.html directamente, sin servidor.
(function () {
  const V = window.Vistas;
  const P = window.Progreso;
  const D = window.DATOS;
  const I = window.Items;

  function actualizarBadge() {
    const b = document.getElementById('badge-hoy');
    const t = window.Sesion.insignia();
    b.hidden = !t;
    b.textContent = t;
    b.classList.toggle('hecho', t === '✓');
  }

  function marcarNav(seccion) {
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('activo', a.dataset.nav === seccion));
  }

  function ruta() {
    const partes = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
    const [a, b, c, d] = partes;
    V.teclas(null);
    window.Sesion.detenerReloj();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const dlg = document.getElementById('dlg-pron');
    if (dlg && dlg.open) dlg.close();

    if (!a || a === 'hoy') {
      marcarNav('hoy');
      if (b === 'empezar') window.Sesion.empezar();
      else if (b === 'extra') window.Sesion.extra();
      else window.Sesion.pantalla();
    }
    else if (a === 'repaso') return (location.hash = '#/hoy'); // la antigua pantalla de repaso es ahora la sesión de hoy
    else if (a === 'clase') {
      marcarNav('hoy');
      if (b === 'antes') window.Sesion.antesDeClase();
      else if (b === 'despues') window.Sesion.despuesDeClase();
      else location.hash = '#/hoy';
    }
    else if (a === 'niveles') { marcarNav('niveles'); V.inicio(); }
    else if ((a === 'nivel' || a === 'libro') && b) {
      marcarNav(a === 'nivel' ? 'niveles' : 'libro');
      const cj = V.conjunto(a, b);
      if (!cj) return (location.hash = '#/niveles');
      if (a === 'nivel' && !P.desbloqueado(cj.id)) { V.toast('Ese nivel aún está bloqueado.'); return (location.hash = '#/niveles'); }
      if (!c) V.portada(cj);
      else if (c === 'aprender') V.aprender(cj, d);
      else if (c === 'escribir') V.escribir(cj, d);
      else if (c === 'practicar') window.Quiz.iniciar({ titulo: cj.titulo, volver: cj.ruta, chars: cj.chars, n: Infinity, modo: 'practica' });
      else if (c === 'desafio' && a === 'nivel') window.Quiz.iniciar({ titulo: cj.titulo, volver: cj.ruta, chars: cj.chars, n: 20, modo: 'desafio', nivel: cj.id });
      else if (c === 'palabras' && a === 'libro') {
        const ids = I.palabrasDe(cj.id).map(p => p.id).filter(id => I.palabrasRepaso.includes(id));
        window.Quiz.iniciar({ titulo: `${cj.titulo} · Palabras`, volver: cj.ruta, chars: ids, n: Infinity, modo: 'practica' });
      }
      else if (c === 'frases' && a === 'libro') {
        const ids = I.frasesDe(cj.id).map(f => f.id);
        window.Quiz.iniciar({ titulo: `${cj.titulo} · Frases`, volver: cj.ruta, chars: ids, n: Infinity, modo: 'practica' });
      }
      else V.portada(cj);
    }
    else if (a === 'libro') { marcarNav('libro'); V.libro(); }
    else if (a === 'caracter' && b) { marcarNav(''); V.verCaracter(b); }
    else if (a === 'pinyin') {
      marcarNav('mas');
      if (b === 'practicar') {
        // Tonos con los caracteres de los niveles desbloqueados
        const chars = D.niveles.filter(n => P.desbloqueado(n.nivel)).flatMap(n => n.caracteres);
        window.Quiz.iniciar({ titulo: 'Pinyin', volver: '#/pinyin', chars, n: Infinity, modo: 'tonos' });
      } else V.pinyin();
    }
    else if (a === 'tonos') {
      marcarNav('mas');
      if (b === 'practicar') window.Quiz.iniciar({ titulo: 'Pares de tonos', volver: '#/tonos', chars: I.pares().map(t => t.id), n: Infinity, modo: 'pares', sinSRS: true });
      else V.tonos();
    }
    else if (a === 'componentes') { marcarNav('mas'); V.componentes(b); }
    else if (a === 'tutor') { marcarNav('tutor'); window.Tutor.ruta(b); }
    else if (a === 'sincronizar') { marcarNav('mas'); window.Sincronizar.pantalla(b); }
    else if (a === 'mas') { marcarNav('mas'); V.mas(); }
    else location.hash = '#/hoy';

    actualizarBadge();
    if (!/aprender|escribir/.test(c || '')) window.scrollTo(0, 0);
  }

  window.App = { actualizarBadge };

  document.getElementById('btn-voz').onclick = () => window.Voz.alternar();
  window.Voz.pintarBoton();

  window.addEventListener('hashchange', ruta);
  ruta();

  // Uso sin conexión e instalación como app (solo cuando se sirve por https o localhost, no con file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin conexión permanente, la app sigue funcionando */ });
    // Pide al navegador que no borre el progreso guardado cuando falte espacio
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
})();
