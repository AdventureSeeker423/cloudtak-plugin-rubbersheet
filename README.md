# Rubber Sheet

CloudTAK plugin that stretches an image or PDF over the map, the way ATAK rubber-sheets a floor plan onto a building.

Requires CloudTAK **13.102** or newer. PDF pages are rendered with [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0). The installer adds that library to the CloudTAK app so the web build can bundle it. Do not rely on `WEB_PLUGINS` alone: that clone does not install PDF.js.

## What it does

* Open **Rubber Sheet** from the right-side menu and choose a PNG, JPEG, WebP, GIF, or PDF. A multi-page PDF shows page previews so you can pick which page to use.
* The sheet is placed in the center of the current view, north-up, covering about a quarter of the view.
* Drag a corner to warp that corner. Shift-drag a corner to scale the whole sheet about the opposite corner. Alt-drag (or Shift+Alt) to scale from the center. Drag the blue knob to rotate. Drag the image to move it.
* An opacity slider sits at the bottom of the map, from 0% (transparent) to 100% (fully visible). Scroll the wheel over it to change by 5%. It remembers the last value, and starts at 100% the first time.
* **Cancel** in the plugin header clears the sheet. Closing the sidebar leaves the sheet on the map so you can keep editing.
* **Export File Type** is required: KMZ, GeoTIFF, GeoPDF, or a zipped bundle of all three.
* **Download** saves that file. **Upload to Data Sync** attaches it to a data sync you are subscribed to and can edit.
* Imagery is JPEG quality 85. A picture that already has transparent pixels stays PNG inside the KMZ. GeoTIFF and GeoPDF are a north-up copy of the fitted sheet, at most 4096 px on the long side, so they match what you see even though those formats cannot store a four-corner warp. The KMZ keeps the exact corners with a KML `gx:LatLonQuad`.

## Install

```bash
git clone https://github.com/AdventureSeeker423/cloudtak-plugin-rubbersheet.git
cd cloudtak-plugin-rubbersheet
./install.sh
```

Or pass the CloudTAK path:

```bash
./install.sh /path/to/CloudTAK
```

The script finds CloudTAK at `$CLOUDTAK`, `~/CloudTAK`, `/home/takwerx/CloudTAK`, or `/home/*/CloudTAK`. Before copying, it fetches the latest `main` from GitHub. If you run it from a marketplace copy (no plugin `.git`), it clones GitHub into a temp dir so the install is not stuck on stale files. Then it copies into `app/plugins/rubber-sheet/`, adds `pdfjs-dist` to the CloudTAK app if it is missing, and rebuilds the API image.

After it finishes: **Settings → Refresh App**. A normal browser refresh is not enough.

```bash
./install.sh --remove
```

### Local development

Symlink this checkout to `CloudTAK/app/plugins/rubber-sheet`. From the CloudTAK `app` directory, install PDF.js if it is not already there (`npm install pdfjs-dist@4.10.38 --save`), then restart `npm run serve`.

`@tak-ps/cloudtak` in this repo's `package.json` points at `../../../CloudTAK/app` for types. Change that path if your CloudTAK checkout lives somewhere else.
