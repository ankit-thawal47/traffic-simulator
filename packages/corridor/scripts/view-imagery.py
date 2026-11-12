#!/usr/bin/env python3
"""Fetches satellite imagery tiles around a point and stitches them, for checking
lanes and widths by eye. The image is for looking at only: it is not committed.

  python3 packages/corridor/scripts/view-imagery.py <lat> <lon> <out.jpg> [tiles each side, default 1] [zoom, default 19]

Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics and the GIS user
community). The picture carries a scale bar: one tile at zoom 19 at this latitude
is about 74.5 m across.
"""
import io
import math
import sys
import urllib.request

from PIL import Image, ImageDraw

lat, lon, out = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
side = int(sys.argv[4]) if len(sys.argv) > 4 else 1
zoom = int(sys.argv[5]) if len(sys.argv) > 5 else 19

n = 2**zoom
xf = (lon + 180) / 360 * n
yf = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
x0, y0 = int(xf) - side, int(yf) - side
size = 2 * side + 1
picture = Image.new("RGB", (256 * size, 256 * size))
for dx in range(size):
    for dy in range(size):
        url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{y0 + dy}/{x0 + dx}"
        request = urllib.request.Request(url, headers={"User-Agent": "corridor-importer/0.1"})
        with urllib.request.urlopen(request, timeout=30) as response:
            picture.paste(Image.open(io.BytesIO(response.read())), (256 * dx, 256 * dy))

metres_per_pixel = 156543.03392 * math.cos(math.radians(lat)) / n
draw = ImageDraw.Draw(picture)
bar = round(20 / metres_per_pixel)
draw.rectangle([10, 10, 10 + bar, 16], fill=(255, 255, 0))
draw.text((10, 20), "20 m", fill=(255, 255, 0))
picture.save(out, quality=85)
print(f"{out}: {picture.size[0]} px square, {metres_per_pixel:.3f} m per pixel")
