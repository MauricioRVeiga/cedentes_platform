from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from database import db, User

auth = Blueprint('auth', __name__)

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        
        if not email or not password:
            flash('Preencha todos os campos', 'error')
            return render_template('auth/login.html')
        
        if not User.validate_email_domain(email):
            flash('Apenas emails @goldcreditsa.com.br', 'error')
            return render_template('auth/login.html')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user)
            flash(f'Bem-vindo, {user.name}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Email ou senha inválidos', 'error')
    
    return render_template('auth/login.html')

@auth.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        name = request.form.get('name', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')
        
        if not all([email, name, password, confirm]):
            flash('Preencha todos os campos', 'error')
            return render_template('auth/register.html')
        
        if password != confirm:
            flash('Senhas não coincidem', 'error')
            return render_template('auth/register.html')
        
        if len(password) < 6:
            flash('Senha muito curta', 'error')
            return render_template('auth/register.html')
        
        if not User.validate_email_domain(email):
            flash('Apenas emails @goldcreditsa.com.br', 'error')
            return render_template('auth/register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email já cadastrado', 'error')
            return render_template('auth/register.html')
        
        try:
            user = User(email=email, name=name)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            flash('Cadastro realizado! Faça login.', 'success')
            return redirect(url_for('auth.login'))
        except Exception as e:
            flash('Erro no cadastro', 'error')
    
    return render_template('auth/register.html')

@auth.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Desconectado', 'success')
    return redirect(url_for('auth.login'))
