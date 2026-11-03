import unittest, importlib.util, tempfile, pathlib, datetime, json
import numpy as np
import xarray as xr
from zarr.storage import LocalStore
spec=importlib.util.spec_from_file_location('reader',pathlib.Path(__file__).parents[1]/'scripts/weather-zarr.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
class ZarrReaderTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.init=datetime.datetime(2026,11,1,tzinfo=datetime.timezone.utc)
  coords={'lead_time':np.array([1,2],dtype='timedelta64[h]'),'lat_0p1':[-4.0,-3.9],'lon_0p1':[39.6,39.7],'init_time':np.datetime64('2026-11-01T00:00:00','ns')}
  variables={name+'_'+s:(('lead_time','lat_0p1','lon_0p1'),np.ones((2,2,2))*(300 if name=='temperature_2m' else .001 if name=='total_precipitation_1hr' else 10)) for name in reader.VARIABLES for s in reader.STATS}
  xr.Dataset(variables,coords=coords).to_zarr(self.temp.name,mode='w',zarr_format=3,consolidated=False)
  reader.discover=lambda _: (self.init,'fixture');reader.ObjectStore=lambda *a,**k:LocalStore(self.temp.name,read_only=True)
  self.request={'from':'2026-11-01T00:00:00Z','to':'2026-11-01T02:00:00Z','bounds':{'west':39.59,'east':39.71,'south':-4.01,'north':-3.89},'max_bytes':1000000,'max_rows':100}
 def tearDown(self):self.temp.cleanup()
 def test_real_zarr_read_and_provenance(self):
  result=reader.read(self.request);self.assertEqual(len(result['rows']),8);self.assertGreater(result['bytes_read'],0);self.assertEqual(result['rows'][0]['temperature_2m_mean'],300);self.assertEqual(result['rows'][0]['lead_hours'],1)
 def test_budget_rejects_before_array_read(self):
  self.request['max_bytes']=1
  with self.assertRaises(Exception):reader.read(self.request)
 def test_row_budget_rejects(self):
  self.request['max_rows']=1
  with self.assertRaisesRegex(ValueError,'REQUIRES_TILING'):reader.read(self.request)
 def test_forecast_cannot_reach_backwards(self):
  self.request['from']='2026-10-31T23:00:00Z'
  with self.assertRaisesRegex(ValueError,'INVALID_FORECAST_WINDOW'):reader.read(self.request)
if __name__=='__main__':unittest.main()
