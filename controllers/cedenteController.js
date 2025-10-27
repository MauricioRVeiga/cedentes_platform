const Cedente = require("../models/cedente");
const xlsx = require("xlsx");

exports.uploadPlanilha = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    for (let row of data) {
      await Cedente.create({
        nome_razao_social: row.nome_razao_social,
        cpf_cnpj: row.cpf_cnpj,
        contrato: row.contrato || null,
        validade_contrato: row.validade_contrato || null,
      });
    }

    res.json({
      message: "Planilha processada com sucesso",
      count: data.length,
    });
  } catch (error) {
    console.error("Erro ao processar planilha:", error);
    res.status(500).json({ error: "Erro ao processar planilha" });
  }
};

exports.listarCedentes = async (req, res) => {
  try {
    const cedentes = await Cedente.findAll({
      order: [["nome_razao_social", "ASC"]],
    });
    res.json(cedentes);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar cedentes" });
  }
};

exports.adicionarCedente = async (req, res) => {
  try {
    const cedente = await Cedente.create(req.body);
    res.status(201).json(cedente);
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar cedente" });
  }
};

exports.importarPlanilha = async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const cedentes = await Cedente.bulkCreate(data);
    res.json({ message: `${cedentes.length} cedentes importados` });
  } catch (error) {
    res.status(400).json({ error: "Erro ao importar planilha" });
  }
};
