# ResQ Devpost gallery

30 finished PNG images in three separate sets of 10.

- Dimensions: **1800 x 1200 pixels** (exact **3:2**).
- Largest file: **1,569,082 bytes / 1.57 MB**, below the supplied **5 MB** limit.
- Format: **PNG**, one of the accepted JPG/PNG/GIF formats.
- Devpost permits **up to 15 images per project gallery**, not 30. Choose across the sets or use the supplied mixed selection.

## Files to use

Open [the visual gallery](index.html) to inspect full-resolution images, or browse the `upload/website`, `upload/volunteer` and `upload/admin` folders. Upload only the individual PNGs, not ZIPs, contact sheets, raw captures or source files.

- `resq-website-devpost-10.zip`: ten website images.
- `resq-volunteer-devpost-10.zip`: ten volunteer mobile app images.
- `resq-admin-devpost-10.zip`: ten coordinator app images.
- `resq-devpost-recommended-15.zip`: an optional mixed gallery with five images from each product.
- `contact-sheet-all.jpg`: a visual overview; separate contact sheets are also included.

Unzip the selected archive, open your Devpost project, choose Project Media, upload up to 15 PNGs, and reorder them to tell the story. Suggested order: website introduction, volunteer workflow, coordinator workflow, Sentinel/Pro context.

## Capture provenance

- **Website:** ten fresh captures of the public Railway staging website on 1 October 2026. Several hero captures use a shorter viewport to focus on complete content rather than empty decorative device frames.
- **Volunteer:** ten existing native Android captures supplied in `volunteer/assets/screenshots/raw/01-today.png` through `10-profile.png`. These are original app UI captures with demonstration data and historical VolunteerOps branding. They are not new screenshots of the current production build. The available Android emulator repeatedly displayed system-level not-responding dialogs, so its failed capture is not included in the finished set.
- **Coordinator:** ten fresh screenshots of the existing isolated Compose web sample bundle, served locally at a desktop viewport. External requests were blocked. These show sample data, the original app header and practice-workspace text; they are not authenticated production acceptance evidence.

Every app card carries an unobtrusive **Sample data** label. Actual screenshot pixels are preserved inside the presentation frames; no operations, maps, subscriptions or personal data were fabricated. The exterior coordinator branding is ResQOps with Papaya `#E4D076` on Ops.

## Design and regeneration

The editable layout is `source/gallery.html`; captions and provenance are in `source/manifest.json`. The render script uses the backend's Playwright installation:

```powershell
node docs/devpost-media/source/render.mjs
node docs/devpost-media/source/contact-sheets.mjs
```

The layout uses the app's Oswald and Overlock fonts, navy/cobalt/Papaya colours, device/browser frames and an AI-generated supporting terrain background. The built-in image-generation tool created only the background; screenshots and product interfaces were not generated. Prompt: premium 3:2 humanitarian coordination background, deep navy #081C36, restrained cobalt contour ribbons, fine Papaya routes, subtle paper grain, quiet left side for typography, no text, logos, devices or user interface. The original background is saved in `source/terrain-background.png`.

`validation.json` records every final file's dimensions, byte size, SHA-256 and source. All 30 images are distinct. Rendering also checks for copy/frame/footer overlap.
