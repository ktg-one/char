"""Browser-verify companion UI via CloakBrowser (Cloudflare-safe for external sites)."""
import os
import sys
import time

from cloakbrowser import launch

BASE = os.environ.get("COMPANION_URL", "http://127.0.0.1:5000")
OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "screenshots")
os.makedirs(OUT, exist_ok=True)


def shot(page, name: str) -> str:
    path = os.path.join(OUT, name)
    page.screenshot(path=path, full_page=False)
    print(f"screenshot: {path}")
    return path


def main() -> int:
    browser = launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(BASE, wait_until="networkidle", timeout=30000)
    shot(page, "cloak-home.png")

    page.select_option("#character-select", "Asuka")
    time.sleep(1.5)
    shot(page, "cloak-asuka-selected.png")

    page.click("#emotes-button")
    time.sleep(0.5)
    shot(page, "cloak-expressions-modal.png")

    page.click('.emote-tab[data-tab="videos"]')
    time.sleep(0.5)
    shot(page, "cloak-videos-tab.png")

    page.click('.emote-tab[data-tab="gallery"]')
    time.sleep(0.5)
    shot(page, "cloak-gallery-tab.png")

    browser.close()
    print("CloakBrowser UI verify OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())