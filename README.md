# 🏢 Gestão de Cedentes - Gold Credit SA

Sistema web para gerenciamento de cedentes e controle de contratos.

## ✨ Funcionalidades

- ✅ Cadastro de cedentes (Nome/Razão Social, CPF/CNPJ, Status do Contrato)
- ✅ Importação em massa via planilha Excel (.xlsx, .xls)
- ✅ Filtros e busca avançada
- ✅ Paginação (20 itens por página)
- ✅ Interface moderna e responsiva
- ✅ CRUD completo (Criar, Ler, Atualizar, Excluir)

## 🛠️ Tecnologias

- **Backend**: Python + Flask
- **Frontend**: HTML5, CSS3, JavaScript
- **Banco de Dados**: SQLite
- **Processamento Excel**: OpenPyXL

## 🚀 Instalação

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/seu-usuario/gestao-cedentes.git
   cd gestao-cedentes
   ```

2. **Crie um ambiente virtual**:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/Mac:
   source venv/bin/activate
   ```

3. **Instale as dependências**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Execute a aplicação**:
   ```bash
   python app.py
   ```

5. **Acesse no navegador**:
   ```text
   http://localhost:5000
   ```

## 📊 Estrutura do Projeto
```
gestao-cedentes/
├── app.py                 # Aplicação principal Flask
├── database.py            # Configuração do banco de dados
├── import_excel.py        # Importação de planilhas Excel
├── requirements.txt       # Dependências do projeto
├── .gitignore             # Arquivos ignorados pelo Git
├── README.md              # Documentação
├── templates/
│   └── index.html         # Interface web
└── static/
    ├── style.css          # Estilos CSS
    └── script.js          # JavaScript do frontend
```

## 📋 Pré-requisitos

- Python 3.8+
- Navegador web moderno

## 👨‍💻 Desenvolvimento

Para contribuir com o projeto:

1. Faça um fork do repositório
2. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/nova-feature
   ```
3. Commit suas mudanças:
   ```bash
   git commit -am 'Adiciona nova feature'
   ```
4. Push para a branch:
   ```bash
   git push origin feature/nova-feature
   ```
5. Abra um Pull Request

## 📞 Suporte

Em caso de dúvidas ou problemas, abra uma issue no repositório.
