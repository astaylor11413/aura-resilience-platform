

# 2026 EPA Benchmark for Social Cost of Carbon (USD per metric ton CO2e)
SOCIAL_COST_OF_CARBON_USD = 190.0

def calculate_marine_economic_impact(anomaly_name: str, temp_anomaly: float, plastic_density: float) -> dict:
    """
    Computes direct economic risk exposure, blue carbon losses, 
    and carbon monetary liability based on environmental anomaly parameters.
    """
    eco_loss_usd = 0.0
    blue_carbon_tons_lost = 0.0
    
    if "Coral Bleaching Cluster A" in anomaly_name:
        # Artisanal fishing loss + coastal storm protection loss
        fishery_loss = 450000.0 * min(1.0, temp_anomaly * 0.22)
        coastal_protection_loss = 2500000.0 * min(1.0, temp_anomaly * 0.18)
        eco_loss_usd = fishery_loss + coastal_protection_loss
        
        # 15 Hectares * 8.5 tCO2e/ha * bleaching degradation ratio
        blue_carbon_tons_lost = 15.0 * 8.5 * min(1.0, temp_anomaly * 0.15)

    elif "Pedro Bank" in anomaly_name:
        # Vessel clearance overhead + fishing disruption
        eco_loss_usd = (temp_anomaly * 125000.0) + (plastic_density * 8500.0)
        # 45 Hectares * 2.1 tCO2e/ha * pelagic gyre disruption
        blue_carbon_tons_lost = 45.0 * 2.1 * min(1.0, temp_anomaly * 0.08)

    elif "Algal Stress Hotspot" in anomaly_name:
        # HAB cleanup + shellfish ban economic impact
        eco_loss_usd = ((temp_anomaly ** 1.5) * 95000.0) + (plastic_density * 12000.0)
        # 20 Hectares * 4.5 tCO2e/ha * toxic threshold impact
        blue_carbon_tons_lost = 20.0 * 4.5 * min(1.0, temp_anomaly * 0.12)
        
    else:
        # Generic baseline estimation fallback
        eco_loss_usd = temp_anomaly * 50000.0
        blue_carbon_tons_lost = temp_anomaly * 2.0

    carbon_valuation_usd = blue_carbon_tons_lost * SOCIAL_COST_OF_CARBON_USD
    total_risk_exposure_usd = eco_loss_usd + carbon_valuation_usd

    return {
        "direct_economic_loss_usd": round(eco_loss_usd, 2),
        "blue_carbon_tons_lost": round(blue_carbon_tons_lost, 2),
        "carbon_liability_usd": round(carbon_valuation_usd, 2),
        "total_risk_exposure_usd": round(total_risk_exposure_usd, 2)
    }