const socket = io(window.location.host, {
    transports: ["websocket"],
    reconnection: true
});

const scene = document.getElementById("scene");
const hostBtn = document.getElementById("hostBtn");
const spout2Select = document.getElementById("spout2Select");

const peers = {};
const transforms = {};

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
// Spout2
// ======================
let lastSenders = '';
let currentSender = '';

function refreshSenders() {
    const senders = window.spout.getSenders();

    const json = JSON.stringify(senders);

    if (json === lastSenders)
        return;

    lastSenders = json;

    const current = spout2Select.value;

    spout2Select.innerHTML = '';

    for (const s of senders) {
        const option = document.createElement('option');

        option.value = s;
        option.textContent = s;

        spout2Select.appendChild(option);
    }

    if (senders.includes(current)) {
        spout2Select.value = current;
    }

    if (currentSender === '' && spout2Select.value) {
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

const videoCanvas = document.getElementById("videoCanvas");
const mainVideo = document.getElementById("mainVideo");
const mainCanvas = document.getElementById("mainCanvas");

// ======================
// RGBA -> two WebRTC tracks
// ======================
const ctx = videoCanvas.getContext(
    "2d",
    {
        alpha: true,
        willReadFrequently: true
    }
);

// Alpha-only canvas.
//
// This canvas is intentionally OPAQUE.
// The alpha value from Spout becomes
// grayscale:
//
// source alpha 0   -> black
// source alpha 255 -> white
//
const alphaCanvas = document.createElement("canvas");
const alphaCtx = alphaCanvas.getContext(
    "2d",
    {
        alpha: false,
        willReadFrequently: true
    }
);

// Temporary canvas used to upload the
// Spout RGBA frame.
const tmpCanvas = document.createElement("canvas");
const tmpCtx = tmpCanvas.getContext(
    "2d",
    {
        alpha: true,
        willReadFrequently: true
    }
);

// Capture BOTH canvases.
//
// colorStream:
//     original RGB image
//
// alphaStream:
//     grayscale alpha mask
//
const colorStream = videoCanvas.captureStream(60);
const alphaStream = alphaCanvas.captureStream(60);

const localColorTrack = colorStream.getVideoTracks()[0];
const localAlphaTrack = alphaStream.getVideoTracks()[0];

// Keep main preview working.
mainVideo.srcObject = colorStream;
mainVideo.muted = true;
mainVideo.playsInline = true;
mainVideo.play().catch(() => {});

// The local scene canvas is updated directly
// from videoCanvas. This preserves alpha locally.
const localSceneCanvases = new Set();


// ======================
// Spout render
// ======================
function render() {
    let frame = null;

    try {
        frame = window.spout.receiveFrame();
    } catch (err) {
        console.error(
            "Spout receiveFrame error:",
            err
        );
    }

    if (
        frame &&
        frame.data &&
        frame.width > 0 &&
        frame.height > 0 &&
        frame.data.length ===
            frame.width *
            frame.height *
            4
    ) {
        if (
            videoCanvas.width !== frame.width ||
            videoCanvas.height !== frame.height
        ) {
            videoCanvas.width = frame.width;
            videoCanvas.height = frame.height;

            alphaCanvas.width = frame.width;
            alphaCanvas.height = frame.height;

            tmpCanvas.width = frame.width;
            tmpCanvas.height = frame.height;
        }

        try {
            const rgba =
                new Uint8ClampedArray(
                    frame.data
                );

            const imageData =
                new ImageData(
                    rgba,
                    frame.width,
                    frame.height
                );

            // --------------------------------
            // Color canvas
            // --------------------------------
            tmpCtx.putImageData(
                imageData,
                0,
                0
            );

            ctx.clearRect(
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

            // --------------------------------
            // Alpha canvas
            // --------------------------------
            const alphaImageData =
                alphaCtx.createImageData(
                    frame.width,
                    frame.height
                );

            const alphaData =
                alphaImageData.data;

            let src = 3;

            for (
                let i = 0;
                i < alphaData.length;
                i += 4
            ) {
                const a = rgba[src];

                alphaData[i] = a;
                alphaData[i + 1] = a;
                alphaData[i + 2] = a;

                // Alpha video itself must be opaque.
                alphaData[i + 3] = 255;

                src += 4;
            }

            alphaCtx.putImageData(
                alphaImageData,
                0,
                0
            );

            // --------------------------------
            // Update local scene canvases
            // --------------------------------
            for (const canvas of localSceneCanvases) {
                if (
                    canvas.width !== frame.width ||
                    canvas.height !== frame.height
                ) {
                    canvas.width = frame.width;
                    canvas.height = frame.height;
                }

                const localCtx =
                    canvas.getContext(
                        "2d",
                        {
                            alpha: true
                        }
                    );

                localCtx.clearRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                localCtx.drawImage(
                    videoCanvas,
                    0,
                    0
                );
            }
        } catch (err) {
            console.error(
                "Frame decode error:",
                err
            );
        }
    }

    requestAnimationFrame(render);
}

render();


// ======================
// WebRTC state
// ======================

// Track information arrives through Socket.IO
// because the receiver must know which track
// is color and which is alpha.
const remoteTrackInfo = {};

// Tracks can arrive before track-info.
const pendingRemoteTracks = {};

// ICE can arrive before remoteDescription.
const pendingIceCandidates = {};


// ======================
// Configure sender
// ======================
async function configureSender(
    sender,
    maxBitrate
) {
    if (!sender || !sender.track)
        return;

    try {
        const params =
            sender.getParameters();

        if (
            !params.encodings ||
            params.encodings.length === 0
        ) {
            params.encodings = [{}];
        }

        params.encodings[0].maxBitrate =
            maxBitrate;

        params.encodings[0]
            .scaleResolutionDownBy = 1;

        params.encodings[0]
            .maxFramerate = 30;

        params.degradationPreference =
            "maintain-resolution";

        await sender.setParameters(
            params
        );
    } catch (err) {
        console.warn(
            "Could not configure sender:",
            err
        );
    }
}


// ======================
// Join Room
// ======================
let localStream = colorStream;

hostBtn.onclick = async () => {
    const roomId = "Main";

    const password =
        document
            .getElementById("password")
            .value
            .trim() || "";

    const continueScene =
        document
            .getElementById("continueScene")
            .checked;

    try {
        localStream = colorStream;

        console.log(
            window.location
                .toString()
                .startsWith(ownedURL),

            window.location.toString(),

            ownedURL
        );

        socket.emit(
            "join-room",
            {
                roomId,
                password,

                owned:
                    window.location
                        .toString()
                        .startsWith(
                            ownedURL
                        ),

                isLoadScene:
                    continueScene
            }
        );

        document.getElementById(
            "scrollBox"
        ).style.display = "none";
    } catch (e) {
        console.error(e);

        alert(
            "Could not access video source."
        );
    }
};


// ======================
// Socket Events
// ======================

socket.on(
    "error-message",
    msg => {
        alert(msg);
    }
);


socket.on(
    "all-users",
    async users => {
        if (
            !document.getElementById(
                `box-${socket.id}`
            )
        ) {
            createLocalVideo();
        }

        for (const id of users) {
            await createPeer(
                id,
                true
            );
        }
    }
);


socket.on(
    "user-joined",
    async id => {
        await createPeer(
            id,
            false
        );
    }
);


// ======================
// WebRTC signaling
// ======================
socket.on(
    "signal",
    async ({
        from,
        signal
    }) => {
        let pc = peers[from];

        if (!pc) {
            pc = await createPeer(
                from,
                false
            );
        }

        try {
            // --------------------------------
            // Track metadata
            // --------------------------------
            if (
                signal.type ===
                "track-info"
            ) {
                remoteTrackInfo[from] = {
                    colorTrackId:
                        signal.colorTrackId,

                    alphaTrackId:
                        signal.alphaTrackId
                };

                processPendingRemoteTracks(
                    from
                );

                return;
            }

            // --------------------------------
            // Offer
            // --------------------------------
            if (
                signal.type ===
                "offer"
            ) {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        signal
                    )
                );

                await flushIceCandidates(
                    from
                );

                const answer =
                    await pc.createAnswer();

                await pc.setLocalDescription(
                    answer
                );

                socket.emit(
                    "signal",
                    {
                        to: from,
                        signal:
                            pc.localDescription
                    }
                );

                return;
            }

            // --------------------------------
            // Answer
            // --------------------------------
            if (
                signal.type ===
                "answer"
            ) {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        signal
                    )
                );

                await flushIceCandidates(
                    from
                );

                return;
            }

            // --------------------------------
            // ICE
            // --------------------------------
            if (signal.candidate) {

                if (
                    pc.remoteDescription &&
                    pc.remoteDescription.type
                ) {
                    await pc.addIceCandidate(
                        new RTCIceCandidate(
                            signal
                        )
                    );
                } else {
                    if (
                        !pendingIceCandidates[
                            from
                        ]
                    ) {
                        pendingIceCandidates[
                            from
                        ] = [];
                    }

                    pendingIceCandidates[
                        from
                    ].push(signal);
                }

                return;
            }
        } catch (e) {
            console.error(
                "WebRTC signaling error:",
                e
            );
        }
    }
);


// ======================
// Flush queued ICE
// ======================
async function flushIceCandidates(
    id
) {
    const pc = peers[id];

    if (!pc)
        return;

    const list =
        pendingIceCandidates[id];

    if (!list)
        return;

    delete pendingIceCandidates[id];

    for (const candidate of list) {
        try {
            await pc.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );
        } catch (err) {
            console.error(
                "ICE candidate error:",
                err
            );
        }
    }
}


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

    // --------------------------------
    // Add COLOR track
    // --------------------------------
    pc.addTrack(
        localColorTrack,
        colorStream
    );

    // --------------------------------
    // Add ALPHA track
    // --------------------------------
    pc.addTrack(
        localAlphaTrack,
        alphaStream
    );

    // --------------------------------
    // Configure both tracks
    // --------------------------------
    const senders =
        pc.getSenders();

    const colorSender =
        senders.find(
            sender =>
                sender.track ===
                localColorTrack
        );

    const alphaSender =
        senders.find(
            sender =>
                sender.track ===
                localAlphaTrack
        );

    await configureSender(
        colorSender,
        12000000
    );

    await configureSender(
        alphaSender,
        4000000
    );

    // --------------------------------
    // Send track mapping
    // --------------------------------
    socket.emit(
        "signal",
        {
            to: id,

            signal: {
                type: "track-info",

                colorTrackId:
                    localColorTrack.id,

                alphaTrackId:
                    localAlphaTrack.id
            }
        }
    );

    // --------------------------------
    // Receive tracks
    // --------------------------------
    pc.ontrack = e => {
        console.log(
            "REMOTE TRACK RECEIVED",
            id,
            e.track.kind,
            e.track.id,
            e.streams?.[0]?.id
        );

        if (!pendingRemoteTracks[id]) {
            pendingRemoteTracks[id] = [];
        }

        // Avoid duplicates.
        if (
            !pendingRemoteTracks[id].some(
                track =>
                    track.id === e.track.id
            )
        ) {
            pendingRemoteTracks[id].push(
                e.track
            );
        }

        processPendingRemoteTracks(id);
    };

    // --------------------------------
    // ICE
    // --------------------------------
    pc.onicecandidate = e => {
        if (!e.candidate)
            return;

        socket.emit(
            "signal",
            {
                to: id,

                signal:
                    e.candidate
            }
        );
    };

    // --------------------------------
    // Connection state
    // --------------------------------
    pc.onconnectionstatechange = () => {
        console.log(
            "Peer",
            id,
            "state:",
            pc.connectionState
        );
    };

    // --------------------------------
    // Offer
    // --------------------------------
    if (initiator) {
        await createOffer(id);
    }

    return pc;
}


// ======================
// Process remote tracks
// ======================
function processPendingRemoteTracks(id) {
    const tracks = pendingRemoteTracks[id];

    if (!tracks || tracks.length === 0) {
        return;
    }

    let box =
        document.getElementById(`box-${id}`);

    if (!box) {
        box = createRemoteVideoBox(id);
    }

    const state =
        box._transparentState;

    if (!state) {
        return;
    }

    /*
     * Normally track-info tells us which is
     * COLOR and which is ALPHA.
     *
     * But if track-info isn't forwarded by the
     * Socket.IO server, fall back to the order
     * in which our two tracks were added:
     *
     *   track 0 = color
     *   track 1 = alpha
     */
    const info = remoteTrackInfo[id];

    let colorTrack = null;
    let alphaTrack = null;

    // First try explicit track-info.
    if (info) {
        for (const track of tracks) {
            if (
                track.id ===
                info.colorTrackId
            ) {
                colorTrack = track;
            }

            if (
                track.id ===
                info.alphaTrackId
            ) {
                alphaTrack = track;
            }
        }
    }

    // Fallback if track-info wasn't received.
    if (!colorTrack && !alphaTrack) {
        if (tracks.length >= 1) {
            colorTrack = tracks[0];
        }

        if (tracks.length >= 2) {
            alphaTrack = tracks[1];
        }
    }

    // If only one has been identified, don't
    // accidentally assign the same track twice.
    if (
        colorTrack &&
        alphaTrack &&
        colorTrack.id === alphaTrack.id
    ) {
        alphaTrack = null;
    }

    if (colorTrack) {
        if (
            state.colorTrack !==
            colorTrack
        ) {
            state.colorTrack =
                colorTrack;

            state.colorVideo.srcObject =
                new MediaStream([
                    colorTrack
                ]);

            state.colorVideo
                .play()
                .catch(() => {});
        }
    }

    if (alphaTrack) {
        if (
            state.alphaTrack !==
            alphaTrack
        ) {
            state.alphaTrack =
                alphaTrack;

            state.alphaVideo.srcObject =
                new MediaStream([
                    alphaTrack
                ]);

            state.alphaVideo
                .play()
                .catch(() => {});
        }
    }

    console.log(
        "Remote tracks:",
        id,
        {
            total: tracks.length,
            color: colorTrack?.id,
            alpha: alphaTrack?.id
        }
    );

    /*
     * Keep the tracks until both are connected.
     * This is useful if ontrack events arrive
     * separately.
     */
    if (
        state.colorTrack &&
        state.alphaTrack
    ) {
        console.log(
            "Remote RGBA video connected:",
            id
        );
    }
}


// ======================
// Offer
// ======================
async function createOffer(id) {
    const pc = peers[id];

    if (!pc)
        return;

    try {
        const offer =
            await pc.createOffer();

        await pc.setLocalDescription(
            offer
        );

        socket.emit(
            "signal",
            {
                to: id,

                signal:
                    pc.localDescription
            }
        );

    } catch (err) {
        console.error(
            "Offer error:",
            err
        );
    }
}


// ======================
// Local video
// ======================
function createLocalVideo() {
    createLocalVideoBox(
        socket.id
    );
}


// ======================
// Local video box
// ======================
function createLocalVideoBox(id) {
    let box =
        document.getElementById(
            `box-${id}`
        );

    if (box)
        return box;

    box =
        document.createElement("div");

    box.className =
        "video-box";

    box.id =
        `box-${id}`;

    if (!transforms[id]) {
        transforms[id] = {
            id,

            locked: false,

            x: 100,
            y: 100,

            scale: 1,

            rotation: 0,

            z:
                highestZ() + 1
        };
    }

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        videoCanvas.width;

    canvas.height =
        videoCanvas.height;

    box.appendChild(canvas);

    scene.appendChild(box);

    localSceneCanvases.add(
        canvas
    );

    box._transparentState = {
        local: true,

        canvas
    };

    enableDrag(
        box,
        id,
        "video"
    );

    applyEditedTransform(id);

    return box;
}


// ======================
// Remote transparent box
// ======================
function createRemoteVideoBox(id) {
    let box =
        document.getElementById(
            `box-${id}`
        );

    if (box)
        return box;

    box =
        document.createElement("div");

    box.className =
        "video-box";

    box.id =
        `box-${id}`;

    if (!transforms[id]) {
        transforms[id] = {
            id,
            locked: false,
            x: 100,
            y: 100,
            scale: 1,
            rotation: 0,
            z:
                highestZ() + 1
        };
    }

    // --------------------------------
    // Hidden COLOR video
    // --------------------------------
    const colorVideo =
        document.createElement(
            "video"
        );

    colorVideo.autoplay = true;
    colorVideo.playsInline = true;
    colorVideo.muted = true;

    colorVideo.style.display =
        "none";

    // --------------------------------
    // Hidden ALPHA video
    // --------------------------------
    const alphaVideo =
        document.createElement(
            "video"
        );

    alphaVideo.autoplay = true;
    alphaVideo.playsInline = true;
    alphaVideo.muted = true;

    alphaVideo.style.display =
        "none";

    // --------------------------------
    // Visible RGBA canvas
    // --------------------------------
    const canvas =
        document.createElement(
            "canvas"
        );

    const outputCtx =
        canvas.getContext(
            "2d",
            {
                alpha: true,
                willReadFrequently: true
            }
        );

    const maskCanvas =
        document.createElement(
            "canvas"
        );

    const maskCtx =
        maskCanvas.getContext(
            "2d",
            {
                alpha: false,
                willReadFrequently: true
            }
        );

    box.appendChild(
        colorVideo
    );

    box.appendChild(
        alphaVideo
    );

    box.appendChild(
        canvas
    );

    scene.appendChild(box);

    const state = {
        colorVideo,
        alphaVideo,
        canvas,
        maskCanvas,
        outputCtx,
        maskCtx,
        colorTrack: null,
        alphaTrack: null,
        rendering: true
    };

    box._transparentState =
        state;

    // --------------------------------
    // Resize
    // --------------------------------
    function resize() {
        const width =
            colorVideo.videoWidth ||
            alphaVideo.videoWidth;

        const height =
            colorVideo.videoHeight ||
            alphaVideo.videoHeight;

        if (
            !width ||
            !height
        ) {
            return;
        }

        if (
            canvas.width !== width ||
            canvas.height !== height
        ) {
            canvas.width =
                width;

            canvas.height =
                height;

            maskCanvas.width =
                width;

            maskCanvas.height =
                height;
        }
    }

    colorVideo.addEventListener(
        "loadedmetadata",
        resize
    );

    alphaVideo.addEventListener(
        "loadedmetadata",
        resize
    );

    // --------------------------------
    // Composite
    // --------------------------------
    function renderRemote() {
        if (!state.rendering)
            return;

        resize();

        const width =
            canvas.width;

        const height =
            canvas.height;

        if (
            width > 0 &&
            height > 0 &&
            colorVideo.readyState >= 2 &&
            alphaVideo.readyState >= 2
        ) {
            try {
                // Draw RGB.
                outputCtx.clearRect(
                    0,
                    0,
                    width,
                    height
                );

                outputCtx.drawImage(
                    colorVideo,
                    0,
                    0,
                    width,
                    height
                );

                // Draw alpha mask.
                maskCtx.drawImage(
                    alphaVideo,
                    0,
                    0,
                    width,
                    height
                );

                const output =
                    outputCtx.getImageData(
                        0,
                        0,
                        width,
                        height
                    );

                const mask =
                    maskCtx.getImageData(
                        0,
                        0,
                        width,
                        height
                    );

                const outputData =
                    output.data;

                const maskData =
                    mask.data;

                // Alpha mask red channel
                // becomes RGBA alpha.
                for (
                    let i = 0;
                    i < outputData.length;
                    i += 4
                ) {
                    outputData[i + 3] =
                        maskData[i];
                }

                outputCtx.putImageData(
                    output,
                    0,
                    0
                );

            } catch (err) {
                console.error(
                    "Remote composite error:",
                    err
                );
            }
        }

        requestAnimationFrame(
            renderRemote
        );
    }

    requestAnimationFrame(
        renderRemote
    );

    enableDrag(
        box,
        id,
        "video"
    );

    applyEditedTransform(id);

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

    if (!box)
        return;

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

    const t =
        transforms[id];

    box.style.left =
        t.x + "px";

    box.style.top =
        t.y + "px";

    box.style.zIndex =
        t.z;

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
        ...Object.values(
            transforms
        ).map(
            t => t.z || 0
        )
    );
}

function lowestZ() {
    return Math.min(
        0,
        ...Object.values(
            transforms
        ).map(
            t => t.z || 0
        )
    );
}


// ======================
// Z ordering
// ======================
function bringForward(id) {
    const currentZ =
        transforms[id].z;

    let otherId = null;

    let nearestHigherZ =
        Infinity;


    for (
        const [k, t]
        of Object.entries(transforms)
    ) {
        if (k === id)
            continue;

        if (
            t.z > currentZ &&
            t.z < nearestHigherZ
        ) {
            nearestHigherZ =
                t.z;

            otherId = k;
        }
    }

    if (otherId == null)
        return;

    const tmp =
        transforms[id].z;

    transforms[id].z =
        transforms[otherId].z;

    transforms[otherId].z =
        tmp;

    applyEditedTransform(id);
    sendEditedTransform(id);

    applyEditedTransform(otherId);
    sendEditedTransform(otherId);
}

function sendBackward(id) {
    const currentZ =
        transforms[id].z;

    let otherId = null;

    let nearestLowerZ =
        -Infinity;

    for (
        const [k, t]
        of Object.entries(transforms)
    ) {
        if (k === id)
            continue;

        if (
            t.z < currentZ &&
            t.z > nearestLowerZ
        ) {
            nearestLowerZ =
                t.z;

            otherId = k;
        }
    }

    if (otherId == null)
        return;

    const tmp =
        transforms[id].z;

    transforms[id].z =
        transforms[otherId].z;

    transforms[otherId].z =
        tmp;

    applyEditedTransform(id);
    sendEditedTransform(id);

    applyEditedTransform(otherId);
    sendEditedTransform(otherId);
}


// ======================
// Drag
// ======================
function enableDrag(
    box,
    id,
    type
) {
    let dragging = false;

    let offsetX = 0;
    let offsetY = 0;

    let alpha = 255;

    const canvas =
        box.querySelector(
            "canvas"
        );

    box.addEventListener(
        "pointerdown",
        e => {
            const t =
                transforms[id];

            if (
                !t.locked &&
                alpha !== 0
            ) {
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
            if (!dragging)
                return;

            const t =
                transforms[id];

            t.x =
                e.clientX -
                offsetX;

            t.y =
                e.clientY -
                offsetY;

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
        "pointercancel",
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
            if (
                !t.locked &&
                alpha !== 0
            ) {
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

                    t.scale =
                        Math.max(
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

            if (e.button === 1) {
                e.preventDefault();

                if (
                    !t.locked &&
                    alpha !== 0
                ) {
                    if (e.altKey) {
                        sendBackward(id);
                    } else {
                        bringForward(id);
                    }
                }
            } else if (
                e.button === 2
            ) {
                e.preventDefault();

                if (e.altKey) {
                    if (
                        type ===
                        "image"
                    ) {
                        socket.emit(
                            "delete-image",
                            id
                        );
                    }
                } else {
                    t.locked =
                        !t.locked;

                    applyEditedTransform(
                        id
                    );

                    sendEditedTransform(
                        id
                    );
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
            mouse.x =
                e.clientX;

            mouse.y =
                e.clientY;


            if (!canvas)
                return;

            const rect =
                canvas.getBoundingClientRect();

            if (
                rect.width === 0 ||
                rect.height === 0
            ) {
                return;
            }

            const x =
                Math.floor(
                    (
                        mouse.x -
                        rect.left
                    ) *
                    canvas.width /
                    rect.width
                );

            const y =
                Math.floor(
                    (
                        mouse.y -
                        rect.top
                    ) *
                    canvas.height /
                    rect.height
                );

            if (
                !Number.isFinite(x) ||
                !Number.isFinite(y)
            ) {
                return;
            }

            const px =
                Math.max(
                    0,

                    Math.min(
                        canvas.width - 1,
                        x
                    )
                );

            const py =
                Math.max(
                    0,

                    Math.min(
                        canvas.height - 1,
                        y
                    )
                );

            if (
                type === "video"
            ) {
                const scaleX =
                    canvas.width /
                    rect.width;

                const scaleY =
                    canvas.height /
                    rect.height;

                alpha = 0;

                try {
                    const pixel =
                        canvas
                            .getContext(
                                "2d"
                            )
                            .getImageData(
                                px,
                                py,
                                1,
                                1
                            )
                            .data;

                    alpha =
                        pixel[3];
                } catch (err) {
                    alpha = 0;
                }

            } else if (
                type === "image"
            ) {

                const imageCtx =
                    canvas.getContext(
                        "2d"
                    );

                const pixel =
                    imageCtx.getImageData(
                        px,
                        py,
                        1,
                        1
                    ).data;

                alpha =
                    pixel[3];
            }

            if (alpha === 0) {
                box.style.pointerEvents =
                    "none";
            } else {
                box.style.pointerEvents =
                    "auto";
            }
        }
    );
}


// ======================
// Images
// ======================
function addImage(image) {
    let box =
        document.getElementById(
            `box-${image.id}`
        );

    if (box)
        return box;

    box =
        document.createElement("div");

    box.className =
        "image-box";

    box.id =
        `box-${image.id}`;

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

    const img =
        document.createElement(
            "img"
        );

    const canvas =
        document.createElement(
            "canvas"
        );

    img.src =
        image.data;

    const imageCtx =
        canvas.getContext(
            "2d"
        );

    img.onload = () => {
        canvas.width =
            img.width;

        canvas.height =
            img.height;

        imageCtx.drawImage(
            img,
            0,
            0
        );
    };

    box.appendChild(img);
    box.appendChild(canvas);
    scene.appendChild(box);


    enableDrag(
        box,
        image.id,
        "image"
    );


    applyEditedTransform(
        image.id
    );


    return box;
}

socket.on(
    "all-images",
    images => {
        images.forEach(
            addImage
        );
    }
);

socket.on(
    "new-image",
    image => {
        addImage(image);
    }
);

socket.on(
    "image-deleted",
    id => {
        const img =
            document.getElementById(
                `box-${id}`
            );

        if (img)
            img.remove();

        delete transforms[id];
    }
);

scene.addEventListener(
    "dragover",
    e => {
        e.preventDefault();
    }
);

scene.addEventListener(
    "drop",
    e => {

        e.preventDefault();

        const file =
            e.dataTransfer.files[0];

        if (!file)
            return;

        if (
            file.type !==
            "image/png"
        ) {
            alert("PNG only");
            return;
        }

        const reader =
            new FileReader();


        reader.onload = () => {
            const img =
                new Image();


            img.onload = () => {
                socket.emit(
                    "upload-image",
                    {
                        image:
                            reader.result,

                        dropX:
                            mouse.x -
                            img.width / 2,

                        dropY:
                            mouse.y -
                            img.height / 2
                    }
                );
            };

            img.src =
                reader.result;
        };

        reader.readAsDataURL(
            file
        );
    }
);


// ======================
// Sync transforms
// ======================
socket.on(
    "edited-transform",
    data => {
        transforms[data.id] =
            data;


        const box =
            document.getElementById(
                `box-${data.id}`
            );


        if (!box)
            return;


        applyEditedTransform(
            data.id
        );
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
// User left
// ======================
socket.on(
    "user-left",
    id => {
        if (peers[id]) {
            peers[id].close();

            delete peers[id];
        }

        delete transforms[id];
        delete remoteTrackInfo[id];
        delete pendingRemoteTracks[id];
        delete pendingIceCandidates[id];

        const box =
            document.getElementById(
                `box-${id}`
            );

        if (box) {
            const state =
                box._transparentState;

            if (state) {
                state.rendering =
                    false;
            }

            box.remove();
        }
    }
);

socket.on(
    "room-closed",
    message => {
        alert(message);

        window.location.href =
            ownedURL;
    }
);


// ======================
// Background
// ======================
const menu =
    document.getElementById(
        "menuPopup"
    );


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

const backgroundInput =
    document.getElementById(
        "backgroundInput"
    );

document
    .getElementById("menuBtn")
    .onclick = () => {
        const file =
            backgroundInput.files[0];

        if (!file) {
            socket.emit(
                "upload-background",
                {
                    image: "data:image/png;base64,"
                }
            );
            return;
        }

        if (
            file.type !==
            "image/png"
        ) {
            alert("PNG only");
            return;
        }

        const reader =
            new FileReader();


        reader.onload = () => {

            socket.emit(
                "upload-background",
                {
                    image:
                        reader.result
                }
            );
        };

        reader.readAsDataURL(
            file
        );

        menu.classList.toggle(
            "show"
        );
    };

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