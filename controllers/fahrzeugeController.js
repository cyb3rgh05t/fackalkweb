const Fahrzeug = require("../models/fahrzeug");

exports.list = async (req, res) => {
  try {
    const fahrzeuge = await Fahrzeug.findAll(req.query.kunden_id);
    res.json(fahrzeuge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const fahrzeug = await Fahrzeug.findById(req.params.id);
    if (!fahrzeug)
      return res.status(404).json({ error: "Fahrzeug nicht gefunden" });
    res.json(fahrzeug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const result = await Fahrzeug.create(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const result = await Fahrzeug.update(req.params.id, req.body);
    if (result.changes === 0)
      return res.status(404).json({ error: "Fahrzeug nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await Fahrzeug.remove(req.params.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Fahrzeug nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
