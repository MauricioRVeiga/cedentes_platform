// =============================================
// FUNÇÕES PRINCIPAIS - GESTÃO DE CEDENTES
// =============================================

// Função para atualizar a tabela de cedentes
function atualizarTabelaCedentes(cedentes) {
  const tbody = document.querySelector("#tabelaCedentes tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!cedentes || cedentes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          <i class="fas fa-users-slash fa-2x mb-3"></i>
          <p class="mb-0">Nenhum cedente cadastrado</p>
        </td>
      </tr>
    `;
    return;
  }

  cedentes.forEach((cedente) => {
    const row = document.createElement("tr");
    const isVencido = new Date(cedente.data_validade) < new Date();
    const rowClass = isVencido ? 'table-danger' : '';
    
    row.innerHTML = `
      <td class="${rowClass}">
        <a href="#" 
           class="text-decoration-none fw-bold link-documentos"
           data-cedente-id="${cedente.id}"
           data-cedente-nome="${cedente.nome_razao_social}">
          ${cedente.nome_razao_social}
          ${isVencido ? '<i class="fas fa-exclamation-triangle text-danger ms-1" title="Contrato Vencido"></i>' : ''}
        </a>
      </td>
      <td class="${rowClass}">${formatCpfCnpj(cedente.cpf_cnpj)}</td>
      <td class="${rowClass}">
        <span class="badge ${getStatusClass(cedente.status)}">
          ${cedente.status || "N/A"}
        </span>
      </td>
      <td class="${rowClass}">
        ${formatDate(cedente.data_validade)}
        ${isVencido ? '<br><small class="text-danger">Vencido</small>' : ''}
      </td>
      <td class="${rowClass}">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="verDetalhes(${cedente.id})" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="confirmarExclusao(${cedente.id}, '${cedente.nome_razao_social.replace(/'/g, "\\'")}')" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  adicionarEventListenersDocumentos();
}

// Função para adicionar event listeners aos links de documentos
function adicionarEventListenersDocumentos() {
  const linksDocumentos = document.querySelectorAll('.link-documentos');
  linksDocumentos.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const cedenteId = this.getAttribute('data-cedente-id');
      const cedenteNome = this.getAttribute('data-cedente-nome');
      abrirModalDocumentos(cedenteId, cedenteNome);
    });
  });
}

// Função para abrir modal de documentos
function abrirModalDocumentos(cedenteId, cedenteNome) {
  document.getElementById('documentosCedenteId').value = cedenteId;
  document.getElementById('documentosCedenteNome').textContent = cedenteNome;
  
  // Resetar checkboxes
  const checkboxes = document.querySelectorAll('.documento-check');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Carregar documentos salvos
  carregarDocumentos(cedenteId);
  
  const modal = new bootstrap.Modal(document.getElementById('documentosModal'));
  modal.show();
}

// Função para atualizar contadores de documentos
function atualizarContadoresDocumentos() {
  const totalCheckboxes = document.querySelectorAll('.documento-check').length;
  const checkedCheckboxes = document.querySelectorAll('.documento-check:checked').length;
  const pendentes = totalCheckboxes - checkedCheckboxes;
  
  document.getElementById('totalDocumentos').textContent = totalCheckboxes;
  document.getElementById('documentosConcluidos').textContent = checkedCheckboxes;
  document.getElementById('documentosPendentes').textContent = pendentes;
  
  // Atualizar barra de progresso
  const progresso = document.getElementById('progressoDocumentos');
  const porcentagem = (checkedCheckboxes / totalCheckboxes) * 100;
  progresso.style.width = `${porcentagem}%`;
  
  const statusElement = document.getElementById('statusDocumentos');
  if (checkedCheckboxes === totalCheckboxes) {
    statusElement.className = 'badge bg-success fs-6';
    statusElement.innerHTML = '<i class="fas fa-check-circle me-1"></i>Todos os documentos conferidos';
  } else if (checkedCheckboxes === 0) {
    statusElement.className = 'badge bg-danger fs-6';
    statusElement.innerHTML = '<i class="fas fa-times-circle me-1"></i>Nenhum documento conferido';
  } else {
    statusElement.className = 'badge bg-warning text-dark fs-6';
    statusElement.innerHTML = `<i class="fas fa-clock me-1"></i>${checkedCheckboxes}/${totalCheckboxes} documentos`;
  }
}

// Função para salvar documentos
async function salvarDocumentos() {
  const btnSalvar = document.getElementById('btnSalvarDocumentos');
  const btnTextoOriginal = btnSalvar.innerHTML;
  const cedenteId = document.getElementById('documentosCedenteId').value;
  
  try {
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnSalvar.disabled = true;

    const documentos = {};
    const checkboxes = document.querySelectorAll('.documento-check');
    
    checkboxes.forEach(checkbox => {
      documentos[checkbox.name] = checkbox.checked;
    });

    const response = await fetch(`/api/cedentes/${cedenteId}/documentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentos })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao salvar documentos');
    }

    bootstrap.Modal.getInstance(document.getElementById('documentosModal')).hide();
    mostrarToast('Documentos salvos com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao salvar documentos:', error);
    mostrarToast(error.message, 'error');
  } finally {
    btnSalvar.innerHTML = btnTextoOriginal;
    btnSalvar.disabled = false;
  }
}

// Função para carregar documentos salvos
async function carregarDocumentos(cedenteId) {
  try {
    const response = await fetch(`/api/cedentes/${cedenteId}/documentos`);
    if (response.ok) {
      const data = await response.json();
      
      if (data.documentos) {
        Object.keys(data.documentos).forEach(key => {
          const checkbox = document.querySelector(`[name="${key}"]`);
          if (checkbox) {
            checkbox.checked = data.documentos[key] === true;
          }
        });
        atualizarContadoresDocumentos();
      }
    }
  } catch (error) {
    console.error('Erro ao carregar documentos:', error);
  }
}

// Função para carregar a lista de cedentes
async function carregarCedentes() {
  const tabelaLoading = document.getElementById('tabela-loading');
  const tabela = document.getElementById('tabelaCedentes');
  
  try {
    if (tabelaLoading) tabelaLoading.style.display = 'block';
    if (tabela) tabela.style.display = 'none';

    const response = await fetch("/api/cedentes/listar");
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    const data = await response.json();
    atualizarTabelaCedentes(data.cedentes);
    atualizarEstatisticas(data.total);
    
  } catch (error) {
    console.error("Erro ao carregar cedentes:", error);
    mostrarToast("Erro ao carregar lista de cedentes", "error");
  } finally {
    if (tabelaLoading) tabelaLoading.style.display = 'none';
    if (tabela) tabela.style.display = 'table';
  }
}

// Função para atualizar estatísticas
function atualizarEstatisticas(total) {
  const elementoTotal = document.getElementById('total-cedentes-filtro');
  if (elementoTotal) {
    elementoTotal.textContent = `${total} cedente${total !== 1 ? 's' : ''}`;
  }
}

// Função para visualizar detalhes do cedente
async function verDetalhes(id) {
  try {
    const response = await fetch(`/api/cedentes/${id}`);
    if (!response.ok) throw new Error("Erro ao carregar dados do cedente");

    const cedente = await response.json();

    document.getElementById("editarId").value = cedente.id;
    document.getElementById("editarNomeRazaoSocial").value = cedente.nome_razao_social;
    document.getElementById("editarCpfCnpj").value = cedente.cpf_cnpj;
    document.getElementById("editarDataValidade").value = cedente.data_validade ? cedente.data_validade.split("T")[0] : "";
    document.getElementById("editarStatus").value = cedente.status;
    document.getElementById("editarObservacoes").value = cedente.observacoes || "";

    const modal = new bootstrap.Modal(document.getElementById("editarModal"));
    modal.show();
  } catch (error) {
    console.error("Erro:", error);
    mostrarToast("Erro ao carregar dados do cedente", "error");
  }
}

// Função para salvar edição
async function salvarEdicao() {
  const btnSalvar = document.getElementById('btnSalvarEdicao');
  const btnTextoOriginal = btnSalvar.innerHTML;
  const form = document.getElementById('editarForm');
  
  try {
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnSalvar.disabled = true;

    const id = document.getElementById("editarId").value;
    const data = {
      nome_razao_social: document.getElementById("editarNomeRazaoSocial").value,
      cpf_cnpj: document.getElementById("editarCpfCnpj").value,
      data_validade: document.getElementById("editarDataValidade").value,
      status: document.getElementById("editarStatus").value,
      observacoes: document.getElementById("editarObservacoes").value
    };

    // Validar formulário
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      throw new Error("Por favor, preencha todos os campos obrigatórios corretamente.");
    }

    const response = await fetch(`/api/cedentes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMessage = result.details || result.error || "Erro ao salvar alterações";
      throw new Error(errorMessage);
    }

    bootstrap.Modal.getInstance(document.getElementById("editarModal")).hide();
    await carregarCedentes();
    mostrarToast("Cedente atualizado com sucesso!", "success");
    
  } catch (error) {
    console.error("Erro:", error);
    mostrarToast(error.message, "error");
  } finally {
    btnSalvar.innerHTML = btnTextoOriginal;
    btnSalvar.disabled = false;
  }
}

// Função para confirmar exclusão
function confirmarExclusao(id, nome) {
  const modal = new bootstrap.Modal(document.getElementById("confirmacaoModal"));
  
  document.getElementById("confirmacaoTitulo").textContent = "Confirmar Exclusão";
  document.getElementById("confirmacaoMensagem").textContent = `Tem certeza que deseja excluir o cedente "${nome}"? Esta ação não pode ser desfeita.`;
  
  document.getElementById("btnConfirmarAcao").onclick = () => excluirCedente(id);
  document.getElementById("btnConfirmarAcao").className = "btn btn-danger";
  document.getElementById("btnConfirmarAcao").innerHTML = '<i class="fas fa-trash"></i> Excluir';
  
  modal.show();
}

// Função para excluir cedente
async function excluirCedente(id) {
  try {
    const response = await fetch(`/api/cedentes/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Erro ao excluir cedente");

    bootstrap.Modal.getInstance(document.getElementById("confirmacaoModal")).hide();
    await carregarCedentes();
    mostrarToast("Cedente excluído com sucesso!", "success");
  } catch (error) {
    console.error("Erro:", error);
    mostrarToast("Erro ao excluir cedente", "error");
  }
}

// Função para confirmar exclusão de todos
function confirmarExclusaoTodos() {
  const modal = new bootstrap.Modal(document.getElementById("confirmacaoModal"));
  
  document.getElementById("confirmacaoTitulo").textContent = "Excluir Todos os Cedentes";
  document.getElementById("confirmacaoMensagem").textContent = "Tem certeza que deseja excluir TODOS os cedentes? Esta ação não pode ser desfeita e removerá todos os dados do sistema.";
  
  document.getElementById("btnConfirmarAcao").onclick = excluirTodosCedentes;
  document.getElementById("btnConfirmarAcao").className = "btn btn-danger";
  document.getElementById("btnConfirmarAcao").innerHTML = '<i class="fas fa-trash"></i> Excluir Todos';
  
  modal.show();
}

// Função para excluir todos os cedentes
async function excluirTodosCedentes() {
  try {
    const response = await fetch("/api/cedentes", {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Erro ao excluir todos os cedentes");

    bootstrap.Modal.getInstance(document.getElementById("confirmacaoModal")).hide();
    await carregarCedentes();
    mostrarToast("Todos os cedentes foram excluídos com sucesso!", "success");
  } catch (error) {
    console.error("Erro:", error);
    mostrarToast("Erro ao excluir todos os cedentes", "error");
  }
}

// Função para exportar Excel
async function exportarExcel() {
  try {
    const response = await fetch("/api/cedentes/exportar/excel");
    if (!response.ok) throw new Error("Erro ao exportar dados");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `cedentes_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    mostrarToast("Exportação concluída com sucesso!", "success");
  } catch (error) {
    console.error("Erro na exportação:", error);
    mostrarToast("Erro ao exportar dados", "error");
  }
}

// Função para carregar cedentes com filtros
async function carregarCedentesComFiltro(searchTerm = '') {
  try {
    const statusFilter = document.getElementById("status-filter");
    const status = statusFilter ? statusFilter.value : '';
    
    let url = `/api/cedentes/listar?`;
    const params = new URLSearchParams();
    
    if (searchTerm) params.append('search', searchTerm);
    if (status) params.append('status', status);
    
    const response = await fetch(url + params.toString());
    if (!response.ok) throw new Error("Erro ao filtrar cedentes");
    
    const data = await response.json();
    atualizarTabelaCedentes(data.cedentes);
    atualizarEstatisticas(data.total);
  } catch (error) {
    console.error("Erro ao filtrar cedentes:", error);
    mostrarToast("Erro ao aplicar filtros", "error");
  }
}

// =============================================
// INICIALIZAÇÃO DA PÁGINA
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Inicializando página de cedentes...");
  
  carregarCedentes();
  configurarEventos();

  // Configurar máscaras para CPF/CNPJ
  const configurarMascaraCPFCNPJ = (input) => {
    input.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else {
        value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      }
      e.target.value = value;
    });
  };

  document.querySelectorAll('input[name="cpf_cnpj"]').forEach(configurarMascaraCPFCNPJ);
});

function configurarEventos() {
  // Inicializar formulário de novo cedente
  const formNovoCedente = document.getElementById("novoCedenteForm");
  if (formNovoCedente) {
    formNovoCedente.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const btnSubmit = formNovoCedente.querySelector('button[type="submit"]');
      const btnTextoOriginal = btnSubmit.innerHTML;
      
      try {
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btnSubmit.disabled = true;

        const formData = new FormData(formNovoCedente);
        const data = Object.fromEntries(formData);

        // Validar formulário
        if (!formNovoCedente.checkValidity()) {
          formNovoCedente.classList.add('was-validated');
          throw new Error("Por favor, preencha todos os campos obrigatórios corretamente.");
        }

        const response = await fetch("/api/cedentes/novo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();
        
        if (response.ok) {
          formNovoCedente.reset();
          formNovoCedente.classList.remove('was-validated');
          await carregarCedentes();
          bootstrap.Modal.getInstance(document.getElementById("novoCedenteModal")).hide();
          mostrarToast("Cedente cadastrado com sucesso!", "success");
        } else {
          throw new Error(result.error || "Erro ao criar cedente");
        }
      } catch (error) {
        console.error("Erro ao criar cedente:", error);
        mostrarToast(error.message, "error");
      } finally {
        btnSubmit.innerHTML = btnTextoOriginal;
        btnSubmit.disabled = false;
      }
    });
  }

  // Inicializar formulário de importação
  const formImport = document.getElementById("importForm");
  if (formImport) {
    formImport.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const btnSubmit = formImport.querySelector('button[type="submit"]');
      const btnTextoOriginal = btnSubmit.innerHTML;
      
      const fileInput = formImport.querySelector('input[type="file"]');
      
      if (!fileInput) {
        mostrarToast("Erro: Campo de arquivo não configurado", "error");
        return;
      }
      
      if (!fileInput.files || fileInput.files.length === 0) {
        mostrarToast("Selecione um arquivo para importar", "warning");
        return;
      }

      const loadingDiv = mostrarLoading("Processando planilha, aguarde...");
      
      try {
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';
        btnSubmit.disabled = true;

        const formData = new FormData(formImport);
        
        const response = await fetch("/api/cedentes/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        
        if (response.ok) {
          let mensagem = `Planilha processada com sucesso!<br>`;
          mensagem += `Total de registros: ${data.total}<br>`;
          mensagem += `Novos cedentes: ${data.processados}<br>`;
          mensagem += `Cedentes atualizados: ${data.atualizados}<br>`;
          mensagem += `Registros ignorados: ${data.ignorados}`;
          
          if (data.errors && data.errors.length > 0) {
            mensagem += `<br><small class="text-warning">${data.errors.length} erro(s) encontrado(s)</small>`;
            console.warn("⚠️ Erros na importação:", data.errors);
          }

          mostrarToast(mensagem, "success");

          // Atualizar a tabela
          if (data.cedentes) {
            atualizarTabelaCedentes(data.cedentes);
          } else {
            await carregarCedentes();
          }

          formImport.reset();
          bootstrap.Modal.getInstance(document.getElementById("importModal")).hide();
        } else {
          console.error("❌ Erro na resposta:", data);
          throw new Error(data.error || "Erro ao importar arquivo");
        }
      } catch (error) {
        console.error("💥 Erro na importação:", error);
        mostrarToast(error.message, "error");
      } finally {
        esconderLoading(loadingDiv);
        btnSubmit.innerHTML = btnTextoOriginal;
        btnSubmit.disabled = false;
      }
    });
  }

  // Event listener para salvar documentos
  const btnSalvarDocumentos = document.getElementById('btnSalvarDocumentos');
  if (btnSalvarDocumentos) {
    btnSalvarDocumentos.addEventListener('click', salvarDocumentos);
  }

  // Event listener para atualizar contadores quando checkboxes mudam
  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('documento-check')) {
      atualizarContadoresDocumentos();
    }
  });

  // Carregar documentos quando modal abrir
  const documentosModal = document.getElementById('documentosModal');
  if (documentosModal) {
    documentosModal.addEventListener('show.bs.modal', function() {
      const cedenteId = document.getElementById('documentosCedenteId').value;
      carregarDocumentos(cedenteId);
    });
  }

  // Configurar busca em tempo real
  const searchInput = document.getElementById("search");
  if (searchInput) {
    const buscaDebounce = debounce(async (termo) => {
      await carregarCedentesComFiltro(termo);
    }, 500);

    searchInput.addEventListener("input", (e) => {
      buscaDebounce(e.target.value);
    });
  }

  // Configurar filtro de status
  const statusFilter = document.getElementById("status-filter");
  if (statusFilter) {
    statusFilter.addEventListener("change", async (e) => {
      await carregarCedentesComFiltro();
    });
  }

  // Configurar formulário de edição
  const formEditar = document.getElementById('editarForm');
  if (formEditar) {
    formEditar.addEventListener('submit', function(e) {
      e.preventDefault();
      salvarEdicao();
    });
  }
}

// Função para marcar/desmarcar todos os documentos
function marcarTodosDocumentos() {
  const checkboxes = document.querySelectorAll('#documentosModal .documento-check');
  const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
  });
  
  atualizarContadoresDocumentos();
}

// Função para abrir modal de novo cedente
function abrirModalNovoCedente() {
  const modal = new bootstrap.Modal(document.getElementById('novoCedenteModal'));
  modal.show();
}

// Função para abrir modal de importação
function abrirModalImportacao() {
  const modal = new bootstrap.Modal(document.getElementById('importModal'));
  modal.show();
}

// Função para limpar filtros
function limparFiltros() {
  const searchInput = document.getElementById('search');
  const statusFilter = document.getElementById('status-filter');
  
  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = '';
  
  carregarCedentes();
}