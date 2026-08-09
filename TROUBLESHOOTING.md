# Troubleshooting — “the map is black / empty”

Work through these in order.

1. **Opaque weather overlay?**  
   WMS must use `TRANSPARENT=true` and `FORMAT=image/png`. All OpenGeo requests go through `buildOpenGeoWmsUrl` — if someone bypasses that factory, you get a solid black rectangle.

2. **Map container zero height?**  
   Resize the window or switch tabs; MapLibre needs a non-zero container. Hard-refresh if the layout collapsed.

3. **Basemap failed but overlays succeeded?**  
   You’d see colored blobs on black. Check OpenFreeMap / network. Overlays don’t replace the basemap.

4. **JavaScript error on load?**  
   Open the browser console and fix the *first* error. One crash can stop layer mounting.

5. **Something covering the map?**  
   A full-screen panel or modal. Use Reset (rotate icon in the map chrome).

6. **Stylesheet / service worker?**  
   Hard-refresh (cache disabled). SW version is `weatherstop-v5+`.

7. **Wrong product / region / zoom?**  
   Open Diagnostics (activity icon). Velocity/CC/etc. are US-only; some site products need z7+.

8. **Clear sky?**  
   A working layer over no weather looks blank. Pan to active alerts or scrub time.

Re-check upstreams anytime:

```bash
npm run check-endpoints
```
