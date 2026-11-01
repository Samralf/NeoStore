import { isAuthenticated } from '../../../../lib/auth';
import { recentAudit } from '../../../../lib/audit-log';

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await recentAudit();
  return Response.json(rows.results, { headers: { 'cache-control': 'no-store' } });
}
