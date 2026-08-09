# Reference — WxLive

`MASTER-PROMPT.md` and `README.md` describe the proven WxLive MVP.

`app.html` / `smoketest.js` were not in the drop folder when this port
started. Patterns (mandatory WMS transparency, OpenGeo layer names,
TIME ladder, failure isolation) were taken from those docs and verified
live against NOAA endpoints.

If you later add `app.html` here, keep it as the Leaflet reference —
WeatherStop uses MapLibre and should not paste the HTML wholesale.
