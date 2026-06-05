import os
import sys
import logging
import time
import whitebox
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

wbt = whitebox.WhiteboxTools()
wbt.set_verbose_mode(True) # Turned this ON so you can see exactly what the engine is doing!

def reproject_to_meters(input_path, output_path, target_crs="EPSG:32618"):
    logging.info("🌐 Checking coordinate reference system...")
    with rasterio.open(input_path) as src:
        if src.crs == target_crs:
            logging.info("DEM is already perfectly projected in meters.")
            return input_path
        
        logging.info(f"🔄 Reprojecting DEM from {src.crs} to {target_crs} (UTM 18N)...")
        transform, width, height = calculate_default_transform(
            src.crs, target_crs, src.width, src.height, *src.bounds
        )
        kwargs = src.meta.copy()
        kwargs.update({
            'crs': target_crs,
            'transform': transform,
            'width': width,
            'height': height
        })

        with rasterio.open(output_path, 'w', **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    resampling=Resampling.bilinear
                )
    return output_path

def run_jamaica_simulation(dem_in, final_layer_out, surge_height_meters=3.5):
    start_time = time.time()
    logging.info("🏝️ Beginning Jamaica Advanced Flood Simulation Pipeline...")

    # 1. Force absolute system paths everywhere to prevent silent engine crashes
    base_dir = os.path.abspath("working_dir")
    os.makedirs(base_dir, exist_ok=True)
    
    dem_in_abs = os.path.abspath(dem_in)
    final_layer_out_abs = os.path.abspath(final_layer_out)
    
    projected_dem = os.path.join(base_dir, "jam_projected.tif")
    filled = os.path.join(base_dir, "jam_filled.tif")
    fpointer = os.path.join(base_dir, "jam_flow_ptr.tif")
    fac累 = os.path.join(base_dir, "jam_accum.tif")
    streams = os.path.join(base_dir, "jam_streams.tif")
    hand = os.path.join(base_dir, "jam_hand.tif")

    # Double check input exists
    if not os.path.exists(dem_in_abs):
        logging.error(f"Input DEM file not found at: {dem_in_abs}")
        return

    try:
        dem_ready = reproject_to_meters(dem_in_abs, projected_dem)

        # Step 1: Fill Depressions
        logging.info("Step 1/6: Filling topographic sinks/depressions...")
        wbt.fill_depressions(dem=dem_ready, output=filled)

        # Step 2: D8 Pointer
        logging.info("Step 2/6: Calculating D8 flow direction vectors...")
        wbt.d8_pointer(dem=filled, output=fpointer)

        # Step 3: D8 Flow Accumulation (Uses i=)
        logging.info("Step 3/6: Generating network flow accumulation maps...")
        wbt.d8_flow_accumulation(i=fpointer, output=fac累)

        # Step 4: Extract Streams
        logging.info("Step 4/6: Delineating primary river drainage channels...")
        wbt.extract_streams(flow_accum=fac累, output=streams, threshold=1000.0)

        # Step 5: Elevation Above Stream / HAND
        logging.info("Step 5/6: Processing Height Above Nearest Drainage (HAND) relative heights...")
        wbt.elevation_above_stream(dem=filled, streams=streams, output=hand)

        # Final sanity check before passing to rasterio matrix builder
        if not os.path.exists(hand):
            raise FileNotFoundError(f"The underlying engine failed to write the raw HAND raster matrix file to {hand}")

        # Step 6: Vector Masking
        logging.info(f"Step 6/6: Isolating zones vulnerable to a {surge_height_meters}m surge...")
        with rasterio.open(hand) as src:
            hand_matrix = src.read(1)
            flood_binary = (hand_matrix <= surge_height_meters) & (hand_matrix >= 0)
            
            meta = src.profile
            meta.update(dtype=rasterio.uint8, count=1, nodata=0)

            os.makedirs(os.path.dirname(final_layer_out_abs), exist_ok=True)
            with rasterio.open(final_layer_out_abs, 'w', **meta) as dst:
                dst.write(flood_binary.astype(rasterio.uint8), 1)

        elapsed = time.time() - start_time
        logging.info(f" Success! Simulation completed in {elapsed:.2f}s.")
        logging.info(f"Render-ready asset generated at: {final_layer_out_abs}")

    except Exception as e:
        logging.error(f"Critical Pipeline Failure: {str(e)}")

if __name__ == "__main__":
    run_jamaica_simulation(
        dem_in="config/jamaica_dem.tif",
        final_layer_out="frontend/public/layers/jamaica_flood_zone.tif",
        surge_height_meters=3.5
    )