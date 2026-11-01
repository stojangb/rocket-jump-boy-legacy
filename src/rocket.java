import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Paths;

import javax.swing.JFrame;

import utils.Utils;
import static javax.swing.JOptionPane.showMessageDialog;
//import javax.microedition.lcdui.Display;
//import javax.microedition.lcdui.Displayable;
//import javax.microedition.midlet.MIDlet;

public class rocket {
	public static rocket a;
	public static boolean b = true;
	private b d;

	public rocket() {
		a = this;
		JFrame frame = new JFrame(windowTitle());
		if (Utils.webMode) {
			// CheerpJ already draws its own window frame around the app.
			frame.setUndecorated(true);
		}
		try {
			java.awt.Image icon = javax.imageio.ImageIO.read(new File(Utils.res_folder + "/rocket.png"));
			if (icon != null) {
				frame.setIconImage(icon);
			}
		} catch (Exception ignored) {
			// The icon is cosmetic only.
		}
		this.d = new b(frame);

		frame.add(d.canvas);
		frame.pack();
		frame.setFocusable(true);
		frame.requestFocus();
		frame.setResizable(false);
		frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frame.setVisible(true);
		frame.setLocationRelativeTo(null);
		frame.addKeyListener(d);
		d.canvas.setFocusable(true);
		d.canvas.requestFocus();
		d.thread.start();
	}

	public static void main(String[] args) throws URISyntaxException {
		boolean web = false;
		if (args != null) {
			for (int i = 0; i < args.length; i++) {
				if ("web".equalsIgnoreCase(args[i])) {
					web = true;
				}
			}
		}
		if (web) {
			Utils.webMode = true;
			Utils.jar_folder = "/app";
			prepareWebResources();
		} else {
			Utils.jar_folder = (getJarDirectory().toString());
			Utils.res_folder = Utils.jar_folder + "/" + "res";
			File directory = new File(Utils.res_folder);
			if (directory.exists() == false) {
				showMessageDialog(null, "resource folder not found at jar location: "+Utils.jar_folder);
				System.exit(0);
			}
		}
		c.setEnabled(true); // pre-load the MIDI soundtrack
		new rocket();
	}
	private static Path getJarDirectory() throws URISyntaxException {
		Path jarPath = Paths.get(rocket.class.getProtectionDomain().getCodeSource().getLocation().toURI())
				.toAbsolutePath();
		return jarPath.getParent();
	}

	/** Bump when the files in res/ change so browsers refresh their copy. */
	private static final String WEB_RES_VERSION = "1";

	/**
	 * Web mode: the game files are embedded in the jar and copied once into the
	 * persistent CheerpJ file system (/files), so the page works from any URL
	 * (including a GitHub Pages project site) without depending on /app.
	 */
	private static void prepareWebResources() {
		Utils.res_folder = "/files/res";
		File dir = new File(Utils.res_folder);
		File stamp = new File(dir, "version.txt");
		if (WEB_RES_VERSION.equals(readText(stamp))) {
			return;
		}
		dir.mkdirs();
		BufferedReader list = null;
		try {
			InputStream listStream = rocket.class.getResourceAsStream("/webfiles.txt");
			if (listStream == null) {
				System.err.println("webfiles.txt missing from the jar");
				return;
			}
			list = new BufferedReader(new InputStreamReader(listStream, "UTF-8"));
			String line;
			while ((line = list.readLine()) != null) {
				line = line.trim();
				if (line.length() == 0 || line.startsWith("#")) {
					continue;
				}
				InputStream in = rocket.class.getResourceAsStream("/res/" + line);
				if (in == null) {
					continue;
				}
				File out = new File(dir, line);
				File parent = out.getParentFile();
				if (parent != null) {
					parent.mkdirs();
				}
				OutputStream os = null;
				try {
					os = new FileOutputStream(out);
					byte[] buffer = new byte[8192];
					int read;
					while ((read = in.read(buffer)) != -1) {
						os.write(buffer, 0, read);
					}
					os.flush();
				} finally {
					closeQuietly(in);
					closeQuietly(os);
				}
			}
			writeText(stamp, WEB_RES_VERSION);
		} catch (Exception e) {
			System.err.println("Could not prepare web resources: " + e.getMessage());
		} finally {
			closeQuietly(list);
		}
	}

	private static String readText(File file) {
		if (!file.isFile()) {
			return null;
		}
		InputStream in = null;
		try {
			in = new FileInputStream(file);
			byte[] data = new byte[(int) file.length()];
			int pos = 0;
			int read;
			while (pos < data.length && (read = in.read(data, pos, data.length - pos)) > 0) {
				pos += read;
			}
			return new String(data, 0, pos, "UTF-8").trim();
		} catch (Exception e) {
			return null;
		} finally {
			closeQuietly(in);
		}
	}

	private static void writeText(File file, String text) {
		OutputStream out = null;
		try {
			out = new FileOutputStream(file);
			out.write(text.getBytes("UTF-8"));
			out.flush();
		} catch (Exception e) {
			System.err.println("Could not write " + file + ": " + e.getMessage());
		} finally {
			closeQuietly(out);
		}
	}

	private static void closeQuietly(java.io.Closeable closeable) {
		if (closeable != null) {
			try {
				closeable.close();
			} catch (Exception ignored) {
			}
		}
	}

	private static String windowTitle() {
		if ("Rocket".equals(System.getProperty("jumpboy.edition"))) {
			return "Jump Boy - Rocket Edited";
		}
		return "Jump Boy";
	}

	public void startApp() {
		a = this;
//      Display.getDisplay(this).setCurrent(this.d);
	}

	public void pauseApp() {
	}

	public void destroyApp(boolean var1) {
//      a.notifyDestroyed();
		a = null;
	}
}
