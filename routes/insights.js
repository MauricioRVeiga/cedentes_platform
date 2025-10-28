const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();
const Cedente = require("../models/cedente");
const OpenAI = require("openai");

// Configurar OpenAI (opcional - apenas se tiver API key)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

router.get("/", async (req, res) => {
  try {
    // Buscar dados para insights
    const totalCedentes = await Cedente.count();
    const porStatus = await Cedente.contarPorStatus();
    
    const cedentesVencidos = await Cedente.count({
      where: {
        data_validade: {
          [Op.lt]: new Date()
        }
      }
    });

    const cedentesProximos = await Cedente.count({
      where: {
        data_validade: {
          [Op.between]: [
            new Date(),
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          ]
        }
      }
    });

    // Dados para gráficos
    const dadosGraficos = {
      porStatus: porStatus.map(item => ({
        status: item.status,
        total: item.get('total')
      })),
      vencimentos: {
        vencidos: cedentesVencidos,
        proximos: cedentesProximos,
        emDia: totalCedentes - cedentesVencidos - cedentesProximos
      }
    };

    res.render("insights/index", {
      title: "Insights e Analytics",
      estatisticas: {
        total: totalCedentes,
        vencidos: cedentesVencidos,
        proximosVencimento: cedentesProximos
      },
      dadosGraficos,
      user: req.session.user || null,
      currentPage: 'insights'
    });
  } catch (error) {
    console.error("Erro ao carregar insights:", error);
    req.flash("error", "Erro ao carregar insights analíticos");
    
    res.render("insights/index", {
      title: "Insights e Analytics", 
      estatisticas: {
        total: 0,
        vencidos: 0,
        proximosVencimento: 0
      },
      dadosGraficos: {
        porStatus: [],
        vencimentos: {
          vencidos: 0,
          proximos: 0, 
          emDia: 0
        }
      },
      user: req.session.user || null,
      currentPage: 'insights'
    });
  }
});

// Rota para verificar configuração da IA
router.get("/check-config", (req, res) => {
  res.json({
    iaAvailable: !!process.env.OPENAI_API_KEY,
    hasData: false
  });
});

// Rota para análise com IA (opcional)
router.post("/analyze", async (req, res) => {
  try {
    if (!openai) {
      return res.status(400).json({ 
        error: "Análise com IA não disponível. Configure OPENAI_API_KEY no .env" 
      });
    }

    // Buscar dados do banco
    const cedentesData = await Cedente.findAll({
      attributes: ["status", "data_validade", "data_cadastro"],
      raw: true
    });

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um analista especializado em análise de dados de cedentes financeiros. Forneça insights acionáveis em português."
        },
        {
          role: "user", 
          content: `Analise os seguintes dados de cedentes e forneça insights relevantes sobre status de contratos e vencimentos: ${JSON.stringify(cedentesData)}`
        }
      ],
      model: "gpt-3.5-turbo",
      max_tokens: 500
    });

    res.json({ 
      insights: completion.choices[0].message.content,
      modelo: "gpt-3.5-turbo"
    });
  } catch (error) {
    console.error("Erro na análise com IA:", error);
    
    // Fallback para análise básica
    const insightsBasicos = await gerarInsightsBasicos();
    
    res.json({
      insights: insightsBasicos,
      observacao: "Insights gerados automaticamente (IA não disponível)"
    });
  }
});

// Função fallback para insights básicos
async function gerarInsightsBasicos() {
  try {
    const total = await Cedente.count();
    const porStatus = await Cedente.contarPorStatus();
    const vencidos = await Cedente.count({
      where: {
        data_validade: { [Op.lt]: new Date() }
      }
    });

    let insights = `## Análise dos Cedentes\n\n`;
    insights += `- **Total de cedentes:** ${total}\n`;
    insights += `- **Contratos vencidos:** ${vencidos}\n\n`;
    
    insights += `## Distribuição por Status:\n`;
    porStatus.forEach(item => {
      const percentual = ((item.get('total') / total) * 100).toFixed(1);
      insights += `- ${item.status}: ${item.get('total')} (${percentual}%)\n`;
    });

    insights += `\n## Recomendações:\n`;
    
    if (vencidos > 0) {
      insights += `- ⚠️ Atenção: ${vencidos} contrato(s) vencido(s) precisam de ação imediata\n`;
    }
    
    const semAssinatura = porStatus.find(s => s.status === "CONTRATO SEM ASSINATURA MANUAL E DIGITAL");
    if (semAssinatura && semAssinatura.get('total') > 0) {
      insights += `- 📝 ${semAssinatura.get('total')} contrato(s) aguardam assinatura\n`;
    }

    return insights;
  } catch (error) {
    return "Não foi possível gerar insights no momento. Tente novamente mais tarde.";
  }
}

module.exports = router;