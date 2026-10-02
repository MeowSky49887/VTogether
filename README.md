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
* 🔐 Password-protected rooms
* 🖥️ Simple streaming workflow

## How It Works

```text
                         VTuber App
                              │
                           Spout2
                              ▼
                         ┌─────────┐
                         │VTogether│
                         └────┬────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 WebRTC             Socket.IO
                    │                   │
                    │                   ▼
                    │             ┌───────────┐
                    │             │   Room    │
                    │             │  Control  │
                    │             └───────────┘
                    │                   │
                    ▼                   │
              ┌─────────────┐           │
              │   Shared    │           │
              │    Scene    │           │
              ├─────────────┤           │
              │ Background  │           │
              │ Props       │           │
              │ Avatars     │           │
              │ Scene State │           │
              └──────┬──────┘           │
                     │                  │
                     ▼                  │
               ┌───────────┐            │
               │ VTogether │◄───────────┘ 
               └─────┬─────┘
                     │
                     │ Spout2 Capture
                     ▼
                    OBS
```

## How to Use VTogether

### 1. Host a Room

The host should:

1. Enter a unique **Room ID**.
2. Select **Join** to create the collaboration room.
3. If the Room ID does not already exist, a new room will be created automatically.
4. Optionally, set a **password** to protect the room.

### 2. Join a Room

Other participants can join the room by:

1. Entering the host's **Room ID**.
2. If the room is password-protected, entering the password provided by the host.
3. Selecting **Join**.

### 3. Enter the Collaboration Scene

After hosting or joining a room, VTogether will open the shared collaboration scene.

Your avatar and the avatars of other participants will appear in the room. Changes made within the room are synchronized with all participants.

### 4. Control Your Avatar

You can control your avatar using the mouse:

| Action | Control             |
| ------ | ------------------- |
| Move   | Left-click and drag |
| Scale  | Mouse wheel         |
| Rotate | `Alt` + mouse wheel |
| Lock   | Right-click         |
| Unlock | Right-click again   |

Your avatar's position and other changes are synchronized with all participants in the room.

### 5. Add Props

You can add images as props by **dragging and dropping a PNG file** into VTogether.

Once added, props can be controlled in the same way as avatars:

| Action | Control             |
| ------ | ------------------- |
| Move   | Left-click and drag |
| Scale  | Mouse wheel         |
| Rotate | `Alt` + mouse wheel |
| Lock   | Right-click         |
| Unlock | Right-click again   |
| Delete | `Alt` + Right-click |

Props are automatically synchronized with everyone in the room.

### 6. Change the Background

Press:

```text
Ctrl + \
```

VTogether will prompt you to select or upload a background image.

Once selected, the new background will be synchronized with all participants in the room.

### 7. Leave or Reload the Room

To leave the current room or reload the application page, press:

```text
Ctrl + R
```

This will reload VTogether and return you to the **Host/Join** screen, where you can create or join a room again.

## Requirements

* Windows
* VTuber software with Spout2 support
* VTogether
* Network connection
* Streaming software such as OBS Studio

## Streaming

VTogether is designed to work with existing streaming software.

Simply capture the VTogether window using **Spout2 Capture**.

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
