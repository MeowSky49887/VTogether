const { contextBridge, ipcRenderer } = require('electron');
const spout = require('./build/Release/spout.node');

spout.init();

contextBridge.exposeInMainWorld(
    'spout',
    spout
);

contextBridge.exposeInMainWorld(
    "electronAPI",
    {

        // ================================
        // Start Spout
        // ================================

        startSpout: () => {

            return ipcRenderer.invoke(
                "spout:start"
            );
        },


        // ================================
        // Stop Spout
        // ================================

        stopSpout: () => {

            return ipcRenderer.invoke(
                "spout:stop"
            );
        },


        // ================================
        // Status
        // ================================

        getSpoutStatus: () => {

            return ipcRenderer.invoke(
                "spout:status"
            );
        }

    }
);
