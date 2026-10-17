import type { App } from 'vue';
import { h } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
import HeaderButtons from './lib/HeaderButtons.vue';
// Host component (the plugin is built inside app/plugins/<name>/, like lib/overlay.ts).
import MenuTemplate from '../../src/components/CloudTAK/util/MenuTemplate.vue';
import RubberSheetPane from './lib/RubberSheetPane.vue';
import { IconRubberSheet } from './lib/icon.ts';
import { MENU_KEY, ROUTE_NAME, ROUTE_PATH } from './lib/constants.ts';
import { bind, detach } from './lib/sheet.ts';

export default class RubberSheet implements PluginInstance {
    api: PluginAPI;

    constructor(api: PluginAPI) {
        this.api = api;

        // Routes stay registered. CloudTAK calls disable() before enable() on load,
        // and removing the route there makes the following menu.add fail.
        this.api.routes.add({
            path: ROUTE_PATH,
            name: ROUTE_NAME,
            component: {
                render: () => h(MenuTemplate, { name: 'Rubber Sheet', back: false }, {
                    default: () => h(RubberSheetPane, { api: this.api }),
                    buttons: () => h(HeaderButtons, { api: this.api }),
                }),
            },
        }, 'home-menu');
    }

    static async install(app: App, api: PluginAPI): Promise<PluginInstance> {
        void app;
        return new RubberSheet(api);
    }

    async enable(): Promise<void> {
        bind(this.api);
        this.api.menu.add({
            key: MENU_KEY,
            label: 'Rubber Sheet',
            route: ROUTE_NAME,
            tooltip: 'Rubber Sheet',
            description: 'Stretch an image or PDF over the map',
            icon: IconRubberSheet,
        });
    }

    async disable(): Promise<void> {
        detach();
        try {
            this.api.menu.remove(MENU_KEY);
        } catch {
            // The menu item is already gone.
        }
    }
}
