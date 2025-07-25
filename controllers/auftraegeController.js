// controllers/auftraegeController.js - ERWEITERTE VERSION
const Auftrag = require("../models/auftrag");
const { generateNextNumber } = require("../utils/numbering");
const db = require("../db");

exports.list = async (req, res) => {
  try {
    const auftraege = await Auftrag.findAll();
    res.json(auftraege);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const auftrag = await Auftrag.findById(req.params.id);
    if (!auftrag)
      return res.status(404).json({ error: "Auftrag nicht gefunden" });
    res.json(auftrag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ERWEITERTE CREATE-FUNKTION mit Zuschlagsberechnung
exports.create = async (req, res) => {
  try {
    const auftrag_nr = await generateNextNumber("auftrag");

    // Einstellungen für Berechnungen holen
    const settings = await new Promise((resolve, reject) => {
      db.all(
        'SELECT key, value FROM einstellungen WHERE key IN ("basis_stundenpreis", "anfahrtspauschale", "express_zuschlag", "wochenend_zuschlag", "mwst_satz")',
        (err, rows) => {
          if (err) reject(err);
          else {
            const settingsObj = {};
            rows.forEach((row) => {
              settingsObj[row.key] = row.value;
            });
            resolve(settingsObj);
          }
        }
      );
    });

    const basis_stundenpreis = parseFloat(settings.basis_stundenpreis || 110);
    const anfahrtspauschale = parseFloat(settings.anfahrtspauschale || 0);
    const express_zuschlag_prozent =
      parseFloat(settings.express_zuschlag || 0) / 100;
    const wochenend_zuschlag_prozent =
      parseFloat(settings.wochenend_zuschlag || 0) / 100;
    const mwst_satz = parseFloat(settings.mwst_satz || 19) / 100;

    // Arbeitszeiten berechnen
    let gesamt_zeit = 0;
    let arbeitszeiten_kosten = 0;

    (req.body.positionen || []).forEach((pos) => {
      gesamt_zeit += parseFloat(pos.zeit || 0);
      arbeitszeiten_kosten += parseFloat(pos.gesamt || 0);
    });

    // Zuschläge berechnen
    let anfahrt_betrag = 0;
    let express_betrag = 0;
    let wochenend_betrag = 0;

    if (req.body.anfahrt_aktiv) {
      anfahrt_betrag = anfahrtspauschale;
    }

    if (req.body.express_aktiv) {
      express_betrag = arbeitszeiten_kosten * express_zuschlag_prozent;
    }

    if (req.body.wochenend_aktiv) {
      wochenend_betrag = arbeitszeiten_kosten * wochenend_zuschlag_prozent;
    }

    // Gesamtkosten berechnen
    const gesamt_kosten =
      arbeitszeiten_kosten + anfahrt_betrag + express_betrag + wochenend_betrag;
    const mwst_betrag = gesamt_kosten * mwst_satz;

    const data = {
      ...req.body,
      auftrag_nr,
      basis_stundenpreis,
      gesamt_zeit,
      gesamt_kosten,
      mwst_betrag,
      // Zuschlag-Flags und Beträge speichern
      anfahrt_aktiv: req.body.anfahrt_aktiv || false,
      express_aktiv: req.body.express_aktiv || false,
      wochenend_aktiv: req.body.wochenend_aktiv || false,
      anfahrt_betrag,
      express_betrag,
      wochenend_betrag,
      arbeitszeiten_kosten,
    };

    const result = await Auftrag.create(data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ERWEITERTE UPDATE-FUNKTION mit Zuschlagsberechnung
exports.update = async (req, res) => {
  try {
    // Einstellungen für Berechnungen holen
    const settings = await new Promise((resolve, reject) => {
      db.all(
        'SELECT key, value FROM einstellungen WHERE key IN ("basis_stundenpreis", "anfahrtspauschale", "express_zuschlag", "wochenend_zuschlag", "mwst_satz")',
        (err, rows) => {
          if (err) reject(err);
          else {
            const settingsObj = {};
            rows.forEach((row) => {
              settingsObj[row.key] = row.value;
            });
            resolve(settingsObj);
          }
        }
      );
    });

    const basis_stundenpreis = parseFloat(settings.basis_stundenpreis || 110);
    const anfahrtspauschale = parseFloat(settings.anfahrtspauschale || 0);
    const express_zuschlag_prozent =
      parseFloat(settings.express_zuschlag || 0) / 100;
    const wochenend_zuschlag_prozent =
      parseFloat(settings.wochenend_zuschlag || 0) / 100;
    const mwst_satz = parseFloat(settings.mwst_satz || 19) / 100;

    // Arbeitszeiten berechnen
    let gesamt_zeit = 0;
    let arbeitszeiten_kosten = 0;

    (req.body.positionen || []).forEach((pos) => {
      gesamt_zeit += parseFloat(pos.zeit || 0);
      arbeitszeiten_kosten += parseFloat(pos.gesamt || 0);
    });

    // Zuschläge berechnen
    let anfahrt_betrag = 0;
    let express_betrag = 0;
    let wochenend_betrag = 0;

    if (req.body.anfahrt_aktiv) {
      anfahrt_betrag = anfahrtspauschale;
    }

    if (req.body.express_aktiv) {
      express_betrag = arbeitszeiten_kosten * express_zuschlag_prozent;
    }

    if (req.body.wochenend_aktiv) {
      wochenend_betrag = arbeitszeiten_kosten * wochenend_zuschlag_prozent;
    }

    // Gesamtkosten berechnen
    const gesamt_kosten =
      arbeitszeiten_kosten + anfahrt_betrag + express_betrag + wochenend_betrag;
    const mwst_betrag = gesamt_kosten * mwst_satz;

    const data = {
      ...req.body,
      basis_stundenpreis,
      gesamt_zeit,
      gesamt_kosten,
      mwst_betrag,
      // Zuschlag-Flags und Beträge speichern
      anfahrt_aktiv: req.body.anfahrt_aktiv || false,
      express_aktiv: req.body.express_aktiv || false,
      wochenend_aktiv: req.body.wochenend_aktiv || false,
      anfahrt_betrag,
      express_betrag,
      wochenend_betrag,
      arbeitszeiten_kosten,
    };

    const result = await Auftrag.update(req.params.id, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await Auftrag.remove(req.params.id); // ← .remove() nicht .delete()
    if (result.changes === 0)
      return res.status(404).json({ error: "Auftrag nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
