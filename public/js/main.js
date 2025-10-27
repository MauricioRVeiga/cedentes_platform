document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#upload-form");
  const table = document.querySelector("#cedentes-lista");

  // Carregar lista de cedentes
  const carregarCedentes = async () => {
    try {
      const response = await fetch("/api/cedentes/listar");
      const cedentes = await response.json();

      table.innerHTML = cedentes
        .map(
          (cedente) => `
                <tr>
                    <td>${cedente.nome_razao_social}</td>
                    <td>${cedente.cpf_cnpj}</td>
                    <td><span class="badge bg-${getStatusColor(
                      cedente.status
                    )}">${cedente.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editarCedente(${
                          cedente.id
                        })">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deletarCedente(${
                          cedente.id
                        })">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Erro ao carregar cedentes:", error);
    }
  };

  // Handler do formulário de upload
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/cedentes/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Sucesso! ${result.count} cedentes importados.`);
        carregarCedentes();
      } else {
        alert("Erro ao processar planilha: " + result.error);
      }
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao enviar arquivo");
    }
  });

  // Carregar cedentes inicialmente
  carregarCedentes();
});

function getStatusColor(status) {
  switch (status) {
    case "Ativo":
      return "success";
    case "Pendente":
      return "warning";
    case "Inativo":
      return "danger";
    default:
      return "secondary";
  }
}
