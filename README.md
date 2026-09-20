# Pokemart Expo Admin

Static GitHub Pages admin app for the Pokemart Expo vendor sheet.

## Setup

1. Open the Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste the contents of `Code.gs`.
4. Deploy it as a web app.
5. Set access to the account that should update the sheet.
6. Copy the web app URL into `config.js` as `scriptUrl`.

The app can load vendor rows without the Apps Script URL, but saving changes and loading the unused codes tab require the web app.

## Sheet behavior

- The vendor tab is detected by headers containing `Email`, `Tables`, and a Wi-Fi code column.
- The unused codes tab is detected by a tab name containing `Unused` or `Code`.
- If the unused codes tab does not have a `Used` column, the Apps Script creates one.
- Marking a code used writes `TRUE`, grays it in the app, and strikes through the row in the sheet.
