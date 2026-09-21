# PTU Companion Android v2.2.0-beta.21

Fakemon 1 leva v2.0.0 bundled defaults + offline artwork, preserving the beta.20 Pokédex artwork fixes.

# PTU Companion v2.2.0-android-beta.21

## Beta.21 — Fakemon 1 leva v2

A build inclui `campaign-homebrew-fakemon-1-leva` v2.0.0 como conteúdo padrão. Os 13 Pokémon da campanha, 8 Moves, 3 Abilities e retratos offline são carregados pelo runtime embutido; não é necessário importar o `.ptucp` manualmente. Hisuian Zorua e Hisuian Zoroark permanecem formas regionais separadas. O `versionCode` Android foi elevado para `2002021` para permitir atualização sobre a beta.20 quando o APK for assinado com o mesmo certificado.

## Beta.16 — Weapons v2 e Arcane Weapons

A resolução de armas importadas agora reconhece o contrato completo do pack `campaign-homebrew-custom-weapons` v2.0.0. Arcane Weapons usam **Occult Education**, ataques **Special** e os tiers **Adept/Master** da PTU 1.05 Editation. Armas de duas mãos reservam a Off Hand; bônus estáticos de Living Weapons, como Evasion, são aplicados apenas enquanto equipadas. Regras condicionais de alquimia/artefatos que dependem de alvo, crítico, fraqueza ou frequência de Scene são exibidas como efeitos contextuais em vez de serem aplicadas permanentemente.

## beta.13 — Trainer Abilities

A ficha do Trainer agora possui a aba **Abilities**. Abilities concedidas por Features, Edges e outros efeitos suportados são exibidas automaticamente com sua origem e regra. A aba participa da barra horizontal rolável no Android e não exige migração de save.

## Hotfix beta.11 — Pokémon Sex

Pokémon creation and **Creature Sheet → Edit Identity** again expose Sex with `None`, `Male`, and `Female`; the value is preserved in local saves and exports.

Primeira beta Android focada em uso de campanha. A edição Android contém as funcionalidades de jogo do PTU Companion e oculta as ferramentas de edição/autoria, que permanecem exclusivas do desktop.

## Instalação

1. Copie `PTU-Companion-v2.2.0-beta.21-arm64-release.apk` para o telefone.
2. Abra o arquivo pelo gerenciador de arquivos.
3. Se o Android solicitar, autorize temporariamente a instalação de apps desconhecidos para o aplicativo usado para abrir o APK.
4. Instale/atualize e abra **PTU Companion**.

Para atualizar uma beta anterior sem desinstalar, o novo APK deve usar a mesma identidade de assinatura.

## Esta build inclui

- Rules Engine local, sem servidor Node no telefone.
- Catálogo completo atualmente incorporado no Ruleset `all-provided-material`.
- Home, Trainer, Creatures, Rosters, Items, Storage, Shop, NPCs, Level Up e Rules viewer.
- Navegação inferior mobile.
- Moves do Pokémon com Range e, quando disponíveis, Contest Type e Contest Effect.
- Runtime clássico local para evitar dependência de ES Modules sobre `file://`.
- Fakemon 1 leva v2.0.0 como conteúdo padrão, incluindo retratos offline.

## Importante

Esta é uma build de homologação por sideload. O primeiro objetivo é validar instalação, abertura, navegação, persistência e ergonomia em um aparelho Android real.

## beta.2 installation hotfix

The first beta APK was signed only with the legacy JAR/v1 signature. Android 11+ requires APK Signature Scheme v2 or higher for apps targeting API 30+, so modern devices such as the Galaxy S25 rejected the package with the generic “App not installed” message. beta.2 keeps the same application signing identity and now contains both v1 and v2 signatures. The v2 content digest and RSA signature are verified during the build.

## beta.3 packaging

The canonical Android build is now Tauri 2 + Gradle/Android SDK. Use `docker compose run --rm android-arm64-release-apk`; the build script validates the generated APK with `apksigner` and `zipalign -P 16`.

## Correção de build — 14/09/2026

A revisão original continha `puname:` no topo de `docker-compose.yml`. Esse campo não existe no Compose Specification e fazia `docker compose`/`docker-compose` abortar ainda na validação. A linha foi removida nesta revisão.

O APK de compatibilidade anterior não é mais a build recomendada: ele instala, mas seu `MainActivity/classes.dex` foi construído artesanalmente e pode falhar no runtime. O alvo de homologação passa a ser exclusivamente o APK Tauri/Gradle ARM64 produzido pelo comando documentado em `README_ANDROID_BUILD.md`.

## Installing Content Packs on Android (beta.6+)

Android remains a player/runtime edition: it does not include content Editors, but it can install packs created on Desktop or supplied externally.

1. Open **More**.
2. Open **Save / Import / Export**.
3. In **Content Packs**, tap **Import .ptucp**.
4. Choose the `.ptucp` file from Android Files / Downloads.
5. The app validates the archive and enables it in the currently active Ruleset.

Installed packs persist in Android app data. Re-import a newer file with the same manifest `id` to update that pack.

When importing a JSON campaign, PTU Companion checks `contentDependencies` (and pack ids recoverable from older saves). If a required pack is missing, the campaign is not imported until the `.ptucp` is installed.

## Gerenciar Content Packs no Android (beta.7)

Abra **More → Save / Import / Export → Content Packs**. Packs `.ptucp` importados agora mostram seu estado no Ruleset atual e oferecem **Enable / Disable** e **Uninstall**.

**Disable** é reversível e não apaga o arquivo do pack. **Uninstall** remove o pack importado do armazenamento privado do aplicativo. Packs incorporados na build continuam protegidos contra desinstalação. O aplicativo também bloqueia operações que quebrariam dependências obrigatórias.

Ao reimportar uma versão nova com o mesmo `manifest.id`, o aplicativo mantém a escolha anterior de ativação. Assim, atualizar um pack desativado não o reativa silenciosamente.

## HP temporário e identidade do Pokémon (beta.8)

Na Creature Sheet, `+1`/`+5` recuperam HP normal até o Máximo e transformam qualquer excedente em **Temporary HP**. Dano manual (`-1`/`-5`) consome Temporary HP primeiro. O valor é salvo localmente junto da ficha.

No card **Active State**, toque em **Edit Name & Loyalty** para alterar o nome/apelido e a Lealdade (0–6) sem alterar a Species. O fluxo de Storage zera Temporary HP junto com a recuperação completa já existente.

## Species images from Content Packs (beta.9)

The Android `.ptucp` importer accepts Species portraits embedded in the pack through `portrait_asset_path`. PNG/JPEG/WebP files up to 5 MB are validated and retained for offline display. Pack art is preferred over online sprite fallbacks.

## Trainer Experience Bank (beta.9)

Trainer Profile now shows the persistent XP Bank. Normal Level Up spends 10 XP and preserves any remainder; a GM-confirmed Milestone Level Up spends 0 XP. Edges can be purchased for 1 XP and Features for 2 XP through their respective tabs, while prerequisites and selection rules remain enforced unless GM Override is deliberately used.

## beta.13 — Export JSON e Content Pack Manager

No Android, abra **More -> Save Tools -> Export JSON Save** para exportar o perfil/campanha. A beta.13 usa o seletor nativo de arquivos do Android: escolha nome/local e confirme o salvamento.

O gerenciamento de packs agora também possui acesso direto em **More -> Content Packs** e em **Pokédex & Rules -> Manage Packs**. Packs incorporados opcionais podem ser desativados/reativados no Ruleset; packs importados por `.ptucp` também podem ser desinstalados. O PTU Core é protegido.

## Beta.15 — Hustle

Trainer Abilities now resolve Hustle mechanically: -2 to all Accuracy Rolls and +10 to all Damage Rolls. Equipment-granted Hustle is removed automatically when its source is unequipped.

## beta.17 — Weapon Store

The Shop now includes **Weapon Store**. Enabled Content Packs may advertise items with `shop_categories: ["Weapon Store"]`; those definitions are purchasable directly even when the Trainer does not yet own them. Imported item-catalog state is refreshed after pack changes.

## beta.20 — Pokédex offline

Species artwork in Pokédex lists, resolved details and creature portraits is available offline. Pack portraits have priority, followed by the exact bundled sprite and the local default fallback.
