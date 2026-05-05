export type Protocol = 'tcp' | 'udp';
export type CommandType = 'trigger' | 'on' | 'off' | 'ramp';
export type DataFormat = 'ascii' | 'hex';
export type Terminator = 'none' | 'cr' | 'lf' | 'crlf';

export interface DeviceConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  protocol: Protocol;
  color?: string; // Hex color code
}

export interface TrackConfig {
  id: string;
  deviceId: string;
  name: string;
  color?: string; // Hex color code
}

export interface BaseEvent {
  id: string;
  time: number; // milliseconds from start
  trackId: string;
  type: CommandType;
  format: DataFormat;
  terminator: Terminator;
  color?: string; // Individual event override
}

export interface TriggerEvent extends BaseEvent {
  type: 'trigger';
  command: string;
}

export interface OnEvent extends BaseEvent {
  type: 'on';
  command: string;
}

export interface OffEvent extends BaseEvent {
  type: 'off';
  command: string;
}

export interface RampEvent extends BaseEvent {
  type: 'ramp';
  startValue: number;
  endValue: number;
  duration: number; // milliseconds
  steps?: number; // For 'stepped' mode
  rampMode: 'smooth' | 'stepped';
  commandTemplate: string; // e.g., "VOL {value}"
}

export type Event = TriggerEvent | OnEvent | OffEvent | RampEvent;

export interface Sequence {
  id: string;
  name: string;
  type: 'realtime' | 'relative';
  tracks: TrackConfig[];
  events: Event[];
}
