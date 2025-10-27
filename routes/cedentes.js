const express = require("express");
const router = express.Router();
const cedenteController = require("../controllers/cedenteController");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== ".xlsx" && ext !== ".xls") {
      return cb(new Error("Apenas arquivos Excel são permitidos"));
    }
    cb(null, true);
  },
});

// Rotas principais
router.post(
  "/upload",
  upload.single("planilha"),
  cedenteController.uploadPlanilha
);
router.get("/listar", cedenteController.listarCedentes);
router.post("/novo", cedenteController.adicionarCedente);
router.get("/:id", cedenteController.buscarCedente);
router.put("/:id", cedenteController.atualizarCedente);
router.delete("/:id", cedenteController.excluirCedente);
router.delete("/", cedenteController.excluirTodos);

module.exports = router;
