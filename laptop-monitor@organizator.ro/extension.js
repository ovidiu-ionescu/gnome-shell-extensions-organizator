/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'laptop-monitor-extension';

const { GObject, St } = imports.gi;

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
        item.connect('activate', () => {
            if(imports.ui.main.layoutManager.monitors.length > 1) {
                turnOffSmallestMonitor();
                Main.notify(_('Laptop monitor disabled'));
            } else {
                Main.notify(_('There is only one monitor active'));
            }
        });
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
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}

const GLib = imports.gi.GLib;

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

