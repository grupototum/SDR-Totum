// O mock (SDR_LLM=mock) deve refletir a copy do flow atual: editar reference_copy no
// canvas/builder muda o que o Modo A responde, sem precisar de chave de LLM real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockThink } from '../src/mockBrain.js';

const lead = { whatsapp: '5533999999999', nome_empresa: 'Clinica Teste', especialidade: 'implantes', cidade: 'Ipatinga' };

test('mockThink usa reference_copy do estágio (placeholders resolvidos) em vez do roteiro fixo', () => {
  const flow = {
    entry_stage: 'abertura',
    globals: {},
    stages: [{ id: 'abertura', reference_copy: ['MENSAGEM CUSTOM DO CANVAS PARA {NOME_EMPRESA}'], next: null, terminal: true }],
  };
  const out = mockThink(lead, [], { flow });
  assert.equal(out.mensagem, 'MENSAGEM CUSTOM DO CANVAS PARA Clinica Teste');
});

test('mockThink cai pro roteiro fixo quando o estágio não tem reference_copy', () => {
  const flow = { entry_stage: 'abertura', globals: {}, stages: [{ id: 'abertura', next: null, terminal: true }] };
  const out = mockThink(lead, [], { flow });
  assert.ok(out.mensagem.length > 0);
  assert.ok(!/[{}]/.test(out.mensagem), 'nunca envia placeholder cru');
});

test('mockThink nunca envia {{VAR}}/{VAR} cru quando a variável do lead está vazia', () => {
  const flow = {
    entry_stage: 'abertura',
    globals: {},
    stages: [{ id: 'abertura', reference_copy: ['Vi que a nota de vocês é {NOTA_SEO}'], next: null, terminal: true }],
  };
  const out = mockThink(lead, [], { flow }); // lead não tem nota_seo
  assert.ok(!/[{}]/.test(out.mensagem), 'cai pro roteiro fixo em vez de vazar o placeholder');
});
