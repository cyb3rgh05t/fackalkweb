const Einstellung = require("../models/einstellung");

exports.list = async (req, res) => {
  try {
    const einstellungen = await Einstellung.findAll();
    res.json(einstellungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await Einstellung.update(req.params.key, req.body.value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
