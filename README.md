# SFTP Client

VS Code extension for browsing and editing remote files over SFTP, with multi-connection support.

## Features

- Remote file tree view in the activity bar, alongside your local workspace
- Native file editing - open, edit, and save remote files directly in VS Code
- Multiple SFTP connections with per-connection tab colors
- Connections can be global (all workspaces) or workspace-specific
- Full CRUD: create, rename, delete files and folders
- Upload local files to remote, download remote files locally
- Passwords and passphrases stored securely in the system keychain

---

## Adding a Connection

Click the **`+`** button in the SFTP Remote Explorer toolbar. A form opens with all fields:

| Field | Description |
|---|---|
| Connection Name | Display label shown in the tree |
| Host | Hostname or IP address |
| Port | SSH port (default: 22) |
| Username | SSH login username |
| Authentication | Password or Private Key |
| Remote Root Path | Starting directory (default: `/`) |
| Scope | **Global** - available in all workspaces; **Workspace** - only in the current project |
| Tab Color | Color applied to file tabs when this connection's files are open |

---

## Importing Connections from JSON

You can import one or more connections from a `.json` file instead of filling the form manually.

### How to import

1. Click the **`</>`** (Import) icon in the SFTP Remote Explorer toolbar, or run `SFTP: Import Connection from JSON` from the Command Palette (`Ctrl+Shift+P`).
2. Pick your `.json` file.
3. If the file contains multiple connections, a picker appears - choose which one to import.
4. The connection form opens **pre-filled** with the data from the file. Review, enter your password/passphrase, and click **Save**.

> **Note:** Passwords and passphrases are never stored in JSON files. You will always need to enter them manually in the form after import.

### Single connection

```json
{
  "name": "Production",
  "host": "192.168.1.100",
  "port": 22,
  "username": "deploy",
  "remotePath": "/var/www/html",
  "scope": "global"
}
```

### Multiple connections

```json
[
  {
    "name": "Production",
    "host": "prod.example.com",
    "port": 22,
    "username": "deploy",
    "remotePath": "/var/www/html"
  },
  {
    "name": "Staging",
    "host": "staging.example.com",
    "port": 22,
    "username": "deploy",
    "remotePath": "/var/www/html"
  }
]
```

### Private key authentication

```json
{
  "name": "My Server",
  "host": "example.com",
  "port": 22,
  "username": "admin",
  "remotePath": "/home/admin",
  "privateKeyPath": "~/.ssh/id_rsa",
  "scope": "workspace"
}
```

### All supported fields

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | - | Display name **(required)** |
| `host` | string | - | Hostname or IP **(required)** |
| `port` | number | `22` | SSH port |
| `username` | string | - | SSH username **(required)** |
| `remotePath` | string | `/` | Root directory to open |
| `privateKeyPath` | string | - | Path to private key file (`~` supported) |
| `scope` | `"global"` \| `"workspace"` | `"global"` | Connection visibility |
| `color` | string | `"terminal.ansiCyan"` | Tab color theme ID |

---

## Tab Colors

Right-click any connection in the tree → **Set Tab Color** to pick a color. Files from that connection will have a colored label in editor tabs and an `⚠` badge.

Available colors: Cyan, Green, Yellow, Red, Purple, Orange, Blue, White.

---

## Keyboard Shortcuts

No default keybindings. You can assign shortcuts via `Preferences: Open Keyboard Shortcuts` and searching for `SFTP`.

---

## Building the VSIX Package

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or newer)
- [vsce](https://github.com/microsoft/vscode-vsce): `npm install -g @vscode/vsce`

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/isidora-stanic/vscode-ssh-client.git
cd sftp-client

# 2. Install dependencies
npm install

# 3. Build and package
vsce package --no-dependencies
```

This produces a `sftp-client-0.1.0.vsix` file in the project root.

### Install the VSIX

In VS Code, Cursor, or any VS Code-compatible editor:

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Click the `...` menu (top right)
3. Select **Install from VSIX...**
4. Pick the `.vsix` file
