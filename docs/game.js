import { audio } from "./audio.js";

const WIDTH = 176;
const HEIGHT = 220;
const FRAME_MS = 60;
const LANGUAGES = ["en", "se", "pt"];
const LEVEL_X = [0, 20, 20, 49, 88, 101, 123, 146, 138, 112];
const LEVEL_Y = [23, 60, 112, 35, 37, 87, 22, 52, 89, 130];
const LEVEL_BACKGROUNDS = ["bk00", "bk01", "bk02", "bk03", "bk04", "bk06", "bk07", "bk09", "bk08", "bk05"];
const LEVEL_PLATFORMS = ["plane", "wash", "dish", "flower", "fish", "basin", "plane", "dish", "wash", "plane"];
const LEVEL_TIMES = [0, 2400, 2300, 2200, 2100, 2000, 1900, 1800, 1700, 1600];
const MENU_ITEMS = 6;

const canvas = document.querySelector("#game");
const context = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const touchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
context.imageSmoothingEnabled = false;

const images = new Map();
const imageNames = [
  "Font", "num", "aim", "needle", "man", "fatman", "time", "fire",
  "property", "heart", "smoke", "sound_on", "sound_off", "arror",
  "popup", "menu_arrow_left", "menu_arrow_right", "over", "goodEnd",
  "act", "brand", "lang", "select", "title", "Big_Arror",
  ...LEVEL_BACKGROUNDS, ...new Set(LEVEL_PLATFORMS),
  "en/menu_en", "en/gamemenu_en", "en/help_en_0", "en/help_en_1", "en/stage_clear_en",
  "se/menu_se", "se/gamemenu_se", "se/help_se_0", "se/help_se_1", "se/stage_clear_se",
  "pt/menu_pt", "pt/gamemenu_pt", "pt/help_pt_0", "pt/help_pt_1", "pt/stage_clear_pt"
];

const game = {
  ready: false,
  state: "menu",
  menuIndex: 0,
  mapLevel: 0,
  helpPage: 0,
  optionsIndex: 0,
  languageIndex: 0,
  language: "en",
  data: null,
  tables: [],
  images: null,
  rankings: [0, 0, 0, 0, 0],
  soundEnabled: true,
  unlocked: 0,
  level: 0,
  platformIndex: 0,
  sourcePlatform: null,
  targetPlatform: null,
  objects: [],
  playerX: 0,
  playerY: HEIGHT,
  aimX: 0,
  aimY: 0,
  velocityX: 0,
  velocityY: 0,
  playerState: 0,
  approachReady: false,
  animation: 0,
  facing: 0,
  frame: 0,
  score: 0,
  lives: 30,
  breaks: 3,
  energy: 15,
  energyToggle: false,
  heavy: false,
  brakeJump: false,
  brakeUsed: false,
  landingDelay: 0,
  scrollLeft: 0,
  scrollOffset: 0,
  timer: 0,
  stateBeforePause: "playing",
  returnState: "menu",
  touchVisible: touchDevice,
  touched: new Set(),
  lastFrame: 0,
  accumulator: 0
};

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      images.set(name, image);
      resolve();
    };
    image.onerror = () => reject(new Error(`No se pudo cargar el recurso original: assets/${name}.png`));
    image.src = new URL(`./assets/${name}.png`, import.meta.url).href;
  });
}

async function loadResources() {
  const [levelResponse] = await Promise.all([
    fetch(new URL("./levels.json", import.meta.url))
  ]);
  if (!levelResponse.ok) throw new Error(`No se pudieron cargar las tablas originales (${levelResponse.status}).`);
  const levelData = await levelResponse.json();
  if (!Array.isArray(levelData.stages) || levelData.stages.length !== 10) {
    throw new Error("Las tablas de niveles exportadas no tienen el formato esperado.");
  }
  game.data = levelData;
  await Promise.all(imageNames.map(loadImage));
  game.tables = levelData.stages.map((stage) => ({
    platforms: transformPlatforms(stage.platforms),
    objects: transformObjects(stage.objects)
  }));
  loadSave();
  game.ready = true;
  status.textContent = touchDevice
    ? "Toca o arrastra dentro del arco para apuntar y pulsa SALTO."
    : "Usa las flechas para apuntar y Enter para saltar.";
  canvas.focus({ preventScroll: true });
}

function transformPlatforms(rows) {
  const transformed = rows.map((row) => row.slice());
  for (let index = 0; index < transformed.length; index += 1) {
    const row = transformed[index];
    row[2] = Math.trunc((row[2] + 50) * HEIGHT / 320);
    row[5] = Math.trunc((row[5] + 50) * HEIGHT / 320);
    for (const xIndex of [1, 4]) {
      const target = Math.trunc(row[xIndex] * (WIDTH - 30) / 240);
      while (row[xIndex] > target) row[xIndex] -= 16;
    }
    if (index > 0) {
      const alignment = transformed[index - 1][4] - row[1];
      if (alignment % 16 !== 0) row[1] += alignment % 16;
    }
    while (row[1] < 0) row[1] += 16;
    while (row[4] < 0) row[4] += 16;
    if (row[1] - row[4] < 16 && row[1] - row[4] > -16) {
      if (row[1] > 16) row[1] -= 16;
      if (row[4] < WIDTH - 16) row[4] += 16;
    }
  }
  return transformed;
}

function transformObjects(rows) {
  return rows.map((row) => {
    const transformed = row.slice();
    for (let index = 0; index < transformed.length; index += 3) {
      if (transformed[index] !== 3) {
        transformed[index + 1] = Math.min(WIDTH - 30, Math.max(0,
          Math.trunc(transformed[index + 1] * (WIDTH - 30) / 176)));
      }
    }
    return transformed;
  });
}

function loadSave() {
  let save;
  try {
    save = JSON.parse(localStorage.getItem("jumpboy-save") || "{}");
    if (!save || typeof save !== "object") save = {};
  } catch (error) {
    console.warn("Could not read the Jump Boy browser save; starting with defaults.", error);
    save = {};
  }
  game.unlocked = Number.isInteger(save.unlocked) ? Math.min(9, Math.max(0, save.unlocked)) : 0;
  game.languageIndex = Number.isInteger(save.languageIndex) ? Math.min(2, Math.max(0, save.languageIndex)) : 0;
  game.language = LANGUAGES[game.languageIndex];
  game.soundEnabled = typeof save.soundEnabled === "boolean" ? save.soundEnabled : true;
  audio.enabled = game.soundEnabled;
  game.rankings = Array.isArray(save.rankings) && save.rankings.length === 5
    ? save.rankings.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0)
    : [0, 0, 0, 0, 0];
}

function saveGame() {
  try {
    localStorage.setItem("jumpboy-save", JSON.stringify({
      unlocked: game.unlocked,
      languageIndex: game.languageIndex,
      soundEnabled: game.soundEnabled,
      rankings: game.rankings
    }));
  } catch (error) {
    status.textContent = "No se pudo guardar el progreso en este navegador.";
    status.classList.add("error");
    console.error("Could not save Jump Boy progress.", error);
  }
}

function image(name) {
  return images.get(`${name}.png`) || images.get(name);
}

function drawImage(name, x, y, width, height, sx = 0, sy = 0, sw, sh) {
  const source = image(name);
  if (!source) return;
  context.drawImage(source, sx, sy, sw ?? source.width, sh ?? source.height,
    Math.round(x), Math.round(y), width ?? sw ?? source.width, height ?? sh ?? source.height);
}

function drawFull(name, x = 0, y = 0) {
  const source = image(name);
  if (source) drawImage(name, x, y, source.width, source.height);
}

function drawText(text, x, y, color = null) {
  const source = image("Font");
  if (!source) return;
  const width = 8;
  if (color) {
    context.save();
    context.globalAlpha = 0.98;
  }
  for (const [index, character] of [...String(text)].entries()) {
    const code = character.toUpperCase().charCodeAt(0) - 32;
    if (code < 0 || code * width + width > source.width) continue;
    context.drawImage(source, code * width, 0, width, source.height, x + index * width, y, width, source.height);
  }
  if (color) {
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = color;
    context.fillRect(x, y, [...String(text)].length * width, source.height);
    context.restore();
  }
}

function drawDigits(value, x, y) {
  const source = image("num");
  if (!source) return;
  const width = 8;
  const text = String(Math.max(0, Math.trunc(value)));
  for (const [index, character] of [...text].entries()) {
    const glyph = Number(character);
    context.drawImage(source, glyph * width, 0, width, source.height,
      x + index * width, y, width, source.height);
  }
}

function drawCenteredText(text, y) {
  drawText(text, Math.floor((WIDTH - String(text).length * 8) / 2), y);
}

function drawLineFromSheet(name, row, count, y, x = 0, width = WIDTH) {
  const source = image(name);
  if (!source) return;
  const lineHeight = source.height / count;
  context.drawImage(source, 0, row * lineHeight, source.width, lineHeight,
    x, y, Math.min(source.width, width), lineHeight);
}

function drawMainMenu() {
  drawFull("title");
  const menuName = `${game.language}/menu_${game.language}`;
  const menuImage = image(menuName);
  if (!menuImage) return;
  const lineHeight = menuImage.height / MENU_ITEMS;
  const startY = 145;
  for (let index = 0; index < MENU_ITEMS; index += 1) {
    context.drawImage(menuImage, 0, index * lineHeight, menuImage.width, lineHeight,
      (WIDTH - menuImage.width) / 2, startY + index * (lineHeight + 1), menuImage.width, lineHeight);
  }
  const selectionY = startY + game.menuIndex * (lineHeight + 1) - 1;
  drawFull("menu_arrow_left", 20, selectionY - 2);
  drawFull("menu_arrow_right", WIDTH - 20 - image("menu_arrow_right").width, selectionY - 2);
}

function drawMap() {
  drawFull("act");
  const level = Math.min(9, Math.max(0, game.mapLevel));
  drawImage("man", LEVEL_X[level], LEVEL_Y[level] + (game.frame % 2) * 2, 27, 30, 216, 0, 27, 30);
  drawCenteredText(`LEVEL ${level + 1}`, 185);
  drawCenteredText("UP/DOWN SELECT", 197);
  drawCenteredText("ENTER TO PLAY", 207);
}

function drawHelp() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawFull("brand", 0, 0);
  const name = `${game.language}/help_${game.language}_${game.helpPage}`;
  const sourceName = image(name) ? name : `en/help_en_${game.helpPage}`;
  const source = image(sourceName);
  if (source) drawImage(sourceName, (WIDTH - source.width) / 2, (HEIGHT - source.height) / 2, source.width, source.height);
  drawCenteredText("TOCA: SIGUE / ATRAS", 205);
}

function drawOptions() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawFull("brand", 0, 0);
  drawCenteredText("OPTIONS", 34);
  drawText("MUSIC", 38, 72);
  drawText(game.soundEnabled ? "ON" : "OFF", 117, 72);
  drawText("LANGUAGE", 38, 112);
  drawLineFromSheet("lang", [0, 4, 6][game.languageIndex], 8, 109, 105);
  drawFull("menu_arrow_left", 83, 151);
  drawFull("menu_arrow_right", 117, 151);
  drawCenteredText("TOCA ABAJO: ATRAS", 196);
}

function drawRankings() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawFull("brand", 0, 0);
  drawCenteredText("RANKING", 31);
  for (let index = 0; index < 5; index += 1) {
    drawText(`${index + 1}.`, 36, 61 + index * 23);
    drawDigits(game.rankings[index], 64, 61 + index * 23);
  }
  drawCenteredText("Q: BACK", 196);
}

function drawPause() {
  context.save();
  context.fillStyle = "rgba(0,0,0,.62)";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const source = image(`${game.language}/gamemenu_${game.language}`);
  if (source) {
    const lineHeight = source.height / 4;
    for (let index = 0; index < 4; index += 1) {
      context.drawImage(source, 0, index * lineHeight, source.width, lineHeight,
        (WIDTH - source.width) / 2, 74 + index * (lineHeight + 3), source.width, lineHeight);
    }
    drawFull("menu_arrow_left", 31, 72 + game.menuIndex * (lineHeight + 3));
    drawFull("menu_arrow_right", WIDTH - 31 - image("menu_arrow_right").width,
      72 + game.menuIndex * (lineHeight + 3));
  }
  context.restore();
}

function beginGame(level = 0) {
  game.level = Math.min(9, Math.max(0, level));
  game.score = 0;
  game.lives = 30;
  game.breaks = 3;
  game.energy = 15;
  game.energyToggle = false;
  game.heavy = false;
  game.brakeJump = false;
  game.platformIndex = 0;
  game.scrollOffset = 0;
  game.timer = LEVEL_TIMES[game.level];
  game.playerState = 1;
  game.approachReady = false;
  game.aimX = 0;
  game.aimY = 0;
  game.velocityX = 0;
  game.velocityY = 0;
  game.animation = 0;
  game.brakeUsed = false;
  game.sourcePlatform = makePlatform(game.tables[game.level].platforms[0], 0);
  game.targetPlatform = makePlatform(game.tables[game.level].platforms[0], 3);
  game.playerX = game.sourcePlatform.x + 4;
  game.playerY = game.sourcePlatform.y - 26;
  game.objects = [];
  loadObjects(0);
  game.state = "playing";
  void audio.playMusic();
}

function makePlatform(row, offset) {
  return {
    type: row[offset],
    x: row[offset + 1],
    y: row[offset + 2],
    frame: 0,
    timer: 0,
    used: false
  };
}

function loadObjects(index) {
  const row = game.tables[game.level].objects[index] || [];
  game.objects = [];
  for (let offset = 0; offset < row.length; offset += 3) {
    game.objects.push({
      type: row[offset],
      x: row[offset + 1],
      y: row[offset + 2],
      active: true,
      frame: 0
    });
  }
}

function beginNextLevel() {
  if (game.level >= 9) {
    game.state = "won";
    saveRanking();
    return;
  }
  game.level += 1;
  game.unlocked = Math.max(game.unlocked, game.level);
  game.lives = game.lives >= 3 ? Math.min(99, game.lives + 1) : 3;
  saveGame();
  game.platformIndex = 0;
  game.timer = LEVEL_TIMES[game.level];
  game.scrollOffset = 0;
  game.sourcePlatform = makePlatform(game.tables[game.level].platforms[0], 0);
  game.targetPlatform = makePlatform(game.tables[game.level].platforms[0], 3);
  game.playerX = game.sourcePlatform.x + 4;
  game.playerY = game.sourcePlatform.y - 26;
  game.playerState = 1;
  game.approachReady = false;
  game.aimX = 0;
  game.aimY = 0;
  game.brakeJump = false;
  game.brakeUsed = false;
  loadObjects(0);
}

function advancePlatform() {
  game.score += 100;
  game.platformIndex += 1;
  if (game.platformIndex > 15) {
    beginNextLevel();
    return;
  }
  game.sourcePlatform = { ...game.targetPlatform, used: true };
  const nextRow = game.tables[game.level].platforms[game.platformIndex];
  game.targetPlatform = makePlatform(nextRow, 3);
  const previousRow = game.tables[game.level].platforms[game.platformIndex - 1];
  const scrollDistance = Math.trunc((previousRow[5] - nextRow[2]) / 16);
  game.scrollLeft = Math.max(0, scrollDistance);
  loadObjects(game.platformIndex);
  game.playerState = 1;
  game.aimX = 0;
  game.aimY = 0;
  game.velocityX = 0;
  game.velocityY = 0;
  game.brakeUsed = false;
}

function loseLife() {
  game.lives -= 1;
  game.playerState = 6;
  game.animation = 0;
  if (game.lives <= 0) {
    game.state = "gameover";
    saveRanking();
    void audio.playDeath();
  }
}

function saveRanking() {
  game.rankings.push(game.score);
  game.rankings.sort((left, right) => right - left);
  game.rankings = game.rankings.slice(0, 5);
  saveGame();
}

function startJump() {
  game.playerState = 3;
  game.velocityX = game.aimX;
  game.velocityY = -game.aimY * 10;
  game.animation = 0;
  game.facing = game.velocityX < 0 ? 1 : 0;
  game.brakeUsed = false;
  game.brakeJump = false;
}

function changeAim(code) {
  if (code === -1 && game.aimY < 18) game.aimY += 1;
  if (code === -2 && game.aimY > 0) game.aimY -= 1;
  if (code === -3 && game.aimX > -18) game.aimX -= 1;
  if (code === -4 && game.aimX < 18) game.aimX += 1;
  if (game.aimX * game.aimX + game.aimY * game.aimY >= 18 * 18) {
    game.aimX = Math.sign(game.aimX) * Math.max(0, Math.floor(Math.sqrt(18 * 18 - game.aimY * game.aimY)));
  }
}

function onAction(code) {
  if (!game.ready) return;
  if (game.state === "menu") {
    if (code === -1 || code === -2) {
      game.menuIndex = (game.menuIndex + (code === -1 ? MENU_ITEMS - 1 : 1)) % MENU_ITEMS;
    }
    if (code === 53 || code === -6) selectMenuItem();
    return;
  }
  if (game.state === "map") {
    if (code === -1 || code === -3) game.mapLevel = Math.max(0, game.mapLevel - 1);
    if (code === -2 || code === -4) game.mapLevel = Math.min(game.unlocked, game.mapLevel + 1);
    if (code === 53) beginGame(game.mapLevel);
    if (code === -7 || code === -6) game.state = "menu";
    return;
  }
  if (game.state === "help") {
    if (code === 53 || code === -2 || code === -4) game.helpPage = (game.helpPage + 1) % 2;
    if (code === -7 || code === -6) game.state = game.returnState;
    return;
  }
  if (game.state === "options") {
    if (code === -1 || code === -2) game.optionsIndex = 1 - game.optionsIndex;
    if (code === -3 || code === -4 || code === 53) {
      if (game.optionsIndex === 0) {
        game.soundEnabled = !game.soundEnabled;
        audio.setEnabled(game.soundEnabled);
        if (game.soundEnabled && game.returnState === "pause") void audio.playMusic();
        saveGame();
      } else {
        game.languageIndex = (game.languageIndex + (code === -3 ? 2 : 1)) % LANGUAGES.length;
        game.language = LANGUAGES[game.languageIndex];
        saveGame();
      }
    }
    if (code === -7 || code === -6) game.state = game.returnState;
    return;
  }
  if (game.state === "rankings") {
    if (code === -7 || code === -6 || code === 53) game.state = "menu";
    return;
  }
  if (game.state === "pause") {
    if (code === -1 || code === -2) game.menuIndex = (game.menuIndex + (code === -1 ? 3 : 1)) % 4;
    if (code === -7 || code === -6) game.state = game.stateBeforePause;
    if (code === 53) {
      if (game.menuIndex === 0) game.state = game.stateBeforePause;
      if (game.menuIndex === 1) {
        game.returnState = "pause";
        game.helpPage = 0;
        game.state = "help";
      }
      if (game.menuIndex === 2) {
        game.returnState = "pause";
        game.state = "options";
      }
      if (game.menuIndex === 3) game.state = "menu";
    }
    return;
  }
  if (game.state === "gameover" || game.state === "won") {
    if (code === 53 || code === -6 || code === -7) game.state = "menu";
    return;
  }
  if (game.state !== "playing") return;
  if (code === -6) {
    game.stateBeforePause = game.state;
    game.menuIndex = 0;
    game.state = "pause";
    return;
  }
  if (game.playerState === 1) {
    if (code >= -4 && code <= -1) changeAim(code);
    if (code === 53) startJump();
  } else if (game.playerState === 3) {
    if (code === 48 && game.breaks > 0 && !game.brakeUsed) {
      game.breaks -= 1;
      game.brakeUsed = true;
      game.brakeJump = true;
    } else if (code === 53 && game.energy >= 0) {
      game.velocityY -= 10;
      if (game.energyToggle) game.energy -= 1;
      game.energyToggle = !game.energyToggle;
    }
  }
}

function selectMenuItem() {
  if (game.menuIndex === 0) beginGame(0);
  else if (game.menuIndex === 1) {
    game.mapLevel = game.unlocked;
    game.state = "map";
  } else if (game.menuIndex === 2) {
    game.optionsIndex = 0;
    game.returnState = "menu";
    game.state = "options";
  } else if (game.menuIndex === 3) game.state = "rankings";
  else if (game.menuIndex === 4) {
    game.helpPage = 0;
    game.returnState = "menu";
    game.state = "help";
  } else {
    status.textContent = "Para salir del juego, cierra esta pestaña.";
  }
}

function update() {
  game.frame += 1;
  if (game.state !== "playing") return;
  if (game.timer > 0) game.timer -= 1;
  if (game.level > 0 && game.timer <= 0) {
    game.state = "gameover";
    saveRanking();
    void audio.playDeath();
    return;
  }

  if (game.scrollLeft > 0) {
    game.scrollLeft -= 1;
    game.scrollOffset += 1;
    game.playerX -= 16;
    game.sourcePlatform.y -= 16;
    game.targetPlatform.y -= 16;
    return;
  }

  if (game.playerState === 0) {
    game.animation += 1;
    if (!game.approachReady) {
      game.playerY -= 15;
      if (game.playerY < game.sourcePlatform.y - 32) game.approachReady = true;
    } else {
      game.playerY += 2;
      if (intersects(game.playerX, game.playerY, 26, 30,
        game.sourcePlatform.x, game.sourcePlatform.y, 30, 21)) {
        game.playerY = game.sourcePlatform.y - 26;
        game.playerState = 1;
      }
    }
    if (game.playerState === 1) {
      game.playerY = game.sourcePlatform.y - 26;
    }
    return;
  }

  if (game.playerState === 1) {
    game.animation += 1;
    return;
  }

  if (game.playerState === 3) {
    const oldY = game.playerY;
    if (!game.brakeJump) game.playerX += game.velocityX;
    game.playerY += Math.trunc(game.velocityY / 10);
    game.velocityY += 5;
    game.facing = game.velocityX < 0 ? 1 : 0;
    game.animation += 1;

    for (const object of game.objects) {
      if (!object.active) continue;
      if (object.type === 3) {
        object.x += 2;
        if (object.x > WIDTH + 30) object.x = 0;
      }
      const objectWidth = object.type === 3 ? 16 : 12;
      if (intersects(game.playerX + 4, game.playerY, 15, 25, object.x, object.y, objectWidth, 10)) {
        object.active = false;
        if (object.type === 0) {
          game.breaks += 1;
          game.heavy = true;
        } else if (object.type === 1) game.score += 10;
        else if (object.type === 2) game.heavy = false;
        else if (object.type === 3) game.energy = Math.min(15, game.energy + 5);
      }
    }

    if (game.playerX < 0) {
      game.playerX = 0;
      game.velocityX = -game.velocityX;
    }
    if (game.playerX > WIDTH - 27) {
      game.playerX = WIDTH - 27;
      game.velocityX = -game.velocityX;
    }
    if (game.playerY < 0) {
      game.playerY = 10;
      game.velocityY = -(game.velocityY + 10);
    }
    if (game.velocityY > 0
        && oldY + 28 <= game.targetPlatform.y
        && intersects(game.playerX + 4, game.playerY, 15, 28,
          game.targetPlatform.x, game.targetPlatform.y, 28, 0)
        && game.playerY + 10 < game.targetPlatform.y) {
      game.playerY = game.targetPlatform.y - 26;
      game.playerState = game.targetPlatform.type === 1 || game.targetPlatform.type === 2 ? 5 : 4;
      game.landingDelay = game.playerState === 5 ? 7 : 3;
      game.velocityX = 0;
      game.velocityY = 0;
    }
    if (game.playerY > HEIGHT + 3) loseLife();
    return;
  }

  if (game.playerState === 4 || game.playerState === 5) {
    game.landingDelay -= 1;
    game.animation += 1;
    if (game.playerState === 5) game.playerY += 6;
    if (game.playerY > HEIGHT) {
      loseLife();
      return;
    }
    if (game.landingDelay <= 0) advancePlatform();
    return;
  }

  if (game.playerState === 6) {
    game.animation += 1;
    game.playerY += 6;
    if (game.playerY > HEIGHT + 30) {
      if (game.lives > 0) {
        game.playerState = 1;
        game.approachReady = false;
        game.brakeJump = false;
        game.playerX = game.sourcePlatform.x + 4;
        game.playerY = game.sourcePlatform.y - 26;
        game.velocityX = 0;
        game.velocityY = 0;
        game.aimX = 0;
        game.aimY = 0;
      } else {
        game.state = "gameover";
        saveRanking();
      }
    }
  }
}

function intersects(x, y, width, height, otherX, otherY, otherWidth, otherHeight) {
  return x + width > otherX && x < otherX + otherWidth
    && y < otherY + otherHeight && y + height > otherY;
}

function drawPlatform(platform, active) {
  if (!platform) return;
  const sprite = LEVEL_PLATFORMS[game.level];
  let frame = platform.type === 3 ? 6 : 0;
  if (platform.type === 1) frame = platform.used ? (game.frame % 2) + 1 : 2;
  if (platform.type === 2 || platform.type === 4) frame = 4 + Math.floor(game.frame / 8) % 2;
  if (!active && platform.type === 1 && platform.used) frame = 0;
  drawImage(sprite, platform.x, platform.y, 34, 21, frame * 34, 0, 34, 21);
  if (platform.type === 1 && active) {
    drawDigits(Math.max(0, 5 - Math.floor(game.frame / 10) % 6), platform.x + 13, platform.y + 10);
  }
}

function drawObjects() {
  for (const object of game.objects) {
    if (!object.active) continue;
    if (object.type === 3) {
      drawImage("property", object.x, object.y, 18, 12, (Math.floor(game.frame / 4) % 2) * 18, 0, 18, 12);
    } else {
      drawImage("property", object.x, object.y, 12, 12, object.type * 12, 12, 12, 12);
    }
  }
}

function drawHud() {
  drawImage("brand", 0, 0, WIDTH, 24, 0, 0, WIDTH, 24);
  drawImage("brand", 0, HEIGHT - 14, WIDTH, 14, 0, 24, WIDTH, 14);
  drawDigits(game.lives, 27, 4);
  drawDigits(game.breaks, 51, 4);
  drawDigits(game.level + 1, WIDTH - 35, 4);
  drawDigits(game.score, 120, HEIGHT - 10);
  drawDigits(game.energy, 32, HEIGHT - 10);
  drawDigits(game.aimX < 0 ? -game.aimX - 1 : game.aimX, 68, HEIGHT - 10);
  for (let index = 0; index < Math.min(15, game.energy); index += 1) {
    drawImage("heart", 71 + index, 4, 1, 10, 12, 0, 1, 10);
  }
  if (game.level > 0) {
    drawFull("time", WIDTH - image("time").width - 2, 18);
    drawDigits(game.timer, WIDTH - image("time").width - 2 + 30, 23);
  }
}

function drawPlayer() {
  const sprite = game.heavy ? "fatman" : "man";
  if (game.playerState === 1) {
    const facing = game.aimX < 0 ? 1 : 0;
    const aim = facing === 0 ? 40 : 0;
    drawImage("aim", game.playerX + (facing === 0 ? 18 : -36), game.playerY - 28,
      40, 40, aim, 0, 40, 40);
    drawFull("needle", game.playerX + (facing === 0 ? 18 : 1) + 2 * game.aimX,
      game.playerY + 8 - 2 * game.aimY);
  }
  let pose = 0;
  if (game.playerState === 3) pose = game.velocityY < 0 ? 1 : 2;
  if (game.playerState === 5) pose = 3;
  if (game.playerState === 6) pose = game.level % 2 === 0 ? 6 : 7;
  if (game.playerState === 4) pose = 4;
  const frame = (2 * pose + game.facing) * 27;
  drawImage(sprite, game.playerX, game.playerY, 27, 30, frame, 0, 27, 30);
}

function drawTouchControls() {
  if (!game.touchVisible || game.state !== "playing") return;
  const buttons = [
    { x: 118, y: 158, w: 54, h: 54, code: 53 },
    { x: 152, y: 25, w: 20, h: 20, code: -6 }
  ];
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const button of buttons) {
    const held = game.touched.has(button.code);
    context.fillStyle = held ? "rgba(255,214,64,.82)" : "rgba(0,0,0,.42)";
    context.strokeStyle = held ? "#fff" : "rgba(255,255,255,.72)";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(button.x + button.w / 2, button.y + button.h / 2,
      button.w / 2, button.h / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#fff";
    if (button.code === 53) {
      context.font = "bold 8px system-ui, sans-serif";
      context.fillText("SALTO", button.x + button.w / 2, button.y + button.h / 2);
    } else {
      context.fillRect(button.x + 7, button.y + 5, 2, 10);
      context.fillRect(button.x + 11, button.y + 5, 2, 10);
    }
  }
  context.restore();
}

function draw() {
  canvas.dataset.gameState = game.state;
  canvas.dataset.audioTrack = audio.track;
  canvas.dataset.audioEnabled = String(game.soundEnabled);
  canvas.dataset.playerMode = String(game.playerState);
  canvas.dataset.playerX = String(Math.round(game.playerX));
  canvas.dataset.playerY = String(Math.round(game.playerY));
  context.clearRect(0, 0, WIDTH, HEIGHT);
  if (!game.ready) {
    context.fillStyle = "#000";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }
  switch (game.state) {
    case "menu": drawMainMenu(); break;
    case "map": drawMap(); break;
    case "help": drawHelp(); break;
    case "options": drawOptions(); break;
    case "rankings": drawRankings(); break;
    case "playing":
    case "pause":
      drawImage(LEVEL_BACKGROUNDS[game.level], 0, 0, WIDTH, HEIGHT);
      drawPlatform(game.sourcePlatform, false);
      drawPlatform(game.targetPlatform, true);
      drawObjects();
      drawHud();
      drawPlayer();
      drawTouchControls();
      if (game.state === "pause") drawPause();
      break;
    case "gameover":
      context.fillStyle = "#000";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      drawFull("over", (WIDTH - image("over").width) / 2, (HEIGHT - image("over").height) / 2);
      drawDigits(game.score, Math.floor((WIDTH - String(game.score).length * 8) / 2), 174);
      drawCenteredText("ENTER: MENU", 202);
      break;
    case "won":
      context.fillStyle = "#fffde0";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      drawFull("goodEnd", (WIDTH - image("goodEnd").width) / 2, (HEIGHT - image("goodEnd").height) / 2);
      drawCenteredText("ENTER: MENU", 202);
      break;
  }
}

function frame(timestamp) {
  if (game.lastFrame === 0) game.lastFrame = timestamp;
  game.accumulator += Math.min(250, timestamp - game.lastFrame);
  game.lastFrame = timestamp;
  while (game.accumulator >= FRAME_MS) {
    update();
    game.accumulator -= FRAME_MS;
  }
  draw();
  requestAnimationFrame(frame);
}

function codeForKey(event) {
  if (event.code === "ArrowUp") return -1;
  if (event.code === "ArrowDown") return -2;
  if (event.code === "ArrowLeft") return -3;
  if (event.code === "ArrowRight") return -4;
  if (event.code === "Enter" || event.code === "Space") return 53;
  if (event.code === "KeyZ" || event.code === "Digit0") return 48;
  if (event.code === "KeyQ" || event.code === "Escape") return -6;
  if (event.code === "KeyW" || event.code === "Backspace") return -7;
  return null;
}

const heldKeys = new Set();
window.addEventListener("keydown", (event) => {
  const code = codeForKey(event);
  if (code === null) return;
  event.preventDefault();
  audio.unlock();
  if (heldKeys.has(event.code)) return;
  heldKeys.add(event.code);
});
window.addEventListener("keyup", (event) => {
  const code = codeForKey(event);
  if (code === null) return;
  event.preventDefault();
  heldKeys.delete(event.code);
  onAction(code);
});
window.addEventListener("blur", () => heldKeys.clear());

const touchButtons = [
  { x: 118, y: 158, w: 54, h: 54, code: 53 },
  { x: 152, y: 25, w: 20, h: 20, code: -6 }
];
let activePointerCode = null;
let activeAimPointerId = null;

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height
  };
}

function updateAimFromPoint(point) {
  if (game.playerState !== 1) return false;

  const left = point.x < game.playerX + 9;
  const minX = left ? game.playerX - 40 : game.playerX + 12;
  const maxX = left ? game.playerX + 8 : game.playerX + 60;
  if (point.x < minX || point.x > maxX
      || point.y < game.playerY - 32 || point.y > game.playerY + 14) return false;

  const pointerOriginX = left ? game.playerX + 1 : game.playerX + 18;
  game.aimX = Math.max(-18, Math.min(18, Math.round((point.x - 2.5 - pointerOriginX) / 2)));
  game.aimY = Math.max(0, Math.min(18, Math.round((game.playerY + 10.5 - point.y) / 2)));
  if (left) game.aimX = Math.min(-1, game.aimX);
  else game.aimX = Math.max(0, game.aimX);

  const magnitude = Math.hypot(game.aimX, game.aimY);
  if (magnitude > 18) {
    const scale = 18 / magnitude;
    game.aimX = Math.trunc(game.aimX * scale);
    game.aimY = Math.trunc(game.aimY * scale);
  }
  return true;
}

canvas.addEventListener("pointerdown", (event) => {
  audio.unlock();
  canvas.focus({ preventScroll: true });
  const point = canvasPoint(event);
  if (game.state === "playing") {
    game.touchVisible = true;
    const button = touchButtons.find((item) => point.x >= item.x && point.x <= item.x + item.w
      && point.y >= item.y && point.y <= item.y + item.h);
    if (button) {
      event.preventDefault();
      activePointerCode = button.code;
      game.touched.add(button.code);
      onAction(button.code);
      canvas.setPointerCapture(event.pointerId);
    } else if (game.playerState === 1 && updateAimFromPoint(point)) {
      event.preventDefault();
      activeAimPointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
    }
  } else if (game.state === "menu") {
    const row = Math.floor((point.y - 145) / 9);
    if (row >= 0 && row < MENU_ITEMS) {
      game.menuIndex = row;
      selectMenuItem();
    }
  } else if (game.state === "map") {
    if (point.y >= HEIGHT - 30) {
      game.state = "menu";
      return;
    }
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index <= game.unlocked; index += 1) {
      const dx = point.x - LEVEL_X[index] - 13;
      const dy = point.y - LEVEL_Y[index] - 15;
      const current = dx * dx + dy * dy;
      if (current < distance) {
        distance = current;
        nearest = index;
      }
    }
    game.mapLevel = nearest;
    if (distance < 900) beginGame(nearest);
  } else if (game.state === "options") {
    if (point.y >= 57 && point.y <= 91) {
      game.optionsIndex = 0;
      game.soundEnabled = !game.soundEnabled;
      audio.setEnabled(game.soundEnabled);
      if (game.soundEnabled && game.returnState === "pause") void audio.playMusic();
      saveGame();
    } else if (point.y >= 96 && point.y <= 133) {
      game.optionsIndex = 1;
      game.languageIndex = (game.languageIndex + 1) % LANGUAGES.length;
      game.language = LANGUAGES[game.languageIndex];
      saveGame();
    } else if (point.y >= 176) {
      onAction(-6);
    }
  } else if (game.state === "pause") {
    const row = Math.floor((point.y - 70) / 16);
    if (row >= 0 && row < 4) {
      game.menuIndex = row;
      onAction(53);
    }
  } else if (game.state === "help") {
    if (game.helpPage === 0 && point.x >= WIDTH / 2) onAction(53);
    else onAction(-7);
  } else if (game.state === "rankings" || game.state === "gameover" || game.state === "won") {
    onAction(53);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (activeAimPointerId !== event.pointerId) return;
  event.preventDefault();
  updateAimFromPoint(canvasPoint(event));
});

canvas.addEventListener("pointerup", (event) => {
  if (activePointerCode !== null) {
    game.touched.delete(activePointerCode);
    activePointerCode = null;
  }
  if (activeAimPointerId === event.pointerId) {
    activeAimPointerId = null;
  }
});
canvas.addEventListener("pointercancel", () => {
  if (activePointerCode !== null) game.touched.delete(activePointerCode);
  activePointerCode = null;
  activeAimPointerId = null;
});

status.classList.remove("error");
audio.onError = (error) => {
  status.textContent = `No se pudo reproducir el audio: ${error.message}`;
  status.classList.add("error");
};
loadResources().catch((error) => {
  console.error("Jump Boy failed to load:", error);
  status.textContent = error.message || "No se pudo cargar Jump Boy.";
  status.classList.add("error");
});
requestAnimationFrame(frame);
