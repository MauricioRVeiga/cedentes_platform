document.addEventListener("DOMContentLoaded", () => {
  // Função para atualizar a tabela de cedentes
  const atualizarTabelaCedentes = (cedentes) => {
    const tbody = document.querySelector('#tabelaCedentes tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    cedentes.forEach(cedente => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cedente.nome_razao_social}</td>
        <td>${formatCpfCnpj(cedente.cpf_cnpj)}</td>
        <td><span class="badge ${getStatusClass(cedente.status)}">${cedente.status}</span></td>
        <td>${new Date(cedente.data_validade).toLocaleDateString()}</td>
        <td>
          <button onclick="verDetalhes(${cedente.id})" class="btn btn-sm btn-primary">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button onclick="confirmarExclusao(${cedente.id}, '${cedente.nome_razao_social}')" class="btn btn-sm btn-danger">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
  // Carregar lista de cedentes inicialmente
  carregarCedentes();
  const carregarCedentes = async () => {
    try {
      const response = await fetch("/dashboard/cedentes");
      const cedentes = await response.json();
      atualizarTabelaCedentes(cedentes);
    } catch (error) {
      console.error("Erro ao carregar cedentes:", error);
    }
  };

  // Inicializar formulário de novo cedente
  const formNovoCedente = document.getElementById("novoCedenteForm");
  if (formNovoCedente) {
    formNovoCedente.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(formNovoCedente);
      try {
        const response = await fetch(formNovoCedente.action, {
          method: "POST",
          body: formData,
        });
        if (response.ok) {
          location.reload();
        } else {
          alert("Erro ao criar cedente");
        }
      } catch (error) {
        console.error("Erro ao criar cedente:", error);
        alert("Erro ao criar cedente");
      }
    });
  }

  // Inicializar formulário de importação
  const formImport = document.getElementById("importForm");
  if (formImport) {
    formImport.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(formImport);
      try {
        const response = await fetch(formImport.action, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (response.ok) {
          // Mostrar mensagem de sucesso com os detalhes do processamento
          const message = `
            Planilha processada com sucesso!\n
            Total de registros: ${data.total}\n
            Registros processados: ${data.processados}\n
            Registros ignorados: ${data.ignorados}
          `;
          alert(message);
          
          // Atualizar a lista de cedentes sem recarregar a página
          await carregarCedentes();
          
          // Limpar o campo de arquivo
          formImport.reset();
        } else {
          alert(data.error || "Erro ao importar arquivo");
        }
      } catch (error) {
        console.error("Erro na importação:", error);
        alert("Erro ao importar arquivo");
      }
    });
  }
});

// Função para visualizar detalhes do cedente
async function verDetalhes(id) {
  try {
    const response = await fetch(`/dashboard/cedentes/${id}`);
    if (!response.ok) throw new Error("Erro ao carregar dados do cedente");

    const cedente = await response.json();

    // Preencher formulário de edição
    document.getElementById("editar_id").value = cedente.id;
    document.getElementById("editar_nome_razao_social").value =
      cedente.nome_razao_social;
    document.getElementById("editar_cpf_cnpj").value = cedente.cpf_cnpj;
    document.getElementById("editar_data_validade").value =
      cedente.data_validade ? cedente.data_validade.split("T")[0] : "";
    document.getElementById("editar_status").value = cedente.status;

    // Abrir modal de edição
    const modal = new bootstrap.Modal(document.getElementById("editarModal"));
    modal.show();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao carregar dados do cedente");
  }
}

// Função para salvar edição
async function salvarEdicao() {
  try {
    const id = document.getElementById("editar_id").value;
    const data = {
      nome_razao_social: document.getElementById("editar_nome_razao_social")
        .value,
      cpf_cnpj: document.getElementById("editar_cpf_cnpj").value,
      data_validade: document.getElementById("editar_data_validade").value,
      status: document.getElementById("editar_status").value,
    };

    const response = await fetch(`/dashboard/cedentes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Erro ao salvar alterações");

    bootstrap.Modal.getInstance(document.getElementById("editarModal")).hide();
    location.reload();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao salvar alterações");
  }
}

// Função para confirmar exclusão
function confirmarExclusao(id, nome) {
  document.getElementById(
    "mensagemConfirmacao"
  ).textContent = `Tem certeza que deseja excluir o cedente "${nome}"?`;

  const modal = new bootstrap.Modal(
    document.getElementById("confirmacaoModal")
  );
  document.getElementById("btnConfirmarExclusao").onclick = () =>
    excluirCedente(id);
  modal.show();
}

// Função para excluir cedente
async function excluirCedente(id) {
  try {
    const response = await fetch(`/dashboard/cedentes/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Erro ao excluir cedente");

    bootstrap.Modal.getInstance(
      document.getElementById("confirmacaoModal")
    ).hide();
    location.reload();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao excluir cedente");
  }
}

// Função para confirmar exclusão de todos
function confirmarExclusaoTodos() {
  document.getElementById("mensagemConfirmacao").textContent =
    "Tem certeza que deseja excluir TODOS os cedentes? Esta ação não pode ser desfeita.";

  const modal = new bootstrap.Modal(
    document.getElementById("confirmacaoModal")
  );
  document.getElementById("btnConfirmarExclusao").onclick =
    excluirTodosCedentes;
  modal.show();
}

// Função para excluir todos os cedentes
async function excluirTodosCedentes() {
  try {
    const response = await fetch("/dashboard/cedentes", {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Erro ao excluir todos os cedentes");

    bootstrap.Modal.getInstance(
      document.getElementById("confirmacaoModal")
    ).hide();
    location.reload();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao excluir todos os cedentes");
  }
}

// Função para mostrar modal de documentos
document.addEventListener("DOMContentLoaded", () => {
  const documentosModal = document.getElementById("documentosModal");
  const checkDadosBancarios = document.getElementById("check_dados_bancarios");
  const dadosBancariosDetalhes = document.getElementById(
    "dados_bancarios_detalhes"
  );

  if (documentosModal) {
    documentosModal.addEventListener("show.bs.modal", (event) => {
      const button = event.relatedTarget;
      const cedenteName = button.dataset.cedente;
      document.getElementById("cedenteName").textContent = cedenteName;
    });
  }

  if (checkDadosBancarios && dadosBancariosDetalhes) {
    checkDadosBancarios.addEventListener("change", function () {
      dadosBancariosDetalhes.style.display = this.checked ? "block" : "none";
    });
  }
});

// Função utilitária para pegar cores dos status
function getStatusClass(status) {
  const statusClasses = {
    "CONTRATO ASSINADO MANUALMENTE": "bg-success",
    "CONTRATO SEM ASSINATURA MANUAL E DIGITAL": "bg-danger",
    "CONTRATO PRECISA SER RENOVADO": "bg-danger",
    "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR": "bg-warning",
    "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO": "bg-info",
    "LEVOU O CONTRATO PARA ASSINAR": "bg-primary",
  };
  return statusClasses[status] || "bg-secondary";
}

// Função para formatar CPF/CNPJ
function formatCpfCnpj(cpfCnpj) {
  const cleaned = cpfCnpj.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else {
    return cleaned.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }
}

// Inicializar máscaras e validações para formulários
document.addEventListener("DOMContentLoaded", () => {
  // Máscara CPF/CNPJ
  const cpfCnpjInputs = document.querySelectorAll('input[name="cpf_cnpj"]');
  cpfCnpjInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else {
        value = value.replace(
          /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
          "$1.$2.$3/$4-$5"
        );
      }
      e.target.value = value;
    });
  });
});
