const Cedente = require("../models/cedente");
const xlsx = require("xlsx");

// Upload de planilha
exports.uploadPlanilha = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    console.log("Arquivo recebido:", req.file);

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    let ignorados = 0;

    // Função para encontrar a chave correta independente de case/espaço
    const findKey = (obj, possibleKeys) => {
      const normalizedKeys = Object.keys(obj).map((k) =>
        k.toLowerCase().trim()
      );
      const key = possibleKeys.find((k) =>
        normalizedKeys.includes(k.toLowerCase().trim())
      );
      return obj[key] || null;
    };

    for (let row of data) {
      // Buscar valores usando possíveis variações dos nomes dos campos
      const nome = findKey(row, [
        "NOME / RAZÃO SOCIAL",
        "nome_razao_social",
        "nome razao social",
        "nome/razao social",
        "razao social",
        "nome",
        "NOME_RAZAO_SOCIAL",
        "NOME RAZAO SOCIAL",
        "NOME/RAZAO SOCIAL",
      ]);

      const cpf = findKey(row, [
        "CPF / CNPJ",
        "cpf_cnpj",
        "cpf/cnpj",
        "cpf cnpj",
        "documento",
        "CPF_CNPJ",
        "CPF/CNPJ",
        "CPF CNPJ",
      ]);

      const status = findKey(row, [
        "CONTRATO",
        "status",
        "situacao",
        "STATUS",
        "SITUACAO",
      ]);

      const data_validade = findKey(row, [
        "data_validade",
        "data validade",
        "validade",
        "vencimento",
        "DATA_VALIDADE",
        "DATA VALIDADE",
      ]);

      // Validar apenas nome e CPF/CNPJ como campos obrigatórios
      if (!nome || !cpf) {
        console.warn("Linha ignorada por falta de dados obrigatórios:", row);
        ignorados++;
        continue;
      }

      // Se chegou aqui, temos os dados mínimos necessários

      try {
        // Tentar encontrar um cedente existente com o mesmo CPF/CNPJ
        const cedenteExistente = await Cedente.findOne({
          where: { cpf_cnpj: cpf.toString().trim() },
        });

        if (cedenteExistente) {
          // Atualizar o cedente existente
          await cedenteExistente.update({
            nome_razao_social: nome.trim(),
            status:
              status?.trim() || "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
            data_validade: data_validade
              ? new Date(data_validade)
              : cedenteExistente.data_validade,
          });
        } else {
          // Criar um novo cedente
          await Cedente.create({
            nome_razao_social: nome.trim(),
            cpf_cnpj: cpf.toString().trim(),
            status:
              status?.trim() || "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
            data_validade: data_validade ? new Date(data_validade) : new Date(),
          });
        }
      } catch (err) {
        console.error("Erro ao processar linha:", err);
        throw err;
      }
    }

    // Retorna os dados processados e a lista atualizada
    const cedentesAtualizados = await Cedente.findAll({
      order: [["nome_razao_social", "ASC"]],
      attributes: [
        "id",
        "nome_razao_social",
        "cpf_cnpj",
        "status",
        "data_validade",
      ],
    });

    res.json({
      message: "Planilha processada com sucesso",
      total: data.length,
      processados: data.length - ignorados,
      ignorados: ignorados,
      cedentes: cedentesAtualizados,
    });
  } catch (error) {
    console.error("Erro ao processar planilha:", error);
    res.status(500).json({ error: "Erro ao processar planilha" });
  }
};

// Listar todos os cedentes
exports.listarCedentes = async (req, res) => {
  try {
    const cedentes = await Cedente.findAll({
      order: [["nome_razao_social", "ASC"]],
      attributes: [
        "id",
        "nome_razao_social",
        "cpf_cnpj",
        "status",
        "data_validade",
      ],
    });
    res.json(cedentes);
  } catch (error) {
    console.error("Erro ao listar cedentes:", error);
    res.status(500).json({ error: "Erro ao listar cedentes" });
  }
};

// Adicionar novo cedente
exports.adicionarCedente = async (req, res) => {
  try {
    const cedente = await Cedente.create(req.body);
    res.status(201).json(cedente);
  } catch (error) {
    console.error("Erro ao criar cedente:", error);
    res.status(400).json({ error: "Erro ao criar cedente" });
  }
};

// Buscar cedente por ID
exports.buscarCedente = async (req, res) => {
  try {
    const cedente = await Cedente.findByPk(req.params.id);
    if (!cedente) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }
    res.json(cedente);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar cedente" });
  }
};

// Atualizar cedente
exports.atualizarCedente = async (req, res) => {
  try {
    const [updated] = await Cedente.update(req.body, {
      where: { id: req.params.id },
    });
    if (!updated) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }
    res.json({ message: "Cedente atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar cedente:", error);
    res.status(500).json({ error: "Erro ao atualizar cedente" });
  }
};

// Excluir cedente
exports.excluirCedente = async (req, res) => {
  try {
    const deleted = await Cedente.destroy({
      where: { id: req.params.id },
    });
    if (!deleted) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }
    res.json({ message: "Cedente excluído com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir cedente" });
  }
};

// Excluir todos os cedentes
exports.excluirTodos = async (req, res) => {
  try {
    await Cedente.destroy({
      where: {},
      truncate: true,
    });
    res.json({ message: "Todos os cedentes foram excluídos com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir todos os cedentes:", error);
    res.status(500).json({ error: "Erro ao excluir todos os cedentes" });
  }
};
