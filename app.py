from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from flask_login import LoginManager, current_user, login_required
from database import db, User, init_db, get_all_cedentes, add_cedente, update_cedente, delete_cedente
from database import get_documentos_cedente, salvar_documentos_cedente, verificar_documentos_completos
from database import criar_notificacao, get_notificacoes_nao_lidas, marcar_notificacao_como_lida
from database import marcar_todas_notificacoes_como_lidas
from auth import auth
from import_excel import importar_dados_excel
from backup_manager import backup_manager
import threading
import time
import os
from datetime import datetime, timedelta
from flask_wtf.csrf import CSRFProtect
import logging
from logging.handlers import RotatingFileHandler

def create_app():
    app = Flask(__name__)
    
    # ============================================================================
    # CONFIGURAÇÃO RAILWAY - DATABASE URL
    # ============================================================================
    database_url = os.environ.get('DATABASE_URL')
    
    # Railway/Heroku usa postgres://, mas SQLAlchemy precisa postgresql://
    if database_url and database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    # Se não houver DATABASE_URL, usar SQLite
    if not database_url:
        os.makedirs('/tmp', exist_ok=True)
        database_url = 'sqlite:////tmp/cedentes.db'
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    
    # Secret Key
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24).hex())
    
    # Segurança
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = 3600
    
    print("🚀 GOLD CREDIT S/A - INICIANDO")
    print(f"📊 Database: {'PostgreSQL' if 'postgresql' in database_url else 'SQLite'}")
    print(f"🌍 Environment: {os.environ.get('RAILWAY_ENVIRONMENT', 'local')}")
    
    # Inicializar extensões
    db.init_app(app)
    csrf = CSRFProtect(app)
    
    # Configurar logging
    if not os.path.exists('/tmp/logs'):
        os.makedirs('/tmp/logs', exist_ok=True)
    
    file_handler = RotatingFileHandler(
        '/tmp/logs/goldcredit.log', 
        maxBytes=10240000, 
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Gold Credit SA startup')
    
    # Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Por favor, faça login para acessar esta página.'
    login_manager.login_message_category = 'info'
    
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))
    
    # Registrar blueprints
    app.register_blueprint(auth)
    
    # Health check (importante para Railway)
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'database': 'postgresql' if 'postgresql' in database_url else 'sqlite',
            'timestamp': datetime.now().isoformat()
        }), 200
    
    # Inicializar banco
    with app.app_context():
        try:
            db.create_all()
            init_db()
            print("✅ Database initialized")
            
            # Criar admin se não existir
            admin_email = os.environ.get('ADMIN_EMAIL', 'admin@goldcreditsa.com.br')
            admin_user = User.query.filter_by(email=admin_email).first()
            
            if not admin_user:
                admin_password = os.environ.get('ADMIN_PASSWORD', 'Admin@2025!')
                admin_user = User(
                    email=admin_email,
                    name='Administrador',
                    is_admin=True
                )
                admin_user.set_password(admin_password)
                db.session.add(admin_user)
                db.session.commit()
                print(f"✅ Admin created: {admin_email}")
                app.logger.info(f'Admin user created: {admin_email}')
                
        except Exception as e:
            print(f"❌ Init error: {e}")
            app.logger.error(f'Initialization error: {e}')

    # ============================================================================
    # BACKUP AUTOMÁTICO (Desativado no Railway - usar cron jobs externos)
    # ============================================================================
    
    def backup_automatico_diario():
        """Backup automático - use Railway cron jobs em produção"""
        if os.environ.get('RAILWAY_ENVIRONMENT'):
            # No Railway, desativar threads de backup
            # Use Railway scheduled jobs ou external cron
            return
        
        while True:
            try:
                agora = time.localtime()
                if agora.tm_hour == 2 and agora.tm_min == 0:
                    resultado = backup_manager.criar_backup(motivo="automatico_diario")
                    if resultado['success']:
                        print(f"✅ Backup: {resultado['filename']}")
                        app.logger.info(f"Backup: {resultado['filename']}")
                    time.sleep(23 * 60 * 60)
                else:
                    time.sleep(60)
            except Exception as e:
                app.logger.error(f'Backup error: {e}')
                time.sleep(300)

    # Iniciar apenas em ambiente local
    if not os.environ.get('RAILWAY_ENVIRONMENT'):
        backup_thread = threading.Thread(target=backup_automatico_diario, daemon=True)
        backup_thread.start()
        print("✅ Backup automático ativado")

    # ============================================================================
    # NOTIFICAÇÕES AUTOMÁTICAS
    # ============================================================================

    def verificar_vencimentos_contratos():
        try:
            with app.app_context():
                cedentes = get_all_cedentes()
                hoje = datetime.now().date()
                
                for cedente in cedentes:
                    if cedente.get('validade_contrato'):
                        try:
                            data_vencimento = datetime.strptime(
                                cedente['validade_contrato'], '%Y-%m-%d'
                            ).date()
                            dias = (data_vencimento - hoje).days
                            
                            if dias in [30, 15, 7] or dias < 0:
                                tipo = 'vencimento_urgencia' if dias < 0 else 'vencimento'
                                criar_notificacao(
                                    cedente_id=cedente['id'],
                                    tipo=tipo,
                                    titulo=f'Contrato {"vencido" if dias < 0 else f"vence em {dias} dias"}',
                                    mensagem=f"{cedente['nome_razao_social']} - {cedente['validade_contrato']}",
                                    data_vencimento=cedente['validade_contrato']
                                )
                        except ValueError:
                            continue
        except Exception as e:
            app.logger.error(f'Verification error: {e}')

    def verificar_documentos_pendentes():
        try:
            with app.app_context():
                cedentes = get_all_cedentes()
                
                for cedente in cedentes:
                    if not verificar_documentos_completos(cedente['id']):
                        notificacoes = get_notificacoes_nao_lidas()
                        existe = any(
                            n['cedente_id'] == cedente['id'] and 
                            n['tipo'] == 'documentos_pendentes' 
                            for n in notificacoes
                        )
                        
                        if not existe:
                            criar_notificacao(
                                cedente_id=cedente['id'],
                                tipo='documentos_pendentes',
                                titulo='Documentos pendentes',
                                mensagem=f"{cedente['nome_razao_social']} - documentos incompletos"
                            )
        except Exception as e:
            app.logger.error(f'Document check error: {e}')

    def executar_verificacoes():
        while True:
            try:
                time.sleep(3600)
                verificar_vencimentos_contratos()
                verificar_documentos_pendentes()
            except Exception as e:
                app.logger.error(f'Verification loop error: {e}')
                time.sleep(300)

    # Iniciar apenas localmente (usar cron jobs no Railway)
    if not os.environ.get('RAILWAY_ENVIRONMENT'):
        verificacoes_thread = threading.Thread(target=executar_verificacoes, daemon=True)
        verificacoes_thread.start()
        print("✅ Verificações automáticas ativadas")

    # ============================================================================
    # ROTAS
    # ============================================================================

    @app.route('/')
    def index():
        if current_user.is_authenticated:
            return render_template('index.html', user=current_user)
        return redirect(url_for('auth.login'))

    @app.route('/dashboard')
    @login_required
    def dashboard():
        return render_template('index.html', user=current_user)

    # ============================================================================
    # API CEDENTES
    # ============================================================================

    @app.route('/api/cedentes', methods=['GET'])
    @login_required
    def get_cedentes():
        try:
            cedentes = get_all_cedentes()
            return jsonify(cedentes)
        except Exception as e:
            app.logger.error(f'Error fetching cedentes: {e}')
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/cedentes', methods=['POST'])
    @login_required
    def add_cedente_api():
        try:
            data = request.get_json()
            
            if not data or not all(k in data for k in ['nome', 'cpf_cnpj', 'contrato']):
                return jsonify({'success': False, 'message': 'Dados incompletos!'}), 400
            
            success = add_cedente(
                nome_razao_social=data['nome'],
                cpf_cnpj=data['cpf_cnpj'],
                contrato=data['contrato'],
                validade_contrato=data.get('validade_contrato')
            )
            
            if success:
                app.logger.info(f'Cedente added: {data["nome"]}')
                return jsonify({'success': True, 'message': 'Cedente adicionado!'})
            
            return jsonify({'success': False, 'message': 'Erro ao adicionar!'}), 500
            
        except Exception as e:
            app.logger.error(f'Error adding cedente: {e}')
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/cedentes/<int:cedente_id>', methods=['PUT'])
    @login_required
    def update_cedente_api(cedente_id):
        try:
            data = request.get_json()
            
            success = update_cedente(
                cedente_id=cedente_id,
                nome_razao_social=data['nome'],
                cpf_cnpj=data['cpf_cnpj'],
                contrato=data['contrato'],
                validade_contrato=data.get('validade_contrato')
            )
            
            if success:
                return jsonify({'success': True, 'message': 'Atualizado!'})
            
            return jsonify({'success': False, 'message': 'Não encontrado!'}), 404
            
        except Exception as e:
            app.logger.error(f'Error updating: {e}')
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/cedentes/<int:cedente_id>', methods=['DELETE'])
    @login_required
    def delete_cedente_api(cedente_id):
        try:
            success = delete_cedente(cedente_id)
            
            if success:
                return jsonify({'success': True, 'message': 'Excluído!'})
            
            return jsonify({'success': False, 'message': 'Não encontrado!'}), 404
            
        except Exception as e:
            app.logger.error(f'Error deleting: {e}')
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/importar-excel', methods=['POST'])
    @login_required
    @csrf.exempt
    def importar_excel():
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'Nenhum arquivo!'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'message': 'Arquivo vazio!'}), 400
        
        if file and file.filename.endswith(('.xlsx', '.xls')):
            try:
                resultado = importar_dados_excel(file)
                return jsonify(resultado)
            except Exception as e:
                app.logger.error(f'Import error: {e}')
                return jsonify({'success': False, 'message': str(e)}), 500
        
        return jsonify({'success': False, 'message': 'Formato inválido!'}), 400

    # APIs de Documentos
    @app.route('/api/cedentes/<int:cedente_id>/documentos', methods=['GET'])
    @login_required
    def get_documentos_api(cedente_id):
        try:
            documentos = get_documentos_cedente(cedente_id)
            if not documentos:
                documentos = {k: False for k in [
                    'contrato_social', 'cartao_cnpj', 'faturamento_12meses',
                    'dre_balanco', 'cnh_rg_socios', 'ir_socios',
                    'comprovante_endereco', 'email', 'curva_abc', 'dados_bancarios'
                ]}
            return jsonify(documentos)
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/cedentes/<int:cedente_id>/documentos', methods=['POST'])
    @login_required
    def salvar_documentos_api(cedente_id):
        try:
            data = request.get_json()
            success = salvar_documentos_cedente(cedente_id, data)
            
            if success:
                completos = verificar_documentos_completos(cedente_id)
                return jsonify({
                    'success': True,
                    'documentos_completos': completos
                })
            
            return jsonify({'success': False}), 500
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/cedentes/<int:cedente_id>/status-documentos', methods=['GET'])
    @login_required
    def get_status_documentos_api(cedente_id):
        try:
            completos = verificar_documentos_completos(cedente_id)
            return jsonify({'documentos_completos': completos})
        except Exception as e:
            return jsonify({'success': False}), 500

    # APIs de Notificações
    @app.route('/api/notificacoes', methods=['GET'])
    @login_required
    def get_notificacoes_api():
        try:
            notificacoes = get_notificacoes_nao_lidas()
            return jsonify(notificacoes)
        except Exception as e:
            return jsonify([])

    @app.route('/api/notificacoes/<int:notificacao_id>/marcar-lida', methods=['POST'])
    @login_required
    def marcar_notificacao_lida_api(notificacao_id):
        try:
            success = marcar_notificacao_como_lida(notificacao_id)
            return jsonify({'success': success})
        except Exception as e:
            return jsonify({'success': False}), 500

    @app.route('/api/notificacoes/marcar-todas-lidas', methods=['POST'])
    @login_required
    def marcar_todas_lidas_api():
        try:
            success = marcar_todas_notificacoes_como_lidas()
            return jsonify({'success': success})
        except Exception as e:
            return jsonify({'success': False}), 500

    @app.route('/api/notificacoes/executar-verificacao-manual', methods=['POST'])
    @login_required
    def executar_verificacao_manual_api():
        try:
            verificar_vencimentos_contratos()
            verificar_documentos_pendentes()
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False}), 500

    # APIs de Backup
    @app.route('/api/backup/criar', methods=['POST'])
    @login_required
    def criar_backup_api():
        try:
            data = request.get_json()
            motivo = data.get('motivo', 'manual')
            resultado = backup_manager.criar_backup(motivo=motivo)
            return jsonify(resultado)
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/backup/listar', methods=['GET'])
    @login_required
    def listar_backups_api():
        try:
            backups = backup_manager.listar_backups()
            return jsonify({'success': True, 'backups': backups})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/backup/restaurar', methods=['POST'])
    @login_required
    def restaurar_backup_api():
        try:
            data = request.get_json()
            filename = data.get('filename')
            resultado = backup_manager.restaurar_backup(filename)
            return jsonify(resultado)
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/backup/estatisticas', methods=['GET'])
    @login_required
    def estatisticas_backup_api():
        try:
            stats = backup_manager.obter_estatisticas_backup()
            return jsonify({'success': True, 'estatisticas': stats})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    return app

# Criar app
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Servidor na porta {port}")
    app.run(host='0.0.0.0', port=port, debug=False)