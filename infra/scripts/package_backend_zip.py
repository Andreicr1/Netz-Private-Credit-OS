import fnmatch
import os
import sys
import zipfile


EXCLUDE_DIRS = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".venv",
    "venv",
    ".git",
    ".cursor",
    "logs_unzipped",
}

EXCLUDE_GLOBS = {
    "*.pyc",
    "*.pyo",
    "*.pyd",
    "*.log",
    "*.zip",
}


def is_excluded_file(name: str) -> bool:
    return any(fnmatch.fnmatch(name, pat) for pat in EXCLUDE_GLOBS)


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    backend_dir = os.path.join(repo_root, "backend")
    out_zip = os.path.join(repo_root, "backend_deploy_linux.zip")

    if not os.path.isdir(backend_dir):
        print(f"backend dir not found: {backend_dir}", file=sys.stderr)
        return 2

    # Ensure required files exist
    req = os.path.join(backend_dir, "requirements.txt")
    main_py = os.path.join(backend_dir, "app", "main.py")
    if not os.path.isfile(req):
        print("missing backend/requirements.txt", file=sys.stderr)
        return 2
    if not os.path.isfile(main_py):
        print("missing backend/app/main.py", file=sys.stderr)
        return 2

    # Create a zip with POSIX separators, rooted at backend/
    count = 0
    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for root, dirs, files in os.walk(backend_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            rel_root = os.path.relpath(root, backend_dir)

            # Optionally exclude tests from production package
            if rel_root == "tests" or rel_root.startswith("tests" + os.sep):
                continue

            for f in files:
                if is_excluded_file(f):
                    continue

                abs_path = os.path.join(root, f)
                rel_path = os.path.relpath(abs_path, backend_dir)

                # Force forward slashes inside zip (Linux-safe)
                arcname = rel_path.replace(os.sep, "/")

                zf.write(abs_path, arcname=arcname)
                count += 1

    print(f"Wrote {count} files -> {out_zip}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

