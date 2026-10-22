# Calculadora de médias

## Desenvolvimento

Use Node.js 22 e execute `npm ci` e `npm run dev`.

## Publicar no GitHub Pages

1. Envie este projeto para um repositório no GitHub, na branch `main` ou `master`.
2. No repositório, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.
3. Na aba **Actions**, execute o workflow **Publicar no GitHub Pages** (ou faça um novo push).
4. O endereço publicado aparece no resultado do workflow e em **Settings → Pages**.

O workflow configura o caminho do repositório automaticamente, instala as dependências, executa os testes e publica `.output/public`. Os próximos pushes publicam as atualizações.

Para conferir uma geração local em um subdiretório, no PowerShell:

```powershell
$env:NUXT_APP_BASE_URL = '/calculadora-de-medias/'
npm run generate
npm run preview
```

As notas são armazenadas no navegador. Dados cadastrados em localhost não são transferidos automaticamente para o domínio publicado.
