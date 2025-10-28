// Utilitários globais
document.addEventListener("DOMContentLoaded", () => {
  console.log("Sistema Gold Credit SA inicializado");
});

// Funções utilitárias globais
function formatCpfCnpj(cpfCnpj) {
  if (!cpfCnpj) return '';
  
  const cleaned = cpfCnpj.toString().replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return cpfCnpj;
}

function getStatusClass(status) {
  const statusClasses = {
    "CONTRATO ASSINADO MANUALMENTE": "bg-success",
    "CONTRATO SEM ASSINATURA MANUAL E DIGITAL": "bg-danger",
    "CONTRATO PRECISA SER RENOVADO": "bg-warning",
    "CONTRATOS IMPRESSOS QUE FALTAM ASSINAR": "bg-info",
    "CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO": "bg-primary",
    "LEVOU O CONTRATO PARA ASSINAR": "bg-secondary"
  };
  return statusClasses[status] || "bg-secondary";
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

// Sistema de toasts global
function mostrarToast(mensagem, tipo = "success") {
  // Remover toasts existentes
  const toastsExistentes = document.querySelectorAll('.toast-container');
  toastsExistentes.forEach(toast => toast.remove());

  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
  toastContainer.style.zIndex = '9999';

  const toastHtml = `
    <div class="toast align-items-center text-white bg-${tipo} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">
          <i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
          ${mensagem}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;

  toastContainer.innerHTML = toastHtml;
  document.body.appendChild(toastContainer);

  const toastEl = toastContainer.querySelector('.toast');
  const toast = new bootstrap.Toast(toastEl, { 
    delay: 4000,
    autohide: true
  });
  
  toast.show();
  
  // Remover após desaparecer
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastContainer.remove();
  });
}

// Função para mostrar loading
function mostrarLoading(mensagem = "Processando...") {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-overlay';
  loadingDiv.innerHTML = `
    <div class="loading-content">
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mb-0">${mensagem}</p>
    </div>
  `;
  document.body.appendChild(loadingDiv);
  return loadingDiv;
}

// Função para esconder loading
function esconderLoading(loadingDiv) {
  if (loadingDiv && loadingDiv.parentNode) {
    loadingDiv.parentNode.removeChild(loadingDiv);
  }
}

// Debounce function para busca
function debounce(func, wait, immediate) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

// Validação de CPF/CNPJ
function validarCPFCNPJ(cpfCnpj) {
  const cleaned = cpfCnpj.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return validarCPF(cleaned);
  } else if (cleaned.length === 14) {
    return validarCNPJ(cleaned);
  }
  return false;
}

function validarCPF(cpf) {
  if (/(\d)\1{10}/.test(cpf)) return false;
  
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  
  return resto === parseInt(cpf[10]);
}

function validarCNPJ(cnpj) {
  if (/(\d)\1{13}/.test(cnpj)) return false;
  
  // Implementação básica da validação de CNPJ
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(cnpj[i]) * pesos1[i];
  let resto = soma % 11;
  let digito1 = resto < 2 ? 0 : 11 - resto;
  
  if (digito1 !== parseInt(cnpj[12])) return false;
  
  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(cnpj[i]) * pesos2[i];
  resto = soma % 11;
  let digito2 = resto < 2 ? 0 : 11 - resto;
  
  return digito2 === parseInt(cnpj[13]);
}