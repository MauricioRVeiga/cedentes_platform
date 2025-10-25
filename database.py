import sqlite3
import os
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import re

# Inicializar SQLAlchemy
db = SQLAlchemy()

# =============================================================================
# MODELO DE USUÁRIO (Flask-Login + SQLAlchemy)
# =============================================================================

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255))
    name = db.Column(db.String(100), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)  # NOVO: Sistema de roles
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    def set_password(self, password):
        """Define senha com hash seguro"""
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        """Verifica senha"""
        return check_password_hash(self.password_hash, password)

    @staticmethod
    def validate_email_domain(email):
        """Valida se o email pertence ao domínio corporativo"""
        pattern = r'^[a-zA-Z0-9._%+-]+@goldcreditsa\.com\.br$'
        return re.match(pattern, email) is not None

    def update_last_login(self):
        """Atualiza timestamp do último login"""
        self.last_login = datetime.utcnow()
        db.session.commit()

    def get_id(self):
        """Método necessário para Flask-Login"""
        return str(self.id)

    def __repr__(self):
        return f'<User {self.email}>'

# =============================================================================
# FUNÇÕES DO BANCO SQLite (Cedentes, Documentos, Notificações)
# =============================================================================

def get_db_path():
    """Retorna o caminho do banco SQLite"""
    if 'RAILWAY_ENVIRONMENT' in os.environ or 'RENDER' in os.environ:
        return '/tmp/cedentes.db'
    else:
        os.makedirs('instance', exist_ok=True)
        return os.path.join('instance', 'cedentes.db')

DB_PATH = get_db_path()

def get_db_connection():
    """Cria conexão com SQLite"""
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        conn.execute('PRAGMA journal_mode = WAL')  # Melhor performance
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar SQLite: {e}")
        return None

def init_db():
    """Inicializa todas as tabelas do sistema"""
    conn = get_db_connection()
    if not conn:
        print("❌ Não foi possível conectar ao banco SQLite")
        return False
    
    try:
        # Tabela de cedentes
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cedentes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome_razao_social TEXT NOT NULL,
                cpf_cnpj TEXT NOT NULL UNIQUE,
                contrato TEXT NOT NULL,
                validade_contrato DATE NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_vencimento DATE,
                FOREIGN KEY (cedente_id) REFERENCES cedentes (id) ON DELETE CASCADE
            )
        ''')
        
        conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_cedente ON notificacoes(cedente_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_notificacoes_data ON notificacoes(data_criacao)')
        
        conn.commit()
        print("✅ Banco de dados SQLite inicializado com sucesso!")
        return True
        
    except Exception as e:
        print(f"❌ Erro ao inicializar SQLite: {e}")
        return False
    finally:
        conn.close()

# =============================================================================
# FUNÇÕES DE CEDENTES (CRUD)
# =============================================================================

def add_cedente(nome_razao_social, cpf_cnpj, contrato, validade_contrato=None):
    """Adiciona novo cedente"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        conn.execute('''
            INSERT INTO cedentes (nome_razao_social, cpf_cnpj, contrato, validade_contrato)
            VALUES (?, ?, ?, ?)
        ''', (nome_razao_social, cpf_cnpj, contrato, validade_contrato))
        
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        print(f"❌ CPF/CNPJ {cpf_cnpj} já cadastrado")
        return False
    except Exception as e:
        print(f"❌ Erro ao adicionar cedente: {e}")
        return False
    finally:
        conn.close()

def update_cedente(cedente_id, nome_razao_social, cpf_cnpj, contrato, validade_contrato=None):
    """Atualiza cedente existente"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.execute('''
            UPDATE cedentes 
            SET nome_razao_social = ?, cpf_cnpj = ?, contrato = ?, 
                validade_contrato = ?, data_atualizacao = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome_razao_social, cpf_cnpj, contrato, validade_contrato, cedente_id))
        
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Erro ao atualizar cedente: {e}")
        return False
    finally:
        conn.close()

def get_all_cedentes():
    """Retorna todos os cedentes ORDENADOS POR NOME (A-Z)"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cedentes = conn.execute('''
            SELECT 
                id, 
                nome_razao_social, 
                cpf_cnpj, 
                contrato, 
                validade_contrato,
                datetime(data_criacao) as data_criacao,
                datetime(data_atualizacao) as data_atualizacao
            FROM cedentes 
            ORDER BY LOWER(TRIM(nome_razao_social)) ASC
        ''').fetchall()
        
        return [dict(cedente) for cedente in cedentes]
    except Exception as e:
        print(f"❌ Erro ao buscar cedentes: {e}")
        return []
    finally:
        conn.close()

def get_cedente_by_id(cedente_id):
    """Busca cedente por ID"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cedente = conn.execute(
            'SELECT * FROM cedentes WHERE id = ?', 
            (cedente_id,)
        ).fetchone()
        
        return dict(cedente) if cedente else None
    except Exception as e:
        print(f"❌ Erro ao buscar cedente: {e}")
        return None
    finally:
        conn.close()

def delete_cedente(cedente_id):
    """Exclui um cedente (cascade para documentos e notificações)"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.execute('DELETE FROM cedentes WHERE id = ?', (cedente_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Erro ao excluir cedente: {e}")
        return False
    finally:
        conn.close()

# =============================================================================
# FUNÇÕES DE DOCUMENTOS
# =============================================================================

def get_documentos_cedente(cedente_id):
    """Busca documentos de um cedente"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        documentos = conn.execute(
            'SELECT * FROM documentos_cedente WHERE cedente_id = ?', 
            (cedente_id,)
        ).fetchone()
        
        return dict(documentos) if documentos else None
    except Exception as e:
        print(f"❌ Erro ao buscar documentos: {e}")
        return None
    finally:
        conn.close()

def salvar_documentos_cedente(cedente_id, documentos_data):
    """Salva ou atualiza documentos de um cedente"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        existente = conn.execute(
            'SELECT id FROM documentos_cedente WHERE cedente_id = ?',
            (cedente_id,)
        ).fetchone()
        
        if existente:
            # Atualiza
            conn.execute('''
                UPDATE documentos_cedente SET
                    contrato_social = ?, 
                    cartao_cnpj = ?, 
                    faturamento_12meses = ?,
                    dre_balanco = ?, 
                    cnh_rg_socios = ?, 
                    ir_socios = ?,
                    comprovante_endereco = ?, 
                    email = ?, 
                    curva_abc = ?,
                    dados_bancarios = ?, 
                    data_atualizacao = CURRENT_TIMESTAMP
                WHERE cedente_id = ?
            ''', (
                documentos_data.get('contrato_social', False),
                documentos_data.get('cartao_cnpj', False),
                documentos_data.get('faturamento_12meses', False),
                documentos_data.get('dre_balanco', False),
                documentos_data.get('cnh_rg_socios', False),
                documentos_data.get('ir_socios', False),
                documentos_data.get('comprovante_endereco', False),
                documentos_data.get('email', False),
                documentos_data.get('curva_abc', False),
                documentos_data.get('dados_bancarios', False),
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
                documentos_data.get('contrato_social', False),
                documentos_data.get('cartao_cnpj', False),
                documentos_data.get('faturamento_12meses', False),
                documentos_data.get('dre_balanco', False),
                documentos_data.get('cnh_rg_socios', False),
                documentos_data.get('ir_socios', False),
                documentos_data.get('comprovante_endereco', False),
                documentos_data.get('email', False),
                documentos_data.get('curva_abc', False),
                documentos_data.get('dados_bancarios', False)
            ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao salvar documentos: {e}")
        return False
    finally:
        conn.close()

def verificar_documentos_completos(cedente_id):
    """Verifica se todos os documentos estão marcados"""
    documentos = get_documentos_cedente(cedente_id)
    
    if not documentos:
        return False
    
    campos_documentos = [
        'contrato_social', 'cartao_cnpj', 'faturamento_12meses',
        'dre_balanco', 'cnh_rg_socios', 'ir_socios',
        'comprovante_endereco', 'email', 'curva_abc', 'dados_bancarios'
    ]
    
    for campo in campos_documentos:
        if not documentos.get(campo):
            return False
    
    return True

# =============================================================================
# FUNÇÕES DE NOTIFICAÇÕES
# =============================================================================

def criar_notificacao(cedente_id, tipo, titulo, mensagem, data_vencimento=None):
    """Cria uma nova notificação"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cursor = conn.execute('''
            INSERT INTO notificacoes (cedente_id, tipo, titulo, mensagem, data_vencimento)
            VALUES (?, ?, ?, ?, ?)
        ''', (cedente_id, tipo, titulo, mensagem, data_vencimento))
        
        conn.commit()
        notificacao_id = cursor.lastrowid
        print(f"✅ Notificação criada: {titulo}")
        return notificacao_id
    except Exception as e:
        print(f"❌ Erro ao criar notificação: {e}")
        return None
    finally:
        conn.close()

def get_notificacoes_nao_lidas():
    """Busca todas as notificações não lidas"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cursor = conn.execute('''
            SELECT 
                n.id,
                n.cedente_id,
                n.tipo,
                n.titulo,
                n.mensagem,
                n.lida,
                n.data_criacao,
                n.data_vencimento,
                c.nome_razao_social as cedente_nome
            FROM notificacoes n 
            LEFT JOIN cedentes c ON n.cedente_id = c.id 
            WHERE n.lida = 0 
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
        
        return notificacoes
    except Exception as e:
        print(f"❌ Erro ao buscar notificações: {e}")
        return []
    finally:
        conn.close()

def marcar_notificacao_como_lida(notificacao_id):
    """Marca uma notificação como lida"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.execute(
            'UPDATE notificacoes SET lida = 1 WHERE id = ?', 
            (notificacao_id,)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Erro ao marcar notificação: {e}")
        return False
    finally:
        conn.close()

def marcar_todas_notificacoes_como_lidas():
    """Marca todas as notificações como lidas"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.execute('UPDATE notificacoes SET lida = 1 WHERE lida = 0')
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"❌ Erro ao marcar todas notificações: {e}")
        return False
    finally:
        conn.close()

def get_total_notificacoes_nao_lidas():
    """Retorna o total de notificações não lidas"""
    conn = get_db_connection()
    if not conn:
        return 0
    
    try:
        cursor = conn.execute('SELECT COUNT(*) FROM notificacoes WHERE lida = 0')
        total = cursor.fetchone()[0]
        return total
    except Exception as e:
        print(f"❌ Erro ao contar notificações: {e}")
        return 0
    finally:
        conn.close()

def limpar_notificacoes_antigas(dias=30):
    """Remove notificações lidas mais antigas que X dias"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.execute('''
            DELETE FROM notificacoes 
            WHERE lida = 1 
            AND data_criacao < datetime('now', '-' || ? || ' days')
        ''', (dias,))
        
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"✅ {cursor.rowcount} notificações antigas removidas")
        
        return True
    except Exception as e:
        print(f"❌ Erro ao limpar notificações: {e}")
        return False
    finally:
        conn.close()

# =============================================================================
# FUNÇÕES AUXILIARES E VALIDAÇÕES
# =============================================================================

def validar_cpf(cpf):
    """Valida CPF com dígitos verificadores"""
    cpf = re.sub(r'[^0-9]', '', cpf)
    
    if len(cpf) != 11:
        return False
    
    if cpf == cpf[0] * 11:
        return False
    
    # Cálculo do primeiro dígito
    soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
    digito1 = (soma * 10 % 11) % 10
    
    # Cálculo do segundo dígito
    soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
    digito2 = (soma * 10 % 11) % 10
    
    return cpf[-2:] == f"{digito1}{digito2}"

def validar_cnpj(cnpj):
    """Valida CNPJ com dígitos verificadores"""
    cnpj = re.sub(r'[^0-9]', '', cnpj)
    
    if len(cnpj) != 14:
        return False
    
    if cnpj == cnpj[0] * 14:
        return False
    
    # Cálculo do primeiro dígito
    tamanho = len(cnpj) - 2
    numeros = cnpj[:tamanho]
    digitos = cnpj[tamanho:]
    soma = 0
    pos = tamanho - 7
    
    for i in range(tamanho, 0, -1):
        soma += int(numeros[tamanho - i]) * pos
        pos -= 1
        if pos < 2:
            pos = 9
    
    resultado = 11 - (soma % 11)
    digito1 = 0 if resultado > 9 else resultado
    
    # Cálculo do segundo dígito
    tamanho += 1
    numeros = cnpj[:tamanho]
    soma = 0
    pos = tamanho - 7
    
    for i in range(tamanho, 0, -1):
        soma += int(numeros[tamanho - i]) * pos
        pos -= 1
        if pos < 2:
            pos = 9
    
    resultado = 11 - (soma % 11)
    digito2 = 0 if resultado > 9 else resultado
    
    return digitos == f"{digito1}{digito2}"

def validar_cpf_cnpj(documento):
    """Valida CPF ou CNPJ automaticamente"""
    documento_limpo = re.sub(r'[^0-9]', '', documento)
    
    if len(documento_limpo) == 11:
        return validar_cpf(documento)
    elif len(documento_limpo) == 14:
        return validar_cnpj(documento)
    else:
        return False

def get_estatisticas_sistema():
    """Retorna estatísticas gerais do sistema"""
    conn = get_db_connection()
    if not conn:
        return {}
    
    try:
        stats = {
            'total_cedentes': conn.execute('SELECT COUNT(*) FROM cedentes').fetchone()[0],
            'total_notificacoes': conn.execute('SELECT COUNT(*) FROM notificacoes WHERE lida = 0').fetchone()[0],
            'documentos_completos': 0,
            'documentos_pendentes': 0,
            'contratos_vencidos': 0,
            'contratos_proximos': 0
        }
        
        # Contar documentos
        cedentes = get_all_cedentes()
        for cedente in cedentes:
            if verificar_documentos_completos(cedente['id']):
                stats['documentos_completos'] += 1
            else:
                stats['documentos_pendentes'] += 1
            
            # Verificar vencimentos
            if cedente.get('validade_contrato'):
                try:
                    from datetime import datetime
                    data_vencimento = datetime.strptime(cedente['validade_contrato'], '%Y-%m-%d').date()
                    hoje = datetime.now().date()
                    dias = (data_vencimento - hoje).days
                    
                    if dias < 0:
                        stats['contratos_vencidos'] += 1
                    elif dias <= 30:
                        stats['contratos_proximos'] += 1
                except:
                    pass
        
        return stats
    except Exception as e:
        print(f"❌ Erro ao buscar estatísticas: {e}")
        return {}
    finally:
        conn.close()TIMESTAMP,
                data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Índices para performance
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cedentes_nome ON cedentes(nome_razao_social)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cedentes_cpf_cnpj ON cedentes(cpf_cnpj)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cedentes_contrato ON cedentes(contrato)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cedentes_validade ON cedentes(validade_contrato)')
        
        # Tabela de documentos
        conn.execute('''
            CREATE TABLE IF NOT EXISTS documentos_cedente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cedente_id INTEGER NOT NULL UNIQUE,
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
                FOREIGN KEY (cedente_id) REFERENCES cedentes (id) ON DELETE CASCADE
            )
        ''')
        
        conn.execute('CREATE INDEX IF NOT EXISTS idx_documentos_cedente ON documentos_cedente(cedente_id)')
        
        # Tabela de notificações
        conn.execute('''
            CREATE TABLE IF NOT EXISTS notificacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cedente_id INTEGER,
                tipo TEXT NOT NULL,
                titulo TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                lida BOOLEAN DEFAULT 0,
                data_criacao TIMESTAMP DEFAULT CURRENT_