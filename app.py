"""Open the current hosted CrestMind UI from the former prototype entry point.

Run ``python app.py``. No third-party Python packages are required.
The frontend runs on Vercel and connects to the FastAPI backend on GCP.
"""

import webbrowser


FRONTEND_URL = "https://v0-crestmind-frontend.vercel.app/"


def main():
    print("CrestMind AI uses the hosted property-manager application.")
    print(f"Open this URL: {FRONTEND_URL}")
    try:
        opened = webbrowser.open(FRONTEND_URL, new=2)
    except webbrowser.Error:
        opened = False
    if not opened:
        print("No browser could be opened here. Copy the URL into your browser.")


if __name__ == "__main__":
    main()
