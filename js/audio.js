// Pronunciación con la síntesis de voz del navegador (voz de chino mandarín si está instalada).
(function () {
  let voz = null;

  function elegirVoz() {
    if (!('speechSynthesis' in window)) return;
    const voces = speechSynthesis.getVoices();
    const zh = voces.filter(v => /^zh[-_](CN|Hans)/i.test(v.lang) || /Chinese.*Mandarin|普通话|Xiaoxiao|Yunxi|Huihui|Kangkang|Yaoyao/i.test(v.name));
    // Preferir voces neuronales/online, que suenan más naturales
    voz = zh.find(v => /Natural|Online|Xiaoxiao|Google/i.test(v.name)) || zh[0] || null;
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

  window.Voz = {
    disponible() { return 'speechSynthesis' in window && !!voz; },

    decir(texto, velocidad) {
      if (!('speechSynthesis' in window)) return;
      if (!voz) {
        // Sin voz china el sistema leería el texto con una voz en inglés (o nada): mejor avisar
        window.Vistas && window.Vistas.toast('No hay una voz en chino instalada. Mira Ajustes en la pantalla de inicio.');
        return;
      }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'zh-CN';
      if (voz) u.voice = voz;
      u.rate = velocidad || window.Progreso.ajustes().velocidadVoz || 0.8;
      speechSynthesis.speak(u);
    },
  };
})();
