from playwright.async_api import async_playwright
import time

async def perform_action(action_type: str, data: dict) -> dict:
    """
    Perform an RPA action using Playwright.
    """
    if action_type == "web_scrape":
        return await web_scrape(data.get("url"))
    elif action_type == "form_fill":
        return await form_fill(data.get("url"), data.get("fields", {}))
    else:
        raise ValueError(f"Unknown RPA action type: {action_type}")


async def web_scrape(url: str) -> dict:
    if not url:
        return {"error": "Missing URL for web_scrape"}
        
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url)
        content = await page.content()
        title = await page.title()
        await browser.close()
        
        return {"title": title, "content_length": len(content)}


async def form_fill(url: str, fields: dict) -> dict:
    if not url:
        return {"error": "Missing URL for form_fill"}
        
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url)
        
        for selector, value in fields.items():
            try:
                await page.fill(selector, str(value))
            except Exception as e:
                print(f"Failed to fill {selector}: {e}")
        
        # Assume there's a generic submit button for this scaffolding
        try:
            await page.click("button[type='submit']")
            await page.wait_for_load_state("networkidle")
        except Exception:
            pass
            
        success_url = page.url
        await browser.close()
        
        return {"status": "form_submitted", "final_url": success_url}
