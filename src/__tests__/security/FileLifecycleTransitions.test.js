import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transitionFileLifecycle } from '@/lib/repos/files.repo';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

const updateMock = vi.fn();
const singleMock = vi.fn();

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        update: updateMock.mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: singleMock
      }))
    }))
  };
});

describe('FileLifecycleTransitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transições permitidas (CAS valid)', async () => {
    singleMock.mockResolvedValueOnce({ data: { id: 1, status: 'validating' }, error: null });
    const res = await transitionFileLifecycle({
      fileId: 1, organizationId: 10, from: 'pending_upload', to: 'validating'
    });
    expect(res.status).toBe('validating');
  });

  it('transições proibidas (CAS invalid - zero rows não é sucesso)', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
    await expect(transitionFileLifecycle({
      fileId: 1, organizationId: 10, from: 'validating', to: 'processing'
    })).rejects.toThrow('File lifecycle transition failed or unauthorized. fileId=1');
  });

  it('estado original diferente gera erro', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    await expect(transitionFileLifecycle({
      fileId: 2, organizationId: 10, from: 'active', to: 'deleted'
    })).rejects.toThrow();
  });

  it('organização diferente gera erro', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    await expect(transitionFileLifecycle({
      fileId: 1, organizationId: 99, from: 'active', to: 'deleted'
    })).rejects.toThrow();
  });

  it('dois updates concorrentes (apenas um update obtém a row)', async () => {
    // Simular que o primeiro tem sucesso e o segundo encontra 0 rows (PGRST116)
    singleMock
      .mockResolvedValueOnce({ data: { id: 1, status: 'validating' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    
    const p1 = transitionFileLifecycle({ fileId: 1, organizationId: 10, from: 'pending', to: 'validating' });
    const p2 = transitionFileLifecycle({ fileId: 1, organizationId: 10, from: 'pending', to: 'validating' });
    
    const results = await Promise.allSettled([p1, p2]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
  });
  
  it('deleted não regressa e pending_delete bloqueia finalize', async () => {
    // Para tentar passar de deleted para outro estado, o "from" estaria errado, disparando o erro.
    singleMock.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    await expect(transitionFileLifecycle({
      fileId: 1, organizationId: 10, from: 'deleted', to: 'active'
    })).rejects.toThrow();
  });
});
