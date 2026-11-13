/* =========================================================
   AMBIENCE  (underwater, synthesised - no audio files)
   A brown-noise bed with a slowly moving low-pass, plus a faint
   high shimmer. Generated rather than shipped so the exhibit
   stays offline and the folder stays small.

   Browsers refuse to start audio without a gesture, so this is
   only ever started from a real touch/click, and it stays muted
   if the visitor turns it off.
   ========================================================= */
(function () {
  var ctx = null, master = null, started = false, enabled = true, LEVEL = 0.15;

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    /* brown noise: integrated white noise, looped over 6s so it never repeats audibly */
    var len = Math.floor(ctx.sampleRate * 6);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 55;      /* drop rumble */

    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 430; lp.Q.value = 0.6;

    var swell = ctx.createOscillator();                 /* the water "moves" */
    swell.frequency.value = 0.048;
    var swellAmt = ctx.createGain();
    swellAmt.gain.value = 150;
    swell.connect(swellAmt); swellAmt.connect(lp.frequency);

    var sink = ctx.createGain();
    sink.gain.value = 0.5;
    swell.connect(sink.gain);                           /* level swells too */

    src.connect(hp); hp.connect(lp); lp.connect(sink); sink.connect(master);
    src.start(); swell.start();

    /* a very faint shimmer, high and thin, like light on the surface */
    var shim = ctx.createOscillator();
    shim.type = 'sine'; shim.frequency.value = 1740;
    var shimG = ctx.createGain(); shimG.gain.value = 0.004;
    var shimLfo = ctx.createOscillator(); shimLfo.frequency.value = 0.07;
    var shimLfoG = ctx.createGain(); shimLfoG.gain.value = 0.0035;
    shimLfo.connect(shimLfoG); shimLfoG.connect(shimG.gain);
    shim.connect(shimG); shimG.connect(master);
    shim.start(); shimLfo.start();

    return true;
  }

  function start() {
    if (!started) started = build();
    if (!started) return false;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(enabled ? LEVEL : 0, ctx.currentTime, 1.6);
      return true;
    } catch (e) { return false; }
  }

  function setEnabled(v) {
    enabled = !!v;
    try {
      if (!started) return enabled;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(enabled ? LEVEL : 0, ctx.currentTime, 0.5);
    } catch (e) {}
    return enabled;
  }

  /* pause when the screen is hidden or asleep */
  document.addEventListener('visibilitychange', function () {
    if (!started) return;
    try {
      master.gain.setTargetAtTime(
        (document.hidden || !enabled) ? 0 : LEVEL, ctx.currentTime, 0.4);
    } catch (e) {}
  });

  window.Ambience = {
    start: start,
    setEnabled: setEnabled,
    toggle: function () { return setEnabled(!enabled); },
    isOn: function () { return enabled; }
  };
})();