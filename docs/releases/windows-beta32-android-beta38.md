# Candidatos de teste — Windows beta.32 / Android beta.38

PR #90: Home renderiza imagens de itens usando o helper de Items/Shop; o
cabeçalho global informa GM ON/OFF. A ficha do Trainer usa OFF explicitamente.
Base contém a pré-release beta.31/beta.37. Estes candidatos não são uma publicação.

## Identidade dos pacotes

- Windows: `2.1.0-beta.32`, metadados do launcher, runtime e interface sincronizados.
- Android: `2.2.0-beta.38`, versionCode `2002038`, package `com.ptu.companion`, ARM64.
- Assinatura Android deve manter o certificado da beta.37; conferir SHA-256
  `2c00ed097d55c0b2405a00e2b05b4c2a0494ceeab16ee1001eb888a22991c5a0`.
- Usar builder/volumes atuais e script montado com entrypoint bash; o entrypoint
  embutido na imagem é antigo e não deve fornecer os nomes/versionamento do pacote.

## Roteiro no aplicativo

1. Exportar a campanha antes de testar e usar um item de teste.
2. Na Home, conferir os itens da Backpack: ícones de texto, imagem remota ou
   embutida quando houver. A imagem deve aparecer contida no cartão; uma imagem
   indisponível deve mostrar o fallback. Conferir nome e quantidade em Items.
3. Em Trainer, alternar GM Override. Confirmar GM ON/OFF também na Home e nas
   outras telas, e confirmar o estado após fechar/reabrir o aplicativo.
4. Opcionalmente testar #77 com um grant descartável: GM OFF bloqueia remoção;
   GM ON permite confirmar; Cancel preserva o grant; confirmar e reiniciar mantém
   a remoção. Se falhar, registrar plataforma, estado GM e etapa.
5. No Android, instalar sobre beta.37, conferir a nova versão e os dados salvos.

Manifesto local, hashes, logs e medições de disco acompanham os candidatos.
Issues #75/#88 ficam abertas Aguardando validação após a entrega; #77 segue
Triagem até reprodução/validação específica do relato.
