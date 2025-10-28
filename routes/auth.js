const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

// Rate limiting para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  skipSuccessfulRequests: true
});

// Simulação de banco de dados de usuários
const users = [
  {
    id: 1,
    name: "Administrador",
    email: "admin@goldcreditsa.com.br",
    password: "admin123",
    role: "admin",
    createdAt: new Date(),
    lastLogin: null
  }
];

// Middleware para simular autenticação
const simulateAuth = (email, password) => {
  return users.find(user => 
    user.email === email && user.password === password
  );
};

// Middleware para flash messages
router.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error'),
    warning: req.flash('warning'),
    info: req.flash('info')
  };
  next();
});

// GET routes
router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  
  res.render("auth/login", {
    title: "Login - Gold Credit SA"
  });
});

router.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  
  res.render("auth/register", {
    title: "Registro - Gold Credit SA"
  });
});

// POST routes
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash("error", "Email e senha são obrigatórios");
      return res.redirect("/auth/login");
    }

    if (!email.endsWith("@goldcreditsa.com.br")) {
      req.flash("error", "Use um email corporativo @goldcreditsa.com.br");
      return res.redirect("/auth/login");
    }

    // Simular autenticação
    const user = simulateAuth(email, password);
    
    if (!user) {
      console.warn('Tentativa de login falhou:', { email, timestamp: new Date().toISOString() });
      req.flash("error", "Credenciais inválidas");
      return res.redirect("/auth/login");
    }

    // Atualizar último login
    user.lastLogin = new Date();

    // Criar sessão
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin
    };

    console.log('Login bem-sucedido:', { 
      email: user.email, 
      role: user.role,
      timestamp: new Date().toISOString() 
    });

    req.flash("success", `Bem-vindo, ${user.name}!`);
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error("Erro no login:", error);
    req.flash("error", "Erro interno ao fazer login");
    res.redirect("/auth/login");
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      req.flash("error", "Todos os campos são obrigatórios");
      return res.redirect("/auth/register");
    }

    if (password !== confirmPassword) {
      req.flash("error", "As senhas não coincidem");
      return res.redirect("/auth/register");
    }

    if (password.length < 6) {
      req.flash("error", "A senha deve ter pelo menos 6 caracteres");
      return res.redirect("/auth/register");
    }

    if (!email.endsWith("@goldcreditsa.com.br")) {
      req.flash("error", "Use um email corporativo @goldcreditsa.com.br");
      return res.redirect("/auth/register");
    }

    // Verificar se usuário já existe
    const userExists = users.find(user => user.email === email);
    if (userExists) {
      req.flash("error", "Email já cadastrado");
      return res.redirect("/auth/register");
    }

    // Criar novo usuário
    const newUser = {
      id: users.length + 1,
      name,
      email,
      password,
      role: "user",
      createdAt: new Date(),
      lastLogin: null
    };
    
    users.push(newUser);

    console.log('Novo usuário registrado:', { 
      email: newUser.email, 
      timestamp: new Date().toISOString() 
    });

    req.flash("success", "Conta criada com sucesso! Faça login para continuar.");
    res.redirect("/auth/login");
    
  } catch (error) {
    console.error("Erro no registro:", error);
    req.flash("error", "Erro ao criar conta");
    res.redirect("/auth/register");
  }
});

// Rota de logout
router.get("/logout", (req, res) => {
  if (req.session.user) {
    console.log('Logout:', { 
      email: req.session.user.email, 
      timestamp: new Date().toISOString() 
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Erro ao fazer logout:", err);
      return res.redirect("/dashboard");
    }
    res.clearCookie("connect.sid");
    res.redirect("/auth/login");
  });
});

// Rota para verificar sessão (API)
router.get("/session", (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email,
        role: req.session.user.role
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

module.exports = router;