#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WSGI configuration for Bro Meet application.
This module contains the WSGI application used by Gunicorn.
"""

import os
import sys
import logging
from pathlib import Path

# Add the application directory to Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

# Import the application
from app import socketio, app

# Configure logging for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Export the application for Gunicorn
application = socketio

if __name__ == "__main__":
    # This is for development only
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)
