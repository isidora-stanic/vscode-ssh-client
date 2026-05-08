import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import SftpClient from 'ssh2-sftp-client';
import { SftpConnectionConfig, ConnectionState, ConnectionStatus } from './types';

export class ConnectionManager implements vscode.Disposable {
  private readonly states = new Map<string, ConnectionState>();
  private readonly clients = new Map<string, SftpClient>();

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly secrets: vscode.SecretStorage) {
    this.syncFromSettings();

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('sftpClient.connections')) {
        this.syncFromSettings();
        this._onDidChange.fire();
      }
    });
  }

  // ── Settings sync ─────────────────────────────────────────────────────────

  private syncFromSettings(): void {
    const all = this.readAllConfigs();
    const incoming = new Map(all.map(c => [c.id, c]));

    // Remove deleted connections
    for (const id of this.states.keys()) {
      if (!incoming.has(id)) {
        this.doDisconnect(id);
        this.states.delete(id);
      }
    }

    // Add new / update existing (preserving connection status)
    for (const config of all) {
      if (this.states.has(config.id)) {
        this.states.get(config.id)!.config = config;
      } else {
        this.states.set(config.id, { config, status: 'disconnected' });
      }
    }
  }

  private readAllConfigs(): SftpConnectionConfig[] {
    const vsConfig = vscode.workspace.getConfiguration('sftpClient');
    const inspection = vsConfig.inspect<SftpConnectionConfig[]>('connections');
    const global = (inspection?.globalValue ?? []).map(c => ({ ...c, scope: 'global' as const }));
    const workspace = (inspection?.workspaceValue ?? []).map(c => ({ ...c, scope: 'workspace' as const }));
    return [...global, ...workspace];
  }

  // ── Public accessors ──────────────────────────────────────────────────────

  getAll(): ConnectionState[] {
    return [...this.states.values()];
  }

  get(id: string): ConnectionState | undefined {
    return this.states.get(id);
  }

  getClient(id: string): SftpClient | undefined {
    const state = this.states.get(id);
    return state?.status === 'connected' ? this.clients.get(id) : undefined;
  }

  // ── CRUD for connection configs ───────────────────────────────────────────

  async save(config: SftpConnectionConfig, password?: string, passphrase?: string): Promise<void> {
    if (password !== undefined && password !== '') {
      await this.secrets.store(`sftp:${config.id}:password`, password);
    }
    if (passphrase !== undefined && passphrase !== '') {
      await this.secrets.store(`sftp:${config.id}:passphrase`, passphrase);
    }

    const vsConfig = vscode.workspace.getConfiguration('sftpClient');
    const inspection = vsConfig.inspect<SftpConnectionConfig[]>('connections');

    const target =
      config.scope === 'workspace'
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;

    const existing: SftpConnectionConfig[] =
      (config.scope === 'workspace' ? inspection?.workspaceValue : inspection?.globalValue) ?? [];

    const idx = existing.findIndex(c => c.id === config.id);
    const updated = [...existing];
    if (idx >= 0) {
      updated[idx] = config;
    } else {
      updated.push(config);
    }

    await vsConfig.update('connections', updated, target);
    // syncFromSettings() fires via onDidChangeConfiguration
  }

  async remove(id: string): Promise<void> {
    await this.doDisconnect(id);
    this.states.delete(id);

    await this.secrets.delete(`sftp:${id}:password`);
    await this.secrets.delete(`sftp:${id}:passphrase`);

    const vsConfig = vscode.workspace.getConfiguration('sftpClient');
    const inspection = vsConfig.inspect<SftpConnectionConfig[]>('connections');

    for (const [val, tgt] of [
      [inspection?.globalValue, vscode.ConfigurationTarget.Global],
      [inspection?.workspaceValue, vscode.ConfigurationTarget.Workspace],
    ] as [SftpConnectionConfig[] | undefined, vscode.ConfigurationTarget][]) {
      if (!val) continue;
      const filtered = val.filter(c => c.id !== id);
      if (filtered.length !== val.length) {
        await vsConfig.update('connections', filtered.length ? filtered : undefined, tgt);
      }
    }

    this._onDidChange.fire();
  }

  // ── Connect / disconnect ──────────────────────────────────────────────────

  async connect(id: string): Promise<void> {
    const state = this.states.get(id);
    if (!state) throw new Error(`Unknown connection: ${id}`);
    if (state.status === 'connected') return;

    this.setStatus(id, 'connecting');

    try {
      const client = new SftpClient();
      const { config } = state;

      const password = await this.secrets.get(`sftp:${id}:password`);
      const passphrase = await this.secrets.get(`sftp:${id}:passphrase`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: any = {
        host: config.host,
        port: config.port ?? 22,
        username: config.username,
        readyTimeout: 20000,
      };

      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        opts.privateKey = fs.readFileSync(keyPath);
        if (passphrase) opts.passphrase = passphrase;
      } else if (password) {
        opts.password = password;
      }

      await client.connect(opts);

      this.clients.set(id, client);
      this.setStatus(id, 'connected');

      // Handle unexpected disconnects
      client.on('error', (err: Error) => {
        console.error(`[sftp-client] Connection error on ${id}:`, err.message);
        this.clients.delete(id);
        this.setStatus(id, 'error', err.message);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus(id, 'error', msg);
      throw err;
    }
  }

  async disconnect(id: string): Promise<void> {
    await this.doDisconnect(id);
    this.setStatus(id, 'disconnected');
  }

  private async doDisconnect(id: string): Promise<void> {
    const client = this.clients.get(id);
    this.clients.delete(id);
    if (client) {
      try {
        await client.end();
      } catch {
        // Ignore errors during disconnect
      }
    }
  }

  private setStatus(id: string, status: ConnectionStatus, error?: string): void {
    const state = this.states.get(id);
    if (!state) return;
    state.status = status;
    state.error = error;
    this._onDidChange.fire();
  }

  dispose(): void {
    for (const id of this.clients.keys()) {
      this.doDisconnect(id);
    }
    this._onDidChange.dispose();
  }
}
