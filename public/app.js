const socket = io(window.location.host, {
    transports: ["websocket"],
    reconnection: true
});

const scene = document.getElementById("scene");
const hostBtn = document.getElementById("hostBtn");
const spout2Select = document.getElementById("spout2Select");

const peers = {};
const transforms = {};
const videoSettings = {};
const chromaKeys = {};

const mouse = { x: 0, y: 0 };

const hostURL = document.getElementById("hostURL");
const joinBtn = document.getElementById("joinBtn");

const ownedURL = await window.ownedURL();

hostURL.value = window.location;

if (window.location.toString().startsWith(ownedURL)) {
    document.getElementById("boxHeader").innerHTML = "Host Collab Room";
    document.getElementById("hostBtn").innerHTML = "Host";
    document.getElementById("sceneLabel").hidden = false;
    document.getElementById("continueScene").checked = true;
} else {
    document.getElementById("boxHeader").innerHTML = "Join Collab Room";
    document.getElementById("hostBtn").innerHTML = "Join";
    document.getElementById("sceneLabel").hidden = true;
    document.getElementById("continueScene").checked = false;
}

joinBtn.onclick = async () => {
    const url = hostURL.value.trim();

    try {
        const response = await fetch(url, {
            method: "GET",
        });

        if (response.ok) {
            window.location.href = url;
        } else {
            alert(`Server responded with ${response.status}`);
        }
    } catch (err) {
        alert("Unable to reach the server.");
        console.error(err);
    }
};


// ======================
// WebRTC Config
// ======================
const configuration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};


// ======================
// Load Spout2
// ======================
let lastSenders = '';
let currentSender = '';

function refreshSenders() {
	const senders =
		window.spout.getSenders();

	const json =
		JSON.stringify(senders);

	if (json === lastSenders)
		return;

	lastSenders = json;

	const current =
		spout2Select.value;

	spout2Select.innerHTML = '';

	for (const s of senders) {
		const option =
			document.createElement('option');

		option.value = s;
		option.textContent = s;

		spout2Select.appendChild(option);
	}

	if (senders.includes(current))
		spout2Select.value = current;

    if (currentSender == '') {
        window.spout.setSender(
            spout2Select.value
        );
        currentSender = spout2Select.value;
    }
}

spout2Select.addEventListener(
    'input',
    () => {
        window.spout.setSender(
            spout2Select.value
        );
        currentSender = spout2Select.value;
    }
);

refreshSenders();

setInterval(
    refreshSenders,
    1000
);

const colorPicker = document.getElementById('chromaColor');

const videoCanvas = document.getElementById('videoCanvas');
const mainVideo = document.getElementById('mainVideo');
const mainCanvas = document.getElementById('mainCanvas');
const previewChroma = new ChromaKey(mainVideo, mainCanvas);

let localStream = null;

const STORAGE_KEY = "localVideoSettings";

let localVideoSettings = JSON.parse(
    localStorage.getItem(STORAGE_KEY)
) || {};

function loadLocalVideoSettings() {
    const settings = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
    );

    if (!settings) return;

    for (const [key, value] of Object.entries(settings)) {
        const input = document.getElementById(key);
        if (input) {
            input.value = value;
        }
    }

    console.log(settings);

    localVideoSettings = settings;
}

loadLocalVideoSettings();

function updateLocalVideoSettings() {
    localVideoSettings = {
        chromaColor: document.getElementById("chromaColor").value,
        chromaThreshold: Number(document.getElementById("chromaThreshold").value),
        chromaSmoothness: Number(document.getElementById("chromaSmoothness").value),
        cropLeft: Number(document.getElementById("cropLeft").value),
        cropRight: Number(document.getElementById("cropRight").value),
        cropTop: Number(document.getElementById("cropTop").value),
        cropBottom: Number(document.getElementById("cropBottom").value),
    };

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(localVideoSettings)
    );

    const { r, g, b } = hexToRgb(localVideoSettings["chromaColor"])
    previewChroma.setKey({
        r: r,
        g: g,
        b: b, 
        threshold: localVideoSettings["chromaThreshold"],
        smoothness: localVideoSettings["chromaSmoothness"],
    });

    mainCanvas.style.clipPath =
        `inset(${localVideoSettings["cropTop"]}px ${localVideoSettings["cropRight"]}px ${localVideoSettings["cropBottom"]}px ${localVideoSettings["cropLeft"]}px)`;
}

// Initialize once
updateLocalVideoSettings();

// Add listeners
[
    "chromaColor",
    "chromaThreshold",
    "chromaSmoothness",
    "cropLeft",
    "cropRight",
    "cropTop",
    "cropBottom"
].forEach(id => {
    document
        .getElementById(id)
        .addEventListener("input", updateLocalVideoSettings);
});

const ctx = videoCanvas.getContext('2d');

const stream = videoCanvas.captureStream(60); 
mainVideo.srcObject = stream; 
mainVideo.play();

const tmpCanvas = document.createElement('canvas');
const tmpCtx = tmpCanvas.getContext('2d');

function render() {
	const frame = window.spout.receiveFrame();

	if (
		frame &&
		frame.data &&
		frame.width > 0 &&
		frame.height > 0 &&
		frame.data.length === frame.width * frame.height * 4
	) {
		if (
			videoCanvas.width !== frame.width ||
			videoCanvas.height !== frame.height
		) {
			videoCanvas.width = frame.width;
			videoCanvas.height = frame.height;

			tmpCanvas.width = frame.width;
			tmpCanvas.height = frame.height;

            previewChroma.resize(frame.width, frame.height);
		}

		try {
			const imageData = new ImageData(
				new Uint8ClampedArray(frame.data),
				frame.width,
				frame.height
			);

			tmpCtx.putImageData(
				imageData,
				0,
				0
			);

			ctx.fillStyle = colorPicker.value;

			ctx.fillRect(
				0,
				0,
				videoCanvas.width,
				videoCanvas.height
			);

			ctx.drawImage(
				tmpCanvas,
				0,
				0
			);
		}
		catch (err) {
			console.error("Frame decode error:", err);
		}
	}
	else if (frame) {
		console.warn(
			"Invalid Spout frame:",
			frame.width,
			frame.height,
			frame.data?.length
		);
	}

	requestAnimationFrame(render);
}

render();


// ======================
// Join Room
// ======================
hostBtn.onclick = async () => {
    const roomId = "Main";

    const password = document.getElementById("password").value.trim() || "";

    const continueScene = document.getElementById("continueScene").checked;

    try {
        localStream = videoCanvas.captureStream(60);

        console.log(window.location.toString().startsWith(ownedURL), window.location.toString(), ownedURL);

        socket.emit("join-room", {
            roomId,
            password,
            owned: window.location.toString().startsWith(ownedURL),
            isLoadScene: continueScene
        });

        document.getElementById(
            "scrollBox"
        ).style.display = "none";
    } catch (e) {
        console.error(e);
        alert("Could not access camera.");
    }
};


// ======================
// Socket Events
// ======================
socket.on("error-message", msg => {
    alert(msg);
});

socket.on("all-users", async users => {
    if (
        !document.getElementById(`box-${socket.id}`)
    ) {
        createLocalVideo();
    }

    for (const id of users) {
        await createPeer(id, true);
    }
});

socket.on("user-joined", async id => {
    await createPeer(id, false);
});

socket.on("signal", async ({
    from,
    signal
}) => {
    let pc = peers[from];

    if (!pc) {
        pc = await createPeer(from, false);
    }

    try {
        if (signal.type === "offer") {
            await pc.setRemoteDescription(
                new RTCSessionDescription(signal)
            );

            const answer =
                await pc.createAnswer();

            await pc.setLocalDescription(
                answer
            );

            socket.emit("signal", {
                to: from,
                signal: answer
            });
        } else if (signal.type === "answer") {
            await pc.setRemoteDescription(
                new RTCSessionDescription(signal)
            );
        } else if (signal.candidate) {
            await pc.addIceCandidate(
                new RTCIceCandidate(signal)
            );
        }
    } catch (e) {
        console.error(e);
    }
});

socket.on("user-left", id => {
    if (peers[id]) {
        peers[id].close();
        delete peers[id];
        delete transforms[id];
        delete videoSettings[id];
        delete chromaKeys[id];
    }

    const box =
        document.getElementById(`box-${id}`);

    if (box) {
        box.remove();
    }
});

socket.on(
    "room-closed",
    message => {
        alert(message);

        window.location.href = ownedURL;
    }
);


// ======================
// WebRTC
// ======================
async function createPeer(
    id,
    initiator
) {
    if (peers[id]) {
        return peers[id];
    }

  const pc =
        new RTCPeerConnection(
            configuration
        );

  peers[id] = pc;

    localStream.getTracks().forEach(
        track => {
            pc.addTrack(
                track,
                localStream
            );
        }
    );

    const sender = pc
        .getSenders()
        .find(s => s.track?.kind === "video");

    if (sender) {
        const params = sender.getParameters();

        if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
        }

        params.encodings[0].maxBitrate = 12000000; // 12 Mbps
        params.encodings[0].scaleResolutionDownBy = 1;
        params.encodings[0].maxFramerate = 30;

        params.degradationPreference =
            "maintain-resolution";

        await sender.setParameters(params);
    }

    pc.ontrack = e => {
        addRemoteVideo(
            id,
            e.streams[0]
        );
    };

    pc.onicecandidate = e => {
        if (e.candidate) {
            socket.emit("signal", {
                to: id,
                signal: e.candidate
            });
        }
    };

    if (initiator) {
        createOffer(id);
    }

    return pc;
}

async function createOffer(id) {
    const pc = peers[id];

    const offer =
        await pc.createOffer();

    await pc.setLocalDescription(
        offer
    );

    socket.emit("signal", {
        to: id,
        signal: offer
    });
}


// ======================
// Videos
// ======================
function createLocalVideo() {
    createVideoBox(
        socket.id,
        localStream
    );
}

function addRemoteVideo(
    id,
    stream
) {
    let box =
        document.getElementById(
            `box-${id}`
        );

    if (!box) {
        box = createVideoBox(
            id,
            stream
        );
    }

    const video = box.querySelector("video");

    video.srcObject = stream;
}

function createVideoBox(
    id,
    stream
) {
    let box =
    document.getElementById(
      `box-${id}`
    );

    if (box) return box;

    box = document.createElement("div");

    box.className = "video-box";
    box.id = `box-${id}`;

    if (!transforms[id]) {
        transforms[id] = {
            id,
            locked: false,
            x: 100,
            y: 100,
            scale: 1,
            rotation: 0,
            z: highestZ() + 1
        };
    }

    if (!videoSettings[id]) {
        videoSettings[id] = {
            chromaColor:
                document.getElementById(
                    "chromaColor"
                ).value,

            chromaThreshold:
                Number(
                    document.getElementById(
                        "chromaThreshold"
                    ).value
                ),

            chromaSmoothness:
                Number(
                    document.getElementById(
                        "chromaSmoothness"
                    ).value
                ),

            cropLeft:
                Number(
                    document.getElementById(
                        "cropLeft"
                    ).value
                ),

            cropRight:
                Number(
                    document.getElementById(
                        "cropRight"
                    ).value
                ),

            cropTop:
                Number(
                    document.getElementById(
                        "cropTop"
                    ).value
                ),

            cropBottom:
                Number(
                    document.getElementById(
                        "cropBottom"
                    ).value
                )
        };
    }

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");

    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    box.appendChild(video);
    box.appendChild(canvas);
    scene.appendChild(box);

    if (!chromaKeys[id]) {
        chromaKeys[id] = new ChromaKey(video, canvas)
    }

    video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        console.log(
            video.videoWidth,
            video.videoHeight
        );
    });

    enableDrag(box, id, "video");

    applyEditedTransform(id);
    applyEditedVideoSettings(id);

    return box;
}


// ======================
// Video Transform
// ======================
function applyEditedTransform(id) {
    const box =
        document.getElementById(
            `box-${id}`
        );

    if (!box) return;

    if (!transforms[id]) {
        transforms[id] = {
            id,
            locked: false,
            x: 100,
            y: 100,
            scale: 1,
            rotation: 0,
            z: 1
        };
    }

    const t = transforms[id];

    box.style.left = t.x + "px";
    box.style.top = t.y + "px";

    box.style.zIndex = t.z;

    box.style.transform =
        `scale(${t.scale})
        rotate(${t.rotation}deg)`;
}

function sendEditedTransform(id) {
    socket.emit(
        "edited-transform",
        {
            id,
            ...transforms[id]
        }
    );
}

function highestZ() {
    return Math.max(
        0,
        ...Object.values(transforms).map(t => t.z || 0)
    );
}

function lowestZ() {
    return Math.min(
        0,
        ...Object.values(transforms).map(t => t.z || 0)
    );
}


// ======================
// Drag
// ======================
function bringForward(id) {
    const currentZ = transforms[id].z;

    let otherId = null;
    let nearestHigherZ = Infinity;

    for (const [k, t] of Object.entries(transforms)) {
        if (k === id) continue;

        if (t.z > currentZ && t.z < nearestHigherZ) {
            nearestHigherZ = t.z;
            otherId = k;
        }
    }
    
    if (otherId == null) return;

    const tmp = transforms[id].z;
    transforms[id].z = transforms[otherId].z;
    transforms[otherId].z = tmp;

    applyEditedTransform(id);
    sendEditedTransform(id);

    applyEditedTransform(otherId);
    sendEditedTransform(otherId);
}

function sendBackward(id) {
    const currentZ = transforms[id].z;

    let otherId = null;
    let nearestLowerZ = -Infinity;

    for (const [k, t] of Object.entries(transforms)) {
        if (k === id) continue;

        if (t.z < currentZ && t.z > nearestLowerZ) {
            nearestLowerZ = t.z;
            otherId = k;
        }
    }

    if (otherId == null) return;

    const tmp = transforms[id].z;
    transforms[id].z = transforms[otherId].z;
    transforms[otherId].z = tmp;

    applyEditedTransform(id);
    sendEditedTransform(id);

    applyEditedTransform(otherId);
    sendEditedTransform(otherId);
}

function enableDrag(box, id, type) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    
    let alpha;

    const canvas = box.querySelector("canvas");

    box.addEventListener(
        "pointerdown",
        e => {
            const t =
                transforms[id];

            if (!t.locked && alpha != 0) {
                dragging = true;

                offsetX =
                    e.clientX -
                    transforms[id].x;

                offsetY =
                    e.clientY -
                    transforms[id].y;

                box.setPointerCapture(
                    e.pointerId
                );
            }
        }
    );

    box.addEventListener(
        "pointermove",
        e => {
            if (!dragging) return;

            const t =
                transforms[id];

            t.x = e.clientX - offsetX;

            t.y = e.clientY - offsetY;

            applyEditedTransform(id);
            sendEditedTransform(id);
        }
    );

    box.addEventListener(
        "pointerup",
        () => {
            dragging = false;
        }
    );

    box.addEventListener(
        "wheel",
        e => {
            e.preventDefault();

            const t =
                transforms[id];

            if (!t.locked && alpha != 0) {
                if (e.altKey) {
                    t.rotation +=
                        e.deltaY > 0
                            ? 5
                            : -5;
                } else {
                    t.scale +=
                        e.deltaY > 0
                            ? -0.1
                            : 0.1;

                    t.scale = Math.max(
                        0.2,
                        Math.min(
                            5,
                            t.scale
                        )
                    );
                }

                applyEditedTransform(id);
                sendEditedTransform(id);
            }
        },
        {
            passive: false
        }
    );

    box.addEventListener(
    "mousedown",
        e => {
            const t = 
                transforms[id];

            if (e.button == 1) {
                e.preventDefault();

                if (!t.locked && alpha != 0) {
                    if (e.altKey) {
                        sendBackward(id);
                    } else {
                        bringForward(id);
                    }
                }
            } else if (e.button == 2) {
                e.preventDefault();

                if (e.altKey) {
                    if (type == "image") {
                        socket.emit(
                            "delete-image",
                            id
                        );
                    }
                } else {
                    t.locked = !t.locked;

                    applyEditedTransform(id);
                    sendEditedTransform(id);
                }
            }
        }
    );

    document.addEventListener(
        "auxclick",
        e => {
            e.preventDefault();
        }
    );

    document.addEventListener(
        "contextmenu", 
        e => {
            e.preventDefault();
        }
    );

    document.addEventListener(
        "pointermove",
        e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            
            if (canvas) {
                if (type == "video") {
                    const rect = canvas.getBoundingClientRect();

                    if (rect.width === 0 || rect.height === 0) return;

                    const x = Math.floor((mouse.x - rect.left) * canvas.width / rect.width);
                    const y = Math.floor((mouse.y - rect.top) * canvas.height / rect.height);

                    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

                    const px = Math.max(0, Math.min(canvas.width - 1, x));
                    const py = Math.max(0, Math.min(canvas.height - 1, y));

                    const scaleX =  canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;

                    const cropLeft = videoSettings[id]["cropLeft"] * scaleX;
                    const cropRight = videoSettings[id]["cropRight"] * scaleX;
                    const cropTop = videoSettings[id]["cropTop"] * scaleY;
                    const cropBottom = videoSettings[id]["cropBottom"] * scaleY;

                    const insideClipPath =
                        px >= cropLeft &&
                        px <= canvas.width - cropRight &&
                        py >= cropTop &&
                        py <= canvas.height - cropBottom;

                    alpha = 0;

                    if (insideClipPath) {
                        alpha = chromaKeys[id].checkAlpha(px, py);
                    }
                } else if (type == "image") {
                    const ctx = canvas.getContext("2d");
                    const rect = canvas.getBoundingClientRect();

                    if (rect.width === 0 || rect.height === 0) return;

                    const x = Math.floor((mouse.x - rect.left) * canvas.width / rect.width);
                    const y = Math.floor((mouse.y - rect.top) * canvas.height / rect.height);

                    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

                    const px = Math.max(0, Math.min(canvas.width - 1, x));
                    const py = Math.max(0, Math.min(canvas.height - 1, y));

                    const pixel = ctx.getImageData(px, py, 1, 1).data;
                    alpha = pixel[3];
                }

                if (alpha == 0) {
                    box.style.pointerEvents = "none"
                } else {
                    box.style.pointerEvents = "auto"
                }
            }
        }
    );
}


// ======================
// Video Chroma Key
// ======================
function sendEditedVideoSettings(id) {
    socket.emit(
        "edited-video-settings",
        {
            id,
            ...videoSettings[id]
        }
    );
}

function applyEditedVideoSettings(id) {
    if (chromaKeys[id]) {
        const { r, g, b } = hexToRgb(videoSettings[id]["chromaColor"])
        chromaKeys[id].setKey({
            r: r,
            g: g,
            b: b, 
            threshold: videoSettings[id]["chromaThreshold"],
            smoothness: videoSettings[id]["chromaSmoothness"],
        });
    }

    const box =
        document.getElementById(
            `box-${id}`
        );

    const video = box.querySelector("canvas");

    video.style.clipPath =
        `inset(${videoSettings[id]["cropTop"]}px ${videoSettings[id]["cropRight"]}px ${videoSettings[id]["cropBottom"]}px ${videoSettings[id]["cropLeft"]}px)`;
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");

    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
    };
}


// ======================
// Props Sync
// ======================
function addImage(image)
{
    let box =
    document.getElementById(
      `box-${image.id}`
    );

    if (box) return box;

    box = document.createElement("div");

    box.className = "image-box";
    box.id = `box-${image.id}`;

    if (!transforms[image.id]) {
        transforms[image.id] = {
            locked: false,
            x: image.dropX,
            y: image.dropY,
            scale: 1,
            rotation: 0,
            z: highestZ() + 1
        };
    }

    const img = document.createElement("img");
    const canvas = document.createElement("canvas");

    img.src = image.data;
    const ctx = canvas.getContext('2d');

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };

    box.appendChild(img);
    box.appendChild(canvas);
    scene.appendChild(box);

    enableDrag(box, image.id, "image");

    applyEditedTransform(image.id);

    return box;
}

socket.on(
    "all-images",
    (images)=>{
        images.forEach(addImage);
    }
);

socket.on(
    "new-image",
    (image)=>{
        addImage(image);
    }
);

socket.on(
    "image-deleted",
    id => {
        const img =
            document.getElementById(`box-${id}`);

        if(img)
            img.remove();

        delete transforms[id];
    }
);

scene.addEventListener(
    "dragover",
    (e)=>{
        e.preventDefault();
    }
);

scene.addEventListener(
    "drop",
    (e)=>{
        e.preventDefault();

        const file =
        e.dataTransfer.files[0];

        if(!file)
            return;

        if(file.type !== "image/png")
        {
            alert(
                "PNG only"
            );
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const img = new Image();

            img.onload = () => {
                socket.emit("upload-image", {
                    image: reader.result,
                    dropX: mouse.x - img.width / 2,
                    dropY: mouse.y - img.height / 2
                });
            };

            img.src = reader.result;
        };

        reader.readAsDataURL(file);
    }
);


// ======================
// Sync Video Settings
// ======================
socket.on(
    "edited-video-settings",
    data => {
        videoSettings[data.id] = data;

        const box =
            document.getElementById(
                `box-${data.id}`
            );

        if (!box) return;

        applyEditedVideoSettings(data.id);
    }
);

socket.on(
    "all-video-settings",
    data => {
        Object.assign(
            videoSettings,
            data
        );
    }
);


// ======================
// Sync Transforms
// ======================
socket.on(
    "edited-transform",
    data => {
        transforms[data.id] = data;

        const box =
            document.getElementById(
                `box-${data.id}`
            );

        if (!box) return;

        applyEditedTransform(data.id);
    }
);

socket.on(
    "all-transforms",
    data => {
        Object.assign(
            transforms,
            data
        );
    }
);


// ======================
// Background
// ======================
const menu = document.getElementById("menuPopup");

document.addEventListener(
    "keydown",
    e => {
        if (
            e.ctrlKey &&
            e.key === "\\"
        ) {
            e.preventDefault();
            
            if (localStream) {
                menu.classList.toggle(
                    "show"
                );      
            }
        }
    }
);

document
    .getElementById("menuBtn")
    .onclick = () => {
        menu.classList.toggle(
            "show"
        );
    };

const backgroundInput =
    document.getElementById("backgroundInput");

backgroundInput.addEventListener(
    "change",
    e => {
        const file =
            e.target.files[0];

        if (!file)
            return;

        if(file.type !== "image/png")
        {
            alert(
                "PNG only"
            );
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            socket.emit("upload-background", {
                image: reader.result
            });
        };

        reader.readAsDataURL(file);
    }
);

socket.on(
    "background-updated",
    image => {
        scene.style.backgroundImage =
            `url(${image})`;
        scene.style.backgroundSize =
            "cover";
        scene.style.backgroundPosition =
            "center";
    }
);
