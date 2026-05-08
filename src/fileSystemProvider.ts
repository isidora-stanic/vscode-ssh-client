import * as vscode from 'vscode';
import SftpClient from 'ssh2-sftp-client';
import { ConnectionManager } from './connectionManager';

type FileInfo = SftpClient.FileInfo;

/**
 * Implements vscode.FileSystemProvider for the "sftp" URI scheme.
 *
 * URI format:  sftp://<connectionId>/absolute/remote/path
 *   uri.authority = connectionId
 *   uri.path     = /absolute/remote/path
 */
export class SftpFileSystemProvider implements vscode.FileSystemProvider {
  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  constructor(private readonly connectionManager: ConnectionManager) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private parseUri(uri: vscode.Uri): { connectionId: string; remotePath: string } {
    return { connectionId: uri.authority, remotePath: uri.path || '/' };
  }

  private requireClient(uri: vscode.Uri) {
    const { connectionId } = this.parseUri(uri);
    const client = this.connectionManager.getClient(connectionId);
    if (!client) {
      throw vscode.FileSystemError.Unavailable(uri);
    }
    return { client, ...this.parseUri(uri) };
  }

  // ── FileSystemProvider interface ──────────────────────────────────────────

  watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    // SFTP has no push-based change notifications; return a no-op disposable
    return { dispose: () => undefined };
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const { client, remotePath } = this.requireClient(uri);
    try {
      const stats = await client.stat(remotePath);
      return {
        type: stats.isDirectory
          ? vscode.FileType.Directory
          : stats.isSymbolicLink
          ? vscode.FileType.SymbolicLink
          : vscode.FileType.File,
        ctime: 0,
        mtime: stats.modifyTime,
        size: stats.size,
      };
    } catch (err: unknown) {
      if (isNoSuchFile(err)) throw vscode.FileSystemError.FileNotFound(uri);
      throw err;
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const { client, remotePath } = this.requireClient(uri);
    try {
      const files = await client.list(remotePath);
      return files
        .filter((f: FileInfo) => f.name !== '.' && f.name !== '..')
        .map((f: FileInfo) => [
          f.name,
          f.type === 'd'
            ? vscode.FileType.Directory
            : f.type === 'l'
            ? vscode.FileType.SymbolicLink
            : vscode.FileType.File,
        ]);
    } catch (err: unknown) {
      if (isNoSuchFile(err)) throw vscode.FileSystemError.FileNotFound(uri);
      throw err;
    }
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    const { client, remotePath } = this.requireClient(uri);
    await client.mkdir(remotePath, true);
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const { client, remotePath } = this.requireClient(uri);
    try {
      const data = await client.get(remotePath);
      if (!data) return new Uint8Array(0);
      if (Buffer.isBuffer(data)) return new Uint8Array(data);
      if (typeof data === 'string') return new Uint8Array(Buffer.from(data));
      return new Uint8Array(0);
    } catch (err: unknown) {
      if (isNoSuchFile(err)) throw vscode.FileSystemError.FileNotFound(uri);
      throw err;
    }
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    const { client, remotePath } = this.requireClient(uri);
    await client.put(Buffer.from(content), remotePath);
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
    const { client, remotePath } = this.requireClient(uri);
    try {
      const stats = await client.stat(remotePath);
      if (stats.isDirectory) {
        await client.rmdir(remotePath, options.recursive);
      } else {
        await client.delete(remotePath);
      }
      this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    } catch (err: unknown) {
      if (isNoSuchFile(err)) throw vscode.FileSystemError.FileNotFound(uri);
      throw err;
    }
  }

  async rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    _options: { overwrite: boolean },
  ): Promise<void> {
    const { client, remotePath: oldPath } = this.requireClient(oldUri);
    const newPath = newUri.path;
    await client.rename(oldPath, newPath);
    this._onDidChangeFile.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri },
    ]);
  }

  dispose(): void {
    this._onDidChangeFile.dispose();
  }
}

function isNoSuchFile(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('no such file') || msg.includes('does not exist') || msg.includes('enoent');
  }
  return false;
}
