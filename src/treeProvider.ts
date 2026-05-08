import * as vscode from 'vscode';
import * as path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { ConnectionManager } from './connectionManager';
import { ConnectionState } from './types';

type FileInfo = SftpClient.FileInfo;

// ── Tree item types ──────────────────────────────────────────────────────────

export type SftpItemType =
  | 'connection-connected'
  | 'connection-connecting'
  | 'connection-disconnected'
  | 'connection-error'
  | 'directory'
  | 'file';

export class SftpTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly itemType: SftpItemType,
    public readonly connectionId: string,
    /** Absolute remote path, always POSIX (starts with /) */
    public readonly remotePath: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.contextValue = itemType;

    switch (itemType) {
      case 'connection-connected':
        this.iconPath = new vscode.ThemeIcon('plug', new vscode.ThemeColor('testing.iconPassed'));
        break;
      case 'connection-connecting':
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        break;
      case 'connection-error':
        this.iconPath = new vscode.ThemeIcon('plug', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'connection-disconnected':
        this.iconPath = new vscode.ThemeIcon('plug');
        break;
      case 'directory':
        // VS Code will apply theme folder icon automatically via resourceUri
        this.resourceUri = buildUri(connectionId, remotePath, true);
        break;
      case 'file':
        this.resourceUri = buildUri(connectionId, remotePath, false);
        this.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [this.resourceUri],
        };
        break;
    }
  }
}

function buildUri(connectionId: string, remotePath: string, isDir: boolean): vscode.Uri {
  // Trailing slash on directories helps VS Code pick the right icon
  const p = isDir && !remotePath.endsWith('/') ? remotePath + '/' : remotePath;
  return vscode.Uri.from({ scheme: 'sftp', authority: connectionId, path: p });
}

// ── Tree data provider ───────────────────────────────────────────────────────

export class SftpTreeProvider implements vscode.TreeDataProvider<SftpTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<SftpTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly connectionManager: ConnectionManager) {
    connectionManager.onDidChange(() => this.refresh());
  }

  refresh(item?: SftpTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: SftpTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SftpTreeItem): Promise<SftpTreeItem[]> {
    // Root: return all connections
    if (!element) {
      return this.connectionManager.getAll().map(state => stateToItem(state));
    }

    // Connection root or directory: list remote files
    if (element.itemType === 'connection-connected' || element.itemType === 'directory') {
      return this.listRemote(element.connectionId, element.remotePath);
    }

    return [];
  }

  private async listRemote(connectionId: string, remotePath: string): Promise<SftpTreeItem[]> {
    const client = this.connectionManager.getClient(connectionId);
    if (!client) return [];

    try {
      const files = await client.list(remotePath);
      return files
        .filter((f: FileInfo) => f.name !== '.' && f.name !== '..')
        .sort((a: FileInfo, b: FileInfo) => {
          if (a.type === 'd' && b.type !== 'd') return -1;
          if (a.type !== 'd' && b.type === 'd') return 1;
          return a.name.localeCompare(b.name);
        })
        .map((f: FileInfo) => {
          const isDir = f.type === 'd';
          const childPath = path.posix.join(remotePath, f.name);
          return new SftpTreeItem(
            f.name,
            isDir ? 'directory' : 'file',
            connectionId,
            childPath,
            isDir
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
          );
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`SFTP: Failed to list ${remotePath}: ${msg}`);
      return [];
    }
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

function stateToItem(state: ConnectionState): SftpTreeItem {
  const { config, status, error } = state;
  const item = new SftpTreeItem(
    config.name,
    `connection-${status}` as SftpItemType,
    config.id,
    config.remotePath || '/',
    status === 'connected'
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None,
  );

  const scopeBadge = config.scope === 'workspace' ? ' [workspace]' : '';
  item.description = `${config.username}@${config.host}:${config.port ?? 22}${scopeBadge}`;

  if (status === 'error' && error) {
    item.tooltip = `Error: ${error}`;
  } else if (status === 'connecting') {
    item.tooltip = 'Connecting…';
  }

  return item;
}
