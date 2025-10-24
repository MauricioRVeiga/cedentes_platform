from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from flask_login import LoginManager, current_user, login_required
from database import db, User, init_db, get_all_cedentes, add_cedente, update_cedente, delete_cedente
from database import get_documentos_cedente, salvar_documentos_cedente, verificar_documentos_completos
from database import criar_notificacao, get_notificacoes_nao_lidas, marcar_notificacao_como_lida
from database import marcar_todas_notificacoes_como_lidas, get_total_notificacoes_nao_lidas
from auth import auth
from import_excel import importar_dados_excel
from backup_manager import backup_manager
import threading
import time
import os
from datetime import datetime, timedelta
from sqlalchemy import text

def create_app():
    app = Flask(__name__)
    
    # CONFIGURAÇÃO DEFINITIVA - USAR SQLITE TEMPORARIAMENTE
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-please-change-in-production')
    
    # FORÇAR USO DO SQLITE - IGNORAR POSTGRESQL POR ENQUANTO
    db_path = os.environ.get('CEDENTES_DB_PATH', '/tmp/cedentes.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    print("🚀 INICIANDO COM SQLITE (POSTGRESQL DESATIVADO TEMPORARIAMENTE)")
    print(f"📁 Caminho do banco: {db_path}")
    
    # Inicializar extensões
    db.init_app(app)
    
    # Configurar Flask-Login
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
    
    # HEALTH CHECK SIMPLES
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'running', 
            'database': 'sqlite',
            'timestamp': datetime.now().isoformat()
        })
    
    # Inicializar banco de dados
    with app.app_context():
        try:
            # Criar tabelas do SQLAlchemy (autenticação)
            db.create_all()
            print("✅ Tabelas de autenticação criadas com sucesso!")
            
            # Inicializar banco SQLite
            init_db()
            print("✅ Banco SQLite inicializado")
            
            # Criar usuário admin padrão se não existir
            admin_user = User.query.filter_by(email='admin@goldcreditsa.com.br').first()
            if not admin_user:
                admin_user = User(
                    email='admin@goldcreditsa.com.br',
                    name='Administrador'
                )
                admin_user.set_password(os.environ.get('ADMIN_PASSWORD', 'Master@key2025@'))
                db.session.add(admin_user)
                db.session.commit()
                print("✅ Usuário admin criado: admin@goldcreditsa.com.br")
                print("🔑 Credenciais: admin@goldcreditsa.com.br / Master@key2025@")
                
        except Exception as e:
            print(f"❌ Erro durante inicialização: {e}")

    # =============================================================================
    # SISTEMA DE BACKUP AUTOMÁTICO
    # =============================================================================

    def backup_automatico_diario():
        """Função para backup automático diário"""
        while True:
            try:
                # Esperar até 2:00 AM
                agora = time.localtime()
                if agora.tm_hour == 2 and agora.tm_min == 0:
                    resultado = backup_manager.criar_backup(motivo="automatico_diario")
                    if resultado['success']:
                        print(f"✅ Backup automático realizado: {resultado['filename']}")
                    else:
                        print(f"❌ Falha no backup automático: {resultado['message']}")
                    
                    # Esperar 23 horas para próximo backup
                    time.sleep(23 * 60 * 60)
                else:
                    # Verificar a cada minuto
                    time.sleep(60)
                    
            except Exception as e:
                print(f"Erro no backup automático: {e}")
                time.sleep(300)

    # Iniciar thread de backup automático em background
    backup_thread = threading.Thread(target=backup_automatico_diario, daemon=True)
    backup_thread.start()
    print("✅ Sistema de backup automático ativado")

    # =============================================================================
    # SISTEMA DE VERIFICAÇÃO AUTOMÁTICA DE NOTIFICAÇÕES
    # =============================================================================

    def verificar_vencimentos_contratos():
        """Verifica contratos próximos do vencimento e cria notificações"""
        try:
            cedentes = get_all_cedentes()
            hoje = datetime.now().date()
            notificacoes_criadas = 0
            
            for cedente in cedentes:
                if cedente.get('validade_contrato'):
                    try:
                        data_vencimento = datetime.strptime(cedente['validade_contrato'], '%Y-%m-%d').date()
                        dias_para_vencer = (data_vencimento - hoje).days
                        
                        if dias_para_vencer == 30:
                            criar_notificacao(
                                cedente_id=cedente['id'],
                                tipo='vencimento',
                                titulo='Contrato próximo do vencimento - 30 dias',
                                mensagem=f"O contrato de {cedente['nome_razao_social']} vence em 30 dias ({cedente['validade_contrato']})",
                                data_vencimento=cedente['validade_contrato']
                            )
                            notificacoes_criadas += 1
                        
                        elif dias_para_vencer == 15:
                            criar_notificacao(
                                cedente_id=cedente['id'],
                                tipo='vencimento',
                                titulo='Contrato próximo do vencimento - 15 dias',
                                mensagem=f"O contrato de {cedente['nome_razao_social']} vence em 15 dias ({cedente['validade_contrato']})",
                                data_vencimento=cedente['validade_contrato']
                            )
                            notificacoes_criadas += 1
                        
                        elif dias_para_vencer == 7:
                            criar_notificacao(
                                cedente_id=cedente['id'],
                                tipo='vencimento_urgente',
                                titulo='Contrato próximo do vencimento - 7 dias',
                                mensagem=f"⚠️ URGENTE: O contrato de {cedente['nome_razao_social']} vence em 7 dias ({cedente['validade_contrato']})",
                                data_vencimento=cedente['validade_contrato']
                            )
                            notificacoes_criadas += 1
                        
                        elif dias_para_vencer < 0:
                            criar_notificacao(
                                cedente_id=cedente['id'],
                                tipo='vencimento_urgencia',
                                titulo='CONTRATO VENCIDO',
                                mensagem=f"🚨 CONTRATO VENCIDO: {cedente['nome_razao_social']} - Venceu em {cedente['validade_contrato']}",
                                data_vencimento=cedente['validade_contrato']
                            )
                            notificacoes_criadas += 1
                            
                    except ValueError as e:
                        continue
            
            if notificacoes_criadas > 0:
                print(f"✅ {notificacoes_criadas} notificações de vencimento criadas")
                
        except Exception as e:
            print(f"❌ Erro na verificação de vencimentos: {e}")

    def verificar_documentos_pendentes():
        """Verifica cedentes com documentos incompletos e cria notificações"""
        try:
            cedentes = get_all_cedentes()
            notificacoes_criadas = 0
            
            for cedente in cedentes:
                documentos_completos = verificar_documentos_completos(cedente['id'])
                
                if not documentos_completos:
                    notificacoes_existentes = get_notificacoes_nao_lidas()
                    
                    notificacao_existente = any(
                        n['cedente_id'] == cedente['id'] and n['tipo'] == 'documentos_pendentes' 
                        for n in notificacoes_existentes
                    )
                    
                    if not notificacao_existente:
                        criar_notificacao(
                            cedente_id=cedente['id'],
                            tipo='documentos_pendentes',
                            titulo='Documentos pendentes',
                            mensagem=f"{cedente['nome_razao_social']} possui documentos incompletos que precisam ser regularizados"
                        )
                        notificacoes_criadas += 1
            
            if notificacoes_criadas > 0:
                print(f"✅ {notificacoes_criadas} notificações de documentos pendentes criadas")
                
        except Exception as e:
            print(f"❌ Erro na verificação de documentos pendentes: {e}")

    def executar_verificacoes_automaticas():
        """Executa verificações automáticas em intervalos regulares"""
        while True:
            try:
                time.sleep(3600)
                print("🔍 Executando verificações automáticas...")
                verificar_vencimentos_contratos()
                verificar_documentos_pendentes()
                print("✅ Verificações automáticas concluídas")
                
            except Exception as e:
                print(f"❌ Erro nas verificações automáticas: {e}")
                time.sleep(300)

    # Iniciar thread de verificações automáticas em background
    verificacoes_thread = threading.Thread(target=executar_verificacoes_automaticas, daemon=True)
    verificacoes_thread.start()
    print("✅ Sistema de verificações automáticas ativado")

    # =============================================================================
    # ROTAS PRINCIPAIS
    # =============================================================================

    @app.route('/')
    def index():
        if current_user.is_authenticated:
            return render_template('index.html', user=current_user)
        else:
            return redirect(url_for('auth.login'))

    @app.route('/dashboard')
    @login_required
    def dashboard():
        return render_template('index.html', user=current_user)

    # =============================================================================
    # APIs PARA CEDENTES
    # =============================================================================

    @app.route('/api/cedentes', methods=['GET'])
    @login_required
    def get_cedentes():
        try:
            cedentes = get_all_cedentes()
            return jsonify(cedentes)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro ao buscar cedentes: {str(e)}'}), 500

    @app.route('/api/cedentes', methods=['POST'])
    @login_required
    def add_cedente_api():
        try:
            data = request.get_json()
            
            if not data or 'nome' not in data or 'cpf_cnpj' not in data or 'contrato' not in data:
                return jsonify({'success': False, 'message': 'Dados incompletos!'}), 400
            
            success = add_cedente(
                nome_razao_social=data['nome'],
                cpf_cnpj=data['cpf_cnpj'],
                contrato=data['contrato'],
                validade_contrato=data.get('validade_contrato')
            )
            
            if success:
                return jsonify({'success': True, 'message': 'Cedente adicionado com sucesso!'})
            else:
                return jsonify({'success': False, 'message': 'Erro ao adicionar cedente!'}), 500
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/cedentes/<int:cedente_id>', methods=['PUT'])
    @login_required
    def update_cedente_api(cedente_id):
        try:
            data = request.get_json()
            
            if not data or 'nome' not in data or 'cpf_cnpj' not in data or 'contrato' not in data:
                return jsonify({'success': False, 'message': 'Dados incompletos!'}), 400
            
            success = update_cedente(
                cedente_id=cedente_id,
                nome_razao_social=data['nome'],
                cpf_cnpj=data['cpf_cnpj'],
                contrato=data['contrato'],
                validade_contrato=data.get('validade_contrato')
            )
            
            if success:
                return jsonify({'success': True, 'message': 'Cedente atualizado com sucesso!'})
            else:
                return jsonify({'success': False, 'message': 'Cedente não encontrado!'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/cedentes/<int:cedente_id>', methods=['DELETE'])
    @login_required
    def delete_cedente_api(cedente_id):
        try:
            success = delete_cedente(cedente_id)
            
            if success:
                return jsonify({'success': True, 'message': 'Cedente excluído com sucesso!'})
            else:
                return jsonify({'success': False, 'message': 'Cedente não encontrado!'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/importar-excel', methods=['POST'])
    @login_required
    def importar_excel():
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'Nenhum arquivo enviado!'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'Nenhum arquivo selecionado!'}), 400
        
        if file and (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            try:
                resultado = importar_dados_excel(file)
                return jsonify(resultado)
            except Exception as e:
                return jsonify({'success': False, 'message': f'Erro ao importar: {str(e)}'}), 500
        
        return jsonify({'success': False, 'message': 'Formato inválido! Use .xlsx ou .xls'}), 400

    # ... (mantenha todas as outras rotas do seu app original) ...

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    print(f"🚀 Servidor iniciado com sucesso na porta {port}")
    print(f"🔗 Acesse: http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)