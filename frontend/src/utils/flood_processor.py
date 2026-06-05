import os
import whitebox
import rasterio
import richdem as rd

wbt = whitebox.WhiteboxTools()

def generate_flood_zone(dem_path, output_flood_path, flood_depth_meters=2.0):
    """
    Replicates ArcGIS Pro Advanced Hydrology toolset for flood delineation.
    """
    print("Step 1: Filling topographic depressions (Sinks)...")
    # ArcGIS equivalent: Fill tool
    filled_dem = "working_dir/filled_dem.tif"
    wbt.fill_depressions(dem=dem_path, output=filled_dem)

    print("Step 2: Calculating Flow Direction...")
    # ArcGIS equivalent: Flow Direction (D8) tool
    flow_dir = "working_dir/flow_dir.tif"
    wbt.flow_pointer_d8(dem=filled_dem, output=flow_dir)

    print("Step 3: Extracting Stream Network paths...")
    # ArcGIS equivalent: Flow Accumulation & Stream Definition
    flow_accum = "working_dir/flow_accum.tif"
    wbt.flow_accumulation_d8(dem=filled_dem, output=flow_accum)
    
    streams = "working_dir/streams.tif"
    wbt.extract_streams(flow_accum=flow_accum, output=streams, threshold=500.0)

    print("Step 4: Generating Height Above Nearest Drainage (HAND) matrix...")
    # ArcGIS Pro Advanced equivalent: Cost Distance / Vertical allocation
    hand_raster = "working_dir/hand.tif"
    wbt.elevation_above_stream(dem=filled_dem, streams=streams, output=hand_raster)

    print(f"Step 5: Binarizing map for a {flood_depth_meters}m flood threshold...")
    # Read the HAND raster and mask everything below our flood level
    with rasterio.open(hand_raster) as src:
        hand_data = src.read(1)
        # 1 if the land is lower than the flood depth, 0 if it remains dry
        flood_mask = (hand_data <= flood_depth_meters) & (hand_data >= 0)
        
        profile = src.profile
        profile.update(dtype=rasterio.uint8, count=1)

        with rasterio.open(output_flood_path, 'w', **profile) as dst:
            dst.write(flood_mask.astype(rasterio.uint8), 1)
            
    print(f"Success! Open-source flood layer generated at: {output_flood_path}")

if __name__ == "__main__":
    os.makedirs("working_dir", exist_ok=True)
    generate_flood_zone(
        dem_path="config/terrain_elevation.tif", 
        output_flood_path="src/frontend/public/layers/flood_zone_output.tif",
        flood_depth_meters=3.5
    )