#!/usr/bin/env python3
"""
Run the Loki Mode Dashboard server.

Usage:
    python -m dashboard.run [--host HOST] [--port PORT]
    python dashboard/run.py [--host HOST] [--port PORT]
"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description="Loki Mode Dashboard Server")
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8420,
        help="Port to bind to (default: 8420)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError:
        print("Error: uvicorn not installed. Run: pip install uvicorn[standard]")
        sys.exit(1)

    print(f"Starting Loki Mode Dashboard on http://{args.host}:{args.port}")
    print("API docs available at: http://localhost:8420/docs")

    uvicorn.run(
        "dashboard.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
