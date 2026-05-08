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

## Kako koristiti

### 1. Instalacija

**Opcija A - Preuzimanje (preporuceno):**
Preuzmi `.vsix` fajl iz poslednjeg release-a. Nisu potrebni nikakvi alati za izgradnju.

[![Poslednji release](https://img.shields.io/github/v/release/isidora-stanic/vscode-ssh-client?label=poslednji&color=blue)](https://github.com/isidora-stanic/vscode-ssh-client/releases/latest)

**Opcija B - Izgradnja iz izvora:**
Pogledaj sekciju [Izgradnja VSIX paketa](#izgradnja-vsix-paketa) na dnu ove stranice.

Zatim instaliraj u VS Code-u, Cursor-u, ili bilo kom VS Code kompatibilnom editoru:

1. Otvori Extensions panel (`Ctrl+Shift+X`)
2. Klikni na meni `...` (gore desno u panelu)
3. Izaberi **Install from VSIX...**
4. Izaberi `.vsix` fajl

Nakon instalacije, ikona **SFTP Klijent** se pojavljuje u activity bar-u na levoj strani.

<!-- screenshot: activity bar ikona -->

---

### 2. Kreiranje konekcije

1. Klikni na ikonu **SFTP Klijent** u activity bar-u da otvoriš Remote Explorer panel
2. Klikni na dugme **`+`** u toolbar-u panela
3. Popuni formu za konekciju:

<!-- screenshot: forma za konekciju -->

| Polje | Opis |
|---|---|
| Connection Name | Naziv koji se prikazuje u stablu |
| Host | Hostname ili IP adresa udaljenog servera |
| Port | SSH port (podrazumevano: 22) |
| Username | SSH korisnicko ime |
| Authentication | Izaberi **Password** ili **Private Key** |
| Password / Key Path | Lozinka, ili putanja do privatnog kljuca (npr. `~/.ssh/id_rsa`) |
| Remote Root Path | Direktorijum koji se otvara na serveru (podrazumevano: `/`) |
| Scope | **Global** - dostupno u svim workspace-ovima; **Workspace** - samo u trenutnom projektu |
| Tab Color | Boja koja se primenjuje na tabove editora kada su fajlovi ove konekcije otvoreni |

4. Klikni **Save**. Konekcija se pojavljuje u stablu Remote Explorer-a.

---

### 3. Konektovanje i pregledanje fajlova

1. U Remote Explorer-u, desni klik na konekciju → **Connect**, ili klikni na strelicu pored naziva
2. Kada se konektujes, stablo fajlova se prosiruje i prikazuje strukturu udaljenog direktorijuma
3. Klikni na bilo koji folder da ga prosiriš i pregledas sadrzaj
4. Klikni na bilo koji fajl da ga otvoriš u editoru

<!-- screenshot: prosireno stablo fajlova -->

> Konekcije ostaju aktivne dok se ne diskonektujes ili ne zatvoriš VS Code. Pri sledecern pokretanju potrebno je ponovo se konektovati.

---

### 4. Editovanje udaljenih fajlova

Klikni na bilo koji fajl u Remote Explorer-u da ga otvoriš. Fajl se otvara u editoru kao i lokalni fajl.

<!-- screenshot: fajl otvoren u editoru -->

Toolbar editora prikazuje cetiri akcijska dugmeta za udaljene fajlove:

| Dugme | Akcija |
|---|---|
| **Discard Changes** | Ponisti sve nesacuvane izmene i vrati na poslednju ucitanu verziju (ne povlaci sa servera) |
| **Reload from Server** | Povuci najnoviju verziju sa servera i zameni lokalni bafer |
| **Upload to Server** | Sacuvaj i uploaduj trenutni fajl na server |
| **Diff with Remote** | Uporedi lokalne izmene sa trenutnom verzijom na serveru prikaz jednu pored druge |

> **Napomena:** `Ctrl+S` je namerno blokiran za udaljene fajlove. Koristi dugme **Upload to Server** da sacuvas izmene na serveru.

---

### 5. Kreiranje fajlova i foldera

Desni klik na konekciju ili bilo koji folder u stablu:

- **New File** - trazi naziv fajla i kreira prazan fajl na serveru
- **New Folder** - trazi naziv foldera i kreira ga na serveru

<!-- screenshot: kontekstni meni desnog klika -->

---

### 6. Preimenovanje i brisanje

Desni klik na bilo koji fajl ili folder u stablu:

- **Rename** - trazi novi naziv i preimenuje na serveru
- **Delete** - trazi potvrdu, zatim trajno brise fajl ili folder (ukljucujuci sav sadrzaj za foldere)

---

### 7. Upload lokalnog fajla na server

Desni klik na konekciju ili folder u stablu → **Upload File**.

Otvara se birač fajlova. Izaberi lokalni fajl i on ce biti uploadovan na tu lokaciju na serveru.

---

### 8. Download udaljenog fajla

Desni klik na bilo koji fajl u stablu → **Download**.

Otvara se dijalog za cuvanje. Izaberi gde da sacuvas fajl lokalno.

---

### 9. Otvaranje SSH terminala

Desni klik na konektovanu konekciju → **Open SSH Terminal**.

Otvara se novi tab terminala sa SSH sesijom na tom serveru koristeci iste kredencijale.

<!-- screenshot: SSH terminal -->

---

### 10. Podesavanje boja tabova

Desni klik na bilo koju konekciju → **Set Tab Color**.

Izaberi iz predefinisanih boja ili unesi prilagodenu hex ili RGB vrednost (npr. `#e040fb` ili `rgb(224, 64, 251)`). Fajlovi te konekcije ce prikazivati oznacen tab u editoru.

<!-- screenshot: obojeni tabovi -->

Dostupne predefinisane boje: Cyan, Zelena, Zuta, Crvena, Ljubicasta, Narandzasta, Plava, Bela.

---

### 11. Editovanje i uklanjanje konekcija

Desni klik na bilo koju konekciju u stablu:

- **Edit Connection** - ponovo otvara formu popunjenu postojecim vrednostima. Unesi novu lozinku samo ako je zelis promeniti.
- **Remove Connection** - trajno uklanja konekciju sa liste (ne utice na fajlove na serveru)

---

### 12. Kopiranje udaljene putanje

Desni klik na bilo koji fajl ili folder → **Copy Remote Path**.

Puna udaljena putanja se kopira u clipboard (npr. `/var/www/html/index.php`).

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

> `Ctrl+S` je namerno blokiran za udaljene fajlove - koristi dugme **Upload to Server** u toolbar-u editora.

---

## Izgradnja VSIX paketa

### Preduslovi

- [Node.js](https://nodejs.org) (v18 ili noviji)
- [vsce](https://github.com/microsoft/vscode-vsce): `npm install -g @vscode/vsce`

### Koraci

```bash
# 1. Kloniraj repozitorijum
git clone https://github.com/isidora-stanic/vscode-ssh-client.git
cd vscode-ssh-client

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
