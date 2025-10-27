const { Sequelize } = require("sequelize");
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
const dbUrl = process.env.DATABASE_URL;

let sequelize;

if (isProd && dbUrl) {
  // Produção -> usar Postgres se houver DATABASE_URL
  let connectionString = dbUrl;
  if (connectionString.startsWith("postgres://")) {
    // adaptador para algumas libs antigas que requerem postgresql://
    connectionString = connectionString.replace("postgres://", "postgresql://");
  }
  sequelize = new Sequelize(connectionString, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl:
        process.env.DB_SSL === "true"
          ? { require: true, rejectUnauthorized: false }
          : undefined,
    },
  });
  console.info("DB: configurado para Postgres (produção).");
} else {
  // Desenvolvimento / fallback -> usar SQLite local (não precisa de credenciais)
  const storagePath = process.env.SQLITE_STORAGE || "./cedentes.db";
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: storagePath,
    logging: false,
  });
  console.info(
    `DB: usando SQLite local em "${storagePath}" (modo desenvolvimento ou sem DATABASE_URL).`
  );
}

module.exports = sequelize;
