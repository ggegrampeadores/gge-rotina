# Rotina GGE — guia de colocação no ar

## O que já está pronto e funcionando (testado)

- Banco Supabase novo e separado (`gge-rotina`, região São Paulo) com todo o schema, permissões (RLS), geração automática de tarefas (03:05 todo dia via cron, já testada manualmente) e a tarefa diária "abrir o programa" com check automático no login.
- 8 pessoas cadastradas com login, 6 setores, vínculos e papéis conforme definido.
- Testes de segurança executados: usuária comum não vê dados dos outros nem cria rotina para terceiros; chefe vê só o seu setor; admin vê tudo; sem login não se vê nada.

## Logins iniciais (senha = nome + 123)

| Pessoa | Login (campo Nome) | Senha inicial |
|---|---|---|
| Marcus | Marcus | Marcus123 |
| Alex | Alex | Alex123 |
| Gabriel | Gabriel | Gabriel123 |
| Talita | Talita | Talita123 |
| Lorena | Lorena | Lorena123 |
| Fierrinho | Fierrinho | Fierrinho123 |
| Maria | Maria | Maria123 |
| Fierro | Fierro | Fierro123 |

Cada um pode trocar a senha no menu "Minha senha". Admin reseta pelo Setup.

## Passos para colocar no ar (uma vez só)

1. No GitHub, criar o repositório **gge-rotina** (pode ser privado).
2. Subir os 10 arquivos desta pasta (Add file → Upload files, dá para arrastar todos de uma vez):
   `index.html, dashboard.html, rotinas.html, lista.html, equipe.html, relatorios.html, setup.html, app.js, config.js, style.css`
   (o LEIA-ME pode subir junto, não atrapalha)
3. Na Vercel: Add New → Project → importar o repo `gge-rotina` → Deploy (sem configurar nada).
4. Pronto — o app estará em `gge-rotina.vercel.app` (ou o domínio que a Vercel der).

## Páginas

- **Meu Dia** — Hoje / Semana / Próximas (com check antecipado) / Calendário / Desempenho
- **Rotinas** — criar e gerenciar (semanal, dia do mês, única, pós-evento; pausar, encerrar)
- **Lista Geral** — tabela tipo Excel com filtros, ordenação e exportar CSV
- **Equipe** (chefe/admin) — cores por pessoa, atrasos, carga da semana, agenda de cada um
- **Relatórios** (chefe/admin) — fechamento semanal e mensal por pessoa e setor
- **Setup** (admin) — pessoas, setores, ausências, formatos, cores, hora-limite, log

## Pendência de teste

O teste visual no navegador (login e navegação nas telas) depende da extensão
Claude no Chrome conectada — assim que estiver, o Claude faz o teste completo
de ponta a ponta e corrige o que aparecer.
