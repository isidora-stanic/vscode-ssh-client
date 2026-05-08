import * as vscode from 'vscode';
import { SftpConnectionConfig } from './types';

export interface ConnectionFormResult {
  config: SftpConnectionConfig;
  password?: string;
  passphrase?: string;
}

const COLOR_OPTIONS = [
  { id: 'terminal.ansiYellow', label: 'Yellow (default)', hex: '#ffeb3b' },
  { id: 'terminal.ansiCyan', label: 'Cyan', hex: '#00bcd4' },
  { id: 'terminal.ansiGreen', label: 'Green', hex: '#4caf50' },
  { id: 'terminal.ansiRed', label: 'Red', hex: '#f44336' },
  { id: 'charts.purple', label: 'Purple', hex: '#9c27b0' },
  { id: 'charts.orange', label: 'Orange', hex: '#ff9800' },
  { id: 'terminal.ansiBrightBlue', label: 'Blue', hex: '#2196f3' },
  { id: 'terminal.ansiBrightWhite', label: 'White', hex: '#e0e0e0' },
];

export function openConnectionForm(
  context: vscode.ExtensionContext,
  existing?: Partial<SftpConnectionConfig>,
): Promise<ConnectionFormResult | undefined> {
  return new Promise(resolve => {
    const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
    const isEdit = !!(existing?.id);

    const panel = vscode.window.createWebviewPanel(
      'sftpConnectionForm',
      isEdit ? `Edit: ${existing!.name}` : 'New SFTP Connection',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    panel.webview.html = buildHtml(existing ?? {}, hasWorkspace);

    panel.webview.onDidReceiveMessage(
      (msg: { type: string; data?: ConnectionFormResult }) => {
        if (msg.type === 'save' && msg.data) {
          resolve(msg.data);
          panel.dispose();
        } else if (msg.type === 'cancel') {
          resolve(undefined);
          panel.dispose();
        }
      },
      undefined,
      context.subscriptions,
    );

    panel.onDidDispose(() => resolve(undefined));
  });
}

function buildHtml(data: Partial<SftpConnectionConfig>, hasWorkspace: boolean): string {
  const v = {
    id: data.id ?? '',
    name: data.name ?? '',
    host: data.host ?? '',
    port: data.port ?? 22,
    username: data.username ?? '',
    remotePath: data.remotePath ?? '/',
    scope: data.scope ?? 'global',
    color: data.color ?? 'terminal.ansiYellow',
    privateKeyPath: data.privateKeyPath ?? '',
    authType: data.privateKeyPath ? 'privateKey' : 'password',
  };

  const colorSwatches = COLOR_OPTIONS.map(c => `
    <div class="swatch ${c.id === v.color ? 'selected' : ''}"
         data-color="${c.id}"
         style="background:${c.hex}"
         title="${c.label}">
    </div>`).join('');

  const workspaceOption = hasWorkspace
    ? `<option value="workspace" ${v.scope === 'workspace' ? 'selected' : ''}>Workspace only</option>`
    : '';

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 24px 32px;
    max-width: 560px;
  }

  h2 {
    font-size: 1.2em;
    font-weight: 600;
    margin-bottom: 20px;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-widget-border, #444);
    padding-bottom: 10px;
  }

  .form-grid {
    display: grid;
    gap: 14px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 100px;
    gap: 12px;
  }

  label {
    display: block;
    font-size: 0.85em;
    font-weight: 500;
    margin-bottom: 5px;
    color: var(--vscode-foreground);
    opacity: 0.85;
  }

  input[type=text],
  input[type=number],
  input[type=password],
  select {
    width: 100%;
    padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 3px;
    font-family: inherit;
    font-size: inherit;
    outline: none;
  }

  input:focus, select:focus {
    border-color: var(--vscode-focusBorder);
  }

  .hint {
    font-size: 0.78em;
    opacity: 0.6;
    margin-top: 4px;
  }

  .radio-row {
    display: flex;
    gap: 20px;
    align-items: center;
    padding: 4px 0;
  }

  .radio-row label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    cursor: pointer;
    opacity: 1;
    font-weight: 400;
  }

  input[type=radio] { cursor: pointer; }

  .color-swatches {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 4px 0;
  }

  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    transition: transform 0.1s, border-color 0.1s;
  }

  .swatch:hover { transform: scale(1.15); }

  .swatch.selected {
    border-color: var(--vscode-focusBorder);
    transform: scale(1.2);
  }

  .hidden { display: none !important; }

  .divider {
    border: none;
    border-top: 1px solid var(--vscode-widget-border, #444);
    margin: 4px 0;
  }

  .actions {
    display: flex;
    gap: 10px;
    padding-top: 8px;
  }

  button {
    padding: 7px 18px;
    border: none;
    border-radius: 3px;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
  }

  #saveBtn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  #saveBtn:hover { background: var(--vscode-button-hoverBackground); }

  #cancelBtn {
    background: var(--vscode-button-secondaryBackground, #3a3a3a);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }

  #cancelBtn:hover { background: var(--vscode-button-secondaryHoverBackground, #4a4a4a); }

  .error {
    color: var(--vscode-inputValidation-errorForeground, #f44);
    font-size: 0.82em;
    margin-top: 4px;
  }
</style>
</head>
<body>
<h2>🔗 ${v.id ? 'Edit Connection' : 'New SFTP Connection'}</h2>
<form class="form-grid" id="form" novalidate>
  <input type="hidden" id="connId" value="${v.id}">

  <div>
    <label for="name">Connection Name *</label>
    <input type="text" id="name" value="${esc(v.name)}" placeholder="My Server" required>
    <div class="error hidden" id="nameErr">Name is required</div>
  </div>

  <div class="row">
    <div>
      <label for="host">Host *</label>
      <input type="text" id="host" value="${esc(v.host)}" placeholder="192.168.1.1" required>
      <div class="error hidden" id="hostErr">Host is required</div>
    </div>
    <div>
      <label for="port">Port</label>
      <input type="number" id="port" value="${v.port}" min="1" max="65535">
    </div>
  </div>

  <div>
    <label for="username">Username *</label>
    <input type="text" id="username" value="${esc(v.username)}" placeholder="root" required autocomplete="off">
    <div class="error hidden" id="usernameErr">Username is required</div>
  </div>

  <hr class="divider">

  <div>
    <label>Authentication</label>
    <div class="radio-row">
      <label>
        <input type="radio" name="authType" value="password" ${v.authType === 'password' ? 'checked' : ''}>
        Password
      </label>
      <label>
        <input type="radio" name="authType" value="privateKey" ${v.authType === 'privateKey' ? 'checked' : ''}>
        Private Key
      </label>
    </div>
  </div>

  <div id="passwordSection" class="${v.authType === 'privateKey' ? 'hidden' : ''}">
    <label for="password">Password</label>
    <input type="password" id="password" autocomplete="new-password" placeholder="Leave empty to keep existing">
    <div class="hint">Stored securely in system keychain, not in settings</div>
  </div>

  <div id="keySection" class="${v.authType === 'password' ? 'hidden' : ''}">
    <div>
      <label for="privateKeyPath">Private Key Path</label>
      <input type="text" id="privateKeyPath" value="${esc(v.privateKeyPath)}" placeholder="~/.ssh/id_rsa">
    </div>
    <div style="margin-top:10px">
      <label for="passphrase">Passphrase (optional)</label>
      <input type="password" id="passphrase" autocomplete="new-password" placeholder="Leave empty to keep existing">
    </div>
  </div>

  <hr class="divider">

  <div>
    <label for="remotePath">Remote Root Path</label>
    <input type="text" id="remotePath" value="${esc(v.remotePath)}" placeholder="/">
  </div>

  <div>
    <label for="scope">Scope</label>
    <select id="scope">
      <option value="global" ${v.scope === 'global' ? 'selected' : ''}>Global (all workspaces)</option>
      ${workspaceOption}
    </select>
  </div>

  <div>
    <label>Tab Color</label>
    <div class="color-swatches" id="colorSwatches">
      ${colorSwatches}
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
      <input type="text" id="customColor" placeholder="#ff0000 or rgb(255,0,0)"
             style="flex:1" value="${v.color?.startsWith('sftpClient.') ? '' : (!COLOR_OPTIONS.find(c => c.id === v.color) ? (v.color ?? '') : '')}">
      <div id="colorPreview" style="width:24px;height:24px;border-radius:4px;border:1px solid #555;flex-shrink:0"></div>
    </div>
    <div class="hint">Enter hex or RGB to use a custom color - overrides the selected swatch</div>
    <div class="error hidden" id="colorErr">Invalid color (example: #ff0000 or rgb(255,0,0))</div>
  </div>

  <div class="actions">
    <button type="submit" id="saveBtn">Save</button>
    <button type="button" id="cancelBtn">Cancel</button>
  </div>
</form>

<script>
  const vscode = acquireVsCodeApi();
  let selectedColor = ${JSON.stringify(v.color)};
  let customHex = null;

  // Parse hex / rgb string → #rrggbb or null
  function parseColor(s) {
    s = s.trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      const [,r,g,b] = s.match(/^#(.)(.)(.)$/);
      return ('#'+r+r+g+g+b+b).toLowerCase();
    }
    const m = s.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (m && +m[1]<=255 && +m[2]<=255 && +m[3]<=255) {
      return '#' + [+m[1],+m[2],+m[3]].map(n=>n.toString(16).padStart(2,'0')).join('');
    }
    return null;
  }

  // Auth type toggle
  document.querySelectorAll('input[name=authType]').forEach(r => {
    r.addEventListener('change', () => {
      const isPwd = document.querySelector('input[name=authType]:checked').value === 'password';
      document.getElementById('passwordSection').classList.toggle('hidden', !isPwd);
      document.getElementById('keySection').classList.toggle('hidden', isPwd);
    });
  });

  // Color swatches
  document.getElementById('colorSwatches').addEventListener('click', e => {
    const swatch = e.target.closest('.swatch');
    if (!swatch) return;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    selectedColor = swatch.dataset.color;
    customHex = null;
    document.getElementById('customColor').value = '';
    document.getElementById('colorPreview').style.background = '';
    document.getElementById('colorErr').classList.add('hidden');
  });

  // Custom color input
  document.getElementById('customColor').addEventListener('input', e => {
    const val = e.target.value;
    const hex = val ? parseColor(val) : null;
    const errEl = document.getElementById('colorErr');
    const preview = document.getElementById('colorPreview');
    if (!val) {
      errEl.classList.add('hidden');
      preview.style.background = '';
      customHex = null;
      return;
    }
    if (hex) {
      errEl.classList.add('hidden');
      preview.style.background = hex;
      customHex = hex;
      // Deselect swatches when custom color is typed
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    } else {
      errEl.classList.remove('hidden');
      preview.style.background = '';
      customHex = null;
    }
  });

  // Form submit
  document.getElementById('form').addEventListener('submit', e => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const host = document.getElementById('host').value.trim();
    const username = document.getElementById('username').value.trim();

    document.getElementById('nameErr').classList.toggle('hidden', !!name);
    document.getElementById('hostErr').classList.toggle('hidden', !!host);
    document.getElementById('usernameErr').classList.toggle('hidden', !!username);

    const customVal = document.getElementById('customColor').value;
    if (customVal && !customHex) {
      document.getElementById('colorErr').classList.remove('hidden');
      return;
    }
    if (!name || !host || !username) return;

    const authType = document.querySelector('input[name=authType]:checked').value;
    const password = document.getElementById('password').value;
    const passphrase = document.getElementById('passphrase').value;
    const connId = document.getElementById('connId').value;

    const config = {
      id: connId || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9)),
      name,
      host,
      port: parseInt(document.getElementById('port').value) || 22,
      username,
      remotePath: document.getElementById('remotePath').value.trim() || '/',
      scope: document.getElementById('scope').value,
      // customHex is sent as-is; extension will convert it to a slot ThemeColor ID
      color: customHex ? { __customHex: customHex, __connId: connId } : selectedColor,
      privateKeyPath: authType === 'privateKey' ? document.getElementById('privateKeyPath').value.trim() : undefined,
    };

    vscode.postMessage({
      type: 'save',
      data: {
        config,
        password: authType === 'password' && password ? password : undefined,
        passphrase: authType === 'privateKey' && passphrase ? passphrase : undefined,
      }
    });
  });

  document.getElementById('cancelBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
