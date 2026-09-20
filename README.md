# Pokemart Expo Admin

Static Cloudflare Pages admin app for the Pokemart Expo vendor sheet.

## Setup

1. Create a Cloudflare Pages project from this repo.
2. Set the build command to blank and the output directory to `/`.
3. Add a custom domain for the admin site, such as `admin.pokemartexpo.com`.
4. Add Cloudflare Pages environment variables:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
5. Open the Google Sheet.
6. Go to `Extensions > Apps Script`.
7. Paste the contents of `Code.gs`.
8. Deploy it as a web app.
9. Set access to the account that should update the sheet.
10. Copy the web app URL into `config.js` as `scriptUrl`.

After changing `Code.gs`, create a new Apps Script deployment version so the live web app uses the latest backend code.

Cloudflare Pages middleware protects the admin site with HTTP Basic Auth, which creates the browser username/password popup before the app loads.

The app can load vendor rows without the Apps Script URL, but saving changes and loading the unused codes tab require the web app.

## Sheet behavior

- The vendor tab is detected by headers containing `Email`, `Tables`, and a Wi-Fi code column.
- The unused codes tab is detected by a tab name containing `Unused` or `Code`.
- Vendor search matches business name, alias, email, table numbers, and Wi-Fi codes.
- Marking a code used grays it out in the app and strikes through that row in the sheet.
- Marking a code unused removes the app gray state and removes strikethrough from that row in the sheet.
- The app reads row strikethrough to decide whether an unused-code entry is currently used; it does not need a `Used` column.
- If an older `Used`, `Is Used`, or `Redeemed` column or old red/green row color exists, the Apps Script migrates it into strikethrough and clears the legacy status styling.
