import type { App } from 'vue';
import { h } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
import MenuTemplate from './lib/MenuTemplate.vue';
import RubberSheetPane from './lib/RubberSheetPane.vue';
import IconUrl from './lib/RubberSheet.svg';
import { MENU_KEY, ROUTE_NAME, ROUTE_PATH } from './lib/constants.ts';
import { bind, clearSheet, detach } from './lib/sheet.ts';

const IconRubberSheet = {
    render: () => h('img', {
        src: IconUrl,
        width: 32,
        height: 32,
        alt: 'Rubber Sheet',
    }),
};

function CancelButton() {
    return h(
        'button',
        {
            type: 'button',
            class: 'btn btn-sm btn-outline-secondary',
            title: 'Cancel rubber sheet',
            onClick: () => {
                void clearSheet();
            },
        },
        'Cancel',
    );
}

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
                    buttons: () => h(CancelButton),
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
