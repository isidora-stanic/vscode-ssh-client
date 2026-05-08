import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectionManager } from './connectionManager';
import { SftpTreeProvider, SftpTreeItem } from './treeProvider';
import { SftpFileSystemProvider } from './fileSystemProvider';
import { openConnectionForm } from './connectionWebview';
import { SftpConnectionConfig } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Parse #hex or rgb(...) to a normalized #rrggbb string. Returns undefined if invalid. */
function parseToHex(input: string): string | undefined {
  input = input.trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(input)) {
    const [, r, g, b] = input.match(/^#(.)(.)(.)$/)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgb = input.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) {
    const [r, g, b] = [+rgb[1], +rgb[2], +rgb[3]];
    if (r <= 255 && g <= 255 && b <= 255) {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }
  return undefined;
}

/** Deterministically map a connection ID to one of 8 custom color slots. */
function connectionSlot(connectionId: string): number {
  let h = 5381;
  for (const c of connectionId) h = (((h << 5) + h) ^ c.charCodeAt(0)) >>> 0;
  return h % 8;
}

/** Store a hex color in workbench.colorCustomizations for the connection's slot.
 *  Returns the ThemeColor ID to use in FileDecoration. */
async function applyCustomColor(connectionId: string, hex: string): Promise<string> {
  const slot = connectionSlot(connectionId);
  const key = `sftpClient.customColor${slot}`;
  const workbench = vscode.workspace.getConfiguration('workbench');
  const current = workbench.get<Record<string, string>>('colorCustomizations', {});
  await workbench.update('colorCustomizations', { ...current, [key]: hex }, vscode.ConfigurationTarget.Global);
  return key;
}

/** If the webview sent a custom hex color object, convert it to a slot ThemeColor ID. */
async function resolveCustomColor(config: SftpConnectionConfig): Promise<SftpConnectionConfig> {
  const color = config.color as unknown;
  if (color && typeof color === 'object' && '__customHex' in (color as object)) {
    const { __customHex, __connId } = color as { __customHex: string; __connId: string };
    const slotId = await applyCustomColor(__connId || config.id, __customHex);
    return { ...config, color: slotId };
  }
  return config;
}

// ── Activation ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  const connectionManager = new ConnectionManager(context.secrets);
  const treeProvider = new SftpTreeProvider(connectionManager);
  const fsProvider = new SftpFileSystemProvider(connectionManager);

  // Cache of "clean" content per sftp URI - updated on open and after each upload/reload
  const cleanContent = new Map<string, string>();

  const cacheClean = (doc: vscode.TextDocument) => {
    if (doc.uri.scheme === 'sftp') {
      cleanContent.set(doc.uri.toString(), doc.getText());
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(cacheClean),
    vscode.workspace.onDidSaveTextDocument(cacheClean),
  );

  // Register the virtual file system for sftp:// URIs
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('sftp', fsProvider, {
      isCaseSensitive: true,
      isReadonly: false,
    }),
  );

  // ── sftp-remote:// - always fetches fresh content from server (used for diff) ──
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('sftp-remote', {
      async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const sftpUri = uri.with({ scheme: 'sftp' });
        const data = await fsProvider.readFile(sftpUri);
        return new TextDecoder().decode(data);
      },
    }),
  );

  // ── File decoration: colored tab label per connection ────────────────────
  const decorationEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  context.subscriptions.push(decorationEmitter);

  const decorationProvider: vscode.FileDecorationProvider = {
    onDidChangeFileDecorations: decorationEmitter.event,
    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
      if (uri.scheme !== 'sftp') return undefined;
      const state = connectionManager.get(uri.authority);
      const colorId = state?.config.color ?? 'terminal.ansiYellow';
      return {
        badge: '⚠',
        color: new vscode.ThemeColor(colorId),
        tooltip: `Remote SFTP: ${state?.config.name ?? uri.authority} → ${uri.path}`,
      };
    },
  };
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));

  // Refresh decorations whenever a connection config changes (e.g. color update)
  connectionManager.onDidChange(() => decorationEmitter.fire(undefined));

  // ── Status bar: show connection + path when a remote file is active ───────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'sftpClient.refresh';
  context.subscriptions.push(statusBar);

  const updateStatusBar = (editor?: vscode.TextEditor) => {
    const uri = editor?.document.uri;
    if (!uri || uri.scheme !== 'sftp') {
      statusBar.hide();
      return;
    }
    const state = connectionManager.get(uri.authority);
    const connName = state?.config.name ?? uri.authority;
    statusBar.text = `$(cloud) SFTP: ${connName} → ${uri.path}`;
    statusBar.tooltip = `Remote file on ${state?.config.host ?? uri.authority}`;
    statusBar.show();
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
  );
  updateStatusBar(vscode.window.activeTextEditor);

  // Register the tree view
  const treeView = vscode.window.createTreeView('sftpConnections', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // ── Commands ───────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = (cmd: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

  // Block Ctrl+S on remote files
  reg('sftpClient.blockSave', () => {});

  // Add connection
  reg('sftpClient.addConnection', async () => {
    const result = await openConnectionForm(context);
    if (!result) return;
    const config = await resolveCustomColor(result.config);
    await connectionManager.save(config, result.password, result.passphrase);
    vscode.window.showInformationMessage(`SFTP: Connection "${config.name}" added.`);
  });

  // Edit connection
  reg('sftpClient.editConnection', async (item?: SftpTreeItem) => {
    const state = item
      ? connectionManager.get(item.connectionId)
      : await pickConnection(connectionManager);
    if (!state) return;

    const result = await openConnectionForm(context, state.config);
    if (!result) return;
    const config = await resolveCustomColor(result.config);
    await connectionManager.save(config, result.password, result.passphrase);
    vscode.window.showInformationMessage(`SFTP: Connection "${config.name}" updated.`);
  });

  // Import connection(s) from JSON file
  reg('sftpClient.importFromJson', async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'JSON': ['json'] },
      openLabel: 'Import',
    });
    if (!uris?.length) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(uris[0].fsPath, 'utf8'));
    } catch {
      vscode.window.showErrorMessage('SFTP: Could not parse JSON file.');
      return;
    }

    const entries: Partial<SftpConnectionConfig>[] = Array.isArray(parsed) ? parsed : [parsed];
    if (!entries.length) return;

    let imported: Partial<SftpConnectionConfig>;
    if (entries.length === 1) {
      imported = entries[0];
    } else {
      const choice = await vscode.window.showQuickPick(
        entries.map((e, i) => ({ label: e.name ?? `Connection ${i + 1}`, description: e.host, entry: e })),
        { placeHolder: 'Select a connection to import' },
      );
      if (!choice) return;
      imported = choice.entry;
    }

    // Open form pre-filled; user can review before saving
    const result = await openConnectionForm(context, { ...imported, id: undefined });
    if (!result) return;
    await connectionManager.save(result.config, result.password, result.passphrase);
    vscode.window.showInformationMessage(`SFTP: Imported "${result.config.name}".`);
  });

  // Remove connection
  reg('sftpClient.removeConnection', async (item?: SftpTreeItem) => {
    const state = item
      ? connectionManager.get(item.connectionId)
      : await pickConnection(connectionManager);
    if (!state) return;

    const answer = await vscode.window.showWarningMessage(
      `Remove connection "${state.config.name}"?`,
      { modal: true },
      'Remove',
    );
    if (answer !== 'Remove') return;
    await connectionManager.remove(state.config.id);
  });

  // Connect
  reg('sftpClient.connect', async (item?: SftpTreeItem) => {
    const state = item
      ? connectionManager.get(item.connectionId)
      : await pickConnection(connectionManager, 'disconnected');
    if (!state) return;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Connecting to ${state.config.name}…` },
      async () => {
        try {
          await connectionManager.connect(state.config.id);
          vscode.window.showInformationMessage(`SFTP: Connected to ${state.config.name}.`);
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `SFTP: Could not connect to ${state.config.name}: ${err instanceof Error ? err.message : err}`,
          );
        }
      },
    );
  });

  // Disconnect
  reg('sftpClient.disconnect', async (item?: SftpTreeItem) => {
    const state = item
      ? connectionManager.get(item.connectionId)
      : await pickConnection(connectionManager, 'connected');
    if (!state) return;
    await connectionManager.disconnect(state.config.id);
  });

  // Refresh tree
  reg('sftpClient.refresh', () => treeProvider.refresh());

  // New file
  reg('sftpClient.newFile', async (item?: SftpTreeItem) => {
    if (!item) return;
    const name = await vscode.window.showInputBox({
      title: 'New File',
      prompt: 'File name',
      validateInput: v => (v.trim() ? undefined : 'Name is required'),
    });
    if (!name) return;

    const remotePath = path.posix.join(item.remotePath, name.trim());
    const uri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: remotePath });

    try {
      await fsProvider.writeFile(uri, new Uint8Array(0), { create: true, overwrite: false });
      treeProvider.refresh();
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`SFTP: Failed to create file: ${err instanceof Error ? err.message : err}`);
    }
  });

  // New folder
  reg('sftpClient.newFolder', async (item?: SftpTreeItem) => {
    if (!item) return;
    const name = await vscode.window.showInputBox({
      title: 'New Folder',
      prompt: 'Folder name',
      validateInput: v => (v.trim() ? undefined : 'Name is required'),
    });
    if (!name) return;

    const remotePath = path.posix.join(item.remotePath, name.trim());
    const uri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: remotePath });

    try {
      await fsProvider.createDirectory(uri);
      treeProvider.refresh();
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`SFTP: Failed to create folder: ${err instanceof Error ? err.message : err}`);
    }
  });

  // Rename
  reg('sftpClient.rename', async (item?: SftpTreeItem) => {
    if (!item) return;
    const oldName = path.posix.basename(item.remotePath);
    const newName = await vscode.window.showInputBox({
      title: 'Rename',
      value: oldName,
      validateInput: v => (v.trim() && v.trim() !== oldName ? undefined : v.trim() === oldName ? 'Enter a different name' : 'Name is required'),
    });
    if (!newName) return;

    const newPath = path.posix.join(path.posix.dirname(item.remotePath), newName.trim());
    const oldUri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: item.remotePath });
    const newUri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: newPath });

    try {
      await fsProvider.rename(oldUri, newUri, { overwrite: false });
      treeProvider.refresh();
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`SFTP: Rename failed: ${err instanceof Error ? err.message : err}`);
    }
  });

  // Delete
  reg('sftpClient.delete', async (item?: SftpTreeItem) => {
    if (!item) return;
    const answer = await vscode.window.showWarningMessage(
      `Delete "${path.posix.basename(item.remotePath)}" on the remote server?`,
      { modal: true },
      'Delete',
    );
    if (answer !== 'Delete') return;

    const uri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: item.remotePath });
    try {
      await fsProvider.delete(uri, { recursive: true });
      treeProvider.refresh();
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`SFTP: Delete failed: ${err instanceof Error ? err.message : err}`);
    }
  });

  // Download file to local workspace
  reg('sftpClient.download', async (item?: SftpTreeItem) => {
    if (!item || item.itemType !== 'file') return;
    const fileName = path.posix.basename(item.remotePath);
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(os.homedir(), fileName)),
      saveLabel: 'Download',
    });
    if (!saveUri) return;

    const remoteUri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: item.remotePath });
    try {
      const data = await fsProvider.readFile(remoteUri);
      fs.writeFileSync(saveUri.fsPath, data);
      vscode.window.showInformationMessage(`Downloaded to ${saveUri.fsPath}`);
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`SFTP: Download failed: ${err instanceof Error ? err.message : err}`);
    }
  });

  // Upload local file to remote directory
  reg('sftpClient.upload', async (item?: SftpTreeItem) => {
    if (!item) return;
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Upload',
    });
    if (!uris?.length) return;
    const localPath = uris[0].fsPath;
    const remotePath = path.posix.join(item.remotePath, path.basename(localPath));
    const remoteUri = vscode.Uri.from({ scheme: 'sftp', authority: item.connectionId, path: remotePath });

    try {
      const data = fs.readFileSync(localPath);
      await fsProvider.writeFile(remoteUri, new Uint8Array(data), { create: true, overwrite: true });
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Uploaded to ${remotePath}`);
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`SFTP: Upload failed: ${err instanceof Error ? err.message : err}`);
    }
  });

  // Copy remote path to clipboard
  reg('sftpClient.copyPath', async (item?: SftpTreeItem) => {
    if (!item) return;
    await vscode.env.clipboard.writeText(item.remotePath);
    vscode.window.showInformationMessage(`Copied: ${item.remotePath}`);
  });

  // Open SSH terminal
  reg('sftpClient.openSshTerminal', async (item?: SftpTreeItem) => {
    const state = item
      ? connectionManager.get(item.connectionId)
      : await pickConnection(connectionManager, 'connected');
    if (!state) return;

    const { config } = state;
    const terminal = vscode.window.createTerminal({
      name: `SSH: ${config.name}`,
      shellPath: '/bin/sh',
      shellArgs: ['-c', `ssh -p ${config.port ?? 22} ${config.username}@${config.host}`],
    });
    terminal.show();
  });

  // Set connection color
  reg('sftpClient.setConnectionColor', async (item?: SftpTreeItem) => {
    const state = item
      ? connectionManager.get(item.connectionId)
      : await pickConnection(connectionManager);
    if (!state) return;

    const colors = [
      { label: '🟡  Yellow (default)', color: 'terminal.ansiYellow' },
      { label: '🩵  Cyan',             color: 'terminal.ansiCyan' },
      { label: '🟢  Green',            color: 'terminal.ansiGreen' },
      { label: '🔴  Red',              color: 'terminal.ansiRed' },
      { label: '🟣  Purple',           color: 'charts.purple' },
      { label: '🟠  Orange',           color: 'charts.orange' },
      { label: '🔵  Blue',             color: 'terminal.ansiBrightBlue' },
      { label: '⚪  White',            color: 'terminal.ansiBrightWhite' },
      { label: '🎨  Custom hex / RGB…', color: '__custom__' },
    ];

    const choice = await vscode.window.showQuickPick(colors, {
      title: `Tab color for "${state.config.name}"`,
      placeHolder: 'Pick a color for this connection\'s files',
    });
    if (!choice) return;

    let colorId = choice.color;

    if (choice.color === '__custom__') {
      const input = await vscode.window.showInputBox({
        title: 'Custom Color',
        prompt: 'Enter hex (#ff0000, #f00) or RGB (rgb(255,0,0))',
        placeHolder: '#ff0000',
        validateInput: v => (parseToHex(v) ? undefined : 'Invalid color - example: #ff0000 or rgb(255,0,0)'),
      });
      if (!input) return;
      const hex = parseToHex(input)!;
      colorId = await applyCustomColor(state.config.id, hex);
    }

    await connectionManager.save({ ...state.config, color: colorId });
  });

  // ── Editor toolbar: Discard / Reload / Upload / Diff ────────────────────

  // Discard changes - reverts to locally cached content (from last open or upload), no server call
  reg('sftpClient.discardChanges', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'sftp') return;

    if (!editor.document.isDirty) {
      vscode.window.showInformationMessage('No local changes to discard.');
      return;
    }

    const cached = cleanContent.get(editor.document.uri.toString());
    if (cached === undefined) {
      vscode.window.showWarningMessage('No cached version available. Use Reload from Server instead.');
      return;
    }

    const answer = await vscode.window.showWarningMessage(
      'Discard all local changes?',
      { modal: true },
      'Discard',
    );
    if (answer !== 'Discard') return;

    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(editor.document.uri, fullRange, cached);
    await vscode.workspace.applyEdit(edit);
    await editor.document.save();
  });

  // Reload from server - discards local edits, fetches fresh content
  reg('sftpClient.reloadFromServer', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'sftp') return;

    if (editor.document.isDirty) {
      const answer = await vscode.window.showWarningMessage(
        'Discard local changes and reload from server?',
        { modal: true },
        'Reload',
      );
      if (answer !== 'Reload') return;
    }

    const data = await fsProvider.readFile(editor.document.uri);
    const text = new TextDecoder().decode(data);
    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(editor.document.uri, fullRange, text);
    await vscode.workspace.applyEdit(edit);
    await editor.document.save();
  });

  // Upload to server - saves document through VS Code's normal save flow
  reg('sftpClient.uploadToServer', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'sftp') return;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Uploading to server...', cancellable: false },
      async () => {
        await editor.document.save();
      },
    );
    vscode.window.showInformationMessage(`Uploaded: ${editor.document.uri.path}`);
  });

  // Diff: left = fresh server version, right = current editor (with local edits)
  reg('sftpClient.diffWithRemote', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'sftp') return;

    const uri = editor.document.uri;
    const fileName = path.posix.basename(uri.path);
    // sftp-remote:// always fetches a fresh copy from the server
    const remoteUri = uri.with({ scheme: 'sftp-remote' });

    await vscode.commands.executeCommand(
      'vscode.diff',
      remoteUri,
      uri,
      `${fileName}: Remote (server) ↔ Local (your changes)`,
      { preview: true },
    );
  });

  // Cleanup
  context.subscriptions.push(connectionManager, fsProvider, treeProvider);
}

export function deactivate(): void {
  // Subscriptions are disposed automatically by VS Code
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function pickConnection(
  manager: ConnectionManager,
  filterStatus?: 'connected' | 'disconnected',
) {
  const all = manager
    .getAll()
    .filter(s => !filterStatus || s.status === filterStatus);

  if (!all.length) {
    vscode.window.showWarningMessage('No matching connections found.');
    return undefined;
  }
  if (all.length === 1) return all[0];

  const choice = await vscode.window.showQuickPick(
    all.map(s => ({ label: s.config.name, description: `${s.config.host}`, state: s })),
    { placeHolder: 'Select a connection' },
  );
  return choice?.state;
}
