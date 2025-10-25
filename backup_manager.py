import sqlite3
import os
import shutil
from datetime import datetime, timedelta
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backup.log'),
        logging.StreamHandler()
    ]
)

class BackupManager:
    def __init__(self, db_path=None, backup_dir='backups'):
        # Determinar caminho do banco automaticamente
        if db_path is None:
            import platform
            if platform.system() == 'Windows':
                self.db_path = 'instance/cedentes.db'
            else:
                self.db_path = '/tmp/cedentes.db'
        else:
            self.db_path = db_path
            
        self.backup_dir = backup_dir
        self._ensure_backup_dir()
    
    def _ensure_backup_dir(self):
        """Garante que o diretório de backups existe"""
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)
            logging.info(f"Diretório de backups criado: {self.backup_dir}")
    
    def criar_backup(self, motivo="manual"):
        """Cria um backup do banco de dados"""
        try:
            if not os.path.exists(self.db_path):
                logging.error("Banco de dados não encontrado para backup")
                return False
            
            # Nome do arquivo com timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"cedentes_backup_{timestamp}_{motivo}.db"
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            # Criar backup
            shutil.copy2(self.db_path, backup_path)
            
            # Verificar se o backup foi criado com sucesso
            if os.path.exists(backup_path):
                file_size = os.path.getsize(backup_path)
                logging.info(f"Backup criado: {backup_filename} ({file_size} bytes) - Motivo: {motivo}")
                
                # Limpar backups antigos
                self._limpar_backups_antigos()
                
                return {
                    'success': True,
                    'filename': backup_filename,
                    'path': backup_path,
                    'size': file_size,
                    'timestamp': timestamp
                }
            else:
                logging.error("Falha ao criar backup")
                return {'success': False, 'message': 'Falha ao criar arquivo de backup'}
                
        except Exception as e:
            logging.error(f"Erro ao criar backup: {str(e)}")
            return {'success': False, 'message': str(e)}
    
    def _limpar_backups_antigos(self, dias_manter=7):
        """Remove backups mais antigos que o número especificado de dias"""
        try:
            agora = datetime.now()
            arquivos_backup = []
            
            # Listar todos os arquivos de backup
            for arquivo in os.listdir(self.backup_dir):
                if arquivo.startswith('cedentes_backup_') and arquivo.endswith('.db'):
                    caminho_arquivo = os.path.join(self.backup_dir, arquivo)
                    stat = os.stat(caminho_arquivo)
                    data_modificacao = datetime.fromtimestamp(stat.st_mtime)
                    
                    arquivos_backup.append((caminho_arquivo, data_modificacao, arquivo))
            
            # Ordenar por data (mais recente primeiro)
            arquivos_backup.sort(key=lambda x: x[1], reverse=True)
            
            # Manter apenas os backups dos últimos 'dias_manter' dias
            for caminho_arquivo, data_modificacao, nome_arquivo in arquivos_backup[dias_manter:]:
                if agora - data_modificacao > timedelta(days=dias_manter):
                    os.remove(caminho_arquivo)
                    logging.info(f"Backup antigo removido: {nome_arquivo}")
                    
        except Exception as e:
            logging.error(f"Erro ao limpar backups antigos: {str(e)}")
    
    def listar_backups(self):
        """Lista todos os backups disponíveis"""
        try:
            backups = []
            
            for arquivo in os.listdir(self.backup_dir):
                if arquivo.startswith('cedentes_backup_') and arquivo.endswith('.db'):
                    caminho_arquivo = os.path.join(self.backup_dir, arquivo)
                    stat = os.stat(caminho_arquivo)
                    
                    backup_info = {
                        'filename': arquivo,
                        'path': caminho_arquivo,
                        'size': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M:%S"),
                        'size_mb': round(stat.st_size / (1024 * 1024), 2)
                    }
                    
                    # Extrair motivo do nome do arquivo
                    partes = arquivo.split('_')
                    if len(partes) >= 4:
                        backup_info['motivo'] = partes[3].replace('.db', '')
                    else:
                        backup_info['motivo'] = 'desconhecido'
                    
                    backups.append(backup_info)
            
            # Ordenar por data de modificação (mais recente primeiro)
            backups.sort(key=lambda x: x['modified'], reverse=True)
            return backups
            
        except Exception as e:
            logging.error(f"Erro ao listar backups: {str(e)}")
            return []
    
    def restaurar_backup(self, backup_filename):
        """Restaura um backup específico"""
        try:
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            if not os.path.exists(backup_path):
                return {'success': False, 'message': 'Arquivo de backup não encontrado'}
            
            # Criar backup antes da restauração (segurança)
            self.criar_backup(motivo="pre_restauracao")
            
            # Fazer cópia do banco atual (caso algo dê errado)
            backup_emergencia = f"instance/cedentes_emergencia_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            if os.path.exists(self.db_path):
                shutil.copy2(self.db_path, backup_emergencia)
            
            # Restaurar backup
            shutil.copy2(backup_path, self.db_path)
            
            logging.info(f"Backup restaurado com sucesso: {backup_filename}")
            
            # Remover backup de emergência após 1 minuto (background)
            def remover_backup_emergencia():
                import time
                time.sleep(60)  # Esperar 1 minuto
                if os.path.exists(backup_emergencia):
                    os.remove(backup_emergencia)
                    logging.info(f"Backup de emergência removido: {backup_emergencia}")
            
            import threading
            threading.Thread(target=remover_backup_emergencia, daemon=True).start()
            
            return {'success': True, 'message': 'Backup restaurado com sucesso'}
            
        except Exception as e:
            logging.error(f"Erro ao restaurar backup: {str(e)}")
            return {'success': False, 'message': str(e)}
    
    def obter_estatisticas_backup(self):
        """Obtém estatísticas sobre os backups"""
        backups = self.listar_backups()
        
        if not backups:
            return {
                'total_backups': 0,
                'tamanho_total_mb': 0,
                'backup_mais_recente': None,
                'backup_mais_antigo': None
            }
        
        tamanho_total = sum(backup['size'] for backup in backups)
        
        return {
            'total_backups': len(backups),
            'tamanho_total_mb': round(tamanho_total / (1024 * 1024), 2),
            'backup_mais_recente': backups[0]['modified'],
            'backup_mais_antigo': backups[-1]['modified']
        }


# Instância global do gerenciador de backup
backup_manager = BackupManager()