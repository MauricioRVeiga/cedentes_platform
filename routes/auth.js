const express = require("express");
const router = express.Router();

// GET routes
router.get("/login", (req, res) => {
  res.render("auth/login", {
    title: "Login",
    messages: req.flash(),
    layout: false, // não usar o layout global (evita navbar)
  });
});

router.get("/register", (req, res) => {
  res.render("auth/register", {
    title: "Registro",
    messages: req.flash(),
    layout: false, // não usar o layout global (evita navbar)
  });
});

// POST routes
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Aqui você implementará a lógica de autenticação
    // Por enquanto, apenas redirect
    req.flash("success", "Login realizado com sucesso!");
    res.redirect("/dashboard");
  } catch (error) {
    req.flash("error", "Erro ao fazer login");
    res.redirect("/auth/login");
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validar email corporativo
    if (!email.endsWith("@goldcreditsa.com.br")) {
      req.flash("error", "Use um email @goldcreditsa.com.br");
      return res.redirect("/auth/register");
    }

    // Aqui você implementará a criação do usuário
    // Por enquanto, apenas redirect
    req.flash("success", "Conta criada com sucesso!");
    res.redirect("/auth/login");
  } catch (error) {
    req.flash("error", "Erro ao criar conta");
    res.redirect("/auth/register");
  }
});

// Rota de logout atualizada
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Erro ao fazer logout:", err);
      return res.redirect("/dashboard");
    }
    res.clearCookie("connect.sid");
    res.redirect("/auth/login");
  });
});

module.exports = router;
