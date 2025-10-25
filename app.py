from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
import re
from config import Config
from urllib.parse import urlparse
import psycopg2

app = Flask(__name__)
app.config.from_object(Config)

# Configurar logs
if __name__ != '__main__':
    import logging
    gunicorn_logger = logging.getLogger('gunicorn.error')
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)

# Configurar WSGI app
application = app

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'


class User(UserMixin, db.Model):
    __tablename__ = 'users'  # Definir nome explícito da tabela

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    name = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.route('/')
def index():
    if current_user.is_authenticated:
        return f"✅ LOGADO como {current_user.email}"
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user)
            flash('Login realizado!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Email ou senha inválidos', 'error')
    
    return render_template('auth/login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        name = request.form.get('name')
        password = request.form.get('password')
        
        if not re.match(r'^[a-zA-Z0-9._%+-]+@goldcreditsa\.com\.br$', email):
            flash('Email deve ser do domínio @goldcreditsa.com.br', 'error')
            return render_template('auth/register.html')
            
        if User.query.filter_by(email=email).first():
            flash('Email já existe', 'error')
            return render_template('auth/register.html')
            
        user = User(email=email, name=name)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash('Cadastro realizado! Faça login.', 'success')
        return redirect(url_for('login'))
    
    return render_template('auth/register.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


# Adicionar nova rota de healthcheck
@app.route('/health')
def health():
    try:
        # Verificar conexão com o banco
        if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql'):
            url = urlparse(app.config['SQLALCHEMY_DATABASE_URI'])
            conn = psycopg2.connect(
                dbname=url.path[1:],
                user=url.username,
                password=url.password,
                host=url.hostname,
                port=url.port
            )
            conn.close()
        
        return jsonify({
            "status": "healthy",
            "message": "Service is running"
        }), 200
    except Exception as e:
        app.logger.error(f"Healthcheck failed: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "message": str(e)
        }), 500


if __name__ == '__main__':
    with app.app_context():
        # Criar todas as tabelas
        db.create_all()
        
        # Criar usuário admin se não existir
        if not User.query.filter_by(email='admin@goldcreditsa.com.br').first():
            admin = User(email='admin@goldcreditsa.com.br', name='Admin')
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("✅ Usuário admin criado")
    
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
