// ============ Rotina GGE — núcleo compartilhado ============
window.R = (function () {
  const sb = supabase.createClient(window.ROTINA_URL, window.ROTINA_KEY);
  const R = { sb, me: null, cfg: {}, pessoas: [], setores: [], vinculos: [], formatos: [], souAdmin: false, souChefe: false };

  // ---------- datas ----------
  R.hojeISO = () => new Date().toLocaleDateString('sv-SE');
  R.addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
  R.fmtCurto = iso => { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
  R.fmtDia = iso => {
    const hoje = R.hojeISO();
    if (iso === hoje) return 'Hoje';
    if (iso === R.addDias(hoje, 1)) return 'Amanhã';
    if (iso === R.addDias(hoje, -1)) return 'Ontem';
    const d = new Date(iso + 'T12:00:00');
    const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  R.fmtHora = h => h ? h.slice(0, 5) : '';
  R.periodoNome = p => ({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }[p] || '');

  // ---------- cores de status ----------
  R.corDe = v => {
    const c = R.cfg.cores || { amarelo_min: 1, laranja_min: 3, vermelho_min: 6 };
    if (v >= c.vermelho_min) return 'red';
    if (v >= c.laranja_min) return 'orange';
    if (v >= c.amarelo_min) return 'yellow';
    return 'green';
  };
  R.corNome = c => ({ green: 'Em dia', yellow: 'Atenção', orange: 'Acumulando', red: 'Crítico' }[c]);
  R.statusInfo = s => ({
    pendente: ['Pendente', 'gray'], concluida: ['Concluída', 'green'],
    concluida_atraso: ['Concluída com atraso', 'orange'],
    concluida_antecipada: ['Antecipada', 'blue'], pulada: ['Pulada', 'gray']
  }[s] || [s, 'gray']);
  R.motivoNome = m => ({ ferias: 'Férias', licenca_medica: 'Licença médica', outro: 'Ausente' }[m] || m);

  R.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- init ----------
  R.init = async function (page) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.href = 'index.html'; return null; }
    const [pe, se, vi, fo, co] = await Promise.all([
      sb.from('pessoas').select('*').order('nome'),
      sb.from('setores').select('*').order('nome'),
      sb.from('vinculos').select('*'),
      sb.from('formatos_entrega').select('*').order('nome'),
      sb.from('config').select('*')
    ]);
    if (pe.error) { console.error(pe.error); R.toast('Erro ao carregar dados', 'err'); return null; }
    R.pessoas = pe.data || []; R.setores = se.data || []; R.vinculos = vi.data || []; R.formatos = fo.data || [];
    (co.data || []).forEach(c => R.cfg[c.chave] = c.valor);
    R.me = R.pessoas.find(p => p.auth_id === session.user.id);
    if (!R.me) { await sb.auth.signOut(); location.href = 'index.html'; return null; }
    R.souAdmin = R.me.papel === 'admin';
    R.souChefe = R.vinculos.some(v => v.pessoa_id === R.me.id && v.papel_setor === 'chefe');
    sb.rpc('rpc_registrar_abertura').then(() => {});
    R.renderShell(page);
    return R;
  };

  R.pessoa = id => R.pessoas.find(p => p.id === id) || {};
  R.setor = id => R.setores.find(s => s.id === id) || {};
  R.setoresDe = pid => R.vinculos.filter(v => v.pessoa_id === pid)
    .map(v => ({ ...R.setor(v.setor_id), papel_setor: v.papel_setor }));

  // pessoas que eu posso gerenciar (atribuir rotinas / ver)
  R.gerenciaveis = function () {
    if (R.souAdmin) return R.pessoas.filter(p => p.ativo);
    const meusSetores = R.vinculos.filter(v => v.pessoa_id === R.me.id && v.papel_setor === 'chefe').map(v => v.setor_id);
    const ids = new Set(R.vinculos.filter(v => meusSetores.includes(v.setor_id)).map(v => v.pessoa_id));
    ids.add(R.me.id);
    return R.pessoas.filter(p => ids.has(p.id) && p.ativo);
  };

  // ---------- shell (menu lateral) ----------
  R.renderShell = function (page) {
    const ic = {
      dia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
      rot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/></svg>',
      lis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
      equ: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.5 14.2c2.9.3 5 2.4 5 5.3"/></svg>',
      rel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg>',
      set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.7-1.6L13.5 2h-3l-.3 2.9a7 7 0 0 0-2.7 1.6l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .5.1 1.1.2 1.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.7 1.6l.3 2.9h3l.3-2.9a7 7 0 0 0 2.7-1.6l2.3 1 2-3.4-2-1.5c.1-.5.2-1 .2-1.6Z"/></svg>',
      sai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
    };
    let nav = `
      <button class="nav-item ${page === 'dashboard' ? 'active' : ''}" onclick="location.href='dashboard.html'">${ic.dia}<span>Meu Dia</span></button>
      <button class="nav-item ${page === 'rotinas' ? 'active' : ''}" onclick="location.href='rotinas.html'">${ic.rot}<span>Rotinas</span></button>
      <button class="nav-item ${page === 'lista' ? 'active' : ''}" onclick="location.href='lista.html'">${ic.lis}<span>Lista Geral</span></button>`;
    if (R.souAdmin || R.souChefe) nav += `
      <button class="nav-item ${page === 'equipe' ? 'active' : ''}" onclick="location.href='equipe.html'">${ic.equ}<span>Equipe</span></button>
      <button class="nav-item ${page === 'relatorios' ? 'active' : ''}" onclick="location.href='relatorios.html'">${ic.rel}<span>Relatórios</span></button>`;
    if (R.souAdmin) nav += `
      <button class="nav-item ${page === 'setup' ? 'active' : ''}" onclick="location.href='setup.html'">${ic.set}<span>Setup</span></button>`;

    const shell = document.getElementById('shell');
    shell.innerHTML = `
      <div class="logo">
        <div class="logo-mark">R</div>
        <div><div class="logo-name">Rotina</div><div class="logo-sub">GGE</div></div>
      </div>
      ${nav}
      <div class="nav-spacer"></div>
      <button class="nav-item" onclick="R.trocarSenha()">${ic.set}<span>Minha senha</span></button>
      <button class="nav-item" onclick="R.sair()">${ic.sai}<span>Sair</span></button>
      <div class="nav-user">
        <div class="avatar">${R.esc(R.me.nome[0])}</div>
        <div><div class="nav-user-name">${R.esc(R.me.nome)}</div>
        <div class="nav-user-role">${R.souAdmin ? 'Admin' : R.souChefe ? 'Chefe de setor' : 'Usuário'}</div></div>
      </div>`;
  };

  R.sair = async () => { await sb.auth.signOut(); location.href = 'index.html'; };

  R.trocarSenha = function () {
    R.modal(`
      <div class="modal-title">Trocar minha senha</div>
      <div class="modal-sub">Escolha uma senha nova, só sua.</div>
      <label class="f">Nova senha (mínimo 6 caracteres)</label>
      <input type="password" id="m-senha1">
      <label class="f">Repita a nova senha</label>
      <input type="password" id="m-senha2">
      <div class="modal-foot">
        <button class="btn" onclick="R.fecharModal()">Cancelar</button>
        <button class="btn primary" onclick="R._salvarSenha()">Salvar</button>
      </div>`);
  };
  R._salvarSenha = async function () {
    const a = document.getElementById('m-senha1').value, b = document.getElementById('m-senha2').value;
    if (a.length < 6) return R.toast('Senha muito curta (mínimo 6)', 'err');
    if (a !== b) return R.toast('As senhas não conferem', 'err');
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return R.toast('Erro: ' + error.message, 'err');
    R.fecharModal(); R.toast('Senha alterada!', 'ok');
  };

  // ---------- ações sobre ocorrências ----------
  R.doCheck = async function (id, comentario, cb) {
    const { data, error } = await sb.rpc('rpc_check', { p_ocorrencia: id, p_comentario: comentario || null });
    if (error) return R.toast(error.message.replace(/^.*: /, ''), 'err');
    const msg = { concluida: 'Feito! Em dia.', concluida_antecipada: 'Feito — adiantada!', concluida_atraso: 'Concluída (o atraso fica registrado)' }[data] || 'Feito!';
    R.toast(msg, 'ok'); if (cb) cb();
  };
  R.comentarConcluir = function (id, cb) {
    R.modal(`
      <div class="modal-title">Concluir com comentário</div>
      <label class="f">Comentário (opcional)</label>
      <textarea id="m-coment" rows="3" placeholder="Alguma observação sobre a entrega..."></textarea>
      <div class="modal-foot">
        <button class="btn" onclick="R.fecharModal()">Cancelar</button>
        <button class="btn primary" id="m-go">Concluir</button>
      </div>`);
    document.getElementById('m-go').onclick = () => {
      const c = document.getElementById('m-coment').value.trim();
      R.fecharModal(); R.doCheck(id, c || null, cb);
    };
  };
  R.pular = function (id, cb) {
    R.modal(`
      <div class="modal-title">Pular esta ocorrência</div>
      <div class="modal-sub">Não conta como atraso nem como concluída. A justificativa fica visível para o chefe e o admin.</div>
      <label class="f">Justificativa (obrigatória)</label>
      <textarea id="m-just" rows="3" placeholder="Ex.: feriado municipal, cliente remarcou, tarefa perdeu o sentido hoje..."></textarea>
      <div class="modal-foot">
        <button class="btn" onclick="R.fecharModal()">Cancelar</button>
        <button class="btn primary" id="m-go">Pular</button>
      </div>`);
    document.getElementById('m-go').onclick = async () => {
      const j = document.getElementById('m-just').value.trim();
      if (j.length < 5) return R.toast('Justificativa muito curta', 'err');
      const { error } = await sb.rpc('rpc_pular', { p_ocorrencia: id, p_justificativa: j });
      if (error) return R.toast(error.message.replace(/^.*: /, ''), 'err');
      R.fecharModal(); R.toast('Ocorrência pulada', 'ok'); if (cb) cb();
    };
  };
  R.desfazer = async function (id, cb) {
    const { error } = await sb.rpc('rpc_desfazer_check', { p_ocorrencia: id });
    if (error) return R.toast(error.message.replace(/^.*: /, ''), 'err');
    R.toast('Check desfeito', 'ok'); if (cb) cb();
  };

  // item de tarefa (usado em várias páginas)
  R.taskHTML = function (o, opts) {
    opts = opts || {};
    const pend = o.status === 'pendente';
    const done = ['concluida', 'concluida_atraso', 'concluida_antecipada'].includes(o.status);
    const [stNome, stCor] = R.statusInfo(o.status);
    const meta = [];
    if (opts.mostrarPessoa) meta.push(`<span class="badge blue">${R.esc(o.responsavel)}</span>`);
    if (o.formato) meta.push(`<span class="badge gray">${R.esc(o.formato)}</span>`);
    if (o.setor) meta.push(`<span class="badge gray">${R.esc(o.setor)}</span>`);
    if (o.horario) meta.push(`<span class="badge gray">${R.fmtHora(o.horario)}</span>`);
    else if (o.periodo) meta.push(`<span class="badge gray">${R.periodoNome(o.periodo)}</span>`);
    if (opts.mostrarData) meta.push(`<span class="badge gray">${R.fmtCurto(o.data_prevista)}</span>`);
    if (o.atrasada) meta.push(`<span class="badge red">${o.dias_atraso > 0 ? o.dias_atraso + (o.dias_atraso === 1 ? ' dia de atraso' : ' dias de atraso') : 'Atrasada'}</span>`);
    if (!pend) meta.push(`<span class="badge ${stCor}">${stNome}</span>`);
    if (o.status === 'pulada' && o.justificativa) meta.push(`<span class="badge gray" title="${R.esc(o.justificativa)}">motivo registrado</span>`);

    const extras = [];
    if (o.descricao) extras.push(R.esc(o.descricao));
    if (o.comportamento === 'comunicacao') {
      if (o.local_link) extras.push('Local: ' + R.esc(o.local_link));
      if (o.pauta) extras.push('Pauta: ' + R.esc(o.pauta));
    }
    if (o.comentario && done) extras.push('Comentário: ' + R.esc(o.comentario));

    const soLeitura = opts.soLeitura || o._participante;
    let acoes = '';
    if (!soLeitura) {
      if (pend) acoes = `
        <button class="btn sm ghost" title="Concluir com comentário" onclick="R.comentarConcluir('${o.id}', R._refresh)">+ nota</button>
        <button class="btn sm ghost" title="Pular com justificativa" onclick="R.pular('${o.id}', R._refresh)">pular</button>`;
      else if (done && o.tipo !== 'abertura') acoes = `<button class="btn sm ghost" onclick="R.desfazer('${o.id}', R._refresh)">desfazer</button>`;
    }
    const checkBtn = o._participante
      ? `<span class="dot gray" style="margin-top:8px" title="Você participa — o check é do responsável"></span>`
      : (pend
        ? `<button class="check-btn" title="Marcar como feita" onclick="R.doCheck('${o.id}', null, R._refresh)"></button>`
        : `<span class="check-btn ${done ? 'checked' : ''}" style="cursor:default"></span>`);

    return `<div class="task ${o.atrasada ? 'late' : ''} ${done ? 'done' : ''} ${o._participante ? 'info' : ''}">
      ${checkBtn}
      <div class="task-body">
        <div class="task-name">${R.esc(o.nome)}${o._participante ? ' <span class="badge blue">você participa</span>' : ''}</div>
        ${extras.length ? `<div class="task-desc">${extras.join('<br>')}</div>` : ''}
        <div class="task-meta">${meta.join('')}</div>
      </div>
      <div class="task-actions">${acoes}</div>
    </div>`;
  };
  R._refresh = () => { if (window.recarregar) window.recarregar(); };

  // ---------- modal e toast ----------
  R.modal = function (html, wide) {
    R.fecharModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg'; bg.id = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
    bg.addEventListener('mousedown', e => { if (e.target === bg) R.fecharModal(); });
    document.body.appendChild(bg);
  };
  R.fecharModal = () => { const m = document.getElementById('modal-bg'); if (m) m.remove(); };
  R.confirmar = function (titulo, sub, aoConfirmar) {
    R.modal(`
      <div class="modal-title">${titulo}</div>
      <div class="modal-sub">${sub || ''}</div>
      <div class="modal-foot">
        <button class="btn" onclick="R.fecharModal()">Cancelar</button>
        <button class="btn primary" id="m-conf">Confirmar</button>
      </div>`);
    document.getElementById('m-conf').onclick = () => { R.fecharModal(); aoConfirmar(); };
  };
  R.toast = function (msg, tipo) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = tipo || '';
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
  };

  R.log = function (acao, detalhe) {
    return sb.from('log_setup').insert({ quem: R.me.id, acao, detalhe: detalhe || null });
  };

  return R;
})();
