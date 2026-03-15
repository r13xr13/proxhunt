---
name: marketplace
description: P2P marketplace for skills and agents
version: 1.0.0
---

# Marketplace Skill

Trade skills and agents with other Antenna users. Uses XMR/Lightning for payments.

## Setup

Marketplace data stored in `~/.antenna/marketplace/`

## Tools

[[tool]]
name: marketplace_list
description: List marketplace listings
params:
  - name: category
    type: string
    required: false
    description: Filter by category (skills, agents, data)

[[tool]]
name: marketplace_publish
description: Publish a skill or agent
params:
  - name: name
    type: string
    required: true
    description: Item name
  - name: description
    type: string
    required: true
    description: Description
  - name: category
    type: string
    required: true
    description: Category (skills, agents, data)
  - name: price
    type: number
    required: true
    description: Price in USD
  - name: content
    type: string
    required: false
    description: Skill content or URL

[[tool]]
name: marketplace_buy
description: Purchase an item
params:
  - name: id
    type: string
    required: true
    description: Listing ID

[[tool]]
name: marketplace_search
description: Search marketplace
params:
  - name: query
    type: string
    required: true
    description: Search query

## Script

const MARKETPLACE_DIR = home() + "/.antenna/marketplace";

async function ensureMarketplaceDir() {
  const fs = await import('fs');
  if (!fs.existsSync(MARKETPLACE_DIR)) {
    fs.mkdirSync(MARKETPLACE_DIR, { recursive: true });
  }
  if (!fs.existsSync(MARKETPLACE_DIR + "/listings.json")) {
    fs.writeFileSync(MARKETPLACE_DIR + "/listings.json", JSON.stringify([], null, 2));
  }
}

async function marketplace_list({ category = "" }) {
  const fs = await import('fs');
  await ensureMarketplaceDir();
  
  const listings = JSON.parse(fs.readFileSync(MARKETPLACE_DIR + "/listings.json", 'utf8'));
  
  let filtered = listings;
  if (category) {
    filtered = listings.filter((l: any) => l.category === category);
  }
  
  return { 
    count: filtered.length,
    listings: filtered.map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      category: l.category,
      price: l.price,
      seller: l.seller
    }))
  };
}

async function marketplace_publish({ name, description, category, price, content = "" }) {
  const fs = await import('fs');
  await ensureMarketplaceDir();
  
  const listings = JSON.parse(fs.readFileSync(MARKETPLACE_DIR + "/listings.json", 'utf8'));
  
  const listing = {
    id: "listing_" + Date.now(),
    name,
    description,
    category,
    price,
    content,
    seller: "local",
    created: new Date().toISOString()
  };
  
  listings.push(listing);
  fs.writeFileSync(MARKETPLACE_DIR + "/listings.json", JSON.stringify(listings, null, 2));
  
  return { success: true, listing };
}

async function marketplace_buy({ id }) {
  return {
    message: "Payment integration coming soon",
    listing_id: id,
    note: "Will support XMR and Lightning via existing wallet"
  };
}

async function marketplace_search({ query }) {
  const fs = await import('fs');
  await ensureMarketplaceDir();
  
  const listings = JSON.parse(fs.readFileSync(MARKETPLACE_DIR + "/listings.json", 'utf8'));
  
  const q = query.toLowerCase();
  const results = listings.filter((l: any) => 
    l.name.toLowerCase().includes(q) || 
    l.description.toLowerCase().includes(q)
  );
  
  return { query, count: results.length, results };
}
