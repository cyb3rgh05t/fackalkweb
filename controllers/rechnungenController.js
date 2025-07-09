const Rechnung = require("../models/rechnung");
const { generateNextNumber } = require("../utils/numbering");
const db = require("../db");

exports.list = async (req, res) => {
  try {
    const rechnungen = await Rechnung.findAll();
    res.json(rechnungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const rechnung = await Rechnung.findById(req.params.id);
    if (!rechnung)
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    res.json(rechnung);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const rechnung_nr = await generateNextNumber("rechnung");
    // Beträge berechnen
    let zwischensumme = 0;
    let mwst19Basis = 0;
    let mwst7Basis = 0;
    (req.body.positionen || []).forEach((pos) => {
      const gesamt = parseFloat(pos.gesamt || 0);
      zwischensumme += gesamt;
      if (pos.mwst_prozent === 19) mwst19Basis += gesamt;
      else if (pos.mwst_prozent === 7) mwst7Basis += gesamt;
    });
    const rabattProzent = parseFloat(req.body.rabatt_prozent || 0);
    const rabattBetrag = zwischensumme * (rabattProzent / 100);
    const nettoNachRabatt = zwischensumme - rabattBetrag;
    const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
    const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
    const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;
    db.all(
      'SELECT key, value FROM einstellungen WHERE key IN ("zahlungsbedingungen", "gewaehrleistung")',
      (err, settings) => {
        if (err) return res.status(500).json({ error: err.message });
        const zahlungsbedingungen =
          settings.find((s) => s.key === "zahlungsbedingungen")?.value || "";
        const gewaehrleistung =
          settings.find((s) => s.key === "gewaehrleistung")?.value || "";
        const data = {
          ...req.body,
          rechnung_nr,
          zwischensumme,
          rabatt_prozent: rabattProzent,
          rabatt_betrag: rabattBetrag,
          netto_nach_rabatt: nettoNachRabatt,
          mwst_19: mwst19,
          mwst_7: mwst7,
          gesamtbetrag,
          zahlungsbedingungen,
          gewaehrleistung,
        };
        Rechnung.create(data)
          .then((result) => res.json(result))
          .catch((e) => res.status(500).json({ error: e.message }));
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    let zwischensumme = 0;
    let mwst19Basis = 0;
    let mwst7Basis = 0;
    (req.body.positionen || []).forEach((pos) => {
      const gesamt = parseFloat(pos.gesamt || 0);
      zwischensumme += gesamt;
      if (pos.mwst_prozent === 19) mwst19Basis += gesamt;
      else if (pos.mwst_prozent === 7) mwst7Basis += gesamt;
    });
    const rabattProzent = parseFloat(req.body.rabatt_prozent || 0);
    const rabattBetrag = zwischensumme * (rabattProzent / 100);
    const nettoNachRabatt = zwischensumme - rabattBetrag;
    const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
    const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
    const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;
    db.all(
      'SELECT key, value FROM einstellungen WHERE key IN ("zahlungsbedingungen", "gewaehrleistung")',
      (err, settings) => {
        if (err) return res.status(500).json({ error: err.message });
        const zahlungsbedingungen =
          settings.find((s) => s.key === "zahlungsbedingungen")?.value || "";
        const gewaehrleistung =
          settings.find((s) => s.key === "gewaehrleistung")?.value || "";
        const data = {
          ...req.body,
          zwischensumme,
          rabatt_prozent: rabattProzent,
          rabatt_betrag: rabattBetrag,
          netto_nach_rabatt: nettoNachRabatt,
          mwst_19: mwst19,
          mwst_7: mwst7,
          gesamtbetrag,
          zahlungsbedingungen,
          gewaehrleistung,
        };
        Rechnung.update(req.params.id, data)
          .then((result) => {
            if (result.changes === 0)
              return res.status(404).json({ error: "Rechnung nicht gefunden" });
            res.json({ success: true });
          })
          .catch((e) => res.status(500).json({ error: e.message }));
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await Rechnung.remove(req.params.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
