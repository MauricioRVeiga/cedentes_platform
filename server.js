const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");
const multer = require("multer");

const app = express();

// Configurações básicas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Configurações do express
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração de sessão (DEVE VIR ANTES DAS ROTAS)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "sua-chave-secreta",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
  })
);

// Flash messages (DEVE VIR DEPOIS DA SESSÃO)
app.use(flash());

// Middleware para variáveis globais
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success");
  res.locals.error_msg = req.flash("error");
  next();
});

// Configurar upload
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /xlsx|xls/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (extname) {
      return cb(null, true);
    }
    cb("Erro: Apenas arquivos Excel!");
  },
});

// Importar rotas de autenticação
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");

// Usar rotas de autenticação
app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);

// Redirecionar raiz para login
app.get("/", (req, res) => {
  res.redirect("/auth/login");
});

// Rotas
app.get("/", (req, res) => {
  res.render("index", {
    messages: {
      success: req.flash("success"),
      error: req.flash("error"),
    },
  });
});

app.post("/upload", upload.single("planilha"), (req, res) => {
  if (!req.file) {
    req.flash("error", "Nenhum arquivo selecionado");
    return res.redirect("/");
  }

  try {
    // TODO: Processamento da planilha
    req.flash("success", "Arquivo processado com sucesso!");
    res.redirect("/");
  } catch (error) {
    req.flash("error", "Erro ao processar arquivo");
    res.redirect("/");
  }
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Algo deu errado!");
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    "\x1b[32m%s\x1b[0m",
    `🚀 Servidor rodando em http://localhost:${PORT}`
  );
  console.log(
    "\x1b[36m%s\x1b[0m",
    `📝 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`
  );
});
