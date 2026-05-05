# EventSequencer Operation Manual (v0.9.0)

EventSequencer is a professional-grade standalone DAW sequencer built with Next.js and Electron.

## 1. Basic Operations

### Transport Controls
- **PLAY**: Starts the sequence.
- **PAUSE**: Pauses the current playback.
- **STOP**: Stops playback and resets the position to 00:00:00.
- **SEEK**: Double-click the time display at the top to enter values, or drag the timeline ruler to change the playback position.

### Timeline Interaction
- **Zoom**: Use `Ctrl + Mouse Wheel` to zoom in and out of the timeline.
- **Auto-Chase**: Automatically scrolls the view during playback. It turns off automatically if you manually scroll or seek.
- **Loop Range**: `Shift + Drag` on the ruler to set a loop region. To clear it, right-click the ruler or click the "CLEAR" button in the status bar.

## 2. Managing Tracks and Devices

### Sidebar (TRACK LIST)
- **Add Device**: Click the "Add Device" button at the bottom to add a new device.
- **Add Track**: Click the "+" button next to a device name to add a track.
- **Rename**: Double-click a device or track name to edit it.
- **Reorder**: Drag and drop devices or tracks to change their order.
- **Auto-width**: **Double-click the "TRACK LIST" header text** to automatically adjust the sidebar width based on the longest name.

### Event Handling
- **Create Event**: Double-click on an empty area of a track to create an event.
- **Move**: Drag an event to change its timing.
- **Direct Time Entry**: Select an event and edit the **Execution Time** directly in the property panel for precise millisecond adjustments (format: `HH:MM:SS.mmm`).
- **Duplicate**: `Alt + Drag` an event to copy it.
- **Delete**: Select an event and press the `Delete` key or use the property panel.

## 3. Remote Control (TCP)

Control the application via network from external hardware or software (e.g., Stream Deck).

- **Port**: `9001`
- **Protocol**: TCP (Telnet compatible)
- **Commands**:
  - `@play`: Start playback
  - `@pause`: Pause playback
  - `@stop`: Stop and reset
  - `@status`: Query current state (returns `@play@`, `@pause@`, or `@stop@`)

## 4. Security and Environment

- **LOCK Mode**: Click the lock icon in the top right to enable "LOCK mode." This prevents accidental modifications during live performances.
- **Standalone Execution**: Run `dist/EventSequencer-win32-x64/EventSequencer.exe`. No Node.js installation is required.

---
Copyright © 2026. All rights reserved.
