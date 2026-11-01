import * as jwt from 'jsonwebtoken';

export function extractCompanyId(token: string, secret: string): string | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
    return decoded.companyId || null;
  } catch {
    return null;
  }
}
