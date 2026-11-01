(() => {
  "use strict";

  const WIDTH = 176;
  const HEIGHT = 220;
  const SCALE = 3;
  const PLATFORM_COUNT = 16;
  const SAVE_KEY = "jump-boy-web-save-v1";
  const LEVELS = [
    { background: "bk00.png", platforms: "plane.png" },
    { background: "bk01.png", platforms: "wash.png" },
    { background: "bk02.png", platforms: "dish.png" },
    { background: "bk03.png", platforms: "flower.png" },
    { background: "bk04.png", platforms: "fish.png" },
    { background: "bk06.png", platforms: "basin.png" },
    { background: "bk07.png", platforms: "plane.png" },
    { background: "bk09.png", platforms: "dish.png" },
    { background: "bk08.png", platforms: "wash.png" },
    { background: "bk05.png", platforms: "plane.png" }
  ];
  const ASSET_NAMES = [...new Set([
    "background.png", "title.png", "man.png", "heart.png",
    ...LEVELS.flatMap((level) => [level.background, level.platforms])
  ])];

  const canvas = document.getElementById("game");
  const context = canvas.getContext("2d", { alpha: false });
  const status = document.getElementById("status");
  const startButton = document.getElementById("start");
  const images = {};
  const keys = new Set();
  const pointers = new Map();
  const audio = { context: null, enabled: true };

  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  context.scale(SCALE, SCALE);
  context.imageSmoothingEnabled = false;

  function setStatus(message) {
    status.textContent = message;
  }

  function loadSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return {
        bestLevel: Number.isInteger(saved.bestLevel) ? Math.max(0, saved.bestLevel) : 0,
        bestScore: Number.isInteger(saved.bestScore) ? Math.max(0, saved.bestScore) : 0
      };
    } catch (error) {
      console.warn("No se pudo leer el progreso guardado de Jump Boy:", error);
      return { bestLevel: 0, bestScore: 0 };
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        bestLevel: game.save.bestLevel,
        bestScore: game.save.bestScore
      }));
    } catch (error) {
      console.error("No se pudo guardar el progreso de Jump Boy:", error);
      setStatus("El navegador no permite guardar el progreso; puedes seguir jugando.");
    }
  }

  function playTone(frequency, duration = 0.08, type = "square") {
    if (!audio.enabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audio.context ??= new AudioContextClass();
      if (audio.context.state === "suspended") void audio.context.resume();
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.055, audio.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.context.destination);
      oscillator.start();
      oscillator.stop(audio.context.currentTime + duration);
    } catch (error) {
      console.warn("No se pudo reproducir el sonido de Jump Boy:", error);
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function drawText(text, x, y, color = "#fff", align = "left") {
    context.font = "7px monospace";
    context.textAlign = align;
    context.textBaseline = "top";
    context.lineWidth = 2;
    context.strokeStyle = "#182033";
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
  }

  class JumpBoy {
    constructor() {
      this.state = "title";
      this.ready = false;
      this.save = loadSave();
      this.level = 0;
      this.score = 0;
      this.lives = 3;
      this.boosts = 3;
      this.cameraY = 0;
      this.platforms = [];
      this.reachedPlatform = 0;
      this.player = { x: 74, y: 157, width: 27, height: 30, vx: 0, vy: 0, facing: 1, extraJump: true };
      this.lastFrame = 0;
      this.elapsed = 0;
      this.loadAssets();
      requestAnimationFrame((time) => this.frame(time));
    }

    async loadAssets() {
      try {
        await Promise.all(ASSET_NAMES.map((name) => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            images[name] = image;
            resolve();
          };
          image.onerror = () => reject(new Error(`No se pudo cargar el recurso ${name}.`));
          image.src = `./assets/${name}`;
        })));
        this.ready = true;
        startButton.disabled = false;
        setStatus("¡Listo! Pulsa «Jugar» para empezar.");
        this.render();
      } catch (error) {
        console.error("No se pudieron cargar los recursos de Jump Boy:", error);
        setStatus("No se pudieron cargar los recursos. Ejecuta build-web.ps1 o recarga la página.");
      }
    }

    start() {
      if (!this.ready) return;
      this.level = 0;
      this.score = 0;
      this.lives = 3;
      this.boosts = 3;
      this.startLevel();
      this.state = "playing";
      startButton.hidden = true;
      canvas.focus();
      setStatus("¡A saltar! Aterriza en las plataformas para avanzar.");
      this.wakeAudio();
    }

    startLevel() {
      let nextX = 71;
      this.platforms = [];
      for (let index = 0; index <= PLATFORM_COUNT; index += 1) {
        if (index > 0) nextX = clamp(nextX + Math.floor(Math.random() * 71) - 35, 7, WIDTH - 41);
        this.platforms.push({
          x: nextX,
          y: 188 - index * 66,
          index,
          frame: index === PLATFORM_COUNT ? 6 : [0, 2, 4][index % 3],
          hasCoin: index > 0 && index % 4 === 0,
          collected: false
        });
      }
      this.reachedPlatform = 0;
      this.cameraY = 0;
      this.player = {
        x: this.platforms[0].x + 4,
        y: this.platforms[0].y - 30,
        width: 27,
        height: 30,
        vx: 0,
        vy: -330,
        facing: 1,
        extraJump: true
      };
    }

    wakeAudio() {
      if (!audio.enabled) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audio.context ??= new AudioContextClass();
          if (audio.context.state === "suspended") void audio.context.resume();
        }
      } catch (error) {
        console.warn("No se pudo iniciar el audio de Jump Boy:", error);
      }
    }

    changeState(nextState) {
      this.state = nextState;
      if (nextState === "paused") {
        startButton.textContent = "Continuar";
        startButton.hidden = false;
        setStatus("Juego en pausa.");
      } else if (nextState === "gameover") {
        startButton.textContent = "Volver a jugar";
        startButton.hidden = false;
        setStatus("Fin de la partida. Pulsa «Volver a jugar» para intentarlo otra vez.");
      } else if (nextState === "victory") {
        startButton.textContent = "Jugar otra vez";
        startButton.hidden = false;
        setStatus("¡Has completado todos los niveles!");
      }
    }

    update(delta) {
      if (this.state !== "playing") return;
      const player = this.player;
      const previousY = player.y;
      const left = keys.has("left") || [...pointers.values()].includes("left");
      const right = keys.has("right") || [...pointers.values()].includes("right");
      player.vx = (right ? 1 : 0) - (left ? 1 : 0);
      if (player.vx !== 0) player.facing = Math.sign(player.vx);
      player.x = clamp(player.x + player.vx * 112 * delta, 0, WIDTH - player.width);
      player.vy += 760 * delta;
      player.y += player.vy * delta;

      if (player.vy > 0) {
        const previousFeet = previousY + player.height;
        const currentFeet = player.y + player.height;
        const landed = this.platforms.find((platform) =>
          previousFeet <= platform.y &&
          currentFeet >= platform.y &&
          player.x + player.width - 4 > platform.x &&
          player.x + 4 < platform.x + 34
        );
        if (landed) this.land(landed);
      }

      if (player.y - this.cameraY > HEIGHT + 34) this.loseLife();
      this.cameraY = Math.min(this.cameraY, player.y - 133);
      this.elapsed += delta;
    }

    land(platform) {
      const player = this.player;
      player.y = platform.y - player.height;
      player.vy = -330;
      player.extraJump = true;
      playTone(420 + (platform.index % 3) * 90);

      if (platform.index > this.reachedPlatform) {
        this.reachedPlatform = platform.index;
        this.score += 10;
      }

      if (platform.hasCoin && !platform.collected &&
          Math.abs(player.x + player.width / 2 - (platform.x + 17)) < 22) {
        platform.collected = true;
        this.score += 25;
        this.boosts = Math.min(9, this.boosts + 1);
        playTone(880, 0.12, "sine");
      }

      if (platform.index === PLATFORM_COUNT) this.completeLevel();
    }

    useExtraJump() {
      if (this.state !== "playing" || !this.player.extraJump || this.boosts <= 0) return;
      this.player.vy = -405;
      this.player.extraJump = false;
      this.boosts -= 1;
      playTone(660, 0.12);
    }

    loseLife() {
      this.lives -= 1;
      playTone(170, 0.25, "sawtooth");
      if (this.lives <= 0) {
        this.save.bestScore = Math.max(this.save.bestScore, this.score);
        saveProgress();
        this.changeState("gameover");
        return;
      }
      this.startLevel();
      setStatus(`¡Uy! Te quedan ${this.lives} vidas. Inténtalo otra vez.`);
    }

    completeLevel() {
      this.score += 100;
      this.save.bestLevel = Math.max(this.save.bestLevel, this.level + 1);
      this.save.bestScore = Math.max(this.save.bestScore, this.score);
      saveProgress();
      playTone(740, 0.2, "triangle");
      if (this.level === LEVELS.length - 1) {
        this.changeState("victory");
        return;
      }
      this.level += 1;
      this.startLevel();
      setStatus(`¡Nivel ${this.level} completado! Ahora: nivel ${this.level + 1}.`);
    }

    drawBackground() {
      const level = LEVELS[this.level];
      const background = images[level.background];
      if (background) {
        const offset = Math.floor((-this.cameraY * 0.16) % background.height);
        context.drawImage(background, 0, offset - background.height);
        context.drawImage(background, 0, offset);
      } else {
        context.fillStyle = "#8ee2ef";
        context.fillRect(0, 0, WIDTH, HEIGHT);
      }
    }

    drawPlayer(screenY) {
      const player = this.player;
      const sprite = images["man.png"];
      if (!sprite) return;
      const frame = player.vy < 0 ? 8 : (Math.floor(this.elapsed * 9) % 2) * 2;
      context.save();
      if (player.facing < 0) {
        context.translate(player.x + player.width, 0);
        context.scale(-1, 1);
        context.drawImage(sprite, frame * 27, 0, 27, 30, 0, screenY, 27, 30);
      } else {
        context.drawImage(sprite, frame * 27, 0, 27, 30, player.x, screenY, 27, 30);
      }
      context.restore();
    }

    drawControls() {
      context.globalAlpha = 0.68;
      const buttons = [
        { x: 25, label: "◀" },
        { x: 66, label: "▶" }
      ];
      for (const button of buttons) {
        context.fillStyle = "#13233c";
        context.beginPath();
        context.arc(button.x, 195, 15, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#fff";
        context.stroke();
        drawText(button.label, button.x, 191, "#fff", "center");
      }
      context.fillStyle = "#8a2c28";
      context.beginPath();
      context.arc(148, 193, 21, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#fff";
      context.stroke();
      drawText("Z", 148, 190, "#fff", "center");
      context.globalAlpha = 1;
    }

    drawHud() {
      context.fillStyle = "#17213cdd";
      context.fillRect(0, 0, WIDTH, 23);
      drawText(`NIVEL ${String(this.level + 1).padStart(2, "0")}`, 5, 4, "#ffe46a");
      drawText(`PUNTOS ${String(this.score).padStart(4, "0")}`, 70, 4, "#fff");
      context.fillStyle = "#34456b";
      context.fillRect(151, 2, 20, 12);
      drawText(audio.enabled ? "♪" : "×", 161, 4, "#fff", "center");
      const heart = images["heart.png"];
      if (heart) {
        for (let index = 0; index < this.lives; index += 1) {
          context.drawImage(heart, 0, 0, 11, 12, 144 + index * 10, 4, 9, 10);
        }
      }
      drawText(`Z:${this.boosts}`, 5, 14, "#fff");
      drawText(`${Math.min(this.reachedPlatform, PLATFORM_COUNT)}/${PLATFORM_COUNT}`, WIDTH - 5, 14, "#fff", "right");
    }

    drawTitle() {
      const background = images["background.png"];
      const title = images["title.png"];
      if (background) context.drawImage(background, 0, 0, WIDTH, HEIGHT);
      if (title) context.drawImage(title, 2, 0, 172, 200);
      context.fillStyle = "#10182be8";
      context.fillRect(0, 166, WIDTH, 54);
      drawText("ROCKET EDITED", WIDTH / 2, 174, "#ffe46a", "center");
      drawText(`MEJOR NIVEL: ${this.save.bestLevel}`, WIDTH / 2, 187, "#fff", "center");
      drawText("FLECHAS PARA MOVERTE", WIDTH / 2, 201, "#dcecff", "center");
    }

    drawEndScreen(won) {
      const background = images[won ? "goodEnd.png" : "over.png"];
      if (background) {
        context.fillStyle = "#101827";
        context.fillRect(0, 0, WIDTH, HEIGHT);
        context.drawImage(background, (WIDTH - background.width) / 2, 55);
      } else {
        this.drawTitle();
      }
      context.fillStyle = "#101827dd";
      context.fillRect(12, 143, WIDTH - 24, 53);
      drawText(won ? "¡LO LOGRASTE!" : "FIN DE LA PARTIDA", WIDTH / 2, 151, "#ffe46a", "center");
      drawText(`PUNTOS: ${this.score}`, WIDTH / 2, 166, "#fff", "center");
      drawText(`RECORD: ${this.save.bestScore}`, WIDTH / 2, 179, "#fff", "center");
    }

    render() {
      context.clearRect(0, 0, WIDTH, HEIGHT);
      if (this.state === "title") {
        this.drawTitle();
        return;
      }
      if (this.state === "gameover" || this.state === "victory") {
        this.drawEndScreen(this.state === "victory");
        return;
      }

      this.drawBackground();
      const level = LEVELS[this.level];
      const platformSheet = images[level.platforms];
      for (const platform of this.platforms) {
        const screenY = platform.y - this.cameraY;
        if (screenY < -24 || screenY > HEIGHT + 4) continue;
        if (platformSheet) {
          context.drawImage(platformSheet, platform.frame * 34, 0, 34, 21, platform.x, screenY, 34, 21);
        }
        if (platform.hasCoin && !platform.collected) {
          context.fillStyle = "#ffde59";
          context.beginPath();
          context.arc(platform.x + 17, screenY - 10, 4, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = "#fff6b8";
          context.stroke();
        }
      }
      this.drawPlayer(this.player.y - this.cameraY);
      this.drawHud();

      if (this.state === "paused") {
        context.fillStyle = "#101827bb";
        context.fillRect(0, 0, WIDTH, HEIGHT);
        drawText("PAUSA", WIDTH / 2, 94, "#ffe46a", "center");
        drawText("PULSA CONTINUAR", WIDTH / 2, 108, "#fff", "center");
      } else {
        this.drawControls();
      }
    }

    frame(time) {
      const delta = Math.min((time - this.lastFrame) / 1000 || 0, 0.034);
      this.lastFrame = time;
      this.update(delta);
      this.render();
      requestAnimationFrame((nextTime) => this.frame(nextTime));
    }
  }

  const game = new JumpBoy();

  function pointerControl(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * WIDTH / bounds.width;
    const y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
    if (y < 165) return null;
    if (x < 46) return "left";
    if (x < 91) return "right";
    if (x > 112) return "boost";
    return null;
  }

  startButton.addEventListener("click", () => {
    if (game.state === "paused") {
      game.changeState("playing");
      startButton.hidden = true;
      canvas.focus();
      setStatus("¡Sigamos! Aterriza en las plataformas para avanzar.");
    } else {
      game.start();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.focus();
    if (game.state === "title") {
      game.start();
      return;
    }
    if (game.state === "paused") {
      game.changeState("playing");
      startButton.hidden = true;
      setStatus("¡Sigamos! Aterriza en las plataformas para avanzar.");
      return;
    }
    if (game.state === "gameover" || game.state === "victory") {
      game.changeState("title");
      game.start();
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * WIDTH / bounds.width;
    const y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
    if (y < 23 && x > 145) {
      audio.enabled = !audio.enabled;
      setStatus(audio.enabled ? "Sonido activado." : "Sonido desactivado.");
      return;
    }
    const control = pointerControl(event);
    if (control) {
      pointers.set(event.pointerId, control);
      if (control === "boost") game.useExtraJump();
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      console.warn("No se pudo capturar el toque en el juego:", error);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const control = pointerControl(event);
    if (control === "boost") {
      game.useExtraJump();
      pointers.set(event.pointerId, "boost");
    } else if (control) {
      pointers.set(event.pointerId, control);
    } else {
      pointers.delete(event.pointerId);
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
  }
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", " ", "enter", "z"].includes(key)) event.preventDefault();
    if (game.state === "title" && [" ", "enter"].includes(key)) {
      game.start();
      return;
    }
    if (game.state === "paused" && [" ", "enter"].includes(key)) {
      game.changeState("playing");
      startButton.hidden = true;
      setStatus("¡Sigamos! Aterriza en las plataformas para avanzar.");
      return;
    }
    if (key === "escape" && game.state === "playing") {
      game.changeState("paused");
      return;
    }
    if (key === "arrowleft" || key === "a") keys.add("left");
    if (key === "arrowright" || key === "d") keys.add("right");
    if (!event.repeat && [" ", "z", "enter"].includes(key)) game.useExtraJump();
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") keys.delete("left");
    if (key === "arrowright" || key === "d") keys.delete("right");
  });
})();
