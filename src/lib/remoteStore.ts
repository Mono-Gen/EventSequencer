import { EventEmitter } from 'events';

// シングルトンで状態を管理
class RemoteStore extends EventEmitter {
  private currentStatus: string = '@stop@';
  private lastCommand: string | null = null;

  setStatus(status: 'play' | 'pause' | 'stop') {
    this.currentStatus = `@${status}@`;
    console.log(`[RemoteStore] Status updated to: ${this.currentStatus}`);
  }

  getStatus() {
    return this.currentStatus;
  }

  // UIへ送るコマンドを発行
  pushCommand(cmd: 'PLAY' | 'PAUSE' | 'STOP') {
    this.lastCommand = cmd;
    this.emit('command', cmd);
    console.log(`[RemoteStore] Command pushed: ${cmd}`);
  }
}

// グローバルオブジェクトに持たせて、再読み込み時もインスタンスを維持
const globalForRemote = global as unknown as { remoteStore: RemoteStore };
export const remoteStore = globalForRemote.remoteStore || new RemoteStore();
globalForRemote.remoteStore = remoteStore;
