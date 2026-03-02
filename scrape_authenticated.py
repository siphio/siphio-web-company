"""
Pinterest Authenticated Scraper.
Opens a visible browser → you log in → it scrapes both boards automatically.
"""

import asyncio
import os
import re
import requests
from playwright.async_api import async_playwright


async def wait_for_login(page):
    """Wait until the user has logged into Pinterest."""
    print("\n>>> A browser window has opened to Pinterest.")
    print(">>> Please LOG IN to your Pinterest account.")
    print(">>> Once you're logged in and see your home feed, press ENTER here...\n")

    # Navigate to login page
    await page.goto("https://www.pinterest.com/login/", wait_until="domcontentloaded", timeout=30000)

    # Poll until we detect a logged-in state or user signals
    while True:
        await asyncio.sleep(2)
        # Check if we're on the home feed (logged in)
        url = page.url
        if "/login" not in url and "pinterest.com" in url:
            # Check for user menu or other logged-in indicators
            logged_in = await page.evaluate("""() => {
                // Check for user avatar or settings button
                const avatar = document.querySelector('[data-test-id="header-avatar"]');
                const userMenu = document.querySelector('[data-test-id="user-menu"]');
                const homeBtn = document.querySelector('[data-test-id="homefeed-button"]');
                return !!(avatar || userMenu || homeBtn);
            }""")
            if logged_in:
                print("Detected logged-in state!")
                return True

        # Also check for redirect to home feed
        if "pinterest.com" in url and "/login" not in url and "/auth" not in url:
            await asyncio.sleep(3)
            print("Appears to be logged in (redirected from login page)")
            return True


async def scrape_board_authenticated(page, url: str, output_dir: str, board_name: str):
    """Scrape a board using an authenticated session."""
    os.makedirs(output_dir, exist_ok=True)

    # Clean old files
    for f in os.listdir(output_dir):
        if not f.startswith("_"):
            fp = os.path.join(output_dir, f)
            if os.path.isfile(fp):
                os.remove(fp)

    print(f"\nNavigating to board: {url}")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    title = await page.title()
    print(f"Page title: {title}")

    # Screenshot for verification (skip if it times out)
    ss_path = os.path.join(output_dir, "_board_screenshot.png")
    try:
        await page.screenshot(path=ss_path, full_page=False, timeout=60000)
        print(f"Screenshot saved: {ss_path}")
    except Exception as e:
        print(f"Screenshot skipped: {e}")

    # Check if we're on the actual board
    h1_text = await page.evaluate("""() => {
        const h1 = document.querySelector('h1');
        return h1 ? h1.textContent : 'no h1';
    }""")
    print(f"Board title: {h1_text}")

    # Collect pin images by scrolling
    all_pins = []
    seen_srcs = set()
    stall_count = 0
    last_count = 0

    for scroll_round in range(30):
        pins = await page.evaluate("""() => {
            const results = [];
            const seen = new Set();

            // Try [data-test-id="pin"] first
            let pinEls = document.querySelectorAll('[data-test-id="pin"]');
            if (pinEls.length === 0) {
                // Fallback: look for pin wrapper divs
                pinEls = document.querySelectorAll('[data-test-id="pinWrapper"]');
            }

            const imgSource = pinEls.length > 0 ? pinEls : [document];

            imgSource.forEach(container => {
                const imgs = container === document
                    ? document.querySelectorAll('img[src*="pinimg.com"]')
                    : container.querySelectorAll('img[src*="pinimg.com"]');

                imgs.forEach(img => {
                    const src = img.src;
                    if (!src || seen.has(src)) return;
                    // Skip tiny images
                    if (src.includes('/30x30/') || src.includes('/50x50/') || src.includes('/75x/')) return;
                    // Skip user avatars (usually very small)
                    const rect = img.getBoundingClientRect();
                    if (rect.width < 100 || rect.height < 100) return;

                    seen.add(src);
                    results.push({
                        src: src,
                        alt: img.alt || '',
                        width: rect.width,
                        height: rect.height,
                    });
                });
            });

            return results;
        }""")

        for pin in pins:
            if pin["src"] not in seen_srcs:
                seen_srcs.add(pin["src"])
                all_pins.append(pin)

        current = len(all_pins)
        print(f"  Scroll {scroll_round + 1}: {current} unique pins")

        if current == last_count:
            stall_count += 1
            if stall_count >= 4:
                print("  No new pins found, stopping scroll.")
                break
        else:
            stall_count = 0
        last_count = current

        # Check if we've hit "More ideas" / recommendations section
        hit_recs = await page.evaluate("""() => {
            const texts = document.querySelectorAll('h2, h3, [data-test-id="section-header"]');
            for (const el of texts) {
                const t = el.textContent.toLowerCase();
                if (t.includes('more ideas') || t.includes('more like this') || t.includes('inspired by')) {
                    return true;
                }
            }
            return false;
        }""")

        if hit_recs and current > 5:
            print("  Hit 'More ideas' section, stopping to avoid recommendations.")
            break

        await page.evaluate("window.scrollBy(0, 600)")
        await asyncio.sleep(1.5)

    # Final screenshot
    ss_path2 = os.path.join(output_dir, "_board_final.png")
    try:
        await page.screenshot(path=ss_path2, full_page=False, timeout=60000)
    except Exception:
        pass

    # Download all collected pin images
    print(f"\nDownloading {len(all_pins)} pin images...")
    downloaded = 0
    for i, pin in enumerate(all_pins):
        src = pin["src"]
        alt = pin.get("alt", "")

        # Upgrade resolution
        high_res = re.sub(r"/(150x150|236x|474x|564x|736x)/", "/originals/", src)

        filename = high_res.split("/")[-1]
        filepath = os.path.join(output_dir, filename)

        if os.path.exists(filepath):
            downloaded += 1
            continue

        for attempt_url in [high_res, src.replace("/236x/", "/736x/").replace("/474x/", "/736x/"), src]:
            try:
                resp = requests.get(attempt_url, timeout=15)
                if resp.status_code == 200 and len(resp.content) > 3000:
                    with open(filepath, "wb") as f:
                        f.write(resp.content)
                    downloaded += 1
                    if alt:
                        with open(filepath.rsplit(".", 1)[0] + ".txt", "w") as f:
                            f.write(alt)
                    break
            except Exception:
                continue

    print(f"Done! {downloaded}/{len(all_pins)} images saved to {output_dir}")
    return downloaded


async def main():
    async with async_playwright() as p:
        # Launch VISIBLE browser
        browser = await p.chromium.launch(
            headless=False,
            args=["--start-maximized"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            no_viewport=True,
        )
        page = await context.new_page()

        # Step 1: User logs in
        await wait_for_login(page)

        # Step 2: Scrape both boards
        boards = [
            ("https://uk.pinterest.com/hugemarley/website-concepts/",
             "context/moodboard-websites", "Website Concepts"),
            ("https://uk.pinterest.com/hugemarley/widget-concepts-bento-grids/",
             "context/moodboard-widgets", "Widget Concepts"),
        ]

        for url, output_dir, name in boards:
            print(f"\n{'='*60}")
            print(f"  SCRAPING: {name}")
            print(f"{'='*60}")
            await scrape_board_authenticated(page, url, output_dir, name)

        await browser.close()

    print("\n\nAll done! Both boards scraped successfully.")


if __name__ == "__main__":
    asyncio.run(main())
