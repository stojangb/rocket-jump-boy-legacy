import java.io.File;

import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.Sequencer;

import utils.Utils;

/**
 * Tiny MIDI music player used by the game.
 *
 * The original port tried to load the .mid files with
 * {@link javax.sound.sampled.AudioSystem}, which only understands sampled
 * audio (WAV/AU/AIFF) and fails on MIDI. The soundtrack was therefore silent.
 * This version uses a real MIDI sequencer, loops the background music and
 * supports muting from the options menu.
 */
public final class c {
	private static final c e = new c();

	private Sequencer sequencer;
	private Sequence background;
	private Sequence death;
	private String current = "";
	private String lastTrack = "";
	private boolean enabled = true;
	private boolean available;

	private c() {
		try {
			sequencer = MidiSystem.getSequencer();
			sequencer.open();
			background = MidiSystem.getSequence(new File(Utils.res_folder + "/music.mid"));
			death = MidiSystem.getSequence(new File(Utils.res_folder + "/musicDie.mid"));
			available = true;
		} catch (Exception ex) {
			// No MIDI device / missing files: the game keeps working silently.
			System.err.println("Audio disabled: " + ex.getMessage());
			available = false;
			if (sequencer != null) {
				try {
					sequencer.close();
				} catch (Exception ignored) {
				}
				sequencer = null;
			}
		}
	}

	public static void player_death(String var0) {
		e.play(e.death, "musicDie", 1);
	}

	public static void backgroundMusic(String var0) {
		e.play(e.background, "music", Sequencer.LOOP_CONTINUOUSLY);
	}

	public static void a() {
		e.stop();
	}

	/** Called by the options menu when the sound switch is toggled. */
	public static void setEnabled(boolean on) {
		e.enabled = on;
		if (!on) {
			e.pause();
		} else if ("music".equals(e.lastTrack)) {
			e.play(e.background, "music", Sequencer.LOOP_CONTINUOUSLY);
		}
	}

	private synchronized void pause() {
		current = "";
		if (sequencer != null && sequencer.isOpen()) {
			try {
				sequencer.stop();
				sequencer.setTickPosition(0);
			} catch (Exception ignored) {
			}
		}
	}

	private synchronized void play(Sequence sequence, String name, int loops) {
		if (!enabled || !available || sequence == null) {
			return;
		}
		if (name.equals(current) && sequencer.isRunning()) {
			return;
		}
		try {
			sequencer.stop();
			sequencer.setSequence(sequence);
			sequencer.setTickPosition(0);
			sequencer.setLoopCount(loops);
			sequencer.start();
			current = name;
			lastTrack = name;
		} catch (Exception ex) {
			System.err.println("Could not play " + name + ": " + ex.getMessage());
			current = "";
		}
	}

	private synchronized void stop() {
		current = "";
		lastTrack = "";
		if (sequencer != null && sequencer.isOpen()) {
			try {
				sequencer.stop();
				sequencer.setTickPosition(0);
			} catch (Exception ignored) {
			}
		}
	}
}
