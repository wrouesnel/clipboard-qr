/* Clipboard QR code applet
 * Creates QR code from clipboard content using pure javascript
 *
 * Version 1.0
 *
 * originally by ebbes.ebbes@gmail.com
 * modified by w.rouesnel@gmail.com (fixed drawing on modern Cinnamons)
 *
 * This is some proof-of-concept. I simply wanted to test St.DrawingArea.
 * Additionally, I am planing to code a clipboard manager applet.
 * A QR code creation could be a nice feature to copy your clipboard content to your smartphone.
 * Maybe I'll start coding this manager applet when I'm bored, I already wrote a tiny python script
 * to monitor clipboard changes and send events through dbus. Basically this is what GPaste does.
 * Since I don't like external dependencies for applets very much, I will not use GPaste but my own
 * script instead which will be started by the applet if needed.
*/
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
//const DBus = imports.dbus;

const Main = imports.ui.main;

const AppletDir = imports.ui.appletManager.appletMeta['clipboard-qr@wrouesnel'].path;
imports.ui.searchPath.unshift(AppletDir);
const QRLib = imports.ui.QR;

const QRReaderHelper = 'clipboard-qr.py';

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {
            // Holds the subprocess reference to a zbarimg
            this._qrprocess = null;
        
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            this.set_applet_tooltip(_("Create QR code from clipboard"));
            this.set_applet_icon_symbolic_name('edit-paste-symbolic');

			// The QR code error string
            this._errorString = new PopupMenu.PopupMenuItem('', { reactive: false });
            this.menu.addMenuItem(this._errorString);
            
            // The QR code main window
            this._maincontainer = new St.BoxLayout({ style_class: 'qrappletqrcode' });
            this.menu.addActor(this._maincontainer);
            
            // Add a separator
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            // Add the 'read QR code item'
            this._captureItem = new Applet.MenuItem(_('Read QR Code'), 
            	'', Lang.bind(this, this._launch_qr_reader));
            this.menu.addMenuItem(this._captureItem);

            this._qr = new QRLib.QR(0, this._maincontainer);
            
            this._maincontainer.add_actor(this._qr.actor);

        }
        catch (e) {
            global.logError(e);
        }
    },

    _launch_qr_reader: function () {
        try {
            if (this._qrprocess != null) {
                this._qrprocess = Gio.Subprocess.new(
                    [GLib.build_filenamev([AppletDir,QRReaderHelper]), '/dev/video1'],
                    Gio.SubprocessFlags.STDOUT_PIPE);
                let streamOut = Gio.DataInputStream.new(this._qrprocess.get_stdout_pipe());
                streamOut.read_line_async(0, null, this.on_qr_reader_line);
            }
        } catch (e) {
            global.logError(e);
        }
    },

	on_qr_reader_line: function (obj, aresult) {
        let [lineout, length] = obj.read_line_finish(aresult);

        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(lineout.toString());

        this._qrprocess.force_exit();
        this._qrprocess = null;
	},

    on_applet_clicked: function(event) {
        let clipboard = St.Clipboard.get_default()
            clipboard.get_text(Lang.bind(this,
                function(clipboard, text) {
                    this._qr.set_text(text);
                    this._errorString.label.text = this._qr.error;
                    this.menu.toggle();
                }));
    }
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}

