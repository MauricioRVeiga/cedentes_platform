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

// Função para pegar a classe do status
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

// Função para atualizar a tabela de cedentes
function atualizarTabelaCedentes(cedentes) {
  const tbody = document.querySelector("#tabelaCedentes tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!cedentes || cedentes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">Nenhum cedente cadastrado</td>
      </tr>
    `;
    return;
  }

  cedentes.forEach((cedente) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <a href="#" 
           class="text-decoration-none"
           data-bs-toggle="modal"
           data-bs-target="#documentosModal"
           data-cedente="${cedente.nome_razao_social}">
          ${cedente.nome_razao_social}
        </a>
      </td>
      <td>${formatCpfCnpj(cedente.cpf_cnpj)}</td>
      <td><span class="badge ${getStatusClass(cedente.status)}">${
      cedente.status || ""
    }</span></td>
      <td>
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="verDetalhes(${
          cedente.id
        })">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="confirmarExclusao(${
          cedente.id
        }, '${cedente.nome_razao_social}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Função para carregar a lista de cedentes
async function carregarCedentes() {
  try {
    const response = await fetch("/api/cedentes/listar");
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    const cedentes = await response.json();
    atualizarTabelaCedentes(cedentes);
  } catch (error) {
    console.error("Erro ao carregar cedentes:", error);
    const tbody = document.querySelector("#tabelaCedentes tbody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger">
            Erro ao carregar cedentes. Por favor, tente novamente.
          </td>
        </tr>
      `;
    }
  }
}

// Função para visualizar detalhes do cedente
async function verDetalhes(id) {
  try {
    const response = await fetch(`/api/cedentes/${id}`);
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

    const response = await fetch(`/api/cedentes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Erro ao salvar alterações");

    bootstrap.Modal.getInstance(document.getElementById("editarModal")).hide();
    await carregarCedentes(); // Recarrega a lista em vez de recarregar a página
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao salvar alterações");
  }
}

// Inicialização da página
document.addEventListener("DOMContentLoaded", () => {
  // Carregar lista inicial de cedentes
  carregarCedentes();

  // Máscaras para campos CPF/CNPJ
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

  // Inicializar formulário de novo cedente
  const formNovoCedente = document.getElementById("novoCedenteForm");
  if (formNovoCedente) {
    formNovoCedente.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(formNovoCedente);
      const data = Object.fromEntries(formData);

      try {
        const response = await fetch(formNovoCedente.action, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          formNovoCedente.reset();
          await carregarCedentes(); // Recarrega a lista em vez de recarregar a página
          bootstrap.Modal.getInstance(
            document.getElementById("novoCedenteModal")
          ).hide();
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
    formImport.onsubmit = function() {
      // Mostrar indicador de carregamento antes do submit
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'position-fixed top-50 start-50 translate-middle bg-white p-4 rounded shadow-lg';
      loadingDiv.style.zIndex = '9999';
      loadingDiv.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p class="mb-0">Processando planilha, aguarde...</p>
        </div>
      `;
      document.body.appendChild(loadingDiv);
      
      // Permitir o envio normal do formulário (não previne o comportamento padrão)
      return true;
    };
        if (response.ok) {
          // Criar notificação do Bootstrap Toast
          const toastContainer = document.createElement("div");
          toastContainer.innerHTML = `
            <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 11">
              <div class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                  <div class="toast-body">
                    <strong>Importação concluída!</strong><br>
                    Total: ${data.total} registros<br>
                    Processados: ${data.processados}<br>
                    Ignorados: ${data.ignorados}
                  </div>
                  <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(toastContainer);
          const toastEl = toastContainer.querySelector(".toast");
          const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
          toast.show();

          // Atualizar a lista com os cedentes retornados
          if (data.cedentes) {
            atualizarTabelaCedentes(data.cedentes);
          } else {
            // Fallback para recarregar a lista caso não receba os cedentes
            await carregarCedentes();
          }

          // Limpar o campo de arquivo e fechar o modal
          formImport.reset();
          bootstrap.Modal.getInstance(
            document.getElementById("importModal")
          ).hide();
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
