import csv
import json
from collections import defaultdict


def extract_skytrain_routes():
    """Extract SkyTrain route shapes from Google Transit data"""

    # SkyTrain route IDs and their colors
    skytrain_routes = {
        "30052": {"name": "Millennium Line", "color": "#ffd204"},
        "30053": {"name": "Expo Line", "color": "#005dab"},
        "13686": {"name": "Canada Line", "color": "#009ac7"},
    }

    # Read trips to get shape IDs for each route
    route_shapes = defaultdict(set)

    with open("google_transit/trips.txt", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_id = row["route_id"]
            shape_id = row["shape_id"]
            if route_id in skytrain_routes:
                route_shapes[route_id].add(shape_id)

    # Read shapes data
    shapes_data = defaultdict(list)

    with open("google_transit/shapes.txt", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            shape_id = row["shape_id"]
            if any(shape_id in shapes for shapes in route_shapes.values()):
                shapes_data[shape_id].append(
                    {
                        "lat": float(row["shape_pt_lat"]),
                        "lon": float(row["shape_pt_lon"]),
                        "sequence": int(row["shape_pt_sequence"]),
                    }
                )

    # Sort points by sequence for each shape
    for shape_id in shapes_data:
        shapes_data[shape_id].sort(key=lambda x: x["sequence"])

    # Create GeoJSON features
    features = []

    for route_id, route_info in skytrain_routes.items():
        for shape_id in route_shapes[route_id]:
            if shape_id in shapes_data:
                # Create LineString coordinates
                coordinates = [
                    [point["lon"], point["lat"]] for point in shapes_data[shape_id]
                ]

                feature = {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coordinates},
                    "properties": {
                        "route_id": route_id,
                        "route_name": route_info["name"],
                        "color": route_info["color"],
                        "shape_id": shape_id,
                    },
                }
                features.append(feature)

    # Create GeoJSON collection
    geojson = {"type": "FeatureCollection", "features": features}

    # Save to file
    with open("skytrain_routes.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

    print(f"Extracted {len(features)} route segments")
    print(f"Routes: {list(skytrain_routes.keys())}")

    return geojson


if __name__ == "__main__":
    extract_skytrain_routes()
