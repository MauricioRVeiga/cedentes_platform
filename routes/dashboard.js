const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const Cedente = require("../models/cedente");

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

// Função helper para classificar status
function getStatusClass(status) {
  const statusClasses = {
    "CONTRATO ASSINADO MANUALMENTE": "bg-success",
    "CONTRATO SEM ASSINATURA MANUAL E DIGITAL": "bg-danger",
    "CONTRATO PRECISA SER RENOVADO": "bg-danger",
    "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR": "bg-warning",
    "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO": "bg-info",
    "LEVOU O CONTRATO PARA ASSINAR": "bg-primary",
  };
  return statusClasses[status] || "bg-secondary";
}

// Rota GET do dashboard - lista cedentes recentes
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 20; // trazer apenas 20 por página
    const offset = (page - 1) * limit;

    const result = await Cedente.findAndCountAll({
      order: [["nome_razao_social", "ASC"]],
      limit,
      offset,
    });

    const cedentes = result.rows;
    const total = result.count;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const currentPage = Math.min(page, totalPages);

    // Definir os status do ENUM com título e ícone para exibição nos cards
    const statusMeta = [
      {
        key: "CONTRATO ASSINADO MANUALMENTE",
        title: "Assinado (Manual)",
        icon: "fas fa-file-signature",
      },
      {
        key: "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
        title: "Sem Assinatura",
        icon: "fas fa-times-circle",
      },
      {
        key: "CONTRATO PRECISA SER RENOVADO",
        title: "Precisa Renovar",
        icon: "fas fa-sync-alt",
      },
      {
        key: "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR",
        title: "Faltam Assinar",
        icon: "fas fa-edit",
      },
      {
        key: "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO",
        title: "Avisados Renovação",
        icon: "fas fa-bell",
      },
      {
        key: "LEVOU O CONTRATO PARA ASSINAR",
        title: "Levou p/ Assinar",
        icon: "fas fa-paper-plane",
      },
    ];

    // Calcular contagens para cada status
    const counts = await Promise.all(
      statusMeta.map((s) => Cedente.count({ where: { status: s.key } }))
    );
    statusMeta.forEach((s, idx) => {
      s.count = counts[idx] || 0;
    });

    // Contadores por agrupamento simples (opcional: manter para compatibilidade)
    const [ativoCount, pendenteCount, inativoCount] = await Promise.all([
      Cedente.count({ where: { status: "Ativo" } }).catch(() => 0),
      Cedente.count({ where: { status: "Pendente" } }).catch(() => 0),
      Cedente.count({ where: { status: "Inativo" } }).catch(() => 0),
    ]);

    res.render("dashboard/index", {
      title: "Dashboard",
      messages: req.flash(),
      cedentes,
      total,
      totalPages,
      currentPage,
      limit,
      ativoCount,
      pendenteCount,
      inativoCount,
      getStatusClass,
      statusMeta, // novo: meta com contagens para os cards
      script: "", // compatibilidade com layout
      layout: false, // renderizar a view completa sem o layout global
    });
  } catch (error) {
    console.error("Erro ao buscar cedentes:", error);
    req.flash("error", "Erro ao carregar cedentes");
    res.render("dashboard/index", {
      title: "Dashboard",
      messages: req.flash(),
      cedentes: [],
      total: 0,
      totalPages: 1,
      currentPage: 1,
      getStatusClass,
      statusMeta: [],
      script: "",
      layout: false, // renderizar a view completa sem o layout global
    });
  }
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

    // Função utilitária para localizar chaves independentemente de maiúsculas/espaços
    const findKey = (obj, names) => {
      const keys = Object.keys(obj || {});
      for (const n of names) {
        const target = n.toLowerCase().replace(/[^a-z0-9]/g, "");
        const found = keys.find(
          (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === target
        );
        if (found) return found;
      }
      return null;
    };

    // Normalizar e agrupar linhas
    const normalized = [];
    const dateRegex = /(\d{2}[\/.]\d{2}[\/.]\d{4})|(\d{4}-\d{2}-\d{2})/;

    const normalizeCpf = (v) => {
      if (v === null || v === undefined) return null;
      let s = String(v).trim();
      // remover caracteres invisíveis e caracteres repetidos de separação
      s = s.replace(/[\u00A0\s]+/g, " ").trim();
      return s;
    };

    for (const row of data) {
      const nomeKey = findKey(row, [
        "NOME / RAZÃO SOCIAL",
        "NOME",
        "NOME RAZÃO SOCIAL",
        "NOME_RAZAO_SOCIAL",
      ]);
      const cpfKey = findKey(row, ["CPF / CNPJ", "CPF", "CNPJ", "CPF_CNPJ"]);
      const contratoKey = findKey(row, [
        "CONTRATO",
        "DATA",
        "DATA_VENCIMENTO",
        "DATA_DE_VALIDADE",
      ]);

      const nome = nomeKey ? String(row[nomeKey]).trim() : null;
      const cpf = cpfKey ? normalizeCpf(row[cpfKey]) : null;
      const contrato = contratoKey ? String(row[contratoKey]).trim() : "";

      if (!cpf || !nome) continue;

      // extrair data
      let data_validade = null;
      const m = contrato.match(dateRegex);
      if (m) {
        const ds = m[0].replace(/\./g, "/").replace(/\s+/g, "");
        const parsed = new Date(ds);
        if (!isNaN(parsed)) data_validade = parsed;
      }
      if (!data_validade) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        data_validade = d;
      }

      let status = "Ativo";
      if (/bloquead|bloqueio|suspenso/i.test(contrato)) status = "Inativo";
      if (
        /pendente|não foi assinado|não foi assinado|não enviado/i.test(contrato)
      )
        status = "Pendente";

      normalized.push({
        nome_razao_social: nome,
        cpf_cnpj: cpf,
        status,
        data_validade,
      });
    }

    // Preparar inserção em lote: verificar existentes e inserir somente novos
    const cpfs = Array.from(new Set(normalized.map((r) => r.cpf_cnpj)));
    const existing = await Cedente.findAll({
      where: { cpf_cnpj: cpfs },
      attributes: ["cpf_cnpj"],
    });
    const existingSet = new Set(existing.map((e) => e.cpf_cnpj));

    const toCreate = normalized.filter((r) => !existingSet.has(r.cpf_cnpj));

    // Inserir em chunks para evitar consultas muito grandes
    const chunkSize = 200;
    let created = 0;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      try {
        const res = await Cedente.bulkCreate(chunk, { ignoreDuplicates: true });
        created += res.length || chunk.length;
      } catch (errBulk) {
        // bulkCreate pode falhar em alguns drivers; tentar inserir um a um como fallback
        console.error(
          "bulkCreate falhou, tentando individualmente:",
          errBulk.message || errBulk
        );
        for (const item of chunk) {
          try {
            await Cedente.create(item);
            created++;
          } catch (errOne) {
            console.error(
              "Erro ao inserir item:",
              item.cpf_cnpj,
              errOne.message || errOne
            );
          }
        }
      }
    }

    console.log(
      `Import: linhas recebidas=${data.length}, normalizadas=${normalized.length}, novos=${created}, existentes=${existing.length}`
    );

    req.flash(
      "success",
      `${created} cedentes importados com sucesso (de ${normalized.length} válidos).`
    );
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Erro no import:", error);
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

// Rota para excluir um cedente
router.delete("/cedentes/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await Cedente.destroy({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir cedente:", error);
    res.status(500).json({ error: "Erro ao excluir cedente" });
  }
});

// Rota para excluir todos os cedentes
router.delete("/cedentes", async (req, res) => {
  try {
    await Cedente.destroy({ where: {} });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir todos os cedentes:", error);
    res.status(500).json({ error: "Erro ao excluir todos os cedentes" });
  }
});

// Rota para buscar dados de um cedente específico
router.get("/cedentes/:id", async (req, res) => {
  try {
    const cedente = await Cedente.findByPk(req.params.id);
    if (cedente) {
      res.json(cedente);
    } else {
      res.status(404).json({ error: "Cedente não encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar cedente" });
  }
});

// Rota para atualizar um cedente
router.put("/cedentes/:id", async (req, res) => {
  try {
    const cedente = await Cedente.findByPk(req.params.id);
    if (cedente) {
      await cedente.update(req.body);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Cedente não encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar cedente" });
  }
});

module.exports = router;
