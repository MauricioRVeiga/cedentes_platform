const { Sequelize } = require("sequelize");
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
const dbUrl = process.env.DATABASE_URL;

let sequelize;

if (isProd && dbUrl) {
  // Produção -> usar Postgres
  let connectionString = dbUrl;
  if (connectionString.startsWith("postgres://")) {
    connectionString = connectionString.replace("postgres://", "postgresql://");
  }
  
  sequelize = new Sequelize(connectionString, {
    dialect: "postgres",
    logging: process.env.DB_LOGGING === "true" ? console.log : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === "true" ? { 
        require: true, 
        rejectUnauthorized: false 
      } : false,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
  console.info("📊 DB: Configurado para PostgreSQL (produção)");
} else {
  // Desenvolvimento -> SQLite
  const storagePath = process.env.SQLITE_STORAGE || "./database/cedentes.db";
  const path = require("path");
  const fs = require("fs");
  
  // Garantir que o diretório existe
  const dbDir = path.dirname(storagePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: storagePath,
    logging: process.env.DB_LOGGING === "true" ? console.log : false,
  });
  console.info(`📊 DB: SQLite em "${storagePath}" (desenvolvimento)`);
}

// Testar conexão
sequelize.authenticate()
  .then(() => {
    console.log("✅ Conexão com o banco estabelecida com sucesso");
  })
  .catch(err => {
    console.error("❌ Erro ao conectar com o banco:", err);
    process.exit(1);
  });

module.exports = sequelize;