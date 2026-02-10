import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    service = os.environ["SEARCH_SERVICE"]
    index_name = os.environ["SEARCH_INDEX"]
    api_version = os.environ.get("SEARCH_API_VERSION", "2025-09-01")
    api_key = os.environ["SEARCH_ADMIN_KEY"]

    url = f"https://{service}.search.windows.net/indexes('{index_name}')?api-version={api_version}"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={"api-key": api_key},
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(resp.status)
            return 0 if resp.status == 200 else 2
    except urllib.error.HTTPError as e:
        # print only status code, no body (avoid leaking anything)
        print(e.code)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

