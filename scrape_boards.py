"""
Pinterest Board Scraper using Playwright.
Navigates to a board, scrolls to load all pins, extracts high-res image URLs,
and downloads them.
"""

import asyncio
import os
import re
import sys
import requests
from playwright.async_api import async_playwright


async def scrape_board(url: str, output_dir: str, max_pins: int = 200):
    os.makedirs(output_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(3)

        # Check if we landed on the right page
        title = await page.title()
        print(f"Page title: {title}")

        # Scroll to load more pins
        image_urls = set()
        last_count = 0
        stall_rounds = 0

        for scroll_round in range(50):
            # Extract image URLs from pin elements
            imgs = await page.query_selector_all('img[src*="pinimg.com"]')
            for img in imgs:
                src = await img.get_attribute("src")
                if src and "pinimg.com" in src:
                    # Convert to highest resolution
                    high_res = re.sub(
                        r"/(75x|150x150|236x|474x|564x|736x)/",
                        "/originals/",
                        src,
                    )
                    # Skip tiny avatars and icons
                    if "/originals/" in high_res or "/736x/" in src:
                        image_urls.add(high_res)

            current_count = len(image_urls)
            print(
                f"  Scroll {scroll_round + 1}: found {current_count} unique pin images"
            )

            if current_count >= max_pins:
                break

            if current_count == last_count:
                stall_rounds += 1
                if stall_rounds >= 5:
                    print("  No new images after 5 scrolls, stopping.")
                    break
            else:
                stall_rounds = 0
            last_count = current_count

            # Scroll down
            await page.evaluate("window.scrollBy(0, window.innerHeight * 2)")
            await asyncio.sleep(1.5)

        await browser.close()

    # Download images
    print(f"\nDownloading {len(image_urls)} images to {output_dir}...")
    downloaded = 0
    for i, img_url in enumerate(image_urls):
        try:
            # Extract a filename
            parts = img_url.split("/")
            filename = parts[-1] if parts else f"pin_{i}.jpg"
            filepath = os.path.join(output_dir, filename)

            if os.path.exists(filepath):
                continue

            resp = requests.get(img_url, timeout=15)
            if resp.status_code == 200:
                with open(filepath, "wb") as f:
                    f.write(resp.content)
                downloaded += 1
            elif resp.status_code == 403:
                # Try 736x instead of originals
                fallback = img_url.replace("/originals/", "/736x/")
                resp2 = requests.get(fallback, timeout=15)
                if resp2.status_code == 200:
                    with open(filepath, "wb") as f:
                        f.write(resp2.content)
                    downloaded += 1
                else:
                    print(f"  Skipped (403): {filename}")
            else:
                print(f"  Skipped ({resp.status_code}): {filename}")
        except Exception as e:
            print(f"  Error downloading {img_url}: {e}")

    print(f"Done! Downloaded {downloaded} images to {output_dir}")
    return downloaded


async def main():
    boards = [
        {
            "url": "https://uk.pinterest.com/hugemarley/website-concepts/",
            "output": "context/moodboard-websites",
        },
        {
            "url": "https://uk.pinterest.com/hugemarley/widget-concepts-bento-grids/",
            "output": "context/moodboard-widgets",
        },
    ]

    for board in boards:
        print(f"\n{'='*60}")
        print(f"Scraping: {board['url']}")
        print(f"{'='*60}")
        await scrape_board(board["url"], board["output"])


if __name__ == "__main__":
    asyncio.run(main())
