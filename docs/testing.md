# Testing

## Automated

| What | Where | Command |
|---|---|---|
| Unit tests (geometry, warp, edit history, viewport maths, export formats, error text) | this repository | `npm test` |
| Lint, 0 errors expected | CloudTAK `app/` | `npx eslint --config eslint.config.js plugins/cloudtak-plugin-rubbersheet/index.ts plugins/cloudtak-plugin-rubbersheet/lib` |
| Type check | CloudTAK `app/` | `npm run check` |

Do not run the CloudTAK `npm test` for this plugin: its test runner picks the plugin up through the folder or symlink and reports "Cannot find module" failures that do not come from the plugin.

## Emulated checks (browser)

Chrome DevTools device mode, touch emulation on, at 360×800, 390×844, 844×390 and a 1280×800 mouse window, in both Light and Dark theme (set from the CloudTAK settings):

* Place an image and an image-based PDF; warp, rotate and move the sheet; Done / Adjust; Move; Remove Sheet (cancel and confirm).
* Edit Image: each of the six tools, Place / Discard / Remove icon, Back with and without edits (Discard prompt), Save.
* Download KMZ, GeoTIFF, GeoPDF and ZIP; Add to Data Sync; Add to Map as Overlay.
* Keyboard only on desktop: Tab stays inside the editor, dialogs open on **Keep editing**, Esc closes them, focus returns to **Edit Image**.
* With the OS setting "Reduce motion" on, the selection outline holds still.

## Panel contract checks
Needs the Weather plugin (or any plugin that follows the panel contract) enabled next to Rubber Sheet. There is no combined automated harness yet, so these are manual. Run them at 390×844 and 844×390 with touch emulation, at 1280×800 with a mouse, in Light and Dark. In each scenario at most one bottom panel is visible and nothing overflows the screen sideways.
* **Minimize.** Place a sheet, drag a corner, Undo once, set opacity 60. Open the Weather panel: the Adjust bar disappears, the handles stay on the map and stay draggable, the Rubber Sheet menu icon shows a dot, its tooltip reads "Rubber Sheet, controls hidden" and a screen reader says "Controls hidden." before the label.
* **Restore on close.** Close Weather (button, then Escape): the bar returns with Undo enabled, opacity 60 and the same Done / Adjust and "Show settings" choice. No restore happens when Weather is not the one that closed.
* **Weather opened second.** Open Weather first, then load a sheet from the pane: Weather closes and the bar shows; the Weather layers stay on the map.
* **Restore from the menu.** Minimize, then tap the Rubber Sheet entry: the pane opens, the bar is back and Weather has closed. Repeat with **Show Adjust bar** in the pane (the notice reads "The Adjust bar is hidden while another plugin is open.").
* **Basemap change.** Minimize, change the basemap (style reload): the bar stays hidden.
* **Remove Sheet while minimized.** The dot clears; closing Weather afterwards does not bring a bar back.
* **Move mode.** Turn Move on, then open Weather: Move is off afterwards and a one-finger drag pans the map.
* **Three plugins.** With a third bottom-panel plugin: one without state that opens after Weather makes Weather close while the bar stays hidden, and closing the third restores the bar. One with state (minimized in turn) restores in reverse order.
* **Disable.** Minimize, then disable and re-enable the plugin that holds the panel open: the bar returns and the dot is gone. Disabling Rubber Sheet while minimized leaves no stuck dot.
* **Alone.** Rubber Sheet alone, and next to a plugin that does not know the contract, behaves as before (no hidden bar).
* **Desktop rail.** The dot shows on the Rubber Sheet icon in the rail. With the entry set to hidden in the menu settings there is no dot; the pane notice still shows.
* **Accessibility.** The dot is not the only signal (title and hidden text). In forced-colors mode the dot stays visible. Keyboard: Tab to the menu entry and press Enter to restore.
Real device: the dot, the pane notice and tap-to-restore on one Android phone and one iPhone.
Headless emulation cannot show real finger size, safe-area insets, native sharing or the CloudTAK apps' login, so the list below needs a person with a device.

## Real-device checklist

Run once per release on at least one Android phone and one iPhone, in the CloudTAK app and in the mobile browser.

- [ ] **Finger size.** All buttons in the Adjust bar, the editor top bar, the tool strip and the zoom buttons can be hit with a thumb without mis-taps. Corner handles can be grabbed on a small sheet.
- [ ] **Corner drag.** The corner rides about 56 px above the fingertip and stays visible; the dot lands where the ring was when you lift the finger.
- [ ] **Move mode.** With Move off, one finger pans the map and a palm resting on the sheet does nothing. With Move on, one finger drags the sheet and two fingers still pan and zoom.
- [ ] **Android hardware Back.** In the editor with no edits it leaves at once; with edits it shows **Discard changes?**; **Keep editing** stays; **Discard** returns to the pane with the sheet unchanged.
- [ ] **iOS and Android safe areas.** The editor top bar clears the notch or status bar, the tool strip clears the home indicator, and the Adjust bar does not sit under the GPS panel in portrait or landscape.
- [ ] **Download.** In the CloudTAK app **Download** opens the share sheet and the file can be saved to Files or sent to another app; cancelling the sheet shows no error. In the mobile browser the file downloads normally. Check KMZ, GeoTIFF, GeoPDF and ZIP.
- [ ] **Login, token and server URL (CloudTAK app).** Signed in against a server other than the app's own origin: **Add to Data Sync** lists syncs and uploads (including a password-protected sync), and **Add to Map as Overlay** imports and shows the overlay. A signed-out app shows the "Not signed in" message for the overlay.
- [ ] **Large PDF and memory.** Open a multi-page, high-resolution PDF and a 12-megapixel photo on an older phone; page picker previews load, the editor opens, and a dozen erases and a Save do not reload the page.
- [ ] **Theme.** Switch Light and Dark in the CloudTAK settings with the editor, the pane, the Adjust bar and every dialog open in turn; nothing is unreadable.
- [ ] **Screen reader.** With VoiceOver or TalkBack: icon-only buttons are announced by name, the editor is announced as a dialog, and the Discard dialog starts on **Keep editing**.
- [ ] **Haptics.** Not used by this plugin (nothing to test).
