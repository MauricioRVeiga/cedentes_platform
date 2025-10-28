const Cedente = require("../models/cedente");
const { Op } = require("sequelize");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

// Upload de planilha - CORRIGIDA
exports.uploadPlanilha = async (req, res) => {
  let filePath = null;

  try {
    console.log("📥 Iniciando processamento de upload...");
    
    if (!req.file) {
      console.error("❌ Nenhum arquivo recebido");
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    filePath = req.file.path;
    console.log("📄 Arquivo recebido:", req.file.originalname, "Caminho:", filePath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.error("❌ Arquivo não encontrado no caminho:", filePath);
      return res.status(400).json({ error: "Arquivo não encontrado" });
    }

    // Ler arquivo Excel
    let workbook;
    try {
      workbook = xlsx.readFile(filePath);
      console.log("✅ Arquivo Excel lido com sucesso");
    } catch (error) {
      console.error("❌ Erro ao ler arquivo Excel:", error);
      return res.status(400).json({ error: "Erro ao ler arquivo Excel. Verifique se o arquivo não está corrompido." });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      console.error("❌ Nenhuma planilha encontrada no arquivo");
      return res.status(400).json({ error: "Nenhuma planilha encontrada no arquivo" });
    }

    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`📊 ${data.length} registros encontrados na planilha`);

    if (data.length === 0) {
      console.warn("⚠️ Planilha vazia");
      return res.status(400).json({ error: "A planilha está vazia" });
    }

    let processados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const errors = [];

    // Função para encontrar a chave correta - CORRIGIDA
    const findKey = (obj, possibleKeys) => {
      if (!obj || typeof obj !== 'object') return null;
      
      // Primeiro, tentar encontrar exatamente (case insensitive)
      for (let key of possibleKeys) {
        const lowerKey = key.toLowerCase().trim();
        for (let objKey in obj) {
          if (objKey.toLowerCase().trim() === lowerKey) {
            return obj[objKey];
          }
        }
      }
      
      // Se não encontrar, tentar a abordagem normalizada
      const normalizedObj = {};
      Object.keys(obj).forEach((key) => {
        if (obj[key] !== undefined && obj[key] !== null) {
          const normalizedKey = key
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, "");
          normalizedObj[normalizedKey] = obj[key];
        }
      });

      for (let key of possibleKeys) {
        const normalizedKey = key
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, "");
        if (normalizedObj[normalizedKey] !== undefined) {
          return normalizedObj[normalizedKey];
        }
      }
      return null;
    };

    for (let [index, row] of data.entries()) {
      try {
        console.log(`🔍 Processando linha ${index + 2}:`, row);

        // Buscar valores usando possíveis variações
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
          "NOME COMPLETO",
          "Razão Social",
          "Nome Completo",
          "Nome",
          "NOME"
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
          "CNPJ/CPF",
          "DOCUMENTO",
          "CNPJ",
          "CPF",
          "CpfCnpj"
        ]);

        const status = findKey(row, [
          "CONTRATO",
          "status",
          "situacao",
          "STATUS",
          "SITUACAO",
          "SITUAÇÃO",
          "TIPO CONTRATO",
          "Situação",
          "Status Contrato"
        ]);

        const data_validade = findKey(row, [
          "data_validade",
          "data validade",
          "validade",
          "vencimento",
          "DATA_VALIDADE",
          "DATA VALIDADE",
          "DATA VENCIMENTO",
          "data_vencimento",
          "Vencimento",
          "Validade",
          "Data Vencimento"
        ]);

        console.log(`📝 Dados extraídos - Nome: ${nome}, CPF/CNPJ: ${cpf}`);

        // Validar campos obrigatórios
        if (!nome || !cpf) {
          console.warn(`❌ Linha ${index + 2} ignorada: falta de dados obrigatórios (nome: ${nome}, cpf: ${cpf})`);
          errors.push(`Linha ${index + 2}: Nome e CPF/CNPJ são obrigatórios`);
          ignorados++;
          continue;
        }

        // Limpar e formatar CPF/CNPJ
        const cpfLimpo = cpf.toString().replace(/\D/g, "").trim();
        const nomeLimpo = nome.toString().trim();

        // Validar CPF/CNPJ
        if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
          console.warn(`❌ Linha ${index + 2}: CPF/CNPJ inválido (${cpfLimpo})`);
          errors.push(`Linha ${index + 2}: CPF/CNPJ inválido (deve ter 11 ou 14 dígitos)`);
          ignorados++;
          continue;
        }

        // Processar data de validade
        let dataValidadeProcessada = new Date();
        dataValidadeProcessada.setFullYear(dataValidadeProcessada.getFullYear() + 1);

        if (data_validade) {
          try {
            let data = new Date(data_validade);
            
            if (isNaN(data.getTime())) {
              const dataStr = data_validade.toString().trim();
              const partes = dataStr.split(/[/-]/);
              if (partes.length === 3) {
                const dia = parseInt(partes[0]);
                const mes = parseInt(partes[1]) - 1;
                const ano = parseInt(partes[2]);
                
                if (ano > 1900 && ano < 2100 && mes >= 0 && mes < 12 && dia > 0 && dia <= 31) {
                  data = new Date(ano, mes, dia);
                }
              }
              
              if (isNaN(data.getTime())) {
                data = new Date(dataStr);
              }
            }
            
            if (!isNaN(data.getTime())) {
              dataValidadeProcessada = data;
            }
          } catch (dateError) {
            console.warn(`⚠️ Erro ao processar data na linha ${index + 2}:`, dateError);
          }
        }

        // Processar status
        let statusProcessado = "CONTRATO SEM ASSINATURA MANUAL E DIGITAL";
        if (status) {
          const statusStr = status.toString().trim().toUpperCase();
          
          const statusMap = {
            "ASSINADO": "CONTRATO ASSINADO MANUALMENTE",
            "MANUAL": "CONTRATO ASSINADO MANUALMENTE", 
            "RENOVAR": "CONTRATO PRECISA SER RENOVADO",
            "RENOVAÇÃO": "CONTRATO PRECISA SER RENOVADO",
            "RENOVACAO": "CONTRATO PRECISA SER RENOVADO",
            "IMPRESSO": "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR",
            "AVISADO": "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO",
            "LEVOU": "LEVOU O CONTRATO PARA ASSINAR",
            "CONTRATO ASSINADO MANUALMENTE": "CONTRATO ASSINADO MANUALMENTE",
            "CONTRATO SEM ASSINATURA MANUAL E DIGITAL": "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
            "CONTRATO PRECISA SER RENOVADO": "CONTRATO PRECISA SER RENOVADO",
            "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR": "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR",
            "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO": "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO",
            "LEVOU O CONTRATO PARA ASSINAR": "LEVOU O CONTRATO PARA ASSINAR"
          };

          if (statusMap[statusStr]) {
            statusProcessado = statusMap[statusStr];
          } else {
            for (let [key, value] of Object.entries(statusMap)) {
              if (statusStr.includes(key)) {
                statusProcessado = value;
                break;
              }
            }
          }
        }

        console.log(`🔄 Buscando cedente existente com CPF/CNPJ: ${cpfLimpo}`);

        // Buscar cedente existente
        const cedenteExistente = await Cedente.findOne({
          where: { cpf_cnpj: cpfLimpo },
        });

        if (cedenteExistente) {
          // Atualizar cedente existente
          console.log(`✏️ Atualizando cedente existente: ${nomeLimpo}`);
          await cedenteExistente.update({
            nome_razao_social: nomeLimpo,
            status: statusProcessado,
            data_validade: dataValidadeProcessada,
          });
          atualizados++;
          console.log(`✅ Cedente atualizado: ${nomeLimpo}`);
        } else {
          // Criar novo cedente
          console.log(`➕ Criando novo cedente: ${nomeLimpo}`);
          await Cedente.create({
            nome_razao_social: nomeLimpo,
            cpf_cnpj: cpfLimpo,
            status: statusProcessado,
            data_validade: dataValidadeProcessada,
          });
          processados++;
          console.log(`✅ Novo cedente criado: ${nomeLimpo}`);
        }

      } catch (error) {
        console.error(`💥 Erro na linha ${index + 2}:`, error);
        errors.push(`Linha ${index + 2}: ${error.message}`);
        ignorados++;
      }
    }

    // Limpar arquivo temporário
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🧹 Arquivo temporário removido");
      }
    } catch (cleanupError) {
      console.warn("⚠️ Erro ao remover arquivo temporário:", cleanupError);
    }

    // Buscar lista atualizada
    const cedentesAtualizados = await Cedente.findAll({
      order: [["nome_razao_social", "ASC"]],
      attributes: [
        "id",
        "nome_razao_social",
        "cpf_cnpj",
        "status",
        "data_validade",
        "data_cadastro",
      ],
    });

    console.log(`🎯 Processamento concluído: ${processados} novos, ${atualizados} atualizados, ${ignorados} ignorados`);

    res.json({
      message: "Planilha processada com sucesso",
      total: data.length,
      processados,
      atualizados,
      ignorados,
      errors: errors.length > 0 ? errors : undefined,
      cedentes: cedentesAtualizados,
    });

  } catch (error) {
    console.error("💥 Erro geral ao processar planilha:", error);
    
    // Limpar arquivo em caso de erro
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🧹 Arquivo temporário removido após erro");
      }
    } catch (cleanupError) {
      console.warn("⚠️ Erro ao remover arquivo temporário:", cleanupError);
    }

    res.status(500).json({
      error: "Erro ao processar planilha",
      details: process.env.NODE_ENV === "development" ? error.message : "Erro interno do servidor",
    });
  }
};

// Listar todos os cedentes
exports.listarCedentes = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { nome_razao_social: { [Op.like]: `%${search}%` } },
        { cpf_cnpj: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: cedentes } = await Cedente.findAndCountAll({
      where: whereClause,
      order: [["nome_razao_social", "ASC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        "id",
        "nome_razao_social",
        "cpf_cnpj",
        "status",
        "data_validade",
        "data_cadastro",
      ],
    });

    res.json({
      cedentes,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      hasNext: page * limit < count,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error("Erro ao listar cedentes:", error);
    res.status(500).json({ error: "Erro ao listar cedentes" });
  }
};

// Adicionar novo cedente
exports.adicionarCedente = async (req, res) => {
  try {
    const { nome_razao_social, cpf_cnpj, status, data_validade, observacoes } =
      req.body;

    // Validar dados obrigatórios
    if (!nome_razao_social || !cpf_cnpj || !data_validade) {
      return res.status(400).json({
        error: "Nome, CPF/CNPJ e data de validade são obrigatórios",
      });
    }

    // Limpar CPF/CNPJ
    const cpfLimpo = cpf_cnpj.replace(/\D/g, "");

    const cedente = await Cedente.create({
      nome_razao_social: nome_razao_social.trim(),
      cpf_cnpj: cpfLimpo,
      status: status || "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
      data_validade: new Date(data_validade),
      observacoes,
    });

    res.status(201).json({
      message: "Cedente criado com sucesso",
      cedente,
    });
  } catch (error) {
    console.error("Erro ao criar cedente:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "CPF/CNPJ já cadastrado" });
    }

    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
      return res.status(400).json({ error: errors.join(", ") });
    }

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
    console.error("Erro ao buscar cedente:", error);
    res.status(500).json({ error: "Erro ao buscar cedente" });
  }
};

// Atualizar cedente
exports.atualizarCedente = async (req, res) => {
  try {
    const cedente = await Cedente.findByPk(req.params.id);
    if (!cedente) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }

    // Preparar dados para atualização
    const updateData = { ...req.body };
    
    // Limpar CPF/CNPJ se fornecido
    if (updateData.cpf_cnpj) {
      updateData.cpf_cnpj = updateData.cpf_cnpj.replace(/\D/g, "");
    }
    
    // Converter data se fornecida
    if (updateData.data_validade) {
      updateData.data_validade = new Date(updateData.data_validade);
    }

    await cedente.update(updateData);

    res.json({ 
      message: "Cedente atualizado com sucesso",
      cedente 
    });
  } catch (error) {
    console.error("Erro ao atualizar cedente:", error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "CPF/CNPJ já cadastrado" });
    }
    
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(400).json({ 
        error: "Erro de validação",
        details: errors.join(', ')
      });
    }
    
    res.status(500).json({ error: "Erro ao atualizar cedente" });
  }
};

// Excluir cedente
exports.excluirCedente = async (req, res) => {
  try {
    const cedente = await Cedente.findByPk(req.params.id);
    if (!cedente) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }

    await cedente.destroy();
    res.json({ message: "Cedente excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir cedente:", error);
    res.status(500).json({ error: "Erro ao excluir cedente" });
  }
};

// Excluir todos os cedentes
exports.excluirTodos = async (req, res) => {
  try {
    const count = await Cedente.destroy({
      where: {},
      truncate: true,
    });

    res.json({
      message: "Todos os cedentes foram excluídos com sucesso",
      excluidos: count,
    });
  } catch (error) {
    console.error("Erro ao excluir todos os cedentes:", error);
    res.status(500).json({ error: "Erro ao excluir todos os cedentes" });
  }
};

// Exportar cedentes para Excel
exports.exportarCedentes = async (req, res) => {
  try {
    const cedentes = await Cedente.findAll({
      order: [["nome_razao_social", "ASC"]],
      attributes: [
        "nome_razao_social",
        "cpf_cnpj",
        "status",
        "data_validade",
        "data_cadastro",
        "observacoes",
      ],
    });

    // Formatar dados para Excel
    const dadosFormatados = cedentes.map((cedente) => ({
      "Nome/Razão Social": cedente.nome_razao_social,
      "CPF/CNPJ": cedente.cpf_cnpj,
      Status: cedente.status,
      "Data Validade": cedente.data_validade.toISOString().split("T")[0],
      "Data Cadastro": cedente.data_cadastro.toISOString().split("T")[0],
      Observações: cedente.observacoes || "",
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(dadosFormatados);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 20 }, // CPF/CNPJ
      { wch: 40 }, // Status
      { wch: 15 }, // Data Validade
      { wch: 15 }, // Data Cadastro
      { wch: 50 }, // Observações
    ];
    worksheet["!cols"] = colWidths;

    xlsx.utils.book_append_sheet(workbook, worksheet, "Cedentes");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=cedentes_${Date.now()}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao exportar cedentes:", error);
    res.status(500).json({ error: "Erro ao exportar dados" });
  }
};

// Estatísticas dos cedentes
exports.estatisticas = async (req, res) => {
  try {
    const totalCedentes = await Cedente.count();
    const porStatus = await Cedente.contarPorStatus();

    // Cedentes próximos do vencimento (30 dias)
    const trintaDias = new Date();
    trintaDias.setDate(trintaDias.getDate() + 30);

    const proximosVencimento = await Cedente.count({
      where: {
        data_validade: {
          [Op.between]: [new Date(), trintaDias],
        },
      },
    });

    // Cedentes vencidos
    const vencidos = await Cedente.count({
      where: {
        data_validade: {
          [Op.lt]: new Date(),
        },
      },
    });

    res.json({
      total: totalCedentes,
      porStatus,
      proximosVencimento,
      vencidos,
      atualizado: new Date(),
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
};

// ✅ ADICIONAR: Métodos para documentos
exports.salvarDocumentos = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentos } = req.body;

    const cedente = await Cedente.findByPk(id);
    if (!cedente) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }

    await cedente.update({ documentos });

    res.json({
      message: "Documentos salvos com sucesso",
      documentos: documentos
    });
  } catch (error) {
    console.error("Erro ao salvar documentos:", error);
    res.status(500).json({ error: "Erro interno ao salvar documentos" });
  }
};

exports.buscarDocumentos = async (req, res) => {
  try {
    const { id } = req.params;
    const cedente = await Cedente.findByPk(id, {
      attributes: ['id', 'documentos']
    });

    if (!cedente) {
      return res.status(404).json({ error: "Cedente não encontrado" });
    }

    res.json({
      documentos: cedente.documentos || {},
    });
  } catch (error) {
    console.error("Erro ao carregar documentos:", error);
    res.status(500).json({ error: "Erro interno ao carregar documentos" });
  }
};