# Images

Served from the site root, so `/images/equipment/e0250-hospital-bed.png` in a `src` attribute.

| Folder | Holds |
| --- | --- |
| `equipment/` | Product photos, one per HCPCS code. Name files `<hcpcs-lowercase>-<slug>.png` |
| `vendors/` | Vendor logos |
| `brand/` | BestRx and hospice logos, icons |
| `people/` | Avatars for case managers, nurses, dispatchers |

The paths in `src/data/equipment_catalog.json`, `vendors.json`, `hospices.json`, and `users.json`
already follow this naming, so dropping a correctly named file in wires it up. Components must
handle a missing image gracefully; not every path has a file yet.
