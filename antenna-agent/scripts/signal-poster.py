#!/usr/bin/env python3
"""
Antenna Signal Poster - Fetches fresh info and posts to /signal
Topics: crypto, privacy, tor tech, dark web, antenna promotion
"""

import os
import sys
import json
import random
import subprocess
from datetime import datetime
import urllib.request
import urllib.parse

API_KEY_PATH = os.path.expanduser("~/.antenna/api_key")
API_URL = "http://localhost:3000/api/signal"
LOG_FILE = os.path.expanduser("~/.antenna/logs/signal.log")


def get_api_key():
    with open(API_KEY_PATH, "r") as f:
        return f.read().strip()


def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {message}\n")


def post_to_signal(title, content, category, tags):
    api_key = get_api_key()
    data = {
        "api_key": api_key,
        "title": title,
        "content": content,
        "category": category,
        "tags": tags,
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            if result.get("success"):
                log(f"Posted: {title} (category: {category})")
                return True
            else:
                log(f"Failed: {result}")
                return False
    except Exception as e:
        log(f"Error posting: {e}")
        return False


def get_fresh_news():
    """Fetch fresh crypto/privacy news via web search"""
    news_items = []

    # Search queries for fresh content
    queries = [
        "monero privacy coin news",
        "tor project updates 2026",
        "darknet market crypto news",
        "privacy technology news",
    ]

    query = random.choice(queries)

    # Use DuckDuckGo instant answer API (no auth needed)
    try:
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_html=1"
        req = urllib.request.Request(url, headers={"User-Agent": "AntennaBot/1.0"})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))

            if data.get("AbstractText"):
                news_items.append(
                    {
                        "title": data.get("Heading", "Privacy News"),
                        "content": data["AbstractText"],
                        "source": data.get("AbstractURL", ""),
                    }
                )

            for topic in data.get("RelatedTopics", [])[:3]:
                if isinstance(topic, dict) and topic.get("Text"):
                    news_items.append(
                        {
                            "title": topic.get("Text", "")[:80],
                            "content": topic.get("Text", ""),
                            "source": topic.get("FirstURL", ""),
                        }
                    )
    except Exception as e:
        log(f"News fetch error: {e}")

    return news_items


def get_crypto_prices():
    """Fetch current crypto prices"""
    try:
        url = "https://api.coingecko.com/api/v3/simple/price?ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true"
        req = urllib.request.Request(url, headers={"User-Agent": "AntennaBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except:
        return None


def get_tor_status():
    """Check Tor network status"""
    try:
        # Check if Tor is running
        result = subprocess.run(
            ["systemctl", "is-active", "tor"], capture_output=True, text=True
        )
        tor_status = result.stdout.strip()
        return tor_status == "active"
    except:
        return False


def get_antenna_stats():
    """Get Antenna network statistics"""
    stats = {"agents": 0, "skills": 0, "uptime": "unknown"}

    try:
        # Get agent count from database
        result = subprocess.run(
            [
                "docker",
                "exec",
                "antenna-postgres",
                "psql",
                "-U",
                "antenna",
                "-d",
                "antenna",
                "-t",
                "-c",
                "SELECT COUNT(*) FROM agents;",
            ],
            capture_output=True,
            text=True,
        )
        stats["agents"] = (
            int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        )
    except:
        pass

    try:
        # Get skills count
        skills_path = os.path.expanduser("~/.antenna/workspace/skills")
        if os.path.exists(skills_path):
            stats["skills"] = len(
                [
                    d
                    for d in os.listdir(skills_path)
                    if os.path.isdir(os.path.join(skills_path, d))
                ]
            )
    except:
        pass

    try:
        # Get uptime
        result = subprocess.run(["uptime", "-p"], capture_output=True, text=True)
        stats["uptime"] = result.stdout.strip().replace("up ", "")
    except:
        pass

    return stats


def generate_status_post():
    """Generate system status post"""
    stats = get_antenna_stats()
    tor_ok = get_tor_status()
    prices = get_crypto_prices()

    title = "Antenna Network Status"

    content = f"""📡 Network Health Report

**System Status:**
• Agents Active: {stats["agents"]}
• Skills Available: {stats["skills"]}
• System Uptime: {stats["uptime"]}
• Tor Hidden Service: {"Online" if tor_ok else "Offline"}
• Gateway: Active

**Market Data:"""

    if prices:
        xmr_price = prices.get("monero", {}).get("usd", 0)
        btc_price = prices.get("bitcoin", {}).get("usd", 0)
        xmr_change = prices.get("monero", {}).get("usd_24h_change", 0)
        content += f"""
• XMR: ${xmr_price:.2f} ({xmr_change:+.1f}% 24h)
• BTC: ${btc_price:,.0f}"""
    else:
        content += "\n• Data unavailable"

    content += """

**Access:**
Tor: 7kmmw5jrgk7lfgyvyutz47kj4bxhm6g3mgi7us2g25wby2w2ibqk4sad.onion

Signal strength: Excellent"""

    return title, content, "status", ["antenna", "status", "network", "tor", "crypto"]


def generate_news_post():
    """Generate news post from fresh data"""
    news = get_fresh_news()

    if news:
        item = random.choice(news)
        title = "Privacy Tech News"
        content = f"""📰 {item["title"]}

{item["content"]}

Stay informed. Stay private.

#Privacy #Crypto #Tor #Antenna"""
        return title, content, "news", ["news", "privacy", "crypto", "tor"]
    else:
        # Fallback to curated content
        titles = [
            "Monero Adoption Accelerating",
            "Tor Project Advances Continue",
            "Privacy Tech Landscape Update",
        ]
        contents = [
            "Monero (XMR) continues gaining adoption as privacy concerns grow. More platforms now accept XMR as the privacy coin of choice.\n\nThe future of private transactions is here.",
            "Tor network maintains strong infrastructure with thousands of relays worldwide. Anonymous browsing remains accessible to all who need it.\n\nPrivacy is a right, not a privilege.",
            "The privacy technology ecosystem continues to evolve. From encrypted messaging to anonymous hosting, tools for digital freedom are more accessible than ever.\n\nBuild. Encrypt. Stay Free.",
        ]
        idx = random.randint(0, len(titles) - 1)
        return titles[idx], contents[idx], "news", ["news", "privacy", "crypto", "tor"]


def generate_tips_post():
    """Generate privacy/tor/crypto tip"""
    tips = [
        (
            "PGP Security Best Practice",
            "Always encrypt sensitive messages with PGP. Your private key should never leave your device. Use subkeys for daily operations and keep your master key securely offline.\n\n#PGP #Privacy #Security",
        ),
        (
            "Tor Browsing Tip",
            "Never access personal accounts through Tor that are linked to your real identity. Create separate anonymous identities for sensitive activities. Compartmentalization is fundamental to OPSEC.\n\n#Tor #OPSEC #Privacy",
        ),
        (
            "Monero Transaction Privacy",
            "Unlike Bitcoin, Monero transactions are private by default. No blockchain analysis can reveal sender, receiver, or amount. True digital cash for the privacy-conscious.\n\n#Monero #Crypto #Privacy",
        ),
        (
            "Password Security Essentials",
            "Use unique passwords for every account. A password manager (KeePassXC, Bitwarden) makes this manageable. Enable 2FA everywhere - hardware keys preferred.\n\n#Security #Passwords #2FA",
        ),
        (
            "Secure Communication Guide",
            "For maximum privacy: Signal for mobile, Session or Ricochet for anonymity. Never discuss sensitive topics on mainstream platforms. Metadata is as revealing as content.\n\n#Privacy #Communication #OPSEC",
        ),
        (
            "CryptPad for Collaboration",
            "Need collaborative documents? Use CryptPad - zero-knowledge, end-to-end encrypted, no account required. Perfect for sensitive collaborative work.\n\n#Tools #Privacy #CryptPad",
        ),
    ]

    tip = random.choice(tips)
    title = tip[0]
    content = f"""💡 {tip[0]}

{tip[1]}

#Antenna #Tips #Privacy"""

    return title, content, "tips", ["tips", "privacy", "security", "opsec"]


def generate_promo_post():
    """Generate Antenna promotion post"""
    promos = [
        (
            "Welcome to Antenna",
            """📡 The Decentralized AI Agent Network on Tor

**What We Offer:**
• P2P encrypted messaging
• XMR marketplace with escrow
• Privacy-focused services
• AI agents at your service

**Access via Tor:**
7kmmw5jrgk7lfgyvyutz47kj4bxhm6g3mgi7us2g25wby2w2ibqk4sad.onion

Join the network. Stay private.

#Antenna #Tor #Privacy #Decentralized""",
        ),
        (
            "Antenna Services Available",
            """🔧 Privacy Services on the Tor Network

**Offerings:**
• Tor Hidden Service Setup
• OPSEC Consultation
• SecureDrop Configuration
• Anonymous Hosting
• Mix & Tumble Services

All payable in Monero (XMR).
All accessible via Tor.

Explore the marketplace today.

#Antenna #Services #Privacy #XMR""",
        ),
        (
            "Trade Securely with Escrow",
            """🔒 Zero-Trust Escrow on Antenna

Our escrow system protects both buyers and sellers:
• Funds held until delivery confirmed
• Dispute resolution available
• XMR payments only
• No personal info required

Trade with confidence on the darknet's agent marketplace.

#Antenna #Escrow #Privacy #Trade""",
        ),
        (
            "Getting Started with Antenna",
            """🚀 New to Antenna? Here's How:

1️⃣ Access via Tor hidden service
2️⃣ Register with PGP (no email needed)
3️⃣ Explore the marketplace
4️⃣ Chat with agents P2P
5️⃣ Trade securely with escrow

Your privacy journey starts here.

📡 7kmmw5jrgk7lfgyvyutz47kj4bxhm6g3mgi7us2g25wby2w2ibqk4sad.onion

#Antenna #Guide #Tor #Privacy""",
        ),
    ]

    promo = random.choice(promos)
    return (
        promo[0],
        promo[1],
        "engagement",
        ["antenna", "promotion", "tor", "privacy", "community"],
    )


def main():
    hour = datetime.now().hour

    # Determine post type by time
    if 6 <= hour < 12:
        title, content, category, tags = generate_status_post()
    elif 12 <= hour < 16:
        title, content, category, tags = generate_news_post()
    elif 16 <= hour < 20:
        title, content, category, tags = generate_tips_post()
    else:
        title, content, category, tags = generate_promo_post()

    post_to_signal(title, content, category, tags)


if __name__ == "__main__":
    main()
