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

## How to Use

### 1. Installation

**Option A - Download (recommended):**
Download the `.vsix` file from the latest release. No build tools required.

[![Latest Release](https://img.shields.io/github/v/release/isidora-stanic/vscode-ssh-client?label=latest&color=blue)](https://github.com/isidora-stanic/vscode-ssh-client/releases/latest)

**Option B - Build from source:**
See [Building the VSIX Package](#building-the-vsix-package) at the bottom of this page.

Then install it in VS Code, Cursor, or any VS Code-compatible editor:

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Click the `...` menu (top right of the panel)
3. Select **Install from VSIX...**
4. Pick the `.vsix` file

After installation, the **SFTP Client** icon appears in the activity bar on the left side.

<!-- screenshot: activity bar icon -->

---

### 2. Creating a Connection

1. Click the **SFTP Client** icon in the activity bar to open the Remote Explorer panel
2. Click the **`+`** button in the panel toolbar
3. Fill in the connection form:

<!-- screenshot: connection form -->

| Field | Description |
|---|---|
| Connection Name | Display label shown in the tree |
| Host | Hostname or IP address of the remote server |
| Port | SSH port (default: 22) |
| Username | SSH login username |
| Authentication | Choose **Password** or **Private Key** |
| Password / Key Path | Your password, or the path to your private key file (e.g. `~/.ssh/id_rsa`) |
| Remote Root Path | The directory to open on the server (default: `/`) |
| Scope | **Global** - available in all workspaces; **Workspace** - only in the current project |
| Tab Color | Color applied to editor tabs when files from this connection are open |

4. Click **Save**. The connection appears in the Remote Explorer tree.

---

### 3. Connecting and Browsing Files

1. In the Remote Explorer, right-click a connection → **Connect**, or simply click the arrow next to its name
2. Once connected, the file tree expands showing the remote directory structure
3. Click any folder to expand it and browse its contents
4. Click any file to open it in the editor

<!-- screenshot: file tree expanded -->

> Connections remain active until you disconnect or close VS Code. On next launch, you need to reconnect manually.

---

### 4. Editing Remote Files

Click any file in the Remote Explorer to open it. The file opens in the editor just like a local file.

<!-- screenshot: file open in editor -->

The editor toolbar shows four action buttons for remote files:

| Button | Action |
|---|---|
| **Discard Changes** | Revert all unsaved edits back to the last uploaded version (does not fetch from server) |
| **Reload from Server** | Fetch the latest version from the server and replace the local buffer |
| **Upload to Server** | Save and upload the current file to the server |
| **Diff with Remote** | Compare your local edits side-by-side with the current server version |

> **Note:** `Ctrl+S` is intentionally disabled for remote files. Use the **Upload to Server** button to save your changes to the server.

---

### 5. Creating Files and Folders

Right-click a connection or any folder in the tree:

- **New File** - prompts for a file name and creates an empty file on the server
- **New Folder** - prompts for a folder name and creates it on the server

<!-- screenshot: right-click context menu -->

---

### 6. Renaming and Deleting

Right-click any file or folder in the tree:

- **Rename** - prompts for a new name and renames it on the server
- **Delete** - asks for confirmation, then permanently deletes the file or folder (including all contents for folders)

---

### 7. Uploading a Local File to the Server

Right-click a connection or folder in the tree → **Upload File**.

A file picker opens. Select a local file and it will be uploaded to that location on the server.

---

### 8. Downloading a Remote File

Right-click any file in the tree → **Download**.

A save dialog opens. Choose where to save the file locally.

---

### 9. Opening an SSH Terminal

Right-click a connected connection → **Open SSH Terminal**.

A new terminal tab opens with an SSH session to that server using the same credentials.

<!-- screenshot: SSH terminal -->

---

### 10. Setting Tab Colors

Right-click any connection → **Set Tab Color**.

Choose from preset colors or enter a custom hex or RGB value (e.g. `#e040fb` or `rgb(224, 64, 251)`). Files from that connection will display a colored indicator in their editor tabs.

<!-- screenshot: colored tabs -->

Available preset colors: Cyan, Green, Yellow, Red, Purple, Orange, Blue, White.

---

### 11. Editing and Removing Connections

Right-click any connection in the tree:

- **Edit Connection** - reopens the connection form pre-filled with existing values. Enter a new password only if you want to change it.
- **Remove Connection** - permanently removes the connection from the list (does not affect files on the server)

---

### 12. Copying a Remote Path

Right-click any file or folder → **Copy Remote Path**.

The full remote path is copied to the clipboard (e.g. `/var/www/html/index.php`).

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

Right-click any connection in the tree → **Set Tab Color** to pick a color. Files from that connection will have a colored label in editor tabs.

Available colors: Cyan, Green, Yellow, Red, Purple, Orange, Blue, White.

---

## Keyboard Shortcuts

No default keybindings. You can assign shortcuts via `Preferences: Open Keyboard Shortcuts` and searching for `SFTP`.

> `Ctrl+S` is intentionally disabled for remote files - use the **Upload to Server** button in the editor toolbar instead.

---

## Building the VSIX Package

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or newer)
- [vsce](https://github.com/microsoft/vscode-vsce): `npm install -g @vscode/vsce`

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/isidora-stanic/vscode-ssh-client.git
cd vscode-ssh-client

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
