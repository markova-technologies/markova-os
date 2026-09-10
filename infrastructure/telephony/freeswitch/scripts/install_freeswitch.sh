#!/bin/bash
# FreeSWITCH Installation Script for Ubuntu 22.04 LTS
# Usage: sudo ./install_freeswitch.sh

set -e

echo "🚀 Starting FreeSWITCH Installation..."

# 1. Update System
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y gnupg2 wget lsb-release curl git build-essential zlib1g-dev libjpeg-dev sqlite3 libsqlite3-dev libcurl4-openssl-dev libpcre3-dev libspeexdsp-dev libldns-dev libedit-dev libtiff5-dev yasm libopus-dev libsndfile1-dev unzip lua5.2 liblua5.2-dev

# 2. Add SignalWire Repo (Official FreeSWITCH Host)
echo "🔑 Adding SignalWire repository..."
TOKEN="public"
wget --http-user=signalwire --http-password=$TOKEN -O /usr/share/keyrings/signalwire-freeswitch-repo.gpg https://freeswitch.signalwire.com/repo/deb/debian-release/signalwire-freeswitch-repo.gpg

echo "deb [signed-by=/usr/share/keyrings/signalwire-freeswitch-repo.gpg] https://freeswitch.signalwire.com/repo/deb/debian-release/ `lsb_release -sc` main" > /etc/apt/sources.list.d/freeswitch.list
echo "deb-src [signed-by=/usr/share/keyrings/signalwire-freeswitch-repo.gpg] https://freeswitch.signalwire.com/repo/deb/debian-release/ `lsb_release -sc` main" >> /etc/apt/sources.list.d/freeswitch.list

apt-get update

# 3. Install FreeSWITCH
echo "⬇️ Installing FreeSWITCH..."
apt-get install -y freeswitch-meta-all

# 4. Install Sounds
echo "🎵 Installing sound files..."
apt-get install -y freeswitch-music-default freeswitch-sounds-en-us-callie

# 5. Enable and Start Service
echo "🔌 Enabling FreeSWITCH service..."
systemctl enable freeswitch
systemctl start freeswitch

# 6. Status Check
echo "✅ Installation Complete!"
systemctl status freeswitch --no-pager

echo ""
echo "⚠️ IMPORTANT: Replace the default configuration in /etc/freeswitch"
echo "   with the files generated in the 'freeswitch_config' directory."
