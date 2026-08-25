# need to make it so it only runs the fetching
# locations and menus

import os, json
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, REPO_ROOT)
from mcp_servers import *

from mcp_servers.restaurant_finder import restaurant_finder
from mcp_servers.chain_reader import search_chain_restaurant

LAT = 42.747941
LONG = -71.023802

# get restaurants
restaurants = restaurant_finder(
    lat=LAT, 
    long=LONG,
    radius=25
)

# run menu fetching and this will save to cache
for restaurant in restaurants:
    search_chain_restaurant(restaurant["name"], LAT, LONG)
