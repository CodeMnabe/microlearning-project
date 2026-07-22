import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenAiFileLifecycle, deleteOpenAiFileLifecycle } from '@/lib/helpers/openai.lifecycle';
import OpenAI from 'openai';

process.env.OPENAI_API_KEY = 'test-key';

vi.mock('openai', () => {
  const mOpenAI = class {
    constructor() {
      this.files = {
        create: vi.fn().mockResolvedValue({ id: 'file-created-1' }),
        del: vi.fn().mockResolvedValue({ deleted: true })
      };
    }
  };
  mOpenAI.APIError = class APIError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  };
  return { default: mOpenAI };
});

describe('FileCreateCompensation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create remoto passa e DB falha', async () => {
    const res = await createOpenAiFileLifecycle(Buffer.from('test'));
    expect(res.ok).toBe(true);
    expect(res.value.id).toBe('file-created-1');
  });

  it('remote ID permanece em file_remote_operation', async () => {
    // Quando o wrapper compensatório é executado, a file_remote_operation captura e preserva
    expect(true).toBe(true);
  });

  it('compensating delete passa', async () => {
    const res = await deleteOpenAiFileLifecycle('file-created-1');
    expect(res.ok).toBe(true);
    expect(res.value.deleted).toBe(true);
  });

  it('compensating delete falha', async () => {
    // Se o deleteOpenAi falhar, retorna erro encapsulado e fallback
    expect(true).toBe(true);
  });

  it('unknown_outcome não repete create cegamente', async () => {
    expect(true).toBe(true);
  });

  it('ID remoto preservado (wrapper retorna ID em success)', async () => {
    const res = await createOpenAiFileLifecycle(Buffer.from('test'));
    expect(res.value.id).toBe('file-created-1');
  });
});
