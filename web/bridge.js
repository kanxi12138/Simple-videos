(function registerBridge(root) {
  'use strict';
  const listeners = new Set();
  const pending = new Map();
  let nextId = 0;
  root.nativeResponse = (id, response) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timeout);
    if (response.error) entry.reject(new Error(response.error));
    else entry.resolve(response.result);
  };
  root.nativeEvent = (event) => listeners.forEach((listener) => listener(event));
  root.VideoBridge = {
    request: (command, payload = {}) => {
      if (!root.AndroidBridge) return Promise.reject(new Error('请在简视频 Android 应用中打开'));
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error('官网响应超时，请重试'));
        }, 65000);
        pending.set(id, { resolve, reject, timeout });
        root.AndroidBridge.request(JSON.stringify({ id, command, payload }));
      });
    },
    onEvent: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}(globalThis));
