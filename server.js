const { BrowserWindow, app, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

require('dotenv').config()

let exeDir = path.dirname(app.getPath('exe'));

const sceneFile = path.join(
    exeDir,
    "scene.json"
);

console.log(exeDir);

const web = express();
web.use(cors());

const server = http.createServer(web);

const io = new Server(server, {
    maxHttpBufferSize: 500 * 1024 * 1024
});

const publicPath = path.join(__dirname, "public");

web.use(express.static(publicPath));

web.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

web.use(express.json({
    limit: "500mb"
}));

const rooms = {};
const roomTransforms = {};
const roomImages = {};
const roomBackground = {};

let ownedRoomId = null;
let isSaveScene = false;

function saveScene() {
    if (!ownedRoomId)
        return;

    const scene = {
        roomImages: roomImages[ownedRoomId] || [],
        roomTransforms: roomTransforms[ownedRoomId] || {},
        roomBackground: roomBackground[ownedRoomId] || null
    };

    fs.writeFileSync(
        sceneFile,
        JSON.stringify(scene, null, 2),
        "utf8"
    );

    console.log(
        "Saved scene",
    );
}


function loadScene(roomId, owner) {
    if (!fs.existsSync(sceneFile))
        return;

    try {
        const scene = JSON.parse(
            fs.readFileSync(
                sceneFile,
                "utf8"
            )
        );

        roomImages[roomId] = scene.roomImages || [];
        roomTransforms[roomId] = scene.roomTransforms || {};
        roomBackground[roomId] = scene.roomBackground || null;

        if (scene.roomTransforms["Host"]) {
            roomTransforms[roomId][owner] = scene.roomTransforms["Host"];
            roomTransforms[roomId][owner]["id"] = owner;
            delete roomTransforms[roomId]["Host"];
        }

        for (const [key, value] of Object.entries(roomImages[roomId])) {
            roomImages[roomId][key]["owner"] = owner;
        }

        console.log(
            "Loaded scene"
        );
    }
    catch(err) {
        console.error(
            "Scene load failed:",
            err
        );
    }
}


  
io.on("connection", socket => {
    socket.on(
        "join-room",
        ({ roomId, password, owned, isLoadScene }) => {

        if (!rooms[roomId]) {
            if (!owned) {
                socket.emit(
                    "error-message",
                    "Wait for host"
                );
                return;
            }

            rooms[roomId] = {
                password,
                owner: socket.id,
                users: []
            };

            ownedRoomId = roomId;

            isSaveScene = isLoadScene;
            if (isLoadScene) {
                loadScene(roomId, socket.id);
            }
        }

        if (!roomTransforms[roomId]) {
            roomTransforms[roomId] = {};
        }        
        
        if (!roomImages[roomId]) {
            roomImages[roomId] = [];
        }

        const room = rooms[roomId];

        if (room.password !== password) {
            socket.emit(
                "error-message",
                "Wrong password"
            );
            return;
        }

        if (room.users.length >= 4) {
            socket.emit(
                "error-message",
                "Room is full"
            );
            return;
        }

        room.users.push(socket.id);

        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit(
            "all-transforms",
            roomTransforms[roomId]
        );

        socket.emit(
            "all-users",
            room.users.filter(
                id => id !== socket.id
            )
        );

        socket.emit(
            "all-images",
            roomImages[roomId]
        );

        socket.emit(
            "background-updated",
            roomBackground[roomId]
        );

        socket.to(roomId).emit(
            "user-joined",
            socket.id
        );
    });


    socket.on(
        "upload-image",
        data => {
            if (!socket.roomId)
                return;

            const roomId = socket.roomId;

            if (
                !data.image ||
                !data.image.startsWith("data:image/png")
            ) {
                socket.emit(
                    "error-message",
                    "Only PNG allowed"
                );
                return;
            }

            const image = {
                id: `${socket.id}-${Date.now()}`,
                owner: socket.id,
                data: data.image,
                dropX: data.dropX,
                dropY: data.dropY,
            };

            roomImages[roomId].push(image);

            io.to(roomId).emit(
                "new-image",
                image
            );
        }
    );


    socket.on(
        "delete-image",
        imageId => {
            if (!socket.roomId)
                return;

            const roomId = socket.roomId;

            const images = roomImages[roomId];

            const index = images.findIndex(
                img => img.id === imageId
            );

            if (index === -1)
                return;

            images.splice(index, 1);

            delete roomTransforms[roomId][imageId];

            io.to(roomId).emit(
                "image-deleted",
                imageId
            );
        }
    );


    socket.on(
        "upload-background",
        data => {
            if (!socket.roomId)
                return;

            const roomId = socket.roomId;

            if (
                !data.image ||
                !data.image.startsWith("data:image/png")
            ) {
                socket.emit(
                    "error-message",
                    "Only PNG allowed"
                );
                return;
            }

            roomBackground[roomId] = data.image;

            io.to(roomId).emit(
                "background-updated",
                data.image
            );
        }
    );


    socket.on(
        "signal",
        data => {
            io.to(data.to).emit(
                "signal",
                {
                    from: socket.id,
                    signal: data.signal
                }
            );
        }
    );


    socket.on(
        "edited-transform",
        data => {
            if (!socket.roomId)
                return;

            roomTransforms[socket.roomId][data.id] = data;

            socket.to(socket.roomId).emit(
                "edited-transform",
                data
            );
        }
    );


    socket.on(
        "disconnect",
        () => {
            if (!socket.roomId)
                return;

            const roomId = socket.roomId;
            const room = rooms[roomId];

            if (!room)
                return;

            // Owner left -> kick everyone
            if (room.owner === socket.id) {
                
                room.users.forEach(id => {
                    if (id == room.owner)
                        roomTransforms[roomId]["Host"] = roomTransforms[roomId][id];
                    delete roomTransforms[roomId][id];
                });

                for (const [key, value] of Object.entries(roomImages[roomId])) {
                    if (value.owner != room.owner) {
                        delete roomImages[roomId][key];
                    }
                }

                io.to(roomId).emit(
                    "room-closed",
                    "Host left the room"
                );
                
                if (isSaveScene) {
                    saveScene();
                }

                delete rooms[roomId];
                delete roomTransforms[roomId];
                delete roomImages[roomId];
                delete roomBackground[roomId];

                console.log("session finished")

                return;
            }

            // Normal user left
            room.users =
                room.users.filter(
                    id => id !== socket.id
                );

            socket.to(roomId).emit(
                "user-left",
                socket.id
            );

            if (roomTransforms[roomId]) {
                delete roomTransforms[roomId][socket.id];
            }

            if (room.users.length === 0) {
                delete rooms[roomId];
                delete roomTransforms[roomId];
                delete roomImages[roomId];
                delete roomBackground[roomId];
            }

            console.log("session finished")
        }
    );
});

function getPort() {
    const args = process.argv;

    const index = args.indexOf("--port");

    if (index !== -1 && args[index + 1]) {
        const port = Number(args[index + 1]);

        if (
            Number.isInteger(port) &&
            port >= 1 &&
            port <= 65535
        ) {
            return port;
        }
    }

    return 7860;
}

const PORT = getPort();

server.listen(PORT, "127.0.0.1", () => {
    console.log(`http://localhost:${PORT}`);
});

app.commandLine.appendSwitch(
    "force_high_performance_gpu"
);

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            devTools: true,
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: false,
            nodeIntegration: false,
            backgroundThrottling: false
        }
    });

    win.menuBarVisible = false;

    win.webContents.on('before-input-event', (event, input) => {
        if (
            input.key === 'r' &&
            input.control &&
            input.type === 'keyDown'
        ) {
            win.reload();
        }

        if (
            input.key === 'F12' &&
            input.type === 'keyDown'
        ) {
            win.webContents.openDevTools();
        }
    });

    let isQuitting = false;

    function loadBlankPage() {
        return new Promise((resolve) => {
            if (!win || win.isDestroyed()) {
                resolve();
                return;
            }

            const done = () => {
                win.webContents.removeListener("did-finish-load", done);
                resolve();
            };

            win.webContents.once("did-finish-load", done);
            win.loadURL("about:blank");
        });
    }

    win.on("close", async (event) => {
        if (isQuitting) return;

        event.preventDefault();
        isQuitting = true;

        await loadBlankPage();

        win.destroy();
        app.exit(0);
    });

    ipcMain.handle('ownedURL', async (event) => {return `http://localhost:${PORT}`});

    win.loadURL(`http://localhost:${PORT}`);
});

