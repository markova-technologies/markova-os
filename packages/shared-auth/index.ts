import * as jwt from 'jsonwebtoken';

export function extractCompanyId(token: string, secret: string): string | null {
  try {
    const decoded = jwt.verify(token, secret) as any;
    return decoded.companyId || null;
  } catch {
    return null;
  }
}
