# QA — v1.6

Automated verification covers:

- server version 1.6.0;
- SQLite schema migration 3;
- Trainer details persistence round-trip;
- Background persistence;
- Feature/Edge/Move reference persistence;
- Trainer current HP/AP persistence;
- Trainer selected tab persistence;
- absence of browser-native prompt/confirm/alert calls;
- presence of the styled modal framework;
- presence of functional Trainer tabs and Ruleset pickers.

Expected output:

```text
PTU Companion v1.6 verification: OK
Pokédex-styled modal framework: passed
No browser-native prompt/confirm/alert calls: passed
Trainer details SQLite migration/round-trip: passed
Trainer tabs, Background, Skills, Stats and Ruleset pickers: present
```
