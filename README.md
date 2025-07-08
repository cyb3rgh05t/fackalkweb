# FAF Lackiererei - Rechnungs- und Auftragssystem

Ein modernes, webbasiertes System zur Verwaltung von Aufträgen und Rechnungen für Lackierereien, basierend auf der ursprünglichen Excel-Vorlage.

## 🌟 Features

### 📋 Auftragsverwaltung

- **Automatische Nummerierung** - Fortlaufende Auftragsnummern (A000001, A000002, ...)
- **Kundendatenverwaltung** - Vollständige Kundenstammdaten
- **Fahrzeugverwaltung** - Kennzeichen, Marke, Modell, VIN, Farben
- **Arbeitszeiten-Tracking** - Detaillierte Erfassung aller Arbeitsschritte
- **Automatische Berechnungen** - Kosten basierend auf Stundenpreis und Zeit
- **MwSt-Berechnung** - Automatische 19% MwSt-Berechnung

### 🧾 Rechnungserstellung

- **Automatische Nummerierung** - Fortlaufende Rechnungsnummern (R000001, R000002, ...)
- **Komplexe Preisberechnung** - Arbeitszeiten und Materialien getrennt
- **Flexibles MwSt-System** - 19% und 7% MwSt-Sätze
- **Rabatt-System** - Prozentuale Rabatte mit automatischer Neuberechnung
- **Deutsche Normen** - Entspricht deutschen Rechnungsstandards

### 🎨 Moderne Benutzeroberfläche

- **Dark Mode Design** - Augenschonende dunkle Oberfläche
- **Responsive Layout** - Funktioniert auf Desktop, Tablet und Mobile
- **Intuitive Navigation** - Einfache Bedienung ohne Schulung
- **Dashboard** - Übersicht über aktuelle Aufträge und Kennzahlen

### 🔧 Technische Features

- **SQLite Datenbank** - Keine komplexe Datenbankinstallation nötig
- **Automatische Backups** - Datensicherung
- **Erweiterbar** - Modularer Aufbau für neue Features
- **Sicherheit** - Moderne Sicherheitsstandards

## 🚀 Installation

### Voraussetzungen

- **Node.js** (Version 16 oder höher)
- **npm** (normalerweise mit Node.js installiert)

### 1. Repository klonen oder Dateien herunterladen

\`\`\`bash

# Falls Git verfügbar:

git clone <repository-url>
cd faf-lackiererei-system

# Oder: Dateien in einen neuen Ordner entpacken

\`\`\`

### 2. Abhängigkeiten installieren

\`\`\`bash
npm install
\`\`\`

### 3. Datenbank initialisieren

\`\`\`bash
npm run init-db
\`\`\`
Dieser Befehl:

- ✅ Erstellt die SQLite-Datenbank
- ✅ Legt alle nötigen Tabellen an
- ✅ Fügt Standardeinstellungen hinzu
- ✅ Erstellt Demo-Daten zum Testen

### 4. Server starten

\`\`\`bash
npm start
\`\`\`

### 5. Browser öffnen

Öffnen Sie [http://localhost:3000](http://localhost:3000) in Ihrem Browser.

## 📁 Projektstruktur

\`\`\`
faf-lackiererei-system/
├── 📄 package.json # Projektabhängigkeiten
├── 🖥️ server.js # Express.js Server
├── 📋 README.md # Diese Datei
├── 📁 public/ # Frontend-Dateien
│ ├── 🌐 index.html # Haupt-HTML-Datei
│ └── ⚡ app.js # Frontend-JavaScript
├── 📁 scripts/ # Hilfsskripte
│ └── 🔧 init-db.js # Datenbank-Initialisierung
└── 📁 data/ # Datenbank (wird automatisch erstellt)
└── 💾 lackiererei.db # SQLite-Datenbank
\`\`\`

## 🎯 Verwendung

### Dashboard

Das Dashboard zeigt Ihnen:

- 📊 Anzahl offener Aufträge
- 💰 Anzahl offener Rechnungen
- 👥 Gesamtzahl Kunden
- 📈 Monatsumsatz
- 📋 Liste der neuesten Aufträge

### Neuen Auftrag erstellen

1. **Kunden auswählen** - Aus vorhandenen Kunden wählen
2. **Fahrzeug zuordnen** - Automatische Filterung nach Kunde
3. **Arbeitszeiten erfassen** - Alle Arbeitsschritte mit Zeit und Preis
4. **Automatische Berechnung** - Gesamtkosten und MwSt werden berechnet
5. **Speichern** - Auftrag erhält automatisch eine Nummer

### Rechnung erstellen

1. **Kunde und Fahrzeug** wählen
2. **Positionen erfassen**:
   - **Arbeitszeiten** (meist 19% MwSt)
   - **Materialien** (19% oder 7% MwSt)
   - **Zusatzpositionen** (flexibel)
3. **Rabatt** optional hinzufügen
4. **Automatische Berechnung** aller Beträge
5. **Speichern** - Rechnung erhält automatisch eine Nummer

### Kunden- und Fahrzeugverwaltung

- **Kunden anlegen** mit vollständigen Kontaktdaten
- **Fahrzeuge zuordnen** mit Kennzeichen, Marke, Modell, VIN
- **Farbcodes** für spätere Referenz speichern

## ⚙️ Einstellungen

Im Einstellungsbereich können Sie anpassen:

- **Basis-Stundenpreis** (Standard: 110€)
- **MwSt-Sätze** (Standard: 19% und 7%)
- **Firmendaten** (Name, Adresse, Kontakt)
- **Zahlungsbedingungen** (Standardtext für Rechnungen)
- **Gewährleistung** (Standardtext für Rechnungen)

## 🔧 Entwicklung

### Entwicklungsserver starten

\`\`\`bash
npm run dev
\`\`\`
Startet den Server mit automatischem Neustart bei Änderungen.

### Datenbank zurücksetzen

\`\`\`bash
npm run init-db
\`\`\`
⚠️ **Achtung**: Löscht alle vorhandenen Daten!

## 🗂️ Datenbank-Schema

### Haupttabellen

- **kunden** - Kundenstammdaten
- **fahrzeuge** - Fahrzeugdaten (mit Kunde verknüpft)
- **auftraege** - Auftragskopfdaten
- **auftrag_positionen** - Einzelne Arbeitspositionen
- **rechnungen** - Rechnungskopfdaten
- **rechnung_positionen** - Rechnungspositionen
- **einstellungen** - Systemkonfiguration

### Beziehungen

- Ein Kunde kann mehrere Fahrzeuge haben
- Ein Fahrzeug kann mehrere Aufträge haben
- Ein Auftrag kann eine Rechnung haben
- Aufträge und Rechnungen haben mehrere Positionen

## 🔒 Sicherheit

- **Helmet.js** - HTTP-Security-Headers
- **Rate Limiting** - Schutz vor Überlastung
- **Input Validation** - Validierung aller Eingaben
- **SQL Injection Protection** - Prepared Statements
- **CORS** konfiguriert

## 🚀 Erweiterungen

Das System ist modular aufgebaut und kann einfach erweitert werden:

### Geplante Features

- 📧 **E-Mail-Versand** von Rechnungen
- 📄 **PDF-Export** für Rechnungen und Aufträge
- 📊 **Erweiterte Berichte** und Statistiken
- 🔍 **Volltextsuche** in allen Bereichen
- 📱 **Mobile App** (Progressive Web App)
- 🔄 **API-Schnittstellen** für Buchhaltungssoftware
- 📦 **Materialverwaltung** und Lagerbestand
- 📅 **Terminplanung** und Kalender
- 💼 **Multi-Mandanten-Fähigkeit**

### Eigene Erweiterungen

1. **API nutzen** - Alle Funktionen über REST-API verfügbar
2. **Frontend anpassen** - HTML/CSS/JavaScript in \`public/\`
3. **Server erweitern** - Neue Routen in \`server.js\`
4. **Datenbank** - Neue Tabellen via Migrations

## 📞 Support

Bei Fragen oder Problemen:

1. **Dokumentation** prüfen
2. **Logs** kontrollieren (Konsole beim Serverstart)
3. **Browser-Konsole** auf Fehler prüfen
4. **Datenbank** mit SQLite-Tool inspizieren

## 📝 Lizenz

Dieses Projekt wurde für FAF Lackiererei entwickelt.
Alle Rechte vorbehalten.

---

**Viel Erfolg mit Ihrem neuen Rechnungssystem! 🎨🚗**
