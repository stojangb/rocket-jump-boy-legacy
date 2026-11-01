package utils;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class Utils {


	public static String jar_folder = null;
	public static String res_folder = null;

	/**
	 * True when the game runs inside the browser build (CheerpJ). In that mode
	 * resources live under /app/res and the save file lives in the persistent
	 * /files directory instead of next to the jar.
	 */
	public static boolean webMode = false;

	/** Size of the progress file (language, max level and five high scores). */
	public static final int SAVE_SIZE = 22;

	/** Where the progress file is stored for the current platform. */
	public static String savePath() {
		if (webMode) {
			return "/files/jumpboy-save.bin";
		}
		return res_folder + "/data/data.bin";
	}

	/**
	 * Reads the progress file. Always returns a full-size array: a missing or
	 * short file becomes zeroes instead of throwing.
	 */
	public static byte[] readSave() {
		byte[] data = new byte[SAVE_SIZE];
		File file = new File(savePath());
		if (!file.exists()) {
			return data;
		}
		InputStream in = null;
		try {
			in = new FileInputStream(file);
			int pos = 0;
			int read;
			while (pos < data.length && (read = in.read(data, pos, data.length - pos)) > 0) {
				pos += read;
			}
		} catch (Exception e) {
			System.err.println("Could not read save data: " + e.getMessage());
		} finally {
			if (in != null) {
				try {
					in.close();
				} catch (IOException ignored) {
				}
			}
		}
		return data;
	}

	/** Writes the progress file, creating its folder if needed. */
	public static void writeSave(byte[] data) {
		File file = new File(savePath());
		File parent = file.getParentFile();
		if (parent != null && !parent.exists()) {
			parent.mkdirs();
		}
		FileOutputStream out = null;
		try {
			out = new FileOutputStream(file);
			out.write(data);
			out.flush();
		} catch (Exception e) {
			System.err.println("Could not write save data: " + e.getMessage());
		} finally {
			if (out != null) {
				try {
					out.close();
				} catch (IOException ignored) {
				}
			}
		}
	}

	public static InputStream deepCopy(InputStream inputStream) throws IOException {
		long past = System.currentTimeMillis();
		ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
		byte[] buffer = new byte[1024];
		int bytesRead;
		while ((bytesRead = inputStream.read(buffer)) != -1) {
			byteArrayOutputStream.write(buffer, 0, bytesRead);
		}
		return new ByteArrayInputStream(byteArrayOutputStream.toByteArray());
	}
}
