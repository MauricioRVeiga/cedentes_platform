# fix_database.py
import os
import sqlite3
from pathlib import Path

def fix_database_issue():
    print("🔧 Corrigindo problema do banco de dados...")
    
    # Criar diretório instance se não existir
    os.makedirs('instance', exist_ok=True)
    
    # Caminho correto para Windows
    db_path = 'instance/cedentes.db'
    
    print(f"📁 Tentando criar banco em: {db_path}")
    
    try:
        # Tentar criar conexão
        conn = sqlite3.connect(db_path)
        
        # Criar tabelas básicas
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
        
        conn.commit()
        conn.close()
        
        print(f"✅ Banco criado com sucesso: {db_path}")
        print(f"✅ Tamanho do arquivo: {os.path.getsize(db_path)} bytes")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar banco: {e}")
        return False

if __name__ == '__main__':
    fix_database_issue()