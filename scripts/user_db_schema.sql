
-- Standard-Tabellen für jeden User (Kopie der Haupt-DB)
CREATE TABLE kunden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kunden_nr TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  telefon TEXT,
  email TEXT,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fahrzeuge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kunden_id INTEGER,
  kennzeichen TEXT NOT NULL,
  marke TEXT,
  modell TEXT,
  vin TEXT,
  baujahr INTEGER,
  farbe TEXT,
  farbcode TEXT,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE CASCADE
);

CREATE TABLE auftraege (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auftrag_nr TEXT UNIQUE NOT NULL,
  kunden_id INTEGER,
  fahrzeug_id INTEGER,
  datum DATE NOT NULL,
  status TEXT DEFAULT 'offen',
  basis_stundenpreis DECIMAL(10,2) DEFAULT 110.00,
  gesamt_zeit DECIMAL(10,2) DEFAULT 0,
  gesamt_kosten DECIMAL(10,2) DEFAULT 0,
  mwst_betrag DECIMAL(10,2) DEFAULT 0,
  bemerkungen TEXT,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
  FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
);

CREATE TABLE auftrag_positionen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auftrag_id INTEGER,
  beschreibung TEXT NOT NULL,
  stundenpreis DECIMAL(10,2),
  zeit DECIMAL(10,2),
  einheit TEXT DEFAULT 'Std.',
  gesamt DECIMAL(10,2),
  reihenfolge INTEGER,
  FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE
);

CREATE TABLE rechnungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rechnung_nr TEXT UNIQUE NOT NULL,
  auftrag_id INTEGER,
  kunden_id INTEGER,
  fahrzeug_id INTEGER,
  rechnungsdatum DATE NOT NULL,
  auftragsdatum DATE,
  status TEXT DEFAULT 'offen',
  zwischensumme DECIMAL(10,2) DEFAULT 0,
  rabatt_prozent DECIMAL(5,2) DEFAULT 0,
  rabatt_betrag DECIMAL(10,2) DEFAULT 0,
  netto_nach_rabatt DECIMAL(10,2) DEFAULT 0,
  mwst_19 DECIMAL(10,2) DEFAULT 0,
  mwst_7 DECIMAL(10,2) DEFAULT 0,
  gesamtbetrag DECIMAL(10,2) DEFAULT 0,
  zahlungsbedingungen TEXT,
  gewaehrleistung TEXT,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE SET NULL,
  FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
  FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
);

CREATE TABLE rechnung_positionen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rechnung_id INTEGER,
  kategorie TEXT NOT NULL,
  beschreibung TEXT NOT NULL,
  menge DECIMAL(10,2),
  einheit TEXT,
  einzelpreis DECIMAL(10,2),
  mwst_prozent DECIMAL(5,2),
  gesamt DECIMAL(10,2),
  reihenfolge INTEGER,
  FOREIGN KEY (rechnung_id) REFERENCES rechnungen (id) ON DELETE CASCADE
);

CREATE TABLE einstellungen (
  key TEXT PRIMARY KEY,
  value TEXT,
  beschreibung TEXT,
  aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Standard-Einstellungen einfügen
INSERT INTO einstellungen (key, value, beschreibung) VALUES 
('firmen_name', 'Meine Lackiererei', 'Name der Firma'),
('mwst_satz', '19', 'Mehrwertsteuersatz in Prozent'),
('basis_stundenpreis', '110.00', 'Standard-Stundenpreis');
