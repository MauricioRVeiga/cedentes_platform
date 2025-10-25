import sqlite3
import os
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import re

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    name = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @staticmethod
    def validate_email_domain(email):
        return re.match(r'^[a-zA-Z0-9._%+-]+@goldcreditsa\.com\.br$', email) is not None

    def get_id(self):
        return str(self.id)


# Funções do banco SQLite
def get_db_connection():
    try:
        conn = sqlite3.connect('cedentes.db')
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        return conn
    except Exception as e:
        print(f"❌ Erro DB: {e}")
        return None


def init_db():
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        # Tabela cedentes
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cedentes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome_razao_social TEXT NOT NULL,
                cpf_cnpj TEXT NOT NULL,
                contrato TEXT NOT NULL,
                validade_contrato DATE NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tabela documentos
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
                FOREIGN KEY (cedente_id) REFERENCES cedentes (id)
            )
        ''')
        
        conn.commit()
        print("✅ Tabelas do sistema criadas")
        return True
    except Exception as e:
        print(f"❌ Erro init_db: {e}")
        return False
    finally:
        if conn:
            conn.close()


def add_cedente(nome_razao_social, cpf_cnpj, contrato, validade_contrato=None):
    conn = get_db_connection()
    if not conn:
        return False
    try:
        conn.execute(
            'INSERT INTO cedentes (nome_razao_social, cpf_cnpj, contrato, validade_contrato) VALUES (?, ?, ?, ?)',
            (nome_razao_social, cpf_cnpj, contrato, validade_contrato)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro add_cedente: {e}")
        return False
    finally:
        if conn:
            conn.close()


def get_all_cedentes():
    conn = get_db_connection()
    if not conn:
        return []
    try:
        cedentes = conn.execute('SELECT * FROM cedentes ORDER BY nome_razao_social').fetchall()
        return [dict(cedente) for cedente in cedentes]
    except Exception as e:
        print(f"❌ Erro get_cedentes: {e}")
        return []
    finally:
        if conn:
            conn.close()


def get_documentos_cedente(cedente_id):
    conn = get_db_connection()
    if not conn:
        return {}
    try:
        doc = conn.execute('SELECT * FROM documentos_cedente WHERE cedente_id = ?', (cedente_id,)).fetchone()
        return dict(doc) if doc else {}
    except:
        return {}
    finally:
        if conn:
            conn.close()


def salvar_documentos_cedente(cedente_id, documentos_data):
    conn = get_db_connection()
    if not conn:
        return False
    try:
        # Implementação simplificada
        conn.execute('''
            INSERT OR REPLACE INTO documentos_cedente 
            (cedente_id, contrato_social, cartao_cnpj, faturamento_12meses, dre_balanco, cnh_rg_socios, ir_socios, comprovante_endereco, email, curva_abc, dados_bancarios)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        return True
    except Exception as e:
        print(f"❌ Erro salvar_documentos: {e}")
        return False
    finally:
        if conn:
            conn.close()


# Funções simplificadas para outras operações
def update_cedente(cedente_id, nome_razao_social, cpf_cnpj, contrato, validade_contrato=None):
    conn = get_db_connection()
    if not conn:
        return False
    try:
        conn.execute(
            'UPDATE cedentes SET nome_razao_social=?, cpf_cnpj=?, contrato=?, validade_contrato=? WHERE id=?',
            (nome_razao_social, cpf_cnpj, contrato, validade_contrato, cedente_id)
        )
        conn.commit()
        return True
    except:
        return False
    finally:
        if conn:
            conn.close()


def delete_cedente(cedente_id):
    conn = get_db_connection()
    if not conn:
        return False
    try:
        conn.execute('DELETE FROM cedentes WHERE id=?', (cedente_id,))
        conn.commit()
        return True
    except:
        return False
    finally:
        if conn:
            conn.close()


def backup_database():
    try:
        import shutil
        from datetime import datetime
        
        # Criar nome do arquivo de backup com timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'backup_{timestamp}.db'
        backup_path = os.path.join('backups', backup_filename)
        
        # Garantir que o diretório de backups existe
        os.makedirs('backups', exist_ok=True)
        
        # Copiar o banco de dados
        shutil.copy2('cedentes.db', backup_path)
        
        return {'success': True, 'filename': backup_filename}
    except Exception as e:
        print(f"❌ Erro no backup: {e}")
        return {'success': False, 'error': str(e)}


def restore_database(backup_filename):
    try:
        import shutil
        backup_path = os.path.join('backups', backup_filename)
        
        # Verificar se o backup existe
        if not os.path.exists(backup_path):
            return {'success': False, 'error': 'Arquivo de backup não encontrado'}
            
        # Restaurar o backup
        shutil.copy2(backup_path, 'cedentes.db')
        
        return {'success': True}
    except Exception as e:
        print(f"❌ Erro na restauração: {e}")
        return {'success': False, 'error': str(e)}


def check_documentos_status():
    conn = get_db_connection()
    if not conn:
        return []
        
    try:
        cedentes = conn.execute('''
            SELECT c.*, d.* 
            FROM cedentes c 
            LEFT JOIN documentos_cedente d ON c.id = d.cedente_id
        ''').fetchall()
        
        status_list = []
        for cedente in cedentes:
            docs = dict(cedente)
            if not all([
                docs.get('contrato_social'),
                docs.get('cartao_cnpj'),
                docs.get('faturamento_12meses'),
                # ... verificar outros documentos
            ]):
                status_list.append({
                    'cedente_id': cedente['id'],
                    'nome': cedente['nome_razao_social'],
                    'documentos_pendentes': True
                })
                
        return status_list
    except Exception as e:
        print(f"❌ Erro verificação docs: {e}")
        return []
    finally:
        if conn:
            conn.close()
