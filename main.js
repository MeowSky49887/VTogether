const {
    BrowserWindow,
    WebContentsView,
    app,
    globalShortcut,
    ipcMain
} = require("electron");

const path = require("path");

const spout =
    require("./build/Release/spout.node");


// ========================================
// Server URL
// ========================================

const SERVER_URL = "https://meowverse-collab.vercel.app/";

console.log(
    "Server URL:",
    SERVER_URL
);


// ========================================
// Electron GPU
// ========================================

app.commandLine.appendSwitch(
    "force_high_performance_gpu"
);

app.commandLine.appendSwitch(
    "disable-background-timer-throttling"
);

app.commandLine.appendSwitch(
    "disable-renderer-backgrounding"
);

app.commandLine.appendSwitch(
    "disable-backgrounding-occluded-windows"
);


// ========================================
// Spout
// ========================================

const SPOUT_NAME = "VTogether";


// ========================================
// State
// ========================================

let mainWindow = null;
let mainView = null;

let spoutRunning = false;
let sendTimer = null;
let sending = false;
let destroyed = false;


// ========================================
// Create Window
// ========================================

function createWindow() {

    const win =
        new BrowserWindow({

            width: 1280,

            height: 720,

            minWidth: 800,

            minHeight: 600,

            backgroundColor: "#111",

            webPreferences: {

                devTools: true,

                contextIsolation: true,

                sandbox: false,

                nodeIntegration: false,

                backgroundThrottling: false
            }
        });


    mainWindow = win;


    // ====================================
    // Hide menu bar
    // ====================================

    win.menuBarVisible = false;


    // ====================================
    // WebContentsView
    // ====================================

    const view =
        new WebContentsView({

            webPreferences: {

                devTools: true,

                preload:
                    path.join(
                        __dirname,
                        "preload.js"
                    ),

                contextIsolation: true,

                sandbox: false,

                nodeIntegration: false,

                backgroundThrottling: false
            }
        });


    mainView = view;


    // Transparent View
    view.setBackgroundColor(
        "rgba(0, 0, 0, 0)"
    );


    // ====================================
    // Add View
    // ====================================

    win.contentView.addChildView(
        view
    );


    // ====================================
    // Resize View
    // ====================================

    function resizeView() {

        if (win.isDestroyed()) {
            return {
                width: 0,
                height: 0
            };
        }


        const bounds =
            win.getContentBounds();


        view.setBounds({

            x: 0,

            y: 0,

            width: bounds.width,

            height: bounds.height
        });


        return {

            width: bounds.width,

            height: bounds.height
        };
    }


    resizeView();


    // ====================================
    // Window Resize
    // ====================================

    win.on(
        "resize",
        () => {

            resizeView();

        }
    );


    // ====================================
    // Keyboard shortcuts
    // ====================================

    view.webContents.on(
        "before-input-event",
        (event, input) => {

            // Ctrl + R
            if (
                input.key.toLowerCase() === "r" &&
                input.control &&
                input.type === "keyDown"
            ) {

                event.preventDefault();

                view.webContents.reload();

                return;
            }


            // F12
            if (
                input.key === "F12" &&
                input.type === "keyDown"
            ) {

                event.preventDefault();

                view.webContents.openDevTools();

                return;
            }
        }
    );


    // ====================================
    // Error handling
    // ====================================

    view.webContents.on(
        "did-fail-load",
        (
            event,
            errorCode,
            errorDescription,
            validatedURL
        ) => {

            console.error(
                "Page failed to load:",
                errorCode,
                errorDescription,
                validatedURL
            );
        }
    );


    view.webContents.on(
        "render-process-gone",
        (event, details) => {

            console.error(
                "Renderer process gone:",
                details
            );
        }
    );


    // ====================================
    // Load Server
    // ====================================

    view.webContents.loadURL(
        SERVER_URL
    );


    // ====================================
    // IMPORTANT
    // ====================================
    //
    // ไม่มี createSender() ตรงนี้
    //
    // Electron เปิดมาแล้วจะยังไม่ส่ง Spout
    //
    // ====================================


    // ====================================
    // Window Close
    // ====================================

    win.on(
        "close",
        () => {

            destroyed = true;


            stopSpout();


            try {

                win.contentView.removeChildView(
                    view
                );

            }
            catch (err) {

                console.error(
                    "Remove WebContentsView error:",
                    err
                );
            }


            mainView = null;
            mainWindow = null;
        }
    );


    return win;
}


// ========================================
// Start Spout
// ========================================

function startSpout() {

    if (destroyed) {

        console.warn(
            "[Spout] Cannot start: window destroyed"
        );

        return false;
    }


    if (!mainView) {

        console.warn(
            "[Spout] Cannot start: WebContentsView not ready"
        );

        return false;
    }


    if (spoutRunning) {

        console.log(
            "[Spout] Already running"
        );

        return true;
    }


    // ====================================
    // Get View Size
    // ====================================

    const bounds =
        mainWindow.getContentBounds();


    const width =
        Math.max(
            1,
            Math.floor(bounds.width)
        );


    const height =
        Math.max(
            1,
            Math.floor(bounds.height)
        );


    // ====================================
    // Create Spout Sender
    // ====================================

    try {

        spout.createSender(
            SPOUT_NAME,
            width,
            height
        );

    }
    catch (err) {

        console.error(
            "[Spout] createSender error:",
            err
        );

        return false;
    }


    spoutRunning = true;


    console.log(
        `[Spout] START ${SPOUT_NAME} ${width}x${height}`
    );


    // ====================================
    // Send Frame
    // ====================================

    sendTimer =
        setInterval(
            sendFrame,
            16
        );


    return true;
}


// ========================================
// Stop Spout
// ========================================

function stopSpout() {

    if (!spoutRunning) {

        return true;
    }


    // ====================================
    // Stop timer
    // ====================================

    if (sendTimer !== null) {

        clearInterval(
            sendTimer
        );

        sendTimer = null;
    }


    sending = false;


    // ====================================
    // Release Spout
    // ====================================

    try {

        spout.releaseSender();

    }
    catch (err) {

        console.error(
            "[Spout] releaseSender error:",
            err
        );
    }


    spoutRunning = false;


    console.log(
        "[Spout] STOP"
    );


    return true;
}


// ========================================
// Send Frame
// ========================================

async function sendFrame() {

    if (!spoutRunning)
        return;


    if (destroyed)
        return;


    if (sending)
        return;


    if (!mainView)
        return;


    if (
        mainView.webContents.isDestroyed()
    ) {
        return;
    }


    sending = true;


    try {

        // ==================================
        // Capture เฉพาะ WebContentsView
        // ==================================

        const image =
            await mainView.webContents.capturePage();


        if (!spoutRunning)
            return;


        if (destroyed)
            return;


        const size =
            image.getSize();


        if (
            size.width <= 0 ||
            size.height <= 0
        ) {
            return;
        }


        // ==================================
        // BGRA Bitmap
        // ==================================

        const buffer =
            image.toBitmap();


        // ==================================
        // Send to Spout
        // ==================================

        spout.sendFrame(
            buffer,
            size.width,
            size.height
        );

    }
    catch (err) {

        if (
            !destroyed &&
            spoutRunning
        ) {

            console.error(
                "[Spout] capturePage error:",
                err
            );
        }
    }
    finally {

        sending = false;
    }
}


// ========================================
// IPC: Start
// ========================================

ipcMain.handle(
    "spout:start",
    () => {

        return {
            success: startSpout(),
            running: spoutRunning
        };
    }
);


// ========================================
// IPC: Stop
// ========================================

ipcMain.handle(
    "spout:stop",
    () => {

        return {
            success: stopSpout(),
            running: spoutRunning
        };
    }
);


// ========================================
// IPC: Status
// ========================================

ipcMain.handle(
    "spout:status",
    () => {

        return {
            running: spoutRunning,
            name: SPOUT_NAME
        };
    }
);


// ========================================
// Electron Ready
// ========================================

app.whenReady().then(() => {

    // ====================================
    // Initialize Spout
    // ====================================

    const initialized =
        spout.init();


    if (!initialized) {

        console.error(
            "[Spout] Initialization failed"
        );

        return;
    }


    console.log(
        "[Spout] Initialized"
    );


    // ====================================
    // Create Window
    // ====================================

    createWindow();


    // ====================================
    // macOS
    // ====================================

    app.on(
        "activate",
        () => {

            if (
                BrowserWindow
                    .getAllWindows()
                    .length === 0
            ) {

                destroyed = false;

                createWindow();
            }
        }
    );
});


// ========================================
// Window All Closed
// ========================================

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {

            app.quit();
        }
    }
);


// ========================================
// Quit
// ========================================

app.on(
    "will-quit",
    () => {

        destroyed = true;


        // Stop sender
        stopSpout();


        // Global shortcuts
        try {

            globalShortcut.unregisterAll();

        }
        catch (err) {

            console.error(
                "Shortcut cleanup error:",
                err
            );
        }


        // Native addon
        try {

            spout.release();

        }
        catch (err) {

            console.error(
                "Spout cleanup error:",
                err
            );
        }
    }
);