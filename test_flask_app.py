import unittest
import json
from unittest.mock import patch
from app import app

class TestAuraResilienceEngine(unittest.TestCase):

    def setUp(self):
        """Set up the local test client executor before each test run."""
        self.app = app.test_client()
        self.app.testing = True

    # 1. Test Enterprise Health Framework
    def test_health_endpoint(self):
        response = self.app.get('/api/v1/health')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['status'], 'healthy')
        self.assertIn('engine', data)

    # 2. Test Microgrid Kinetic Calculation Engine (Nominal Conditions)
    def test_grid_simulation_nominal_wind(self):
        # Testing baseline wind below the critical 55 mph asset structural threshold
        response = self.app.get('/api/v1/resilience/simulate-grid?wind_speed_mph=30.0')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['grid_state'], 'NOMINAL')
        self.assertGreater(data['calculated_der_output_kw'], 0.0)
        
        # Verify centralized infrastructure assets remain fully active
        for asset in data['assets']:
            if asset['type'] == 'Main-Transmission':
                self.assertIn('ONLINE', asset['status'])

    # 3. Test Microgrid Mutation & Island Mode (Extreme Conditions)
    def test_grid_simulation_extreme_wind(self):
        # Wind velocities >= 55 mph should trigger topological changes
        response = self.app.get('/api/v1/resilience/simulate-grid?wind_speed_mph=75.0')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['grid_state'], 'MUTATED_ISLANDED_MODE')
        
        # Verify main transmission grid line drops while localized hospital hubs isolate safely
        for asset in data['assets']:
            if asset['type'] == 'Main-Transmission':
                self.assertIn('CRITICAL', asset['status'])
            elif asset['type'] == 'Critical-Hospital-Node':
                self.assertIn('AUTONOMOUS', asset['status'])

    # 4. Test NOAA Coastal Inundation Simulation Processing
    def test_coastal_inundation_breach(self):
        # A 2.0-meter sea-level rise should breach both low-lying coordinates in database.py
        response = self.app.get('/api/v1/hazard/inundation?slr_meters=2.0')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['type'], 'FeatureCollection')
        self.assertGreater(len(data['features']), 0)
        self.assertEqual(data['features'][0]['properties']['topographical_barrier'], 'BREACHED')

    # 5. Test Spatial Nearest-Neighbor Routing Engine
    def test_mutual_aid_spatial_routing(self):
        response = self.app.get('/api/v1/mutual-aid/routes')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['type'], 'FeatureCollection')
        
        # Assert spatial math successfully established optimal coordinate paths
        if len(data['features']) > 0:
            route = data['features'][0]
            self.assertEqual(route['geometry']['type'], 'LineString')
            self.assertIn('origin', route['properties'])
            self.assertIn('destination', route['properties'])

    # 6. Test AI Translation Bypass (Mocking Whisper Audio Inputs)
    @patch('app.openai_client.audio.transcriptions.create')
    def test_whisper_voice_ingestion_mocked(self, mock_whisper):
        # Force mock object return value to test integration handling without calling external server network
        mock_whisper.return_value.text = "De floodwaters break past de main seawall road."
        
        # Simulate posting a mock audio data format boundary chunk
        response = self.app.post(
            '/api/v1/voice/report',
            data={'audio': (open(__file__, 'rb'), 'test.wav')},
            content_type='multipart/form-data'
        )
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('transcription', data)

if __name__ == '__main__':
    unittest.main()