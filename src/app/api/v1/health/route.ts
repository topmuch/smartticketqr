// ============================================================
// 🏥 PUBLIC API v1 — Health Check (no auth required)
// ============================================================
// Returns service health status. Used by monitoring tools and
// client applications to verify API availability.
// ============================================================

import { publicCorsResponse, publicHandleCors } from '@/lib/api-key-auth';

export async function GET() {
  return publicCorsResponse({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '5.0.0',
    },
  });
}

export async function OPTIONS() {
  return publicHandleCors();
}
