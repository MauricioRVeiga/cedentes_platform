class CedentesManager {
  constructor() {
    this.cedentes = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.filteredCedentes = [];
    this.searchTimeout = null;
    this.cedenteParaExcluir = null;
    this.init();
  }

  async init() {
    await this.carregarCedentes();
    this.configurarEventos();
    this.configurarModalExclusao();
    this.inicializarSistemaNotificacoes();
  }

  // SISTEMA DE EXPORTAÇÃO

  async abrirModalExportacao() {
    const modal = document.getElementById("modal-exportacao");
    if (modal) {
      await this.carregarPreviewExportacao();
      modal.style.display = "block";
    }
  }

  fecharModalExportacao() {
    const modal = document.getElementById("modal-exportacao");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async carregarPreviewExportacao() {
    const previewBody = document.getElementById("export-preview-body");
    if (!previewBody) return;

    // Usar os dados filtrados atuais para preview
    const dadosPreview = this.filteredCedentes.slice(0, 5); // Mostrar apenas 5 registros

    if (dadosPreview.length === 0) {
      previewBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--gray-400); padding: 20px;">
                    Nenhum dado para mostrar
                </td>
            </tr>
        `;
      return;
    }

    let html = "";
    dadosPreview.forEach((cedente) => {
      html += `
            <tr>
                <td>${cedente.nome_razao_social || ""}</td>
                <td>${cedente.cpf_cnpj || ""}</td>
                <td>${cedente.contrato || ""}</td>
                <td>${
                  cedente.documentos_completos ? "Completo" : "Pendente"
                }</td>
            </tr>
        `;
    });

    previewBody.innerHTML = html;
  }

  async executarExportacao() {
    const tipoExportacao = document.getElementById("export-tipo").value;
    const colunasSelecionadas = this.obterColunasSelecionadas();

    if (colunasSelecionadas.length === 0) {
      this.mostrarMensagem(
        "Selecione pelo menos uma coluna para exportar!",
        "error"
      );
      return;
    }

    try {
      this.mostrarMensagem("Preparando exportação...", "success");

      // Mostrar loading na interface
      this.mostrarLoadingExportacao();

      if (tipoExportacao === "filtrado") {
        await this.exportarExcelFiltrado();
      } else {
        await this.exportarExcelCompleto();
      }

      this.fecharModalExportacao();
    } catch (error) {
      console.error("Erro na exportação:", error);
      this.mostrarMensagem("Erro ao exportar dados: " + error.message, "error");
    } finally {
      this.esconderLoadingExportacao();
    }
  }

  mostrarLoadingExportacao() {
    const exportBtn = document.querySelector("#modal-exportacao .btn-primary");
    const originalText = exportBtn?.innerHTML;

    if (exportBtn && originalText) {
      exportBtn.setAttribute("data-original-text", originalText);
      exportBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Exportando...';
      exportBtn.disabled = true;
    }
  }

  esconderLoadingExportacao() {
    const exportBtn = document.querySelector("#modal-exportacao .btn-primary");
    const originalText = exportBtn?.getAttribute("data-original-text");

    if (exportBtn && originalText) {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
      exportBtn.removeAttribute("data-original-text");
    }
  }

  obterColunasSelecionadas() {
    const checkboxes = document.querySelectorAll(
      'input[name="export-colunas"]:checked'
    );
    return Array.from(checkboxes).map((cb) => cb.value);
  }

  async exportarExcelCompleto() {
    try {
      this.mostrarMensagem("Exportando todos os cedentes...", "success");

      const response = await fetch("/api/exportar/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erro na resposta do servidor");
      }

      // Criar blob e fazer download
      const blob = await response.blob();

      // Verificar se o blob está vazio
      if (blob.size === 0) {
        throw new Error("Arquivo vazio recebido do servidor");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Obter filename do header ou usar padrão
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "cedentes_export.xlsx";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      // Limpeza segura
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      this.mostrarMensagem("Exportação concluída com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao exportar Excel completo:", error);
      this.mostrarMensagem("Erro ao exportar: " + error.message, "error");
      throw error;
    }
  }

  async exportarExcelFiltrado() {
    try {
      this.mostrarMensagem("Exportando dados filtrados...", "success");

      // Preparar dados para exportação
      const dadosExportacao = this.filteredCedentes.map((cedente) => ({
        id: cedente.id,
        nome_razao_social: cedente.nome_razao_social,
        cpf_cnpj: cedente.cpf_cnpj,
        contrato: cedente.contrato,
        validade_contrato: cedente.validade_contrato,
        documentos_completos: cedente.documentos_completos,
      }));

      const response = await fetch("/api/exportar/excel-filtrado", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cedentes: dadosExportacao }),
      });

      if (!response.ok) {
        throw new Error("Erro na resposta do servidor");
      }

      // Criar blob e fazer download
      const blob = await response.blob();

      // Verificar se o blob está vazio
      if (blob.size === 0) {
        throw new Error("Arquivo vazio recebido do servidor");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Obter filename do header ou usar padrão
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "cedentes_filtrados.xlsx";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      // Limpeza segura
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      this.mostrarMensagem(
        "Exportação filtrada concluída com sucesso!",
        "success"
      );
    } catch (error) {
      console.error("Erro ao exportar Excel filtrado:", error);
      this.mostrarMensagem("Erro ao exportar: " + error.message, "error");
      throw error;
    }
  }

  // Métodos de Backup
  async criarBackup() {
    try {
      // Mostrar loading no botão
      const btnNovoBackup = document.querySelector(
        "#modal-backups .btn-primary"
      );
      const originalText = btnNovoBackup ? btnNovoBackup.innerHTML : "";

      if (btnNovoBackup) {
        btnNovoBackup.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Criando...';
        btnNovoBackup.disabled = true;
      }

      this.mostrarMensagem("Criando backup...", "success");

      const response = await fetch("/api/backup/criar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ motivo: "manual" }),
      });

      const resultado = await response.json();

      // Restaurar botão
      if (btnNovoBackup) {
        btnNovoBackup.innerHTML = originalText;
        btnNovoBackup.disabled = false;
      }

      if (resultado.success) {
        this.mostrarMensagem(
          `Backup criado com sucesso: ${resultado.filename}`,
          "success"
        );

        // ✅ ATUALIZAR AUTOMATICAMENTE se o modal estiver aberto
        const modalBackups = document.getElementById("modal-backups");
        if (modalBackups && modalBackups.style.display === "block") {
          // Mostrar loading na lista
          const listaElement = document.getElementById("lista-backups");
          if (listaElement) {
            listaElement.innerHTML =
              '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Atualizando lista...</div>';
          }

          // Recarregar lista e estatísticas
          await Promise.all([
            this.carregarListaBackups(),
            this.carregarEstatisticasBackup(),
          ]);

          // Mostrar mensagem de sucesso na lista
          setTimeout(() => {
            if (listaElement) {
              const backupItem = listaElement.querySelector(".backup-item");
              if (backupItem) {
                backupItem.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }
          }, 500);
        }
      } else {
        this.mostrarMensagem(
          `Erro ao criar backup: ${resultado.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro ao criar backup:", error);
      this.mostrarMensagem("Erro ao criar backup", "error");

      // Restaurar botão em caso de erro
      const btnNovoBackup = document.querySelector(
        "#modal-backups .btn-primary"
      );
      if (btnNovoBackup) {
        btnNovoBackup.innerHTML = '<i class="fas fa-plus"></i> Novo Backup';
        btnNovoBackup.disabled = false;
      }
    }
  }

  // =============================================================================
  // SISTEMA DE NOTIFICAÇÕES
  // =============================================================================

  async inicializarSistemaNotificacoes() {
    // Carregar notificações ao iniciar
    await this.carregarNotificacoes();

    // Atualizar notificações a cada 30 segundos
    setInterval(() => {
      this.carregarNotificacoes();
    }, 30000);
  }

  async carregarNotificacoes() {
    try {
      const response = await fetch("/api/notificacoes");
      const notificacoes = await response.json();

      this.atualizarBadgeNotificacoes(notificacoes.length);

      // Se o modal estiver aberto, atualizar a lista
      const modalNotificacoes = document.getElementById("modal-notificacoes");
      if (modalNotificacoes && modalNotificacoes.style.display === "block") {
        this.renderizarListaNotificacoes(notificacoes);
      }
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    }
  }

  atualizarBadgeNotificacoes(total) {
    const badge = document.getElementById("notifications-badge");
    const totalElement = document.getElementById("notifications-total");

    if (badge) {
      badge.textContent = total > 99 ? "99+" : total;
      badge.style.display = total > 0 ? "flex" : "none";
    }

    if (totalElement) {
      totalElement.textContent = `${total} notificação${
        total !== 1 ? "es" : ""
      } não lida${total !== 1 ? "s" : ""}`;
    }
  }

  async abrirModalNotificacoes() {
    const modal = document.getElementById("modal-notificacoes");
    if (modal) {
      await this.carregarListaNotificacoes();
      modal.style.display = "block";
    }
  }

  fecharModalNotificacoes() {
    const modal = document.getElementById("modal-notificacoes");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async carregarListaNotificacoes() {
    try {
      const response = await fetch("/api/notificacoes");
      const notificacoes = await response.json();

      this.renderizarListaNotificacoes(notificacoes);
    } catch (error) {
      console.error("Erro ao carregar lista de notificações:", error);
      this.mostrarMensagem("Erro ao carregar notificações", "error");
    }
  }

  renderizarListaNotificacoes(notificacoes) {
    const listaElement = document.getElementById("notifications-list");

    if (!listaElement) return;

    if (notificacoes.length === 0) {
      listaElement.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>Nenhuma notificação</h3>
                <p>Você está em dia com tudo!</p>
            </div>
        `;
      return;
    }

    let html = "";

    notificacoes.forEach((notificacao) => {
      const timeAgo = this.calcularTempoDecorrido(notificacao.data_criacao);
      const tipoClasse = `notification-${notificacao.tipo}`;
      const lidaClasse = notificacao.lida ? "lida" : "";

      html += `
            <div class="notification-item ${tipoClasse} ${lidaClasse}" data-id="${
        notificacao.id
      }">
                <div class="notification-header">
                    <h4 class="notification-title">${notificacao.titulo}</h4>
                    <span class="notification-time">${timeAgo}</span>
                </div>
                <div class="notification-message">${notificacao.mensagem}</div>
                ${
                  notificacao.cedente_nome
                    ? `
                    <div class="notification-cedente">
                        <i class="fas fa-user"></i>
                        ${notificacao.cedente_nome}
                    </div>
                `
                    : ""
                }
                ${
                  !notificacao.lida
                    ? `
                    <div class="notification-actions">
                        <button class="btn-secondary" onclick="manager.marcarNotificacaoLida(${notificacao.id})">
                            <i class="fas fa-check"></i> Marcar como Lida
                        </button>
                    </div>
                `
                    : ""
                }
            </div>
        `;
    });

    listaElement.innerHTML = html;
  }

  calcularTempoDecorrido(dataString) {
    const agora = new Date();
    const data = new Date(dataString);
    const diffMs = agora - data;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `Há ${diffMins} min${diffMins !== 1 ? "s" : ""}`;
    if (diffHours < 24) return `Há ${diffHours} h${diffHours !== 1 ? "s" : ""}`;
    if (diffDays < 7) return `Há ${diffDays} dia${diffDays !== 1 ? "s" : ""}`;

    return data.toLocaleDateString("pt-BR");
  }

  async marcarNotificacaoLida(notificacaoId) {
    try {
      const response = await fetch(
        `/api/notificacoes/${notificacaoId}/marcar-lida`,
        {
          method: "POST",
        }
      );

      const resultado = await response.json();

      if (resultado.success) {
        // Recarregar a lista de notificações
        await this.carregarListaNotificacoes();
        await this.carregarNotificacoes(); // Atualizar o badge
      } else {
        this.mostrarMensagem("Erro ao marcar notificação como lida", "error");
      }
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      this.mostrarMensagem("Erro ao marcar notificação como lida", "error");
    }
  }

  async marcarTodasNotificacoesLidas() {
    try {
      const response = await fetch("/api/notificacoes/marcar-todas-lidas", {
        method: "POST",
      });

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem(
          "Todas notificações marcadas como lidas!",
          "success"
        );
        await this.carregarListaNotificacoes();
        await this.carregarNotificacoes(); // Atualizar o badge
      } else {
        this.mostrarMensagem("Erro ao marcar notificações como lidas", "error");
      }
    } catch (error) {
      console.error("Erro ao marcar todas notificações como lidas:", error);
      this.mostrarMensagem("Erro ao marcar notificações como lidas", "error");
    }
  }

  async executarVerificacaoManual() {
    try {
      this.mostrarMensagem("Executando verificação manual...", "success");

      const response = await fetch(
        "/api/notificacoes/executar-verificacao-manual",
        {
          method: "POST",
        }
      );

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem("Verificação manual concluída!", "success");
        // Aguardar um pouco e recarregar as notificações
        setTimeout(() => {
          this.carregarListaNotificacoes();
          this.carregarNotificacoes();
        }, 1000);
      } else {
        this.mostrarMensagem("Erro na verificação manual", "error");
      }
    } catch (error) {
      console.error("Erro na verificação manual:", error);
      this.mostrarMensagem("Erro na verificação manual", "error");
    }
  }

  async abrirModalBackups() {
    const modal = document.getElementById("modal-backups");
    if (modal) {
      await this.carregarListaBackups();
      await this.carregarEstatisticasBackup();
      modal.style.display = "block";
    }
  }

  fecharModalBackups() {
    const modal = document.getElementById("modal-backups");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async carregarListaBackups() {
    try {
      const listaElement = document.getElementById("lista-backups");
      if (listaElement) {
        listaElement.innerHTML =
          '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando backups...</div>';
      }

      const response = await fetch("/api/backup/listar");
      const resultado = await response.json();

      if (resultado.success && resultado.backups.length > 0) {
        let html = "";

        resultado.backups.forEach((backup, index) => {
          const isNewest = index === 0; // Destacar o mais recente
          html += `
                    <div class="backup-item ${
                      isNewest ? "newest-backup" : ""
                    }" style="border: 1px solid var(--gray-200); padding: 15px; margin-bottom: 10px; border-radius: 8px; background: var(--surface-primary); ${
            isNewest ? "border-left: 4px solid var(--success-500);" : ""
          }">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                                    <strong>${backup.filename}</strong>
                                    ${
                                      isNewest
                                        ? '<span style="margin-left: 10px; background: var(--success-500); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">MAIS RECENTE</span>'
                                        : ""
                                    }
                                </div>
                                <small style="color: var(--gray-500);">
                                    <div>📅 Criado: ${backup.modified}</div>
                                    <div>💾 Tamanho: ${backup.size_mb} MB</div>
                                    <div>🏷️ Motivo: ${backup.motivo}</div>
                                </small>
                            </div>
                            <button class="btn-secondary" onclick="manager.restaurarBackup(\`${
                              backup.filename
                            }\`)" style="margin-left: 10px; white-space: nowrap;">
                                <i class="fas fa-undo"></i> Restaurar
                            </button>
                        </div>
                    </div>
                `;
        });

        if (listaElement) {
          listaElement.innerHTML = html;
        }
      } else {
        if (listaElement) {
          listaElement.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--gray-500);">
                        <i class="fas fa-database" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <h3>Nenhum backup encontrado</h3>
                        <p>Clique em "Novo Backup" para criar seu primeiro backup</p>
                    </div>
                `;
        }
      }
    } catch (error) {
      console.error("Erro ao carregar backups:", error);
      const listaElement = document.getElementById("lista-backups");
      if (listaElement) {
        listaElement.innerHTML = `
                <div style="color: var(--error-500); text-align: center; padding: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar backups</p>
                    <small>${error.message}</small>
                </div>
            `;
      }
    }
  }

  async carregarEstatisticasBackup() {
    try {
      const response = await fetch("/api/backup/estatisticas");
      const resultado = await response.json();

      const statsElement = document.getElementById("backup-estatisticas");

      if (resultado.success) {
        const stats = resultado.estatisticas;
        statsElement.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><strong>Total de Backups:</strong> ${
                      stats.total_backups
                    }</div>
                    <div><strong>Tamanho Total:</strong> ${
                      stats.tamanho_total_mb
                    } MB</div>
                    <div><strong>Mais Recente:</strong> ${
                      stats.backup_mais_recente || "N/A"
                    }</div>
                    <div><strong>Mais Antigo:</strong> ${
                      stats.backup_mais_antigo || "N/A"
                    }</div>
                </div>
            `;
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  }

  async restaurarBackup(filename) {
    if (
      !confirm(
        `Tem certeza que deseja restaurar o backup "${filename}"? Esta ação substituirá o banco de dados atual.`
      )
    ) {
      return;
    }

    try {
      this.mostrarMensagem("Restaurando backup...", "success");

      const response = await fetch("/api/backup/restaurar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename: filename }),
      });

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem(
          "Backup restaurado com sucesso! Recarregando dados...",
          "success"
        );

        // Recarregar os dados após restauração
        setTimeout(() => {
          this.carregarCedentes();
          this.fecharModalBackups();
        }, 2000);
      } else {
        this.mostrarMensagem(
          `Erro ao restaurar backup: ${resultado.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro ao restaurar backup:", error);
      this.mostrarMensagem("Erro ao restaurar backup", "error");
    }
  }

  calcularEstatisticas() {
    const total = this.cedentes.length;

    // Contar por cada tipo de status
    const assinados = this.cedentes.filter(
      (c) => c.contrato === "assinado_manual"
    ).length;

    const enviados = this.cedentes.filter(
      (c) => c.contrato === "levou_contrato"
    ).length;

    const renovar = this.cedentes.filter(
      (c) => c.contrato === "precisa_renovar"
    ).length;

    const atencao = this.cedentes.filter(
      (c) => c.contrato === "pontos_atencao"
    ).length;

    const semAssinatura = this.cedentes.filter(
      (c) => c.contrato === "sem_assinatura"
    ).length;

    const faltamAssinar = this.cedentes.filter(
      (c) => c.contrato === "faltam_assinar"
    ).length;

    const avisados = this.cedentes.filter(
      (c) => c.contrato === "avisados_renovacao"
    ).length;

    // Atualizar todos os elementos no DOM
    const elements = {
      "total-cedentes-stat": total,
      "assinados-stat": assinados,
      "enviados-stat": enviados,
      "renovar-stat": renovar,
      "atencao-stat": atencao,
      "sem-assinatura-stat": semAssinatura,
      "faltam-assinar-stat": faltamAssinar,
      "avisados-stat": avisados,
    };

    // Atualizar cada elemento
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        // Animação de contagem
        this.animateCount(element, value);
      }
    });
  }

  // Método auxiliar para animação de contagem
  animateCount(element, targetValue) {
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;

    const duration = 500; // ms
    const steps = 20;
    const increment = (targetValue - currentValue) / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newValue = Math.round(currentValue + increment * currentStep);

      if (
        currentStep >= steps ||
        (increment > 0 && newValue >= targetValue) ||
        (increment < 0 && newValue <= targetValue)
      ) {
        element.textContent = targetValue;
        clearInterval(timer);
      } else {
        element.textContent = newValue;
      }
    }, duration / steps);
  }

  async carregarCedentes() {
    try {
      const corpoTabela = document.getElementById("corpo-tabela");
      if (corpoTabela) {
        corpoTabela.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state">
              <i class="fas fa-spinner fa-spin"></i>
              <div>Carregando cedentes...</div>
            </td>
          </tr>
        `;
      }

      const response = await fetch("/api/cedentes");
      this.cedentes = await response.json();
      // NÃO PRECISA MAIS ORDENAR AQUI - JÁ VEM ORDENADO DO BACKEND
      this.filteredCedentes = [...this.cedentes];

      // Carrega o status dos documentos para cada cedente
      await this.carregarStatusDocumentosTodos();

      this.renderizarTabela();
    } catch (error) {
      console.error("Erro ao carregar cedentes:", error);
      this.mostrarMensagem(
        "Erro ao carregar cedentes. Tente recarregar a página.",
        "error"
      );
    }
  }

  async carregarStatusDocumentosTodos() {
    const promises = this.cedentes.map(async (cedente) => {
      try {
        const response = await fetch(
          `/api/cedentes/${cedente.id}/status-documentos`
        );
        const resultado = await response.json();
        cedente.documentos_completos = resultado.documentos_completos || false;
      } catch (error) {
        console.error(
          `Erro ao carregar status para cedente ${cedente.id}:`,
          error
        );
        cedente.documentos_completos = false;
      }
    });

    await Promise.all(promises);
  }

  configurarEventos() {
    // Formulário de adição
    const formCedente = document.getElementById("form-cedente");
    if (formCedente) {
      formCedente.addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarCedente();
      });
    }

    // Formulário de edição
    const formEditar = document.getElementById("form-editar");
    if (formEditar) {
      formEditar.addEventListener("submit", (e) => {
        e.preventDefault();
        this.atualizarCedente();
      });
    }

    // Formulário de importação
    const formImportar = document.getElementById("form-importar");
    if (formImportar) {
      formImportar.addEventListener("submit", (e) => {
        e.preventDefault();
        this.importarExcel();
      });
    }

    // Botão para excluir todos os cedentes
    const btnExcluirTodos = document.getElementById("btn-excluir-todos");
    if (btnExcluirTodos) {
      btnExcluirTodos.addEventListener("click", () => {
        this.confirmarExclusaoTodos();
      });
    }

    // Filtros
    const searchInput = document.getElementById("search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.filtrarCedentes();
        }, 300);
      });
    }

    const statusFilter = document.getElementById("status-filter");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => {
        this.filtrarCedentes();
      });
    }

    // Modal de notificações
    const closeNotifications = document.querySelector(
      "#modal-notificacoes .close"
    );
    if (closeNotifications) {
      closeNotifications.addEventListener("click", () => {
        this.fecharModalNotificacoes();
      });
    }

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("modal-notificacoes");
      if (e.target === modal) {
        this.fecharModalNotificacoes();
      }
    });

    // Modal de backups
    const closeBackups = document.querySelector("#modal-backups .close");
    if (closeBackups) {
      closeBackups.addEventListener("click", () => {
        this.fecharModalBackups();
      });
    }

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("modal-backups");
      if (e.target === modal) {
        this.fecharModalBackups();
      }
    });

    // Modal de exportação
    const closeExport = document.querySelector("#modal-exportacao .close");
    if (closeExport) {
      closeExport.addEventListener("click", () => {
        this.fecharModalExportacao();
      });
    }

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("modal-exportacao");
      if (e.target === modal) {
        this.fecharModalExportacao();
      }
    });

    // Atualizar preview quando mudar o tipo de exportação
    const exportTipo = document.getElementById("export-tipo");
    if (exportTipo) {
      exportTipo.addEventListener("change", () => {
        this.carregarPreviewExportacao();
      });
    }

    // Modal de edição
    const closeButton = document.querySelector("#modal-editar .close");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        this.fecharModal();
      });
    }

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("modal-editar");
      if (e.target === modal) {
        this.fecharModal();
      }
    });

    // Modal de documentos
    const closeDocumentos = document.querySelector("#modal-documentos .close");
    if (closeDocumentos) {
      closeDocumentos.addEventListener("click", () => {
        this.fecharModalDocumentos();
      });
    }

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("modal-documentos");
      if (e.target === modal) {
        this.fecharModalDocumentos();
      }
    });

    // Formulário de documentos
    const formDocumentos = document.getElementById("form-documentos");
    if (formDocumentos) {
      formDocumentos.addEventListener("submit", (e) => {
        e.preventDefault();
        this.salvarDocumentos();
      });
    }

    // Eventos de change nos checkboxes para atualizar status em tempo real
    const checkboxes = document.querySelectorAll(
      '#form-documentos input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.atualizarStatusDocumentos();
      });
    });

    // Fechar modal com ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.fecharModal();
        this.fecharModalExclusao();
        this.fecharModalDocumentos();
        this.fecharModalNotificacoes();
        this.fecharModalBackups();
        this.fecharModalExportacao();
      }
    });
  }

  configurarModalExclusao() {
    const modalExcluir = document.getElementById("modal-excluir");
    const btnConfirmarExclusao = modalExcluir.querySelector(".btn-confirm-yes");
    const btnCancelarExclusao = modalExcluir.querySelector(".btn-confirm-no");
    const btnFecharExclusao = modalExcluir.querySelector(".close");

    btnConfirmarExclusao.addEventListener("click", () => {
      this.confirmarExclusao();
    });

    btnCancelarExclusao.addEventListener("click", () => {
      this.fecharModalExclusao();
    });

    btnFecharExclusao.addEventListener("click", () => {
      this.fecharModalExclusao();
    });

    // Fechar modal clicando fora
    modalExcluir.addEventListener("click", (e) => {
      if (e.target === modalExcluir) {
        this.fecharModalExclusao();
      }
    });
  }

  // MÉTODOS PARA DOCUMENTOS
  async abrirModalDocumentos(cedente) {
    const modal = document.getElementById("modal-documentos");
    const nomeElement = document.getElementById("documentos-cedente-nome");
    const idElement = document.getElementById("documentos-cedente-id");

    if (modal && nomeElement && idElement) {
      // Preenche os dados do cedente
      nomeElement.textContent = cedente.nome_razao_social || "";
      idElement.value = cedente.id;

      // Carrega os documentos existentes
      await this.carregarDocumentosCedente(cedente.id);

      // Abre o modal
      modal.style.display = "block";
    }
  }

  fecharModalDocumentos() {
    const modal = document.getElementById("modal-documentos");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async carregarDocumentosCedente(cedenteId) {
    try {
      const response = await fetch(`/api/cedentes/${cedenteId}/documentos`);
      const documentos = await response.json();

      // Preenche os checkboxes
      const campos = [
        "contrato_social",
        "cartao_cnpj",
        "faturamento_12meses",
        "dre_balanco",
        "cnh_rg_socios",
        "ir_socios",
        "comprovante_endereco",
        "email",
        "curva_abc",
        "dados_bancarios",
      ];

      campos.forEach((campo) => {
        const checkbox = document.getElementById(`doc-${campo}`);
        if (checkbox) {
          checkbox.checked = documentos[campo] || false;
        }
      });

      // Atualiza o status
      this.atualizarStatusDocumentos();
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      this.mostrarMensagem("Erro ao carregar documentos", "error");
    }
  }

  atualizarStatusDocumentos() {
    const checkboxes = document.querySelectorAll(
      '#form-documentos input[type="checkbox"]'
    );
    let checkedCount = 0;
    let totalCount = 0;

    checkboxes.forEach((checkbox) => {
      totalCount++;
      if (checkbox.checked) checkedCount++;
    });

    const statusElement = document.getElementById("status-documentos");
    if (statusElement) {
      if (checkedCount === totalCount) {
        statusElement.innerHTML =
          '<i class="fas fa-check-circle"></i> Todos os Documentos Concluídos';
        statusElement.className = "status-completo";
      } else {
        statusElement.innerHTML = `<i class="fas fa-times-circle"></i> ${checkedCount}/${totalCount} Documentos Concluídos`;
        statusElement.className = "status-pendente";
      }
    }
  }

  async salvarDocumentos() {
    const cedenteId = document.getElementById("documentos-cedente-id").value;
    const form = document.getElementById("form-documentos");
    const formData = new FormData(form);

    const documentosData = {};
    const campos = [
      "contrato_social",
      "cartao_cnpj",
      "faturamento_12meses",
      "dre_balanco",
      "cnh_rg_socios",
      "ir_socios",
      "comprovante_endereco",
      "email",
      "curva_abc",
      "dados_bancarios",
    ];

    campos.forEach((campo) => {
      documentosData[campo] = formData.get(campo) === "on";
    });

    try {
      const response = await fetch(`/api/cedentes/${cedenteId}/documentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(documentosData),
      });

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem("Documentos salvos com sucesso!", "success");

        // Atualiza o status na lista
        await this.atualizarStatusCedenteLista(
          cedenteId,
          resultado.documentos_completos
        );

        this.fecharModalDocumentos();
      } else {
        this.mostrarMensagem(
          "Erro ao salvar documentos: " + resultado.message,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro:", error);
      this.mostrarMensagem("Erro ao salvar documentos", "error");
    }
  }

  async atualizarStatusCedenteLista(cedenteId, documentosCompletos) {
    // Atualiza o status no array de cedentes
    const cedente = this.cedentes.find((c) => c.id == cedenteId);
    if (cedente) {
      cedente.documentos_completos = documentosCompletos;
    }

    // Encontra a linha do cedente na tabela e atualiza a classe do nome
    const linhas = document.querySelectorAll("#corpo-tabela tr");
    linhas.forEach((linha) => {
      const nomeCell = linha.querySelector("td:first-child");
      if (nomeCell) {
        const nomeSpan = nomeCell.querySelector(".cedente-nome");
        if (
          nomeSpan &&
          nomeSpan.textContent.includes(cedente?.nome_razao_social || "")
        ) {
          // Remove classes anteriores
          nomeSpan.classList.remove("com-documentos", "sem-documentos");

          // Adiciona classe conforme o status
          if (documentosCompletos) {
            nomeSpan.classList.add("com-documentos");
          } else {
            nomeSpan.classList.add("sem-documentos");
          }
        }
      }
    });
  }

  async adicionarCedente() {
    const nomeInput = document.getElementById("nome");
    const cpfCnpjInput = document.getElementById("cpf_cnpj");
    const contratoInput = document.getElementById("contrato");
    const validadeInput = document.getElementById("validade_contrato");

    if (!nomeInput || !cpfCnpjInput || !contratoInput) {
      this.mostrarMensagem("Erro: Campos não encontrados", "error");
      return;
    }

    const dados = {
      nome: nomeInput.value.trim(),
      cpf_cnpj: cpfCnpjInput.value.trim(),
      contrato: contratoInput.value.trim(),
      validade_contrato: validadeInput.value || null,
    };

    // Validação básica
    if (!dados.nome || !dados.cpf_cnpj || !dados.contrato) {
      this.mostrarMensagem("Preencha todos os campos!", "error");
      return;
    }

    // Validação de CPF/CNPJ básica
    if (!this.validarCpfCnpj(dados.cpf_cnpj)) {
      this.mostrarMensagem("CPF/CNPJ inválido!", "error");
      return;
    }

    try {
      const response = await fetch("/api/cedentes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem("Cedente adicionado com sucesso!", "success");
        document.getElementById("form-cedente").reset();

        // Recarregar a lista para garantir ordenação
        await this.carregarCedentes();
      } else {
        this.mostrarMensagem(
          "Erro ao adicionar cedente: " + resultado.message,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro:", error);
      this.mostrarMensagem(
        "Erro ao adicionar cedente. Verifique sua conexão.",
        "error"
      );
    }
  }

  validarCpfCnpj(cpfCnpj) {
    // Remove caracteres não numéricos
    const numeros = cpfCnpj.replace(/\D/g, "");

    // Verifica se tem entre 11 (CPF) e 14 (CNPJ) dígitos
    return numeros.length >= 11 && numeros.length <= 14;
  }

  abrirModalEditar(cedente) {
    const editId = document.getElementById("edit-id");
    const editNome = document.getElementById("edit-nome");
    const editCpfCnpj = document.getElementById("edit-cpf_cnpj");
    const editContrato = document.getElementById("edit-contrato");
    const editValidade = document.getElementById("edit-validade_contrato");
    const modal = document.getElementById("modal-editar");

    if (editId && editNome && editCpfCnpj && editContrato && modal) {
      editId.value = cedente.id;
      editNome.value = cedente.nome_razao_social || "";
      editCpfCnpj.value = cedente.cpf_cnpj || "";
      editContrato.value = cedente.contrato || "";
      editValidade.value = cedente.validade_contrato || "";
      modal.style.display = "block";

      // Foco no primeiro campo
      setTimeout(() => {
        editNome.focus();
      }, 100);
    }
  }

  fecharModal() {
    const modal = document.getElementById("modal-editar");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async atualizarCedente() {
    const editId = document.getElementById("edit-id");
    if (!editId) return;

    const id = editId.value;

    const dados = {
      nome: document.getElementById("edit-nome")?.value.trim() || "",
      cpf_cnpj: document.getElementById("edit-cpf_cnpj")?.value.trim() || "",
      contrato: document.getElementById("edit-contrato")?.value.trim() || "",
      validade_contrato:
        document.getElementById("edit-validade_contrato")?.value || null,
    };

    // Validação básica
    if (!dados.nome || !dados.cpf_cnpj || !dados.contrato) {
      this.mostrarMensagem("Preencha todos os campos!", "error");
      return;
    }

    try {
      const response = await fetch(`/api/cedentes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem("Cedente atualizado com sucesso!", "success");
        this.fecharModal();
        await this.carregarCedentes();
      } else {
        this.mostrarMensagem(
          "Erro ao atualizar cedente: " + resultado.message,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro:", error);
      this.mostrarMensagem(
        "Erro ao atualizar cedente. Tente novamente.",
        "error"
      );
    }
  }

  // NOVO MÉTODO: formatar data para exibição
  formatarData(data) {
    if (!data) return "-";

    try {
      const date = new Date(data + "T00:00:00"); // Garante fuso horário correto
      return date.toLocaleDateString("pt-BR");
    } catch (e) {
      return data;
    }
  }

  // NOVO MÉTODO: verificar status da validade
  getStatusValidade(data) {
    if (!data) return "sem-data";

    try {
      const hoje = new Date();
      const dataValidade = new Date(data + "T00:00:00");
      const diffTime = dataValidade - hoje;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return "vencido";
      if (diffDays <= 30) return "proximo";
      return "ok";
    } catch (e) {
      return "sem-data";
    }
  }

  // Nova função para abrir modal de exclusão
  abrirModalExclusao(id, nome) {
    this.cedenteParaExcluir = id;

    const modal = document.getElementById("modal-excluir");
    const titulo = document.getElementById("confirmacao-titulo");
    const descricao = document.getElementById("confirmacao-descricao");

    if (titulo && descricao) {
      titulo.innerHTML = `Tem certeza que deseja excluir <strong>"${nome}"</strong>?`;
      descricao.textContent =
        "Esta ação não pode ser desfeita. Todos os dados do cedente serão permanentemente removidos do sistema.";
    }

    modal.style.display = "block";
  }

  // Nova função para fechar modal de exclusão
  fecharModalExclusao() {
    const modal = document.getElementById("modal-excluir");
    if (modal) {
      modal.style.display = "none";
      this.cedenteParaExcluir = null;
    }
  }

  // Nova função para confirmar exclusão
  async confirmarExclusao() {
    if (!this.cedenteParaExcluir) return;

    try {
      const response = await fetch(`/api/cedentes/${this.cedenteParaExcluir}`, {
        method: "DELETE",
      });

      const resultado = await response.json();

      if (resultado.success) {
        this.mostrarMensagem("Cedente excluído com sucesso!", "success");
        this.fecharModalExclusao();
        await this.carregarCedentes();
      } else {
        this.mostrarMensagem(
          "Erro ao excluir cedente: " + resultado.message,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro:", error);
      this.mostrarMensagem(
        "Erro ao excluir cedente. Tente novamente.",
        "error"
      );
    }
  }

  async importarExcel() {
    const fileInput = document.getElementById("file-excel");
    if (!fileInput) return;

    const file = fileInput.files[0];

    if (!file) {
      this.mostrarMensagem("Selecione um arquivo Excel!", "error");
      return;
    }

    // Mostrar loading
    const resultDiv = document.getElementById("import-result");
    if (resultDiv) {
      resultDiv.innerHTML =
        '<div class="success-message"><i class="fas fa-spinner fa-spin"></i> Processando arquivo...</div>';
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/importar-excel", {
        method: "POST",
        body: formData,
      });

      const resultado = await response.json();

      if (resultado.success) {
        if (resultDiv) {
          resultDiv.innerHTML = `<div class="success-message">${resultado.message}</div>`;
        }
        await this.carregarCedentes();
      } else {
        if (resultDiv) {
          resultDiv.innerHTML = `<div class="error-message">${resultado.message}</div>`;
        }
      }

      // Limpa o arquivo após 5 segundos
      setTimeout(() => {
        if (resultDiv) {
          resultDiv.innerHTML = "";
        }
        fileInput.value = "";
      }, 5000);
    } catch (error) {
      console.error("Erro ao importar:", error);
      const resultDiv = document.getElementById("import-result");
      if (resultDiv) {
        resultDiv.innerHTML =
          '<div class="error-message">Erro ao importar arquivo. Verifique o formato.</div>';
      }
    }
  }

  async confirmarExclusaoTodos() {
    if (this.cedentes.length === 0) {
      this.mostrarMensagem("Não há cedentes para excluir.", "error");
      return;
    }

    // Criar modal de confirmação
    const modal = document.createElement("div");
    modal.className = "modal confirmation-modal";
    modal.style.display = "block";

    modal.innerHTML = `
      <div class="modal-content">
        <h2><i class="fas fa-exclamation-triangle" style="color: var(--error-500);"></i> Confirmar Exclusão</h2>
        <p>Tem certeza que deseja excluir <strong>TODOS</strong> os ${this.cedentes.length} cedentes?</p>
        <p style="color: var(--error-500); font-weight: bold;">Esta ação não pode ser desfeita!</p>
        <div class="confirmation-buttons">
          <button class="btn-confirm-yes" onclick="manager.excluirTodosCedentes()">
            <i class="fas fa-check"></i> Sim, Excluir Todos
          </button>
          <button class="btn-confirm-no" onclick="manager.fecharModalConfirmacao()">
            <i class="fas fa-times"></i> Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Fechar modal ao clicar fora
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.fecharModalConfirmacao();
      }
    });
  }

  fecharModalConfirmacao() {
    const modal = document.querySelector(".confirmation-modal");
    if (modal && modal.parentNode) {
      // Adicionar animação de fade out antes de remover
      modal.style.animation = "fadeOut 0.3s ease";
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 280);
    }
  }

  async excluirTodosCedentes() {
    try {
      // FECHAR O MODAL IMEDIATAMENTE AO CLICAR EM "EXCLUIR TODOS"
      this.fecharModalConfirmacao();

      // Mostrar mensagem de processamento
      this.mostrarMensagem("Excluindo cedentes...", "success");

      // Excluir um por um
      const promises = this.cedentes.map((cedente) =>
        fetch(`/api/cedentes/${cedente.id}`, {
          method: "DELETE",
        })
      );

      // Aguardar todas as exclusões
      const results = await Promise.allSettled(promises);

      // Verificar resultados
      const successfulDeletes = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failedDeletes = results.filter(
        (result) => result.status === "rejected"
      ).length;

      if (failedDeletes === 0) {
        this.mostrarMensagem(
          `Todos os ${successfulDeletes} cedentes foram excluídos com sucesso!`,
          "success"
        );
      } else {
        this.mostrarMensagem(
          `${successfulDeletes} cedentes excluídos, ${failedDeletes} falharam.`,
          "error"
        );
      }

      await this.carregarCedentes();
    } catch (error) {
      console.error("Erro:", error);
      this.mostrarMensagem(
        "Erro ao excluir cedentes. Tente novamente.",
        "error"
      );
    }
  }

  filtrarCedentes() {
    const searchInput = document.getElementById("search");
    const statusFilter = document.getElementById("status-filter");

    if (!searchInput || !statusFilter) return;

    const termoBusca = searchInput.value.toLowerCase();
    const filtroStatus = statusFilter.value;

    this.filteredCedentes = this.cedentes.filter((cedente) => {
      const matchBusca =
        cedente.nome_razao_social?.toLowerCase().includes(termoBusca) ||
        cedente.cpf_cnpj?.toLowerCase().includes(termoBusca);

      let matchStatus = true;
      if (filtroStatus) {
        matchStatus = cedente.contrato === filtroStatus;
      }

      return matchBusca && matchStatus;
    });

    // MANTER ORDENAÇÃO MESMO APÓS FILTRAGEM
    this.filteredCedentes.sort((a, b) => {
      const nomeA = (a.nome_razao_social || "").toLowerCase().trim();
      const nomeB = (b.nome_razao_social || "").toLowerCase().trim();
      return nomeA.localeCompare(nomeB);
    });

    this.currentPage = 1;
    this.renderizarTabela();
  }

  renderizarTabela() {
    const corpoTabela = document.getElementById("corpo-tabela");
    const totalCedentes = document.getElementById("total-cedentes-filtro");

    // Calcular e mostrar estatísticas do dashboard
    this.calcularEstatisticas();

    if (!corpoTabela) return;

    // Calcular paginação
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const cedentesPagina = this.filteredCedentes.slice(startIndex, endIndex);
    const totalPages = Math.ceil(
      this.filteredCedentes.length / this.itemsPerPage
    );

    corpoTabela.innerHTML = "";

    if (cedentesPagina.length === 0) {
      corpoTabela.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Nenhum cedente encontrado</h3>
            <p>Tente ajustar os filtros ou adicionar um novo cedente</p>
          </td>
        </tr>
      `;
    } else {
      cedentesPagina.forEach((cedente) => {
        const tr = document.createElement("tr");

        // Mapear valores para textos exibidos
        const statusMap = {
          pontos_atencao: "Pontos de Atenção",
          assinado_manual: "Contrato assinado manualmente",
          sem_assinatura:
            "Contrato sem assinatura manual e digital - Não entrei em contato",
          precisa_renovar:
            "Contrato precisa ser renovado - Assinado manualmente - Não entrei em contato",
          faltam_assinar: "Contratos impressos que faltam assinar",
          avisados_renovacao: "Cedentes que já foram avisados da renovação",
          levou_contrato: "Levou o contrato para assinar",
        };

        const statusValue = cedente.contrato || "";
        const statusText = statusMap[statusValue] || statusValue;
        const statusClass = `status-${statusValue}`;

        tr.innerHTML = `
          <td>
            <span class="cedente-nome ${
              cedente.documentos_completos ? "com-documentos" : "sem-documentos"
            }" 
                  onclick="manager.abrirModalDocumentos(${JSON.stringify(
                    cedente
                  ).replace(/"/g, "&quot;")})">
              ${cedente.nome_razao_social || ""}
            </span>
          </td>
          <td><span class="badge-cpf-cnpj">${cedente.cpf_cnpj || ""}</span></td>
          <td><span class="${statusClass}">${statusText}</span></td>
          <td>
            <span class="data-validade ${this.getStatusValidade(
              cedente.validade_contrato
            )}">
                ${this.formatarData(cedente.validade_contrato)}
            </span>
          </td>
          <td class="actions-cell">
            <button class="btn-secondary" onclick="manager.abrirModalEditar(${JSON.stringify(
              cedente
            ).replace(/"/g, "&quot;")})">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn-danger" onclick="manager.abrirModalExclusao(${
              cedente.id
            }, '${(cedente.nome_razao_social || "").replace(/'/g, "\\'")}')">
                <i class="fas fa-trash"></i> Excluir
            </button>
          </td>
        `;

        corpoTabela.appendChild(tr);
      });
    }

    // Atualizar informações totais
    if (totalCedentes) {
      totalCedentes.textContent = `${this.filteredCedentes.length} cedente(s) encontrado(s)`;
    }

    // Renderizar controles de paginação
    this.renderizarPaginacao(totalPages);
  }

  renderizarPaginacao(totalPages) {
    const paginationContainer = document.getElementById("pagination-controls");
    if (!paginationContainer) {
      console.error("Elemento de paginação não encontrado");
      return;
    }

    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(
      this.currentPage * this.itemsPerPage,
      this.filteredCedentes.length
    );

    // Limpar controles anteriores
    paginationContainer.innerHTML = "";

    // Informação da página
    const paginationInfo = document.createElement("div");
    paginationInfo.className = "pagination-info";
    paginationInfo.textContent = `Mostrando ${startItem}-${endItem} de ${this.filteredCedentes.length}`;
    paginationContainer.appendChild(paginationInfo);

    // Controles de paginação
    const paginationButtons = document.createElement("div");
    paginationButtons.className = "pagination-controls";

    // Botão Anterior
    const prevButton = document.createElement("button");
    prevButton.className = "pagination-btn";
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> Anterior';
    prevButton.disabled = this.currentPage === 1;
    prevButton.onclick = () => this.mudarPagina(this.currentPage - 1);
    paginationButtons.appendChild(prevButton);

    // Informação da página atual
    const pageInfo = document.createElement("span");
    pageInfo.className = "pagination-page-info";
    pageInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
    paginationButtons.appendChild(pageInfo);

    // Botão Próximo
    const nextButton = document.createElement("button");
    nextButton.className = "pagination-btn";
    nextButton.innerHTML = 'Próximo <i class="fas fa-chevron-right"></i>';
    nextButton.disabled = this.currentPage === totalPages || totalPages === 0;
    nextButton.onclick = () => this.mudarPagina(this.currentPage + 1);
    paginationButtons.appendChild(nextButton);

    paginationContainer.appendChild(paginationButtons);
  }

  mudarPagina(page) {
    if (
      page >= 1 &&
      page <= Math.ceil(this.filteredCedentes.length / this.itemsPerPage)
    ) {
      this.currentPage = page;
      this.renderizarTabela();

      // Scroll suave para o topo da tabela
      const tableContainer = document.querySelector(".table-container");
      if (tableContainer) {
        tableContainer.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }

  mostrarMensagem(mensagem, tipo) {
    // Remove mensagens existentes
    const mensagensExistentes = document.querySelectorAll(".custom-message");
    mensagensExistentes.forEach((msg) => msg.remove());

    const div = document.createElement("div");
    div.className = `custom-message ${
      tipo === "success" ? "success-message" : "error-message"
    }`;
    div.style.position = "fixed";
    div.style.top = "25px";
    div.style.right = "25px";
    div.style.zIndex = "10000";
    div.style.padding = "16px 20px";
    div.style.borderRadius = "10px";
    div.style.boxShadow = "var(--shadow-lg)";
    div.style.maxWidth = "400px";
    div.style.fontWeight = "500";
    div.style.animation = "slideIn 0.3s ease";
    div.textContent = mensagem;

    document.body.appendChild(div);

    // Remove após 4 segundos
    setTimeout(() => {
      if (div.parentNode) {
        div.style.animation = "slideOut 0.3s ease";
        setTimeout(() => {
          if (div.parentNode) {
            document.body.removeChild(div);
          }
        }, 280);
      }
    }, 4000);
  }
}

// Adicionar estilos de animação para as mensagens
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", () => {
  window.manager = new CedentesManager();
});