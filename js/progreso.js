// Progreso del alumno guardado en el navegador (localStorage).
// Repetición espaciada tipo Leitner: cada elemento (carácter, palabra o frase, ver js/items.js)
// está en una "caja" 0–5; acertar lo sube de caja (se repasa más tarde), fallar lo devuelve a la caja 0.
// La "sesión de hoy" se puede completar una sola vez por día (fecha local): así el repaso diario no se repite.
(function () {
  const CLAVE = 'hanzi-paso-a-paso-v1';
  const DIA = 24 * 60 * 60 * 1000;
  const INTERVALOS = [0, 1, 2, 4, 8, 16]; // días hasta el próximo repaso según la caja
  const ESTRELLAS = [0.7, 0.85, 1]; // % de aciertos para 1, 2 y 3 estrellas
  // (La clave de API del tutor NO va aquí: se guarda aparte para que nunca salga al exportar o sincronizar.)
  const AJUSTES = { desbloquearTodo: false, velocidadVoz: 0.8, vozActiva: true, volumen: 1, nuevosPorDia: 6 };

  function vacio() {
    return { chars: {}, niveles: {}, ajustes: { ...AJUSTES }, racha: { dias: 0, ultimo: null }, sesion: { fecha: null, completada: false } };
  }

  // Los progresos antiguos o importados pueden no tener los campos nuevos: se completan con los valores por defecto
  function normalizar(o) {
    const e = Object.assign(vacio(), o);
    e.ajustes = { ...AJUSTES, ...(o && o.ajustes) };
    e.sesion = { fecha: null, completada: false, ...(o && o.sesion) };
    return e;
  }

  let estado = vacio();
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) estado = normalizar(JSON.parse(guardado));
  } catch (e) { /* almacenamiento no disponible: el progreso durará solo esta sesión */ }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* ignorar */ }
  }

  // Fecha local AAAA-MM-DD (toISOString usaría UTC y el "día" cambiaría por la tarde en América)
  function fechaLocal(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function hoy() { return fechaLocal(); }

  function actualizarRacha() {
    const h = hoy();
    if (estado.racha.ultimo === h) return;
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    estado.racha.dias = estado.racha.ultimo === fechaLocal(ayer) ? estado.racha.dias + 1 : 1;
    estado.racha.ultimo = h;
  }

  function registro(id) {
    return estado.chars[id] || (estado.chars[id] = { caja: 0, aciertos: 0, fallos: 0, visto: false, proximo: 0 });
  }

  const existe = id => window.Items ? window.Items.existe(id) : !!window.DATOS.caracteres[id];

  window.Progreso = {
    ESTRELLAS,
    hoy,

    marcarVisto(id) {
      const r = registro(id);
      if (!r.visto) { r.visto = true; r.proximo = Date.now(); guardar(); }
    },

    responder(id, correcto) {
      const r = registro(id);
      r.visto = true;
      if (correcto) { r.aciertos++; r.caja = Math.min(5, r.caja + 1); }
      else { r.fallos++; r.caja = 0; }
      r.proximo = Date.now() + INTERVALOS[r.caja] * DIA;
      actualizarRacha();
      guardar();
    },

    char(id) { return estado.chars[id] || null; },
    visto(id) { const r = estado.chars[id]; return !!(r && r.visto); },

    // 0 = nuevo, 1–5 = dominio creciente
    dominio(id) { const r = estado.chars[id]; return r && r.visto ? r.caja : 0; },

    pendientes() {
      const ahora = Date.now();
      return Object.entries(estado.chars)
        .filter(([id, r]) => r.visto && r.proximo <= ahora && existe(id))
        .sort((a, b) => a[1].caja - b[1].caja || a[1].proximo - b[1].proximo)
        .map(([id]) => id);
    },

    debiles(n) {
      return Object.entries(estado.chars)
        .filter(([id, r]) => r.visto && existe(id))
        .sort((a, b) => (a[1].caja - b[1].caja) || (b[1].fallos - a[1].fallos))
        .slice(0, n).map(([id]) => id);
    },

    // ── Sesión de hoy ──
    sesionHoy() {
      const s = estado.sesion;
      return s.fecha === hoy() ? s : { fecha: hoy(), completada: false };
    },
    completarSesion(resumen) {
      estado.sesion = { fecha: hoy(), completada: true, ...resumen };
      actualizarRacha();
      guardar();
    },
    // Milisegundos hasta la medianoche local, cuando se abre la siguiente sesión
    msHastaManana() {
      const m = new Date(); m.setHours(24, 0, 0, 0);
      return m - Date.now();
    },

    nivel(n) { return estado.niveles[n] || { estrellas: 0, mejor: 0, intentos: 0 }; },

    terminarNivel(n, porcentaje) {
      const actual = this.nivel(n);
      const estrellas = ESTRELLAS.filter(u => porcentaje >= u).length;
      estado.niveles[n] = {
        estrellas: Math.max(actual.estrellas, estrellas),
        mejor: Math.max(actual.mejor, porcentaje),
        intentos: actual.intentos + 1,
      };
      guardar();
      return estrellas;
    },

    desbloqueado(n) {
      return n === 1 || estado.ajustes.desbloquearTodo || this.nivel(n - 1).estrellas > 0;
    },

    progresoNivel(n) {
      const chars = window.DATOS.niveles[n - 1].caracteres;
      const suma = chars.reduce((s, c) => s + this.dominio(c), 0);
      return suma / (chars.length * 5);
    },

    ajustes() { return estado.ajustes; },
    cambiarAjuste(k, v) { estado.ajustes[k] = v; guardar(); },
    racha() { return estado.racha; },

    estadisticas() {
      const regs = Object.entries(estado.chars).filter(([, r]) => r.visto);
      const D = window.DATOS;
      return {
        vistos: regs.filter(([id]) => D.caracteres[id]).length,
        palabras: regs.filter(([id]) => id.startsWith('p:')).length,
        frases: regs.filter(([id]) => id.startsWith('f:')).length,
        dominados: regs.filter(([, r]) => r.caja >= 4).length,
      };
    },

    // ── Copias y sincronización ──
    estado() { return estado; },
    exportar() { return JSON.stringify(estado); },
    importar(txt) { estado = normalizar(JSON.parse(txt)); guardar(); },
    // Fusiona otro progreso con el actual sin perder nada: de cada elemento se queda
    // el registro con más práctica; de cada nivel, el mejor resultado.
    fusionar(otro) {
      otro = normalizar(otro);
      let nuevos = 0, actualizados = 0;
      for (const [id, r] of Object.entries(otro.chars)) {
        const mio = estado.chars[id];
        const practica = x => x.aciertos + x.fallos + (x.visto ? 1 : 0);
        if (!mio) { estado.chars[id] = r; nuevos++; }
        else if (practica(r) > practica(mio)) { estado.chars[id] = r; actualizados++; }
      }
      for (const [n, nv] of Object.entries(otro.niveles)) {
        const mio = estado.niveles[n] || { estrellas: 0, mejor: 0, intentos: 0 };
        estado.niveles[n] = {
          estrellas: Math.max(mio.estrellas, nv.estrellas), mejor: Math.max(mio.mejor, nv.mejor),
          intentos: Math.max(mio.intentos, nv.intentos),
        };
      }
      if ((otro.racha.ultimo || '') > (estado.racha.ultimo || '')) estado.racha = otro.racha;
      if (otro.sesion.fecha === hoy() && otro.sesion.completada) estado.sesion = otro.sesion;
      if (otro.ajustes.desbloquearTodo) estado.ajustes.desbloquearTodo = true;
      guardar();
      return { nuevos, actualizados };
    },
    reiniciar() { estado = vacio(); guardar(); },
  };
})();
