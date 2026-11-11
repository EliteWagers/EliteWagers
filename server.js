const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const CACHE = new Map();
const TTL = 30_000;
const ESPN = {
  nba:['basketball','nba'], wnba:['basketball','wnba'], nfl:['football','nfl'], cfb:['football','college-football'],
  cbb:['basketball','mens-college-basketball'], cbbw:['basketball','womens-college-basketball'], mlb:['baseball','mlb'], nhl:['hockey','nhl'],
  mls:['soccer','usa.1'], epl:['soccer','eng.1'], laliga:['soccer','esp.1'], bundesliga:['soccer','ger.1'], seriea:['soccer','ita.1'],
  ligue1:['soccer','fra.1'], ucl:['soccer','uefa.champions'], atp:['tennis','atp'], wta:['tennis','wta'], golf:['golf','pga'], ufc:['mma','ufc'], f1:['racing','f1']
};
function send(res,status,data,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);}
function cached(key){const v=CACHE.get(key);if(v&&Date.now()-v.at<TTL)return v.data;return null;}
function put(key,data){CACHE.set(key,{at:Date.now(),data});return data;}
async function fetchJson(url,opts={}){const r=await fetch(url,{...opts,headers:{'User-Agent':'EliteWagersResearch/5.0 (sports analytics project)',...(opts.headers||{})}});if(!r.ok)throw new Error(`Upstream provider returned ${r.status}`);return r.json();}
async function handler(req,res){
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
  if(u.pathname==='/api/health')return send(res,200,{ok:true,service:'Elite Wagers research gateway',fetchedAt:new Date().toISOString(),providers:{espn:{enabled:true,kind:'unofficial public endpoints'},openMeteo:{enabled:true},theOddsApi:{enabled:!!process.env.THE_ODDS_API_KEY},prizePicks:{enabled:!!(process.env.PRIZEPICKS_API_URL&&process.env.PRIZEPICKS_API_KEY)}}});
  if(u.pathname==='/api/espn/scoreboard'||u.pathname==='/api/espn/news'){
    const league=u.searchParams.get('league')||'nba',map=ESPN[league];if(!map)return send(res,400,{error:'Unsupported ESPN league key'});
    const date=u.searchParams.get('date');const key=`${u.pathname}:${league}:${date||'today'}`;const old=cached(key);if(old)return send(res,200,{...old,cached:true});
    const [sport,leagueSlug]=map;let endpoint;
    if(u.pathname.endsWith('/news'))endpoint=`https://site.api.espn.com/apis/site/v2/sports/${sport}/${leagueSlug}/news`;
    else endpoint=`https://site.api.espn.com/apis/site/v2/sports/${sport}/${leagueSlug}/scoreboard${date?`?dates=${encodeURIComponent(date)}`:''}`;
    try{const data=await fetchJson(endpoint);let result;
      if(u.pathname.endsWith('/news')){result={provider:'ESPN public JSON (unofficial)',fetchedAt:new Date().toISOString(),articles:(data.articles||[]).slice(0,30).map(a=>({headline:a.headline,description:a.description,published:a.published,link:a.links?.web?.href||a.links?.api?.news?.href||null}))};}
      else{result={provider:'ESPN public JSON (unofficial)',fetchedAt:new Date().toISOString(),events:(data.events||[]).map(e=>({name:e.name,date:e.date,status:e.status?.type?.description||e.status?.type?.name||'Scheduled',competitions:(e.competitions||[]).map(c=>({venue:c.venue?.fullName,competitors:(c.competitors||[]).map(t=>({name:t.team?.displayName||t.team?.name||'Team',score:t.score,homeAway:t.homeAway})),odds:c.odds?.[0]?.details||null}))}))};}
      return send(res,200,put(key,result));
    }catch(e){return send(res,502,{error:`ESPN feed unavailable: ${e.message}`});}
  }
  if(u.pathname==='/api/weather'){
    const location=(u.searchParams.get('location')||'').trim();if(!location)return send(res,400,{error:'Enter a venue location.'});const key='weather:'+location.toLowerCase(),old=cached(key);if(old)return send(res,200,{...old,cached:true});
    try{const geo=await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);const place=geo.results?.[0];if(!place)return send(res,404,{error:'Location not found by Open-Meteo.'});const forecast=await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code&forecast_days=3&timezone=auto`);return send(res,200,put(key,{...forecast,place:{name:place.name,admin1:place.admin1,country:place.country},fetchedAt:new Date().toISOString()}));}catch(e){return send(res,502,{error:`Weather provider unavailable: ${e.message}`});}
  }
  if(u.pathname==='/api/odds'){
    const key=process.env.THE_ODDS_API_KEY;if(!key)return send(res,503,{error:'THE_ODDS_API_KEY is not configured on the server.'});const sport=u.searchParams.get('sport')||'basketball_nba',markets=u.searchParams.get('markets')||'h2h,spreads,totals';const cacheKey=`odds:${sport}:${markets}`,old=cached(cacheKey);if(old)return send(res,200,{...old,cached:true});
    try{const data=await fetchJson(`https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/odds/?regions=us&markets=${encodeURIComponent(markets)}&oddsFormat=american&dateFormat=iso&apiKey=${encodeURIComponent(key)}`);return send(res,200,put(cacheKey,{provider:'The Odds API',fetchedAt:new Date().toISOString(),events:data}));}catch(e){return send(res,502,{error:`Odds provider unavailable: ${e.message}`});}
  }
  if(u.pathname==='/api/prizepicks/projections'){
    const endpoint=process.env.PRIZEPICKS_API_URL,token=process.env.PRIZEPICKS_API_KEY;if(!endpoint||!token)return send(res,503,{error:'Configure a licensed/authorized PrizePicks data provider URL and API key. No official public PrizePicks developer API is assumed.'});
    try{const target=new URL(endpoint);for(const [k,v] of u.searchParams)target.searchParams.set(k,v);const data=await fetchJson(target.toString(),{headers:{Authorization:`Bearer ${token}`,'x-api-key':token}});return send(res,200,{provider:'Configured third-party projections provider',fetchedAt:new Date().toISOString(),data:Array.isArray(data.data)?data.data:(Array.isArray(data)?data:[]),meta:data.meta||{}});}catch(e){return send(res,502,{error:`Projection provider unavailable: ${e.message}`});}
  }
  if(u.pathname==='/')return send(res,200,fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),'text/html; charset=utf-8');
  const safe=path.normalize(path.join(ROOT,u.pathname));if(!safe.startsWith(ROOT))return send(res,403,'Forbidden','text/plain');
  if(fs.existsSync(safe)&&fs.statSync(safe).isFile()){const ext=path.extname(safe);const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json'
