const Kunde = require("../models/kunde");
const { generateNextNumber } = require("../utils/numbering");

exports.list = async (req, res) => {
  try {
    const kunden = await Kunde.findAll();
    res.json(kunden);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const kunde = await Kunde.findById(req.params.id);
    if (!kunde) return res.status(404).json({ error: "Kunde nicht gefunden" });
    res.json(kunde);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    // Automatische Kunden-Nr.
    const kunden_nr = await generateNextNumber("kunden");
    const data = { ...req.body, kunden_nr };
    const result = await Kunde.create(data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const result = await Kunde.update(req.params.id, req.body);
    if (result.changes === 0)
      return res.status(404).json({ error: "Kunde nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await Kunde.remove(req.params.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Kunde nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
