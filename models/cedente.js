const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Cedente = sequelize.define("Cedente", {
  nome_razao_social: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cpf_cnpj: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM([
      "CONTRATO ASSINADO MANUALMENTE",
      "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
      "CONTRATO PRECISA SER RENOVADO",
      "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR",
      "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO",
      "LEVOU O CONTRATO PARA ASSINAR",
    ]),
    defaultValue: "CONTRATO SEM ASSINATURA MANUAL E DIGITAL",
  },
  data_validade: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  data_cadastro: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Cedente;
