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
- Vendor search matches business name, alias, email, table numbers, and Wi-Fi codes.
- Marking a code used formats that code row light red in the sheet.
- Marking a code unused formats that code row light green in the sheet.
- The app reads the row color to decide whether an unused-code entry is currently used; it does not need a `Used` column.
