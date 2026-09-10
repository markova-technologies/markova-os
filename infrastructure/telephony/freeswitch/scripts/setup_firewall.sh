#!/bin/bash
# Secure Firewall Setup for FreeSWITCH

echo "🛡️ Configuring Firewall (UFW)..."

# Default policies
ufw default deny incoming
ufw default allow outgoing

# SSH (Change port if needed)
echo "🔓 Allowing SSH..."
ufw allow 22/tcp

# SIP Signaling
echo "🔓 Allowing SIP (5060/5080)..."
ufw allow 5060/udp
ufw allow 5060/tcp
ufw allow 5080/udp
ufw allow 5080/tcp

# RTP Audio Range (10000-20000) - Adjust based on switch.conf.xml
echo "🔓 Allowing RTP Audio (16384-32768)..."
ufw allow 16384:32768/udp

# HTTP Webhooks (if FreeSWITCH listens for HTTP)
# ufw allow 8080/tcp

# Enable Firewall
echo "✅ Enabling UFW..."
ufw --force enable

echo "🛡️ Firewall configured successfully!"
ufw status
