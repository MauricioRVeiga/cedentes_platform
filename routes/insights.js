const express = require("express");
const router = express.Router();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.get("/", async (req, res) => {
  try {
    res.render("insights/index", {
      title: "Insights",
      messages: req.flash(),
      script: "", // Adicionar script vazio por padrão
    });
  } catch (error) {
    console.error("Erro ao carregar insights:", error);
    req.flash("error", "Erro ao carregar insights");
    res.redirect("/dashboard");
  }
});

router.post("/analyze", async (req, res) => {
  try {
    const { data } = req.body;

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Você é um analista especializado em análise de dados de cedentes financeiros.",
        },
        {
          role: "user",
          content: `Analise os seguintes dados e forneça insights relevantes: ${JSON.stringify(
            data
          )}`,
        },
      ],
      model: "gpt-4-turbo-preview",
    });

    res.json({ insights: completion.choices[0].message.content });
  } catch (error) {
    console.error("Erro na análise:", error);
    res.status(500).json({ error: "Erro ao gerar insights" });
  }
});

module.exports = router;
