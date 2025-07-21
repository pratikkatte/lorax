# ---- Base Python image ----
    FROM python:3.11-slim

    # ---- Install system dependencies ----
    RUN apt-get update && \
        apt-get install -y curl gnupg build-essential nginx && \
        apt-get clean && \
        rm -rf /var/lib/apt/lists/*
    
    # ---- Install Node.js 22 and Yarn ----
    RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
        apt-get update && \
        apt-get install -y nodejs && \
        corepack enable && \
        corepack prepare yarn@stable --activate && \
        rm -rf /var/lib/apt/lists/*
    
    # ---- Set working directory ----
    WORKDIR /app
    
    # ---- Copy only requirements first for pip caching ----
    COPY requirements.txt .
    
    # ---- Install Python dependencies ----
    RUN pip install --upgrade pip && \
        pip install --prefer-binary -r requirements.txt
    
    # ---- Copy the rest of the source files ----
    COPY . /app
    
    # ---- Build Vite app using Yarn ----
    WORKDIR /app/taxonium_component
    RUN yarn install && yarn build
    
    # ---- Move built frontend to Nginx root ----
    RUN mkdir -p /var/www/html && \
        cp -r dist/* /var/www/html/
    
    # ---- Configure Nginx ----
    RUN rm /etc/nginx/sites-enabled/default
    COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
    
    # ---- Expose ports ----
    EXPOSE 80
    
    # ---- Start FastAPI and Nginx ----
    WORKDIR /app
    CMD ["sh", "-c", "python launch.py & nginx -g 'daemon off;'"]
    