# Rubber Sheet

CloudTAK plugin that stretches an image or PDF over the map, the way ATAK rubber-sheets a floor plan onto a building.

Requires CloudTAK **13.102** or newer. PDF pages are rendered with [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0). The CloudTAK app must have `pdfjs-dist` **4.10.38** as a dependency so the web build can bundle it. `WEB_PLUGINS` only clones the plugin and does not install dependencies, so add `pdfjs-dist` to the app first (see Install).

## What it does
* Open **Rubber Sheet** from the menu and choose a PNG, JPEG, WebP, GIF, or PDF. A multi-page PDF shows page previews so you can pick which page to use. **Choose a different file** replaces the image.
* The sheet is placed in the center of the current view, north-up, covering about a quarter of the view.
* **Warp it.** Drag a corner handle to move that corner, drag the round handle to rotate. With a mouse, hold Shift to scale about the opposite corner, or Alt (or Shift+Alt) to scale from the center, and drag the image to move it. Ctrl/Cmd+Z undoes a map change; Ctrl+Y or Ctrl/Cmd+Shift+Z redoes. Without a keyboard use **Corner drag** in the pane (Free, Scale corner, Scale center) instead of Shift and Alt.
* **Adjust bar.** On touch devices and small screens a bar at the bottom of the map has **Done**, **Undo**, **Redo**, **Move**, **Remove Sheet** and the opacity slider. **Done** hides the handles and locks the sheet so you can pan and zoom the map freely; **Adjust** brings the handles back. On a desktop with a mouse the bar shows only the opacity slider (scroll the wheel over it to change by 5%). The value is remembered and starts at 100%. When another plugin opens its own panel at the bottom of the map (for example Weather), the Adjust bar is hidden to make room; the sheet, handles, history and opacity stay, a dot appears on the Rubber Sheet menu icon, and the bar returns when the other panel closes, when you open Rubber Sheet from the menu, or with **Show Adjust bar** in the pane. Plugin authors: see `lib/panel-coordinator.ts` (MIT-0) for the shared panel contract.
* **Move mode (touch).** One finger pans the map. Turn on **Move** to drag the whole sheet with one finger; two fingers always pan and zoom the map. While you drag a corner handle with a finger, the corner is held 56 px above your fingertip with a crosshair ring, so your finger does not cover it.
* **Remove Sheet** (pane header, Adjust bar, or the button at the bottom of the pane) asks for confirmation and takes the sheet off the map. Closing the menu leaves the sheet on the map so you can keep working.
* **Edit Image** opens a fullscreen pixel editor on its own page: Hand, magic wand, rectangle marquee, eraser brush, Selective Color (pick a color to select every match), and **Icons** for facility markers (first aid, AED, key box, extinguisher, hose cabinet, standpipe, hydrant, electric/gas/water shutoffs, electrical room, hazmat, and numbered placards 0–20). Delete clears a selection, Match range runs Exact → Loose, and Replace / Add / Subtract chooses how a new selection combines with the old one. **Revert To Original** (with confirm) restores the unedited image from when the sheet was first loaded. **Save** keeps your map corners; **Cancel** discards the edit session. Back (browser or Android) leaves the editor and asks **Discard changes?** when you have unsaved edits.
* **Editor on touch devices.** One finger uses the current tool, two fingers pan and zoom, the Hand tool pans with one finger, and the zoom buttons (+, −, fit) are always there. Double-tap outside the image (or anywhere with the Hand tool) to fit. Tapping with the Icons tool shows a preview: drag it, then tap **Place** or **Discard**; tap a placed icon and **Remove icon** to delete it. The eraser has an **Offset cursor** option that aims above your finger. With a mouse, click places an icon at once and a click on a placed icon removes it.
* **Format** is required for Download / Add to Data Sync: KMZ, GeoTIFF, GeoPDF, or a zipped bundle of all three.
* **Download** saves that file (in the CloudTAK apps it opens the share sheet where the device supports sharing files). **Add to Data Sync** lists the data syncs you are subscribed to with write access (the same list as Files → Share to Data Sync), lets you pick one or more, and uploads the export. A **Close** button appears after a success; it closes the menu and keeps the sheet.
* **Add to Map as Overlay** builds a north-up GeoTIFF, imports it through CloudTAK (same path as Files → Add to Map as Overlay), waits for Cloud Optimized tiles via the PMTiles TileJSON endpoint, and opens the Overlays menu. The live rubber-sheet warp stays editable until you use Remove Sheet.
* **Phones and tablets.** To save memory, images are capped at 2048 px on the long side when loaded, so exports from a phone are at most that size, and the editor keeps 10 undo steps (40 on a desktop, 4096 px). The layout, colors and font follow the CloudTAK theme (Light and Dark).
* **Keyboard shortcuts (desktop only).** Shift / Alt / Shift+Alt while dragging a corner; Ctrl/Cmd+Z, Ctrl+Y and Ctrl/Cmd+Shift+Z for undo and redo (map and editor); in the editor Space-drag or the wheel to pan and zoom, `[` and `]` for brush or icon size, Delete to clear a selection, Ctrl/Cmd+D or Esc to deselect, Esc to clear an icon pick, and Tab to move between controls.
* Imagery is JPEG quality 85. A picture that already has transparent pixels stays PNG inside the KMZ. GeoTIFF and GeoPDF are a north-up copy of the fitted sheet, at most 4096 px on the long side (2048 px from a phone), so they match what you see even though those formats cannot store a four-corner warp. The KMZ keeps the exact corners with a KML `gx:LatLonQuad`.
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

### `install.sh`

`install.sh` is the original installer for a docker-compose based CloudTAK checkout. It copies the plugin into `app/plugins/rubber-sheet/`, adds `pdfjs-dist` to `app/package.json`, and rebuilds the API image with `docker compose`. It is not used for the TAK-NZ deployment.
