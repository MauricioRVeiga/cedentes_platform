import sqlite3
import os
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import re

# Inicializar SQLAlchemy para autenticação
db = SQLAlchemy()


# Modelo de Usuário para autenticação
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    name = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @staticmethod
    def validate_email_domain(email):
        """Valida se o email pertence ao domínio @goldcreditsa.com.br"""
        pattern = r'^[a-zA-Z0-9._%+-]+@goldcreditsa\.com\.br$'
        return re.match(pattern, email) is not None

    def get_id(self):
        """Método necessário para o Flask-Login"""
        return str(self.id)

    def __repr__(self):
        return f'<User {self.email}>'

# =============================================================================
# CÓDIGO ORIGINAL DO BANCO DE DADOS (mantido para compatibilidade)
# =============================================================================


DB_PATH = os.path.join('instance', 'cedentes.db')


def get_db_connection():
    """Cria conexão com o banco de dados"""
    os.makedirs('instance', exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Inicializa o banco de dados com todas as tabelas necessárias"""
    conn = get_db_connection()
    
    # Tabela de cedentes
    conn.execute('''
        CREATE TABLE IF NOT EXISTS cedentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_razao_social TEXT NOT NULL,
            cpf_cnpj TEXT NOT NULL,
            contrato TEXT NOT NULL,
            validade_contrato DATE NULL,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de documentos
    conn.execute('''
        CREATE TABLE IF NOT EXISTS documentos_cedente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cedente_id INTEGER NOT NULL,
            contrato_social BOOLEAN DEFAULT 0,
            cartao_cnpj BOOLEAN DEFAULT 0,
            faturamento_12meses BOOLEAN DEFAULT 0,
            dre_balanco BOOLEAN DEFAULT 0,
            cnh_rg_socios BOOLEAN DEFAULT 0,
            ir_socios BOOLEAN DEFAULT 0,
            comprovante_endereco BOOLEAN DEFAULT 0,
            email BOOLEAN DEFAULT 0,
            curva_abc BOOLEAN DEFAULT 0,
            dados_bancarios BOOLEAN DEFAULT 0,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cedente_id) REFERENCES cedentes (id) ON DELETE CASCADE,
            UNIQUE(cedente_id)
        )
    ''')
    
    # NOVA TABELA: Notificações
    conn.execute('''
        CREATE TABLE IF NOT EXISTS notificacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cedente_id INTEGER,
            tipo TEXT NOT NULL,
            titulo TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            lida BOOLEAN DEFAULT FALSE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_vencimento DATE,
            FOREIGN KEY (cedente_id) REFERENCES cedentes (id) ON DELETE CASCADE
        )
    ''')
    
    # Índices para melhor performance
    conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_cedente_id ON notificacoes(cedente_id)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_data_criacao ON notificacoes(data_criacao)')
    
    conn.commit()
    conn.close()
    print("✅ Banco de dados inicializado com sucesso!")


def add_cedente(nome_razao_social, cpf_cnpj, contrato, validade_contrato=None):
    """Adiciona um novo cedente"""
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO cedentes (nome_razao_social, cpf_cnpj, contrato, validade_contrato)
            VALUES (?, ?, ?, ?)
        ''', (nome_razao_social, cpf_cnpj, contrato, validade_contrato))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Erro ao adicionar cedente: {e}")
        return False


def update_cedente(cedente_id, nome_razao_social, cpf_cnpj, contrato, validade_contrato=None):
    """Atualiza um cedente existente"""
    try:
        conn = get_db_connection()
        cursor = conn.execute('''
            UPDATE cedentes 
            SET nome_razao_social = ?, cpf_cnpj = ?, contrato = ?, 
                validade_contrato = ?, data_atualizacao = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome_razao_social, cpf_cnpj, contrato, validade_contrato, cedente_id))
        
        conn.commit()
        conn.close()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Erro ao atualizar cedente: {e}")
        return False


def get_all_cedentes():
    """Retorna todos os cedentes ORDENADOS POR NOME (A-Z)"""
    conn = get_db_connection()
    cedentes = conn.execute('''
        SELECT id, nome_razao_social, cpf_cnpj, contrato, validade_contrato,
               datetime(data_criacao) as data_criacao,
               datetime(data_atualizacao) as data_atualizacao
        FROM cedentes 
        ORDER BY nome_razao_social ASC
    ''').fetchall()
    
    conn.close()
    return [dict(cedente) for cedente in cedentes]


def delete_cedente(cedente_id):
    """Exclui um cedente"""
    try:
        conn = get_db_connection()
        cursor = conn.execute('DELETE FROM cedentes WHERE id = ?', (cedente_id,))
        conn.commit()
        conn.close()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Erro ao excluir cedente: {e}")
        return False


def get_documentos_cedente(cedente_id):
    """Busca os documentos de um cedente"""
    conn = get_db_connection()
    documentos = conn.execute('''
        SELECT * FROM documentos_cedente WHERE cedente_id = ?
    ''', (cedente_id,)).fetchone()
    conn.close()
    
    if documentos:
        return dict(documentos)
    return None


def salvar_documentos_cedente(cedente_id, documentos_data):
    """Salva ou atualiza os documentos de um cedente"""
    try:
        conn = get_db_connection()
        
        # Verifica se já existe registro
        existente = conn.execute(
            'SELECT id FROM documentos_cedente WHERE cedente_id = ?',
            (cedente_id,)
        ).fetchone()
        
        if existente:
            # Atualiza
            conn.execute('''
                UPDATE documentos_cedente SET
                    contrato_social = ?, cartao_cnpj = ?, faturamento_12meses = ?,
                    dre_balanco = ?, cnh_rg_socios = ?, ir_socios = ?,
                    comprovante_endereco = ?, email = ?, curva_abc = ?,
                    dados_bancarios = ?, data_atualizacao = CURRENT_TIMESTAMP
                WHERE cedente_id = ?
            ''', (
                documentos_data.get('contrato_social', 0),
                documentos_data.get('cartao_cnpj', 0),
                documentos_data.get('faturamento_12meses', 0),
                documentos_data.get('dre_balanco', 0),
                documentos_data.get('cnh_rg_socios', 0),
                documentos_data.get('ir_socios', 0),
                documentos_data.get('comprovante_endereco', 0),
                documentos_data.get('email', 0),
                documentos_data.get('curva_abc', 0),
                documentos_data.get('dados_bancarios', 0),
                cedente_id
            ))
        else:
            # Insere novo
            conn.execute('''
                INSERT INTO documentos_cedente (
                    cedente_id, contrato_social, cartao_cnpj, faturamento_12meses,
                    dre_balanco, cnh_rg_socios, ir_socios, comprovante_endereco,
                    email, curva_abc, dados_bancarios
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                cedente_id,
                documentos_data.get('contrato_social', 0),
                documentos_data.get('cartao_cnpj', 0),
                documentos_data.get('faturamento_12meses', 0),
                documentos_data.get('dre_balanco', 0),
                documentos_data.get('cnh_rg_socios', 0),
                documentos_data.get('ir_socios', 0),
                documentos_data.get('comprovante_endereco', 0),
                documentos_data.get('email', 0),
                documentos_data.get('curva_abc', 0),
                documentos_data.get('dados_bancarios', 0)
            ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Erro ao salvar documentos: {e}")
        return False


def verificar_documentos_completos(cedente_id):
    """Verifica se todos os documentos estão marcados"""
    documentos = get_documentos_cedente(cedente_id)
    if not documentos:
        return False
    
    # Lista de todos os campos de documentos
    campos_documentos = [
        'contrato_social', 'cartao_cnpj', 'faturamento_12meses',
        'dre_balanco', 'cnh_rg_socios', 'ir_socios',
        'comprovante_endereco', 'email', 'curva_abc', 'dados_bancarios'
    ]
    
    # Verifica se todos estão True
    for campo in campos_documentos:
        if not documentos.get(campo):
            return False
    
    return True

# =============================================================================
# NOVAS FUNÇÕES PARA NOTIFICAÇÕES
# =============================================================================


def criar_notificacao(cedente_id, tipo, titulo, mensagem, data_vencimento=None):
    """Cria uma nova notificação"""
    try:
        conn = get_db_connection()
        
        cursor = conn.execute('''
            INSERT INTO notificacoes (cedente_id, tipo, titulo, mensagem, data_vencimento)
            VALUES (?, ?, ?, ?, ?)
        ''', (cedente_id, tipo, titulo, mensagem, data_vencimento))
        
        conn.commit()
        notificacao_id = cursor.lastrowid
        conn.close()
        
        print(f"✅ Notificação criada: {titulo}")
        return notificacao_id
    except Exception as e:
        print(f"❌ Erro ao criar notificação: {e}")
        return None


def get_notificacoes_nao_lidas():
    """Busca todas as notificações não lidas"""
    try:
        conn = get_db_connection()
        
        cursor = conn.execute('''
            SELECT n.*, c.nome_razao_social 
            FROM notificacoes n 
            LEFT JOIN cedentes c ON n.cedente_id = c.id 
            WHERE n.lida = FALSE 
            ORDER BY n.data_criacao DESC
        ''')
        
        notificacoes = []
        for row in cursor.fetchall():
            notificacoes.append({
                'id': row[0],
                'cedente_id': row[1],
                'tipo': row[2],
                'titulo': row[3],
                'mensagem': row[4],
                'lida': bool(row[5]),
                'data_criacao': row[6],
                'data_vencimento': row[7],
                'cedente_nome': row[8]
            })
        
        conn.close()
        return notificacoes
    except Exception as e:
        print(f"❌ Erro ao buscar notificações: {e}")
        return []


def marcar_notificacao_como_lida(notificacao_id):
    """Marca uma notificação como lida"""
    try:
        conn = get_db_connection()
        
        cursor = conn.execute('''
            UPDATE notificacoes SET lida = TRUE WHERE id = ?
        ''', (notificacao_id,))
        
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        
        return success
    except Exception as e:
        print(f"❌ Erro ao marcar notificação como lida: {e}")
        return False


def marcar_todas_notificacoes_como_lidas():
    """Marca todas as notificações como lidas"""
    try:
        conn = get_db_connection()
        
        cursor = conn.execute('UPDATE notificacoes SET lida = TRUE WHERE lida = FALSE')
        
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        
        return success
    except Exception as e:
        print(f"❌ Erro ao marcar todas notificações como lidas: {e}")
        return False


def get_total_notificacoes_nao_lidas():
    """Retorna o total de notificações não lidas"""
    try:
        conn = get_db_connection()
        
        cursor = conn.execute('SELECT COUNT(*) FROM notificacoes WHERE lida = FALSE')
        total = cursor.fetchone()[0]
        
        conn.close()
        return total
    except Exception as e:
        print(f"❌ Erro ao contar notificações: {e}")
        return 0
