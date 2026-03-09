const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bucket = req.params.bucket || "default";
    const dir = path.join(UPLOADS_DIR, bucket);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const name = req.query.path || file.originalname;
    cb(null, name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/storage/:bucket/upload
router.post("/:bucket/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  const publicUrl = `/api/storage/${req.params.bucket}/${req.file.filename}`;
  res.json({ data: { path: req.file.filename, publicUrl }, error: null });
});

// GET /api/storage/:bucket/:filename — serve file
router.get("/:bucket/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.bucket, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filePath);
});

// GET /api/storage/:bucket — list files
router.get("/:bucket", (req, res) => {
  const dir = path.join(UPLOADS_DIR, req.params.bucket);
  if (!fs.existsSync(dir)) return res.json({ data: [], error: null });
  const files = fs.readdirSync(dir).map(f => ({
    name: f,
    publicUrl: `/api/storage/${req.params.bucket}/${f}`,
  }));
  res.json({ data: files, error: null });
});

// DELETE /api/storage/:bucket/:filename
router.delete("/:bucket/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.bucket, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ data: { message: "Deleted" }, error: null });
});

module.exports = router;
