// ============ Rotina GGE — Scrum (tarefas únicas) ============
// Faixa no topo do dashboard com as tarefas fora da rotina: prazo, % feito,
// semana de entrega e sinalização DISCRETA de ritmo (tons dessaturados).
// Toda escrita passa por RPCs no banco — com trilha de alterações automática.
window.Scrum = (function () {
  const S = { tarefas: [], admin: false, cont: null };

  // ---------- estilos próprios (tons apagados de propósito — sem sirene) ----------
  const css = `
  .scrum-strip{background:#141a24;border:1px solid var(--border);border-radius:var(--radius);
    padding:14px 16px 12px;margin-bottom:20px}
  .scrum-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .scrum-title{font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .scrum-week{font-size:11.5px;color:var(--dim)}
  .scrum-cards{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
  .scrum-card{flex:0 0 232px;background:var(--card);border:1px solid var(--border);
    border-left:3px solid var(--dim);border-radius:12px;padding:12px 14px;cursor:pointer;
    transition:border-color .15s}
  .scrum-card:hover{border-color:var(--border2)}
  .scrum-card.s-verde{border-left-color:#3f6b57}
  .scrum-card.s-amarelo{border-left-color:#7d6c42}
  .scrum-card.s-laranja{border-left-color:#8a5f3f}
  .scrum-card.s-vermelho{border-left-color:#8a4646}
  .scrum-nome{font-size:13.5px;font-weight:700;line-height:1.3;margin-bottom:8px;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .scrum-dias{font-size:20px;font-weight:800;letter-spacing:-.02em}
  .scrum-dias small{font-size:11px;font-weight:600;color:var(--dim);margin-left:4px}
  .scrum-dias.estourado{color:#b96a6a}
  .scrum-bar{height:6px;background:var(--bg2);border-radius:99px;overflow:hidden;margin:8px 0 4px}
  .scrum-fill{height:100%;background:#55617a;border-radius:99px}
  .scrum-meta{font-size:11px;color:var(--dim);display:flex;justify-content:space-between;gap:6px}
  .scrum-parado{font-size:10.5px;color:#9a8a5a;margin-top:5px}
  .scrum-resp{font-size:11px;color:var(--muted);font-weight:600;margin-bottom:4px}
  .scrum-vazio{font-size:12.5px;color:var(--dim);padding:8px 2px}
  .scrum-et{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);
    border:1px solid var(--border);border-radius:9px;margin-top:7px}
  .scrum-et input[type=checkbox]{width:16px;height:16px;flex-shrink:0;cursor:pointer}
  .scrum-et.feita span.tit{text-decoration:line-through;color:var(--dim)}
  .scrum-hist{font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--border);line-height:1.45}
  .scrum-hist b{font-weight:700}
  .scrum-hist .q{color:var(--dim);font-size:11.5px}
  .scrum-linha-nova{display:flex;gap:8px;margin-top:8px;align-items:center}
  .scrum-linha-nova input{margin:0}
  `;
  if (!document.getElementById('scrum-css')) {
    const st = document.createElement('style'); st.id = 'scrum-css';
    st.textContent = css; document.head.appendChild(st);
  }

  // ---------- semana ISO (igual ao extract(week) do banco) ----------
  S.semanaISO = function (iso) {
    const d = new Date(iso + 'T12:00:00');
    const t = new Date(d); t.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  };

  // ---------- cor por RITMO (tempo decorrido vs. % feito) — discreta ----------
  // A pessoa PODE deixar para perto da entrega; a cor só endurece de verdade
  // com prazo estourado ou fim iminente sem quase nada feito.
  S.corDe = function (t) {
    if (t.dias_restantes < 0) return 'vermelho';
    let defas = t.pct_tempo_decorrido - t.progresso_efetivo;
    let nivel = defas <= 10 ? 0 : defas <= 25 ? 1 : defas <= 40 ? 2 : 3;
    if (t.dias_sem_atualizacao >= 10 && t.progresso_efetivo < 100 && nivel < 1) nivel = 1;
    if (t.dias_restantes <= 3 && t.progresso_efetivo < 70 && nivel < 2) nivel = 2;
    return ['verde', 'amarelo', 'laranja', 'vermelho'][nivel];
  };

  S.podeMexer = function (t) {
    return R.souAdmin || t.responsavel_id === R.me.id || t.criado_por === R.me.id
      || R.gerenciaveis().some(p => p.id === t.responsavel_id);
  };

  // ---------- carga ----------
  S.carregar = async function () {
    let q = R.sb.from('vw_scrum').select('*').eq('status', 'ativa').order('data_entrega');
    if (!S.admin) q = q.eq('responsavel_id', R.me.id);
    const { data, error } = await q;
    if (error) { console.error(error); return; }
    S.tarefas = data || [];
    if (S.admin) {
      const ordem = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3 };
      S.tarefas.sort((a, b) => ordem[S.corDe(a)] - ordem[S.corDe(b)] || a.dias_restantes - b.dias_restantes);
    }
  };

  // ---------- faixa ----------
  S.faixa = async function (containerId, opts) {
    opts = opts || {};
    S.admin = !!opts.admin;
    S.cont = containerId;
    await S.carregar();
    S.render();
  };

  S.recarregar = async function () { await S.carregar(); S.render(); };

  S.render = function () {
    const el = document.getElementById(S.cont);
    if (!el) return;
    const hoje = new Date().toLocaleDateString('sv-SE');
    let h = `<div class="scrum-strip">
      <div class="scrum-head">
        <span class="scrum-title">Tarefas únicas${S.admin ? ' — equipe' : ''}</span>
        <span class="scrum-week">Semana atual: ${S.semanaISO(hoje)}</span>
        <span style="flex:1"></span>
        <button class="btn sm ghost" onclick="Scrum.verConcluidas()">histórico</button>
        <button class="btn sm" onclick="Scrum.novaModal()">+ Nova</button>
      </div>`;
    if (!S.tarefas.length) {
      h += `<div class="scrum-vazio">Nenhuma tarefa única em andamento${S.admin ? ' na equipe' : ''}. Algo fora da rotina para fazer? Crie aqui e não deixe o prazo te pegar de surpresa.</div>`;
    } else {
      h += `<div class="scrum-cards">` + S.tarefas.map(S.cardHTML).join('') + `</div>`;
    }
    h += `</div>`;
    el.innerHTML = h;
  };

  S.cardHTML = function (t) {
    const cor = S.corDe(t);
    const dias = t.dias_restantes;
    const diasTxt = dias < 0
      ? `${-dias}<small>dia${dias === -1 ? '' : 's'} de atraso</small>`
      : dias === 0 ? `hoje<small>é a entrega</small>`
      : `${dias}<small>dia${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}</small>`;
    return `<div class="scrum-card s-${cor}" onclick="Scrum.abrir('${t.id}')">
      ${S.admin ? `<div class="scrum-resp">${R.esc(t.responsavel)}</div>` : ''}
      <div class="scrum-nome">${R.esc(t.titulo)}</div>
      <div class="scrum-dias ${dias < 0 ? 'estourado' : ''}">${diasTxt}</div>
      <div class="scrum-bar"><div class="scrum-fill" style="width:${t.progresso_efetivo}%"></div></div>
      <div class="scrum-meta">
        <span>${t.progresso_efetivo}% feito${t.n_etapas ? ` · ${t.n_etapas_concluidas}/${t.n_etapas} etapas` : ''}</span>
        <span>Sem. ${t.semana_entrega} · ${R.fmtCurto(t.data_entrega)}</span>
      </div>
      ${t.dias_sem_atualizacao >= 7 && t.progresso_efetivo < 100
        ? `<div class="scrum-parado">sem atualização há ${t.dias_sem_atualizacao} dias</div>` : ''}
    </div>`;
  };

  // ---------- detalhe ----------
  S.abrir = async function (id) {
    const t = S.tarefas.find(x => x.id === id) || (await S._buscaUma(id));
    if (!t) return R.toast('Tarefa não encontrada', 'err');
    const { data: etapas } = await R.sb.from('scrum_etapas').select('*')
      .eq('tarefa_id', id).order('ordem');
    const cor = S.corDe(t);
    const nomeCor = { verde: 'no ritmo', amarelo: 'atenção ao ritmo', laranja: 'ritmo atrasado', vermelho: t.dias_restantes < 0 ? 'prazo estourado' : 'ritmo crítico' }[cor];
    const mexe = S.podeMexer(t) && t.status === 'ativa';

    let h = `<div class="modal-title">${R.esc(t.titulo)}</div>
      <div class="modal-sub">${R.esc(t.descricao || '')}</div>
      <div class="task-meta" style="margin-top:12px">
        <span class="badge gray">${R.esc(t.responsavel)}</span>
        <span class="badge gray">Entrega: Semana ${t.semana_entrega} — ${R.fmtCurto(t.data_entrega)}</span>
        <span class="badge gray">${t.dias_restantes < 0 ? Math.abs(t.dias_restantes) + ' dias de atraso' : t.dias_restantes + ' dias restantes'}</span>
        <span class="badge gray">${nomeCor}</span>
        ${t.status !== 'ativa' ? `<span class="badge ${t.status === 'concluida' ? 'green' : 'gray'}">${t.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span>` : ''}
      </div>
      <div class="scrum-bar" style="margin-top:14px;height:8px"><div class="scrum-fill" style="width:${t.progresso_efetivo}%"></div></div>
      <div class="hint" style="margin-top:4px">${t.progresso_efetivo}% feito · criada por ${R.esc(t.criado_por_nome || '?')} em ${R.fmtCurto(t.criado_em.slice(0, 10))}${t.dias_sem_atualizacao >= 7 && t.status === 'ativa' ? ` · <span style="color:#9a8a5a">sem atualização há ${t.dias_sem_atualizacao} dias</span>` : ''}</div>`;

    if (etapas && etapas.length) {
      h += `<label class="f" style="margin-top:16px">Etapas (${etapas.filter(e => e.concluida).length}/${etapas.length}) — o % vem delas</label>`;
      etapas.forEach(e => {
        h += `<div class="scrum-et ${e.concluida ? 'feita' : ''}">
          <input type="checkbox" ${e.concluida ? 'checked' : ''} ${mexe ? '' : 'disabled'}
            onchange="Scrum.toggleEtapa('${e.id}', this.checked, '${t.id}')">
          <span class="tit" style="flex:1;font-size:13.5px">${R.esc(e.titulo)}</span>
          <span class="hint" style="margin:0">${e.prazo ? 'até ' + R.fmtCurto(e.prazo) : ''}</span>
          ${mexe ? `<button class="btn sm ghost" title="Remover etapa" onclick="Scrum.delEtapa('${e.id}')">×</button>` : ''}
        </div>`;
      });
      if (mexe) h += `<div class="scrum-linha-nova">
        <input id="sc-et-novo" placeholder="Nova etapa..." style="flex:2">
        <input id="sc-et-prazo" type="date" style="flex:1">
        <button class="btn sm" onclick="Scrum.addEtapa('${t.id}')">adicionar</button>
      </div>`;
    } else if (mexe) {
      h += `<label class="f" style="margin-top:16px">Quanto já foi feito? <span id="sc-pct-lbl" style="color:var(--accent2)">${t.progresso_efetivo}%</span></label>
        <div style="display:flex;gap:10px;align-items:center">
          <input type="range" id="sc-pct" min="0" max="100" step="5" value="${t.progresso_efetivo}"
            oninput="document.getElementById('sc-pct-lbl').textContent=this.value+'%'" style="flex:1;padding:0">
          <button class="btn sm" onclick="Scrum.salvarPct('${t.id}')">salvar</button>
        </div>
        <div class="scrum-linha-nova">
          <input id="sc-et-novo" placeholder="Ou planeje por etapas: primeira etapa..." style="flex:2">
          <input id="sc-et-prazo" type="date" style="flex:1">
          <button class="btn sm ghost" onclick="Scrum.addEtapa('${t.id}')">criar etapa</button>
        </div>
        <div class="hint">Ao criar etapas, o % passa a ser calculado por elas.</div>`;
    }

    h += `<div class="modal-foot" style="justify-content:space-between">
      <div style="display:flex;gap:8px">
        <button class="btn sm ghost" onclick="Scrum.verAlteracoes('${t.id}')">ver alterações</button>
        ${mexe ? `<button class="btn sm ghost danger" onclick="Scrum.cancelar('${t.id}')">cancelar tarefa</button>` : ''}
        ${t.status !== 'ativa' && S.podeMexer(t) ? `<button class="btn sm ghost" onclick="Scrum.reabrir('${t.id}')">reabrir</button>` : ''}
      </div>
      <div style="display:flex;gap:8px">
        ${mexe ? `<button class="btn" onclick="Scrum.editarModal('${t.id}')">Editar</button>
        <button class="btn primary" onclick="Scrum.concluir('${t.id}')">Concluir ✓</button>` : `<button class="btn" onclick="R.fecharModal()">Fechar</button>`}
      </div>
    </div>`;
    R.modal(h, true);
  };

  S._buscaUma = async function (id) {
    const { data } = await R.sb.from('vw_scrum').select('*').eq('id', id).single();
    return data;
  };

  // ---------- ações ----------
  S._erro = e => R.toast((e.message || String(e)).replace(/^.*?: /, ''), 'err');

  S.toggleEtapa = async function (etapaId, checked, tarefaId) {
    const { error } = await R.sb.rpc('rpc_scrum_etapa_toggle', { p_etapa: etapaId, p_concluida: checked });
    if (error) { S._erro(error); await S.recarregar(); if (tarefaId) S.abrir(tarefaId); return; }
    R.toast(checked ? 'Etapa concluída!' : 'Etapa reaberta', 'ok');
    await S.recarregar();
    if (tarefaId) S.abrir(tarefaId);
  };

  S.addEtapa = async function (tarefaId) {
    const tit = (document.getElementById('sc-et-novo') || {}).value || '';
    const prazo = (document.getElementById('sc-et-prazo') || {}).value || null;
    if (tit.trim().length < 2) return R.toast('Dê um nome para a etapa', 'err');
    const { error } = await R.sb.rpc('rpc_scrum_etapa_add', { p_tarefa: tarefaId, p_titulo: tit.trim(), p_prazo: prazo || null });
    if (error) return S._erro(error);
    R.toast('Etapa adicionada', 'ok');
    await S.recarregar(); S.abrir(tarefaId);
  };

  S.delEtapa = async function (etapaId) {
    const { data: e } = await R.sb.from('scrum_etapas').select('tarefa_id').eq('id', etapaId).single();
    const { error } = await R.sb.rpc('rpc_scrum_etapa_del', { p_etapa: etapaId });
    if (error) return S._erro(error);
    R.toast('Etapa removida', 'ok');
    await S.recarregar(); if (e) S.abrir(e.tarefa_id);
  };

  S.salvarPct = async function (tarefaId) {
    const v = parseInt(document.getElementById('sc-pct').value, 10);
    const { error } = await R.sb.rpc('rpc_scrum_progresso', { p_tarefa: tarefaId, p_progresso: v });
    if (error) return S._erro(error);
    R.toast(`Progresso: ${v}%`, 'ok');
    await S.recarregar(); S.abrir(tarefaId);
  };

  S.concluir = function (tarefaId) {
    R.confirmar('Concluir esta tarefa?', 'Ela sai da faixa e fica registrada no histórico com seu nome.', async () => {
      const { error } = await R.sb.rpc('rpc_scrum_concluir', { p_tarefa: tarefaId });
      if (error) return S._erro(error);
      R.toast('Tarefa concluída. Muito bem!', 'ok');
      S.recarregar();
    });
  };

  S.reabrir = async function (tarefaId) {
    const { error } = await R.sb.rpc('rpc_scrum_reabrir', { p_tarefa: tarefaId });
    if (error) return S._erro(error);
    R.toast('Tarefa reaberta', 'ok');
    await S.recarregar(); S.abrir(tarefaId);
  };

  S.cancelar = function (tarefaId) {
    R.modal(`
      <div class="modal-title">Cancelar tarefa</div>
      <div class="modal-sub">A tarefa perdeu o sentido? Ela sai da faixa, mas fica no histórico com a justificativa.</div>
      <label class="f">Justificativa (obrigatória)</label>
      <textarea id="sc-just" rows="3" placeholder="Ex.: a sala será demolida na reforma..."></textarea>
      <div class="modal-foot">
        <button class="btn" onclick="R.fecharModal()">Voltar</button>
        <button class="btn primary" id="sc-go">Cancelar tarefa</button>
      </div>`);
    document.getElementById('sc-go').onclick = async () => {
      const j = (document.getElementById('sc-just').value || '').trim();
      if (j.length < 5) return R.toast('Justificativa muito curta', 'err');
      const { error } = await R.sb.rpc('rpc_scrum_cancelar', { p_tarefa: tarefaId, p_motivo: j });
      if (error) return S._erro(error);
      R.fecharModal(); R.toast('Tarefa cancelada', 'ok'); S.recarregar();
    };
  };

  // ---------- criar / editar ----------
  S._etapasTmp = [];

  S.novaModal = function () {
    S._etapasTmp = [];
    const pessoas = R.gerenciaveis();
    const selResp = pessoas.length > 1
      ? `<label class="f">Responsável</label><select id="sc-resp">` +
        pessoas.map(p => `<option value="${p.id}" ${p.id === R.me.id ? 'selected' : ''}>${R.esc(p.nome)}</option>`).join('') + `</select>`
      : `<input type="hidden" id="sc-resp" value="${R.me.id}">`;
    R.modal(`
      <div class="modal-title">Nova tarefa única</div>
      <div class="modal-sub">Algo fora da rotina, com data de entrega. Aparece na faixa desde já — mesmo faltando meses.</div>
      <label class="f">O que precisa ser feito?</label>
      <input id="sc-tit" placeholder="Ex.: Pintar a sala de reunião">
      <label class="f">Detalhes (opcional)</label>
      <textarea id="sc-desc" rows="2" placeholder="Contexto, materiais, o que é 'pronto'..."></textarea>
      ${selResp}
      <label class="f">Data de entrega</label>
      <input id="sc-data" type="date">
      <div class="hint" id="sc-sem"></div>
      <label class="f">Etapas (opcional — ajudam a não deixar tudo para a véspera)</label>
      <div id="sc-etapas"></div>
      <div class="scrum-linha-nova">
        <input id="sc-net" placeholder="Ex.: Comprar tinta" style="flex:2">
        <input id="sc-nprazo" type="date" style="flex:1">
        <button class="btn sm" onclick="Scrum.addEtapaTmp()">adicionar</button>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="R.fecharModal()">Cancelar</button>
        <button class="btn primary" onclick="Scrum.salvarNova()">Criar tarefa</button>
      </div>`, true);
    document.getElementById('sc-data').addEventListener('change', function () {
      document.getElementById('sc-sem').textContent = this.value
        ? `Entrega na semana ${S.semanaISO(this.value)} do ano` : '';
    });
  };

  S.addEtapaTmp = function () {
    const tit = document.getElementById('sc-net').value.trim();
    const prazo = document.getElementById('sc-nprazo').value || null;
    if (tit.length < 2) return R.toast('Dê um nome para a etapa', 'err');
    S._etapasTmp.push({ titulo: tit, prazo });
    document.getElementById('sc-net').value = ''; document.getElementById('sc-nprazo').value = '';
    S._renderEtapasTmp();
  };
  S._renderEtapasTmp = function () {
    document.getElementById('sc-etapas').innerHTML = S._etapasTmp.map((e, i) =>
      `<div class="scrum-et"><span class="tit" style="flex:1;font-size:13.5px">${R.esc(e.titulo)}</span>
       <span class="hint" style="margin:0">${e.prazo ? 'até ' + R.fmtCurto(e.prazo) : ''}</span>
       <button class="btn sm ghost" onclick="Scrum.delEtapaTmp(${i})">×</button></div>`).join('');
  };
  S.delEtapaTmp = function (i) { S._etapasTmp.splice(i, 1); S._renderEtapasTmp(); };

  S.salvarNova = async function () {
    const tit = document.getElementById('sc-tit').value.trim();
    const desc = document.getElementById('sc-desc').value.trim();
    const resp = document.getElementById('sc-resp').value;
    const data = document.getElementById('sc-data').value;
    if (tit.length < 3) return R.toast('Dê um título para a tarefa (mínimo 3 letras)', 'err');
    if (!data) return R.toast('Escolha a data de entrega', 'err');
    const { error } = await R.sb.rpc('rpc_scrum_criar', {
      p_titulo: tit, p_descricao: desc || null, p_responsavel: resp,
      p_data_entrega: data, p_etapas: S._etapasTmp
    });
    if (error) return S._erro(error);
    R.fecharModal(); R.toast('Tarefa criada — está na faixa!', 'ok'); S.recarregar();
  };

  S.editarModal = async function (id) {
    const t = S.tarefas.find(x => x.id === id) || (await S._buscaUma(id));
    if (!t) return;
    const pessoas = R.gerenciaveis();
    const podeTransferir = pessoas.length > 1;
    R.modal(`
      <div class="modal-title">Editar tarefa</div>
      <div class="modal-sub">Toda alteração fica registrada: quem mudou, o quê, e quando.</div>
      <label class="f">Título</label>
      <input id="sc-tit" value="${R.esc(t.titulo)}">
      <label class="f">Detalhes</label>
      <textarea id="sc-desc" rows="2">${R.esc(t.descricao || '')}</textarea>
      ${podeTransferir ? `<label class="f">Responsável</label><select id="sc-resp">` +
        pessoas.map(p => `<option value="${p.id}" ${p.id === t.responsavel_id ? 'selected' : ''}>${R.esc(p.nome)}</option>`).join('') + `</select>`
        : `<input type="hidden" id="sc-resp" value="${t.responsavel_id}">`}
      <label class="f">Data de entrega</label>
      <input id="sc-data" type="date" value="${t.data_entrega}">
      <div class="hint" id="sc-sem">Entrega na semana ${t.semana_entrega} do ano</div>
      <div class="modal-foot">
        <button class="btn" onclick="Scrum.abrir('${t.id}')">Voltar</button>
        <button class="btn primary" onclick="Scrum.salvarEdicao('${t.id}')">Salvar alterações</button>
      </div>`);
    document.getElementById('sc-data').addEventListener('change', function () {
      document.getElementById('sc-sem').textContent = this.value
        ? `Entrega na semana ${S.semanaISO(this.value)} do ano` : '';
    });
  };

  S.salvarEdicao = async function (id) {
    const { error } = await R.sb.rpc('rpc_scrum_editar', {
      p_tarefa: id,
      p_titulo: document.getElementById('sc-tit').value.trim() || null,
      p_descricao: document.getElementById('sc-desc').value,
      p_data_entrega: document.getElementById('sc-data').value || null,
      p_responsavel: document.getElementById('sc-resp').value || null
    });
    if (error) return S._erro(error);
    R.toast('Alterações salvas e registradas', 'ok');
    await S.recarregar(); S.abrir(id);
  };

  // ---------- histórico de alterações + progresso ----------
  S.verAlteracoes = async function (id) {
    const [alt, prog] = await Promise.all([
      R.sb.from('scrum_alteracoes').select('*').eq('tarefa_id', id).order('em', { ascending: false }),
      R.sb.from('scrum_progresso').select('*').eq('tarefa_id', id).order('em', { ascending: false })
    ]);
    const nome = pid => (R.pessoa(pid).nome || '?');
    const fmt = ts => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const linhas = []
      .concat((alt.data || []).map(a => ({
        em: a.em,
        html: `<b>${R.esc(a.campo)}</b>: ${a.valor_antigo ? R.esc(a.valor_antigo) + ' → ' : ''}${R.esc(a.valor_novo || '—')}
               <div class="q">${R.esc(nome(a.por))} · ${fmt(a.em)}</div>`
      })))
      .concat((prog.data || []).map(p => ({
        em: p.em,
        html: `progresso: <b>${p.progresso}%</b>${p.origem === 'etapas' ? ' (via etapas)' : ''}${p.observacao ? ' — ' + R.esc(p.observacao) : ''}
               <div class="q">${R.esc(nome(p.por))} · ${fmt(p.em)}</div>`
      })))
      .sort((a, b) => new Date(b.em) - new Date(a.em));
    R.modal(`
      <div class="modal-title">Histórico da tarefa</div>
      <div class="modal-sub">Tudo que mudou, quem mudou e quando — nada se perde.</div>
      <div style="margin-top:12px;max-height:50vh;overflow-y:auto">
        ${linhas.length ? linhas.map(l => `<div class="scrum-hist">${l.html}</div>`).join('') : '<div class="empty">Nenhuma alteração ainda.</div>'}
      </div>
      <div class="modal-foot"><button class="btn" onclick="Scrum.abrir('${id}')">Voltar</button></div>`, true);
  };

  // ---------- histórico de concluídas/canceladas ----------
  S.verConcluidas = async function () {
    let q = R.sb.from('vw_scrum').select('*').neq('status', 'ativa')
      .order('atualizado_em', { ascending: false }).limit(60);
    if (!S.admin) q = q.eq('responsavel_id', R.me.id);
    const { data } = await q;
    const lista = data || [];
    R.modal(`
      <div class="modal-title">Histórico de tarefas únicas</div>
      <div class="modal-sub">Concluídas e canceladas${S.admin ? ' — equipe toda' : ''}.</div>
      <div style="margin-top:12px;max-height:55vh;overflow-y:auto">
        ${lista.length ? lista.map(t => `
          <div class="scrum-hist" style="cursor:pointer" onclick="Scrum.abrir('${t.id}')">
            <b>${R.esc(t.titulo)}</b>
            <span class="badge ${t.status === 'concluida' ? 'green' : 'gray'}" style="margin-left:6px">
              ${t.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span>
            <div class="q">${R.esc(t.responsavel)} · entrega era ${R.fmtCurto(t.data_entrega)} (sem. ${t.semana_entrega})
              ${t.status === 'concluida' && t.concluida_em ? ' · concluída em ' + R.fmtCurto(t.concluida_em.slice(0, 10)) + (t.concluida_por_nome ? ' por ' + R.esc(t.concluida_por_nome) : '') : ''}
              ${t.cancelada_motivo ? ' · motivo: ' + R.esc(t.cancelada_motivo) : ''}</div>
          </div>`).join('') : '<div class="empty">Nada por aqui ainda.</div>'}
      </div>
      <div class="modal-foot"><button class="btn" onclick="R.fecharModal()">Fechar</button></div>`, true);
  };

  return S;
})();
