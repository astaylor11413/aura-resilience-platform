SOCIAL_COST_OF_CARBON_USD = 190.0

def calculate_marine_economic_impact(anomaly_name: str, temp_anomaly: float, plastic_density: float) -> dict:
    try:
        temp_val = float(temp_anomaly) if temp_anomaly else 0.0
        plastic_val = float(plastic_density) if plastic_density else 0.0
        eco_loss_usd = 0.0
        blue_carbon_tons_lost = 0.0
        name_str = str(anomaly_name)

        if "Coral Bleaching" in name_str:
            fishery_loss = 450000.0 * min(1.0, temp_val * 0.22)
            coastal_protection_loss = 2500000.0 * min(1.0, temp_val * 0.18)
            eco_loss_usd = fishery_loss + coastal_protection_loss
            blue_carbon_tons_lost = 15.0 * 8.5 * min(1.0, temp_val * 0.15)

        elif "Pedro Bank" in name_str:
            eco_loss_usd = (temp_val * 125000.0) + (plastic_val * 8500.0)
            blue_carbon_tons_lost = 45.0 * 2.1 * min(1.0, temp_val * 0.08)

        elif "Algal Stress" in name_str:
            eco_loss_usd = ((temp_val ** 1.5) * 95000.0) + (plastic_val * 12000.0)
            blue_carbon_tons_lost = 20.0 * 4.5 * min(1.0, temp_val * 0.12)

        else:
            eco_loss_usd = temp_val * 50000.0
            blue_carbon_tons_lost = temp_val * 2.0

        carbon_valuation_usd = blue_carbon_tons_lost * SOCIAL_COST_OF_CARBON_USD
        total_risk_exposure_usd = eco_loss_usd + carbon_valuation_usd

        result = {
            "direct_economic_loss_usd": round(eco_loss_usd, 2),
            "blue_carbon_tons_lost": round(blue_carbon_tons_lost, 2),
            "carbon_liability_usd": round(carbon_valuation_usd, 2),
            "total_risk_exposure_usd": round(total_risk_exposure_usd, 2)
        }
        
        # Terminal debug output: Check your Flask terminal output!
        print(f"[VALUATION ENGINE] {name_str} => {result}")
        return result

    except Exception as e:
        print(f"[VALUATION ENGINE ERROR] Failed for {anomaly_name}: {e}")
        return {
            "direct_economic_loss_usd": 0.0,
            "blue_carbon_tons_lost": 0.0,
            "carbon_liability_usd": 0.0,
            "total_risk_exposure_usd": 0.0
        }