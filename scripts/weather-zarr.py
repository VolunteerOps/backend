"""Read only a bounded region/window from WeatherNext statistics. No model-selected URLs or code."""
import sys, json, asyncio, re, datetime, os
import numpy as np
import xarray as xr
import zarr
import obstore
from zarr.storage import WrapperStore, ObjectStore
from zarr.abc.store import RangeByteRequest, OffsetByteRequest, SuffixByteRequest
import google.auth
from google.auth.transport.requests import AuthorizedSession
BUCKET = "weathernext3_statistics_spatial"
ROOT = "weathernext_3_0_0_statistics/zarr/2026_to_present/"
VARIABLES = ["temperature_2m", "wind_speed_10m", "total_precipitation_1hr"]
STATS = ["mean", "p10", "p25", "p50", "p75", "p90"]
class BudgetStore(WrapperStore):
    def __init__(self, store, limit):
        super().__init__(store); self.limit=limit; self.reserved=0; self.received=0; self.requests=0
    def with_read_only(self, read_only=False):
        if not read_only: raise ValueError("READ_ONLY_STORE")
        return self
    async def get(self,key,prototype,byte_range=None):
        try: size=await self._store.getsize(key)
        except FileNotFoundError: return None
        if isinstance(byte_range,RangeByteRequest): length=min(size,byte_range.end)-byte_range.start
        elif isinstance(byte_range,OffsetByteRequest): length=size-byte_range.offset
        elif isinstance(byte_range,SuffixByteRequest): length=min(size,byte_range.suffix)
        else: length=size
        length=max(0,length)
        # Reserve before the read. Concurrent tasks cannot exceed the total transfer budget.
        if self.reserved+length>self.limit or self.requests>=2000: raise ValueError("GCS_READ_BUDGET")
        self.reserved+=length; self.requests+=1
        result=await self._store.get(key,prototype,byte_range)
        if result is not None:self.received+=len(result)
        return result
    async def get_partial_values(self,prototype,key_ranges):
        return [await self.get(key,prototype,byte_range) for key,byte_range in key_ranges]
    async def get_ranges(self,key,byte_ranges,*,prototype,**kwargs):
        for index,request in enumerate(byte_ranges):yield [(index,await self.get(key,prototype,request))]

def discover(from_time):
    credentials,_=google.auth.default(scopes=['https://www.googleapis.com/auth/devstorage.read_only'])
    session=AuthorizedSession(credentials)
    anchor=min(datetime.datetime.fromisoformat(from_time.replace('Z','+00:00')),datetime.datetime.now(datetime.timezone.utc))
    # At most two date-prefix listings. Never list the entire archive.
    candidates=[]
    for day in range(2):
        date=(anchor-datetime.timedelta(days=day)).strftime('%Y%m%d')
        response=session.get('https://storage.googleapis.com/storage/v1/b/'+BUCKET+'/o',params={'prefix':ROOT+date+'_','delimiter':'/','maxResults':100,'fields':'prefixes,nextPageToken'},timeout=15)
        response.raise_for_status()
        for prefix in response.json().get('prefixes',[]):
            match=re.search(r'/(\d{8})_(\d{2})hr_[^/]+/$',prefix)
            if not match:continue
            init=datetime.datetime.strptime(match[1]+match[2],'%Y%m%d%H').replace(tzinfo=datetime.timezone.utc)
            if init<=anchor and init.hour%6==0 and (anchor-init).total_seconds()<=30*3600:candidates.append((init,prefix+'predictions.zarr'))
    if not candidates:raise ValueError('FORECAST_RUN_UNAVAILABLE')
    return max(candidates)

def read(request):
    init,prefix=discover(request['from'])
    store=BudgetStore(ObjectStore(obstore.store.GCSStore(bucket=BUCKET,prefix=prefix),read_only=True),int(request['max_bytes']))
    zarr.config.set({'async.concurrency':2,'threading.max_workers':2})
    ds=xr.open_zarr(store,chunks={},consolidated=False)
    actual=np.asarray(ds['init_time'].values).reshape(-1)
    expected=np.datetime64(init.replace(tzinfo=None),'ns')
    if actual.size!=1 or actual[0]!=expected:raise ValueError('FORECAST_TIME_MISMATCH')
    names=[v+'_'+s for v in VARIABLES for s in STATS]
    if any(n not in ds for n in names):raise ValueError('GCS_VARIABLES_UNAVAILABLE')
    for name in names:
        chunks=ds[name].encoding.get('chunks')
        if chunks and np.prod(chunks)*ds[name].dtype.itemsize>64000000:raise ValueError('GCS_DECODE_BUDGET')
    b=request['bounds']; lat=np.asarray(ds['lat_0p1'].values);lon=np.asarray(ds['lon_0p1'].values);normal=(lon+180)%360-180
    y=np.where((lat+.05>=b['south'])&(lat-.05<=b['north']))[0]
    east=b['east'] if b['east']>b['west'] else b['east']+360
    x=np.where(np.logical_or.reduce([(normal+shift+.05>=b['west'])&(normal+shift-.05<=east) for shift in [-360,0,360]]))[0]
    start=np.datetime64(request['from'].replace('Z',''));end=np.datetime64(request['to'].replace('Z',''))
    first=int((start-expected)/np.timedelta64(1,'h'))+1;last=int((end-expected)/np.timedelta64(1,'h'))
    if first<1 or last>360 or last-first>47:raise ValueError('INVALID_FORECAST_WINDOW')
    count=len(x)*len(y)*(last-first+1)
    if count==0:raise ValueError('FORECAST_RUN_UNAVAILABLE')
    if count>request['max_rows']:raise ValueError('FORECAST_RESULT_REQUIRES_TILING')
    subset=ds[names].isel(lat_0p1=y,lon_0p1=x).sel(lead_time=[np.timedelta64(h,'h') for h in range(first,last+1)])
    for dim in list(subset.dims):
        if dim not in ['lat_0p1','lon_0p1','lead_time']:
            if subset.sizes[dim]!=1:raise ValueError('UNEXPECTED_FORECAST_DIMENSION')
            subset=subset.isel({dim:0},drop=True)
    subset=subset.compute(scheduler='single-threaded')
    arrays={name:np.asarray(subset[name].transpose('lead_time','lat_0p1','lon_0p1').values) for name in names}
    rows=[]
    for hi,h in enumerate(range(first,last+1)):
        valid=(init+datetime.timedelta(hours=h)).isoformat().replace('+00:00','Z')
        for yi,lat_index in enumerate(y):
            for xi,lon_index in enumerate(x):
                row={'init_time':init.isoformat().replace('+00:00','Z'),'valid_time':valid,'lead_hours':h,'latitude':float(lat[lat_index]),'longitude':float(normal[lon_index])}
                for name in names:
                    value=float(arrays[name][hi,yi,xi]);row[name]=value if np.isfinite(value) else None
                rows.append(row)
    return {'source_id':'gs://'+BUCKET+'/'+prefix,'init_time':init.isoformat().replace('+00:00','Z'),'bytes_read':store.received,'read_requests':store.requests,'rows':rows}
if __name__=='__main__':
    try: print(json.dumps(read(json.load(sys.stdin)),allow_nan=False))
    except Exception as exc:
        message=str(exc)
        safe=message if re.fullmatch('[A-Z_]{5,80}',message) else 'GCS_ACCESS_DENIED' if '403' in message or 'Forbidden' in message else 'GCS_READ_FAILED'
        print(json.dumps({'error':safe}));sys.exit(1)
