from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from database import db, User
from datetime import datetime
import logging

# Criar Blueprint para autenticação
auth = Blueprint('auth', __name__, url_prefix='/auth')

# Logger
logger = logging.getLogger(__name__)

# =============================================================================
# LOGIN
# =============================================================================

@auth.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login - entrada principal do sistema"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        
        # Validações
        if not email:
            flash('Por favor, informe o email.', 'error')
            return render_template('auth/login.html')
        
        if not User.validate_email_domain(email):
            flash('Apenas emails do domínio @goldcreditsa.com.br são permitidos.', 'error')
            return render_template('auth/login.html')
        
        if not password:
            flash('Por favor, informe a senha.', 'error')
            return render_template('auth/login.html')
        
        # Buscar usuário
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            if not user.is_active:
                flash('Sua conta está desativada. Contate o administrador.', 'error')
                return render_template('auth/login.html')
            
            # Fazer login
            login_user(user, remember=True)
            user.update_last_login()
            
            flash(f'Bem-vindo(a), {user.name}!', 'success')
            logger.info(f'User logged in: {user.email}')
            
            # Redirecionar para página solicitada ou dashboard
            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('dashboard'))
        else:
            flash('Email ou senha inválidos.', 'error')
            logger.warning(f'Failed login attempt for: {email}')
    
    return render_template('auth/login.html')

# =============================================================================
# REGISTRO
# =============================================================================

@auth.route('/register', methods=['GET', 'POST'])
def register():
    """Página de cadastro - apenas domínio @goldcreditsa.com.br"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        name = request.form.get('name', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Validações
        if not all([email, name, password, confirm_password]):
            flash('Todos os campos são obrigatórios.', 'error')
            return render_template('auth/register.html')
        
        if password != confirm_password:
            flash('As senhas não coincidem.', 'error')
            return render_template('auth/register.html')
        
        if len(password) < 6:
            flash('A senha deve ter pelo menos 6 caracteres.', 'error')
            return render_template('auth/register.html')
        
        if not User.validate_email_domain(email):
            flash('Apenas emails do domínio @goldcreditsa.com.br são permitidos.', 'error')
            return render_template('auth/register.html')
        
        # Verificar se usuário já existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Este email já está cadastrado.', 'error')
            return render_template('auth/register.html')
        
        # Criar novo usuário
        try:
            new_user = User(
                email=email,
                name=name,
                is_admin=False  # Novos usuários não são admin por padrão
            )
            new_user.set_password(password)
            
            db.session.add(new_user)
            db.session.commit()
            
            flash(f'Usuário {name} cadastrado com sucesso! Faça login para continuar.', 'success')
            logger.info(f'New user registered: {email}')
            
            return redirect(url_for('auth.login'))
            
        except Exception as e:
            db.session.rollback()
            flash('Erro ao cadastrar usuário. Tente novamente.', 'error')
            logger.error(f'Error registering user: {e}')
    
    return render_template('auth/register.html')

# =============================================================================
# LOGOUT
# =============================================================================

@auth.route('/logout')
@login_required
def logout():
    """Fazer logout do usuário"""
    logger.info(f'User logged out: {current_user.email}')
    logout_user()
    flash('Você foi desconectado com sucesso.', 'success')
    return redirect(url_for('auth.login'))

# =============================================================================
# GERENCIAMENTO DE USUÁRIOS (ADMIN APENAS)
# =============================================================================

@auth.route('/manage-users')
@login_required
def manage_users():
    """Página de gerenciamento de usuários (apenas admin)"""
    if not current_user.is_admin:
        flash('Acesso negado. Apenas administradores podem gerenciar usuários.', 'error')
        return redirect(url_for('dashboard'))
    
    users = User.query.filter(User.id != current_user.id).order_by(User.name).all()
    return render_template('auth/manage_users.html', users=users)

@auth.route('/delete-user/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    """Excluir usuário (apenas admin)"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Acesso negado.'}), 403
    
    if current_user.id == user_id:
        return jsonify({'success': False, 'message': 'Não é possível excluir sua própria conta.'}), 400
    
    user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado.'}), 404
    
    try:
        db.session.delete(user)
        db.session.commit()
        logger.info(f'User deleted: {user.email} by {current_user.email}')
        return jsonify({'success': True, 'message': 'Usuário excluído com sucesso!'})
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error deleting user: {e}')
        return jsonify({'success': False, 'message': 'Erro ao excluir usuário.'}), 500

@auth.route('/toggle-admin/<int:user_id>', methods=['POST'])
@login_required
def toggle_admin(user_id):
    """Alternar status de admin de um usuário (apenas admin)"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Acesso negado.'}), 403
    
    if current_user.id == user_id:
        return jsonify({'success': False, 'message': 'Não é possível alterar seu próprio status.'}), 400
    
    user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado.'}), 404
    
    try:
        user.is_admin = not user.is_admin
        db.session.commit()
        
        status = 'administrador' if user.is_admin else 'usuário padrão'
        logger.info(f'User {user.email} set as {status} by {current_user.email}')
        
        return jsonify({
            'success': True, 
            'message': f'Usuário agora é {status}.',
            'is_admin': user.is_admin
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error toggling admin: {e}')
        return jsonify({'success': False, 'message': 'Erro ao atualizar usuário.'}), 500

@auth.route('/toggle-active/<int:user_id>', methods=['POST'])
@login_required
def toggle_active(user_id):
    """Ativar/desativar conta de usuário (apenas admin)"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Acesso negado.'}), 403
    
    if current_user.id == user_id:
        return jsonify({'success': False, 'message': 'Não é possível desativar sua própria conta.'}), 400
    
    user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado.'}), 404
    
    try:
        user.is_active = not user.is_active
        db.session.commit()
        
        status = 'ativada' if user.is_active else 'desativada'
        logger.info(f'User {user.email} account {status} by {current_user.email}')
        
        return jsonify({
            'success': True, 
            'message': f'Conta {status} com sucesso.',
            'is_active': user.is_active
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error toggling active: {e}')
        return jsonify({'success': False, 'message': 'Erro ao atualizar usuário.'}), 500

# =============================================================================
# PERFIL DO USUÁRIO
# =============================================================================

@auth.route('/profile')
@login_required
def profile():
    """Página de perfil do usuário"""
    return render_template('auth/profile.html')

@auth.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
    """Atualizar dados do perfil"""
    try:
        name = request.form.get('name', '').strip()
        
        if not name:
            flash('O nome não pode estar vazio.', 'error')
            return redirect(url_for('auth.profile'))
        
        current_user.name = name
        db.session.commit()
        
        flash('Perfil atualizado com sucesso!', 'success')
        logger.info(f'Profile updated: {current_user.email}')
        
        return redirect(url_for('auth.profile'))
    except Exception as e:
        db.session.rollback()
        flash('Erro ao atualizar perfil.', 'error')
        logger.error(f'Error updating profile: {e}')
        return redirect(url_for('auth.profile'))

@auth.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Alterar senha do usuário"""
    try:
        current_password = request.form.get('current_password', '')
        new_password = request.form.get('new_password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Validações
        if not all([current_password, new_password, confirm_password]):
            flash('Todos os campos são obrigatórios.', 'error')
            return redirect(url_for('auth.profile'))
        
        if not current_user.check_password(current_password):
            flash('Senha atual incorreta.', 'error')
            return redirect(url_for('auth.profile'))
        
        if new_password != confirm_password:
            flash('A nova senha e a confirmação não coincidem.', 'error')
            return redirect(url_for('auth.profile'))
        
        if len(new_password) < 6:
            flash('A nova senha deve ter pelo menos 6 caracteres.', 'error')
            return redirect(url_for('auth.profile'))
        
        # Atualizar senha
        current_user.set_password(new_password)
        db.session.commit()
        
        flash('Senha alterada com sucesso!', 'success')
        logger.info(f'Password changed: {current_user.email}')
        
        return redirect(url_for('auth.profile'))
        
    except Exception as e:
        db.session.rollback()
        flash('Erro ao alterar senha.', 'error')
        logger.error(f'Error changing password: {e}')
        return redirect(url_for('auth.profile'))

# =============================================================================
# RECUPERAÇÃO DE SENHA
# =============================================================================

@auth.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    """Página de recuperação de senha"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        
        if not email:
            flash('Por favor, informe o email.', 'error')
            return render_template('auth/forgot_password.html')
        
        if not User.validate_email_domain(email):
            flash('Email inválido.', 'error')
            return render_template('auth/forgot_password.html')
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Aqui você implementaria o envio de email
            # Por enquanto, vamos apenas gerar um token temporário
            from secrets import token_urlsafe
            reset_token = token_urlsafe(32)
            
            # Em produção, salve o token no banco com expiração
            # e envie por email
            
            flash(
                'Se o email existe em nossa base, você receberá instruções para redefinir sua senha. '
                'Por favor, contate o administrador para resetar sua senha.',
                'success'
            )
            logger.info(f'Password reset requested for: {email}')
        else:
            # Não revele se o email existe ou não (segurança)
            flash(
                'Se o email existe em nossa base, você receberá instruções para redefinir sua senha. '
                'Por favor, contate o administrador para resetar sua senha.',
                'success'
            )
        
        return redirect(url_for('auth.login'))
    
    return render_template('auth/forgot_password.html')

@auth.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    """Página de redefinição de senha com token"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    # Aqui você validaria o token
    # Por enquanto, é um placeholder
    
    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        if not password or not confirm_password:
            flash('Todos os campos são obrigatórios.', 'error')
            return render_template('auth/reset_password.html', token=token)
        
        if password != confirm_password:
            flash('As senhas não coincidem.', 'error')
            return render_template('auth/reset_password.html', token=token)
        
        if len(password) < 6:
            flash('A senha deve ter pelo menos 6 caracteres.', 'error')
            return render_template('auth/reset_password.html', token=token)
        
        # Validar token e atualizar senha
        # Por enquanto, apenas redireciona
        flash('Senha redefinida com sucesso! Faça login com sua nova senha.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('auth/reset_password.html', token=token)