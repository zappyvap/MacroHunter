from pydantic import BaseModel
import requests
import time
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import os

load_dotenv()
mcp = FastMCP("Restaurant Finder")
 
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
RESULT_LIMIT = 15

# make the pydantic model for the input so that it automatically validates and parses the input for us, 
# and also serves as documentation for what the input should look like
class LocationDetails(BaseModel):
    lat: float
    lon: float
    radius: float

@mcp.tool()
def restaurant_finder(location_details : LocationDetails) -> list[dict]:
    """
    This tool takes in a user's location (latitude and longitude) and a search radius in miles, 
    then uses the Google Places API to find nearby restaurants. 
    It returns a list of restaurants with their name, address, rating, total ratings, and a photo URL if available.

    The input dictionary should have the following structure:
    {
        "lat": 42.3601,  # Latitude of the user's location
        "lon": -71.0589, # Longitude of the user's location
        "radius": 5 # Search radius in miles
    }
    """
    radius_meters = int(location_details.radius * 1609.34) # convert miles to meters
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json" # endpoint for nearby search in Google Places API

    params = { # parameters for the API request
        "location": f"{location_details.lat},{location_details.lon}",
        "radius": radius_meters,
        "type": "restaurant",
        "key": GOOGLE_API_KEY,
    }

    restaurants = []

    while True: # this loop gets all the restaurants from the API, handling pagination with next_page_token
        resp = requests.get(url, params=params).json()

        for place in resp.get("results", []):

            if len(restaurants) >= RESULT_LIMIT:
                break

            # gets photo if it exists
            photos = place.get("photos", [])
            photo_url = None
            if photos:
                ref = photos[0]["photo_reference"]
                photo_url = (
                    f"https://maps.googleapis.com/maps/api/place/photo"
                    f"?maxwidth=400&photoreference={ref}&key={GOOGLE_API_KEY}"
                )

            # makes a new restaurant dictionary and adds it to the list of restaurants
            location = place.get("geometry", {}).get("location", {})
            restaurants.append({
                "name": place.get("name"),
                "address": place.get("vicinity"),
                "rating": place.get("rating"),
                "total_ratings": place.get("user_ratings_total"),
                "photo_url": photo_url,
                "latitude": location.get("lat"),
                "longitude": location.get("lng"),
            })

        # checks if there is a next page token for more results, and if so, waits the required time before making the next request
        next_token = resp.get("next_page_token")
        if not next_token or len(restaurants) >= RESULT_LIMIT:
            break

        time.sleep(2)  # Google requires a short delay before next page token is valid
        params = {"pagetoken": next_token, "key": GOOGLE_API_KEY}

    return restaurants


if __name__ == "__main__":
    mcp.run()