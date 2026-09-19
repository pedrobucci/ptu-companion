# QA — PTU Companion v1.1

Automated command:

```text
VERIFY_V11.bat
```

Validated cases:

1. Base Relations fail for a deliberately invalid Attack allocation before Attack Conflict.
2. Binding Attack Conflict to Attack removes that Stat from Base Relations.
3. Attack Conflict acquisition without an explicit Attack / Special Attack target is rejected.
4. A Species without the Underdog Capability cannot acquire Underdog's Strength.
5. An eligible Level 30 Starly with the Underdog Capability passes the Underdog's Strength requirement.
6. The restat endpoint carries HP and Attack Conflict exemptions into validation.
7. Creature reference data resolves all 18 attacking Types for the Type tab.
8. Move provenance survives definition resolution.
9. Static UI contains functional tab routing, Tutor pool visibility, Attack Conflict buttons and Stat redistribution entry points.

Expected result:

```text
PTU Companion v1.1 verification: OK
Attack Conflict hard binding + Base Relations exemption: passed
Underdog Capability gating: passed
Tutor provenance + 3-slot non-natural pool UI: present
Creature tabs + Type profile endpoint: passed
Permanent Stat redistribution preview: passed
```
