# SSL Certificate Setup for SyllabAI

This directory should contain your SSL certificates for HTTPS.

## Option 1: Let's Encrypt (Recommended)

### Initial Setup with Certbot

1. **Install Certbot in a separate container:**

```bash
# Create a temporary nginx config without SSL for initial setup
cp nginx.conf nginx.conf.backup
# Edit nginx.conf to remove SSL sections temporarily

# Start services without SSL
docker-compose -f docker-compose.prod.yml up -d

# Run Certbot
docker run --rm \
  -v /path/to/certbot/www:/var/www/certbot \
  -v /path/to/certbot/conf:/etc/letsencrypt \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@domain.com \
  --agree-tos \
  --no-eff-email \
  -d syllaai.com \
  -d www.syllaai.com
```

2. **Copy certificates to this directory:**

```bash
# Copy from Let's Encrypt
cp /etc/letsencrypt/live/syllaai.com/fullchain.pem ./fullchain.pem
cp /etc/letsencrypt/live/syllaai.com/privkey.pem ./privkey.pem

# Set proper permissions
chmod 644 fullchain.pem
chmod 600 privkey.pem
```

3. **Restore full nginx config and restart:**

```bash
cp nginx.conf.backup nginx.conf
docker-compose -f docker-compose.prod.yml restart nginx
```

### Automatic Renewal

Add this to your crontab for automatic renewal:

```bash
# Renew certificates twice daily
0 12 * * * docker run --rm -v /path/to/certbot/www:/var/www/certbot -v /path/to/certbot/conf:/etc/letsencrypt certbot/certbot renew --quiet && docker-compose -f /path/to/syllaai/docker-compose.prod.yml restart nginx
```

## Option 2: Self-Signed Certificates (Development/Testing)

**WARNING: Only use for development! Not secure for production.**

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=syllaai.com"
```

## Option 3: Custom Certificates

If you have certificates from another provider:

1. Copy your certificate chain to `fullchain.pem`
2. Copy your private key to `privkey.pem`
3. Ensure proper permissions (644 for cert, 600 for key)

## File Structure

This directory should contain:
```
ssl/
├── fullchain.pem    # Certificate chain (public)
├── privkey.pem      # Private key (keep secure!)
└── README.md        # This file
```

## Security Notes

- Never commit private keys to version control
- Use strong file permissions (600 for private key)
- Keep certificates up to date
- Monitor certificate expiration dates
- Use a secure certificate authority

## Troubleshooting

### Certificate Not Found Error
- Verify files exist and have correct names
- Check file permissions
- Ensure nginx can read the files

### SSL Handshake Errors
- Verify certificate chain is complete
- Check that private key matches certificate
- Ensure proper SSL protocols are enabled

### Let's Encrypt Rate Limits
- Let's Encrypt has rate limits (50 certificates per domain per week)
- Use staging environment for testing: `--staging` flag
- See: https://letsencrypt.org/docs/rate-limits/

## Production Checklist

- [ ] Certificates installed and readable
- [ ] HTTPS redirects working
- [ ] Certificate chain complete
- [ ] Private key secured (600 permissions)
- [ ] Automatic renewal configured
- [ ] Backup certificates stored securely
- [ ] Certificate expiration monitoring setup