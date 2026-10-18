# Rubber Sheet

CloudTAK plugin that stretches an image or PDF over the map, the way ATAK rubber-sheets a floor plan onto a building.

Requires CloudTAK **13.102** or newer. PDF pages are rendered with [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0). The CloudTAK app must have `pdfjs-dist` **4.10.38** as a dependency so the web build can bundle it. `WEB_PLUGINS` only clones the plugin and does not install dependencies, so add `pdfjs-dist` to the app first (see Install).

## What it does
* Open **Rubber Sheet** from the menu and choose a PNG, JPEG, WebP, GIF, or PDF (a multi-page PDF shows a page picker). The sheet is placed north-up in the middle of the view.
* **Warp it** by dragging a corner handle; the round handle rotates. Drag the image to move it (on touch, turn on **Move** first). With a keyboard, hold Shift to scale about the opposite corner or Alt to scale from the center; without one, use **Corner drag** in the pane (Free, Scale corner, Scale center). Undo and Redo are in the pane header and on Ctrl/Cmd+Z and Ctrl+Y.
* **Adjust bar** at the bottom of the map: **Done** (hides the handles so you can pan the map; **Adjust** brings them back), Undo, Redo, Move, **Remove Sheet** and the opacity slider. On a desktop with a mouse only the slider shows. When another plugin opens a bottom panel (for example Weather) the bar steps aside until that panel closes. Plugin authors: see `lib/panel-coordinator.ts` (MIT-0) for the shared panel contract.
* **Edit Image** opens a fullscreen editor with Hand, magic wand, rectangle marquee, eraser, Selective Color and facility **Icons** (first aid, AED, hydrant, shutoffs, hazmat, numbered placards and more). Replace / Add / Subtract controls how selections combine. It works with a mouse or touch (one finger uses the tool, two fingers pan and zoom). **Revert To Original** restores the unedited image, **Save** keeps your map corners, and Back asks before discarding unsaved edits.
* Pick a **Format** (KMZ, GeoTIFF, GeoPDF, or a ZIP of all three), then **Download**, **Add to Data Sync** (data syncs you are subscribed to with write access) or **Add to Map as Overlay** (imported like Files → Add to Map as Overlay).
* KMZ keeps the exact four corners (`gx:LatLonQuad`). GeoTIFF and GeoPDF are north-up copies of the fitted sheet, as those formats cannot store a warp. Images are JPEG quality 85, and pictures with transparency stay PNG in the KMZ.
* On phones images are capped at 2048 px and the editor keeps 10 undo steps (desktop: 4096 px, 40). The layout follows the CloudTAK theme (Light and Dark).
* Desktop keyboard shortcuts in the editor: Space-drag or wheel to pan and zoom, `[` and `]` for brush size, Delete to clear a selection, Ctrl/Cmd+D or Esc to deselect.
* The menu icon is traced from an ATAK-CIV icon (GPL-3.0). See [NOTICE](NOTICE).

## Screenshots

The Rubber Sheet panel with a PDF floor plan placed on the map. The sheet is warped by dragging its corners, and the opacity slider sits at the bottom of the map.

![Rubber Sheet panel with a floor plan placed on the map](docs/screenshots/rubbersheet.png)

Edit Image opens the fullscreen pixel editor, with the wand, rectangle marquee, eraser, selective colour and facility icon tools.

![Edit Image pixel editor](docs/screenshots/rubbersheet-edit.png)

## Install

The plugin is compiled into the CloudTAK web bundle when the CloudTAK image is built. Nothing is installed at runtime.

### TAK-NZ CloudTAK

1. `app/package.json` in [TAK-NZ/CloudTAK](https://github.com/TAK-NZ/CloudTAK) must list `"pdfjs-dist": "4.10.38"` (exact version) and `app/package-lock.json` must match. The Docker build runs `npm ci` before plugins are cloned, so the plugin cannot add it itself.
2. The plugin URL is set per environment in `cdk/cdk.json` as `context.<env>.cloudtak.webPlugins`:
   ```json
   "webPlugins": "https://github.com/TAK-NZ/cloudtak-plugin-rubbersheet.git"
   ```
   `dev-test` installs it. `prod` is empty until it is enabled there. Several plugins can be listed, separated by commas or spaces.
3. Deploy:
   * **Test stack, manual deploy.** Run the normal deploy command from `cdk/`; the value comes from `cdk.json`:
     ```bash
     npm run build && npm run cdk deploy -- \
       --context envType=dev-test \
       --context stackName=Demo \
       --context tak-project="TAK on AWS" \
       --context tak-component="CloudTAK" \
       --context tak-region=us-west-2 \
       --context useS3CloudTAKConfigFile=true \
       --require-approval never
     ```
     Add `--context WebPlugins="<urls>"` to override the list for one deploy (`""` for none). The `WEB_PLUGINS` environment variable works too.
   * **Demo, GitHub CI/CD.** The Demo build reads the `dev-test` value from `cdk/cdk.json`, passes it to the Docker build, and the deploy workflow uses that image. Production uses the `prod` value.
4. Users: **Settings → Refresh App**. A normal browser refresh is not enough because the service worker caches the old app.

The clone takes the default branch (`main`) of this repository with `--depth 1`. A change to this plugin alone does not change the image hash, so it is not picked up by itself: re-run the CI build with `force_rebuild`, or change any file under `api/` or `app/` before a manual CDK deploy.

The image build runs `npm run lint && npm run check` over `app/plugins/`, so the plugin has to pass the CloudTAK app's lint and type checks. Run them locally before pushing a change here (see Local development).

### Any other CloudTAK build (Docker)

1. Add PDF.js to the CloudTAK app and commit `package.json` and the lock file:
   ```bash
   cd app
   npm install --save-exact pdfjs-dist@4.10.38
   ```
2. Build the image with the plugin URL as a build argument:
   ```bash
   docker build -f Dockerfile \
     --build-arg WEB_PLUGINS="https://github.com/TAK-NZ/cloudtak-plugin-rubbersheet.git" \
     -t cloudtak .
   ```
   With docker compose: `docker compose build --build-arg WEB_PLUGINS="https://github.com/TAK-NZ/cloudtak-plugin-rubbersheet.git" api`
3. Restart the container, then **Settings → Refresh App**.

To remove the plugin, take the URL out of `webPlugins` / `WEB_PLUGINS` and rebuild.

### Local development

Clone the plugin directly into the CloudTAK app. `app/plugins/` is ignored by the CloudTAK repository, so this checkout does not affect it:

```bash
git clone https://github.com/TAK-NZ/cloudtak-plugin-rubbersheet.git /path/to/CloudTAK/app/plugins/cloudtak-plugin-rubbersheet
cd /path/to/CloudTAK/app
npm ci
```

Then start the CloudTAK web dev server from `app/` as usual (`npm run serve`) and restart it after adding the plugin.

The plugin has to live physically in `app/plugins/<name>/` to run in the app: `lib/overlay.ts`, `lib/missions.ts` and the other host imports use relative paths such as `../../../src/std.ts`. A symlink at `app/plugins/<name>` works for the host's lint and type check (see below) but not for running the app.

### Run and test
* **Unit tests** (pure logic: geometry, warp, history, viewport maths, export formats), from this repository: `npm test`.
* **Lint and type check** run from the CloudTAK `app/` folder, which is where the host ESLint and `vue-tsc` configuration lives:
  ```bash
  cd /path/to/CloudTAK/app
  npx eslint --config eslint.config.js plugins/cloudtak-plugin-rubbersheet/index.ts plugins/cloudtak-plugin-rubbersheet/lib   # 0 errors expected
  npm run check
  ```
  `npm run lint` in `app/` follows the same rules for a plugin that is a real folder. The image build runs both.
* **Try it on a phone-sized screen** with Chrome DevTools device mode: 360×800, 390×844 and 844×390 (landscape), touch emulation on, both Light and Dark theme. Real-device checks (finger size, Android Back, iOS safe areas, share sheet, login in the CloudTAK apps, large PDFs) are listed in [docs/testing.md](docs/testing.md).
