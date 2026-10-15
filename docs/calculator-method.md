# Calculator method (owner's decision, 2026-10-15)

Principles for every layered material (adhesives, plasters, screeds, putties):

1. **The base is assumed flat.** Unevenness is entered separately by the user: as extra layer thickness or as a separate "base levelling" line. The calculator never hides it inside a coefficient.
2. **Input: layer thickness `h`, mm.** Each card carries `min_layer_mm`; tile adhesive: 3 mm (thinner is not achievable). Values below the minimum are refused with an explanation, never silently clamped.
3. **Consumption per 1 mm of thickness** (`kg/m²/mm`) comes from the manufacturer's data sheet. If the sheet does not give it: `bulk_density_kg_per_m3 / 1000` (1 mm over 1 m² is 1 litre). The data-sheet value always wins; the source of the figure is shown.
4. **Output:** `kg/m² = h × consumption_per_mm`, and **area covered by one bag** `= pack_kg / (kg/m²)`. Always shown per m², per work volume and per bag.
5. **No technique coefficients** (trowel angle and similar) unless calibrated from measured data (weighed adhesive vs laid area on real objects). Such data, when available, is stored as `confirmed_on_sites`.
6. Notched-trowel input maps to a layer thickness on a flat base: square notch 10 mm at 90° → 5 mm average layer (notch depth × filled share 10/20).
7. Grout: joint volume `(L+W)/(L×W) × tile_thickness × joint_width` per m², times the grout density from its data sheet, plus a loss allowance.

Worked example (tile 250×250×10, joint 2, 10 mm trowel at 90°, adhesive bulk density 1500): layer 5 mm → 7.5 kg/m² → 3.3 m² per 25 kg bag; grout ≈ 0.3 kg/m².
