# SFTP Klijent

VS Code ekstenzija za pregledanje i editovanje udaljenih fajlova putem SFTP-a, sa podrškom za više konekcija.

## Funkcionalnosti

- Prikaz stabla udaljenih fajlova u activity bar-u, pored lokalnog workspace-a
- Nativno editovanje fajlova - otvaraj, edituj i cuvaj udaljene fajlove direktno u VS Code-u
- Vise SFTP konekcija sa razlicitom bojom tabova po konekciji
- Konekcije mogu biti globalne (svi workspace-ovi) ili specificne za workspace
- Sve CRUD operacije: kreiranje, preimenovanje, brisanje fajlova i foldera
- Upload lokalnih fajlova na server, download sa servera
- Lozinke i passphrase-ovi se cuvaju bezbedno u sistemskom keychain-u

---

## Dodavanje konekcije

Klikni na **`+`** dugme u SFTP Remote Explorer toolbar-u. Otvori se forma sa svim poljima:

| Polje | Opis |
|---|---|
| Connection Name | Naziv koji se prikazuje u stablu |
| Host | Hostname ili IP adresa |
| Port | SSH port (podrazumevano: 22) |
| Username | SSH korisnicko ime |
| Authentication | Lozinka ili privatni kljuc |
| Remote Root Path | Pocetni direktorijum (podrazumevano: `/`) |
| Scope | **Global** - dostupno u svim workspace-ovima; **Workspace** - samo u trenutnom projektu |
| Tab Color | Boja koja se primenjuje na tabove fajlova ove konekcije |

---

## Uvoz konekcija iz JSON-a

Mozete uvesti jednu ili vise konekcija iz `.json` fajla umesto rucnog popunjavanja forme.

### Kako uvesti

1. Klikni na ikonu **`</>`** (Import) u SFTP Remote Explorer toolbar-u, ili pokreni `SFTP: Import Connection from JSON` iz Command Palette-a (`Ctrl+Shift+P`).
2. Izaberi `.json` fajl.
3. Ako fajl sadrzi vise konekcija, pojavljuje se picker - izaberi koju zelis da uvezas.
4. Forma se otvara **popunjena** podacima iz fajla. Pregledaj, unesi lozinku/passphrase i klikni **Save**.

> **Napomena:** Lozinke i passphrase-ovi se nikad ne cuvaju u JSON fajlovima. Uvek ces ih morati rucno uneti u formu nakon uvoza.

### Jedna konekcija

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

### Vise konekcija

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

### Autentifikacija privatnim kljucem

```json
{
  "name": "Moj Server",
  "host": "example.com",
  "port": 22,
  "username": "admin",
  "remotePath": "/home/admin",
  "privateKeyPath": "~/.ssh/id_rsa",
  "scope": "workspace"
}
```

### Sva podrzana polja

| Polje | Tip | Podrazumevano | Opis |
|---|---|---|---|
| `name` | string | - | Naziv konekcije **(obavezno)** |
| `host` | string | - | Hostname ili IP **(obavezno)** |
| `port` | number | `22` | SSH port |
| `username` | string | - | SSH korisnicko ime **(obavezno)** |
| `remotePath` | string | `/` | Pocetni direktorijum |
| `privateKeyPath` | string | - | Putanja do privatnog kljuca (`~` podrzano) |
| `scope` | `"global"` \| `"workspace"` | `"global"` | Vidljivost konekcije |
| `color` | string | `"terminal.ansiCyan"` | ID boje teme za tabove |

---

## Boje tabova

Desni klik na konekciju u stablu → **Set Tab Color** za izbor boje. Fajlovi te konekcije ce imati oznacen tab u editoru.

Dostupne boje: Cyan, Zelena, Zuta, Crvena, Ljubicasta, Narandzasta, Plava, Bela.

---

## Precice na tastaturi

Nema podrazumevanih precica. Mozete dodeliti precice preko `Preferences: Open Keyboard Shortcuts` pretragom za `SFTP`.

> **Napomena:** `Ctrl+S` je namerno blokiran za udaljene fajlove - koristite dugme **Upload to Server** u toolbar-u editora.

---

## Izgradnja VSIX paketa

### Preduslovi

- [Node.js](https://nodejs.org) (v18 ili noviji)
- [vsce](https://github.com/microsoft/vscode-vsce): `npm install -g @vscode/vsce`

### Koraci

```bash
# 1. Kloniraj repozitorijum
git clone https://github.com/isidora-stanic/vscode-ssh-client.git
cd sftp-client

# 2. Instaliraj zavisnosti
npm install

# 3. Izgradnja i pakovanje
vsce package --no-dependencies
```

Ovo kreira fajl `sftp-client-0.1.0.vsix` u root direktorijumu projekta.

### Instalacija VSIX-a

U VS Code-u, Cursor-u, ili bilo kom VS Code kompatibilnom editoru:

1. Otvori Extensions panel (`Ctrl+Shift+X`)
2. Klikni na meni `...` (gore desno)
3. Izaberi **Install from VSIX...**
4. Izaberi `.vsix` fajl
