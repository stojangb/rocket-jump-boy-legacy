const MIDI_FILES = {
  music: "./assets/music.mid",
  death: "./assets/musicDie.mid"
};

function waveformFor(program) {
  if (program <= 7 || (program >= 24 && program <= 39) || (program >= 88 && program <= 95)) return "triangle";
  if ((program >= 8 && program <= 15) || (program >= 72 && program <= 79)) return "sine";
  if ((program >= 16 && program <= 23) || (program >= 64 && program <= 71)) return "square";
  return "sawtooth";
}

function readVariableLength(bytes, cursor) {
  let value = 0;
  for (let count = 0; count < 4; count += 1) {
    if (cursor.offset >= bytes.length) throw new Error("MIDI truncado.");
    const byte = bytes[cursor.offset++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("Valor MIDI de longitud no válido.");
}

function readUint32(bytes, offset) {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function parseMidi(buffer) {
  const bytes = new Uint8Array(buffer);
  const ascii = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (ascii(0) !== "MThd" || bytes.length < 14) throw new Error("Archivo MIDI no válido.");

  const headerLength = readUint32(bytes, 4);
  const format = (bytes[8] << 8) | bytes[9];
  const trackCount = (bytes[10] << 8) | bytes[11];
  const division = (bytes[12] << 8) | bytes[13];
  if (format > 1 || trackCount === 0 || (division & 0x8000) !== 0 || division === 0) {
    throw new Error("Formato MIDI no compatible.");
  }

  const events = [];
  const cursor = { offset: 8 + headerLength };
  let order = 0;

  for (let track = 0; track < trackCount; track += 1) {
    if (ascii(cursor.offset) !== "MTrk") throw new Error("Pista MIDI no válida.");
    const trackEnd = cursor.offset + 8 + readUint32(bytes, cursor.offset + 4);
    cursor.offset += 8;
    if (trackEnd > bytes.length) throw new Error("Pista MIDI truncada.");

    let tick = 0;
    let runningStatus = 0;
    while (cursor.offset < trackEnd) {
      tick += readVariableLength(bytes, cursor);
      let status = bytes[cursor.offset++];
      let firstData = null;
      if (status < 0x80) {
        firstData = status;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }

      if (status === 0xff) {
        const type = bytes[cursor.offset++];
        const length = readVariableLength(bytes, cursor);
        if (type === 0x51 && length === 3) {
          const tempo = (bytes[cursor.offset] << 16) | (bytes[cursor.offset + 1] << 8)
            | bytes[cursor.offset + 2];
          events.push({ tick, order: order++, kind: "tempo", tempo });
        }
        cursor.offset += length;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        cursor.offset += readVariableLength(bytes, cursor);
        continue;
      }

      const kind = status & 0xf0;
      const channel = status & 0x0f;
      const data1 = firstData === null ? bytes[cursor.offset++] : firstData;
      if (kind === 0xc0 || kind === 0xd0) {
        const value = data1;
        if (kind === 0xc0) events.push({ tick, order: order++, kind: "program", channel, value });
        continue;
      }
      const data2 = bytes[cursor.offset++];
      if (kind === 0x90 && data2 > 0) {
        events.push({ tick, order: order++, kind: "noteOn", channel, note: data1, velocity: data2 });
      } else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
        events.push({ tick, order: order++, kind: "noteOff", channel, note: data1, velocity: data2 });
      } else if (kind === 0xb0) {
        events.push({ tick, order: order++, kind: "control", channel, controller: data1, value: data2 });
      }
    }
    cursor.offset = trackEnd;
  }

  const ordered = events
    .map((event) => ({ ...event, trackOrder: event.order }))
    .sort((left, right) => left.tick - right.tick || left.order - right.order);
  const tempos = [{ tick: 0, tempo: 500000 }];
  for (const event of ordered) {
    if (event.kind === "tempo") tempos.push({ tick: event.tick, tempo: event.tempo });
  }
  tempos.sort((left, right) => left.tick - right.tick);

  let tempoIndex = 0;
  let previousTick = 0;
  let elapsed = 0;
  let tempo = tempos[0].tempo;
  for (const event of ordered) {
    while (tempoIndex + 1 < tempos.length && tempos[tempoIndex + 1].tick <= event.tick) {
      const nextTempo = tempos[++tempoIndex];
      elapsed += ((nextTempo.tick - previousTick) * tempo) / (division * 1000000);
      previousTick = nextTempo.tick;
      tempo = nextTempo.tempo;
    }
    event.time = elapsed + ((event.tick - previousTick) * tempo) / (division * 1000000);
  }

  const endTick = Math.max(...ordered.map((event) => event.tick), 0);
  while (tempoIndex + 1 < tempos.length && tempos[tempoIndex + 1].tick <= endTick) {
    const nextTempo = tempos[++tempoIndex];
    elapsed += ((nextTempo.tick - previousTick) * tempo) / (division * 1000000);
    previousTick = nextTempo.tick;
    tempo = nextTempo.tempo;
  }
  const duration = elapsed + ((endTick - previousTick) * tempo) / (division * 1000000);
  return { events: ordered.filter((event) => event.kind !== "tempo"), duration };
}

class BrowserMidiPlayer {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
    this.track = "";
    this.tracks = new Map();
    this.channels = Array.from({ length: 16 }, () => ({ program: 0, volume: 100, expression: 127 }));
    this.voices = new Set();
    this.noiseBuffer = null;
    this.playback = null;
    this.scheduleTimer = 0;
    this.requestId = 0;
    this.onError = () => {};
  }

  unlock() {
    try {
      if (!this.context) {
        const AudioContextType = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextType) throw new Error("Este navegador no es compatible con Web Audio.");
        this.context = new AudioContextType();
        this.master = this.context.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") {
        void this.context.resume().catch((error) => this.reportError(error));
      }
    } catch (error) {
      this.reportError(error);
    }
  }

  async loadTrack(name) {
    if (this.tracks.has(name)) return this.tracks.get(name);
    const response = await fetch(new URL(MIDI_FILES[name], import.meta.url));
    if (!response.ok) throw new Error(`No se pudo cargar la pista MIDI ${name} (${response.status}).`);
    const midi = parseMidi(await response.arrayBuffer());
    this.tracks.set(name, midi);
    return midi;
  }

  async playMusic() {
    if (!this.enabled) return;
    const requestId = ++this.requestId;
    this.unlock();
    try {
      await this.context.resume();
      const midi = await this.loadTrack("music");
      if (!this.enabled || requestId !== this.requestId) return;
      this.stopTrack();
      this.track = "music";
      this.startPlayback(midi, true);
    } catch (error) {
      this.reportError(error);
    }
  }

  async playDeath() {
    if (!this.enabled) return;
    const requestId = ++this.requestId;
    this.unlock();
    try {
      await this.context.resume();
      const midi = await this.loadTrack("death");
      if (!this.enabled || requestId !== this.requestId) return;
      this.stopTrack();
      this.track = "death";
      this.startPlayback(midi, false);
    } catch (error) {
      this.reportError(error);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.requestId += 1;
    if (!enabled) this.stopTrack();
  }

  startPlayback(midi, loop) {
    this.channels = Array.from({ length: 16 }, () => ({ program: 0, volume: 100, expression: 127 }));
    this.playback = {
      midi,
      loop,
      startsAt: this.context.currentTime + 0.06,
      eventIndex: 0
    };
    this.pumpPlayback();
    this.scheduleTimer = window.setInterval(() => this.pumpPlayback(), 25);
  }

  pumpPlayback() {
    const playback = this.playback;
    if (!playback) return;
    try {
      const horizon = this.context.currentTime + 0.12;
      while (playback.eventIndex < playback.midi.events.length) {
        const event = playback.midi.events[playback.eventIndex];
        const time = playback.startsAt + event.time;
        if (time > horizon) break;
        playback.eventIndex += 1;
        const channel = this.channels[event.channel];
        if (event.kind === "program") {
          channel.program = event.value;
        } else if (event.kind === "control") {
          if (event.controller === 7) channel.volume = event.value;
          if (event.controller === 11) channel.expression = event.value;
        }
        this.scheduleEvent({
          ...event,
          program: channel.program,
          channelVolume: channel.volume,
          expression: channel.expression
        }, Math.max(this.context.currentTime, time));
      }

      const trackEnd = playback.startsAt + playback.midi.duration;
      if (playback.eventIndex === playback.midi.events.length && this.context.currentTime >= trackEnd) {
        if (playback.loop) {
          playback.startsAt = trackEnd;
          playback.eventIndex = 0;
          this.channels = Array.from({ length: 16 }, () => ({ program: 0, volume: 100, expression: 127 }));
        } else {
          this.playback = null;
          window.clearInterval(this.scheduleTimer);
          this.scheduleTimer = 0;
          this.track = "";
        }
      }
    } catch (error) {
      this.reportError(error);
      this.stopTrack();
    }
  }

  scheduleEvent(event, time) {
    const channel = this.channels[event.channel];
    if (!channel) return;
    if (event.kind === "program") {
      channel.program = event.value;
    } else if (event.kind === "control") {
      if (event.controller === 7) channel.volume = event.value;
      if (event.controller === 11) channel.expression = event.value;
      if (event.controller === 120 || event.controller === 123) {
        for (const voice of [...this.voices]) {
          if (voice.channel === event.channel) this.releaseVoice(voice, time, 0.04);
        }
      }
    } else if (event.kind === "noteOn") {
      this.startVoice(event, time);
    } else if (event.kind === "noteOff") {
      const voice = [...this.voices].find((item) => item.channel === event.channel
        && item.note === event.note && !item.stopped);
      if (voice) this.releaseVoice(voice, time, voice.release);
    }
  }

  startVoice(event, time) {
    const gain = this.context.createGain();
    const level = (event.velocity / 127) * (event.channelVolume / 127) * (event.expression / 127) * 0.16;
    const percussion = event.channel === 9;
    const attack = percussion ? 0.002 : event.program >= 40 && event.program <= 95 ? 0.08 : 0.008;
    const release = percussion ? 0.08 : event.program >= 40 && event.program <= 95 ? 0.22 : 0.1;
    let oscillator;
    if (percussion && event.note !== 35 && event.note !== 36) {
      if (!this.noiseBuffer) {
        this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let index = 0; index < samples.length; index += 1) {
          samples[index] = Math.random() * 2 - 1;
        }
      }
      oscillator = this.context.createBufferSource();
      oscillator.buffer = this.noiseBuffer;
      oscillator.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = event.note >= 42 ? 6500 : 1800;
      filter.connect(gain);
      oscillator.connect(filter);
    } else {
      oscillator = this.context.createOscillator();
      oscillator.type = percussion ? "sine" : waveformFor(event.program);
      oscillator.frequency.value = percussion
        ? 130
        : 440 * (2 ** ((event.note - 69) / 12));
      if (percussion) {
        oscillator.frequency.setValueAtTime(130, time);
        oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.15);
      }
      oscillator.connect(gain);
    }
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(level, time + attack);
    gain.connect(this.master);
    oscillator.start(time);
    const voice = { channel: event.channel, note: event.note, oscillator, gain, release, stopped: false };
    this.voices.add(voice);
    voice.stopTimer = window.setTimeout(() => this.finishVoice(voice),
      Math.max(30000, (time - this.context.currentTime) * 1000 + 30000));
  }

  releaseVoice(voice, time, release) {
    if (!this.voices.has(voice) || voice.stopped) return;
    voice.stopped = true;
    const end = Math.max(time, this.context.currentTime);
    voice.gain.gain.cancelScheduledValues(end);
    voice.gain.gain.setTargetAtTime(0.0001, end, Math.max(0.01, release / 3));
    try {
      voice.oscillator.stop(end + release);
    } catch (error) {
      this.reportError(error);
    }
    window.clearTimeout(voice.stopTimer);
    voice.stopTimer = window.setTimeout(() => this.finishVoice(voice), (end - this.context.currentTime + release) * 1000 + 50);
  }

  finishVoice(voice) {
    window.clearTimeout(voice.stopTimer);
    this.voices.delete(voice);
    try {
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    } catch (error) {
      this.reportError(error);
    }
  }

  stopTrack() {
    window.clearInterval(this.scheduleTimer);
    this.scheduleTimer = 0;
    this.playback = null;
    this.track = "";
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of [...this.voices]) {
      voice.stopped = true;
      window.clearTimeout(voice.stopTimer);
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      try {
        voice.oscillator.stop(now);
      } catch (error) {
        this.reportError(error);
      }
      this.finishVoice(voice);
    }
  }

  reportError(error) {
    console.error("Jump Boy audio failed:", error);
    this.onError(error);
  }
}

export const audio = new BrowserMidiPlayer();
