const express = require("express");
const router = express.Router();
const cedenteController = require("../controllers/cedenteController");
const multer = require("multer");
const path = require("path");

// Configuração do Multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads";
    const fs = require("fs");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, "_");
    cb(null, `cedentes_${timestamp}_${originalName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Apenas arquivos Excel (.xlsx, .xls) são aceitos."), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware para tratamento de erros do Multer
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Arquivo muito grande. Tamanho máximo: 10MB" });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Rotas da API
router.post("/upload", upload.single("planilha"), handleUploadErrors, cedenteController.uploadPlanilha);
router.get("/listar", cedenteController.listarCedentes);
router.post("/novo", cedenteController.adicionarCedente);
router.get("/estatisticas", cedenteController.estatisticas);
router.get("/exportar/excel", cedenteController.exportarCedentes);
router.get("/:id", cedenteController.buscarCedente);
router.put("/:id", cedenteController.atualizarCedente);
router.delete("/:id", cedenteController.excluirCedente);
router.delete("/", cedenteController.excluirTodos);

// ✅ ROTAS DE DOCUMENTOS - Implementadas
router.post("/:id/documentos", cedenteController.salvarDocumentos);
router.get("/:id/documentos", cedenteController.buscarDocumentos);

module.exports = router;