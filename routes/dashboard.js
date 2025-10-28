const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const Cedente = require("../models/cedente");

// Rota principal do dashboard
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    // Buscar cedentes com paginação
    const result = await Cedente.findAndCountAll({
      order: [["nome_razao_social", "ASC"]],
      limit,
      offset,
    });

    const cedentes = result.rows;
    const total = result.count;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const currentPage = Math.min(page, totalPages);

    // Estatísticas de status
    const statusMeta = [
      {
        key: "CONTRATO ASSINADO MANUALMENTE",
        title: "Assinado (Manual)",
        icon: "fas fa-file-signature",
        color: "success"
      },
      {
        key: "CONTRATO SEM ASSINATURA MANUAL E DIGITAL", 
        title: "Sem Assinatura",
        icon: "fas fa-times-circle",
        color: "danger"
      },
      {
        key: "CONTRATO PRECISA SER RENOVADO",
        title: "Precisa Renovar", 
        icon: "fas fa-sync-alt",
        color: "warning"
      },
      {
        key: "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR",
        title: "Faltam Assinar",
        icon: "fas fa-edit",
        color: "info"
      },
      {
        key: "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO",
        title: "Avisados Renovação",
        icon: "fas fa-bell",
        color: "primary"
      },
      {
        key: "LEVOU O CONTRATO PARA ASSINAR",
        title: "Levou p/ Assinar",
        icon: "fas fa-paper-plane", 
        color: "secondary"
      }
    ];

    // Calcular contagens para cada status
    const statusCounts = await Promise.all(
      statusMeta.map(s => 
        Cedente.count({ where: { status: s.key } })
      )
    );

    statusMeta.forEach((status, index) => {
      status.count = statusCounts[index] || 0;
    });

    // Estatísticas gerais
    const totalCedentes = total;
    
    // Cedentes vencidos
    const cedentesVencidos = await Cedente.count({
      where: {
        data_validade: {
          [Op.lt]: new Date()
        }
      }
    });

    // Cedentes próximos do vencimento (30 dias)
    const trintaDias = new Date();
    trintaDias.setDate(trintaDias.getDate() + 30);
    
    const cedentesProximosVencimento = await Cedente.count({
      where: {
        data_validade: {
          [Op.between]: [new Date(), trintaDias]
        }
      }
    });

    res.render("dashboard/index", {
      title: "Dashboard - Gestão de Cedentes",
      cedentes,
      total: totalCedentes,
      totalPages,
      currentPage,
      statusMeta,
      estatisticas: {
        total: totalCedentes,
        vencidos: cedentesVencidos,
        proximosVencimento: cedentesProximosVencimento
      },
      user: req.session.user || null,
      currentPage: 'dashboard'
    });

  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    req.flash("error", "Erro ao carregar dados do dashboard");
    
    res.render("dashboard/index", {
      title: "Dashboard - Gestão de Cedentes",
      cedentes: [],
      total: 0,
      totalPages: 1,
      currentPage: 1,
      statusMeta: [],
      estatisticas: {
        total: 0,
        vencidos: 0,
        proximosVencimento: 0
      },
      user: req.session.user || null,
      currentPage: 'dashboard'
    });
  }
});

module.exports = router;