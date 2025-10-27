const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const Cedente = require("../models/Cedente");

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.includes("excel") ||
      file.mimetype.includes("spreadsheetml")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos Excel são permitidos"));
    }
  },
});

// Rota GET do dashboard
router.get("/", (req, res) => {
  res.render("dashboard/index", {
    title: "Dashboard",
    messages: req.flash(),
  });
});

// Rota para importação de Excel
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error("Nenhum arquivo enviado");
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // TODO: Processar os dados e salvar no banco
    console.log("Dados importados:", data);

    req.flash("success", `${data.length} cedentes importados com sucesso!`);
    res.redirect("/dashboard");
  } catch (error) {
    req.flash("error", `Erro na importação: ${error.message}`);
    res.redirect("/dashboard");
  }
});

// Rota para criar novo cedente
router.post("/cedentes/novo", async (req, res) => {
  try {
    const novoCedente = await Cedente.create({
      nome_razao_social: req.body.nome_razao_social,
      cpf_cnpj: req.body.cpf_cnpj,
      data_validade: req.body.data_validade,
      status: req.body.status,
    });

    if (novoCedente) {
      req.flash("success", "Cedente cadastrado com sucesso!");
    }

    res.redirect("/dashboard");
  } catch (error) {
    console.error("Erro ao criar cedente:", error);
    req.flash("error", "Erro ao cadastrar cedente: " + error.message);
    res.redirect("/dashboard");
  }
});

module.exports = router;
