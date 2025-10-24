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

def create_app():
    app = Flask(__name__)
    
    # Configurações para Railway (OTIMIZADAS)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-please-change-in-production')
    
    # Configuração do banco de dados para Railway
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cedentes.db'
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_recycle': 300,
        'pool_pre_ping': True
    }
    
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
    
    # Inicializar banco de dados
    with app.app_context():
        # Criar tabelas do SQLAlchemy (autenticação)
        db.create_all()
        
        # Inicializar banco SQLite original (apenas se não for PostgreSQL)
        if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']:
            init_db()
        
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

    # =============================================================================
    # SISTEMA DE BACKUP AUTOMÁTICO (APENAS PARA SQLITE)
    # =============================================================================

    def backup_automatico_diario():
        """Função para backup automático diário - apenas para SQLite"""
        # Verificar se estamos usando SQLite
        if 'sqlite' not in app.config['SQLALCHEMY_DATABASE_URI']:
            print("⚠️ Backup automático desativado - usando PostgreSQL")
            return
            
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
                time.sleep(300)  # Esperar 5 minutos em caso de erro

    # Iniciar thread de backup automático em background (apenas SQLite)
    if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']:
        backup_thread = threading.Thread(target=backup_automatico_diario, daemon=True)
        backup_thread.start()

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
                        
                        # Notificar conforme a proximidade do vencimento
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
                        print(f"Erro ao processar data do cedente {cedente['id']}: {e}")
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
                    # Verificar se já existe notificação recente para este cedente
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
                # Executar a cada hora
                time.sleep(3600)  # 1 hora
                
                print("🔍 Executando verificações automáticas...")
                verificar_vencimentos_contratos()
                verificar_documentos_pendentes()
                print("✅ Verificações automáticas concluídas")
                
            except Exception as e:
                print(f"❌ Erro nas verificações automáticas: {e}")
                time.sleep(300)  # Esperar 5 minutos em caso de erro

    # Iniciar thread de verificações automáticas em background
    verificacoes_thread = threading.Thread(target=executar_verificacoes_automaticas, daemon=True)
    verificacoes_thread.start()

    # =============================================================================
    # ROTAS PRINCIPAIS (PROTEGIDAS)
    # =============================================================================

    @app.route('/')
    def index():
        """Página inicial - Redireciona para login se não autenticado"""
        if current_user.is_authenticated:
            return render_template('index.html', user=current_user)
        else:
            return redirect(url_for('auth.login'))

    @app.route('/dashboard')
    @login_required
    def dashboard():
        """Dashboard protegido"""
        return render_template('index.html', user=current_user)

    # =============================================================================
    # APIs PARA CEDENTES (PROTEGIDAS)
    # =============================================================================

    @app.route('/api/cedentes', methods=['GET'])
    @login_required
    def get_cedentes():
        """API para buscar todos os cedentes ORDENADOS POR NOME"""
        try:
            cedentes = get_all_cedentes()
            return jsonify(cedentes)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro ao buscar cedentes: {str(e)}'}), 500

    @app.route('/api/cedentes', methods=['POST'])
    @login_required
    def add_cedente_api():
        """API para adicionar novo cedente"""
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
        """API para atualizar cedente existente"""
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
        """API para excluir cedente"""
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
        """API para importar dados do Excel"""
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

    @app.route('/api/cedentes/<int:cedente_id>/documentos', methods=['GET'])
    @login_required
    def get_documentos_cedente_api(cedente_id):
        """API para buscar documentos de um cedente"""
        try:
            documentos = get_documentos_cedente(cedente_id)
            return jsonify(documentos or {})
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro ao buscar documentos: {str(e)}'}), 500

    @app.route('/api/cedentes/<int:cedente_id>/documentos', methods=['POST'])
    @login_required
    def salvar_documentos_cedente_api(cedente_id):
        """API para salvar documentos de um cedente"""
        try:
            data = request.get_json()
            success = salvar_documentos_cedente(cedente_id, data)
            
            if success:
                documentos_completos = verificar_documentos_completos(cedente_id)
                return jsonify({
                    'success': True,
                    'message': 'Documentos salvos com sucesso!',
                    'documentos_completos': documentos_completos
                })
            else:
                return jsonify({'success': False, 'message': 'Erro ao salvar documentos!'}), 500
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/cedentes/<int:cedente_id>/status-documentos', methods=['GET'])
    @login_required
    def get_status_documentos_api(cedente_id):
        """API para verificar status dos documentos"""
        try:
            documentos_completos = verificar_documentos_completos(cedente_id)
            return jsonify({'documentos_completos': documentos_completos})
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro ao verificar documentos: {str(e)}'}), 500

    # =============================================================================
    # ROTAS DE BACKUP (PROTEGIDAS) - APENAS PARA SQLITE
    # =============================================================================

    @app.route('/api/backup/criar', methods=['POST'])
    @login_required
    def criar_backup():
        """API para criar backup manual"""
        try:
            # Verificar se estamos usando SQLite
            if 'sqlite' not in app.config['SQLALCHEMY_DATABASE_URI']:
                return jsonify({
                    'success': False, 
                    'message': 'Backup manual não disponível para PostgreSQL. Use o sistema de backup do Railway.'
                }), 400
            
            data = request.get_json() or {}
            motivo = data.get('motivo', 'manual')
            
            resultado = backup_manager.criar_backup(motivo=motivo)
            return jsonify(resultado)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/backup/listar', methods=['GET'])
    @login_required
    def listar_backups():
        """API para listar todos os backups"""
        try:
            # Verificar se estamos usando SQLite
            if 'sqlite' not in app.config['SQLALCHEMY_DATABASE_URI']:
                return jsonify({
                    'success': True,
                    'backups': [],
                    'estatisticas': {'total_backups': 0},
                    'message': 'Usando PostgreSQL - backup gerenciado pela Railway'
                })
            
            backups = backup_manager.listar_backups()
            estatisticas = backup_manager.obter_estatisticas_backup()
            
            return jsonify({
                'success': True,
                'backups': backups,
                'estatisticas': estatisticas
            })
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/backup/restaurar', methods=['POST'])
    @login_required
    def restaurar_backup():
        """API para restaurar backup"""
        try:
            # Verificar se estamos usando SQLite
            if 'sqlite' not in app.config['SQLALCHEMY_DATABASE_URI']:
                return jsonify({
                    'success': False, 
                    'message': 'Restauração manual não disponível para PostgreSQL.'
                }), 400
            
            data = request.get_json()
            if not data or 'filename' not in data:
                return jsonify({'success': False, 'message': 'Nome do arquivo de backup não especificado!'}), 400
            
            resultado = backup_manager.restaurar_backup(data['filename'])
            return jsonify(resultado)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/backup/estatisticas', methods=['GET'])
    @login_required
    def obter_estatisticas_backup():
        """API para obter estatísticas de backup"""
        try:
            # Verificar se estamos usando SQLite
            if 'sqlite' not in app.config['SQLALCHEMY_DATABASE_URI']:
                return jsonify({
                    'success': True, 
                    'estatisticas': {
                        'total_backups': 0,
                        'tamanho_total': '0 MB',
                        'ultimo_backup': None,
                        'message': 'Usando PostgreSQL - backup gerenciado pela Railway'
                    }
                })
            
            estatisticas = backup_manager.obter_estatisticas_backup()
            return jsonify({'success': True, 'estatisticas': estatisticas})
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    # =============================================================================
    # ROTAS PARA NOTIFICAÇÕES (PROTEGIDAS)
    # =============================================================================

    @app.route('/api/notificacoes', methods=['GET'])
    @login_required
    def get_notificacoes():
        """API para buscar notificações não lidas"""
        try:
            notificacoes = get_notificacoes_nao_lidas()
            return jsonify(notificacoes)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro ao buscar notificações: {str(e)}'}), 500

    @app.route('/api/notificacoes/<int:notificacao_id>/marcar-lida', methods=['POST'])
    @login_required
    def marcar_notificacao_lida_api(notificacao_id):
        """API para marcar notificação como lida"""
        try:
            success = marcar_notificacao_como_lida(notificacao_id)
            
            if success:
                return jsonify({'success': True, 'message': 'Notificação marcada como lida!'})
            else:
                return jsonify({'success': False, 'message': 'Erro ao marcar notificação!'}), 500
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/notificacoes/marcar-todas-lidas', methods=['POST'])
    @login_required
    def marcar_todas_notificacoes_lidas_api():
        """API para marcar todas as notificações como lidas"""
        try:
            success = marcar_todas_notificacoes_como_lidas()
            
            if success:
                return jsonify({'success': True, 'message': 'Todas notificações marcadas como lidas!'})
            else:
                return jsonify({'success': False, 'message': 'Erro ao marcar notificações!'}), 500
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/notificacoes/total', methods=['GET'])
    @login_required
    def get_total_notificacoes_api():
        """API para obter o total de notificações não lidas"""
        try:
            total = get_total_notificacoes_nao_lidas()
            return jsonify({'success': True, 'total': total})
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

    @app.route('/api/notificacoes/executar-verificacao-manual', methods=['POST'])
    @login_required
    def executar_verificacao_manual():
        """API para executar verificação manual de notificações"""
        try:
            print("🔍 Executando verificação manual de notificações...")
            verificar_vencimentos_contratos()
            verificar_documentos_pendentes()
            print("✅ Verificação manual concluída")
            
            return jsonify({'success': True, 'message': 'Verificação manual executada com sucesso!'})
        except Exception as e:
            return jsonify({'success': False, 'message': f'Erro na verificação manual: {str(e)}'}), 500

    # =============================================================================
    # NOVAS ROTAS PARA EXPORTAÇÃO (PROTEGIDAS)
    # =============================================================================

    @app.route('/api/exportar/excel', methods=['POST'])
    @login_required
    def exportar_excel():
        """API para exportar dados para Excel"""
        try:
            from database import get_all_cedentes
            import pandas as pd
            from io import BytesIO
            from datetime import datetime
            
            cedentes = get_all_cedentes()
            
            df_data = []
            for cedente in cedentes:
                df_data.append({
                    'ID': cedente['id'],
                    'Nome/Razão Social': cedente['nome_razao_social'],
                    'CPF/CNPJ': cedente['cpf_cnpj'],
                    'Status Contrato': cedente['contrato'],
                    'Validade Contrato': cedente['validade_contrato'],
                    'Data Criação': cedente['data_criacao'],
                    'Data Atualização': cedente['data_atualizacao']
                })
            
            df = pd.DataFrame(df_data)
            
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Cedentes', index=False)
                
                stats_data = {
                    'Estatística': [
                        'Total de Cedentes',
                        'Contratos Assinados Manualmente',
                        'Contratos sem Assinatura',
                        'Precisam Renovar',
                        'Pontos de Atenção'
                    ],
                    'Quantidade': [
                        len(cedentes),
                        len([c for c in cedentes if c['contrato'] == 'assinado_manual']),
                        len([c for c in cedentes if c['contrato'] == 'sem_assinatura']),
                        len([c for c in cedentes if c['contrato'] == 'precisa_renovar']),
                        len([c for c in cedentes if c['contrato'] == 'pontos_atencao'])
                    ]
                }
                stats_df = pd.DataFrame(stats_data)
                stats_df.to_excel(writer, sheet_name='Estatísticas', index=False)
                
                for sheet_name in writer.sheets:
                    worksheet = writer.sheets[sheet_name]
                    for column in worksheet.columns:
                        max_length = 0
                        column_letter = column[0].column_letter
                        for cell in column:
                            try:
                                if len(str(cell.value)) > max_length:
                                    max_length = len(str(cell.value))
                            except:
                                pass
                        adjusted_width = (max_length + 2)
                        worksheet.column_dimensions[column_letter].width = adjusted_width
            
            output.seek(0)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cedentes_export_{timestamp}.xlsx"
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=filename
            )
            
        except Exception as e:
            print(f"❌ Erro ao exportar Excel: {e}")
            return jsonify({'success': False, 'message': f'Erro ao exportar: {str(e)}'}), 500

    @app.route('/api/exportar/excel-filtrado', methods=['POST'])
    @login_required
    def exportar_excel_filtrado():
        """API para exportar dados filtrados para Excel"""
        try:
            import pandas as pd
            from io import BytesIO
            from datetime import datetime
            
            data = request.get_json()
            cedentes_filtrados = data.get('cedentes', [])
            
            if not cedentes_filtrados:
                return jsonify({'success': False, 'message': 'Nenhum dado para exportar!'}), 400
            
            df_data = []
            for cedente in cedentes_filtrados:
                df_data.append({
                    'ID': cedente.get('id', ''),
                    'Nome/Razão Social': cedente.get('nome_razao_social', ''),
                    'CPF/CNPJ': cedente.get('cpf_cnpj', ''),
                    'Status Contrato': cedente.get('contrato', ''),
                    'Validade Contrato': cedente.get('validade_contrato', ''),
                    'Documentos Completos': 'Sim' if cedente.get('documentos_completos') else 'Não'
                })
            
            df = pd.DataFrame(df_data)
            
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Cedentes Filtrados', index=False)
                
                worksheet = writer.sheets['Cedentes Filtrados']
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = (max_length + 2)
                    worksheet.column_dimensions[column_letter].width = adjusted_width
            
            output.seek(0)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cedentes_filtrados_{timestamp}.xlsx"
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=filename
            )
            
        except Exception as e:
            print(f"❌ Erro ao exportar Excel filtrado: {e}")
            return jsonify({'success': False, 'message': f'Erro ao exportar: {str(e)}'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)