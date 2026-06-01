# Seed data for immediate local and deployed presentation
mock_grid_substations = [
    {
        "id": "sub-01", 
        "graph_index": 0, # Added for GNN alignment
        "name": "Kingston General Hospital Backup Node", 
        "type": "Critical-Hospital-Node", 
        "coordinates": [-76.78, 17.97]
    },
    {
        "id": "sub-02", 
        "graph_index": 1, # Added for GNN alignment
        "name": "Palisadoes Spit Main Transmission Feed", 
        "type": "Main-Transmission", 
        "coordinates": [-76.75, 17.94]
    },
    {
        "id": "sub-03", 
        "graph_index": 2, # Added for GNN alignment
        "name": "Portmore Micro-Wind Turbine Array A", 
        "type": "Microgrid-Hub", 
        "coordinates": [-76.88, 17.95]
    }
]

mock_coastal_dem = [
    {
        "name": "Palisadoes Spit Flood Zone Delta",
        "elevation_m": 0.5,
        "polygon_coordinates": [[
            [-76.76, 17.93], 
            [-76.74, 17.93], 
            [-76.74, 17.95], 
            [-76.76, 17.95], 
            [-76.76, 17.93]
        ]]
    },
    {
        "name": "Portmore Low-Lying Coastal Buffer",
        "elevation_m": 1.5,
        "polygon_coordinates": [[
            [-76.90, 17.93], 
            [-76.86, 17.93], 
            [-76.86, 17.96], 
            [-76.90, 17.96], 
            [-76.90, 17.93]
        ]]
    }
]

mock_ocean_anomalies = [
    {
        "name": "Caribbean Coral Bleaching Cluster A",
        "coordinates": [-76.80, 17.90],
        "temp_anomaly": 3.1,
        "plastic_density": 450.2
    },
    {  
        "name": "New York Bight Microplastic Accumulation Zone", 
        "coordinates": [-73.90, 40.65], 
        "temp_anomaly": 1.4, 
        "plastic_density": 890.7
    },
    {
        "name": "Jamaica South-Shelf Algal Stress Hotspot", 
        "coordinates": [-76.95, 17.85], 
        "temp_anomaly": 2.8, 
        "plastic_density": 310.4
    }
]

# Supply/Demand Network
mock_supply_db = [
    {"restaurant_id": "rest-01", "restaurant_name": "Kingston Central Kitchen", "coordinates": [-76.79, 17.98], "verification_permit": "JAM-FOOD-001"},
    {"restaurant_id": "rest-02", "restaurant_name": "Portmore Community Hub", "coordinates": [-76.88, 17.96], "verification_permit": "JAM-FOOD-002"},
    {"restaurant_id": "rest-03", "restaurant_name": "St. Andrew Relief Station", "coordinates": [-76.77, 18.01], "verification_permit": "JAM-FOOD-003"}
]

mock_demand_db = [
    {"shelter_id": "shelter-01", "shelter_name": "National Arena Center", "coordinates": [-76.77, 17.99], "urgency_level": "CRITICAL"},
    {"shelter_id": "shelter-02", "shelter_name": "Portmore Civic Refuge", "coordinates": [-76.89, 17.94], "urgency_level": "HIGH"},
    {"shelter_id": "shelter-03", "shelter_name": "Papine Academic Shelter", "coordinates": [-76.74, 18.02], "urgency_level": "MEDIUM"}
]