from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from database import db, User

# Criar o Blueprint para autenticação
auth = Blueprint('auth', __name__)


@auth.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login - agora é a página inicial"""
    # Se o usuário já estiver logado, redireciona para o dashboard
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Validar se o email foi preenchido
        if not email:
            flash('Por favor, informe o email.', 'error')
            return render_template('auth/login.html')
        
        # Validar domínio do email
        if not User.validate_email_domain(email):
            flash('Apenas emails do domínio @goldcreditsa.com.br são permitidos.', 'error')
            return render_template('auth/login.html')
        
        # Validar se a senha foi preenchida
        if not password:
            flash('Por favor, informe a senha.', 'error')
            return render_template('auth/login.html')
        
        # Buscar usuário no banco de dados
        user = User.query.filter_by(email=email).first()
        
        # Verificar se o usuário existe e a senha está correta
        if user and user.check_password(password):
            # Fazer login do usuário
            login_user(user)
            
            # Mensagem de sucesso
            flash(f'Bem-vindo(a), {user.name}!', 'success')
            
            # Redirecionar para o dashboard
            return redirect(url_for('dashboard'))
        else:
            flash('Email ou senha inválidos.', 'error')
    
    return render_template('auth/login.html')


@auth.route('/register', methods=['GET', 'POST'])
def register():
    """Página de cadastro público - apenas para domínio @goldcreditsa.com.br"""
    # Se o usuário já estiver logado, redireciona para o dashboard
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        name = request.form.get('name')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
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
        
        # Validar domínio do email
        if not User.validate_email_domain(email):
            flash('Apenas emails do domínio @goldcreditsa.com.br são permitidos.', 'error')
            return render_template('auth/register.html')
        
        # Verificar se o usuário já existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Este email já está cadastrado.', 'error')
            return render_template('auth/register.html')
        
        # Criar novo usuário
        try:
            new_user = User(
                email=email,
                name=name
            )
            new_user.set_password(password)
            
            db.session.add(new_user)
            db.session.commit()
            
            flash(f'Usuário {name} cadastrado com sucesso! Faça login para continuar.', 'success')
            return redirect(url_for('auth.login'))
            
        except Exception as e:
            db.session.rollback()
            flash('Erro ao cadastrar usuário. Tente novamente.', 'error')
    
    return render_template('auth/register.html')


@auth.route('/logout')
@login_required
def logout():
    """Fazer logout do usuário"""
    logout_user()
    flash('Você foi desconectado com sucesso.', 'success')
    return redirect(url_for('auth.login'))


@auth.route('/manage-users')
@login_required
def manage_users():
    """Página de gerenciamento de usuários (apenas admin)"""
    if current_user.email != 'admin@goldcreditsa.com.br':
        flash('Apenas administradores podem gerenciar usuários.', 'error')
        return redirect(url_for('dashboard'))
    
    users = User.query.filter(User.email != 'admin@goldcreditsa.com.br').all()
    return render_template('auth/manage_users.html', users=users)


@auth.route('/delete-user/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    """Excluir usuário (apenas admin)"""
    if current_user.email != 'admin@goldcreditsa.com.br':
        return jsonify({'success': False, 'message': 'Acesso negado.'}), 403
    
    if current_user.id == user_id:
        return jsonify({'success': False, 'message': 'Não é possível excluir sua própria conta.'}), 400
    
    user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado.'}), 404
    
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Usuário excluído com sucesso!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Erro ao excluir usuário.'}), 500