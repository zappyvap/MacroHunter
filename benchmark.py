"""
benchmark.py — MacroHunter request timing benchmark

Fires the LangGraph pipeline directly in-process N times, collecting per-node
timings and printing a summary table with mean/min/max/stdev per node.

Usage (from project root, with venv active):
    python benchmark.py                          # 3 runs, search path
    python benchmark.py --runs 5                 # 5 runs
    python benchmark.py --lat 40.71 --lon -74.00 # custom location
    python benchmark.py --mode vision --image path/to/menu.jpg
"""

import argparse
import asyncio
import base64
import functools
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

# Make backend and mcp_servers importable without installing
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv()

# ── Timing registry ───────────────────────────────────────────────────────────
# maps node_label → list of elapsed seconds across all runs
_timings: dict[str, list[float]] = defaultdict(list)
_run_totals: list[float] = []


# ── Patch graph nodes to collect into _timings instead of just printing ───────
import graph as _graph_module


def _make_collecting_wrapper(fn):
    """Wrap a node function so it records elapsed time into _timings."""
    @functools.wraps(fn)
    def wrapper(state):
        start = time.perf_counter()
        result = fn(state)
        elapsed = time.perf_counter() - start
        label = fn.__name__
        if label == "fetch_and_optimize":
            idx = state.get("current_restaurant_index", 0)
            restaurants = state.get("restaurant_list") or []
            name = restaurants[idx]["name"] if idx < len(restaurants) else f"#{idx}"
            label = f"fetch_and_optimize({name})"
        _timings[label].append(elapsed)
        print(f"    ⏱  {label}: {elapsed:.2f}s")
        return result
    return wrapper


# Unwrap the timed_node decorator added by graph.py, then re-wrap with our
# collecting wrapper so timings land in _timings rather than just stdout.
def _rewrap_all_nodes():
    for name in ("find_restaurants", "fetch_and_optimize", "image_translation",
                 "optimize_calories", "judge_node"):
        fn = getattr(_graph_module, name, None)
        if fn is None:
            continue
        # peel back functools.wraps layers to reach the real function
        inner = fn
        while hasattr(inner, "__wrapped__"):
            inner = inner.__wrapped__
        setattr(_graph_module, name, _make_collecting_wrapper(inner))

_rewrap_all_nodes()

# Recompile graph with the re-wrapped node references
from langgraph.graph import StateGraph, START, END

gb = StateGraph(_graph_module.State)
gb.add_node("find_restaurants",   _graph_module.find_restaurants)
gb.add_node("fetch_and_optimize", _graph_module.fetch_and_optimize)
gb.add_node("image_translation",  _graph_module.image_translation)
gb.add_node("optimizer",          _graph_module.optimize_calories)
gb.add_node("judge",              _graph_module.judge_node)
gb.add_conditional_edges(START,               _graph_module.route_user_input)
gb.add_conditional_edges("find_restaurants",  _graph_module.fan_out_restaurants)
gb.add_edge("fetch_and_optimize", "judge")
gb.add_edge("image_translation",  "optimizer")
gb.add_edge("optimizer",          "judge")
gb.add_edge("judge", END)
_benchmark_graph = gb.compile()


# ── Single run ────────────────────────────────────────────────────────────────

async def run_once(initial_state: dict, run_num: int) -> float:
    import uuid
    cfg = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print(f"\n{'─'*52}")
    print(f"  Run {run_num}")
    print(f"{'─'*52}")
    start = time.perf_counter()
    async for _ in _benchmark_graph.astream(initial_state, config=cfg, stream_mode="updates"):
        pass
    elapsed = time.perf_counter() - start
    print(f"  → Run total: {elapsed:.2f}s")
    return elapsed


# ── Report ────────────────────────────────────────────────────────────────────

def _stats(values: list[float]) -> dict:
    if len(values) == 1:
        return {"mean": values[0], "min": values[0], "max": values[0], "stdev": 0.0}
    return {
        "mean":  statistics.mean(values),
        "min":   min(values),
        "max":   max(values),
        "stdev": statistics.stdev(values),
    }


def print_report(run_totals: list[float], timings: dict):
    from datetime import datetime
    W = 44  # label column width
    
    report_lines = []
    report_lines.append(f"\n{'═'*66}")
    report_lines.append(f"  BENCHMARK SUMMARY - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append(f"{'═'*66}")
    
    header = f"  {'Node':<{W}} {'Mean':>7}  {'Min':>7}  {'Max':>7}  {'±StdDev':>8}"
    report_lines.append(header)
    report_lines.append(f"  {'─'*W} {'─'*7}  {'─'*7}  {'─'*7}  {'─'*8}")

    node_stats = {label: _stats(vals) for label, vals in timings.items()}
    # sort slowest first so bottlenecks jump out immediately
    for label, s in sorted(node_stats.items(), key=lambda x: x[1]["mean"], reverse=True):
        report_lines.append(f"  {label:<{W}} {s['mean']:>6.2f}s  {s['min']:>6.2f}s  {s['max']:>6.2f}s  ±{s['stdev']:>5.2f}s")

    s = _stats(run_totals)
    report_lines.append(f"  {'─'*W} {'─'*7}  {'─'*7}  {'─'*7}  {'─'*8}")
    report_lines.append(f"  {'TOTAL (wall clock)':<{W}} {s['mean']:>6.2f}s  {s['min']:>6.2f}s  {s['max']:>6.2f}s  ±{s['stdev']:>5.2f}s")
    report_lines.append(f"{'═'*66}\n")
    report_lines.append("  Note: parallel fetch_and_optimize branches overlap in wall-clock time.")
    report_lines.append("  The TOTAL is the true end-to-end time; per-node sums will exceed it.\n")

    report_text = "\n".join(report_lines)
    print(report_text)
    
    # Save to history file (newest entry at the top)
    history_path = "benchmark_history.txt"
    try:
        with open(history_path, "r") as f:
            existing = f.read()
    except FileNotFoundError:
        existing = ""
    with open(history_path, "w") as f:
        f.write(report_text + "\n\n" + existing)


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="MacroHunter pipeline benchmark")
    parser.add_argument("--runs",     type=int,   default=3,        help="Iterations (default: 3)")
    parser.add_argument("--mode",     choices=["search", "vision"],  default="search")
    parser.add_argument("--lat",      type=float, default=40.7128,   help="Latitude (search)")
    parser.add_argument("--lon",      type=float, default=-74.0060,  help="Longitude (search)")
    parser.add_argument("--image",    type=str,   default=None,      help="Menu image path (vision)")
    parser.add_argument("--calories", type=float, default=600)
    parser.add_argument("--protein",  type=float, default=40)
    parser.add_argument("--carbs",    type=float, default=50)
    parser.add_argument("--fats",     type=float, default=20)
    args = parser.parse_args()

    macro_fields = {
        "target_calories": args.calories,
        "target_protein":  args.protein,
        "target_carbs":    args.carbs,
        "target_fats":     args.fats,
    }

    if args.mode == "search":
        initial_state = {
            "searching_for_restaurant": True,
            "lat": args.lat, "lon": args.lon,
            "current_restaurant_index": 0,
            "image_b64": None,
            **macro_fields,
        }
    else:
        if not args.image:
            parser.error("--image is required for vision mode")
        image_bytes = Path(args.image).read_bytes()
        initial_state = {
            "searching_for_restaurant": False,
            "lat": None, "lon": None,
            "current_restaurant_index": 0,
            "image_b64": base64.b64encode(image_bytes).decode("utf-8"),
            **macro_fields,
        }

    print(f"\nMacroHunter Benchmark  |  mode={args.mode}  runs={args.runs}")
    print(f"Targets: {args.calories}kcal / {args.protein}g P / {args.carbs}g C / {args.fats}g F")
    if args.mode == "search":
        print(f"Location: ({args.lat}, {args.lon})")

    for i in range(1, args.runs + 1):
        total = await run_once(initial_state, i)
        _run_totals.append(total)

    print_report(_run_totals, _timings)


if __name__ == "__main__":
    asyncio.run(main())
