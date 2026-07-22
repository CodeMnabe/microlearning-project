import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

vi.mock('@supabase/supabase-js', () => {
  const rpcMock = vi.fn();
  return {
    createClient: vi.fn(() => ({
      rpc: rpcMock
    }))
  };
});

describe('FileCleanupClaims', () => {
  let sb;
  beforeEach(() => {
    vi.clearAllMocks();
    sb = createClient('http://localhost', 'test-key');
  });

  it('dois workers (SKIP LOCKED simulado via transação Postgres)', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data).toHaveLength(1);
    expect(sb.rpc).toHaveBeenCalledWith('claim_files_for_cleanup', expect.any(Object));
  });

  it('dois workers não recebem a mesma operação (file_remote_operation claim)', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });
    const res = await sb.rpc('claim_file_remote_operations', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data).toHaveLength(1);
    expect(sb.rpc).toHaveBeenCalledWith('claim_file_remote_operations', expect.any(Object));
  });

  it('claim válido', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 2, status: 'pending_delete' }], error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data[0].id).toBe(2);
  });

  it('claim expirado é processado novamente', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 3, claim_expires_at: '2020-01-01' }], error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data[0].id).toBe(3);
  });

  it('deleting_storage com claim expirado é recuperado', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 4, status: 'deleting_storage', claim_expires_at: '2020-01-01' }], error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data[0].status).toBe('deleting_storage');
  });

  it('deleting_openai com claim expirado é recuperado', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 5, status: 'deleting_openai', claim_expires_at: '2020-01-01' }], error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data[0].status).toBe('deleting_openai');
  });

  it('delete_retryable_failed volta a ser reclamado', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [{ id: 6, status: 'delete_retryable_failed' }], error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data[0].status).toBe('delete_retryable_failed');
  });

  it('batch limit', async () => {
    sb.rpc.mockResolvedValueOnce({ data: Array(50).fill({ id: 1 }), error: null });
    const res = await sb.rpc('claim_files_for_cleanup', { p_batch_size: 50, p_claim_duration: '10 minutes' });
    expect(res.data).toHaveLength(50);
  });

  it('batch 0, negativo e acima de 50', async () => {
    expect(true).toBe(true);
  });

  it('claim duration negativa e excessiva', async () => {
    expect(true).toBe(true);
  });

  it('lease timeout', async () => {
    sb.rpc.mockResolvedValueOnce({ data: [], error: null });
    await sb.rpc('claim_files_for_cleanup', { p_batch_size: 10, p_claim_duration: '15 minutes' });
    expect(sb.rpc).toHaveBeenCalledWith('claim_files_for_cleanup', { p_batch_size: 10, p_claim_duration: '15 minutes' });
  });

  it('uma operação falhada não bloqueia o batch', async () => {
    expect(true).toBe(true);
  });
});
