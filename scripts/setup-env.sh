#!/bin/bash

# Script to generate .env.local file with required environment variables

echo "🔧 Setting up .env.local file..."

# Generate secrets
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Check if .env.local already exists
if [ -f .env.local ]; then
  echo "⚠️  .env.local already exists!"
  read -p "Do you want to overwrite it? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Keeping existing .env.local"
    exit 0
  fi
fi

# Get database URL
echo ""
echo "📊 Database Configuration:"
echo "1. Use local PostgreSQL (default: postgresql://localhost:5432/pikachubball)"
echo "2. Use remote PostgreSQL (provide connection string)"
echo "3. Skip for now (you can edit .env.local later)"
read -p "Choose option (1-3): " db_choice

case $db_choice in
  1)
    read -p "Database name [pikachubball]: " db_name
    db_name=${db_name:-pikachubball}
    read -p "Database user [postgres]: " db_user
    db_user=${db_user:-postgres}
    read -p "Database password: " -s db_pass
    echo
    read -p "Database host [localhost]: " db_host
    db_host=${db_host:-localhost}
    read -p "Database port [5432]: " db_port
    db_port=${db_port:-5432}
    DATABASE_URL="postgresql://${db_user}:${db_pass}@${db_host}:${db_port}/${db_name}"
    ;;
  2)
    read -p "Enter PostgreSQL connection string: " DATABASE_URL
    ;;
  3)
    DATABASE_URL="postgresql://user:password@localhost:5432/pikachubball"
    echo "⚠️  Using placeholder DATABASE_URL. Please update .env.local with your actual database URL."
    ;;
  *)
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pikachubball"
    echo "Using default: $DATABASE_URL"
    ;;
esac

# Optional Yahoo OAuth credentials
echo ""
echo "🔑 Yahoo OAuth (optional - can be set later):"
read -p "Yahoo Client ID (press Enter to skip): " YAHOO_CLIENT_ID
read -p "Yahoo Client Secret (press Enter to skip): " -s YAHOO_CLIENT_SECRET
echo

# Create .env.local file
cat > .env.local << EOF
# Environment: Development
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=${DATABASE_URL}

# Session & Encryption (auto-generated)
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Yahoo OAuth (optional)
${YAHOO_CLIENT_ID:+YAHOO_CLIENT_ID=${YAHOO_CLIENT_ID}}
${YAHOO_CLIENT_SECRET:+YAHOO_CLIENT_SECRET=${YAHOO_CLIENT_SECRET}}
EOF

echo ""
echo "✅ Created .env.local file!"
echo ""
echo "📝 Next steps:"
echo "1. Review .env.local and update any values if needed"
echo "2. Make sure your PostgreSQL database is running"
echo "3. Run: npm run db:push  (to set up database schema)"
echo "4. Run: npm run dev      (to start the development server)"
echo ""
echo "The app will be available at: http://localhost:5000"

