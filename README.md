# Pokemart Expo Admin

Static GitHub Pages admin app for the Pokemart Expo vendor sheet.

## Setup

1. Open the Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste the contents of `Code.gs`.
4. Deploy it as a web app.
5. Set access to the account that should update the sheet.
6. Copy the web app URL into `config.js` as `scriptUrl`.
7. In the portal spreadsheet, open the `Settings` tab and put the admin access code in `B7`. The admin page will not load sheet contents until that code is entered.

After changing `Code.gs`, create a new Apps Script deployment version so the live web app uses the latest access-code check.

The app can load vendor rows without the Apps Script URL, but saving changes and loading the unused codes tab require the web app.

## Sheet behavior

- The vendor tab is detected by headers containing `Email`, `Tables`, and a Wi-Fi code column.
- The unused codes tab is detected by a tab name containing `Unused` or `Code`.
- Vendor search matches business name, alias, email, table numbers, and Wi-Fi codes.
- Marking a code used grays it out in the app and strikes through that row in the sheet.
- Marking a code unused removes the app gray state and removes strikethrough from that row in the sheet.
- The app reads row strikethrough to decide whether an unused-code entry is currently used; it does not need a `Used` column.
- If an older `Used`, `Is Used`, or `Redeemed` column or old red/green row color exists, the Apps Script migrates it into strikethrough and clears the legacy status styling.
