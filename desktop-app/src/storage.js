export const getStorage = (key) => {
  if (window.electronAPI) return window.electronAPI.getStore(key);
  return localStorage.getItem(key);
};

export const setStorage = (key, val) => {
  if (window.electronAPI) window.electronAPI.setStore(key, val);
  localStorage.setItem(key, val);
};

export const removeStorage = (key) => {
  if (window.electronAPI) window.electronAPI.removeStore(key);
  localStorage.removeItem(key);
};
