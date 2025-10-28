require("dotenv").config();
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Importar instância do Sequelize
const sequelize = require("./config/database");

// 🔒 Configurações de Segurança
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com",
        ],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// 🔄 Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Muitas requisições deste IP. Tente novamente em 15 minutos.",
  },
});
app.use(limiter);

// Configurações básicas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");
app.use(expressLayouts);

app.use(express.static(path.join(__dirname, "public")));

// Configurações do express
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));

// Configuração de sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Flash messages
app.use(flash());

// ✅ MIDDLEWARE CORRIGIDO - Flash messages consistentes
app.use((req, res, next) => {
  // Mantenha as mensagens no formato que você já tem
  res.locals.messages = {
    success: req.flash("success"),
    error: req.flash("error"),
    warning: req.flash("warning"),
    info: req.flash("info"),
  };

  // ADICIONE estas linhas para compatibilidade com o template
  res.locals.success_msg =
    req.flash("success_msg")[0] || req.flash("success")[0] || "";
  res.locals.error_msg =
    req.flash("error_msg")[0] || req.flash("error")[0] || "";

  res.locals.user = req.session.user || null;
  res.locals.currentPage = "";
  res.locals.appName = "Gold Credit SA";
  res.locals.appVersion = "1.0.0";
  next();
});

// Importar rotas
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const insightsRoutes = require("./routes/insights");
const cedentesRoutes = require("./routes/cedentes");

// Usar rotas
app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/insights", insightsRoutes);
app.use("/api/cedentes", cedentesRoutes);

// 🏠 ROTA PRINCIPAL - Landing Page
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.render("index", {
    title: "Gold Credit SA - Sistema de Gestão de Cedentes",
    layout: "layouts/auth",
  });
});

// Middleware de autenticação
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash("error", "Por favor, faça login para acessar esta página");
    return res.redirect("/auth/login");
  }
  next();
};

// Proteger rotas
app.use("/dashboard", requireAuth);
app.use("/insights", requireAuth);
app.use("/api/cedentes", requireAuth);

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: "1.0.0",
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error("Erro:", err.stack);

  res.status(500).render("error", {
    title: "Erro do Sistema",
    message: "Algo deu errado em nosso sistema!",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Rota 404
app.use((req, res) => {
  res.status(404).render("404", {
    title: "Página Não Encontrada",
    layout: "layouts/main",
  });
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("✅ Banco de dados sincronizado com sucesso");

    // Verificar session secret
    if (
      !process.env.SESSION_SECRET ||
      process.env.SESSION_SECRET.includes("sua-chave-secreta")
    ) {
      console.warn(
        "⚠️  AVISO: SESSION_SECRET não está configurado corretamente no .env"
      );
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
      console.log(`📝 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`);
      console.log(`🔐 Página de login: http://localhost:${PORT}/auth/login`);
      console.log(`🏠 Landing page: http://localhost:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error("❌ Erro ao sincronizar o banco de dados:", err);
    process.exit(1);
  });

module.exports = app;
