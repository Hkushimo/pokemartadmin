const SPREADSHEET_ID = '1Wl5Ta7PvSiAaX8VZ9N5Fu2IPd2RBCS3yrOCGYUegzE8';

function doGet(event) {
  const action = event.parameter.action || 'loadAll';
  const callback = event.parameter.callback || 'callback';
  const payload = action === 'loadAll'
    ? loadAll()
    : { ok: false, error: 'Unknown action.' };

  return jsonp(callback, payload);
}

function doPost(event) {
  const payloadText = event.parameter.payload || '{}';

  try {
    const payload = JSON.parse(payloadText);
    saveAll(payload);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error.message });
  }
}

function loadAll() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vendorSheet = findVendorSheet_(spreadsheet);
    const codeSheet = findCodeSheet_(spreadsheet);

    return {
      ok: true,
      vendors: readVendors_(vendorSheet),
      codes: codeSheet ? readCodes_(codeSheet) : []
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function saveAll(payload) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const vendorSheet = findVendorSheet_(spreadsheet);
  const codeSheet = findCodeSheet_(spreadsheet);

  if (payload.vendors && payload.vendors.length) {
    updateVendors_(vendorSheet, payload.vendors);
  }

  if (payload.codes && payload.codes.length) {
    if (!codeSheet) {
      throw new Error('Could not find an unused codes tab.');
    }
    updateCodes_(codeSheet, payload.codes);
  }
}

function readVendors_(sheet) {
  const values = dataValues_(sheet);
  const headers = values[0] || [];
  const map = headerMap_(headers);
  const businessColumn = firstHeader_(map, ['businessname', 'name']);
  const aliasColumn = map.businessname !== undefined ? firstHeader_(map, ['name']) : firstHeader_(map, ['alias']);
  const emailColumn = firstHeader_(map, ['email']);
  const tablesColumn = firstHeader_(map, ['tables']);
  const wifiColumn = firstHeader_(map, ['wifiaccesscodes', 'wificodes', 'wifi']);

  return values.slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      name: row[businessColumn] || '',
      alias: aliasColumn === undefined ? '' : row[aliasColumn] || '',
      email: row[emailColumn] || '',
      tables: tablesColumn === undefined ? '' : row[tablesColumn] || '',
      wifiCodes: wifiColumn === undefined ? '' : row[wifiColumn] || ''
    }))
    .filter((vendor) => String(vendor.email || vendor.name).trim());
}

function readCodes_(sheet) {
  const values = dataValues_(sheet);
  const headers = values[0] || [];
  const map = headerMap_(headers);
  const codeColumn = firstHeader_(map, ['code', 'wificode', 'wifiaccesscode', 'wifiaccesscodes']) || 0;
  const usedColumn = firstHeader_(map, ['used', 'isused', 'redeemed']);
  const noteColumn = firstHeader_(map, ['note', 'notes', 'assignedto', 'vendor', 'email']);

  return values.slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      code: row[codeColumn] || '',
      used: usedColumn === undefined ? false : truthy_(row[usedColumn]),
      note: noteColumn === undefined ? '' : row[noteColumn] || ''
    }))
    .filter((item) => String(item.code).trim());
}

function updateVendors_(sheet, vendors) {
  const values = dataValues_(sheet);
  const map = headerMap_(values[0] || []);
  const nameColumn = firstHeader_(map, ['businessname', 'name']);
  const emailColumn = firstHeader_(map, ['email']);
  const tablesColumn = firstHeader_(map, ['tables']);
  const wifiColumn = firstHeader_(map, ['wifiaccesscodes', 'wificodes', 'wifi']);

  vendors.forEach((vendor) => {
    const rowNumber = Number(vendor.rowNumber);
    if (!rowNumber || rowNumber < 2) {
      return;
    }

    setCellIfColumn_(sheet, rowNumber, nameColumn, vendor.name);
    setCellIfColumn_(sheet, rowNumber, emailColumn, vendor.email);
    setCellIfColumn_(sheet, rowNumber, tablesColumn, vendor.tables);
    setCellIfColumn_(sheet, rowNumber, wifiColumn, vendor.wifiCodes);
  });
}

function updateCodes_(sheet, codes) {
  const values = dataValues_(sheet);
  const headers = values[0] || [];
  const map = headerMap_(headers);
  const usedColumn = ensureUsedColumn_(sheet, headers, map);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);

  codes.forEach((code) => {
    const rowNumber = Number(code.rowNumber);
    if (!rowNumber || rowNumber < 2) {
      return;
    }

    const used = Boolean(code.used);
    sheet.getRange(rowNumber, usedColumn + 1).setValue(used ? 'TRUE' : '');
    sheet.getRange(rowNumber, 1, 1, lastColumn).setFontLine(used ? 'line-through' : 'none');
  });
}

function findVendorSheet_(spreadsheet) {
  const match = spreadsheet.getSheets().find((sheet) => {
    const headers = firstRow_(sheet).map(normalizeHeader_);
    return headers.includes('email') && headers.some((header) => ['tables', 'wifiaccesscodes', 'wificodes'].includes(header));
  });

  if (!match) {
    throw new Error('Could not find a vendor tab with Email, Tables, and Wi-Fi columns.');
  }

  return match;
}

function findCodeSheet_(spreadsheet) {
  return spreadsheet.getSheets().find((sheet) => {
    const name = normalizeHeader_(sheet.getName());
    const headers = firstRow_(sheet).map(normalizeHeader_);
    return name.includes('unused') || (name.includes('code') && headers.some((header) => header.includes('code')));
  }) || null;
}

function ensureUsedColumn_(sheet, headers, map) {
  const existing = firstHeader_(map, ['used', 'isused', 'redeemed']);
  if (existing !== undefined) {
    return existing;
  }

  const nextColumn = Math.max(headers.length + 1, sheet.getLastColumn() + 1);
  sheet.getRange(1, nextColumn).setValue('Used');
  return nextColumn - 1;
}

function dataValues_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
}

function firstRow_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] || [];
}

function headerMap_(headers) {
  return headers.reduce((map, header, index) => {
    map[normalizeHeader_(header)] = index;
    return map;
  }, {});
}

function firstHeader_(map, names) {
  for (const name of names) {
    if (map[name] !== undefined) {
      return map[name];
    }
  }
  return undefined;
}

function setCellIfColumn_(sheet, rowNumber, columnIndex, value) {
  if (columnIndex === undefined) {
    return;
  }
  sheet.getRange(rowNumber, columnIndex + 1).setValue(value || '');
}

function normalizeHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function truthy_(value) {
  return ['true', 'yes', 'y', '1', 'used'].includes(String(value || '').trim().toLowerCase());
}

function jsonp(callback, payload) {
  const safeCallback = String(callback).replace(/[^\w.$]/g, '');
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
