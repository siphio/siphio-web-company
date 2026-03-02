"""
Pinterest Board Scraper v2 - Targeted approach.
Only captures pins from the board itself, not the "More ideas" section.
Takes a screenshot of the board view first, then extracts pin URLs.
"""

import asyncio
import os
import re
import requests
from playwright.async_api import async_playwright


async def scrape_board(url: str, output_dir: str, board_name: str):
    os.makedirs(output_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        print(f"Navigating to {url}...")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception:
            await page.goto(url, timeout=60000)

        await asyncio.sleep(5)

        title = await page.title()
        print(f"Page title: {title}")

        # Take a full-page screenshot for verification
        screenshot_path = os.path.join(output_dir, f"_board_screenshot.png")
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"Board screenshot saved to {screenshot_path}")

        # Strategy: Look for pin links that belong to THIS board
        # Pinterest board pins have specific data attributes and link patterns
        # We want to grab images BEFORE the "More ideas" / "More like this" section

        # First, let's get the page HTML structure to understand layout
        board_section_html = await page.evaluate("""() => {
            // Find the board header/title element
            const h1 = document.querySelector('h1');
            if (h1) return 'Found h1: ' + h1.textContent;
            return 'No h1 found';
        }""")
        print(f"Board header: {board_section_html}")

        # Collect pin URLs by looking at anchor tags with /pin/ paths
        pin_data = await page.evaluate("""() => {
            const pins = [];
            const seen = new Set();

            // Get all pin containers - these are the actual board pins
            // Pinterest uses [data-test-id="pin"] or similar
            const pinElements = document.querySelectorAll('[data-test-id="pin"]');

            if (pinElements.length > 0) {
                pinElements.forEach(pin => {
                    const img = pin.querySelector('img[src*="pinimg.com"]');
                    if (img && img.src && !seen.has(img.src)) {
                        seen.add(img.src);
                        pins.push({
                            src: img.src,
                            alt: img.alt || '',
                        });
                    }
                });
            }

            // Fallback: grab all pin images but stop at "More ideas" section
            if (pins.length === 0) {
                // Try different selectors
                const allImgs = document.querySelectorAll('img[src*="pinimg.com"]');
                let moreIdeasFound = false;

                allImgs.forEach(img => {
                    if (moreIdeasFound) return;

                    // Check if we've hit the "More ideas" section
                    const parent = img.closest('[data-test-id]');
                    if (parent) {
                        const testId = parent.getAttribute('data-test-id');
                        if (testId && testId.includes('recommendation')) {
                            moreIdeasFound = true;
                            return;
                        }
                    }

                    const src = img.src;
                    // Skip tiny images (avatars, icons)
                    if (src.includes('/30x30/') || src.includes('/75x/') || src.includes('/50x50/')) return;
                    if (!seen.has(src)) {
                        seen.add(src);
                        pins.push({
                            src: src,
                            alt: img.alt || '',
                        });
                    }
                });
            }

            return pins;
        }""")

        print(f"Found {len(pin_data)} pin images from board section")

        # Gentle scroll to load a few more board pins (not too far to hit recommendations)
        for i in range(3):
            await page.evaluate("window.scrollBy(0, 800)")
            await asyncio.sleep(2)

            more_pins = await page.evaluate("""() => {
                const pins = [];
                const seen = new Set();
                const pinElements = document.querySelectorAll('[data-test-id="pin"] img[src*="pinimg.com"]');
                pinElements.forEach(img => {
                    if (img.src && !seen.has(img.src)) {
                        seen.add(img.src);
                        pins.push({ src: img.src, alt: img.alt || '' });
                    }
                });
                if (pins.length === 0) {
                    const allImgs = document.querySelectorAll('img[src*="pinimg.com"]');
                    allImgs.forEach(img => {
                        const src = img.src;
                        if (src.includes('/30x30/') || src.includes('/75x/') || src.includes('/50x50/')) return;
                        if (!seen.has(src)) {
                            seen.add(src);
                            pins.push({ src: src, alt: img.alt || '' });
                        }
                    });
                }
                return pins;
            }""")
            print(f"  After scroll {i+1}: {len(more_pins)} total pins")
            if len(more_pins) > len(pin_data):
                pin_data = more_pins

        # Take another screenshot after scrolling
        screenshot_path2 = os.path.join(output_dir, f"_board_scrolled.png")
        await page.screenshot(path=screenshot_path2, full_page=False)

        await browser.close()

    # Download images
    print(f"\nDownloading {len(pin_data)} images to {output_dir}...")
    downloaded = 0
    for i, pin in enumerate(pin_data):
        src = pin["src"]
        alt = pin.get("alt", "")

        # Upgrade to highest available resolution
        high_res = re.sub(r"/(150x150|236x|474x|564x|736x)/", "/originals/", src)

        # Generate filename
        parts = high_res.split("/")
        filename = parts[-1] if parts else f"pin_{i}.jpg"
        filepath = os.path.join(output_dir, filename)

        if os.path.exists(filepath):
            downloaded += 1
            continue

        try:
            resp = requests.get(high_res, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 5000:
                with open(filepath, "wb") as f:
                    f.write(resp.content)
                downloaded += 1
                # Save alt text as caption
                if alt:
                    caption_path = filepath.rsplit(".", 1)[0] + ".txt"
                    with open(caption_path, "w") as f:
                        f.write(alt)
            elif resp.status_code == 403:
                fallback = src.replace("/236x/", "/736x/").replace("/474x/", "/736x/")
                resp2 = requests.get(fallback, timeout=15)
                if resp2.status_code == 200 and len(resp2.content) > 5000:
                    with open(filepath, "wb") as f:
                        f.write(resp2.content)
                    downloaded += 1
        except Exception as e:
            print(f"  Error: {e}")

    print(f"Done! Downloaded {downloaded} images to {output_dir}")
    return downloaded


async def main():
    boards = [
        {
            "url": "https://uk.pinterest.com/hugemarley/website-concepts/",
            "output": "context/moodboard-websites",
            "name": "website-concepts",
        },
        {
            "url": "https://uk.pinterest.com/hugemarley/widget-concepts-bento-grids/",
            "output": "context/moodboard-widgets",
            "name": "widget-concepts",
        },
    ]

    for board in boards:
        print(f"\n{'='*60}")
        print(f"Scraping: {board['name']}")
        print(f"{'='*60}")
        # Clean directory first
        outdir = board["output"]
        if os.path.exists(outdir):
            for f in os.listdir(outdir):
                if not f.startswith("_"):
                    os.remove(os.path.join(outdir, f))
        await scrape_board(board["url"], board["output"], board["name"])


if __name__ == "__main__":
    asyncio.run(main())
