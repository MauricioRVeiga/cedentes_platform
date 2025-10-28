const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Definir os valores do ENUM como array
const STATUS_ENUM = [
  "CONTRATO ASSINADO MANUALMENTE",
  "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
  "CONTRATO PRECISA SER RENOVADO",
  "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR",
  "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO",
  "LEVOU O CONTRATO PARA ASSINAR",
];

const Cedente = sequelize.define(
  "Cedente",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome_razao_social: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Nome/Razão Social é obrigatório",
        },
        len: {
          args: [2, 255],
          msg: "Nome deve ter entre 2 e 255 caracteres",
        },
      },
    },
    cpf_cnpj: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: {
        name: "cpf_cnpj_unique",
        msg: "CPF/CNPJ já cadastrado",
      },
      validate: {
        notEmpty: {
          msg: "CPF/CNPJ é obrigatório",
        },
        isDocumentoValido(value) {
          const cleaned = value.replace(/\D/g, "");
          if (cleaned.length !== 11 && cleaned.length !== 14) {
            throw new Error("CPF deve ter 11 dígitos ou CNPJ 14 dígitos");
          }
        },
      },
    },
    documentos: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        contrato_social: false,
        cartao_cnpj: false,
        faturamento_12meses: false,
        dre_balanco: false,
        cnh_rg_socios: false,
        ir_socios: false,
        comprovante_endereco: false,
        email: false,
        curva_abc: false,
        dados_bancarios: false,
      },
    },
    status: {
      type: DataTypes.ENUM(...STATUS_ENUM),
      allowNull: false,
      defaultValue: "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
      validate: {
        isIn: {
          args: [STATUS_ENUM],
          msg: "Status inválido",
        },
      },
    },
    data_validade: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: {
          msg: "Data de validade deve ser uma data válida",
        },
        isNotPast(value) {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          const dataValidade = new Date(value);
          dataValidade.setHours(0, 0, 0, 0);

          if (dataValidade < hoje) {
            throw new Error("Data de validade não pode ser no passado");
          }
        },
      },
    },
    data_cadastro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "cedentes",
    timestamps: false,
    indexes: [
      {
        fields: ["cpf_cnpj"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["data_validade"],
      },
    ],
  }
);

// Métodos de instância
Cedente.prototype.isVencido = function () {
  return new Date(this.data_validade) < new Date();
};

Cedente.prototype.diasParaVencer = function () {
  const hoje = new Date();
  const validade = new Date(this.data_validade);
  const diffTime = validade - hoje;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Métodos estáticos
Cedente.buscarPorStatus = function (status) {
  return this.findAll({ where: { status } });
};

Cedente.contarPorStatus = function () {
  const { Sequelize } = require("sequelize");
  return this.findAll({
    attributes: [
      "status",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
    ],
    group: ["status"],
  });
};

// ✅ ADICIONAR: Métodos para documentos
Cedente.buscarDocumentos = function (id) {
  return this.findByPk(id, {
    attributes: ['id', 'documentos']
  });
};

Cedente.salvarDocumentos = function (id, documentos) {
  return this.update(
    { documentos },
    { where: { id } }
  );
};

module.exports = Cedente;