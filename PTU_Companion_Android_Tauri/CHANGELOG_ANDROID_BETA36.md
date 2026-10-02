# Android beta.36 — correção completa da tela de Trainer

Build de validação da issue #66, incluindo as correções da Stance Change da #58. Corrige chamadas remanescentes a `slug()` sem definição ao renderizar Features/Edges e ao usar Bind/Unbind/Remove de Silent Assassin. Use esta beta no lugar da beta.35.

- Android ARM64, versionCode 2002036; certificado igual à beta.35.
- Atualize instalando por cima da beta.35, sem desinstalar nem limpar dados, para preservar a campanha.
- Confirme que o Trainer aparece no menu e abra sua ficha com as Features já salvas.
- Abra a aba Features; verifique Silent Assassin e teste Bind, Unbind e Remove somente se estiver usando uma cópia de teste do save.
- Feche e reabra o app, confira Trainer, Features e persistência.
- Na ficha de Aegislash, reteste os stats completos em Sword/Shield Stance conforme o roteiro da issue #58.

As suítes Windows/Android e CI devem passar. A issue permanece aberta aguardando validação no aplicativo; não é uma release pública.
