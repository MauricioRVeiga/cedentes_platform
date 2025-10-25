import os
import multiprocessing

# Configurações básicas
bind = f"0.0.0.0:{os.environ.get('PORT', '8080')}"
workers = 2
threads = 2
worker_class = 'sync'
worker_connections = 1000
timeout = 120
keepalive = 2

# Configurações de logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Configurações adicionais
max_requests = 1000
max_requests_jitter = 50
graceful_timeout = 30
