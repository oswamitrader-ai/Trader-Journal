# Validação do mobile e da trava desktop

## Versão de teste Android

1.0.2, versionCode 3, APK debug. A compilação usa `android/app/src/main/java/com/tradelock/shield`; os arquivos em `mobile/android` são exemplos antigos, não a implementação compilada.

## Verificações executadas

- TypeScript: `npm run lint`.
- Interface compartilhada: `npm run build`, seguida de `npx cap sync android`.
- Regressões sem rede: `node scratch/verify-mobile-lock.cjs` e `node scratch/verify-settings-sync.cjs`.
- Android: `:app:assembleDebug` com o JDK do Android Studio.
- Realtime: sete tabelas publicadas em `supabase_realtime`, todas com RLS habilitado.
- Desktop: usuário confirmou o card sobre Invest; log confirmou R$ 30 e posicionamento x=1274, y=100, largura=92, altura=38 na janela testada.

## Teste no aparelho (pendente)

- Entrar com a mesma conta usada na web/desktop; ativar a acessibilidade do TradeLock nas configurações Android.
- Confirmar o indicador de conexão e ausência de falha de sincronização.
- Ativar o bloqueio permanente no painel e abrir a Exnova no celular, sem enviar operações: deve aparecer o bloqueio nativo.
- Confirmar que o bloqueio continua com o TradeLock em segundo plano e após reiniciar o aparelho.
- Com a trava ativa, interromper temporariamente a conexão: a falha não deve liberar a corretora. Reconectar e confirmar recuperação.
- Desativar a trava pelo painel quando os limites do dia permitirem; confirmar atualização no mobile.
- A VPN opcional bloqueia somente pacotes de corretoras instaladas; o bloqueio de sites em navegadores depende da acessibilidade e da identificação da barra de endereço.

## Limites conhecidos

Eventos chegam por WebSocket; consultas periódicas recuperam eventos perdidos. Não existe garantia de latência zero ou de conexão permanente quando o sistema suspende o app, a rede cai ou a permissão de acessibilidade é removida. Não confundir compilação e testes simulados com validação física no aparelho.

O card desktop bloqueia cliques na região detectada. O teste visual não comprova bloqueio de todos os atalhos de teclado nem que o valor interno da corretora foi alterado automaticamente para o valor exibido no card.
