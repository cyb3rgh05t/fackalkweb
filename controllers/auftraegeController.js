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

exports.create = async (req, res) => {
  try {
    const auftrag_nr = await generateNextNumber("auftrag");
    // Basis-Stundenpreis holen
    db.get(
      'SELECT value FROM einstellungen WHERE key = "basis_stundenpreis"',
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const basis_stundenpreis = parseFloat(row?.value || 110);
        let gesamt_zeit = 0;
        let gesamt_kosten = 0;
        (req.body.positionen || []).forEach((pos) => {
          gesamt_zeit += parseFloat(pos.zeit || 0);
          gesamt_kosten += parseFloat(pos.gesamt || 0);
        });
        const mwst_betrag = gesamt_kosten * 0.19;
        const data = {
          ...req.body,
          auftrag_nr,
          basis_stundenpreis,
          gesamt_zeit,
          gesamt_kosten,
          mwst_betrag,
        };
        Auftrag.create(data)
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
    db.get(
      'SELECT value FROM einstellungen WHERE key = "basis_stundenpreis"',
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const basis_stundenpreis = parseFloat(row?.value || 110);
        let gesamt_zeit = 0;
        let gesamt_kosten = 0;
        (req.body.positionen || []).forEach((pos) => {
          gesamt_zeit += parseFloat(pos.zeit || 0);
          gesamt_kosten += parseFloat(pos.gesamt || 0);
        });
        const mwst_betrag = gesamt_kosten * 0.19;
        const data = {
          ...req.body,
          basis_stundenpreis,
          gesamt_zeit,
          gesamt_kosten,
          mwst_betrag,
        };
        Auftrag.update(req.params.id, data)
          .then((result) => {
            if (result.changes === 0)
              return res.status(404).json({ error: "Auftrag nicht gefunden" });
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
    const result = await Auftrag.remove(req.params.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Auftrag nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
