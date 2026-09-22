const { contextBridge, ipcRenderer } = require('electron');
const spout = require('./build/Release/spout.node');

spout.init();

contextBridge.exposeInMainWorld(
    'spout',
    spout
);

contextBridge.exposeInMainWorld('ownedURL', () => ipcRenderer.invoke('ownedURL'));
