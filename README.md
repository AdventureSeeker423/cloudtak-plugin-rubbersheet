# Rubber Sheet

CloudTAK plugin that stretches an image or PDF over the map, the way ATAK rubber-sheets a floor plan onto a building.

Requires CloudTAK **13.102** or newer. PDF pages are rendered with [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0). The CloudTAK app must have `pdfjs-dist` **4.10.38** as a dependency so the web build can bundle it. `WEB_PLUGINS` only clones the plugin and does not install dependencies, so add `pdfjs-dist` to the app first (see Install).

## What it does

* Open **Rubber Sheet** from the right-side menu and choose a PNG, JPEG, WebP, GIF, or PDF. A multi-page PDF shows page previews so you can pick which page to use.
* The sheet is placed in the center of the current view, north-up, covering about a quarter of the view.
* Drag a corner to warp that corner. Hold Shift to scale about the opposite corner, or Alt (or Shift+Alt) to scale from the center — you can press or release those keys mid-drag to switch modes. Drag the rotate icon to rotate. Drag the image to move it. Ctrl/Cmd+Z undoes a map transform; Ctrl+Y or Ctrl/Cmd+Shift+Z redoes.
* **Edit Image** opens a fullscreen pixel editor: magic wand, rectangle marquee, eraser brush with a live size cursor, Selective Color (pick a color to select every match), and **Icons** for facility markers (first aid, AED, key box, extinguisher, hose cabinet, standpipe, hydrant, electric/gas/water shutoffs, electrical room, hazmat, and numbered placards 0–20 — click again to remove before Save). Marching ants + Delete/Deselect (bottom bar) clear a selection. Match range runs Exact → Loose. Undo/Redo with Ctrl/Cmd+Z and Ctrl+Y (or Ctrl/Cmd+Shift+Z). Revert To Original (with confirm) restores the unedited image from when the sheet was first loaded — that option stays available after Save, and undo/redo stacks are kept across reopen. Save Changes keeps your map corners; Cancel Changes discards the edit session.
* An opacity slider sits at the bottom of the map, from 0% (transparent) to 100% (fully visible). Scroll the wheel over it to change by 5%. It remembers the last value, and starts at 100% the first time.
* **Cancel** in the plugin header clears the sheet. Closing the sidebar leaves the sheet on the map so you can keep editing.
* **Export File Type** is required for Download / Data Sync: KMZ, GeoTIFF, GeoPDF, or a zipped bundle of all three.
* **Download** saves that file. **Upload to Data Sync** lists writable data syncs (same idea as Files → Share to Data Sync — including syncs you can write to even if you are not currently subscribed) and uploads the export.
* **Add to Map as Overlay** builds a north-up GeoTIFF, imports it through CloudTAK (same path as Files → Add to Map as Overlay), waits for Cloud Optimized tiles via the PMTiles TileJSON endpoint, and opens the Overlays menu. The live rubber-sheet warp stays editable until you Cancel/Remove.
* Imagery is JPEG quality 85. A picture that already has transparent pixels stays PNG inside the KMZ. GeoTIFF and GeoPDF are a north-up copy of the fitted sheet, at most 4096 px on the long side, so they match what you see even though those formats cannot store a four-corner warp. The KMZ keeps the exact corners with a KML `gx:LatLonQuad`.

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

Do not use a symlink. `lib/overlay.ts` imports `../../../src/base/overlay.ts` from the CloudTAK app, so the plugin has to live physically in `app/plugins/<name>/`. Before pushing a change, run `npm run lint` and then `npm run check` from `app/`.

### `install.sh`

`install.sh` is the original installer for a docker-compose based CloudTAK checkout. It copies the plugin into `app/plugins/rubber-sheet/`, adds `pdfjs-dist` to `app/package.json`, and rebuilds the API image with `docker compose`. It is not used for the TAK-NZ deployment.
