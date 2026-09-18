# QA — PTU Companion v1.3

`VERIFY_V13.bat` covers the Ability-resolution regression reported during manual testing.

The test constructs a Level 30 Ceruledge with:

- Flash Fire as its starting Ability;
- Defiant as the Level 20 choice;
- Mixed Power owned;
- no explicit Twisted Power record, simulating an older save.

Expected resolution:

- Flash Fire is present and labeled as a starting Ability.
- Defiant is present and labeled as the Level 20 choice.
- Twisted Power is present and attributed to Mixed Power.

The verifier also checks the Ability correction endpoint and the v2 modifier summary.
