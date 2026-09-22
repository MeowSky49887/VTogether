
# VTogether

> **A new way to collab between 2D and 3D VTubers.**

VTogether is a real-time collaboration app that lets **2D and 3D VTubers share the same virtual room**.

Capture your VTuber model with **Spout2**, communicate through **WebRTC**, and synchronize the room with **Socket.IO**.

## Features

* 🎭 2D × 3D VTuber collaboration
* 🎥 Spout2 model capture
* 🌐 WebRTC real-time video
* 🔄 Socket.IO room synchronization
* 🪑 Shared props
* 🖼️ Shared room backgrounds
* 🎨 Chroma key and avatar cropping
* 🔐 Password-protected rooms
* 🖥️ Simple streaming workflow

## How It Works

```text
VTuber App
    │
  Spout2
    ▼
VTogether ◄──── WebRTC ────► VTogether
    │                           │
    └────── Socket.IO ──────────┘
              │
        Shared Room
        • Background
        • Props
        • Scene
        • Password
              │
       Window Capture
              ▼
             OBS
```

## How to Use

### 1. Start the Application

The host needs to start VTogether with a port specified through the command line.

```bash
VTogether.exe --port <PORT>
```

The host's IP address and port will be used as the room URL.

For example:

```text
http://192.168.1.100:8080
```

### 2. Host a Room

The host should:

1. Find their local IP address.
2. Start VTogether with the desired port.
3. Select **Host** to create the collaboration room.
4. Optionally set a **password** to protect the room.

Other users must be connected to the **same LAN or virtual LAN** as the host.

### 3. Join a Room

Other participants can enter the host's IP address and port:

```text
http://192.168.1.100:8080
```

If the room is password-protected, enter the password provided by the host.

Then select **Join**.

> The host and all participants must be connected to the same local network or virtual LAN.

### 4. Enter the Collaboration Scene

After hosting or joining, VTogether will open the shared collaboration scene.

Your avatar and other participants' avatars will appear in the room.

### 5. Control Your Avatar

You can control your own avatar with the mouse:

| Action | Control               |
| ------ | --------------------- |
| Move   | Left-click and drag   |
| Scale  | Mouse wheel           |
| Rotate | `Alt` + mouse wheel |
| Lock   | Right-click           |
| Unlock | Right-click again     |

The avatar's position and other room changes are synchronized with other participants.

### 6. Add Props

You can add images as props by **dragging and dropping a PNG file** into VTogether.

Once added, the image can be controlled like an avatar:

| Action | Control               |
| ------ | --------------------- |
| Move   | Left-click and drag   |
| Scale  | Mouse wheel           |
| Rotate | `Alt` + mouse wheel |
| Lock   | Right-click           |
| Unlock | Right-click again     |
| Delete | `Alt` + Right-click |

Props are synchronized with everyone in the room.

### 7. Change the Background

Press:

```text
Ctrl + \
```

VTogether will prompt you to select or upload a background image.

The selected background is synchronized with the other participants.

### 8. Chroma Key and Crop

VTogether also supports processing the captured avatar:

* **Chroma Key** — Remove a background color from the avatar.
* **Crop** — Crop the captured avatar area.

These options can be configured before creating or joining a room.

### 9. Leave or Reload the Room

To leave the current room or reload the application page, press:

```text
Ctrl + R
```

or:

```text
F5
```

This reloads the VTogether page and allows you to return to the host/join screen.

## Requirements

* Windows
* VTuber software with Spout2 support
* VTogether
* Network connection
* Same LAN or virtual LAN as the host
* Streaming software such as OBS Studio

## Streaming

VTogether is designed to work with existing streaming software.

Simply capture the VTogether window using **Window Capture** or **Display Capture**.

```text
VTuber Software
      │
    Spout2
      ▼
   VTogether
      │
      │ Window Capture
      ▼
     OBS
      │
      ▼
    Stream
```

## 💜 VTogether

**Connect your models. Share your room. Collab together.**
