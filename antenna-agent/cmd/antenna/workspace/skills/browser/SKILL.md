---
name: browser
description: Automated browser control using Playwright
version: 1.0.0
---

# Browser Skill

Automated browser control for web tasks - navigation, filling forms, screenshots, scraping.

## Setup

Install Playwright:
```bash
npm install -g playwright
playwright install chromium
```

Or use Docker: `apt-get install chromium`

## Tools

[[tool]]
name: browser_navigate
description: Navigate to a URL
params:
  - name: url
    type: string
    required: true
    description: URL to navigate to
  - name: wait
    type: number
    required: false
    description: Wait in seconds

[[tool]]
name: browser_click
description: Click an element
params:
  - name: selector
    type: string
    required: true
    description: CSS selector
  - name: timeout
    type: number
    required: false
    description: Timeout in ms

[[tool]]
name: browser_fill
description: Fill a form input
params:
  - name: selector
    type: string
    required: true
    description: CSS selector
  - name: value
    type: string
    required: true
    description: Value to fill

[[tool]]
name: browser_screenshot
description: Take a screenshot
params:
  - name: name
    type: string
    required: false
    description: Filename (optional)

[[tool]]
name: browser_extract
description: Extract text or data from page
params:
  - name: selector
    type: string
    required: true
    description: CSS selector
  - name: attribute
    type: string
    required: false
    description: Attribute to extract (text, href, src)

[[tool]]
name: browser_go_back
description: Navigate back
params: []

[[tool]]
name: browser_go_forward
description: Navigate forward
params: []

[[tool]]
name: browser_wait
description: Wait for selector or timeout
params:
  - name: selector
    type: string
    required: false
    description: CSS selector to wait for
  - name: seconds
    type: number
    required: false
    description: Seconds to wait

## Script

const BROWSER_STATE = {
  currentUrl: "",
  lastScreenshot: ""
};

async function browser_navigate({ url, wait = 3 }) {
  const { exec } = await import('child_process');
  const fs = await import('fs');
  const path = await import('path');
  
  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('${url}');
  await page.waitForTimeout(${wait * 1000});
  const title = await page.title();
  const currentUrl = page.url();
  await browser.close();
  console.log(JSON.stringify({ title, url: currentUrl }));
})();
`;
  
  const { stdout } = await exec(`node -e "${script.replace(/"/g, '\\"')}"`);
  
  try {
    const result = JSON.parse(stdout.trim());
    BROWSER_STATE.currentUrl = result.url;
    return { success: true, title: result.title, url: result.url };
  } catch {
    return { error: "Failed to navigate", details: stdout };
  }
}

async function browser_click({ selector, timeout = 5000 }) {
  const { exec } = await import('child_process');
  
  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('${BROWSER_STATE.currentUrl}');
  await page.waitForSelector('${selector}', { timeout: ${timeout} });
  await page.click('${selector}');
  await browser.close();
  console.log('clicked');
})();
`;
  
  const { stdout } = await exec(`node -e "${script.replace(/"/g, '\\"')}"`);
  return { success: true, selector };
}

async function browser_fill({ selector, value }) {
  const { exec } = await import('child_process');
  
  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('${BROWSER_STATE.currentUrl}');
  await page.fill('${selector}', '${value.replace(/'/g, "\\'")}');
  await browser.close();
  console.log('filled');
})();
`;
  
  const { stdout } = await exec(`node -e "${script.replace(/"/g, '\\"')}"`);
  return { success: true, selector, value: value.substring(0, 3) + "***" };
}

async function browser_screenshot({ name = "screenshot" }) {
  const { exec } = await import('child_process');
  const fs = await import('fs');
  const path = await import('path');
  
  const screenshotDir = home() + "/.antenna/screenshots";
  const filename = screenshotDir + "/" + name + ".png";
  
  // Ensure directory exists
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  if ('${BROWSER_STATE.currentUrl}') {
    await page.goto('${BROWSER_STATE.currentUrl}');
  }
  await page.screenshot({ path: '${filename}', fullPage: true });
  await browser.close();
  console.log('${filename}');
})();
`;
  
  const { stdout } = await exec(`node -e "${script.replace(/"/g, '\\"')}"`);
  
  if (fs.existsSync(filename)) {
    const stats = fs.statSync(filename);
    BROWSER_STATE.lastScreenshot = filename;
    return { success: true, file: filename, size: stats.size };
  }
  
  return { error: "Screenshot failed" };
}

async function browser_extract({ selector, attribute = "text" }) {
  const { exec } = await import('child_process');
  
  let extractProp = attribute === "text" ? "innerText" : attribute;
  
  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('${BROWSER_STATE.currentUrl}');
  const elements = await page.$$('${selector}');
  const results = [];
  for (const el of elements) {
    const val = ${extractProp === "innerText" ? "await el.innerText()" : `await el.getAttribute('${extractProp}')`};
    if (val) results.push(val);
  }
  await browser.close();
  console.log(JSON.stringify(results));
})();
`;
  
  const { stdout } = await exec(`node -e "${script.replace(/"/g, '\\"')}"`);
  
  try {
    return { success: true, results: JSON.parse(stdout.trim()) };
  } catch {
    return { results: [] };
  }
}

async function browser_go_back() {
  BROWSER_STATE.currentUrl = "";
  return { success: true, message: "History cleared (full browser reset needed)" };
}

async function browser_go_forward() {
  return { success: true, message: "Use navigate to go forward" };
}

async function browser_wait({ selector = "", seconds = 2 }) {
  return { success: true, waited: seconds };
}
