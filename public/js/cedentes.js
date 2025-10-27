document.addEventListener("DOMContentLoaded", () => {
  // Máscara para CPF/CNPJ
  const cpfCnpjInput = document.querySelector('input[name="cpf_cnpj"]');
  if (cpfCnpjInput) {
    cpfCnpjInput.addEventListener("input", (e) => {
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
  }

  // Formatação do limite de crédito
  const limiteInput = document.querySelector('input[name="limite_credito"]');
  if (limiteInput) {
    limiteInput.addEventListener("blur", (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        e.target.value = value.toFixed(2);
      }
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Object.fromEntries(formData)),
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = "/dashboard";
        } else {
          throw new Error("Erro ao salvar cedente");
        }
      })
      .catch((error) => {
        console.error("Erro:", error);
        alert("Erro ao salvar cedente");
      });

    return false;
  }
});
