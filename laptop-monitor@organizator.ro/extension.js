/* exported init */

const GETTEXT_DOMAIN = 'laptop-monitor-extension';

const { GObject, St, Meta, Shell } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _ = ExtensionUtils.gettext;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('My Shiny Indicator'));

        this.add_child(new St.Icon({
            icon_name: 'preferences-desktop-display-symbolic',
            style_class: 'system-status-icon',
        }));

        let item = new PopupMenu.PopupMenuItem(_('Disable laptop monitor'));
        item.connect('activate', disableLaptopMonitor);
        this.menu.addMenuItem(item);
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
      this._addKeybinding();
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
      this._removeKeybinding();
    }

    _addKeybinding() {
        Main.wm.addKeybinding(
            'disable-laptop-monitor',
            // if the schema is not specified, it uses the content of settings-schema from metadata.json
            // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/extensions/sharedInternals.js#L92
            ExtensionUtils.getSettings(),
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            () => disableLaptopMonitor()
        );
    }

    _removeKeybinding() {
      Main.wm.removeKeybinding('disable-laptop-monitor');
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}

const GLib = imports.gi.GLib;

function disableLaptopMonitor() {
  if(imports.ui.main.layoutManager.monitors.length > 1) {
    turnOffSmallestMonitor();
    Main.notify(_('Laptop monitor disabled'));
  } else {
    Main.notify(_('There is only one monitor active'));
  }
}

function turnOffSmallestMonitor() {
    try {
        // Get monitor data in one call
        const [success, stdout, stderr, exitCode] = 
            GLib.spawn_command_line_sync('xrandr --listactivemonitors');
        
        if (exitCode !== 0) {
            throw new Error(`xrandr failed: ${new TextDecoder().decode(stderr)}`);
        }

        // Process output in JavaScript
        const output = new TextDecoder().decode(stdout);
        let smallestWidth = Infinity;
        let smallestMonitor = null;

        output.split('\n').forEach(line => {
            // Match monitor lines (e.g.: " 0: +*DP-2 1920/344x1080/194+0+0  DP-2")
            const match = line.match(/^\s*\d+:\s+\+.*?(\S+)\/(\d+)x.*?(\S+)$/);
            
            if (match) {
                const [_, resolution, physWidth, monitorName] = match;
                const width = parseInt(physWidth);

                if (width < smallestWidth) {
                    smallestWidth = width;
                    smallestMonitor = monitorName;
                }
            }
        });

        if (!smallestMonitor) {
            throw new Error('No monitors found');
        }

        // Turn off the smallest monitor
        const [cmdSuccess, cmdOut, cmdErr] = 
            GLib.spawn_command_line_sync(`xrandr --output ${smallestMonitor} --off`);
        
        if (cmdErr) {
            throw new Error(`Disable failed: ${new TextDecoder().decode(cmdErr)}`);
        }

        log(`Turned off monitor: ${smallestMonitor}`);
        return true;

    } catch (e) {
        logError(e, 'Monitor control error');
        return false;
    }
}

