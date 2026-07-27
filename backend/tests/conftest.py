import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--e2e",
        action="store_true",
        default=False,
        help="Run end-to-end accuracy tests that hit real APIs (USDA, FatSecret, Gemini).",
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--e2e"):
        return  # user asked for e2e — run everything
    skip_e2e = pytest.mark.skip(reason="Need --e2e flag to run end-to-end accuracy tests")
    for item in items:
        if "e2e" in item.keywords:
            item.add_marker(skip_e2e)
