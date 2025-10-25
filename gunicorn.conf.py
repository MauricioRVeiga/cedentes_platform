import multiprocessing
import os

# Configurações do Gunicorn
bind = f"0.0.0.0:{os.environ.get('PORT', '8080')}"
workers = multiprocessing.cpu_count() * 2 + 1
threads = 2
worker_class = 'sync'
worker_connections = 1000
timeout = 30
keepalive = 2

# Configurações de logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Configurações de reload e debug (apenas desenvolvimento)
reload = os.environ.get('FLASK_ENV') == 'development'
