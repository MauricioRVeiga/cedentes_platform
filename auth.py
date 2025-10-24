from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from database import db, User
from werkzeug.security import check_password_hash

# Criar o Blueprint para autenticação
auth = Blueprint('auth', __name__)


@auth.route('/login', methods=['GET', 'POST'])
def login():
    # Se o usuário já estiver logado, redireciona para a página inicial
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Validar se o email foi preenchido
        if not email:
            flash('Por favor, informe o email.', 'error')
            return render_template('login.html')
        
        # Validar domínio do email
        if not User.validate_email_domain(email):
            flash('Apenas emails do domínio @goldcreditsa.com.br são permitidos.', 'error')
            return render_template('login.html')
        
        # Validar se a senha foi preenchida
        if not password:
            flash('Por favor, informe a senha.', 'error')
            return render_template('login.html')
        
        # Buscar usuário no banco de dados
        user = User.query.filter_by(email=email).first()
        
        # Verificar se o usuário existe e a senha está correta
        if user and user.check_password(password):
            # Fazer login do usuário
            login_user(user)
            
            # Mensagem de sucesso
            flash(f'Bem-vindo(a), {user.name}!', 'success')
            
            # Redirecionar para a página que o usuário tentou acessar ou para a página inicial
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('index'))
        else:
            flash('Email ou senha inválidos.', 'error')
    
    return render_template('login.html')


@auth.route('/logout')
@login_required
def logout():
    # Fazer logout do usuário
    logout_user()
    flash('Você foi desconectado com sucesso.', 'success')
    return redirect(url_for('auth.login'))


# Rota para teste - pode remover depois
@auth.route('/profile')
@login_required
def profile():
    return f'<h1>Perfil do usuário: {current_user.email}</h1><a href="/logout">Sair</a>'


@auth.route('/register', methods=['GET', 'POST'])
@login_required
def register():
    """Página de cadastro de novos usuários (apenas para admin)"""
    # Apenas administradores podem cadastrar novos usuários
    if current_user.email != 'admin@goldcreditsa.com.br':
        flash('Apenas administradores podem cadastrar novos usuários.', 'error')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        name = request.form.get('name')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validações
        if not all([email, name, password, confirm_password]):
            flash('Todos os campos são obrigatórios.', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('As senhas não coincidem.', 'error')
            return render_template('register.html')
        
        if len(password) < 6:
            flash('A senha deve ter pelo menos 6 caracteres.', 'error')
            return render_template('register.html')
        
        # Validar domínio do email
        if not User.validate_email_domain(email):
            flash('Apenas emails do domínio @goldcreditsa.com.br são permitidos.', 'error')
            return render_template('register.html')
        
        # Verificar se o usuário já existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Este email já está cadastrado.', 'error')
            return render_template('register.html')
        
        # Criar novo usuário
        try:
            new_user = User(
                email=email,
                name=name
            )
            new_user.set_password(password)
            
            db.session.add(new_user)
            db.session.commit()
            
            flash(f'Usuário {name} cadastrado com sucesso!', 'success')
            return redirect(url_for('auth.manage_users'))
            
        except Exception as e:
            db.session.rollback()
            flash('Erro ao cadastrar usuário. Tente novamente.', 'error')
    
    return render_template('register.html')


@auth.route('/manage-users')
@login_required
def manage_users():
    """Página de gerenciamento de usuários (apenas admin)"""
    if current_user.email != 'admin@goldcreditsa.com.br':
        flash('Apenas administradores podem gerenciar usuários.', 'error')
        return redirect(url_for('index'))
    
    users = User.query.filter(User.email != 'admin@goldcreditsa.com.br').all()
    return render_template('manage_users.html', users=users)


@auth.route('/delete-user/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    """Excluir usuário (apenas admin)"""
    if current_user.email != 'admin@goldcreditsa.com.br':
        return jsonify({'success': False, 'message': 'Acesso negado.'}), 403
    
    if current_user.id == user_id:
        return jsonify({'success': False, 'message': 'Não é possível excluir sua própria conta.'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado.'}), 404
    
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Usuário excluído com sucesso!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Erro ao excluir usuário.'}), 500
