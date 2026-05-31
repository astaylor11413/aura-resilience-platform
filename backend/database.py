# Seed data for immediate local and deployed presentation
mock_ocean_anomalies = [
    {
        "name": "Caribbean Coral Bleaching Cluster A", "coordinates": [-76.80, 17.90], "temp_anomaly": 3.1, "plastic_density": 450.2
    },
    {  
        "name": "New York Bight Microplastic Accumulation Zone", "coordinates": [-73.90, 40.65], "temp_anomaly": 1.4, "plastic_density": 890.7
    },
    {
        "name": "Jamaica South-Shelf Algal Stress Hotspot", "coordinates": [-76.95, 17.85], "temp_anomaly": 2.8, "plastic_density": 310.4
    }
]

mock_supply_db = [
    {
        "restaurant_id": "rest-01",
        "restaurant_name": "Harlem Community Kitchen",
        "coordinates": [-73.94, 40.81], # [Lng, Lat]
        "meal_type": "Prepared Meals (Hot)",
        "portions_available": 250,
        "verification_permit": "NYC-HLTH-9941A"
    },
    {
        "restaurant_id": "rest-02",
        "restaurant_name": "Rockaway Coastal Diner",
        "coordinates": [-73.82, 40.58],
        "meal_type": "Dry Goods / MREs",
        "portions_available": 500,
        "verification_permit": "NYC-HLTH-1120B"
    }
]

mock_demand_db = [
    {
        "shelter_id": "shelter-01",
        "shelter_name": "East Harlem Evacuation Center (La Marqueta)",
        "coordinates": [-73.942, 40.80],
        "current_occupancy": 180,
        "meals_needed": 300,
        "urgency_level": "CRITICAL"
    },
    {
        "shelter_id": "shelter-02",
        "shelter_name": "Rockaway Peninsula Park Refuge",
        "coordinates": [-73.815, 40.585],
        "current_occupancy": 90,
        "meals_needed": 100,
        "urgency_level": "HIGH"
    }
]

