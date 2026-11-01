import utils.Utils;

//import javax.microedition.rms.RecordComparator;
//import javax.microedition.rms.RecordFilter;
//import javax.microedition.rms.RecordStore;

public final class a {
	int levels_reached;

	public final void loadLevelNo() {
		byte[] data = Utils.readSave();
		this.levels_reached = data.length > 1 ? data[1] : 0;
	}
}
