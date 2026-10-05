'use strict';

(function (root) {
  function parishName(value) {
    let name = String(value || '').trim();
    let previous;
    do {
      previous = name;
      name = name.replace(/^(?:parroquia\s+de\s+|parroquia\s*:\s*)/i, '').trim();
    } while (name !== previous);
    // Never replace a name with an empty string if it consists only of a prefix.
    return name || String(value || '').trim();
  }

  function cleanRecords(parishes, addresses) {
    let changed = 0;
    const clean = (record, key) => {
      if (!record || typeof record[key] !== 'string') return;
      const normalized = parishName(record[key]);
      if (normalized !== record[key]) { record[key] = normalized; changed++; }
    };
    for (const parish of parishes) clean(parish, 'name');
    for (const address of addresses) {
      clean(address, 'recipientName');
      clean(address.parishSnapshot, 'name');
    }
    return changed;
  }

  function migrateStoredRecords(storage, parishes, addresses, keys) {
    const p = JSON.parse(JSON.stringify(parishes));
    const a = JSON.parse(JSON.stringify(addresses));
    const changed = cleanRecords(p, a);
    if (!changed) return 0;
    const backupKey = 'domicilios_respaldo_nombres_1_1_1';
    if (!storage.getItem(backupKey)) {
      storage.setItem(backupKey, JSON.stringify({ parishes, addresses }));
    }
    storage.setItem(keys.parishes, JSON.stringify(p));
    storage.setItem(keys.addresses, JSON.stringify(a));
    cleanRecords(parishes, addresses);
    return changed;
  }

  const api = { parishName, cleanRecords, migrateStoredRecords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EnvelopeNames = api;
})(typeof window === 'undefined' ? globalThis : window);
