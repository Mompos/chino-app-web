// Enrutador por hash (#/...) — funciona abriendo index.html directamente, sin servidor.
(function () {
  const V = window.Vistas;
  const P = window.Progreso;
  const D = window.DATOS;

  function actualizarBadge() {
    const b = document.getElementById('badge-repaso');
    const n = P.pendientes().length;
    b.hidden = !n;
    b.textContent = n;
  }

  function marcarNav(seccion) {
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('activo', a.dataset.nav === seccion));
  }

  function ruta() {
    const partes = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
    const [a, b, c, d] = partes;
    V.teclas(null);
    if ('speechSynthesis' in window) speechSynthesis.cancel();

    if (!a) { marcarNav('inicio'); V.inicio(); }
    else if ((a === 'nivel' || a === 'libro') && b) {
      marcarNav(a === 'nivel' ? 'inicio' : 'libro');
      const cj = V.conjunto(a, b);
      if (!cj) return (location.hash = '#/');
      if (a === 'nivel' && !P.desbloqueado(cj.id)) { V.toast('Ese nivel aún está bloqueado.'); return (location.hash = '#/'); }
      if (!c) V.portada(cj);
      else if (c === 'aprender') V.aprender(cj, d);
      else if (c === 'escribir') V.escribir(cj, d);
      else if (c === 'practicar') window.Quiz.iniciar({ titulo: cj.titulo, volver: cj.ruta, chars: cj.chars, n: Infinity, modo: 'practica' });
      else if (c === 'desafio' && a === 'nivel') window.Quiz.iniciar({ titulo: cj.titulo, volver: cj.ruta, chars: cj.chars, n: 20, modo: 'desafio', nivel: cj.id });
      else V.portada(cj);
    }
    else if (a === 'libro') { marcarNav('libro'); V.libro(); }
    else if (a === 'caracter' && b) { marcarNav(''); V.verCaracter(b); }
    else if (a === 'pinyin') {
      marcarNav('pinyin');
      if (b === 'practicar') {
        // Tonos con los caracteres de los niveles desbloqueados
        const chars = D.niveles.filter(n => P.desbloqueado(n.nivel)).flatMap(n => n.caracteres);
        window.Quiz.iniciar({ titulo: 'Pinyin', volver: '#/pinyin', chars, n: Infinity, modo: 'tonos' });
      } else V.pinyin();
    }
    else if (a === 'componentes') { marcarNav('componentes'); V.componentes(b); }
    else if (a === 'repaso') {
      marcarNav('repaso');
      if (b === 'empezar') {
        const pend = P.pendientes();
        const chars = pend.length ? pend : P.debiles(20);
        if (!chars.length) return (location.hash = '#/repaso');
        window.Quiz.iniciar({ titulo: 'Repaso', volver: '#/repaso', chars, n: Math.min(30, Math.max(10, chars.length)), modo: 'repaso' });
      } else V.repaso();
    }
    else location.hash = '#/';

    actualizarBadge();
    if (!/aprender|escribir/.test(c || '')) window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', ruta);
  ruta();

  // Uso sin conexión e instalación como app (solo cuando se sirve por https o localhost, no con file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin conexión permanente, la app sigue funcionando */ });
    // Pide al navegador que no borre el progreso guardado cuando falte espacio
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
})();
