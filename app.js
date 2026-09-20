const SHEET_ID = "1Wl5Ta7PvSiAaX8VZ9N5Fu2IPd2RBCS3yrOCGYUegzE8";
const FALLBACK_VENDOR_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=0&headers=1`;
const config = window.POKEMART_ADMIN_CONFIG || {};

const state = {
  vendors: [],
  codes: [],
  vendorSearch: "",
  accessCode: window.sessionStorage.getItem("pokemartAdminAccessCode") || "",
  dirtyVendorRows: new Set(),
  dirtyCodeRows: new Set()
};

const elements = {
  accessGate: document.querySelector("#access-gate"),
  adminShell: document.querySelector("#admin-shell"),
  accessForm: document.querySelector("#access-form"),
  accessCode: document.querySelector("#access-code"),
  accessStatus: document.querySelector("#access-status"),
  status: document.querySelector("#status-message"),
  dirtyCount: document.querySelector("#dirty-count"),
  saveButton: document.querySelector("#save-button"),
  refreshButton: document.querySelector("#refresh-button"),
  vendorSearch: document.querySelector("#vendor-search"),
  vendorRows: document.querySelector("#vendor-rows"),
  vendorCount: document.querySelector("#vendor-count"),
  codeList: document.querySelector("#code-list"),
  codeCount: document.querySelector("#code-count"),
  saveForm: document.querySelector("#save-form"),
  saveAccessCode: document.querySelector("#save-access-code"),
  payloadInput: document.querySelector("#payload-input"),
  saveFrame: document.querySelector("#save-frame")
};

elements.adminShell.hidden = true;
elements.accessGate.hidden = false;

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(row, index) {
  const cell = row.c?.[index];
  return repairMojibake(cell?.f ?? cell?.v ?? "");
}

function repairMojibake(value) {
  const text = String(value ?? "");
  if (!/[ÃÂâðï]/.test(text)) {
    return text;
  }

  const cp1252Bytes = {
    "€": 0x80,
    "‚": 0x82,
    "ƒ": 0x83,
    "„": 0x84,
    "…": 0x85,
    "†": 0x86,
    "‡": 0x87,
    "ˆ": 0x88,
    "‰": 0x89,
    "Š": 0x8a,
    "‹": 0x8b,
    "Œ": 0x8c,
    "Ž": 0x8e,
    "‘": 0x91,
    "’": 0x92,
    "“": 0x93,
    "”": 0x94,
    "•": 0x95,
    "–": 0x96,
    "—": 0x97,
    "˜": 0x98,
    "™": 0x99,
    "š": 0x9a,
    "›": 0x9b,
    "œ": 0x9c,
    "ž": 0x9e,
    "Ÿ": 0x9f
  };

  try {
    const bytes = Uint8Array.from([...text].map((char) => cp1252Bytes[char] ?? char.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return text;
  }
}

function rowsFromGoogleTable(table) {
  const headers = (table?.cols || []).map((column) => String(column.label || ""));
  const rows = (table?.rows || [])
    .map((row) => (row.c || []).map((_, index) => cellValue(row, index)))
    .filter((row) => row.some((cell) => cell.trim()));

  return [headers, ...rows];
}

function valueFor(row, headerMap, ...headersToTry) {
  for (const header of headersToTry) {
    const index = headerMap.get(header);
    if (index !== undefined && row[index]) {
      return row[index];
    }
  }

  return "";
}

function vendorsFromRows(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const hasBusinessNameColumn = headerMap.has("businessname");

  return dataRows
    .map((row, index) => ({
      rowNumber: index + 2,
      name: valueFor(row, headerMap, "businessname", "name"),
      alias: hasBusinessNameColumn ? valueFor(row, headerMap, "name") : valueFor(row, headerMap, "alias"),
      email: valueFor(row, headerMap, "email"),
      tables: valueFor(row, headerMap, "tables"),
      wifiCodes: valueFor(row, headerMap, "wifiaccesscodes")
    }))
    .filter((vendor) => vendor.email.trim() || vendor.name.trim());
}

function loadSheetRows(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const previousGoogle = window.google;
    const previousSetResponse = window.google?.visualization?.Query?.setResponse;
    let settled = false;

    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = window.google.visualization.Query || {};

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.remove();

      if (previousSetResponse) {
        window.google.visualization.Query.setResponse = previousSetResponse;
      } else if (previousGoogle) {
        delete window.google.visualization.Query.setResponse;
      } else {
        delete window.google;
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Sheet request timed out"));
    }, timeoutMs);

    window.google.visualization.Query.setResponse = (response) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (response?.status !== "ok") {
        reject(new Error(response?.errors?.[0]?.detailed_message || "Sheet request failed"));
        return;
      }

      resolve(rowsFromGoogleTable(response.table));
    };

    script.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Sheet request failed"));
    };
    script.src = `${url}&cacheBust=${Date.now()}`;
    document.head.append(script);
  });
}

function loadJsonp(url, accessCode, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const callbackName = `pokemartAdmin${Date.now()}${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.remove();
      delete window[callbackName];
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Admin backend request timed out"));
    }, timeoutMs);

    window[callbackName] = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Admin backend request failed"));
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}action=loadAll&accessCode=${encodeURIComponent(accessCode)}&callback=${callbackName}&cacheBust=${Date.now()}`;
    document.head.append(script);
  });
}

async function loadData() {
  setStatus("Loading sheet data...");
  elements.saveButton.disabled = true;

  if (config.scriptUrl) {
    const payload = await loadJsonp(config.scriptUrl, state.accessCode);
    if (!payload.ok) {
      throw new Error(payload.error || "The admin backend could not load sheet data.");
    }
    state.vendors = payload.vendors || [];
    state.codes = payload.codes || [];
  } else {
    const rows = await loadSheetRows(FALLBACK_VENDOR_URL);
    state.vendors = vendorsFromRows(rows);
    state.codes = [];
    setStatus("Loaded vendors in read-only mode. Add your Apps Script web app URL in config.js to edit and load unused codes.");
  }

  state.dirtyVendorRows.clear();
  state.dirtyCodeRows.clear();
  render();
  updateDirtyState();

  if (config.scriptUrl) {
    setStatus("Sheet data loaded.");
  }
}

function setStatus(message) {
  elements.status.textContent = message;
}

function setAccessStatus(message, type = "error") {
  elements.accessStatus.textContent = message;
  elements.accessStatus.className = `access-status ${type === "success" ? "success" : ""}`;
}

function showAccessGate(message = "") {
  elements.adminShell.hidden = true;
  elements.accessGate.hidden = false;
  if (message) {
    setAccessStatus(message);
  }
}

function showAdmin() {
  elements.accessGate.hidden = true;
  elements.adminShell.hidden = false;
}

async function unlockAdmin(accessCode) {
  state.accessCode = accessCode.trim();
  if (!state.accessCode) {
    throw new Error("Enter the admin access code.");
  }

  setAccessStatus("Checking access...", "success");
  await loadData();
  window.sessionStorage.setItem("pokemartAdminAccessCode", state.accessCode);
  showAdmin();
  setAccessStatus("");
}

function updateDirtyState() {
  const count = state.dirtyVendorRows.size + state.dirtyCodeRows.size;
  elements.dirtyCount.textContent = count ? `${count} unsaved change${count === 1 ? "" : "s"}` : "No changes";
  elements.saveButton.disabled = !count || !config.scriptUrl;
}

function markVendorChanged(rowNumber) {
  state.dirtyVendorRows.add(rowNumber);
  updateDirtyState();
  document.querySelector(`[data-vendor-row="${rowNumber}"]`)?.classList.add("changed");
}

function markCodeChanged(rowNumber) {
  state.dirtyCodeRows.add(rowNumber);
  updateDirtyState();
}

function inputCell(value, field, rowNumber, isTextArea = false) {
  const input = document.createElement(isTextArea ? "textarea" : "input");
  input.value = value || "";
  input.dataset.field = field;
  input.dataset.rowNumber = rowNumber;
  if (isTextArea) {
    input.className = "compact-area";
    input.rows = 2;
  }
  input.addEventListener("input", () => {
    const vendor = state.vendors.find((item) => Number(item.rowNumber) === Number(rowNumber));
    if (vendor) {
      vendor[field] = input.value;
      markVendorChanged(rowNumber);
    }
  });
  return input;
}

function renderVendors() {
  elements.vendorRows.replaceChildren();
  const visibleVendors = filteredVendors();
  const total = state.vendors.length;
  const visible = visibleVendors.length;
  elements.vendorCount.textContent = state.vendorSearch
    ? `${visible} of ${total} vendor${total === 1 ? "" : "s"}`
    : `${total} vendor${total === 1 ? "" : "s"}`;

  if (!visibleVendors.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "empty";
    cell.textContent = state.vendors.length ? "No vendors match that search." : "No vendor rows were found.";
    row.append(cell);
    elements.vendorRows.append(row);
    return;
  }

  for (const vendor of visibleVendors) {
    const row = document.createElement("tr");
    row.dataset.vendorRow = vendor.rowNumber;

    const name = document.createElement("td");
    name.className = "vendor-name";
    name.append(inputCell(vendor.name, "name", vendor.rowNumber));

    const email = document.createElement("td");
    email.className = "email";
    email.append(inputCell(vendor.email, "email", vendor.rowNumber));

    const tables = document.createElement("td");
    tables.append(inputCell(vendor.tables, "tables", vendor.rowNumber, true));

    const wifi = document.createElement("td");
    wifi.append(inputCell(vendor.wifiCodes, "wifiCodes", vendor.rowNumber, true));

    row.append(name, email, tables, wifi);
    elements.vendorRows.append(row);
  }
}

function filteredVendors() {
  const terms = state.vendorSearch
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) {
    return state.vendors;
  }

  return state.vendors.filter((vendor) => {
    const haystack = [
      vendor.name,
      vendor.alias,
      vendor.email,
      vendor.tables,
      vendor.wifiCodes
    ].join(" ").toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

function renderCodes() {
  elements.codeList.replaceChildren();
  elements.codeCount.textContent = `${state.codes.length} code${state.codes.length === 1 ? "" : "s"}`;

  if (!state.codes.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = config.scriptUrl
      ? "No code rows were found on the unused codes tab."
      : "Add your Apps Script web app URL in config.js to load unused codes.";
    elements.codeList.append(empty);
    return;
  }

  for (const code of state.codes) {
    const label = document.createElement("label");
    label.className = `code-item ${code.used ? "used" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.title = "Mark used";
    checkbox.checked = Boolean(code.used);
    checkbox.addEventListener("change", () => {
      code.used = checkbox.checked;
      label.classList.toggle("used", code.used);
      markCodeChanged(code.rowNumber);
    });

    const body = document.createElement("span");
    const codeText = document.createElement("span");
    codeText.className = "code-text";
    codeText.textContent = code.code || "Blank code";
    const note = document.createElement("span");
    note.className = "code-note";
    note.textContent = code.note || `Row ${code.rowNumber}`;
    body.append(codeText, note);

    label.append(checkbox, body);
    elements.codeList.append(label);
  }
}

function render() {
  renderVendors();
  renderCodes();
}

function payloadForSave() {
  return {
    vendors: state.vendors.filter((vendor) => state.dirtyVendorRows.has(vendor.rowNumber)),
    codes: state.codes.filter((code) => state.dirtyCodeRows.has(code.rowNumber))
  };
}

function saveChanges() {
  if (!config.scriptUrl) {
    setStatus("Add your Apps Script web app URL in config.js before saving.");
    return;
  }

  elements.payloadInput.value = JSON.stringify(payloadForSave());
  elements.saveAccessCode.value = state.accessCode;
  elements.saveForm.action = config.scriptUrl;
  setStatus("Pushing changes to Google Sheets...");
  elements.saveButton.disabled = true;
  elements.saveForm.submit();
}

elements.saveFrame.addEventListener("load", () => {
  if (!elements.payloadInput.value) {
    return;
  }

  state.dirtyVendorRows.clear();
  state.dirtyCodeRows.clear();
  document.querySelectorAll("tr.changed").forEach((row) => row.classList.remove("changed"));
  elements.payloadInput.value = "";
  updateDirtyState();
  setStatus("Changes sent to Google Sheets. Refresh to confirm the latest sheet values.");
});

elements.saveButton.addEventListener("click", saveChanges);
elements.refreshButton.addEventListener("click", () => {
  loadData().catch((error) => {
    console.error(error);
    setStatus(error.message);
  });
});
elements.accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockAdmin(elements.accessCode.value).catch((error) => {
    console.error(error);
    window.sessionStorage.removeItem("pokemartAdminAccessCode");
    showAccessGate(error.message);
  });
});
elements.vendorSearch.addEventListener("input", () => {
  state.vendorSearch = elements.vendorSearch.value.trim();
  renderVendors();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    const view = tab.dataset.view;
    document.querySelector("#vendors-view").hidden = view !== "vendors";
    document.querySelector("#codes-view").hidden = view !== "codes";
  });
});

if (state.accessCode) {
  elements.accessCode.value = state.accessCode;
  unlockAdmin(state.accessCode).catch((error) => {
    console.error(error);
    window.sessionStorage.removeItem("pokemartAdminAccessCode");
    showAccessGate(error.message);
  });
} else {
  showAccessGate();
}
