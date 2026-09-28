// Progreso del alumno guardado en el navegador (localStorage).
// Repetición espaciada tipo Leitner: cada carácter está en una "caja" 0–5;
// acertar lo sube de caja (se repasa más tarde), fallar lo devuelve a la caja 0.
(function () {
  const CLAVE = 'hanzi-paso-a-paso-v1';
  const DIA = 24 * 60 * 60 * 1000;
  const INTERVALOS = [0, 1, 2, 4, 8, 16]; // días hasta el próximo repaso según la caja
  const ESTRELLAS = [0.7, 0.85, 1]; // % de aciertos para 1, 2 y 3 estrellas

  function vacio() {
    return { chars: {}, niveles: {}, ajustes: { desbloquearTodo: false, velocidadVoz: 0.8 }, racha: { dias: 0, ultimo: null } };
  }

  let estado = vacio();
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) estado = Object.assign(vacio(), JSON.parse(guardado));
  } catch (e) { /* almacenamiento no disponible: el progreso durará solo esta sesión */ }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* ignorar */ }
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

  function actualizarRacha() {
    const h = hoy();
    if (estado.racha.ultimo === h) return;
    const ayer = new Date(Date.now() - DIA).toISOString().slice(0, 10);
    estado.racha.dias = estado.racha.ultimo === ayer ? estado.racha.dias + 1 : 1;
    estado.racha.ultimo = h;
  }

  function registro(c) {
    return estado.chars[c] || (estado.chars[c] = { caja: 0, aciertos: 0, fallos: 0, visto: false, proximo: 0 });
  }

  window.Progreso = {
    ESTRELLAS,

    marcarVisto(c) {
      const r = registro(c);
      if (!r.visto) { r.visto = true; r.proximo = Date.now(); guardar(); }
    },

    responder(c, correcto) {
      const r = registro(c);
      r.visto = true;
      if (correcto) { r.aciertos++; r.caja = Math.min(5, r.caja + 1); }
      else { r.fallos++; r.caja = 0; }
      r.proximo = Date.now() + INTERVALOS[r.caja] * DIA;
      actualizarRacha();
      guardar();
    },

    char(c) { return estado.chars[c] || null; },

    // 0 = nuevo, 1–5 = dominio creciente
    dominio(c) { const r = estado.chars[c]; return r ? (r.visto ? Math.max(r.caja, 0) : 0) : 0; },

    pendientes() {
      const ahora = Date.now();
      return Object.entries(estado.chars)
        .filter(([c, r]) => r.visto && r.proximo <= ahora && window.DATOS.caracteres[c])
        .sort((a, b) => a[1].caja - b[1].caja || a[1].proximo - b[1].proximo)
        .map(([c]) => c);
    },

    debiles(n) {
      return Object.entries(estado.chars)
        .filter(([c, r]) => r.visto && window.DATOS.caracteres[c])
        .sort((a, b) => (a[1].caja - b[1].caja) || (b[1].fallos - a[1].fallos))
        .slice(0, n).map(([c]) => c);
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
      const regs = Object.values(estado.chars).filter(r => r.visto);
      return {
        vistos: regs.length,
        dominados: regs.filter(r => r.caja >= 4).length,
        aciertos: regs.reduce((s, r) => s + r.aciertos, 0),
        fallos: regs.reduce((s, r) => s + r.fallos, 0),
      };
    },

    exportar() { return JSON.stringify(estado); },
    importar(txt) { estado = Object.assign(vacio(), JSON.parse(txt)); guardar(); },
    reiniciar() { estado = vacio(); guardar(); },
  };
})();
