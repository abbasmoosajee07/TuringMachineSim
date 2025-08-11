// TMStorage.js
'use strict';

const canUseLocalStorage = (() => {
    const testKey = '__tm_storage_test__';
    try {
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
})();

const RAMStorage = (() => {
    let store = {};
    return Object.freeze({
        get length() { return Object.keys(store).length; },
        key: (n) => Object.keys(store)[n] || null,
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, val) => { store[key] = String(val); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    });
})();

const storageBackend = canUseLocalStorage ? localStorage : RAMStorage;

const TMStorage = {
    read: (key) => storageBackend.getItem(key),
    write: (key, value) => storageBackend.setItem(key, value),
    remove: (key) => storageBackend.removeItem(key),
    clear: () => storageBackend.clear()
};

export { TMStorage };
