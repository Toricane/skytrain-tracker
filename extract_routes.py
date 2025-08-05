import csv
import json
from collections import defaultdict


def extract_transit_routes():
    """Extract route shapes from Google Transit data for all transit services"""

    # Transit route IDs and their colors
    transit_routes = {
        # SkyTrain lines
        "30052": {"name": "Millennium Line", "color": "#ffd204", "type": "skytrain"},
        "30053": {"name": "Expo Line", "color": "#005dab", "type": "skytrain"},
        "13686": {
            "name": "Canada Line",
            "color": "#009ac7",
            "type": "skytrain",
        },  # RapidBus lines - individual names but same color
        "37808": {
            "name": "R1 King George Blvd",
            "color": "#009f4a",
            "type": "rapidbus",
        },
        "38311": {"name": "R2 Marine Dr", "color": "#009f4a", "type": "rapidbus"},
        "37809": {"name": "R3 Lougheed Hwy", "color": "#009f4a", "type": "rapidbus"},
        "37810": {"name": "R4 41st Ave", "color": "#009f4a", "type": "rapidbus"},
        "37807": {"name": "R5 Hastings St", "color": "#009f4a", "type": "rapidbus"},
        "46604": {"name": "R6 Scott Rd", "color": "#009f4a", "type": "rapidbus"},
        # 99 B-Line
        "6641": {"name": "99 B-Line", "color": "#f37a22", "type": "bline"},
        # SeaBus
        "6771": {"name": "SeaBus", "color": "#87746b", "type": "seabus"},
    }

    # Read trips to get shape IDs for each route
    route_shapes = defaultdict(set)

    with open("google_transit/trips.txt", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_id = row["route_id"]
            shape_id = row["shape_id"]
            if route_id in transit_routes:
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

    for route_id, route_info in transit_routes.items():
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
                        "type": route_info["type"],
                        "shape_id": shape_id,
                    },
                }
                features.append(feature)

    # Create GeoJSON collection
    geojson = {"type": "FeatureCollection", "features": features}

    # Save to file
    with open("transit_routes.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

    print(f"Extracted {len(features)} route segments")
    print(f"Routes: {list(transit_routes.keys())}")

    return geojson


if __name__ == "__main__":
    extract_transit_routes()
