// Pronunciación con la síntesis de voz del navegador (voz de chino mandarín si está instalada).
// Ajustes (js/progreso.js): vozActiva, volumen (0–1) y velocidadVoz.
// Ejercicios de escucha con "variar": cada pregunta usa una voz china distinta y una velocidad algo diferente.
// Oír muchas voces (entrenamiento de alta variabilidad) ayuda a reconocer los tonos en hablantes nuevos,
// sobre todo junto a la explicación explícita de los tonos (ver la guía de pinyin).
(function () {
  let voz = null;        // voz principal (la más natural disponible)
  let vocesZh = [];      // todas las voces de chino mandarín
  let ultima = null;     // voz y velocidad de la última locución "variada", para repetirla igual

  function elegirVoz() {
    if (!('speechSynthesis' in window)) return;
    const voces = speechSynthesis.getVoices();
    // Solo mandarín de China continental (no cantonés zh-HK ni Taiwán zh-TW, con otra pronunciación)
    vocesZh = voces.filter(v => /^zh[-_](CN|Hans)/i.test(v.lang) || (/^zh$/i.test(v.lang)) || /普通话|Xiaoxiao|Yunxi|Huihui|Kangkang|Yaoyao|Tingting/i.test(v.name));
    // Preferir voces neuronales/online, que suenan más naturales
    voz = vocesZh.find(v => /Natural|Online|Xiaoxiao|Google/i.test(v.name)) || vocesZh[0] || null;
  }

  if ('speechSynthesis' in window) {
    elegirVoz();
    speechSynthesis.onvoiceschanged = elegirVoz;
    // iOS solo permite hablar si la primera locución nace de un toque del usuario:
    // al primer toque decimos algo vacío para "desbloquear" el audio automático de las preguntas.
    const desbloquear = () => {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      elegirVoz();
    };
    document.addEventListener('touchend', desbloquear, { once: true, passive: true });
    document.addEventListener('click', desbloquear, { once: true });
  }

  const ajustes = () => window.Progreso.ajustes();

  function pintarBoton() {
    const b = document.getElementById('btn-voz');
    if (!b) return;
    const on = ajustes().vozActiva && ajustes().volumen > 0;
    b.textContent = on ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(!on));
    b.title = on ? 'Silenciar la voz' : 'Activar la voz';
  }

  window.Voz = {
    disponible() { return 'speechSynthesis' in window && !!voz; },
    activa() { return ajustes().vozActiva && ajustes().volumen > 0; },

    numeroVoces() { return vocesZh.length; },

    // opciones.variar: voz al azar entre las chinas y velocidad ±10 % (si está activado en Ajustes)
    decir(texto, velocidad, opciones = {}) {
      if (!('speechSynthesis' in window) || !this.activa()) return;
      if (!voz) {
        // Sin voz china el sistema leería el texto con una voz en inglés (o nada): mejor avisar
        window.Vistas && window.Vistas.toast('No hay una voz en chino instalada. Mira «Más → Ajustes».');
        return;
      }
      let v = voz, rate = velocidad || ajustes().velocidadVoz || 0.8;
      if (opciones.variar && ajustes().variarVoces && vocesZh.length > 1) {
        v = vocesZh[Math.random() * vocesZh.length | 0];
        rate *= 0.9 + Math.random() * 0.2;
        ultima = { texto, v, rate };
      } else if (opciones.repetir && ultima && ultima.texto === texto) {
        ({ v, rate } = ultima);
      }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'zh-CN';
      u.voice = v;
      u.rate = rate;
      u.volume = Math.max(0, Math.min(1, ajustes().volumen));
      speechSynthesis.speak(u);
    },

    // Botón 🔊/🔇 de la cabecera: silencia o reactiva la voz al instante
    alternar() {
      const a = ajustes();
      const activar = !(a.vozActiva && a.volumen > 0);
      window.Progreso.cambiarAjuste('vozActiva', activar);
      if (activar && a.volumen === 0) window.Progreso.cambiarAjuste('volumen', 1);
      if (!activar && 'speechSynthesis' in window) speechSynthesis.cancel();
      pintarBoton();
      window.Vistas && window.Vistas.toast(activar ? '🔊 Voz activada' : '🔇 Voz desactivada');
    },
    pintarBoton,
  };
})();
