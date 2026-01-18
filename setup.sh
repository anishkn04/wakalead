#!/bin/bash

# WakaLead Development Setup Script
# Run this after npm install to set up your development environment

set -e

echo "🚀 WakaLead Development Setup"
echo "================================"
echo ""

# Wrangler is installed locally as a dev dependency
echo "✅ Using local Wrangler CLI (npx wrangler)"
echo ""

# Check if logged in to Cloudflare
echo "🔐 Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "Please log in to Cloudflare:"
    npx wrangler login
else
    echo "✅ Already logged in to Cloudflare"
fi
echo ""

# Create D1 database
echo "📦 Setting up D1 database..."
read -p "Create new D1 database? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating database 'wakalead'..."
    npx wrangler d1 create wakalead
    echo ""
    echo "⚠️  IMPORTANT: Copy the database_id from above and update wrangler.toml"
    read -p "Press Enter when you've updated wrangler.toml..."
    
    # Run migration
    echo "Running database migration..."
    npx wrangler d1 execute wakalead --file=./schema.sql
    echo "✅ Database initialized"
fi
echo ""

# Create KV namespace
echo "🗄️  Setting up KV namespace..."
read -p "Create new KV namespace? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating KV namespace 'SESSIONS'..."
    npx wrangler kv:namespace create "SESSIONS"
    echo ""
    echo "⚠️  IMPORTANT: Copy the id from above and update wrangler.toml"
    read -p "Press Enter when you've updated wrangler.toml..."
fi
echo ""

# Set up secrets
echo "🔑 Setting up Worker secrets..."
read -p "Set up Worker secrets? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "You'll need:"
    echo "1. WakaTime Client ID (from https://wakatime.com/apps)"
    echo "2. WakaTime Client Secret"
    echo "3. Redirect URI (for dev: http://localhost:5173)"
    echo "4. Session Secret (generate with: openssl rand -base64 32)"
    echo ""
    read -p "Press Enter to continue..."
    
    echo "Setting WAKATIME_CLIENT_ID..."
    npx wrangler secret put WAKATIME_CLIENT_ID
    
    echo "Setting WAKATIME_CLIENT_SECRET..."
    npx wrangler secret put WAKATIME_CLIENT_SECRET
    
    echo "Setting WAKATIME_REDIRECT_URI..."
    npx wrangler secret put WAKATIME_REDIRECT_URI
    
    echo "Setting SESSION_SECRET..."
    npx wrangler secret put SESSION_SECRET
    
    echo "✅ Secrets configured"
fi
echo ""

# Create .env file
echo "📝 Creating .env file..."
if [ ! -f .env ]; then
    cat > .env << EOF
# Local development configuration
VITE_API_BASE=http://localhost:8787/api
EOF
    echo "✅ .env file created"
else
    echo "⚠️  .env file already exists, skipping"
fi
echo ""

# Create .dev.vars for local Worker development
echo "📝 Creating .dev.vars file..."
read -p "Create .dev.vars for local development? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ ! -f .dev.vars ]; then
        cat > .dev.vars << EOF
# Local Worker secrets (DO NOT COMMIT)
WAKATIME_CLIENT_ID=your_client_id_here
WAKATIME_CLIENT_SECRET=your_client_secret_here
WAKATIME_REDIRECT_URI=http://localhost:5173
SESSION_SECRET=your_secret_here
ADMIN_WAKATIME_ID=anishkn04
EOF
        echo "✅ .dev.vars file created"
        echo "⚠️  Edit .dev.vars with your actual credentials"
    else
        echo "⚠️  .dev.vars file already exists, skipping"
    fi
fi
echo ""

# Summary
echo "================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with your database_id and KV id"
echo "2. Edit .dev.vars with your WakaTime OAuth credentials"
echo "3. Start development servers:"
echo "   Terminal 1: npm run dev"
echo "   Terminal 2: npm run worker:dev"
echo ""
echo "📚 See DEPLOYMENT.md for production deployment"
echo "================================"
