---
description: Gera o APK de teste com EAS Build e registra a versão.
---

1. Rode `npm run check`. Se falhar, pare e conserte antes.
2. Confira se não há segredo no repositório (`git grep -nE "service_role|SECRET|PRIVATE_KEY"`) e se `.env*` está no `.gitignore`.
3. Incremente `version` e `android.versionCode` em `app.json`.
4. Rode `eas build -p android --profile preview` e espere o link do APK.
5. Acrescente em `docs/RELEASES.md`: data, versão, link e lista de mudanças em linguagem de usuário (português).
6. Mostre ao Akira o texto da release pronto para ele mandar aos testadores.
